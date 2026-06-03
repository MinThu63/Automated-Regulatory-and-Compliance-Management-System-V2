const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(status = 'Unread') AS unread, SUM(status = 'Read') AS readCount,
       SUM(status = 'Dismissed') AS dismissed, SUM(severity_level = 'Immediate Action Required') AS immediate,
       SUM(severity_level = 'Review Recommended') AS review, SUM(severity_level = 'Informational') AS informational
       FROM alerts`
    );
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/categories
router.get('/categories', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT r.category, COUNT(rc.change_id) AS change_count FROM regulation_changes rc
       JOIN regulations r ON rc.reg_id = r.reg_id GROUP BY r.category`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/trends
router.get('/trends', async (req, res) => {
  try {
    var [rows] = await pool.query(
      'SELECT DATE(created_at) AS date, COUNT(*) AS count FROM alerts GROUP BY DATE(created_at) ORDER BY date ASC'
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/gap-resolution — Gaps opened vs resolved over time
router.get('/gap-resolution', async (req, res) => {
  try {
    var [opened] = await pool.query(
      `SELECT DATE(identified_at) AS date, COUNT(*) AS count FROM compliance_gaps GROUP BY DATE(identified_at) ORDER BY date ASC`
    );
    var [resolved] = await pool.query(
      `SELECT DATE(identified_at) AS date, COUNT(*) AS count FROM compliance_gaps WHERE status = 'Remediated' GROUP BY DATE(identified_at) ORDER BY date ASC`
    );
    res.status(200).json({ opened: opened, resolved: resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/response-time — Average time from alert creation to Read/Dismissed
router.get('/response-time', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT 
         DATE(a.created_at) AS date,
         COUNT(CASE WHEN a.status = 'Read' OR a.status = 'Dismissed' THEN 1 END) AS reviewed,
         COUNT(CASE WHEN a.status = 'Unread' THEN 1 END) AS pending,
         COUNT(*) AS total
       FROM alerts a
       GROUP BY DATE(a.created_at)
       ORDER BY date ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/source-activity — Which sources generate the most changes
router.get('/source-activity', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rs.source_name, COUNT(r.reg_id) AS regulation_count, 
       COUNT(rc.change_id) AS change_count
       FROM regulatory_sources rs
       LEFT JOIN regulations r ON rs.source_id = r.source_id
       LEFT JOIN regulation_changes rc ON r.reg_id = rc.reg_id
       GROUP BY rs.source_id, rs.source_name
       ORDER BY change_count DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/task-deadlines — Upcoming task deadlines for burndown
router.get('/task-deadlines', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT t.title, t.deadline, t.status, u.username AS assignee
       FROM tasks t JOIN users u ON t.assigned_to = u.user_id
       WHERE t.status != 'Completed'
       ORDER BY t.deadline ASC
       LIMIT 15`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
