const eventBus = require('./eventBus');
const pool = require('../db');
const OpenAI = require('openai');
const { piiGuard } = require('../services/piiFilter');
const logAudit = require('../middleware/auditLog');

// =============================================
// POLICY ADVISOR AGENT (Advisor)
// Responsibility: Analyze patterns across compliance gaps and propose
//                 new policies or policy updates to close them.
//                 Proposals require human review (accept/reject) before
//                 being applied to the live internal_policies table.
//
// Listens to: gap.created (buffered, analyzed periodically)
// Emits: policy.proposed
// Uses LLM: Yes — to draft policy text and justify the proposal
// =============================================

const AGENT_NAME = 'PolicyAdvisorAgent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// PROMPT STRUCTURE — Harness format
// =============================================

const SYSTEM_PROMPT = `You are a policy advisory agent at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore. Your role is to review compliance gaps and propose specific, well-drafted policy text WITH detailed procedures that employees can follow. You do NOT modify any policy directly — you only draft PROPOSALS for a human compliance officer to review and approve. Always output valid JSON.`;

const DEVELOPER_RULES = `Rules you MUST follow:
1. Only propose a NEW policy if no existing internal policy covers the topic area at all.
2. Only propose a POLICY UPDATE if an existing policy exists but is too generic/vague to meet the regulation's requirements.
3. Proposed policy text must include BOTH:
   (a) Policy statement — what the bank commits to doing
   (b) PROCEDURES — numbered step-by-step actions employees must follow to implement the policy (minimum 3, maximum 6 steps)
4. Each procedure step must be specific and actionable — include who does it, when, and what the deliverable is.
5. Each proposal must cite only the TOP 2-3 most relevant gaps/regulations that justify it — not every related gap.
6. Do not propose duplicate policies for the same topic area.
7. Keep proposed policy descriptions between 150-500 words (including procedures).
8. If the gaps are minor wording issues rather than structural gaps, do NOT propose a new policy — recommend a Policy Update with the smallest necessary change.`;

const PROPOSAL_PROMPT = `Review this cluster of compliance gaps related to {category} and the existing policies below. Determine if GLDB needs a NEW policy or an UPDATE.

COMPLIANCE GAPS (select only the 2-3 most important ones to reference):
{gaps_list}

EXISTING RELEVANT POLICIES:
{existing_policies}

Decide:
1. Existing policy too vague? → Propose an UPDATE with enhanced procedures.
2. No coverage at all? → Propose a NEW policy with full procedures.
3. Gaps too minor? → Return proposals: []

IMPORTANT: The proposed_description MUST include a "PROCEDURES:" section with numbered steps (3-6 steps). Each step format: "Step N — [Title]: [Who] does [what] by [when]. Deliverable: [output]."

Only reference the 2-3 most critical gaps in your reasoning — not all of them.

Respond with ONLY a JSON object:
{"proposals": [{"type": "New Policy|Policy Update", "target_policy_name": "existing policy name if Update, else null", "policy_name": "proposed policy name", "proposed_description": "policy statement + PROCEDURES section with 3-6 numbered steps", "reasoning": "why this is needed, citing 2-3 key gaps/regulations only", "key_gap_indices": [1, 2]}]}

The key_gap_indices field identifies which gap numbers (from the list above) this proposal primarily addresses — maximum 3.`;

const VERIFICATION_PROMPT = `Review your proposal(s) above. For each one, verify:
1. Is the proposed policy text SPECIFIC and actionable, not generic filler?
2. Does it directly address the cited compliance gaps?
3. Is "New Policy" vs "Policy Update" the correct choice given the existing policies shown?

Revise if needed. Output the FINAL proposals in the same JSON format.`;

// =============================================
// GAP BUFFER — Collect gaps by category before analyzing
// =============================================

var gapBuffer = {};
var analysisTimer = null;
var BUFFER_DELAY = 8000;

function handleGap(data) {
  var category = data.category || 'AML';
  if (!gapBuffer[category]) gapBuffer[category] = [];
  gapBuffer[category].push(data);

  if (analysisTimer) clearTimeout(analysisTimer);
  analysisTimer = setTimeout(function() {
    processBufferedCategories();
  }, BUFFER_DELAY);
}

async function processBufferedCategories() {
  var categories = Object.keys(gapBuffer);
  var buffered = gapBuffer;
  gapBuffer = {};

  for (var category of categories) {
    if (buffered[category].length >= 2) { // Only propose if 2+ related gaps exist
      await analyzeAndPropose(category, buffered[category]);
    }
  }
}

// =============================================
// CORE: Analyze gap cluster and generate proposal(s)
// =============================================

async function analyzeAndPropose(category, gaps) {
  console.log('[' + AGENT_NAME + '] Analyzing', gaps.length, 'gaps in category:', category, 'for policy proposals...');

  // Get existing policies (for context — is there already something covering this?)
  var [allPolicies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies');

  var gapsList = gaps.map(function(g, i) {
    var desc = (g.description || '').replace(/\s*\[Severity:.*?\]/g, '').replace(/\s*\| Recommendation:.*$/g, '').trim();
    return (i + 1) + '. ' + desc;
  }).join('\n');

  var existingPoliciesText = allPolicies.map(function(p) {
    return '- ' + p.policy_name + ': ' + p.description.substring(0, 150);
  }).join('\n');

  var piiCheck = await piiGuard(gapsList + existingPoliciesText, 'Policy proposal: ' + category);
  if (!piiCheck.allowed) return;

  var prompt = PROPOSAL_PROMPT
    .replace('{category}', category)
    .replace('{gaps_list}', gapsList.substring(0, 2000))
    .replace('{existing_policies}', existingPoliciesText.substring(0, 2000));

  var messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: DEVELOPER_RULES },
    { role: 'assistant', content: 'Understood. I will only propose New Policy or Policy Update when genuinely justified, with specific actionable text.' },
    { role: 'user', content: prompt }
  ];

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL, messages: messages, temperature: 0.2, max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    var initial = response.choices[0].message.content.trim();
    messages.push({ role: 'assistant', content: initial });
    messages.push({ role: 'user', content: VERIFICATION_PROMPT });

    var verifyResp = await openai.chat.completions.create({
      model: OPENAI_MODEL, messages: messages, temperature: 0.1, max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    var finalContent = verifyResp.choices[0].message.content.trim();
    var parsed = JSON.parse(finalContent);
    var proposals = parsed.proposals || [];

    for (var p of proposals) {
      await saveProposal(p, gaps, allPolicies);
    }

    console.log('[' + AGENT_NAME + '] Generated', proposals.length, 'proposal(s) for', category);

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Failed to generate proposal:', err.message);
  }
}

// =============================================
// SAVE PROPOSAL — Store for human review
// =============================================

async function saveProposal(proposal, gaps, allPolicies) {
  try {
    var targetPolicyId = null;
    if (proposal.type === 'Policy Update' && proposal.target_policy_name) {
      var match = allPolicies.find(function(p) { return p.policy_name === proposal.target_policy_name; });
      if (match) targetPolicyId = match.policy_id;
    }

    // Avoid duplicate pending proposals for the same policy name
    var [existing] = await pool.query(
      "SELECT proposal_id FROM policy_proposals WHERE policy_name = ? AND status = 'Pending'",
      [proposal.policy_name]
    );
    if (existing.length > 0) return;

    var gapIds = '';
    // Use key_gap_indices from LLM if available (max 3), else take first 3
    if (proposal.key_gap_indices && Array.isArray(proposal.key_gap_indices)) {
      gapIds = proposal.key_gap_indices
        .filter(function(idx) { return gaps[idx - 1]; })
        .map(function(idx) { return gaps[idx - 1].gap_id; })
        .slice(0, 3)
        .join(',');
    }
    if (!gapIds) {
      gapIds = gaps.slice(0, 3).map(function(g) { return g.gap_id; }).join(',');
    }

    var [result] = await pool.query(
      `INSERT INTO policy_proposals (proposal_type, target_policy_id, policy_name, proposed_description, reasoning, related_gap_ids)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [proposal.type, targetPolicyId, proposal.policy_name, proposal.proposed_description, proposal.reasoning, gapIds]
    );

    eventBus.emit('policy.proposed', {
      proposal_id: result.insertId,
      type: proposal.type,
      policy_name: proposal.policy_name
    });

    await logAudit(1, 'POLICY_PROPOSED', 'policy_proposals', result.insertId,
      AGENT_NAME + ': ' + proposal.type + ' — ' + proposal.policy_name.substring(0, 80));

    console.log('[' + AGENT_NAME + '] Proposal saved:', proposal.type, '—', proposal.policy_name);

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Failed to save proposal:', err.message);
  }
}

// =============================================
// AGENT INITIALIZATION
// =============================================

function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');
  console.log('[' + AGENT_NAME + '] Buffer delay:', BUFFER_DELAY + 'ms (analyzes gap clusters for policy gaps)');

  eventBus.on('gap.created', function(data) {
    handleGap(data);
  });

  console.log('[' + AGENT_NAME + '] Listening for gap.created');
}

module.exports = { start, analyzeAndPropose };
