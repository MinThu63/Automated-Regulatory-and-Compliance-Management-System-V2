const eventBus = require('./eventBus');
const pool = require('../db');
const OpenAI = require('openai');
const { retrieveRelevantChunks } = require('../services/ragEngine');
const { piiGuard } = require('../services/piiFilter');
const logAudit = require('../middleware/auditLog');

// =============================================
// GAP ANALYSIS AGENT (Analyzer)
// Responsibility: Compare CLUSTERS of regulations against relevant policies
// Listens to: regulation.new, regulation.updated
// Emits: gap.created
//
// Strategy: Category-based cluster analysis
//   Instead of comparing every regulation 1-to-1 against every policy,
//   group regulations by category and compare each cluster against
//   only the relevant policies for that category.
//
// Agentic Enhancements:
//   1. Multi-role prompt structure (system/developer/user/tool)
//   2. Multi-step reasoning (extract requirements → compare → verify)
//   3. Self-verification (reflection step)
//   4. Confidence scoring per gap
//   5. Cluster-based analysis (not 1-to-1)
// =============================================

const AGENT_NAME = 'GapAnalysisAgent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// CATEGORY → POLICY MAPPING
// Which policies are relevant for each regulation category
// =============================================

// Policy selection is now AI-powered — no hardcoded mapping needed

// =============================================
// PROMPT STRUCTURE
// =============================================

const SYSTEM_PROMPT = `You are a compliance gap analysis agent at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore. Your role is to compare a CLUSTER of related regulations against the bank's internal policies and identify compliance gaps. Be precise and avoid duplicates. Always output valid JSON.`;

const DEVELOPER_RULES = `Rules you MUST follow:
1. You are analyzing a CLUSTER of regulations from the same category — treat them as a combined set of requirements.
2. Only flag a gap if the regulations EXPLICITLY require something the policies do not cover.
3. Do NOT flag the same gap multiple times even if multiple regulations mention it.
4. Severity: Critical = penalty/license risk, High = operational change needed, Medium = review needed, Low = minor wording gap.
5. Each gap must have a specific, actionable recommendation.
6. Include confidence score per gap (0.0 to 1.0).
7. Maximum 7 gaps per cluster analysis — focus on the most significant, unique ones.
8. If policies already cover a requirement in different wording, do NOT flag it.
9. Classify every gap with a gap_type from this list:
   - "Missing Procedure": the policy says NOTHING about this requirement — no procedure exists at all.
   - "Outdated Procedure": the policy DOES address this topic, but a regulation was recently
     updated (see VERSION CHANGE HISTORY below, if provided) and the policy still reflects
     the OLD requirement — it has not been revised to match the new/updated regulation.
   - "Insufficient Detail": the policy mentions the topic but lacks the specific steps, thresholds, or timelines the regulation requires.
   - "Missing Control": the policy exists but lacks a required control mechanism (e.g., no escalation path, no approval workflow, no monitoring frequency defined).
   - "Non-Compliant Threshold": the policy specifies a threshold or limit that differs from what the regulation now requires (e.g., policy says 15 days but regulation says 5 days).
10. If VERSION CHANGE HISTORY is provided, prioritize checking whether existing policy text
    matches the NEW requirement or still reflects the PREVIOUS one. Cite the version change
    (e.g. "v1.0 → v1.1") in the gap description when this is the case.`;

const STEP1_EXTRACT = `STEP 1: From the following CLUSTER of regulations in the same category, extract ALL unique compliance requirements. Combine and deduplicate — if multiple regulations say the same thing, list it only once.

REGULATION CLUSTER ({category}):
{reg_summaries}
{version_history}

List each unique requirement as a bullet point. Only ACTIONABLE requirements (things a bank must DO or HAVE). If VERSION CHANGE HISTORY is shown above, note which requirements are NEW or CHANGED as a result of that update.`;

const STEP2_COMPARE = `STEP 2: Now compare each requirement against these internal policies. Flag requirements NOT adequately covered, or covered only by an OUTDATED version of the procedure.

INTERNAL POLICIES:
{policy_summaries}

Output ONLY a JSON object:
{"has_gaps": true|false, "gaps": [{"description": "specific gap", "gap_type": "Missing Procedure|Outdated Procedure|Insufficient Detail|Missing Control|Non-Compliant Threshold", "severity": "Critical|High|Medium|Low", "confidence": 0.0-1.0, "requirement": "which requirement is not met", "recommendation": "specific action to close this gap", "source_regulations": ["which regulations require this"]}], "summary": "one sentence overall assessment", "compliance_score": 0-100}`;

const VERIFICATION_PROMPT = `Review your gap analysis. For each gap:
1. Is this TRULY required by the regulations, or are you inferring?
2. Do the policies already cover this in different wording?
3. Is this a DUPLICATE of another gap you listed?
4. Is the recommendation specific and actionable?
5. Is the gap_type correct? Choose the most specific type:
   - "Missing Procedure" = policy says nothing on the topic
   - "Outdated Procedure" = policy addresses topic but reflects prior regulation version
   - "Insufficient Detail" = policy mentions topic but lacks required specifics
   - "Missing Control" = policy exists but lacks a required control mechanism
   - "Non-Compliant Threshold" = policy has a value/limit that differs from regulation

Remove duplicates and weak gaps. Output FINAL revised JSON.`;

// =============================================
// GET RELEVANT POLICIES — AI-powered selection
// No hardcoded mapping. LLM reads regulation content
// and picks which internal policies are relevant.
// =============================================

async function getRelevantPolicies(category, regulationContent) {
  var [allPolicies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies');
  if (allPolicies.length === 0) return [];

  try {
    var policyList = allPolicies.map(function(p, i) {
      return (i + 1) + '. [id=' + p.policy_id + '] ' + p.policy_name;
    }).join('\n');

    var regContext = (regulationContent || category || '').substring(0, 500);

    var resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a compliance analyst at GLDB bank. Given a regulation and its content, select which internal policies are most relevant for gap comparison. Pick 2-5 policies. Return JSON only.' },
        { role: 'user', content: 'Regulation category: ' + category + '\nContent excerpt: ' + regContext + '\n\nAvailable policies:\n' + policyList + '\n\nReturn JSON: {"policy_ids": [1, 2, 3]} — pick 2-5 most relevant policy IDs.' }
      ],
      temperature: 0.1,
      max_tokens: 80,
      response_format: { type: 'json_object' }
    });

    var parsed = JSON.parse(resp.choices[0].message.content.trim());
    var selectedIds = parsed.policy_ids || [];

    if (selectedIds.length === 0) return allPolicies.slice(0, 3);

    var result = allPolicies.filter(function(p) { return selectedIds.includes(p.policy_id); });
    console.log('[' + AGENT_NAME + '] AI selected policies for "' + category + '":', result.map(function(p) { return p.policy_name; }).join(', '));
    return result;
  } catch (e) {
    console.error('[' + AGENT_NAME + '] AI policy selection failed:', e.message);
    return allPolicies.slice(0, 3);
  }
}

// =============================================
// CORE: Cluster-based gap analysis
// =============================================

async function analyzeCluster(category, regulations, policies) {
  var startTime = Date.now();

  console.log('[' + AGENT_NAME + '] Analyzing cluster:', category, '(' + regulations.length + ' regs vs ' + policies.length + ' policies)');

  // Build regulation summaries (combine cluster content)
  var regSummaries = regulations.map(function(r, i) {
    return (i + 1) + '. ' + r.title + ': ' + r.content.substring(0, 300);
  }).join('\n');

  // Build policy summaries
  var policySummaries = policies.map(function(p, i) {
    return (i + 1) + '. ' + p.policy_name + ': ' + p.description.substring(0, 400);
  }).join('\n');

  // Fetch version change history for regulations in this cluster (detects "Outdated Procedure")
  var regIds = regulations.map(function(r) { return r.reg_id; });
  var versionHistoryText = '';
  if (regIds.length > 0) {
    var placeholders = regIds.map(function() { return '?'; }).join(',');
    var [changes] = await pool.query(
      'SELECT rc.reg_id, r.title, rc.previous_version, rc.new_version, rc.semantic_differences FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id WHERE rc.reg_id IN (' + placeholders + ') ORDER BY rc.detected_at DESC',
      regIds
    );
    if (changes.length > 0) {
      versionHistoryText = '\n\nVERSION CHANGE HISTORY (use this to detect Outdated Procedures):\n' +
        changes.map(function(c) {
          return '- ' + c.title + ': v' + c.previous_version + ' → v' + c.new_version + ' — ' + (c.semantic_differences || '').substring(0, 200);
        }).join('\n');
    }
  }

  // PII Guard
  var piiCheck = await piiGuard(regSummaries + policySummaries, 'Cluster analysis: ' + category);
  if (!piiCheck.allowed) return { has_gaps: false, gaps: [], summary: 'Blocked by PII filter' };

  // Retrieve additional context from Pinecone
  var relevantChunks = await retrieveRelevantChunks(category + ' compliance requirements', 'policy', 3);
  var toolContext = '';
  if (relevantChunks.length > 0) {
    toolContext = 'Additional context from vector store:\n' +
      relevantChunks.map(function(c, i) { return (i + 1) + '. ' + c.chunk_text; }).join('\n');
  }

  // Build message chain
  var step1Msg = STEP1_EXTRACT
    .replace('{category}', category)
    .replace('{reg_summaries}', regSummaries.substring(0, 3000))
    .replace('{version_history}', versionHistoryText.substring(0, 1000));
  var step2Msg = STEP2_COMPARE.replace('{policy_summaries}', policySummaries.substring(0, 3000));

  var messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: DEVELOPER_RULES },
    { role: 'assistant', content: 'Understood. I will analyze the regulation cluster and produce deduplicated, high-quality gaps only.' }
  ];

  if (toolContext) {
    messages.push({ role: 'user', content: toolContext });
    messages.push({ role: 'assistant', content: 'I have reviewed the additional context.' });
  }

  try {
    // STEP 1: Extract unique requirements from cluster
    messages.push({ role: 'user', content: step1Msg });
    var step1Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL, messages: messages, temperature: 0.1, max_tokens: 600
    });
    var requirements = step1Resp.choices[0].message.content.trim();
    messages.push({ role: 'assistant', content: requirements });

    // STEP 2: Compare against policies
    messages.push({ role: 'user', content: step2Msg });
    var step2Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL, messages: messages, temperature: 0.2, max_tokens: 800
    });
    var gapResult = step2Resp.choices[0].message.content.trim();
    messages.push({ role: 'assistant', content: gapResult });

    // STEP 3: Self-verification
    messages.push({ role: 'user', content: VERIFICATION_PROMPT });
    var step3Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL, messages: messages, temperature: 0.1, max_tokens: 800,
      response_format: { type: 'json_object' }
    });
    var finalResult = step3Resp.choices[0].message.content.trim();
    var duration = Date.now() - startTime;

    // Clean markdown code blocks if present
    finalResult = finalResult.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    var parsed = JSON.parse(finalResult);

    await logAudit(1, 'LLM_CLUSTER_GAP_ANALYSIS', 'compliance_gaps', 0,
      JSON.stringify({ agent: AGENT_NAME, category: category, regulations: regulations.length, policies: policies.length, gaps_found: parsed.gaps ? parsed.gaps.length : 0, compliance_score: parsed.compliance_score, duration_ms: duration }));

    console.log('[' + AGENT_NAME + '] Cluster "' + category + '":', parsed.has_gaps ? (parsed.gaps ? parsed.gaps.length : 0) + ' gaps' : 'No gaps', '| Score:', parsed.compliance_score || 'N/A');
    return parsed;

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Cluster analysis failed for', category, ':', err.message);
    return { has_gaps: false, gaps: [], summary: 'Analysis failed: ' + err.message, compliance_score: 0 };
  }
}

// =============================================
// FULL CLUSTER ANALYSIS — Analyze all categories
// =============================================

async function analyzeAll() {
  console.log('[' + AGENT_NAME + '] Starting cluster-based gap analysis...');

  // Get all regulations grouped by category
  var [allRegs] = await pool.query('SELECT reg_id, title, content, category FROM regulations WHERE content IS NOT NULL AND LENGTH(content) > 30');

  // Group by category
  var clusters = {};
  allRegs.forEach(function(reg) {
    var cat = reg.category || 'AML';
    if (!clusters[cat]) clusters[cat] = [];
    clusters[cat].push(reg);
  });

  console.log('[' + AGENT_NAME + '] Found', Object.keys(clusters).length, 'regulation clusters:', Object.keys(clusters).join(', '));

  var totalGaps = 0;
  var results = [];

  for (var category in clusters) {
    var regulations = clusters[category];
    var policies = await getRelevantPolicies(category, regulations[0].content);

    if (policies.length === 0) {
      console.log('[' + AGENT_NAME + '] No relevant policies for category:', category, '— skipping');
      continue;
    }

    // Check if we already have gaps for this category cluster
    var policyIds = policies.map(function(p) { return p.policy_id; });
    var regIds = regulations.map(function(r) { return r.reg_id; });

    // Run cluster analysis
    var analysis = await analyzeCluster(category, regulations, policies);

    if (analysis && analysis.has_gaps && analysis.gaps && analysis.gaps.length > 0) {
      // Save gaps — link to first regulation in cluster and first relevant policy
      var primaryRegId = regIds[0];
      var primaryPolicyId = policyIds[0];

      for (var gap of analysis.gaps) {
        var desc = gap.description || '';
        if (gap.gap_type) desc += ' [Type: ' + gap.gap_type + ']';
        if (gap.severity) desc += ' [Severity: ' + gap.severity + ']';
        if (gap.recommendation) desc += ' | Recommendation: ' + gap.recommendation;
        if (gap.source_regulations) desc += ' | Sources: ' + gap.source_regulations.join(', ').substring(0, 100);

        var [insertResult] = await pool.query(
          'INSERT INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES (?, ?, ?)',
          [primaryRegId, primaryPolicyId, desc]
        );

        // Emit gap.created for dispatcher (auto-task creation)
        eventBus.emit('gap.created', {
          gap_id: insertResult.insertId,
          reg_id: primaryRegId,
          policy_id: primaryPolicyId,
          regulation_title: regulations[0].title,
          policy_name: policies[0].policy_name,
          description: desc,
          gap_type: gap.gap_type || 'Missing Procedure',
          severity: gap.severity || 'Medium',
          confidence: gap.confidence || 0.5,
          category: category
        });

        totalGaps++;
      }

      results.push({ category: category, regulations: regulations.length, policies: policies.length, gaps_found: analysis.gaps.length, compliance_score: analysis.compliance_score });
    }
  }

  console.log('[' + AGENT_NAME + '] Cluster analysis complete. Total unique gaps:', totalGaps);
  await logAudit(1, 'BULK_CLUSTER_ANALYSIS', 'compliance_gaps', 0, AGENT_NAME + ': ' + totalGaps + ' gaps across ' + results.length + ' clusters');

  return { total_gaps: totalGaps, clusters_analyzed: results.length, details: results };
}

// =============================================
// SINGLE PAIR ANALYSIS (for manual UI trigger)
// =============================================

async function analyzeGap(regId, policyId) {
  var [regs] = await pool.query('SELECT reg_id, title, content, category FROM regulations WHERE reg_id = ?', [regId]);
  var [policies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies WHERE policy_id = ?', [policyId]);

  if (regs.length === 0 || policies.length === 0) {
    return { has_gaps: false, gaps: [], summary: 'Regulation or policy not found' };
  }

  // Use cluster analysis with a single-item cluster
  return analyzeCluster(regs[0].category || 'AML', regs, policies);
}

// =============================================
// HANDLE NEW REGULATION — Analyze its category cluster
// =============================================

async function handleNewRegulation(data) {
  console.log('[' + AGENT_NAME + '] New regulation in category:', data.category, '—', data.title.substring(0, 50));

  var policies = await getRelevantPolicies(data.category, data.content);
  if (policies.length === 0) return;

  // Get all regulations in this category for cluster analysis
  var [clusterRegs] = await pool.query(
    'SELECT reg_id, title, content, category FROM regulations WHERE category = ? AND LENGTH(content) > 30 LIMIT 10',
    [data.category || 'AML']
  );

  if (clusterRegs.length === 0) return;

  var analysis = await analyzeCluster(data.category, clusterRegs, policies);

  if (analysis && analysis.has_gaps && analysis.gaps) {
    for (var gap of analysis.gaps) {
      var desc = (gap.description || '');
      if (gap.gap_type) desc += ' [Type: ' + gap.gap_type + ']';
      desc += ' [Severity: ' + (gap.severity || 'Medium') + ']';
      if (gap.recommendation) desc += ' | Recommendation: ' + gap.recommendation;

      var [result] = await pool.query(
        'INSERT INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES (?, ?, ?)',
        [data.reg_id, policies[0].policy_id, desc]
      );

      eventBus.emit('gap.created', {
        gap_id: result.insertId,
        reg_id: data.reg_id,
        policy_id: policies[0].policy_id,
        regulation_title: data.title,
        policy_name: policies[0].policy_name,
        description: desc,
        gap_type: gap.gap_type || 'Missing Procedure',
        severity: gap.severity || 'Medium',
        confidence: gap.confidence || 0.5,
        category: data.category
      });
    }
  }
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing (cluster-based analysis)...');

  eventBus.on('regulation.new', function(data) {
    setTimeout(function() { handleNewRegulation(data); }, 3000);
  });

  eventBus.on('regulation.updated', function(data) {
    setTimeout(function() { handleNewRegulation(data); }, 3000);
  });

  console.log('[' + AGENT_NAME + '] Listening for regulation.new, regulation.updated');
}

module.exports = { start, analyzeGap, analyzeAll, analyzeCluster };
