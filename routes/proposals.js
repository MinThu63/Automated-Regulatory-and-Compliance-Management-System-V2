const express = require('express');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');
const { embedPolicy } = require('../services/ragEngine');
const eventBus = require('../agents/eventBus');
const { getCurrentVersionNumber } = require('../agents/versioner');
const router = express.Router();

// GET /api/policy-proposals — list all pending proposals (with gap details)
router.get('/', async (req, res) => {
  try {
    var status = req.query.status || 'Pending';
    var [rows] = await pool.query(
      'SELECT * FROM policy_proposals WHERE status = ? ORDER BY created_at DESC',
      [status]
    );

    // Attach related gap descriptions for context
    for (var row of rows) {
      if (row.related_gap_ids) {
        var ids = row.related_gap_ids.split(',').filter(Boolean);
        if (ids.length > 0) {
          var placeholders = ids.map(function() { return '?'; }).join(',');
          var [gaps] = await pool.query(
            'SELECT gap_id, gap_description FROM compliance_gaps WHERE gap_id IN (' + placeholders + ')',
            ids
          );
          row.related_gaps = gaps;
        } else {
          row.related_gaps = [];
        }
      } else {
        row.related_gaps = [];
      }
    }

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policy-proposals/:id/accept — Apply the proposal to internal_policies
router.post('/:id/accept', async (req, res) => {
  try {
    var { id } = req.params;
    var userId = req.body.user_id || 1;

    var [proposals] = await pool.query('SELECT * FROM policy_proposals WHERE proposal_id = ?', [id]);
    if (proposals.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    var proposal = proposals[0];
    if (proposal.status !== 'Pending') return res.status(400).json({ error: 'Proposal already reviewed' });

    var policyId;

    if (proposal.proposal_type === 'New Policy') {
      var [result] = await pool.query(
        'INSERT INTO internal_policies (policy_name, description) VALUES (?, ?)',
        [proposal.policy_name, proposal.proposed_description]
      );
      policyId = result.insertId;
      await logAudit(userId, 'AI_POLICY_CREATED', 'internal_policies', policyId,
        'Policy created from AI proposal #' + id + ': ' + proposal.policy_name);
    } else {
      // Policy Update — snapshot old version first, then update
      policyId = proposal.target_policy_id;
      if (!policyId) return res.status(400).json({ error: 'No target policy specified for update' });

      // Snapshot old version before overwriting (same as manual edit)
      var [oldPolicy] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [policyId]);
      if (oldPolicy.length > 0) {
        var versionNum = await getCurrentVersionNumber(parseInt(policyId));
        eventBus.emit('policy.updated', {
          policy_id: parseInt(policyId),
          old_name: oldPolicy[0].policy_name,
          old_description: oldPolicy[0].description,
          version_number: versionNum,
          user_id: userId,
          reason: 'AI proposal #' + id + ' accepted: ' + (proposal.reasoning || '').substring(0, 100)
        });
      }

      await pool.query(
        'UPDATE internal_policies SET description = ? WHERE policy_id = ?',
        [proposal.proposed_description, policyId]
      );
      await logAudit(userId, 'AI_POLICY_UPDATED', 'internal_policies', policyId,
        'Policy updated from AI proposal #' + id + ': ' + proposal.policy_name);
    }

    // Embed into Pinecone
    embedPolicy(policyId, proposal.policy_name, proposal.proposed_description).catch(function() {});

    // Mark proposal as accepted
    await pool.query(
      "UPDATE policy_proposals SET status = 'Accepted', reviewed_by = ?, reviewed_at = NOW() WHERE proposal_id = ?",
      [userId, id]
    );

    await logAudit(userId, 'PROPOSAL_ACCEPTED', 'policy_proposals', id, 'Accepted proposal: ' + proposal.policy_name);

    res.status(200).json({ message: 'Proposal accepted and applied', policy_id: policyId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policy-proposals/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    var { id } = req.params;
    var userId = req.body.user_id || 1;

    var [result] = await pool.query(
      "UPDATE policy_proposals SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW() WHERE proposal_id = ? AND status = 'Pending'",
      [userId, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Proposal not found or already reviewed' });

    await logAudit(userId, 'PROPOSAL_REJECTED', 'policy_proposals', id, 'Rejected proposal #' + id);

    res.status(200).json({ message: 'Proposal rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
