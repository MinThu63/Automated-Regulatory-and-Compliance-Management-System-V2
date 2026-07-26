const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const router = express.Router();

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT t.task_id, t.title, t.description, t.department, t.deadline, t.status, t.created_at
       FROM tasks t ORDER BY t.created_at DESC`
    );
    // Get linked gap IDs and alert IDs from junction tables
    for (var row of rows) {
      var [gapLinks] = await pool.query('SELECT gap_id FROM task_gaps WHERE task_id = ?', [row.task_id]);
      row.gap_ids = gapLinks.map(function(g) { return g.gap_id; });

      var [alertLinks] = await pool.query('SELECT alert_id FROM task_alerts WHERE task_id = ?', [row.task_id]);
      row.alert_ids = alertLinks.map(function(a) { return a.alert_id; });
    }
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    var { department, title, deadline, alert_id, description } = req.body;
    if (!department || !title || !deadline) {
      return res.status(400).json({ error: 'department, title, and deadline are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO tasks (alert_id, department, title, description, deadline) VALUES (?, ?, ?, ?, ?)',
      [alert_id || null, department, title, description || null, deadline]
    );

    // Link task to alert via task_alerts junction table (so Changes & Impact shows the linkage)
    if (alert_id) {
      await pool.query('INSERT IGNORE INTO task_alerts (task_id, alert_id) VALUES (?, ?)', [result.insertId, alert_id]);
    }

    await logAudit(1, 'TASK_CREATED', 'tasks', result.insertId, 'Task created: ' + title + ' (Department: ' + department + ')');
    res.status(201).json({ message: 'Task created', task_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { status } = req.body;
    var VALID_STATUSES = ['Pending', 'In Progress', 'Completed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed values: Pending, In Progress, Completed' });
    }
    var [result] = await pool.query('UPDATE tasks SET status = ? WHERE task_id = ?', [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });

    // AUTO-UPDATE linked gap status based on task status
    var [linkedGaps] = await pool.query('SELECT gap_id FROM task_gaps WHERE task_id = ?', [id]);
    if (linkedGaps.length > 0) {
      var gapStatus = 'In Review';
      if (status === 'Completed') gapStatus = 'Remediated';

      for (var gapLink of linkedGaps) {
        await pool.query('UPDATE compliance_gaps SET status = ? WHERE gap_id = ?', [gapStatus, gapLink.gap_id]);
      }
      await logAudit(req.body.user_id || 1, 'GAP_AUTO_STATUS', 'compliance_gaps', 0,
        'Task ' + id + ' → ' + status + ': Updated ' + linkedGaps.length + ' linked gaps to ' + gapStatus);
    }

    await logAudit(req.body.user_id || 1, 'STATUS_UPDATE', 'tasks', id, 'Task ' + id + ' status changed to ' + status);
    res.status(200).json({ message: 'Task status updated', task_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var [result] = await pool.query('DELETE FROM tasks WHERE task_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    await logAudit(1, 'TASK_DELETED', 'tasks', id, 'Task ' + id + ' deleted');
    res.status(200).json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
