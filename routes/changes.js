const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/regulation-changes
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rc.change_id, rc.reg_id, r.title AS regulation_title, rc.previous_version, rc.new_version,
       rc.semantic_differences, rc.impact_score, rc.affected_areas, rc.explicit_deadline, rc.detected_at,
       COALESCE(r.source_url, rs.base_url) AS source_url
       FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id
       ORDER BY rc.detected_at DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/regulation-changes/impact
// Returns impact assessment data: change rows enriched with auto-task linkage info
router.get('/impact', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rc.change_id, rc.reg_id, r.title AS regulation_title, r.category,
       rc.previous_version, rc.new_version, rc.impact_score, rc.affected_areas,
       rc.explicit_deadline, rc.detected_at, rc.semantic_differences,
       COALESCE(r.source_url, rs.base_url) AS source_url,
       IF(rc.old_content IS NOT NULL AND rc.old_content != '', 1, 0) AS has_diff,
       a.alert_id, a.severity_level, a.department
       FROM regulation_changes rc
       JOIN regulations r ON rc.reg_id = r.reg_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id
       LEFT JOIN alerts a ON a.change_id = rc.change_id
       ORDER BY FIELD(rc.impact_score,'Critical','High','Medium','Low'), rc.detected_at DESC`
    );

    // For each row, check if an auto-task was created via task_alerts
    for (var row of rows) {
      if (row.alert_id) {
        var [taskRows] = await pool.query(
          `SELECT t.task_id, t.title AS task_title, t.status AS task_status, t.deadline AS task_deadline, t.department AS task_department
           FROM task_alerts ta JOIN tasks t ON ta.task_id = t.task_id
           WHERE ta.alert_id = ? LIMIT 1`,
          [row.alert_id]
        );
        if (taskRows.length > 0) {
          row.auto_task_id       = taskRows[0].task_id;
          row.auto_task_title    = taskRows[0].task_title;
          row.auto_task_status   = taskRows[0].task_status;
          row.auto_task_deadline = taskRows[0].task_deadline;
          row.auto_task_dept     = taskRows[0].task_department;
        } else {
          row.auto_task_id = null;
          row.auto_task_title = null;
          row.auto_task_status = null;
          row.auto_task_deadline = null;
          row.auto_task_dept = null;
        }
      } else {
        row.auto_task_id = null;
        row.auto_task_title = null;
        row.auto_task_status = null;
        row.auto_task_deadline = null;
        row.auto_task_dept = null;
      }
    }

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/regulation-changes/detail/:changeId — full old vs new comparison
router.get('/detail/:changeId', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rc.change_id, rc.reg_id, r.title AS regulation_title,
       r.category, rc.previous_version, rc.new_version,
       rc.semantic_differences, rc.impact_score, rc.affected_areas, rc.explicit_deadline, rc.change_diff,
       rc.old_content, rc.new_content, rc.detected_at, COALESCE(r.source_url, rs.base_url) AS source_url
       FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id
       WHERE rc.change_id = ?`,
      [req.params.changeId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Change not found' });
    var row = rows[0];
    if (row.change_diff) {
      try { row.change_diff = JSON.parse(row.change_diff); } catch (e) { /* leave as string */ }
    }
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/regulation-changes/:regId
router.get('/:regId', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rc.change_id, r.title AS regulation_title, rc.previous_version, rc.new_version,
       rc.semantic_differences, rc.impact_score, rc.detected_at
       FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id WHERE rc.reg_id = ?`,
      [req.params.regId]
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
