const eventBus = require('./eventBus');
const pool = require('../db');
const logAudit = require('../middleware/auditLog');

// =============================================
// POLICY VERSIONING AGENT
// Responsibility: Track version history when policies are updated
// Listens to: policy.updated
// Emits: policy.version.created
// =============================================

const AGENT_NAME = 'PolicyVersioningAgent';

// =============================================
// CORE LOGIC: Snapshot old version before update
// =============================================

async function snapshotPolicy(data) {
  try {
    // Store the old version in policy_versions table
    await pool.query(
      `INSERT INTO policy_versions (policy_id, policy_name, description, version_number, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.policy_id, data.old_name, data.old_description, data.version_number, data.user_id || 1, data.reason || 'Manual update']
    );

    console.log('[' + AGENT_NAME + '] Versioned policy #' + data.policy_id + ' (v' + data.version_number + '):', data.old_name.substring(0, 50));

    eventBus.emit('policy.version.created', {
      policy_id: data.policy_id,
      version_number: data.version_number,
      policy_name: data.old_name
    });

    await logAudit(data.user_id || 1, 'POLICY_VERSIONED', 'policy_versions', data.policy_id,
      AGENT_NAME + ': Saved v' + data.version_number + ' of ' + data.old_name.substring(0, 80));

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Failed to version policy:', err.message);
  }
}

// =============================================
// GET CURRENT VERSION NUMBER
// =============================================

async function getCurrentVersionNumber(policyId) {
  var [rows] = await pool.query(
    'SELECT MAX(version_number) AS max_version FROM policy_versions WHERE policy_id = ?',
    [policyId]
  );
  return (rows[0].max_version || 0) + 1;
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');

  eventBus.on('policy.updated', function(data) {
    snapshotPolicy(data);
  });

  console.log('[' + AGENT_NAME + '] Listening for policy.updated');
}

module.exports = { start, snapshotPolicy, getCurrentVersionNumber };
