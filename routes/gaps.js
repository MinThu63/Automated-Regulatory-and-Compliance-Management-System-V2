const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const { analyzeGapRAG } = require('../services/ragEngine');
const { analyzeGap, analyzeAll } = require('../agents/analyzer');
const router = express.Router();

// GET /api/compliance-gaps
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT cg.gap_id, cg.reg_id, cg.policy_id, cg.gap_description, cg.status, 
       r.title AS regulation_title, r.content AS regulation_content,
       ip.policy_name, ip.description AS policy_description,
       cg.identified_at, COALESCE(r.source_url, rs.base_url) AS source_url,
       (SELECT rc2.semantic_differences FROM regulation_changes rc2 WHERE rc2.reg_id = cg.reg_id ORDER BY rc2.detected_at DESC LIMIT 1) AS semantic_differences,
       (SELECT rc3.impact_score FROM regulation_changes rc3 WHERE rc3.reg_id = cg.reg_id ORDER BY rc3.detected_at DESC LIMIT 1) AS impact_score
       FROM compliance_gaps cg 
       JOIN regulations r ON cg.reg_id = r.reg_id
       JOIN internal_policies ip ON cg.policy_id = ip.policy_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id
       ORDER BY cg.identified_at DESC`
    );

    // Get linked task info for each gap
    for (var row of rows) {
      var [taskLinks] = await pool.query(
        `SELECT t.task_id, t.title AS linked_task_title, t.status AS linked_task_status
         FROM task_gaps tg JOIN tasks t ON tg.task_id = t.task_id WHERE tg.gap_id = ? LIMIT 1`,
        [row.gap_id]
      );
      if (taskLinks.length > 0) {
        row.linked_task_id = taskLinks[0].task_id;
        row.linked_task_title = taskLinks[0].linked_task_title;
        row.linked_task_status = taskLinks[0].linked_task_status;
      } else {
        row.linked_task_id = null;
        row.linked_task_title = null;
        row.linked_task_status = null;
      }
    }

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps/analyze — RAG-powered gap analysis
// Must be defined BEFORE the generic POST / route
router.post('/analyze', async (req, res) => {
  try {
    var { reg_id, policy_id } = req.body;
    if (!reg_id || !policy_id) {
      return res.status(400).json({ error: 'reg_id and policy_id are required' });
    }

    // Verify regulation exists
    var [regs] = await pool.query('SELECT title FROM regulations WHERE reg_id = ?', [reg_id]);
    if (regs.length === 0) return res.status(404).json({ error: 'Regulation not found' });

    // Verify policy exists
    var [policies] = await pool.query('SELECT policy_name FROM internal_policies WHERE policy_id = ?', [policy_id]);
    if (policies.length === 0) return res.status(404).json({ error: 'Policy not found' });

    // Call RAG engine for gap analysis (handles retrieval + generation internally)
    var analysis = await analyzeGap(reg_id, policy_id);

    // Auto-flag the policy as needing review if gaps found
    if (analysis && analysis.has_gaps) {
      await pool.query(
        'UPDATE internal_policies SET description = CONCAT(description, ?) WHERE policy_id = ?',
        ['\n\n[⚠️ REVIEW NEEDED - ' + new Date().toISOString().slice(0, 10) + '] AI gap analysis identified compliance gaps against ' + regs[0].title + '. Please review and update this policy.', policy_id]
      );
      await logAudit(req.body.user_id || 1, 'POLICY_FLAGGED', 'internal_policies', policy_id, 'Policy auto-flagged for review after gap analysis against ' + regs[0].title);
    }

    // Return analysis — let the user decide which gaps to save
    res.status(200).json({
      regulation: regs[0].title,
      policy: policies[0].policy_name,
      reg_id: reg_id,
      policy_id: policy_id,
      analysis: analysis
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps
router.post('/', async (req, res) => {
  try {
    var { reg_id, policy_id, gap_description } = req.body;
    if (!reg_id || !policy_id || !gap_description) {
      return res.status(400).json({ error: 'reg_id, policy_id, and gap_description are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES (?, ?, ?)',
      [reg_id, policy_id, gap_description]
    );
    await logAudit(req.body.user_id || 1, 'GAP_CREATED', 'compliance_gaps', result.insertId, 'Gap created: ' + gap_description.substring(0, 100));
    res.status(201).json({ message: 'Gap created', gap_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps/analyze-all — Cluster-based gap analysis
router.post('/analyze-all', async (req, res) => {
  try {
    var result = await analyzeAll();
    await logAudit(req.body.user_id || 1, 'BULK_CLUSTER_ANALYSIS', 'compliance_gaps', 0,
      'Cluster analysis complete: ' + result.total_gaps + ' gaps across ' + result.clusters_analyzed + ' clusters');
    res.status(200).json({ message: 'Cluster analysis complete', total_gaps_found: result.total_gaps, clusters_analyzed: result.clusters_analyzed, details: result.details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance-gaps/:id/link-task — Create a task linked to this gap
router.post('/:id/link-task', async (req, res) => {
  try {
    var { id } = req.params;
    var { title, deadline, description, department } = req.body;
    if (!title || !deadline || !department) {
      return res.status(400).json({ error: 'title, deadline, and department are required' });
    }

    // Verify gap exists
    var [gaps] = await pool.query('SELECT gap_id, gap_description FROM compliance_gaps WHERE gap_id = ?', [id]);
    if (gaps.length === 0) return res.status(404).json({ error: 'Gap not found' });

    // Create task
    var [result] = await pool.query(
      'INSERT INTO tasks (department, title, description, deadline) VALUES (?, ?, ?, ?)',
      [department, title, description || null, deadline]
    );
    var taskId = result.insertId;

    // Link via task_gaps junction table (so it's clickable + consistent with auto-created tasks)
    await pool.query('INSERT IGNORE INTO task_gaps (task_id, gap_id) VALUES (?, ?)', [taskId, id]);

    // Update gap status to In Review since a task was created
    await pool.query('UPDATE compliance_gaps SET status = ? WHERE gap_id = ? AND status = ?', ['In Review', id, 'Open']);

    await logAudit(1, 'TASK_CREATED', 'tasks', taskId, 'Manual task linked to gap #' + id + ': ' + title + ' (Department: ' + department + ')');
    res.status(201).json({ message: 'Task created and linked to gap', task_id: taskId, gap_id: parseInt(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/compliance-gaps/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Open', 'In Review', 'Remediated'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Open, In Review, Remediated' });
    }
    var [result] = await pool.query('UPDATE compliance_gaps SET status = ? WHERE gap_id = ?', [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Gap not found' });
    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'compliance_gaps', id, 'Gap ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Gap status updated', gap_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
