const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const eventBus = require('../agents/eventBus');
const { getCurrentVersionNumber } = require('../agents/versioner');
const { embedPolicy } = require('../services/ragEngine');
const router = express.Router();

// GET /api/internal-policies
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT ip.policy_id, ip.policy_name, ip.description, ip.last_updated,
       (SELECT COUNT(*) FROM policy_versions pv WHERE pv.policy_id = ip.policy_id) AS version_count,
       (SELECT COUNT(*) FROM audit_logs al WHERE al.target_table = 'internal_policies' AND al.target_id = ip.policy_id AND al.action_type IN ('AI_POLICY_CREATED', 'AI_POLICY_UPDATED')) AS ai_generated
       FROM internal_policies ip ORDER BY ip.policy_name`
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/internal-policies
router.post('/', async (req, res) => {
  try {
    var { policy_name, description } = req.body;
    if (!policy_name || !description) {
      return res.status(400).json({ error: 'policy_name and description are required' });
    }
    var [result] = await pool.query(
      'INSERT INTO internal_policies (policy_name, description) VALUES (?, ?)',
      [policy_name, description]
    );
    await logAudit(req.body.user_id || 1, 'POLICY_CREATED', 'internal_policies', result.insertId, 'Policy created: ' + policy_name);

    // Embed into Pinecone for RAG pipeline
    embedPolicy(result.insertId, policy_name, description).catch(function() {});

    res.status(201).json({ message: 'Policy created', policy_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/internal-policies/:id
router.put('/:id', async (req, res) => {
  try {
    var { id } = req.params;
    var { policy_name, description } = req.body;
    var fields = [], values = [];
    if (policy_name !== undefined) { fields.push('policy_name = ?'); values.push(policy_name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);

    // Snapshot old version before updating (Policy Versioning Agent)
    var [oldPolicy] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [id]);
    if (oldPolicy.length > 0) {
      var versionNum = await getCurrentVersionNumber(parseInt(id));
      eventBus.emit('policy.updated', {
        policy_id: parseInt(id),
        old_name: oldPolicy[0].policy_name,
        old_description: oldPolicy[0].description,
        version_number: versionNum,
        user_id: req.body.user_id || 1,
        reason: req.body.change_reason || 'Manual update'
      });
    }

    var [result] = await pool.query(`UPDATE internal_policies SET ${fields.join(', ')} WHERE policy_id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Policy not found' });
    await logAudit(req.body.user_id || 1, 'POLICY_UPDATED', 'internal_policies', id, 'Policy ' + id + ' updated');

    // Re-embed updated policy into Pinecone
    var [updated] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [id]);
    if (updated.length > 0) {
      embedPolicy(parseInt(id), updated[0].policy_name, updated[0].description).catch(function() {});
    }

    res.status(200).json({ message: 'Policy updated', policy_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/internal-policies/:id/history — Version history for a policy
router.get('/:id/history', async (req, res) => {
  try {
    var { id } = req.params;
    var [versions] = await pool.query(
      'SELECT version_id, version_number, policy_name, description, change_reason, created_at FROM policy_versions WHERE policy_id = ? ORDER BY version_number DESC',
      [id]
    );
    // Also include current version
    var [current] = await pool.query('SELECT policy_name, description, last_updated FROM internal_policies WHERE policy_id = ?', [id]);
    res.status(200).json({ current: current[0] || null, history: versions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
