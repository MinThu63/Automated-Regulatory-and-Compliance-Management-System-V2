const eventBus = require('./eventBus');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const OpenAI = require('openai');
const pool = require('../db');
const { embedRegulation, embedAllExistingData, initPinecone } = require('../services/ragEngine');

// =============================================
// INGESTION AGENT
// Responsibility: Scrape regulatory sources, deduplicate, store new regulations
// Emits: regulation.new, regulation.updated
// Trigger: Cron schedule (every 14 days) + server startup
//
// Includes: CHANGE DETECTION — real diff between old and new regulation text,
// not a raw content dump. Produces structured "what changed" for downstream
// Impact Assessment and Task Generation.
// =============================================

const AGENT_NAME = 'IngestionAgent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// CHANGE DETECTION PROMPT
// =============================================

const DIFF_SYSTEM_PROMPT = `You are a change detection agent at Green Link Digital Bank (GLDB). Your role is to compare an OLD and NEW version of a regulatory text and identify exactly what changed. Be precise — do not describe the whole document, only the differences. Always output valid JSON.`;

const DIFF_USER_PROMPT = `Compare these two versions of the same regulation and identify specific differences.

OLD VERSION:
{old_content}

NEW VERSION:
{new_content}

Identify:
1. Requirements ADDED that were not in the old version
2. Requirements REMOVED that were in the old version but not the new
3. Requirements MODIFIED (changed wording, thresholds, deadlines, etc.)
4. Any EXPLICIT compliance deadline mentioned in the new version (e.g. "by 1 March 2027", "within 90 days") — extract as a date if possible, else null

Respond with ONLY a JSON object:
{"added": ["..."], "removed": ["..."], "modified": ["..."], "explicit_deadline": "YYYY-MM-DD or null", "summary": "one sentence overview of the change"}`;

// =============================================
// GENERATE STRUCTURED DIFF (old vs new content)
// =============================================

async function detectChanges(oldContent, newContent) {
  if (!oldContent || oldContent.trim().length < 20) {
    return { added: [], removed: [], modified: [], explicit_deadline: null, summary: 'New regulation — no prior version to compare.' };
  }

  try {
    var prompt = DIFF_USER_PROMPT
      .replace('{old_content}', oldContent.substring(0, 1500))
      .replace('{new_content}', newContent.substring(0, 1500));

    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: DIFF_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    var content = response.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (err) {
    console.error('[' + AGENT_NAME + '] Change detection failed:', err.message);
    return { added: [], removed: [], modified: [], explicit_deadline: null, summary: 'Content updated (diff unavailable): ' + newContent.substring(0, 200) };
  }
}

function formatDiffSummary(diff) {
  var parts = [];
  if (diff.summary) parts.push(diff.summary);
  if (diff.added && diff.added.length > 0) parts.push('ADDED: ' + diff.added.join('; '));
  if (diff.removed && diff.removed.length > 0) parts.push('REMOVED: ' + diff.removed.join('; '));
  if (diff.modified && diff.modified.length > 0) parts.push('MODIFIED: ' + diff.modified.join('; '));
  return parts.join(' | ').substring(0, 2000);
}

// =============================================
// CONTENT-BASED CHANGE DETECTION HELPER
// Determines if scraped content is meaningfully different from stored content.
// Prevents false positives from minor whitespace/formatting changes during scraping.
// =============================================

function contentSignificantlyDifferent(oldText, newText) {
  if (!oldText || !newText) return false;
  var oldClean = oldText.replace(/\s+/g, ' ').trim();
  var newClean = newText.replace(/\s+/g, ' ').trim();
  if (oldClean === newClean) return false;

  // Compare at the shorter length to avoid false positives from truncation differences.
  // If old was stored at 2000 chars and new scrapes 5000 chars of the same page,
  // that's NOT a real change — just more text captured.
  var compareLen = Math.min(oldClean.length, newClean.length, 3000);
  var oldCompare = oldClean.substring(0, compareLen);
  var newCompare = newClean.substring(0, compareLen);

  if (oldCompare === newCompare) return false; // Same content, just different truncation

  // Check if meaningful differences exist in the overlapping portion
  // If first 300 chars are identical, check middle and end sections
  if (oldCompare.substring(0, 300) === newCompare.substring(0, 300)) {
    // First 300 chars match — check if the rest is substantially different
    var oldMid = oldCompare.substring(300, 800);
    var newMid = newCompare.substring(300, 800);
    if (oldMid === newMid) return false; // Middle also matches — likely same content
  }

  return true; // Content genuinely differs in the overlapping region
}

// Source configuration
const SOURCES = {
  MAS: { id: 1, url: process.env.MAS_SCRAPE_URL || 'https://www.mas.gov.sg/regulation/anti-money-laundering' },
  FATF: { id: 2, url: 'https://www.fatf-gafi.org/en/publications.html' },
  FinCEN: { id: 3, url: 'https://www.fincen.gov/news-room' },
  ECB: { id: 4, url: 'https://www.bankingsupervision.europa.eu/press/publications' },
  FCA: { id: 5, url: 'https://www.fca.org.uk/publications' }
};

// =============================================
// SCRAPING FUNCTIONS
// =============================================

async function scrapeSource(name, sourceId, url, linkSelector, baseUrl) {
  console.log('[' + AGENT_NAME + '] Scraping ' + name + '...');
  var results = [];
  try {
    var response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    var $ = cheerio.load(response.data);
    var links = [];
    $(linkSelector).each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');
      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : baseUrl + href) : url;
        // Skip PDF, DOC, XLS, and other binary file links
        if (/\.(pdf|doc|docx|xls|xlsx|zip|ppt|pptx)(\?|$)/i.test(fullUrl)) {
          return; // skip binary files
        }
        links.push({ title: title.substring(0, 255), href: fullUrl });
      }
    });

    console.log('[' + AGENT_NAME + '] ' + name + ': found ' + links.length + ' HTML links, fetching content...');

    for (var link of links) {
      try {
        var pageResp = await axios.get(link.href, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000,
          maxRedirects: 3
        });

        // Check content-type — skip if not HTML
        var contentType = (pageResp.headers['content-type'] || '').toLowerCase();
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          console.log('[' + AGENT_NAME + '] Skipping non-HTML: ' + link.href.substring(0, 60));
          continue;
        }

        // Check for PDF binary signature in response body
        var bodyStart = (typeof pageResp.data === 'string') ? pageResp.data.substring(0, 20) : '';
        if (bodyStart.includes('%PDF')) {
          console.log('[' + AGENT_NAME + '] Skipping PDF content: ' + link.href.substring(0, 60));
          continue;
        }

        var page$ = cheerio.load(pageResp.data);

        // Remove scripts, styles, nav, footer
        page$('script, style, nav, footer, header, .breadcrumb, .sidebar').remove();

        // Try to find main content area
        var content = page$('main').text().trim()
          || page$('article').text().trim()
          || page$('.content').text().trim()
          || page$('#content').text().trim()
          || page$('.main-content').text().trim()
          || page$('body').text().trim();

        // Clean whitespace
        content = content.replace(/\s+/g, ' ').trim();

        // Strip common website UI boilerplate that gets scraped with content
        content = content.replace(/Decrease font size Increase font size Print this page\s*/gi, '');
        content = content.trim();

        // Skip if content is too short or looks like binary garbage
        if (content.length < 50 || /[\x00-\x08\x0E-\x1F]/.test(content.substring(0, 100))) {
          continue;
        }

        if (content.length > 5000) {
          content = content.substring(0, 5000);
        }

        results.push({
          source_id: sourceId,
          title: link.title,
          category: name === 'MAS' ? 'AML' : (name === 'ECB' ? 'Banking Supervision' : (name === 'FCA' ? 'Financial Conduct' : 'AML')),
          content: content,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: link.href
        });
      } catch (pageErr) {
        // Skip pages that can't be fetched — don't store garbage
        console.log('[' + AGENT_NAME + '] Failed to fetch: ' + link.href.substring(0, 60));
      }
    }

    console.log('[' + AGENT_NAME + '] ' + name + ' scrape complete: ' + results.length + ' regulations with clean content');
  } catch (err) {
    console.error('[' + AGENT_NAME + '] ' + name + ' scrape failed:', err.message);
  }
  return results;
}

async function scrapeMAS() {
  return scrapeSource('MAS', 1, SOURCES.MAS.url, 'a[href*="/regulation/"]', 'https://www.mas.gov.sg');
}

async function scrapeFATF() {
  return scrapeSource('FATF', 2, SOURCES.FATF.url, 'a[href*="/publications/"], a[href*="/recommendations/"]', 'https://www.fatf-gafi.org');
}

async function scrapeFinCEN() {
  return scrapeSource('FinCEN', 3, SOURCES.FinCEN.url, 'a[href*="/news/"], a[href*="/resources/"]', 'https://www.fincen.gov');
}

async function scrapeECB() {
  return scrapeSource('ECB', 4, SOURCES.ECB.url, 'a[href*="/pub/"], a[href*="/press/"]', 'https://www.bankingsupervision.europa.eu');
}

async function scrapeFCA() {
  return scrapeSource('FCA', 5, SOURCES.FCA.url, 'a[href*="/publications/"], a[href*="/policy-statements/"]', 'https://www.fca.org.uk');
}

// =============================================
// DEDUPLICATION + STORAGE (emits events)
// =============================================

async function processRegulations(data) {
  var inserted = 0;
  var updated = 0;

  for (var item of data) {
    try {
      var [existing] = await pool.query(
        'SELECT reg_id, version, content FROM regulations WHERE title = ? AND source_id = ?',
        [item.title, item.source_id]
      );

      if (existing.length > 0) {
        var existingReg = existing[0];
        var existingVersion = parseFloat(existingReg.version) || 1.0;
        var oldContent = existingReg.content || '';

        // CONTENT-BASED CHANGE DETECTION — compare actual text, not version numbers.
        // This correctly detects when a regulation's content has been modified on the source website,
        // even if the scraper doesn't know the new version number.
        if (contentSignificantlyDifferent(oldContent, item.content)) {
          var newVersion = existingVersion + 1.0; // Auto-increment version on real content change

          // LLM-powered structured diff: identify added/removed/modified requirements
          var diff = await detectChanges(oldContent, item.content);

          await pool.query(
            'UPDATE regulations SET content = ?, version = ?, published_date = ? WHERE reg_id = ?',
            [item.content, newVersion, item.published_date || null, existingReg.reg_id]
          );

          // Emit regulation.updated event for other agents, carrying the structured diff
          eventBus.emit('regulation.updated', {
            reg_id: existingReg.reg_id,
            title: item.title,
            content: item.content,
            old_content: oldContent,
            new_content: item.content,
            source_id: item.source_id,
            category: item.category,
            previous_version: existingVersion,
            new_version: newVersion,
            change_diff: diff,
            change_summary: formatDiffSummary(diff),
            explicit_deadline: diff.explicit_deadline && diff.explicit_deadline !== 'null' ? diff.explicit_deadline : null
          });

          await embedRegulation(existingReg.reg_id, item.title, item.content);
          updated++;
          console.log('[' + AGENT_NAME + '] Updated:', item.title, '(v' + existingVersion + ' → v' + newVersion + ')', '| Diff:', diff.summary || 'n/a');
        }
        continue;
      }

      // New regulation — insert
      var [result] = await pool.query(
        'INSERT INTO regulations (source_id, title, category, content, version, published_date, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.source_id, item.title, item.category, item.content, item.version || 1.0, item.published_date || null, item.source_url || null]
      );

      // Emit regulation.new event for other agents
      eventBus.emit('regulation.new', {
        reg_id: result.insertId,
        title: item.title,
        content: item.content,
        source_id: item.source_id,
        category: item.category,
        version: item.version || 1.0,
        source_url: item.source_url
      });

      await embedRegulation(result.insertId, item.title, item.content);
      inserted++;
      console.log('[' + AGENT_NAME + '] Inserted:', item.title);

    } catch (err) {
      console.error('[' + AGENT_NAME + '] DB error:', err.message);
    }
  }

  return { inserted, updated };
}

// =============================================
// MAIN RUN FUNCTION
// =============================================

async function run() {
  console.log('');
  console.log('========================================');
  console.log('[' + AGENT_NAME + '] Starting feed integration at', new Date().toLocaleString());
  console.log('========================================');

  var [masData, fatfData, fincenData, ecbData, fcaData] = await Promise.all([
    scrapeMAS(), scrapeFATF(), scrapeFinCEN(), scrapeECB(), scrapeFCA()
  ]);

  var allData = masData.concat(fatfData, fincenData, ecbData, fcaData);
  console.log('[' + AGENT_NAME + '] Total items fetched:', allData.length);

  if (allData.length > 0) {
    var result = await processRegulations(allData);
    console.log('[' + AGENT_NAME + '] New:', result.inserted, '| Updated:', result.updated);
  }

  console.log('[' + AGENT_NAME + '] Feed integration complete');
  console.log('========================================');
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');

  // Embed existing data on startup
  embedAllExistingData().then(function() {
    run();
  }).catch(function(err) {
    console.error('[' + AGENT_NAME + '] Initial embedding failed:', err.message);
    run();
  });

  // Schedule: every 14 days at 2:00 AM
  cron.schedule('0 2 */14 * *', function() {
    run();
  });

  console.log('[' + AGENT_NAME + '] Scheduled: every 14 days at 2:00 AM');
}

module.exports = { start, run };
