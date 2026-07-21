const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const pool = require('../db');
const { assessImpactRAG, embedRegulation, embedAllExistingData } = require('./ragEngine');
const { sendAlertNotification } = require('./notificationService');

// =============================================
// Source IDs — Multi-source (5 regulatory bodies)
// =============================================

const MAS_SOURCE_ID = 1;
const FATF_SOURCE_ID = 2;
const FINCEN_SOURCE_ID = 3;
const ECB_SOURCE_ID = 4;
const FCA_SOURCE_ID = 5;

const MAS_SCRAPE_URL = process.env.MAS_SCRAPE_URL || 'https://www.mas.gov.sg/regulation/anti-money-laundering';
const FATF_SCRAPE_URL = 'https://www.fatf-gafi.org/en/publications.html';
const FINCEN_SCRAPE_URL = 'https://www.fincen.gov/news-room';
const ECB_SCRAPE_URL = 'https://www.bankingsupervision.europa.eu/press/publications';
const FCA_SCRAPE_URL = 'https://www.fca.org.uk/publications';

// =============================================
// Impact-to-Severity Mapping
// =============================================

function mapImpactToSeverity(impactScore) {
  if (impactScore === 'Critical') return 'Immediate Action Required';
  if (impactScore === 'High') return 'Immediate Action Required';
  if (impactScore === 'Medium') return 'Review Recommended';
  return 'Informational';
}

// =============================================
// Database Insertion (with RAG-powered impact assessment)
// =============================================

async function saveToDatabase(data) {
  var inserted = 0;
  for (var item of data) {
    try {
      var [existing] = await pool.query(
        'SELECT reg_id, version FROM regulations WHERE title = ? AND source_id = ?',
        [item.title, item.source_id]
      );

      if (existing.length > 0) {
        var existingReg = existing[0];
        var existingVersion = parseFloat(existingReg.version) || 1.0;
        var newVersion = parseFloat(item.version) || 1.0;

        if (newVersion > existingVersion) {
          await pool.query(
            'UPDATE regulations SET content = ?, version = ?, published_date = ? WHERE reg_id = ?',
            [item.content, newVersion, item.published_date || null, existingReg.reg_id]
          );

          // RAG-powered impact assessment
          var impactScore = await assessImpactRAG(item);
          await pool.query(
            'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
            [existingReg.reg_id, existingVersion, newVersion, 'Updated: ' + item.content.substring(0, 500), impactScore]
          );
          console.log('[ChangeDetection] Version change:', item.title, '(' + existingVersion + ' → ' + newVersion + ') Impact:', impactScore);

          var [changeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
          var changeId = changeRows[0].change_id;

          var severityLevel = mapImpactToSeverity(impactScore);
          await pool.query(
            'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
            [existingReg.reg_id, changeId, severityLevel]
          );
          console.log('[AlertSystem] Alert created:', severityLevel);

          // AUTO-TASK: Generate task for Critical/High impact changes
          if (impactScore === 'Critical' || impactScore === 'High') {
            var deadline = new Date();
            deadline.setDate(deadline.getDate() + (impactScore === 'Critical' ? 3 : 7));
            await pool.query(
              'INSERT INTO tasks (alert_id, assigned_to, title, description, deadline) VALUES ((SELECT alert_id FROM alerts WHERE change_id = ? LIMIT 1), 1, ?, ?, ?)',
              [changeId, 'Review: ' + item.title.substring(0, 200), 'Auto-generated task. Regulation updated to v' + newVersion + '. Impact: ' + impactScore + '. Review and update internal policies accordingly.', deadline.toISOString().slice(0, 10)]
            );
            console.log('[AutoTask] Task created for', item.title, '(deadline:', deadline.toISOString().slice(0, 10) + ')');

            // EMAIL NOTIFICATION for Critical/High
            await sendAlertNotification(item.title, impactScore, severityLevel);
          }

          // Re-embed the updated regulation
          await embedRegulation(existingReg.reg_id, item.title, item.content);

          inserted++;
        } else {
          console.log('[FeedIntegrator] Skipping duplicate:', item.title);
        }
        continue;
      }

      // New regulation — insert it
      var [result] = await pool.query(
        'INSERT INTO regulations (source_id, title, category, content, version, published_date, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.source_id, item.title, item.category, item.content, item.version || 1.0, item.published_date || null, item.source_url || null]
      );
      var newRegId = result.insertId;
      inserted++;
      console.log('[FeedIntegrator] Inserted:', item.title);

      // Embed the new regulation into vector store
      await embedRegulation(newRegId, item.title, item.content);

      // RAG-powered impact assessment
      var newRegImpact = await assessImpactRAG(item);
      await pool.query(
        'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score) VALUES (?, ?, ?, ?, ?)',
        [newRegId, 0.0, item.version || 1.0, 'New regulation ingested: ' + item.content.substring(0, 500), newRegImpact]
      );
      console.log('[ChangeDetection] New regulation impact:', newRegImpact);

      var [newChangeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
      var newChangeId = newChangeRows[0].change_id;

      var newRegSeverity = mapImpactToSeverity(newRegImpact);
      await pool.query(
        'INSERT INTO alerts (reg_id, change_id, severity_level) VALUES (?, ?, ?)',
        [newRegId, newChangeId, newRegSeverity]
      );
      console.log('[AlertSystem] Alert:', newRegSeverity, 'for', item.title);

      // AUTO-TASK: Generate task for Critical/High impact new regulations
      if (newRegImpact === 'Critical' || newRegImpact === 'High') {
        var taskDeadline = new Date();
        taskDeadline.setDate(taskDeadline.getDate() + (newRegImpact === 'Critical' ? 3 : 7));
        await pool.query(
          'INSERT INTO tasks (alert_id, assigned_to, title, description, deadline) VALUES ((SELECT alert_id FROM alerts WHERE change_id = ? LIMIT 1), 1, ?, ?, ?)',
          [newChangeId, 'Review: ' + item.title.substring(0, 200), 'Auto-generated task. New regulation detected. Impact: ' + newRegImpact + '. Assess compliance implications and update policies if needed.', taskDeadline.toISOString().slice(0, 10)]
        );
        console.log('[AutoTask] Task created for', item.title);

        // EMAIL NOTIFICATION for Critical/High
        await sendAlertNotification(item.title, newRegImpact, newRegSeverity);
      }

    } catch (err) {
      console.error('[FeedIntegrator] DB insert error:', err.message);
    }
  }
  return inserted;
}

// =============================================
// Web Scraping: MAS Advisories
// =============================================

async function scrapeMAS() {
  console.log('[FeedIntegrator] Scraping MAS advisories...');
  var results = [];

  try {
    var response = await axios.get(MAS_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });

    var $ = cheerio.load(response.data);

    $('a[href*="/regulation/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');

      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : 'https://www.mas.gov.sg' + href) : 'https://www.mas.gov.sg/regulation/anti-money-laundering';
        results.push({
          source_id: MAS_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'AML',
          content: 'Scraped from MAS: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: fullUrl
        });
      }
    });

    if (results.length === 0) {
      console.log('[FeedIntegrator] MAS scrape returned 0 results, using fallback data...');
      results = getMASFallbackData();
    }

    console.log('[FeedIntegrator] MAS scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] MAS scrape failed:', err.message);
    console.log('[FeedIntegrator] Using fallback MAS data...');
    results = getMASFallbackData();
  }

  return results;
}

// =============================================
// MAS Fallback Data — Notice 626 (AML/CFT) Only
// =============================================

function getMASFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Prevention of Money Laundering and Countering the Financing of Terrorism',
      category: 'AML',
      content: 'MAS Notice 626 sets out requirements for banks in Singapore relating to the prevention of money laundering and countering the financing of terrorism. Key areas include: (1) Customer Due Diligence (CDD) — banks must identify and verify customers, beneficial owners, and persons acting on behalf of customers before establishing business relations. (2) Enhanced Due Diligence (EDD) — required for higher-risk customers including politically exposed persons (PEPs), correspondent banking relationships, and non-face-to-face business relations. (3) Ongoing Monitoring — banks must conduct ongoing monitoring of business relations and scrutinize transactions to ensure consistency with the bank\'s knowledge of the customer. (4) Suspicious Transaction Reporting (STR) — banks must file STRs with the Suspicious Transaction Reporting Office when there are reasonable grounds to suspect money laundering or terrorism financing. (5) Record Keeping — banks must maintain records of all transactions and CDD information for at least 5 years. (6) Wire Transfer Requirements — banks must include originator and beneficiary information in wire transfers.',
      version: 2.0,
      published_date: now,
      source_url: 'https://www.mas.gov.sg/regulation/notices/notice-626'
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Appendix: CDD for Correspondent Banking',
      category: 'AML',
      content: 'Appendix to Notice 626 covering enhanced CDD requirements for correspondent banking relationships. Banks must: (a) gather sufficient information about a respondent institution to understand the nature of its business, (b) determine the reputation of the institution and the quality of supervision, (c) assess AML/CFT controls of the respondent, (d) obtain senior management approval before establishing new correspondent banking relationships, (e) clearly understand the respective AML/CFT responsibilities of each institution.',
      version: 2.0,
      published_date: now,
      source_url: 'https://www.mas.gov.sg/regulation/notices/notice-626'
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Appendix: Ongoing Monitoring and STR Filing',
      category: 'AML',
      content: 'Appendix to Notice 626 on ongoing monitoring obligations. Banks must: (a) monitor transactions to detect unusual or suspicious patterns, (b) apply enhanced monitoring for higher-risk customers and PEPs, (c) review and update CDD information periodically, (d) file Suspicious Transaction Reports (STRs) with STRO when there are reasonable grounds to suspect ML/TF, (e) not tip off customers about STR filings, (f) maintain internal escalation procedures for reporting suspicious activity.',
      version: 2.0,
      published_date: now,
      source_url: 'https://www.mas.gov.sg/regulation/notices/notice-626'
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Appendix: Wire Transfer and Cross-Border Requirements',
      category: 'AML',
      content: 'Appendix to Notice 626 on wire transfer requirements. Banks must: (a) include full originator information (name, account number, address) for all wire transfers above SGD 1,500, (b) include beneficiary information, (c) maintain originator and beneficiary information throughout the payment chain, (d) implement risk-based procedures for incoming transfers with incomplete information, (e) apply enhanced scrutiny to transfers from/to high-risk jurisdictions identified by FATF.',
      version: 2.0,
      published_date: now,
      source_url: 'https://www.mas.gov.sg/regulation/notices/notice-626'
    },
    {
      source_id: MAS_SOURCE_ID,
      title: 'MAS Notice 626 - Appendix: Sanctions and Targeted Financial Sanctions',
      category: 'AML',
      content: 'Appendix to Notice 626 on sanctions obligations. Banks must: (a) screen customers and transactions against UN Security Council sanctions lists, (b) screen against MAS targeted financial sanctions lists, (c) implement real-time screening for wire transfers, (d) freeze assets without delay when a match is confirmed, (e) report any frozen assets or rejected transactions to MAS, (f) maintain sanctions screening systems with timely list updates.',
      version: 2.0,
      published_date: now,
      source_url: 'https://www.mas.gov.sg/regulation/notices/notice-626'
    }
  ];
}

// =============================================
// FATF Scraper
// =============================================

async function scrapeFATF() {
  console.log('[FeedIntegrator] Scraping FATF publications...');
  var results = [];
  try {
    var response = await axios.get(FATF_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    var $ = cheerio.load(response.data);
    $('a[href*="/publications/"], a[href*="/recommendations/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');
      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : 'https://www.fatf-gafi.org' + href) : FATF_SCRAPE_URL;
        results.push({
          source_id: FATF_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'AML',
          content: 'Scraped from FATF: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: fullUrl
        });
      }
    });
    if (results.length === 0) {
      results = getFATFFallbackData();
    }
    console.log('[FeedIntegrator] FATF scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FATF scrape failed:', err.message);
    results = getFATFFallbackData();
  }
  return results;
}

function getFATFFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    { source_id: FATF_SOURCE_ID, title: 'FATF Recommendations - International Standards on Combating ML/TF', category: 'AML', content: 'The FATF Recommendations set out a comprehensive framework of measures for countries to combat money laundering, terrorist financing, and proliferation financing. Covers CDD, STR, wire transfers, correspondent banking, and targeted financial sanctions.', version: 1.0, published_date: now, source_url: 'https://www.fatf-gafi.org/en/topics/fatf-recommendations.html' },
    { source_id: FATF_SOURCE_ID, title: 'FATF Guidance on Risk-Based Approach for Banking Sector', category: 'AML', content: 'Guidance on applying a risk-based approach to AML/CFT in the banking sector. Banks must identify, assess, and understand ML/TF risks and take appropriate measures to mitigate them.', version: 1.0, published_date: now, source_url: 'https://www.fatf-gafi.org/en/publications.html' },
    { source_id: FATF_SOURCE_ID, title: 'FATF High-Risk and Non-Cooperative Jurisdictions', category: 'AML', content: 'List of jurisdictions with strategic deficiencies in their AML/CFT frameworks. Financial institutions must apply enhanced due diligence for transactions involving these jurisdictions.', version: 1.0, published_date: now, source_url: 'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html' },
  ];
}

// =============================================
// FinCEN Scraper
// =============================================

async function scrapeFinCEN() {
  console.log('[FeedIntegrator] Scraping FinCEN news...');
  var results = [];
  try {
    var response = await axios.get(FINCEN_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    var $ = cheerio.load(response.data);
    $('a[href*="/news/"], a[href*="/resources/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');
      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : 'https://www.fincen.gov' + href) : FINCEN_SCRAPE_URL;
        results.push({
          source_id: FINCEN_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'AML',
          content: 'Scraped from FinCEN: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: fullUrl
        });
      }
    });
    if (results.length === 0) {
      results = getFinCENFallbackData();
    }
    console.log('[FeedIntegrator] FinCEN scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FinCEN scrape failed:', err.message);
    results = getFinCENFallbackData();
  }
  return results;
}

function getFinCENFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    { source_id: FINCEN_SOURCE_ID, title: 'FinCEN - Bank Secrecy Act (BSA) Requirements', category: 'AML', content: 'US financial institutions must establish AML programs, file Currency Transaction Reports (CTRs) for transactions over USD 10,000, and file Suspicious Activity Reports (SARs) for suspicious transactions.', version: 1.0, published_date: now, source_url: 'https://www.fincen.gov/resources/statutes-and-regulations' },
    { source_id: FINCEN_SOURCE_ID, title: 'FinCEN - Customer Due Diligence (CDD) Rule', category: 'AML', content: 'Requires financial institutions to identify and verify beneficial owners of legal entity customers. Applies to banks, brokers, mutual funds, and futures commission merchants.', version: 1.0, published_date: now, source_url: 'https://www.fincen.gov/resources/statutes-and-regulations' },
    { source_id: FINCEN_SOURCE_ID, title: 'FinCEN Advisory on Ransomware and Digital Currency', category: 'Cyber', content: 'Advisory on detecting and reporting ransomware-related transactions. Financial institutions must file SARs for suspected ransomware payments and apply enhanced monitoring to cryptocurrency transactions.', version: 1.0, published_date: now, source_url: 'https://www.fincen.gov/news-room' },
  ];
}

// =============================================
// ECB Scraper
// =============================================

async function scrapeECB() {
  console.log('[FeedIntegrator] Scraping ECB banking supervision...');
  var results = [];
  try {
    var response = await axios.get(ECB_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    var $ = cheerio.load(response.data);
    $('a[href*="/pub/"], a[href*="/press/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');
      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : 'https://www.bankingsupervision.europa.eu' + href) : ECB_SCRAPE_URL;
        results.push({
          source_id: ECB_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'Banking Supervision',
          content: 'Scraped from ECB: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: fullUrl
        });
      }
    });
    if (results.length === 0) {
      results = getECBFallbackData();
    }
    console.log('[FeedIntegrator] ECB scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] ECB scrape failed:', err.message);
    results = getECBFallbackData();
  }
  return results;
}

function getECBFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    { source_id: ECB_SOURCE_ID, title: 'ECB Guide on Internal Models (TRIM)', category: 'Capital Requirements', content: 'ECB supervisory expectations on banks use of internal models for credit risk, market risk, and counterparty credit risk under the Capital Requirements Regulation (CRR).', version: 1.0, published_date: now, source_url: 'https://www.bankingsupervision.europa.eu/press/publications' },
    { source_id: ECB_SOURCE_ID, title: 'ECB Supervisory Priorities 2026', category: 'Banking Supervision', content: 'Key supervisory priorities: credit risk management, operational resilience, digital transformation risks, and climate-related financial risks for supervised institutions.', version: 1.0, published_date: now, source_url: 'https://www.bankingsupervision.europa.eu/press/publications' },
    { source_id: ECB_SOURCE_ID, title: 'ECB Guide on Fit and Proper Assessments', category: 'Governance', content: 'Requirements for assessing the suitability of members of management bodies in significant institutions. Covers knowledge, experience, reputation, conflicts of interest, and time commitment.', version: 1.0, published_date: now, source_url: 'https://www.bankingsupervision.europa.eu/press/publications' },
  ];
}

// =============================================
// FCA Scraper
// =============================================

async function scrapeFCA() {
  console.log('[FeedIntegrator] Scraping FCA publications...');
  var results = [];
  try {
    var response = await axios.get(FCA_SCRAPE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    var $ = cheerio.load(response.data);
    $('a[href*="/publications/"], a[href*="/policy-statements/"]').each(function (_, el) {
      var title = $(el).text().trim();
      var href = $(el).attr('href');
      if (title && title.length > 10 && title.length < 300) {
        var fullUrl = href ? (href.startsWith('http') ? href : 'https://www.fca.org.uk' + href) : FCA_SCRAPE_URL;
        results.push({
          source_id: FCA_SOURCE_ID,
          title: title.substring(0, 255),
          category: 'Financial Conduct',
          content: 'Scraped from FCA: ' + (href || '') + ' — ' + title,
          version: 1.0,
          published_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          source_url: fullUrl
        });
      }
    });
    if (results.length === 0) {
      results = getFCAFallbackData();
    }
    console.log('[FeedIntegrator] FCA scrape found ' + results.length + ' items');
  } catch (err) {
    console.error('[FeedIntegrator] FCA scrape failed:', err.message);
    results = getFCAFallbackData();
  }
  return results;
}

function getFCAFallbackData() {
  var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    { source_id: FCA_SOURCE_ID, title: 'FCA - Money Laundering Regulations (MLR) 2017', category: 'AML', content: 'UK anti-money laundering regulations requiring firms to conduct CDD, ongoing monitoring, and SAR filing. Applies to all FCA-regulated firms including banks, payment institutions, and e-money issuers.', version: 1.0, published_date: now, source_url: 'https://www.fca.org.uk/firms/financial-crime/money-laundering-regulations' },
    { source_id: FCA_SOURCE_ID, title: 'FCA - Consumer Duty Requirements', category: 'Consumer Protection', content: 'New consumer protection framework requiring firms to deliver good outcomes for retail customers. Covers products and services, price and value, consumer understanding, and consumer support.', version: 1.0, published_date: now, source_url: 'https://www.fca.org.uk/firms/consumer-duty' },
    { source_id: FCA_SOURCE_ID, title: 'FCA - Operational Resilience Requirements', category: 'Operational Risk', content: 'Requirements for firms to identify important business services, set impact tolerances, and ensure they can remain within tolerance during severe but plausible disruption scenarios.', version: 1.0, published_date: now, source_url: 'https://www.fca.org.uk/publications' },
  ];
}

// =============================================
// Main Feed Runner (Multi-Source with RAG)
// =============================================

async function runFeedIntegration() {
  console.log('');
  console.log('========================================');
  console.log('[FeedIntegrator] Starting multi-source feed integration at', new Date().toLocaleString());
  console.log('[FeedIntegrator] Sources: MAS, FATF, FinCEN, ECB, FCA');
  console.log('========================================');

  // Scrape all 5 sources in parallel
  var [masData, fatfData, fincenData, ecbData, fcaData] = await Promise.all([
    scrapeMAS(),
    scrapeFATF(),
    scrapeFinCEN(),
    scrapeECB(),
    scrapeFCA()
  ]);

  var allData = masData.concat(fatfData, fincenData, ecbData, fcaData);
  console.log('[FeedIntegrator] Total items fetched across all sources:', allData.length);

  if (allData.length > 0) {
    var inserted = await saveToDatabase(allData);
    console.log('[FeedIntegrator] New regulations inserted:', inserted);
  } else {
    console.log('[FeedIntegrator] No data to insert');
  }

  console.log('[FeedIntegrator] Feed integration complete');
  console.log('========================================');
}

// =============================================
// Cron Scheduler
// =============================================

function startFeedScheduler() {
  console.log('[FeedIntegrator] Feed scheduler initialized (5 sources: MAS, FATF, FinCEN, ECB, FCA)');

  // Embed existing data first, then run feed integration
  embedAllExistingData().then(function () {
    runFeedIntegration();
  }).catch(function (err) {
    console.error('[FeedIntegrator] Initial embedding failed:', err.message);
    runFeedIntegration();
  });

  cron.schedule('0 2 */14 * *', function () {
    runFeedIntegration();
  });

  console.log('[FeedIntegrator] Scheduled: every 14 days at 2:00 AM');
}

module.exports = { startFeedScheduler, runFeedIntegration };
