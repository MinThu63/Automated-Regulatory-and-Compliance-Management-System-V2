const eventBus = require('./eventBus');
const pool = require('../db');
const OpenAI = require('openai');
const { retrieveRelevantChunks } = require('../services/ragEngine');
const { piiGuard } = require('../services/piiFilter');
const logAudit = require('../middleware/auditLog');

// =============================================
// IMPACT ASSESSMENT AGENT (Assessor)
// Responsibility: Assess impact of new/updated regulations using RAG + LLM
// Listens to: regulation.new, regulation.updated
// Emits: alert.created, impact.assessed
//
// Agentic Enhancements:
//   1. Multi-role prompt structure (system/developer/user/tool)
//   2. Three-step reasoning: classify → assess → verify
//   3. Deadline extraction from regulation text
//   4. Standardised affected_areas vocabulary
//   5. Change-type detection (New Requirement vs Clarification vs Amended Threshold)
//   6. Confidence scoring — stored in audit log + flagged in semantic diff
//   7. Reasoning stored in audit trail
//   8. Historical context for consistency
// =============================================

const AGENT_NAME = 'ImpactAgent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// ALLOWED AFFECTED AREAS VOCABULARY
// Standardised set — LLM must pick from these only.
// Prevents free-form noise like "general banking" or "operations".
// =============================================
const AFFECTED_AREAS_VOCAB = [
  'AML Screening', 'KYC / CDD', 'Enhanced Due Diligence', 'Transaction Monitoring',
  'Suspicious Transaction Reporting', 'Sanctions Screening', 'Wire Transfers',
  'Record Keeping', 'Customer Onboarding', 'UBO Identification',
  'Credit Risk', 'Liquidity Risk', 'Capital Adequacy',
  'Cybersecurity', 'Technology Risk', 'Incident Response',
  'Data Privacy', 'PDPA Compliance',
  'ESG / Green Finance', 'Governance', 'Board Oversight',
  'Wholesale Banking Operations', 'Regulatory Reporting'
];

// =============================================
// PROMPT STRUCTURE
// =============================================

const SYSTEM_PROMPT = `You are a senior compliance assessment agent at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank in Singapore serving MSMEs. Your sole purpose is to evaluate regulatory changes and produce structured, accurate impact assessments that GLDB compliance officers will act on directly.

GLDB context:
- Licensed by MAS as a Digital Wholesale Bank (DWB) — non-retail only
- Core products: MSME loans, supply chain finance, FX
- Primary regulators: MAS (binding), FATF (via MAS adoption), BIS Basel standards (via MAS)
- Secondary regulators: FinCEN, ECB, FCA — only relevant if explicitly referenced by MAS or FATF
- Internal policies: AML/CFT, KYC Onboarding, Transaction Monitoring, Data Privacy (PDPA), Green Finance, Credit & Liquidity Risk, Cybersecurity & TRM, Wholesale Banking Operations

Be precise, conservative, and consistent. Always output valid JSON.`;

const DEVELOPER_RULES = `Strict rules — follow every one:

SCORING RULES:
1. Critical — ONLY if the regulation contains ALL THREE: (a) explicit MAS enforcement action or penalty, (b) a stated compliance deadline for Singapore banks, (c) a NEW requirement GLDB does not currently meet.
2. High — Direct new or amended requirement from MAS or FATF that changes what GLDB must DO or HAVE (new CDD procedure, new reporting obligation, amended threshold). Not merely a clarification.
3. Medium — Clarification, guidance update, or international standard (FinCEN/ECB/FCA) not yet adopted by MAS. GLDB should monitor but no immediate action required.
4. Low — Informational notice, consultation paper, industry guidance with no binding force, or a change GLDB already fully complies with.

DOWNGRADE RULES:
5. If retrieved policy context shows GLDB already has a procedure covering this requirement → downgrade one level.
6. If the change is a restatement of existing law with no new obligation → score Low regardless of source.
7. FinCEN, ECB, FCA regulations → start at Medium unless MAS or FATF explicitly references them.

AFFECTED AREAS:
8. Only use areas from this exact list — pick 1 to 4 maximum:
${AFFECTED_AREAS_VOCAB.join(', ')}

CHANGE TYPE:
9. Classify the change as exactly one of:
   - "New Requirement" — something GLDB must now do that wasn't required before
   - "Amended Threshold" — existing rule with a changed number, date, or limit
   - "Clarification" — existing rule restated more clearly, no new obligation
   - "Revocation" — a previous requirement removed or replaced

DEADLINE EXTRACTION:
10. Scan the regulation content carefully for any date mentioned as a compliance deadline (e.g. "with effect from", "by [date]", "no later than", "effective [date]"). If found, extract it as YYYY-MM-DD. If none, return null.

PENALTY DETECTION & PRIORITIZATION:
11. Scan for ANY mention of penalties, fines, enforcement actions, sanctions, license revocation, or monetary consequences. Look for keywords: "penalty", "fine", "not exceeding", "enforcement", "revocation", "suspension", "SGD", "imprisonment", "contravention", "non-compliance", "breach".
12. If penalties are detected AND a deadline exists → this is PENALTY-LINKED. It MUST be scored Critical. No downgrade allowed. Flag it clearly in reasoning with "PENALTY-LINKED: [quote the penalty clause]".
13. If penalties are mentioned but no deadline → score High minimum. Include the penalty reference in reasoning.

CONFIDENCE:
14. Score 0.9-1.0 only if you are certain of applicability and have strong policy context.
    Score 0.7-0.8 for reasonably clear cases.
    Score 0.5-0.6 if uncertain about applicability or policy coverage.
    Score below 0.5 if you are guessing — prefer Medium in that case.`;

const STEP1_CLASSIFY = `STEP 1 — Classify this regulatory update before scoring it.

Regulation:
Title: {title}
Source: {source}
Category: {category}
Content: {content}

Answer these questions briefly (plain text, not JSON):
A. Is this regulation binding on Singapore-licensed banks? (Yes / No / Conditional)
B. What type of change is this? (New Requirement / Amended Threshold / Clarification / Revocation)
C. Is there a specific compliance deadline stated in the text? If yes, quote it exactly.
D. Which GLDB operations does this most directly affect?
E. Does the retrieved policy context suggest GLDB already complies?
F. Are there ANY penalties, fines, or enforcement consequences mentioned? If yes, quote the penalty clause exactly (e.g. "fine not exceeding SGD 1,000,000"). This is critical for prioritization.`;

const STEP2_ASSESS = `STEP 2 — Using your classification above and the policy context provided, produce your initial impact assessment.

Output JSON only:
{"impact_score": "Critical|High|Medium|Low", "confidence": 0.0-1.0, "change_type": "New Requirement|Amended Threshold|Clarification|Revocation", "affected_areas": ["pick from allowed list only"], "explicit_deadline": "YYYY-MM-DD or null", "penalty_linked": true|false, "reasoning": "one precise sentence explaining the score — if penalty-linked, start with PENALTY-LINKED and quote the penalty"}`;

const STEP3_VERIFY = `STEP 3 — Self-verification. Review your assessment critically.

Check each point:
1. Did I apply the scoring rules correctly? (Critical requires ALL THREE criteria — penalty + deadline + new requirement)
2. Did I apply any applicable downgrade rules?
3. Are my affected_areas from the allowed vocabulary only?
4. Is my deadline extracted correctly (YYYY-MM-DD), or should it be null?
5. Is my change_type accurate?
6. Am I consistent with recent assessment history shown to me?
7. PENALTY CHECK: If I detected penalties + deadline, is this scored Critical? If penalties exist without deadline, is it at least High? penalty_linked must be true if any penalty/fine/enforcement is mentioned.

If anything needs correction, fix it. Output your FINAL assessment as JSON:
{"impact_score": "Critical|High|Medium|Low", "confidence": 0.0-1.0, "change_type": "New Requirement|Amended Threshold|Clarification|Revocation", "affected_areas": ["from allowed list only"], "explicit_deadline": "YYYY-MM-DD or null", "penalty_linked": true|false, "reasoning": "one precise sentence", "revised": true|false, "revision_reason": "what you changed and why, or null"}`;

// =============================================
// CATEGORY → DEPARTMENT MAPPING
// =============================================
const CATEGORY_DEPARTMENT_MAP = {
  'AML': 'Compliance Operations', 'KYC': 'Compliance Operations', 'AML/CFT': 'Compliance Operations',
  'Banking Supervision': 'Risk Management', 'Capital Requirements': 'Risk Management',
  'Financial Conduct': 'Legal & Compliance', 'Consumer Protection': 'Legal & Compliance',
  'Cyber': 'IT Security', 'TRM': 'IT Security', 'Operational Risk': 'IT Security',
  'Data Privacy': 'Data Protection Office', 'PDPA': 'Data Protection Office',
  'ESG': 'ESG & Green Finance', 'Green Finance': 'ESG & Green Finance',
  'Governance': 'Board Secretariat'
};

function mapCategoryToDepartment(category) {
  if (CATEGORY_DEPARTMENT_MAP[category]) return CATEGORY_DEPARTMENT_MAP[category];
  for (var key in CATEGORY_DEPARTMENT_MAP) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) return CATEGORY_DEPARTMENT_MAP[key];
  }
  return 'Compliance Operations';
}

// =============================================
// RETRIEVE HISTORICAL CONTEXT (last 5 assessments)
// Gives the LLM a consistency anchor
// =============================================
async function getRecentAssessments() {
  try {
    var [rows] = await pool.query(
      `SELECT rc.impact_score, rc.affected_areas, r.title, r.category
       FROM regulation_changes rc JOIN regulations r ON rc.reg_id = r.reg_id
       ORDER BY rc.detected_at DESC LIMIT 5`
    );
    if (rows.length === 0) return '';
    var history = rows.map(function(r) {
      return '- "' + r.title.substring(0, 60) + '" (' + r.category + ') → ' + r.impact_score
        + (r.affected_areas ? ' | Areas: ' + r.affected_areas : '');
    }).join('\n');
    return '\n\nRecent assessments (use for consistency):\n' + history;
  } catch (e) { return ''; }
}

// =============================================
// CORE LOGIC: Three-step assessment
// Step 1: Classify  →  Step 2: Assess  →  Step 3: Verify
// =============================================
async function assessRegulation(data) {
  var startTime = Date.now();
  console.log('[' + AGENT_NAME + '] Assessing:', data.title.substring(0, 60));

  // PII Guard
  var piiCheck = await piiGuard(data.title + ' ' + data.content, 'Impact Assessment: ' + data.title);
  if (!piiCheck.allowed) {
    console.log('[' + AGENT_NAME + '] Blocked by PII filter');
    return;
  }

  // STEP 1: Retrieve relevant policy context from Pinecone (more chunks for better coverage)
  var relevantPolicies = await retrieveRelevantChunks(data.title + ' ' + data.content, 'policy', 5);
  var toolContext = relevantPolicies.length > 0
    ? 'Retrieved GLDB internal policy context (vector store):\n' +
      relevantPolicies.map(function(p, i) { return (i + 1) + '. ' + p.chunk_text.substring(0, 300); }).join('\n')
    : 'No relevant internal policies found in vector store — assume no existing coverage.';

  // STEP 2: Historical context
  var historicalContext = await getRecentAssessments();

  // STEP 3: Source label
  var sourceLabel = data.source_id === 1 ? 'MAS (Singapore — binding)'
    : data.source_id === 2 ? 'FATF (International — adopted by MAS)'
    : data.source_id === 3 ? 'FinCEN (US — not directly binding on GLDB)'
    : data.source_id === 4 ? 'ECB (Europe — not directly binding on GLDB)'
    : data.source_id === 5 ? 'FCA (UK — not directly binding on GLDB)'
    : 'Unknown source';

  // Build content excerpt — include change summary if available for updated regulations
  var contentForAssessment = data.content.substring(0, 2000);
  if (data.change_summary) {
    contentForAssessment = 'CHANGE SUMMARY (what specifically changed):\n' + data.change_summary
      + '\n\nFULL CONTENT:\n' + data.content.substring(0, 1500);
  }

  var step1Msg = STEP1_CLASSIFY
    .replace('{title}', data.title)
    .replace('{source}', sourceLabel)
    .replace('{category}', data.category || 'Unknown')
    .replace('{content}', contentForAssessment);

  var messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: DEVELOPER_RULES + historicalContext },
    { role: 'assistant', content: 'Understood. I will follow all scoring rules, downgrade rules, and use only the allowed affected areas vocabulary.' },
    { role: 'user', content: toolContext },
    { role: 'assistant', content: 'I have reviewed the GLDB internal policy context. I will use this to determine existing coverage and apply downgrade rules where applicable.' },
    { role: 'user', content: step1Msg }
  ];

  try {
    // STEP 1: Classification (free text — deliberate reasoning)
    var step1Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.1,
      max_tokens: 400
    });
    var classification = step1Resp.choices[0].message.content.trim();
    console.log('[' + AGENT_NAME + '] Classification done');

    messages.push({ role: 'assistant', content: classification });
    messages.push({ role: 'user', content: STEP2_ASSESS });

    // STEP 2: Initial assessment (JSON)
    var step2Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });
    var initialAssessment = step2Resp.choices[0].message.content.trim();
    console.log('[' + AGENT_NAME + '] Initial assessment done');

    messages.push({ role: 'assistant', content: initialAssessment });
    messages.push({ role: 'user', content: STEP3_VERIFY });

    // STEP 3: Verification + final output (JSON)
    var step3Resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    });

    var finalResponse = step3Resp.choices[0].message.content.trim();
    var duration = Date.now() - startTime;

    finalResponse = finalResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    var parsed = JSON.parse(finalResponse);

    // Validate and sanitise
    var validScores = ['Critical', 'High', 'Medium', 'Low'];
    var impactScore = validScores.includes(parsed.impact_score) ? parsed.impact_score : 'Medium';
    var confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;

    // Sanitise affected_areas — keep only items in the allowed vocabulary
    var rawAreas = Array.isArray(parsed.affected_areas) ? parsed.affected_areas : [];
    var sanitisedAreas = rawAreas.filter(function(a) {
      return AFFECTED_AREAS_VOCAB.some(function(v) { return v.toLowerCase() === a.toLowerCase(); });
    });
    // If LLM returned nothing valid, fall back to category-based guess
    if (sanitisedAreas.length === 0 && data.category) {
      if (data.category.match(/AML|CFT/i)) sanitisedAreas = ['AML Screening', 'Transaction Monitoring'];
      else if (data.category.match(/KYC/i)) sanitisedAreas = ['KYC / CDD'];
      else if (data.category.match(/Cyber|TRM/i)) sanitisedAreas = ['Cybersecurity', 'Technology Risk'];
      else if (data.category.match(/Data|PDPA/i)) sanitisedAreas = ['Data Privacy', 'PDPA Compliance'];
      else if (data.category.match(/ESG|Green/i)) sanitisedAreas = ['ESG / Green Finance'];
      else if (data.category.match(/Capital|Credit/i)) sanitisedAreas = ['Capital Adequacy', 'Credit Risk'];
    }

    // Validate explicit_deadline
    var explicitDeadline = null;
    if (parsed.explicit_deadline && parsed.explicit_deadline !== 'null') {
      var d = new Date(parsed.explicit_deadline);
      if (!isNaN(d.getTime())) explicitDeadline = parsed.explicit_deadline;
    }

    var changeType = parsed.change_type || 'New Requirement';
    var reasoning = parsed.reasoning || '';

    console.log('[' + AGENT_NAME + '] Final →',
      'Impact:', impactScore,
      '| Confidence:', confidence,
      '| Type:', changeType,
      '| Revised:', parsed.revised || false,
      '| Deadline:', explicitDeadline || 'none',
      '| Areas:', sanitisedAreas.join(', ')
    );

    if (confidence < 0.6) {
      console.log('[' + AGENT_NAME + '] ⚠ Low confidence (' + confidence + ') — defaulting to Medium if scored higher');
      if (impactScore === 'Critical' || impactScore === 'High') {
        impactScore = 'Medium';
        console.log('[' + AGENT_NAME + '] Downgraded to Medium due to low confidence');
      }
    }

    await recordAssessment(data, impactScore, confidence, {
      affected_areas: sanitisedAreas,
      explicit_deadline: explicitDeadline,
      reasoning: reasoning,
      change_type: changeType,
      revised: parsed.revised || false,
      revision_reason: parsed.revision_reason || null
    }, duration, relevantPolicies.length);

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Assessment failed:', err.message);
  }
}

// =============================================
// RECORD ASSESSMENT — Save to DB + emit events
// =============================================
async function recordAssessment(data, impactScore, confidence, parsed, duration, chunksRetrieved) {
  try {
    // semantic_differences = clean human-readable summary only.
    // For updated regulations: use the scraper's change_summary (real diff).
    // For new regulations: use the LLM's reasoning (what this regulation requires).
    // Never dump raw content, URLs, or internal agent notes into this field.
    var semanticDiff;
    if (data.change_summary) {
      // Real diff from scraper — clean and use directly
      semanticDiff = data.change_summary;
    } else if (parsed.reasoning) {
      // New regulation — use the assessor's reasoning as the summary
      semanticDiff = parsed.reasoning;
    } else {
      // Absolute fallback — just the title
      semanticDiff = 'New regulation: ' + data.title;
    }

    // Prepend change type label cleanly
    if (parsed.change_type) {
      semanticDiff = '[' + parsed.change_type + '] ' + semanticDiff;
    }

    var previousVersion = data.previous_version || 0.0;
    var newVersion = data.new_version || data.version || 1.0;
    var affectedAreas = parsed.affected_areas.join(', ') || null;
    var changeDiffJson = data.change_diff ? JSON.stringify(data.change_diff) : null;
    var oldContent = data.old_content || null;
    var newContent = data.new_content || data.content || null;

    await pool.query(
      `INSERT INTO regulation_changes 
       (reg_id, previous_version, new_version, semantic_differences, impact_score, explicit_deadline, affected_areas, change_diff, old_content, new_content) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.reg_id, previousVersion, newVersion, semanticDiff, impactScore, parsed.explicit_deadline, affectedAreas, changeDiffJson, oldContent, newContent]
    );

    var [changeRows] = await pool.query('SELECT LAST_INSERT_ID() AS change_id');
    var changeId = changeRows[0].change_id;

    // Map impact to alert severity
    var severityLevel = impactScore === 'Critical' || impactScore === 'High'
      ? 'Immediate Action Required'
      : impactScore === 'Medium' ? 'Review Recommended' : 'Informational';
    var department = mapCategoryToDepartment(data.category);

    await pool.query(
      'INSERT INTO alerts (reg_id, change_id, severity_level, department) VALUES (?, ?, ?, ?)',
      [data.reg_id, changeId, severityLevel, department]
    );

    // Emit events
    eventBus.emit('impact.assessed', {
      reg_id: data.reg_id, title: data.title, impact_score: impactScore,
      confidence: confidence, change_id: changeId, category: data.category,
      change_type: parsed.change_type
    });

    // Critical or penalty-linked → dispatcher bypasses buffer and acts immediately
    var isPenaltyLinked = !!parsed.explicit_deadline || impactScore === 'Critical';

    eventBus.emit('alert.created', {
      reg_id: data.reg_id, title: data.title, severity: severityLevel,
      impact_score: impactScore, confidence: confidence, change_id: changeId,
      category: data.category, department: department,
      semantic_differences: semanticDiff, explicit_deadline: parsed.explicit_deadline,
      priority: isPenaltyLinked
    });

    // Full audit log — includes reasoning, revision, confidence, change type
    await logAudit(1, 'IMPACT_ASSESSED', 'regulations', data.reg_id,
      JSON.stringify({
        agent: AGENT_NAME,
        model: OPENAI_MODEL,
        impact: impactScore,
        confidence: confidence,
        change_type: parsed.change_type,
        reasoning: parsed.reasoning,
        revised: parsed.revised,
        revision_reason: parsed.revision_reason,
        affected_areas: parsed.affected_areas,
        explicit_deadline: parsed.explicit_deadline,
        duration_ms: duration,
        chunks_retrieved: chunksRetrieved
      })
    );

  } catch (err) {
    console.error('[' + AGENT_NAME + '] Record failed:', err.message);
  }
}

// =============================================
// AGENT INITIALIZATION
// =============================================
function start() {
  console.log('[' + AGENT_NAME + '] Initializing...');
  console.log('[' + AGENT_NAME + '] Model:', OPENAI_MODEL);
  console.log('[' + AGENT_NAME + '] Allowed affected areas:', AFFECTED_AREAS_VOCAB.length, 'terms');

  eventBus.on('regulation.new', function(data) {
    assessRegulation(data);
  });

  eventBus.on('regulation.updated', function(data) {
    assessRegulation(data);
  });

  console.log('[' + AGENT_NAME + '] Listening for regulation.new, regulation.updated');
}

module.exports = { start, assessRegulation };
