const express = require('express');
const pool = require('../db');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const eventBus = require('../agents/eventBus');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// Multer config — store PDFs in memory (no disk save needed)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/regulations/upload-pdf — Upload a PDF, extract text, store as regulation
// Smart version detection: uses LLM to check if this is a newer version of an existing regulation.
// If so, creates a regulation_changes row with old_content + new_content for View Diff.
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    var source_id = req.body.source_id || 1;
    var title = req.body.title || req.file.originalname.replace('.pdf', '');
    var category = req.body.category || 'AML';

    // Extract text from PDF using pdf-parse
    var parser = new PDFParse({ data: req.file.buffer });
    var pdfResult = await parser.getText();
    var content = pdfResult.text || '';

    // Clean whitespace
    content = content.replace(/\s+/g, ' ').trim();

    if (content.length < 30) {
      return res.status(400).json({ error: 'Could not extract meaningful text from PDF. File may be scanned/image-based.' });
    }

    // Truncate to 5000 chars for storage
    if (content.length > 5000) content = content.substring(0, 5000);

    // --- SMART VERSION DETECTION ---
    // Check if an existing regulation in the same category covers the same topic
    // by comparing content semantically using the LLM
    var [existingRegs] = await pool.query(
      'SELECT reg_id, title, content, version FROM regulations WHERE category = ? AND LENGTH(content) > 50 ORDER BY ingested_at DESC LIMIT 10',
      [category]
    );

    var matchedReg = null;
    if (existingRegs.length > 0) {
      try {
        var OpenAI = require('openai');
        var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        var existingTitles = existingRegs.map(function(r, i) {
          return (i + 1) + '. [reg_id=' + r.reg_id + '] "' + r.title + '" — ' + (r.content || '').substring(0, 100);
        }).join('\n');

        var matchResp = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You detect whether a newly uploaded regulation is a newer version of an existing one. Compare by topic/subject matter, not just title. A newer version of the same regulation may have a different title but covers the same regulatory requirements. Output JSON only.' },
            { role: 'user', content: 'NEW REGULATION being uploaded:\nTitle: ' + title + '\nContent excerpt: ' + content.substring(0, 500) + '\n\nEXISTING REGULATIONS in same category:\n' + existingTitles + '\n\nIs the new regulation a NEWER VERSION or UPDATE of any existing one? If yes, return {"is_update": true, "matched_reg_id": <id>}. If no match, return {"is_update": false}.' }
          ],
          temperature: 0.1,
          max_tokens: 100,
          response_format: { type: 'json_object' }
        });

        var matchResult = JSON.parse(matchResp.choices[0].message.content.trim());
        if (matchResult.is_update && matchResult.matched_reg_id) {
          matchedReg = existingRegs.find(function(r) { return r.reg_id === matchResult.matched_reg_id; });
        }
      } catch (e) {
        console.log('[Upload] Version detection failed:', e.message, '— treating as new regulation');
      }
    }

    var regId;
    var isUpdate = false;

    if (matchedReg) {
      // --- THIS IS AN UPDATE TO AN EXISTING REGULATION ---
      isUpdate = true;
      regId = matchedReg.reg_id;
      var oldContent = matchedReg.content;
      var oldVersion = parseFloat(matchedReg.version) || 1.0;
      var newVersion = oldVersion + 1.0;

      // Update the regulation with new content
      await pool.query(
        'UPDATE regulations SET content = ?, version = ?, title = ? WHERE reg_id = ?',
        [content, newVersion, title, regId]
      );

      // Create regulation_changes row with BOTH old and new content
      var [changeResult] = await pool.query(
        `INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score, old_content, new_content, affected_areas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [regId, oldVersion, newVersion, 'Pending AI assessment...', 'High', oldContent, content, null]
      );

      // Emit regulation.updated so the full pipeline runs
      eventBus.emit('regulation.updated', {
        reg_id: regId,
        title: title,
        content: content,
        old_content: oldContent,
        new_content: content,
        source_id: parseInt(source_id),
        category: category,
        previous_version: oldVersion,
        new_version: newVersion,
        change_summary: null,
        change_diff: null
      });

      await logAudit(req.body.user_id || 1, 'PDF_UPDATE_DETECTED', 'regulations', regId,
        'PDF uploaded as UPDATE to existing reg #' + regId + ' (' + matchedReg.title + '). Version ' + oldVersion + ' → ' + newVersion);

    } else {
      // --- NEW REGULATION (no match found) ---
      var [result] = await pool.query(
        'INSERT INTO regulations (source_id, title, category, content, version, source_url) VALUES (?, ?, ?, ?, ?, ?)',
        [source_id, title, category, content, 1.0, null]
      );
      regId = result.insertId;

      eventBus.emit('regulation.new', {
        reg_id: regId,
        title: title,
        content: content,
        source_id: parseInt(source_id),
        category: category,
        version: 1.0
      });

      await logAudit(req.body.user_id || 1, 'PDF_UPLOADED', 'regulations', regId,
        'PDF uploaded: ' + title + ' (' + req.file.originalname + ', ' + content.length + ' chars extracted)');
    }

    res.status(201).json({
      message: isUpdate
        ? 'PDF uploaded as UPDATE to existing regulation. Old vs New comparison available in Changes & Impact.'
        : 'PDF uploaded as new regulation. AI pipeline triggered.',
      reg_id: regId,
      is_update: isUpdate,
      matched_regulation: matchedReg ? matchedReg.title : null,
      chars_extracted: content.length,
      pages: pdfResult.total || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'PDF processing failed: ' + err.message });
  }
});

// POST /api/regulations/scrape-url — Fetch a URL using headless browser, extract text, store as regulation
router.post('/scrape-url', async (req, res) => {
  try {
    var { url, title, category, source_id } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    var puppeteer = require('puppeteer');

    // Launch headless browser
    var browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    var page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a moment for JS-rendered content
    await new Promise(function(resolve) { setTimeout(resolve, 2000); });

    // Extract text content from the rendered page
    var content = await page.evaluate(function() {
      // Remove nav, footer, scripts
      document.querySelectorAll('script, style, nav, footer, header, .breadcrumb, .sidebar').forEach(function(el) { el.remove(); });
      var main = document.querySelector('main') || document.querySelector('article') || document.querySelector('.content') || document.querySelector('#content') || document.body;
      return main ? main.innerText : document.body.innerText;
    });

    // Auto-detect title if not provided
    if (!title) {
      title = await page.evaluate(function() {
        var h1 = document.querySelector('h1');
        return h1 ? h1.innerText.trim() : document.title;
      });
    }

    await browser.close();

    // Clean
    content = (content || '').replace(/\s+/g, ' ').trim();

    if (content.length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful content from the URL. Page may require interaction or has no text content.' });
    }
    if (content.length > 5000) content = content.substring(0, 5000);

    title = title || 'Scraped regulation';
    source_id = source_id || 1;
    category = category || 'AML';

    // Smart version detection
    var [existingRegs] = await pool.query(
      'SELECT reg_id, title, content, version FROM regulations WHERE category = ? AND LENGTH(content) > 50 ORDER BY ingested_at DESC LIMIT 10',
      [category]
    );

    var matchedReg = null;
    if (existingRegs.length > 0) {
      try {
        var OpenAI = require('openai');
        var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        var existingTitles = existingRegs.map(function(r, i) {
          return (i + 1) + '. [reg_id=' + r.reg_id + '] "' + r.title + '" — ' + (r.content || '').substring(0, 100);
        }).join('\n');

        var matchResp = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You detect whether a newly scraped regulation is a newer version of an existing one. Compare by topic/subject matter. Output JSON only.' },
            { role: 'user', content: 'NEW:\nTitle: ' + title + '\nContent: ' + content.substring(0, 400) + '\n\nEXISTING:\n' + existingTitles + '\n\nIs this a newer version? {"is_update": true/false, "matched_reg_id": <id or null>}' }
          ],
          temperature: 0.1, max_tokens: 80,
          response_format: { type: 'json_object' }
        });
        var matchResult = JSON.parse(matchResp.choices[0].message.content.trim());
        if (matchResult.is_update && matchResult.matched_reg_id) {
          matchedReg = existingRegs.find(function(r) { return r.reg_id === matchResult.matched_reg_id; });
        }
      } catch (e) { /* treat as new */ }
    }

    var regId, isUpdate = false;

    if (matchedReg) {
      isUpdate = true;
      regId = matchedReg.reg_id;
      var oldVersion = parseFloat(matchedReg.version) || 1.0;
      var newVersion = oldVersion + 1.0;

      await pool.query('UPDATE regulations SET content = ?, version = ?, title = ?, source_url = ? WHERE reg_id = ?',
        [content, newVersion, title, url, regId]);

      await pool.query(
        'INSERT INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score, old_content, new_content) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [regId, oldVersion, newVersion, 'Pending AI assessment...', 'High', matchedReg.content, content]);

      eventBus.emit('regulation.updated', {
        reg_id: regId, title: title, content: content, old_content: matchedReg.content,
        new_content: content, source_id: parseInt(source_id), category: category,
        previous_version: oldVersion, new_version: newVersion
      });
    } else {
      var [result] = await pool.query(
        'INSERT INTO regulations (source_id, title, category, content, version, source_url) VALUES (?, ?, ?, ?, ?, ?)',
        [source_id, title, category, content, 1.0, url]);
      regId = result.insertId;

      eventBus.emit('regulation.new', {
        reg_id: regId, title: title, content: content,
        source_id: parseInt(source_id), category: category, version: 1.0, source_url: url
      });
    }

    await logAudit(req.body.user_id || 1, 'URL_SCRAPED', 'regulations', regId,
      'Scraped URL (Puppeteer): ' + url + ' (' + content.length + ' chars)');

    res.status(201).json({
      message: isUpdate ? 'URL scraped as UPDATE. Old vs New comparison available.' : 'URL scraped as new regulation. AI pipeline triggered.',
      reg_id: regId, is_update: isUpdate, matched_regulation: matchedReg ? matchedReg.title : null,
      title: title, chars_extracted: content.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
});

// GET /api/regulations (paginated + search)
router.get('/', async (req, res) => {
  try {
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 20;
    var offset = (page - 1) * limit;
    var search = req.query.search || '';

    var countSql = 'SELECT COUNT(*) AS total FROM regulations r JOIN regulatory_sources rs ON r.source_id = rs.source_id';
    var dataSql = `SELECT r.reg_id, rs.source_name, r.title, r.category, r.content, r.version, r.published_date, r.ingested_at, COALESCE(r.source_url, rs.base_url) AS source_url
       FROM regulations r JOIN regulatory_sources rs ON r.source_id = rs.source_id`;
    var params = [];

    if (search) {
      var searchClause = ' WHERE r.title LIKE ? OR r.category LIKE ?';
      countSql += searchClause;
      dataSql += searchClause;
      params.push('%' + search + '%', '%' + search + '%');
    }
    dataSql += ' ORDER BY r.ingested_at DESC LIMIT ? OFFSET ?';

    var [countRows] = await pool.query(countSql, params);
    var total = countRows[0].total;
    var [rows] = await pool.query(dataSql, params.concat([limit, offset]));
    res.status(200).json({ data: rows, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/regulations
router.post('/', async (req, res) => {
  try {
    var { source_id, title, category, content, version, published_date } = req.body;
    if (!source_id || !title || !category || !content) {
      return res.status(400).json({ error: 'source_id, title, category, and content are required' });
    }
    var [sources] = await pool.query('SELECT source_id FROM regulatory_sources WHERE source_id = ?', [source_id]);
    if (sources.length === 0) return res.status(400).json({ error: 'Source not found' });

    var [result] = await pool.query(
      'INSERT INTO regulations (source_id, title, category, content, version, published_date) VALUES (?, ?, ?, ?, ?, ?)',
      [source_id, title, category, content, version || 1.0, published_date || null]
    );
    res.status(201).json({ message: 'Regulation created', reg_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/regulations/:id
router.put('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { title, category, content, version, published_date } = req.body;
    var fields = [], values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (version !== undefined) { fields.push('version = ?'); values.push(version); }
    if (published_date !== undefined) { fields.push('published_date = ?'); values.push(published_date); }
    values.push(id);

    var [result] = await pool.query(`UPDATE regulations SET ${fields.join(', ')} WHERE reg_id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Regulation not found' });
    res.status(200).json({ message: 'Regulation updated', reg_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
