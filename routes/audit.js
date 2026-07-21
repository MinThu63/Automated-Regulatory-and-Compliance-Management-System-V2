const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/audit-logs
router.get('/', async (req, res) => {
  try {
    var { user_id, action_type, target_table, start_date, end_date } = req.query;
    var sql = `SELECT al.log_id, u.username, al.user_id, al.action_type, al.target_table, al.target_id, al.description, al.timestamp
               FROM audit_logs al JOIN users u ON al.user_id = u.user_id WHERE 1=1`;
    var params = [];
    if (user_id) { sql += ' AND al.user_id = ?'; params.push(user_id); }
    if (action_type) { sql += ' AND al.action_type LIKE ?'; params.push('%' + action_type + '%'); }
    if (target_table) { sql += ' AND al.target_table = ?'; params.push(target_table); }
    if (start_date) { sql += ' AND al.timestamp >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND al.timestamp <= ?'; params.push(end_date + ' 23:59:59'); }
    sql += ' ORDER BY al.timestamp DESC';

    var [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit-logs/stats — Summary statistics for audit trail
router.get('/stats', async (req, res) => {
  try {
    var [totalRow] = await pool.query('SELECT COUNT(*) AS total FROM audit_logs');
    var total = totalRow[0].total;

    var oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    var [weekRow] = await pool.query('SELECT COUNT(*) AS cnt FROM audit_logs WHERE timestamp >= ?', [oneWeekAgo.toISOString().slice(0, 10)]);
    var thisWeek = weekRow[0].cnt;

    // AI agent actions (user_id = 1 is system/agent actions with specific action types)
    var [aiRow] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM audit_logs WHERE action_type IN ('IMPACT_ASSESSED', 'TASK_AUTO_CREATED', 'LLM_CLUSTER_GAP_ANALYSIS', 'BULK_CLUSTER_ANALYSIS', 'POLICY_PROPOSED', 'GAP_AUTO_STATUS', 'AI_POLICY_CREATED', 'AI_POLICY_UPDATED')"
    );
    var aiActions = aiRow[0].cnt;

    var humanActions = total - aiActions;

    // Agent breakdown
    var [agentStats] = await pool.query(`
      SELECT 
        SUM(CASE WHEN action_type = 'IMPACT_ASSESSED' THEN 1 ELSE 0 END) AS assessor_actions,
        SUM(CASE WHEN action_type IN ('TASK_AUTO_CREATED') THEN 1 ELSE 0 END) AS dispatcher_actions,
        SUM(CASE WHEN action_type IN ('LLM_CLUSTER_GAP_ANALYSIS', 'BULK_CLUSTER_ANALYSIS') THEN 1 ELSE 0 END) AS analyzer_actions,
        SUM(CASE WHEN action_type IN ('POLICY_PROPOSED') THEN 1 ELSE 0 END) AS advisor_actions,
        SUM(CASE WHEN action_type IN ('LOGIN') THEN 1 ELSE 0 END) AS login_count,
        SUM(CASE WHEN action_type LIKE '%STATUS_UPDATE%' THEN 1 ELSE 0 END) AS status_updates
      FROM audit_logs
    `);

    // Regulations ingested (from regulations table count as proxy)
    var [regCount] = await pool.query('SELECT COUNT(*) AS cnt FROM regulations');
    var [gapCount] = await pool.query('SELECT COUNT(*) AS cnt FROM compliance_gaps');
    var [taskCount] = await pool.query("SELECT COUNT(*) AS cnt FROM tasks WHERE description LIKE '%Auto-generated%' OR description LIKE '%Severity:%'");

    res.status(200).json({
      total: total,
      this_week: thisWeek,
      ai_actions: aiActions,
      human_actions: humanActions,
      agents: {
        scraper: regCount[0].cnt,
        assessor: agentStats[0].assessor_actions || 0,
        analyzer: agentStats[0].analyzer_actions || 0,
        dispatcher: agentStats[0].dispatcher_actions || 0,
        advisor: agentStats[0].advisor_actions || 0
      },
      logins: agentStats[0].login_count || 0,
      status_updates: agentStats[0].status_updates || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit-logs/response-chain/:regId — Full compliance response chain for a regulation
router.get('/response-chain/:regId', async (req, res) => {
  try {
    var regId = req.params.regId;

    // Get the regulation
    var [reg] = await pool.query('SELECT reg_id, title, category FROM regulations WHERE reg_id = ?', [regId]);
    if (reg.length === 0) return res.status(404).json({ error: 'Regulation not found' });

    // Get changes for this regulation
    var [changes] = await pool.query(
      'SELECT change_id, impact_score, semantic_differences, detected_at FROM regulation_changes WHERE reg_id = ? ORDER BY detected_at DESC',
      [regId]
    );

    // Get alerts for this regulation
    var [alerts] = await pool.query(
      'SELECT alert_id, severity_level, status, created_at FROM alerts WHERE reg_id = ? ORDER BY created_at DESC',
      [regId]
    );

    // Get gaps for this regulation
    var [gaps] = await pool.query(
      'SELECT cg.gap_id, cg.gap_description, cg.status, cg.identified_at, ip.policy_name FROM compliance_gaps cg JOIN internal_policies ip ON cg.policy_id = ip.policy_id WHERE cg.reg_id = ? ORDER BY cg.identified_at DESC',
      [regId]
    );

    // Get tasks linked to this regulation's alerts
    var tasks = [];
    for (var alert of alerts) {
      var [linkedTasks] = await pool.query(
        'SELECT t.task_id, t.title, t.status, t.department, t.deadline FROM task_alerts ta JOIN tasks t ON ta.task_id = t.task_id WHERE ta.alert_id = ?',
        [alert.alert_id]
      );
      tasks = tasks.concat(linkedTasks);
    }

    // Get tasks linked to this regulation's gaps
    for (var gap of gaps) {
      var [gapTasks] = await pool.query(
        'SELECT t.task_id, t.title, t.status, t.department, t.deadline FROM task_gaps tg JOIN tasks t ON tg.task_id = t.task_id WHERE tg.gap_id = ?',
        [gap.gap_id]
      );
      tasks = tasks.concat(gapTasks);
    }

    // Deduplicate tasks
    var seenTaskIds = {};
    tasks = tasks.filter(function(t) {
      if (seenTaskIds[t.task_id]) return false;
      seenTaskIds[t.task_id] = true;
      return true;
    });

    res.status(200).json({
      regulation: reg[0],
      changes: changes,
      alerts: alerts,
      gaps: gaps,
      tasks: tasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
