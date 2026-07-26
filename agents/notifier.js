const eventBus = require('./eventBus');
const { sendSummaryEmail } = require('../services/notificationService');
const logAudit = require('../middleware/auditLog');

// =============================================
// NOTIFICATION AGENT
// Responsibility: Buffer all Critical/High alerts from a scraper run,
//                 then send ONE summary email with all insights.
// Listens to: alert.created, task.created
// =============================================

const AGENT_NAME = 'NotificationAgent';

const NOTIFY_ON_IMPACT = ['Critical', 'High'];
var alertBuffer = [];
var bufferTimer = null;
var BUFFER_DELAY = 30000; // Wait 30 seconds after last alert to send digest

// =============================================
// HANDLE ALERTS — Buffer Critical/High
// =============================================

function handleAlert(data) {
  if (!NOTIFY_ON_IMPACT.includes(data.impact_score)) return;

  alertBuffer.push({
    title: data.title,
    impact_score: data.impact_score,
    severity: data.severity,
    department: data.department || 'Unassigned',
    deadline: data.explicit_deadline || null,
    affected_areas: data.affected_areas || null,
    summary: (data.semantic_differences || '').substring(0, 150),
    category: data.category || 'AML'
  });

  console.log('[' + AGENT_NAME + '] Buffered alert (' + alertBuffer.length + '): ' + data.impact_score + ' — ' + (data.title || '').substring(0, 40));

  // Auto-send digest after buffer delay (resets on each new alert)
  if (bufferTimer) clearTimeout(bufferTimer);
  bufferTimer = setTimeout(function() {
    if (alertBuffer.length > 0) {
      console.log('[' + AGENT_NAME + '] Auto-triggering digest after ' + (BUFFER_DELAY / 1000) + 's of inactivity...');
      sendDigest();
    }
  }, BUFFER_DELAY);
}

// =============================================
// SEND DIGEST — One email with all buffered alerts
// =============================================

async function sendDigest() {
  if (alertBuffer.length === 0) return;

  var alerts = alertBuffer.slice();
  alertBuffer = [];

  console.log('[' + AGENT_NAME + '] Sending digest email with', alerts.length, 'alert(s)...');

  try {
    await sendSummaryEmail(alerts);
    console.log('[' + AGENT_NAME + '] ✉️ Summary email sent (' + alerts.length + ' alerts)');
    await logAudit(1, 'NOTIFICATION_DIGEST_SENT', 'alerts', 0,
      AGENT_NAME + ': Digest email with ' + alerts.length + ' Critical/High alerts');
  } catch (err) {
    console.error('[' + AGENT_NAME + '] Digest email failed:', err.message);
  }
}

// =============================================
// HANDLE TASK CREATION — Log only
// =============================================

function handleTaskCreated(data) {
  console.log('[' + AGENT_NAME + '] Task notification → ' + data.department + ':', (data.title || '').substring(0, 50));
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');
  console.log('[' + AGENT_NAME + '] Digest mode: buffers alerts for ' + (BUFFER_DELAY / 1000) + 's then sends ONE summary email');

  eventBus.on('alert.created', function(data) {
    handleAlert(data);
  });

  eventBus.on('task.created', function(data) {
    handleTaskCreated(data);
  });

  console.log('[' + AGENT_NAME + '] Listening for alert.created, task.created');
}

module.exports = { start, sendDigest };
