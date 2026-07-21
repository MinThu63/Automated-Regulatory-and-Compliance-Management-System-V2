const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const pool = require('../db');
const { piiGuard } = require('./piiFilter');

// =============================================
// RAG Engine — Retrieval-Augmented Generation
// Uses Pinecone as vector database (cloud-hosted)
// Uses OpenAI for embeddings and generation
// =============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Pinecone client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const INDEX_NAME = process.env.PINECONE_INDEX || 'gldb-compliance';

var index = null;

// Namespaces (separate collections in Pinecone)
const REGULATIONS_NS = 'regulations';
const POLICIES_NS = 'policies';

// =============================================
// Initialize Pinecone Connection
// =============================================

async function initPinecone() {
  try {
    index = pinecone.index(INDEX_NAME);
    var stats = await index.describeIndexStats();
    console.log('[RAG] Pinecone connected — Index:', INDEX_NAME);
    console.log('[RAG] Vectors:', stats.totalRecordCount || 0);
    return true;
  } catch (err) {
    console.error('[RAG] Pinecone connection failed:', err.message);
    return false;
  }
}

// =============================================
// 1. TEXT CHUNKING
// =============================================

function chunkText(text, maxChunkSize = 500) {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  var chunks = [];
  var sentences = text.split(/(?<=[.!?])\s+/);
  var currentChunk = '';

  for (var sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// =============================================
// 2. EMBEDDING GENERATION (OpenAI)
// =============================================

async function generateEmbedding(text) {
  try {
    var response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000)
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[RAG] Embedding generation failed:', err.message);
    return null;
  }
}

// =============================================
// 3. EMBED A REGULATION INTO PINECONE
// =============================================

async function embedRegulation(regId, title, content) {
  if (!index) return;
  if (!content || content.trim().length < 10) return;

  console.log('[RAG] Embedding regulation:', title.substring(0, 60));

  var piiCheck = await piiGuard(title + ' ' + content, 'Embedding regulation: ' + title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = title + '. ' + content;
  var chunks = chunkText(fullText);
  var vectors = [];

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      vectors.push({
        id: 'reg_' + regId + '_chunk_' + i,
        values: embedding,
        metadata: { source_id: regId, title: title, chunk_index: i, type: 'regulation', text: chunks[i] }
      });
    }
  }

  if (vectors.length > 0) {
    await index.namespace(REGULATIONS_NS).upsert({ records: vectors });
    console.log('[RAG] Stored', vectors.length, 'chunks for regulation:', title.substring(0, 50));
  }
}

// =============================================
// 4. EMBED A POLICY INTO PINECONE
// =============================================

async function embedPolicy(policyId, policyName, description) {
  if (!index) return;
  if (!description || description.trim().length < 10) return;

  console.log('[RAG] Embedding policy:', policyName.substring(0, 60));

  var piiCheck = await piiGuard(policyName + ' ' + description, 'Embedding policy: ' + policyName);
  if (!piiCheck.allowed) {
    console.log('[RAG] Embedding blocked by PII filter:', piiCheck.reason);
    return;
  }

  var fullText = policyName + '. ' + description;
  var chunks = chunkText(fullText);
  var vectors = [];

  for (var i = 0; i < chunks.length; i++) {
    var embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      vectors.push({
        id: 'pol_' + policyId + '_chunk_' + i,
        values: embedding,
        metadata: { source_id: policyId, policy_name: policyName, chunk_index: i, type: 'policy', text: chunks[i] }
      });
    }
  }

  if (vectors.length > 0) {
    await index.namespace(POLICIES_NS).upsert({ records: vectors });
    console.log('[RAG] Stored', vectors.length, 'chunks for policy:', policyName.substring(0, 50));
  }
}

// =============================================
// 5. RETRIEVE RELEVANT CHUNKS FROM PINECONE
// =============================================

async function retrieveRelevantChunks(query, sourceType, topK = 5) {
  if (!index) return [];

  var queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  var namespace = sourceType === 'regulation' ? REGULATIONS_NS : POLICIES_NS;

  try {
    var results = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true
    });

    if (!results || !results.matches || results.matches.length === 0) return [];

    return results.matches.map(function(match) {
      return {
        chunk_text: match.metadata.text || '',
        metadata: match.metadata,
        score: match.score
      };
    });
  } catch (err) {
    console.error('[RAG] Pinecone query failed:', err.message);
    return [];
  }
}

// =============================================
// 6. RAG-POWERED IMPACT ASSESSMENT
// =============================================

async function assessImpactRAG(item) {
  var startTime = Date.now();

  var piiCheck = await piiGuard(item.title + ' ' + item.content, 'Impact Assessment: ' + item.title);
  if (!piiCheck.allowed) {
    console.log('[RAG] Impact assessment blocked by PII filter:', piiCheck.reason);
    return 'Medium';
  }

  var relevantPolicies = await retrieveRelevantChunks(item.title + ' ' + item.content, 'policy', 3);

  var policyContext = '';
  if (relevantPolicies.length > 0) {
    policyContext = '\n\nRELEVANT GLDB INTERNAL POLICIES (for context):\n' +
      relevantPolicies.map(function(p, i) { return (i + 1) + '. ' + p.chunk_text; }).join('\n');
  }

  var sourceLabel = item.source_id === 1 ? 'MAS (Singapore)' : item.source_id === 2 ? 'FATF (International)' : item.source_id === 3 ? 'FinCEN (US)' : item.source_id === 4 ? 'ECB (Europe)' : 'FCA (UK)';

  var prompt = `You are a regulatory compliance analyst at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank serving MSMEs in Singapore.

Analyze the following regulation and assess its ACTUAL impact on GLDB's daily compliance operations. Be realistic and discriminating — not everything is high impact.

REGULATION:
Title: ${item.title}
Source: ${sourceLabel}
Category: ${item.category}
Content: ${item.content}
${policyContext}

IMPORTANT: Score realistically. Consider:
- Is this regulation DIRECTLY applicable to a Singapore-based Digital Wholesale Bank?
- Does it require GLDB to change its existing processes?
- Is there a deadline or penalty attached?
- Or is this just general guidance/information?

Respond with ONLY a JSON object (no markdown, no explanation):
{"impact_score": "Critical|High|Medium|Low", "reasoning": "one sentence explanation", "affected_areas": ["list of affected compliance areas"]}

Impact scoring criteria (apply strictly):
- Critical: ONLY for regulations with explicit penalties, enforcement deadlines, or license-threatening requirements directly for Singapore banks
- High: Direct AML/CFT requirement changes that specifically affect GLDB's operations
- Medium: Requires review — general guidance updates or regulations from non-Singapore jurisdictions
- Low: Informational only — news articles, general publications, non-binding guidance`;

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    var content = response.choices[0].message.content.trim();
    var duration = Date.now() - startTime;
    var parsed = JSON.parse(content);
    var impactScore = parsed.impact_score;

    var validScores = ['Critical', 'High', 'Medium', 'Low'];
    if (!validScores.includes(impactScore)) impactScore = 'Medium';

    await logLLMCall('IMPACT_ASSESSMENT', prompt, content, item.title, impactScore, duration, relevantPolicies.length);
    console.log('[RAG] Impact assessed:', impactScore, '—', parsed.reasoning || '');
    return impactScore;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Impact assessment failed:', err.message);
    await logLLMCall('IMPACT_ASSESSMENT_ERROR', prompt, 'Error: ' + err.message, item.title, 'Error', duration, 0);
    return 'Medium';
  }
}

// =============================================
// 7. RAG-POWERED GAP ANALYSIS
// =============================================

async function analyzeGapRAG(regId, policyId) {
  var startTime = Date.now();

  var [regs] = await pool.query('SELECT title, content FROM regulations WHERE reg_id = ?', [regId]);
  var [policies] = await pool.query('SELECT policy_name, description FROM internal_policies WHERE policy_id = ?', [policyId]);

  if (regs.length === 0 || policies.length === 0) {
    return { has_gaps: false, gaps: [], summary: 'Regulation or policy not found' };
  }

  var regulation = regs[0];
  var policy = policies[0];

  var regPiiCheck = await piiGuard(regulation.content, 'Gap Analysis (regulation): ' + regulation.title);
  if (!regPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in regulation content.' };
  }

  var polPiiCheck = await piiGuard(policy.description, 'Gap Analysis (policy): ' + policy.policy_name);
  if (!polPiiCheck.allowed) {
    return { has_gaps: false, gaps: [], summary: 'Blocked: PII detected in policy content.' };
  }

  var relevantRegChunks = await retrieveRelevantChunks(policy.policy_name + ' ' + policy.description, 'regulation', 3);
  var relevantPolicyChunks = await retrieveRelevantChunks(regulation.title + ' ' + regulation.content, 'policy', 3);

  var additionalRegContext = '';
  if (relevantRegChunks.length > 0) {
    additionalRegContext = '\n\nADDITIONAL RELATED REGULATIONS:\n' +
      relevantRegChunks.map(function(r, i) { return (i + 1) + '. ' + r.chunk_text; }).join('\n');
  }

  var additionalPolicyContext = '';
  if (relevantPolicyChunks.length > 0) {
    additionalPolicyContext = '\n\nADDITIONAL RELATED POLICIES:\n' +
      relevantPolicyChunks.map(function(p, i) { return (i + 1) + '. ' + p.chunk_text; }).join('\n');
  }

  var prompt = `You are a regulatory compliance analyst at Green Link Digital Bank (GLDB), a MAS-licensed Digital Wholesale Bank.

Compare the following MAS regulation against GLDB's internal policy and identify compliance gaps.

REGULATION:
Title: ${regulation.title}
Content: ${regulation.content}
${additionalRegContext}

INTERNAL POLICY:
Name: ${policy.policy_name}
Content: ${policy.description}
${additionalPolicyContext}

Identify specific areas where the internal policy does NOT adequately address requirements in the regulation.

Respond with ONLY a JSON object (no markdown, no explanation):
{"has_gaps": true|false, "gaps": [{"description": "specific gap description", "severity": "Critical|High|Medium|Low", "recommendation": "what GLDB should do to close this gap"}], "summary": "one sentence overall assessment", "compliance_score": 0-100}`;

  try {
    var response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800
    });

    var content = response.choices[0].message.content.trim();
    var duration = Date.now() - startTime;
    var parsed = JSON.parse(content);

    await logLLMCall('GAP_ANALYSIS', prompt, content, regulation.title + ' vs ' + policy.policy_name,
      parsed.has_gaps ? 'Gaps Found (' + (parsed.gaps ? parsed.gaps.length : 0) + ')' : 'No Gaps',
      duration, relevantRegChunks.length + relevantPolicyChunks.length);

    console.log('[RAG] Gap analysis complete:', parsed.has_gaps ? (parsed.gaps ? parsed.gaps.length : 0) + ' gaps found' : 'No gaps');
    return parsed;

  } catch (err) {
    var duration = Date.now() - startTime;
    console.error('[RAG] Gap analysis failed:', err.message);
    await logLLMCall('GAP_ANALYSIS_ERROR', prompt, 'Error: ' + err.message, regulation.title + ' vs ' + policy.policy_name, 'Error', duration, 0);
    return { has_gaps: false, gaps: [], summary: 'LLM analysis unavailable: ' + err.message, compliance_score: 0 };
  }
}

// =============================================
// 8. LLM AUDIT LOGGING
// =============================================

async function logLLMCall(actionType, inputPrompt, outputResponse, targetDescription, result, durationMs, chunksRetrieved) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES (?, ?, ?, ?, ?)',
      [1, 'LLM_' + actionType, 'regulations', 0, JSON.stringify({
        model: OPENAI_MODEL,
        embedding_model: EMBEDDING_MODEL,
        vector_db: 'Pinecone',
        input: inputPrompt.substring(0, 1500),
        output: outputResponse.substring(0, 1500),
        target: targetDescription,
        result: result,
        chunks_retrieved: chunksRetrieved,
        duration_ms: durationMs,
        timestamp: new Date().toISOString()
      })]
    );
  } catch (err) {
    console.error('[RAG Audit] Failed to log:', err.message);
  }
}

// =============================================
// 9. EMBED ALL EXISTING DATA (initialization)
// =============================================

async function embedAllExistingData() {
  var ready = await initPinecone();
  if (!ready) {
    console.error('[RAG] Cannot embed data — Pinecone not connected');
    return;
  }

  console.log('[RAG] Embedding all existing regulations and policies into Pinecone...');

  var [regulations] = await pool.query('SELECT reg_id, title, content FROM regulations');
  console.log('[RAG] Found', regulations.length, 'regulations to embed');
  for (var reg of regulations) {
    try { await embedRegulation(reg.reg_id, reg.title, reg.content); } catch (e) { /* skip */ }
  }

  var [policies] = await pool.query('SELECT policy_id, policy_name, description FROM internal_policies');
  console.log('[RAG] Found', policies.length, 'policies to embed');
  for (var pol of policies) {
    try { await embedPolicy(pol.policy_id, pol.policy_name, pol.description); } catch (e) { /* skip */ }
  }

  console.log('[RAG] Embedding complete. Pinecone vector store ready.');
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
  initPinecone,
  chunkText,
  generateEmbedding,
  embedRegulation,
  embedPolicy,
  retrieveRelevantChunks,
  assessImpactRAG,
  analyzeGapRAG,
  embedAllExistingData
};
