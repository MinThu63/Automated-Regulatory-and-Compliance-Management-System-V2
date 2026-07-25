# Phase 2 Proposal: Agentic Compliance System

## Automated Regulatory Monitoring & Compliance Management System
### Multi-Agent Architecture (ADK Framework)

**Team:** SOI-2026-0039  
**Lead Developer:** Min Thu  
**Date:** June 2026

---

## 1. Executive Summary

This proposal outlines the evolution of our current regulatory compliance POC into a multi-agent (agentic) system. The current system operates as a linear pipeline — scrape, assess, alert, done. The proposed system introduces autonomous agents that reason, plan, coordinate, and act with minimal human intervention.

**Current state:** Working POC with RAG pipeline, auto-scraping, LLM impact assessment, 9-view dashboard.

**Proposed evolution:** 6 specialized agents orchestrated via an ADK (Agent Development Kit) framework, with human-in-the-loop approval for all final decisions.

---

## 2. Motivation

- Agentic AI is the fastest-growing area in applied AI research (2024-2026)
- Current system still requires significant human effort (manual task creation, manual gap analysis triggers, manual report generation)
- Industry leaders (Goldman Sachs, JPMorgan, HSBC) are actively piloting agentic compliance systems
- Opportunity for novel academic contribution — multi-agent regulatory compliance is under-researched

---

## 3. Architecture Overview

### 3.1 Agents

| Agent | Role | Capabilities |
|-------|------|-------------|
| **Orchestrator** | Master coordinator | Receives goals, plans steps, routes to specialists, manages state |
| **Monitoring Agent** | Regulatory watcher | Scrapes MAS, detects changes, triggers pipeline |
| **Analysis Agent** | Impact assessor | Uses RAG + LLM to score regulation impact on GLDB |
| **Compliance Agent** | Gap identifier | Compares regulations against policies, identifies non-compliance |
| **Task Agent** | Work assigner | Auto-creates tasks, checks workload, sets deadlines |
| **Reporting Agent** | Summary generator | Drafts executive summaries, decides escalation level |
| **Guardrail Agent** | Safety enforcer | PII scan, hallucination check, boundary enforcement, audit logging |

### 3.2 How Agents Differ from Current Services

| Current (feedIntegrator.js) | Agentic (monitoringAgent.js) |
|---|---|
| Runs on fixed cron schedule | Decides when to check based on risk level |
| Hardcoded scraping logic | Adapts if site structure changes |
| No reasoning — just executes | Plans: "What should I look for? Is this relevant?" |
| No memory of past runs | Remembers what it processed before |
| Fails silently | Retries, tries alternatives, or escalates |

---

## 4. ADK File Structure

```
.
├── server.js                              # Express app + agent trigger endpoints
├── db.js                                  # MySQL connection pool
├── schema.sql                             # Database schema
├── .env                                   # Secrets
├── package.json
│
├── agents/                                # AGENT DEFINITIONS
│   ├── baseAgent.js                       # Abstract base class (loads global rules)
│   ├── orchestrator.js                    # Master — receives goals, plans, delegates
│   ├── monitoringAgent.js                 # Watches MAS, triggers on change
│   ├── analysisAgent.js                   # Impact assessment reasoning
│   ├── complianceAgent.js                 # Gap identification & remediation
│   ├── taskAgent.js                       # Auto-assignment & deadline mgmt
│   ├── reportingAgent.js                  # Executive summaries & escalation
│   └── guardrailAgent.js                  # PII, hallucination, boundary enforcement
│
├── reasoning/                             # REASONING STRATEGIES (reusable)
│   ├── chainOfThought.js                 # Step-by-step before answer
│   ├── reflectionLoop.js                 # Generate → review → improve
│   ├── planAndExecute.js                 # Break goal into sub-tasks
│   ├── reActLoop.js                      # Reason → Act → Observe → Repeat
│   ├── selfCritique.js                   # Critique own answer
│   ├── multiPerspective.js              # Evaluate from legal/ops/risk angles
│   └── confidenceScoring.js             # Rate confidence, escalate if low
│
├── tools/                                 # SINGLE-PURPOSE TOOLS
│   ├── scraper.js                         # axios + cheerio
│   ├── embeddingTool.js                   # OpenAI embeddings
│   ├── vectorSearchTool.js               # Chroma cosine similarity
│   ├── llmTool.js                         # GPT-4o-mini call wrapper
│   ├── databaseTool.js                   # MySQL read/write
│   ├── piiScannerTool.js                 # Regex PII detection
│   ├── alertGeneratorTool.js             # Create alerts with severity
│   └── notificationTool.js              # Push to human approval queue
│
├── skills/                                # COMPOSED WORKFLOWS (tools + reasoning)
│   ├── impactAssessment.js               # chainOfThought + vectorSearch + llm + confidence
│   ├── gapAnalysis.js                    # multiPerspective + vectorSearch + selfCritique
│   ├── changeDetection.js               # planAndExecute + scraper + database
│   ├── taskAssignment.js                # reActLoop + database + workload check
│   └── executiveSummary.js              # reflectionLoop + database + llm
│
├── protocol/                              # AGENT COMMUNICATION
│   ├── messageSchema.js                  # Standard message format
│   ├── messageRouter.js                  # Routes messages between agents
│   ├── messageQueue.js                   # Async message queue (agent inbox)
│   └── eventBus.js                       # Pub/sub for agent events
│
├── memory/                                # PERSISTENT STATE
│   ├── conversationStore.js              # Agent-to-agent message history
│   ├── decisionLog.js                    # Full reasoning chains
│   ├── contextWindow.js                  # Working memory per agent
│   ├── regulationTracker.js             # Which regs have been processed
│   └── sessionManager.js                # Agent lifecycle state machine
│
├── guardrails/                            # SAFETY BOUNDARIES
│   ├── escalationPolicy.js              # When to escalate to human
│   ├── permissionMatrix.js              # What each agent CAN and CANNOT do
│   ├── tokenBudget.js                   # Max tokens per agent per task
│   ├── rateLimiter.js                   # Prevent runaway LLM calls
│   ├── hallucinationDetector.js         # Cross-check output against source
│   └── boundaryRules.js                 # Hard limits
│
├── observability/                         # TRACING & MONITORING
│   ├── agentTracer.js                    # Trace full execution path
│   ├── reasoningLogger.js               # Log reasoning steps
│   ├── performanceMetrics.js            # Latency, token usage, success rate
│   ├── errorTracker.js                  # Failures with context
│   └── dashboardFeed.js                 # Real-time agent activity to frontend
│
├── config/                                # CONFIGURATION
│   ├── globalRules.js                    # Universal rules ALL agents must follow
│   ├── agentPrompts.js                   # System prompts per agent role
│   ├── toolRegistry.js                   # Which tools each agent can access
│   ├── reasoningRegistry.js             # Which reasoning each agent can use
│   ├── workflowDefinitions.js           # Goal → agent routing rules
│   ├── escalationThresholds.js          # Confidence thresholds
│   └── agentVersions.js                 # Prompt versioning & A/B testing
│
├── tests/                                 # TEST SUITE
│   ├── unit/
│   │   ├── tools.test.js
│   │   ├── reasoning.test.js
│   │   └── guardrails.test.js
│   ├── integration/
│   │   ├── skills.test.js
│   │   └── agentFlow.test.js
│   ├── scenarios/
│   │   ├── newRegulation.scenario.js
│   │   ├── versionChange.scenario.js
│   │   └── escalation.scenario.js
│   └── mocks/
│       ├── llmResponses.json
│       └── masPages.html
│
├── routes/                                # API ENDPOINTS (existing + new)
│   ├── auth.js
│   ├── alerts.js
│   ├── dashboard.js
│   ├── regulations.js
│   ├── changes.js
│   ├── tasks.js
│   ├── gaps.js
│   ├── sources.js
│   ├── policies.js
│   ├── audit.js
│   └── agentAPI.js                       # NEW: trigger/monitor/approve agents
│
├── middleware/
│   └── auditLog.js
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── styles.css
│
└── docs/
    ├── proposal.md                        # This document
    └── ...
```

---

## 5. Reasoning Strategies

Reasoning strategies are reusable modules that shape HOW agents think. Any agent can use any strategy.

| Strategy | What It Does | Used By |
|----------|-------------|---------|
| **Chain of Thought** | Step-by-step reasoning before final answer | Analysis, Compliance |
| **Reflection Loop** | Generate → review own output → improve | Reporting, Compliance |
| **Plan and Execute** | Break goal into ordered sub-tasks | Orchestrator, Monitoring |
| **ReAct Loop** | Reason → Act (use tool) → Observe → Repeat | Task Agent, Monitoring |
| **Self Critique** | "Is my answer accurate? Did I miss anything?" | Analysis, Compliance |
| **Multi-Perspective** | Evaluate from legal, operational, and risk angles | Compliance, Reporting |
| **Confidence Scoring** | Rate confidence 0-100%. Low = escalate to human | All agents |

---

## 6. Global Rules (Agent Constitution)

All agents must follow these rules at all times:

**NEVER:**
- Send PII to external services
- Delete production data without human approval
- Override another agent's decision without orchestrator
- Execute more than 3 retries on same task
- Process content that failed PII scan

**ALWAYS:**
- Log every decision with reasoning to audit trail
- Include confidence score in every output
- Pass through guardrail agent before any LLM call
- Respect token budget limits
- Cite source regulation/policy when making claims

**REQUIRE HUMAN APPROVAL:**
- Change compliance gap status to Remediated
- Create tasks with deadline < 24 hours
- Any action with confidence below 50%

---

## 7. Communication Protocol

Standard message format between agents:

```
{
  id:          unique message ID
  from:        sending agent
  to:          receiving agent
  type:        'goal' | 'result' | 'error' | 'escalation' | 'approval_request'
  priority:    'critical' | 'high' | 'normal' | 'low'
  goal:        what needs to be accomplished
  payload:     data/results
  confidence:  0.0 - 1.0
  reasoning:   why this decision was made
  timestamp:   ISO-8601
}
```

---

## 8. Escalation Policy

| Confidence | Action |
|-----------|--------|
| 80-100% | Proceed autonomously |
| 50-79% | Proceed but flag for human review |
| Below 50% | Stop and require human approval |

---

## 9. Permission Matrix

| Agent | CAN | CANNOT |
|-------|-----|--------|
| Orchestrator | Delegate, plan, route | Modify DB, call LLM directly |
| Monitoring | Scrape, read DB | Write DB, delete, assign tasks |
| Analysis | Read DB, call LLM, vector search | Write DB, delete, assign tasks |
| Compliance | Read DB, call LLM, create gaps | Delete, change status to Remediated |
| Task | Read DB, create tasks, assign | Delete tasks, modify compliance |
| Reporting | Read DB, call LLM | Write DB, delete, assign |
| Guardrail | Read all, block, log | Modify anything |

---

## 10. Token Budget

| Agent | Max per Task | Max per Day |
|-------|-------------|-------------|
| Monitoring | 500 | 5,000 |
| Analysis | 2,000 | 20,000 |
| Compliance | 3,000 | 30,000 |
| Task | 1,000 | 10,000 |
| Reporting | 2,000 | 15,000 |
| Guardrail | 500 | 5,000 |
| **Total daily limit** | | **80,000** |

---

## 11. Observability (Trace Format)

Every agent workflow produces a trace:

```
Trace ID: abc-123
Goal: "Assess impact of Notice 626 amendment"
Steps:
  1. [Monitoring]  scraped MAS — 1 new regulation (3200ms)
  2. [Guardrail]   PII scan — cleared (15ms)
  3. [Analysis]    chain-of-thought — 5 reasoning steps (4500ms)
  4. [Analysis]    confidence score — 85% → proceed (800ms)
  5. [Compliance]  multi-perspective analysis — 2 gaps found (6200ms)
  6. [Task]        assigned to Alex Tan + Sarah Lee (1200ms)

Total: 16,035ms | Tokens: 4,280 | Outcome: Complete
Human approval required: No (confidence > 80%)
```

---

## 12. Comparison: Current vs Agentic

| Area | Current System | Agentic System |
|------|---------------|----------------|
| Architecture | Linear pipeline | Agent network via orchestrator |
| Decision Making | Hardcoded rules + single LLM prompt | Agents reason and adapt |
| Autonomy | Semi-automated — human triggers actions | Autonomous — humans approve |
| Intelligence | One LLM call per task | Multiple chained LLM calls |
| Memory | Stateless | Persistent across sessions |
| Error Recovery | Fails silently | Retries or escalates |
| Gap Analysis | Manual selection | Proactive scanning |
| Task Assignment | Human creates manually | Auto-assigned by workload |
| Audit Trail | Logs actions | Logs full reasoning chains |
| Reliability | Predictable | Less predictable (LLM variance) |

---

## 13. Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| LLM | OpenAI GPT-4o-mini (single model, multiple personas) |
| Vector DB | Chroma |
| Database | MySQL (Azure) |
| Frontend | HTML/JS/Bootstrap |
| Agent Framework | Custom ADK (inspired by LangChain/CrewAI patterns) |

---

## 14. Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|------------|
| Phase 1 | Week 1-2 | Base agent class, orchestrator, message protocol |
| Phase 2 | Week 3-4 | Monitoring + Analysis agents with reasoning |
| Phase 3 | Week 5 | Compliance + Task agents |
| Phase 4 | Week 6 | Guardrails, observability, testing |

---

## 15. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM hallucination | Guardrail agent cross-checks against source; confidence scoring |
| Runaway costs | Token budgets enforced per agent; rate limiter |
| Unpredictable behavior | Global rules; permission matrix; human approval for all actions |
| Audit concerns | Full reasoning chain logged; every decision traceable |
| Over-engineering | Start with 2 agents (Monitoring + Analysis); expand incrementally |

---

## 16. Success Criteria

- [ ] Orchestrator correctly routes goals to specialist agents
- [ ] Agents use reasoning strategies to produce higher-quality outputs than single prompts
- [ ] Confidence scoring correctly triggers escalation when uncertain
- [ ] Full trace logged for every workflow (auditable)
- [ ] Human can approve/reject agent recommendations from dashboard
- [ ] System handles MAS regulation change end-to-end without manual intervention
