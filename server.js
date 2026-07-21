require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { startAllAgents } = require('./agents/orchestrator');
const scraper = require('./agents/scraper');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Allowed affected areas vocabulary — same as assessor.js
const AFFECTED_AREAS_VOCAB = [
  'AML Screening', 'KYC / CDD', 'Enhanced Due Diligence', 'Transaction Monitoring',
  'Suspicious Transaction Reporting', 'Sanctions Screening', 'Wire Transfers',
  'Record Keeping', 'Customer Onboarding', 'UBO Identification',
  'Credit Risk', 'Liquidity Risk', 'Capital Adequacy',
  'Cybersecurity', 'Technology Risk', 'Incident Response',
  'Data Privacy', 'PDPA Compliance',
  'ESG / Green Finance', 'Governance', 'Board Oversight',
  'Wholesale Banking Operations', 'Regulatory Reporting'
];

// =============================================
// STARTUP: AI backfill for regulation_changes rows missing affected_areas
// For each row with NULL affected_areas, ask the LLM which areas from the
// allowed vocab are affected based on the regulation content + change summary.
// =============================================
async function backfillAffectedAreas() {
  try {
    var [rows] = await pool.query(`
      SELECT rc.change_id, rc.semantic_differences, r.title, r.category, r.content
      FROM regulation_changes rc
      JOIN regulations r ON rc.reg_id = r.reg_id
      WHERE rc.affected_areas IS NULL OR rc.affected_areas = ''
    `);

    if (rows.length === 0) return;
    console.log('[Startup] Backfilling affected_areas for', rows.length, 'row(s) using AI...');

    for (var row of rows) {
      try {
        var context = 'Regulation: ' + row.title
          + '\nCategory: ' + (row.category || 'Unknown')
          + '\nChange summary: ' + (row.semantic_differences || '').substring(0, 500)
          + '\nContent excerpt: ' + (row.content || '').substring(0, 400);

        var resp = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You are a compliance analyst at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore. Given a regulatory change, identify which of GLDB\'s operational areas are affected. Only pick from the provided list. Return JSON.' },
            { role: 'user', content: 'Allowed areas: ' + AFFECTED_AREAS_VOCAB.join(', ') + '\n\n' + context + '\n\nReturn JSON: {"affected_areas": ["area1", "area2"]} — pick 1 to 4 areas that are most directly affected. Only use exact names from the allowed list.' }
          ],
          temperature: 0.1,
          max_tokens: 150,
          response_format: { type: 'json_object' }
        });

        var parsed = JSON.parse(resp.choices[0].message.content.trim());
        var areas = (parsed.affected_areas || []).filter(function(a) {
          return AFFECTED_AREAS_VOCAB.some(function(v) { return v.toLowerCase() === a.toLowerCase(); });
        });

        if (areas.length > 0) {
          await pool.query('UPDATE regulation_changes SET affected_areas = ? WHERE change_id = ?', [areas.join(', '), row.change_id]);
          console.log('[Startup] change_id=' + row.change_id + ' → ' + areas.join(', '));
        }
      } catch (e) {
        console.error('[Startup] Failed to backfill change_id=' + row.change_id + ':', e.message);
      }
    }

    console.log('[Startup] AI backfill complete.');
  } catch (err) {
    console.error('[Startup] Backfill query failed:', err.message);
  }
}

// =============================================
// STARTUP: Simulate old versions for regulation_changes rows
// For rows that have new_content but no old_content, use LLM to generate
// a plausible "previous version" of the regulation text. This fills in the
// View Diff panel so the comparison isn't empty.
// Only generates for the FIRST 5 rows — demo purposes only.
// Stored permanently in DB — only runs once per row.
// =============================================
async function simulateOldVersions() {
  try {
    var [rows] = await pool.query(`
      SELECT rc.change_id, rc.new_content, rc.semantic_differences, r.title
      FROM regulation_changes rc
      JOIN regulations r ON rc.reg_id = r.reg_id
      WHERE rc.old_content IS NULL AND rc.new_content IS NOT NULL AND LENGTH(rc.new_content) > 50
      ORDER BY rc.change_id ASC
      LIMIT 5
    `);

    if (rows.length === 0) return;
    console.log('[Startup] Simulating old versions for', rows.length, 'row(s) (max 5)...');

    for (var row of rows) {
      try {
        var resp = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You generate plausible previous versions of regulatory documents. Given the current version and a change summary, produce what the document likely said BEFORE the change was made. Keep the same structure and length but reverse the described changes.' },
            { role: 'user', content: 'Regulation: ' + row.title + '\n\nChange that was made: ' + (row.semantic_differences || 'Updated').substring(0, 300) + '\n\nCurrent version (after change):\n' + (row.new_content || '').substring(0, 2000) + '\n\nGenerate the PREVIOUS version (before the change was applied). Output only the previous version text, nothing else.' }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        var oldVersion = resp.choices[0].message.content.trim();
        if (oldVersion && oldVersion.length > 30) {
          await pool.query('UPDATE regulation_changes SET old_content = ? WHERE change_id = ?', [oldVersion, row.change_id]);
          console.log('[Startup] Simulated old version for change_id=' + row.change_id + ' (' + row.title.substring(0, 40) + ')');
        }
      } catch (e) {
        console.error('[Startup] Failed to simulate old version for change_id=' + row.change_id + ':', e.message);
      }
    }

    console.log('[Startup] Old version simulation complete (5 max).');
  } catch (err) {
    console.error('[Startup] simulateOldVersions query failed:', err.message);
  }
}

// Import route modules
const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const regulationRoutes = require('./routes/regulations');
const taskRoutes = require('./routes/tasks');
const gapRoutes = require('./routes/gaps');
const sourceRoutes = require('./routes/sources');
const policyRoutes = require('./routes/policies');
const auditRoutes = require('./routes/audit');
const proposalRoutes = require('./routes/proposals');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(__dirname + '/frontend'));
app.use('/assets', express.static(__dirname + '/assets'));

// Register routes
app.use('/api', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/regulations', regulationRoutes);
app.use('/api/regulation-changes', require('./routes/changes'));
app.use('/api/tasks', taskRoutes);
app.use('/api/compliance-gaps', gapRoutes);
app.use('/api/regulatory-sources', sourceRoutes);
app.use('/api/internal-policies', policyRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/policy-proposals', proposalRoutes);

// Manual scraper trigger — POST /api/admin/scrape
// Runs the scraper immediately without waiting for the cron schedule.
var scrapeRunning = false;
app.post('/api/admin/scrape', async (req, res) => {
  if (scrapeRunning) {
    return res.status(409).json({ message: 'Scraper is already running. Please wait.' });
  }
  scrapeRunning = true;
  res.json({ message: 'Scraper triggered. Check server logs for progress.' });
  try {
    await scraper.run();
    console.log('[Admin] Manual scrape completed.');
  } catch (err) {
    console.error('[Admin] Manual scrape error:', err.message);
  } finally {
    scrapeRunning = false;
  }
});

// POST /api/admin/test-email — Send a test digest email for demo purposes
app.post('/api/admin/test-email', async (req, res) => {
  try {
    var { sendSummaryEmail } = require('./services/notificationService');
    await sendSummaryEmail([
      { title: 'MAS Notice 626 - Prevention of Money Laundering', impact_score: 'Critical', department: 'Compliance Operations', deadline: '2027-03-01', summary: 'New DPT monitoring threshold + record retention extended to 7 years', category: 'AML' },
      { title: 'FATF Recommendation 16 - Wire Transfers', impact_score: 'High', department: 'Compliance Operations', deadline: null, summary: 'Enhanced originator/beneficiary information requirements for cross-border transfers', category: 'AML' },
      { title: 'MAS Technology Risk Management Guidelines', impact_score: 'High', department: 'IT Security', deadline: null, summary: 'New requirements for third-party vendor security assessments and business continuity', category: 'Cyber' }
    ]);
    res.json({ message: 'Summary digest email sent to ' + process.env.EMAIL_RECIPIENT });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || process.env.API_PORT || 3000;

app.listen(PORT, async () => {
  console.log('Server is running on port ' + PORT);
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully to', process.env.DB_NAME);

    startAllAgents();

    // Auto-run scraper on startup if regulations table is empty
    var [regCount] = await pool.query('SELECT COUNT(*) AS cnt FROM regulations');
    if (regCount[0].cnt === 0) {
      console.log('[Startup] No regulations found — running scraper automatically...');
      scraper.run();
    }

    // AI backfill: fix any regulation_changes rows missing affected_areas
    backfillAffectedAreas();

    // Simulate old versions for View Diff comparison
    simulateOldVersions();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
