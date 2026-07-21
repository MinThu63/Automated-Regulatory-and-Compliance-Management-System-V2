const eventBus = require('./eventBus');
const pool = require('../db');
const OpenAI = require('openai');
const logAudit = require('../middleware/auditLog');

// =============================================
// TASK ORCHESTRATION AGENT (Dispatcher)
// Responsibility: 
//   - Collect Critical/High gaps
//   - Group related gaps by department + regulation
//   - Use LLM to generate ONE smart task per group
//   - Link multiple gaps to one task
//
// Listens to: gap.created
// Emits: task.created
// Uses LLM: Yes — to generate clear, actionable task descriptions
// =============================================

const AGENT_NAME = 'TaskOrchestrationAgent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// DEPARTMENT MAPPING
// =============================================

const DEPARTMENT_MAPPING = {
  'AML': { department: 'Compliance Operations', default_assignee: 1 },
  'KYC': { department: 'Compliance Operations', default_assignee: 1 },
  'AML/CFT': { department: 'Compliance Operations', default_assignee: 1 },
  'Banking Supervision': { department: 'Risk Management', default_assignee: 1 },
  'Capital Requirements': { department: 'Risk Management', default_assignee: 1 },
  'Financial Conduct': { department: 'Legal & Compliance', default_assignee: 2 },
  'Consumer Protection': { department: 'Legal & Compliance', default_assignee: 2 },
  'Cyber': { department: 'IT Security', default_assignee: 1 },
  'TRM': { department: 'IT Security', default_assignee: 1 },
  'Operational Risk': { department: 'IT Security', default_assignee: 1 },
  'Data Privacy': { department: 'Data Protection Office', default_assignee: 2 },
  'PDPA': { department: 'Data Protection Office', default_assignee: 2 },
  'ESG': { department: 'ESG & Green Finance', default_assignee: 1 },
  'Governance': { department: 'Board Secretariat', default_assignee: 2 }
};

const DEADLINE_RULES = { 'Critical': 3, 'High': 7, 'Medium': 14, 'Low': 30 };

// =============================================
// LLM PROMPT STRUCTURE — Harness format
// System → Developer → User → Assistant → User (task) → Assistant (response)
// =============================================

const SYSTEM_PROMPT = `You are a task orchestration agent at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore. Your role is to analyze compliance gaps assigned to a department and generate clear, actionable remediation tasks. Each task you create must tell the department EXACTLY what to do — not vague instructions like "review" or "address", but specific actions like "Draft a wire transfer policy covering originator and beneficiary identification requirements." You may create MULTIPLE tasks if the gaps require different types of work. Always output valid JSON.`;

const DEVELOPER_RULES = `Rules you MUST follow:
1. Each task title MUST start with an action verb (Implement, Draft, Establish, Update, Develop, Create, Define, Document, Integrate, Configure).
2. Each task title MUST be specific enough that someone reading it knows what to do WITHOUT reading the gap details.
3. If multiple gaps can be addressed by ONE action (e.g., updating one policy), combine them into ONE task.
4. If gaps require DIFFERENT types of work (e.g., one needs a new policy, another needs a system change), create SEPARATE tasks.
5. Maximum 5 tasks per department group. Minimum 1.
6. Task descriptions must include: what to do, why (which regulation requires it), and what the deliverable is.
7. Do NOT use vague language like "review and update as needed" or "ensure compliance". Be specific.
8. Consider the department's expertise when phrasing tasks:
   - Compliance Operations: policy drafting, procedure updates, training
   - Risk Management: risk models, stress testing, capital calculations
   - IT Security: system configurations, monitoring tools, resilience testing
   - Legal & Compliance: legal review, regulatory filings, customer communications
   - Board Secretariat: governance frameworks, board assessments, conflict policies
   - Data Protection Office: privacy impact assessments, consent mechanisms, data retention`;

const TASK_GENERATION_PROMPT = `Analyze these compliance gaps assigned to {department} and generate actionable remediation tasks.

GAPS:
{gaps_list}

For each distinct piece of work needed, create a task. Related gaps that can be fixed by one action = one task. Gaps needing different work = separate tasks.

Respond with ONLY a JSON object:
{"tasks": [{"title": "Action-oriented title (max 120 chars, starts with verb)", "description": "What to do, why, and what the deliverable is", "gap_indices": [1, 2]}]}

The gap_indices array indicates which gap numbers (from the list above) each task addresses.`;

// =============================================
// LLM PROMPT STRUCTURE FOR ALERTS (regulatory changes)
// Groups related Critical/High changes by category (like gaps pipeline)
// and generates ONE smart task per group — one task can cover multiple changes.
// =============================================

const ALERT_SYSTEM_PROMPT = `You are a task orchestration agent at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore. Your role is to analyze a CLUSTER of related regulatory changes from the same compliance category and generate the minimum number of clear, actionable remediation tasks needed to address all of them. One task can and should cover multiple related changes if they require the same type of work. Always output valid JSON.`;

const ALERT_DEVELOPER_RULES = `Rules you MUST follow:
1. Read ALL regulatory changes in the cluster before deciding how many tasks are needed.
2. If multiple changes all require updating the SAME policy or procedure → ONE task covering all of them.
3. If changes require DIFFERENT types of work (e.g. one needs a policy update, another needs a system change) → SEPARATE tasks.
4. Each task title MUST start with an action verb (Implement, Update, Draft, Establish, Configure, Integrate, Document).
5. Each task title MUST reference WHAT specifically needs to change — not "Review AML changes" but "Update Transaction Monitoring Policy to cover digital payment token thresholds per MAS Notice 626".
6. Task description must state: (a) which regulations require this, (b) what specifically changed, (c) what the deliverable is (e.g. updated policy document, system configuration, training material).
7. Use the earliest explicit regulatory deadline across all changes in the cluster as the task deadline hint.
8. Maximum 4 tasks per cluster. Minimum 1.
9. Do NOT create separate tasks per regulation if one task covers them all.`;

const ALERT_TASK_PROMPT = `Analyze this CLUSTER of {count} related Critical/High regulatory changes in the "{category}" category assigned to {department}.

REGULATORY CHANGES IN THIS CLUSTER:
{alerts_list}

These changes are related — look for common themes and consolidate where possible.

Respond with ONLY a JSON object:
{"tasks": [{"title": "Specific verb-led title referencing the actual change (max 120 chars)", "description": "Which regulations, what changed, and what the deliverable is", "alert_indices": [1, 2, 3], "suggested_deadline": "YYYY-MM-DD or null"}]}`;

// =============================================
// GAP BUFFER — Collect gaps before dispatching
// =============================================

var gapBuffer = [];
var dispatchTimer = null;
var BUFFER_DELAY = 5000; // Wait 5 seconds to collect related gaps before dispatching

// =============================================
// ALERT BUFFER — Collect regulatory-change alerts before dispatching
// Critical / penalty-linked alerts BYPASS this buffer entirely.
// =============================================

var alertBuffer = [];
var alertDispatchTimer = null;
var ALERT_BUFFER_DELAY = 5000;

function getDepartmentForCategory(category) {
  if (DEPARTMENT_MAPPING[category]) return DEPARTMENT_MAPPING[category];
  for (var key in DEPARTMENT_MAPPING) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) {
      return DEPARTMENT_MAPPING[key];
    }
  }
  return { department: 'Compliance Operations', default_assignee: 1 };
}

function calculateDeadline(severity) {
  var days = DEADLINE_RULES[severity] || 14;
  var deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline.toISOString().slice(0, 10);
}

// =============================================
// CORE: Process buffered gaps — group and dispatch
// =============================================

async function processBufferedGaps() {
  if (gapBuffer.length === 0) return;

  var gaps = gapBuffer.slice();
  gapBuffer = [];

  console.log('[' + AGENT_NAME + '] Processing', gaps.length, 'buffered gaps...');

  // Group gaps by department
  var groups = {};
  gaps.forEach(function(gap) {
    var dept = getDepartmentForCategory(gap.category);
    var key = dept.department;
    if (!groups[key]) groups[key] = { department: dept.department, assignee: dept.default_assignee, gaps: [], maxSeverity: 'Medium' };
    groups[key].gaps.push(gap);
    // Track highest severity in group
    if (gap.severity === 'Critical') groups[key].maxSeverity = 'Critical';
    else if (gap.severity === 'High' && groups[key].maxSeverity !== 'Critical') groups[key].maxSeverity = 'High';
  });

  // For each department group, generate ONE task using LLM
  for (var key in groups) {
    var group = groups[key];
    await createSmartTask(group);
  }
}

async function createSmartTask(group) {
  var gapsList = group.gaps.map(function(g, i) {
    var desc = (g.description || '').replace(/\s*\[Severity:.*?\]/g, '').replace(/\s*\| Recommendation:.*$/g, '').replace(/\s*\| Sources:.*$/g, '').trim();
    var rec = '';
    if (g.description && g.description.includes('| Recommendation:')) {
      rec = g.description.split('| Recommendation:')[1].replace(/\s*\| Sources:.*$/g, '').trim();
    }
    return (i + 1) + '. ' + desc + (rec ? '\n   → Recommended: ' + rec : '');
  }).join('\n');

  var prompt = TASK_GENERATION_PROMPT
    .replace('{department}', group.department)
    .replace('{gaps_list}', gapsList.substring(0, 2500));

  var tasks = [];

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: DEVELOPER_RULES },
        { role: 'assistant', content: 'Understood. I will generate specific, actionable tasks with verb-led titles. I will create multiple tasks if the gaps require different types of work.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    var content = response.choices[0].message.content.trim();
    var parsed = JSON.parse(content);
    tasks = parsed.tasks || [parsed]; // Support both {tasks:[...]} and single {title, description}
  } catch (err) {
    console.error('[' + AGENT_NAME + '] LLM task generation failed:', err.message);
    // Fallback: one generic task
    tasks = [{ title: 'Address ' + group.gaps.length + ' compliance gaps', description: 'Review and remediate the identified compliance gaps for ' + group.department, gap_indices: group.gaps.map(function(_, i) { return i + 1; }) }];
  }

  // Create each task in the database
  var deadline = calculateDeadline(group.maxSeverity);

  for (var task of tasks) {
    var fullDescription = 'Severity: ' + group.maxSeverity + '\n\n' + (task.description || '');

    try {
      var [result] = await pool.query(
        'INSERT INTO tasks (department, title, description, deadline) VALUES (?, ?, ?, ?)',
        [group.department, (task.title || '').substring(0, 255), fullDescription, deadline]
      );
      var taskId = result.insertId;

      // Link gaps to this task based on gap_indices
      var indices = task.gap_indices || group.gaps.map(function(_, i) { return i + 1; });
      for (var idx of indices) {
        var gapObj = group.gaps[idx - 1];
        if (gapObj) {
          await pool.query('INSERT IGNORE INTO task_gaps (task_id, gap_id) VALUES (?, ?)', [taskId, gapObj.gap_id]);
          await pool.query("UPDATE compliance_gaps SET status = 'In Review' WHERE gap_id = ? AND status = 'Open'", [gapObj.gap_id]);
        }
      }

      eventBus.emit('task.created', {
        task_id: taskId, title: task.title, department: group.department,
        deadline: deadline, gaps_count: indices.length
      });

      await logAudit(1, 'TASK_AUTO_CREATED', 'tasks', taskId,
        AGENT_NAME + ': ' + group.department + ' — ' + (task.title || '').substring(0, 80));

      console.log('[' + AGENT_NAME + '] Task → ' + group.department + ' | ' + indices.length + ' gaps | ' + (task.title || '').substring(0, 60));

    } catch (err) {
      console.error('[' + AGENT_NAME + '] Failed to create task:', err.message);
    }
  }

  console.log('[' + AGENT_NAME + '] Created', tasks.length, 'task(s) for', group.department);
}

// =============================================
// HANDLE GAP EVENT — Buffer then dispatch
// =============================================

function handleGap(data) {
  // Determine severity
  var severity = data.severity || 'Medium';
  if (data.description) {
    var sevMatch = data.description.match(/\[Severity:\s*(Critical|High|Medium|Low)\]/i);
    if (sevMatch) severity = sevMatch[1];
  }

  // Only auto-create tasks for Critical/High
  if (severity !== 'Critical' && severity !== 'High') return;

  // Add to buffer
  data.severity = severity;
  gapBuffer.push(data);

  // Reset the dispatch timer — wait for more gaps to come in
  if (dispatchTimer) clearTimeout(dispatchTimer);
  dispatchTimer = setTimeout(function() {
    processBufferedGaps();
  }, BUFFER_DELAY);
}

// =============================================
// HANDLE ALERT — regulatory change + impact assessment → task(s)
// Critical/penalty-linked alerts bypass the buffer and dispatch immediately.
// High/Medium alerts are buffered and grouped by department, same pattern
// as gap-based task generation.
// =============================================

function handleAlert(data) {
  if (data.impact_score !== 'Critical' && data.impact_score !== 'High') return;

  var dept = data.department || getDepartmentForCategory(data.category).department;
  data.department = dept;
  data.category = data.category || 'AML';

  // All Critical/High alerts go into the buffer — grouped by category+department.
  // This ensures related changes (e.g. multiple AML updates) produce ONE smart task
  // rather than N separate tasks. Buffer delay gives time for related events to arrive.
  alertBuffer.push(data);

  // Critical or penalty-linked: shorter buffer (2s) so they aren't delayed too long
  var delay = (data.impact_score === 'Critical' || data.explicit_deadline) ? 2000 : ALERT_BUFFER_DELAY;

  if (alertDispatchTimer) clearTimeout(alertDispatchTimer);
  alertDispatchTimer = setTimeout(function() {
    processBufferedAlerts();
  }, delay);

  console.log('[' + AGENT_NAME + '] Buffered ' + data.impact_score + ' alert: ' + (data.title || '').substring(0, 60));
}

async function processBufferedAlerts() {
  if (alertBuffer.length === 0) return;

  var alerts = alertBuffer.slice();
  alertBuffer = [];

  console.log('[' + AGENT_NAME + '] Processing', alerts.length, 'buffered alerts...');

  // Group by category + department (same pattern as gaps pipeline)
  // Key: "category|department" so AML/Compliance Operations is one group
  var groups = {};
  alerts.forEach(function(alert) {
    var key = (alert.category || 'AML') + '|' + alert.department;
    if (!groups[key]) groups[key] = {
      category: alert.category || 'AML',
      department: alert.department,
      alerts: [],
      maxSeverity: 'Medium'
    };
    groups[key].alerts.push(alert);
    if (alert.impact_score === 'Critical') groups[key].maxSeverity = 'Critical';
    else if (alert.impact_score === 'High' && groups[key].maxSeverity !== 'Critical') groups[key].maxSeverity = 'High';
  });

  console.log('[' + AGENT_NAME + '] Grouped into', Object.keys(groups).length, 'category clusters:', Object.keys(groups).join(', '));

  for (var key in groups) {
    await createAlertTask(groups[key]);
  }
}

async function createAlertTask(group) {
  var alertsList = group.alerts.map(function(a, i) {
    var diffText = (a.semantic_differences || a.title || '').replace(/^\[[^\]]+\]\s*/, '');
    var deadlineNote = a.explicit_deadline ? ' [Regulatory deadline: ' + a.explicit_deadline + ']' : '';
    var areasNote = a.affected_areas ? ' [Affected: ' + a.affected_areas + ']' : '';
    return (i + 1) + '. [' + a.impact_score + '] ' + a.title + '\n   Change: ' + diffText.substring(0, 250) + deadlineNote + areasNote;
  }).join('\n\n');

  var prompt = ALERT_TASK_PROMPT
    .replace('{count}', group.alerts.length)
    .replace('{category}', group.category || 'Compliance')
    .replace('{department}', group.department)
    .replace('{alerts_list}', alertsList.substring(0, 3000));

  var tasks = [];

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: ALERT_SYSTEM_PROMPT },
        { role: 'user', content: ALERT_DEVELOPER_RULES },
        { role: 'assistant', content: 'Understood. I will read all ' + group.alerts.length + ' changes in this cluster and consolidate into the minimum number of actionable tasks.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    var content = response.choices[0].message.content.trim();
    var parsed = JSON.parse(content);
    tasks = parsed.tasks || [parsed];
  } catch (err) {
    console.error('[' + AGENT_NAME + '] LLM alert-task generation failed:', err.message);
    tasks = [{
      title: 'Review and remediate ' + group.alerts.length + ' ' + (group.category || '') + ' regulatory change(s)',
      description: 'Address the following ' + group.maxSeverity + '-impact changes for ' + group.department + ':\n' + group.alerts.map(function(a) { return '- ' + a.title; }).join('\n'),
      alert_indices: group.alerts.map(function(_, i) { return i + 1; })
    }];
  }

  // Use earliest explicit deadline across the cluster, else severity-based
  var explicitDeadlines = group.alerts.map(function(a) { return a.explicit_deadline; }).filter(Boolean);
  var clusterDeadline = explicitDeadlines.length > 0 ? explicitDeadlines.sort()[0] : calculateDeadline(group.maxSeverity);

  for (var task of tasks) {
    var taskDeadline = clusterDeadline;
    if (task.suggested_deadline && task.suggested_deadline !== 'null') {
      var d = new Date(task.suggested_deadline);
      if (!isNaN(d.getTime())) taskDeadline = task.suggested_deadline;
    }

    var fullDescription = '[Auto-generated | Category: ' + (group.category || 'N/A') + ' | Severity: ' + group.maxSeverity + ']\n\n' + (task.description || '');

    try {
      var [result] = await pool.query(
        'INSERT INTO tasks (department, title, description, deadline) VALUES (?, ?, ?, ?)',
        [group.department, (task.title || '').substring(0, 255), fullDescription, taskDeadline]
      );
      var taskId = result.insertId;

      var indices = task.alert_indices || group.alerts.map(function(_, i) { return i + 1; });
      var linkedCount = 0;
      for (var idx of indices) {
        var alertObj = group.alerts[idx - 1];
        if (alertObj && alertObj.change_id) {
          var [alertRows] = await pool.query('SELECT alert_id FROM alerts WHERE change_id = ? LIMIT 1', [alertObj.change_id]);
          if (alertRows.length > 0) {
            await pool.query('INSERT IGNORE INTO task_alerts (task_id, alert_id) VALUES (?, ?)', [taskId, alertRows[0].alert_id]);
            linkedCount++;
          }
        }
      }

      await logAudit(1, 'TASK_AUTO_CREATED', 'tasks', taskId,
        AGENT_NAME + ': [' + (group.category || 'N/A') + '] ' + group.department + ' — ' + (task.title || '').substring(0, 80) + ' (' + linkedCount + ' change(s) linked)');

      console.log('[' + AGENT_NAME + '] ✓ Task → ' + group.department + ' | [' + (group.category || '') + '] | ' + linkedCount + ' change(s) | "' + (task.title || '').substring(0, 60) + '"');

    } catch (err) {
      console.error('[' + AGENT_NAME + '] Failed to create alert task:', err.message);
    }
  }

  console.log('[' + AGENT_NAME + '] Created', tasks.length, 'task(s) for [' + (group.category || '') + '] ' + group.department + ' covering ' + group.alerts.length + ' change(s)');
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');
  console.log('[' + AGENT_NAME + '] Department mappings loaded:', Object.keys(DEPARTMENT_MAPPING).length, 'categories');
  console.log('[' + AGENT_NAME + '] Buffer delay:', BUFFER_DELAY + 'ms (groups related gaps before dispatching)');

  eventBus.on('alert.created', function(data) {
    handleAlert(data);
  });

  eventBus.on('gap.created', function(data) {
    handleGap(data);
  });

  console.log('[' + AGENT_NAME + '] Listening for alert.created, gap.created');
}

module.exports = { start, getDepartmentForCategory, DEPARTMENT_MAPPING, DEADLINE_RULES, processBufferedGaps, processBufferedAlerts };
