const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/regulation-changes
router.get('/', async (req, res) => {
  try {
    var [rows] = await pool.query(
      `SELECT rc.change_id, r.title AS regulation_title, rc.previous_version, rc.new_version,
       rc.semantic_differences, rc.impact_score, rc.detected_at, COALESCE(r.source_url, rs.base_url) AS source_url
       FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id
       JOIN regulatory_sources rs ON r.source_id = rs.source_id`
    );
    res.status(200).json(rows);
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
