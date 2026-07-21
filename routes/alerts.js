const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT a.alert_id, a.reg_id, a.change_id, a.department, r.title, r.category,
       a.severity_level, a.status, a.created_at,
       COALESCE(r.source_url, rs.base_url) AS source_url,
       rc.impact_score, rc.semantic_differences
       FROM alerts a
       JOIN regulations r ON a.reg_id = r.reg_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id
       LEFT JOIN regulation_changes rc ON a.change_id = rc.change_id
       ORDER BY a.created_at DESC`
    );

    // Check if auto-task exists for each alert
    for (var row of rows) {
      var [taskLink] = await pool.query(
        'SELECT t.task_id, t.title AS task_title, t.status AS task_status FROM task_alerts ta JOIN tasks t ON ta.task_id = t.task_id WHERE ta.alert_id = ? LIMIT 1',
        [row.alert_id]
      );
      row.auto_task = taskLink.length > 0 ? taskLink[0] : null;
    }

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/bulk — Bulk status update
router.patch('/bulk', async (req, res) => {
  try {
    var { status, severity_filter } = req.body;
    var VALID_STATUSES = ['Unread', 'Read', 'Dismissed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    var sql = 'UPDATE alerts SET status = ? WHERE 1=1';
    var params = [status];
    if (severity_filter) {
      sql += ' AND severity_level = ?';
      params.push(severity_filter);
    }
    var [result] = await pool.query(sql, params);
    await logAudit(req.body.user_id || 1, 'BULK_STATUS_UPDATE', 'alerts', 0, 'Bulk updated ' + result.affectedRows + ' alerts to ' + status);
    res.status(200).json({ message: 'Updated ' + result.affectedRows + ' alerts', affected: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Unread', 'Read', 'Dismissed'];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Unread, Read, Dismissed' });
    }
    var [result] = await pool.query('UPDATE alerts SET status = ? WHERE alert_id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'alerts', id, 'Alert ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Alert status updated successfully', alert_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
