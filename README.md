# Automated Regulatory Monitoring and Compliance Management System

**Green Link Digital Bank (GLDB) — MAS-Licensed Digital Wholesale Bank, Singapore**

An agentic, event-driven compliance management platform that autonomously monitors regulatory changes from 5 international authorities, scrapes full-page regulation content (skipping PDFs/binaries), assesses impact using a three-step AI pipeline with penalty detection (Classify → Assess → Verify with RAG + GPT-4o-mini), identifies 5 types of compliance gaps via cluster-based analysis, auto-generates consolidated remediation tasks grouped by category, proposes policy updates with detailed procedures, maintains full version history, and provides compliance officers with a 9-tab professional dashboard featuring regulatory change comparison, gap analysis reports, policy heatmaps, timeline-based audit trails, and email digest notifications.

---

## What Makes This Agentic

The system uses 7 autonomous agents that communicate through a shared event bus. Each agent has a single responsibility and reacts to events independently — no human intervention required for the core pipeline.

```
Scraper → Assessor → Analyzer → Dispatcher → Advisor → Notifier
                                     ↕
                                 Versioner (tracks policy changes)
```

When a new regulation is scraped, the event chain fires automatically:
1. **Scraper** finds new regulation → follows link to fetch full page content → emits `regulation.new`
2. **Assessor** hears the event → three-step AI assessment (classify, assess, verify) → scores impact, extracts deadline, identifies affected areas → emits `alert.created`
3. **Analyzer** hears the event → cluster-based comparison against relevant policies → emits `gap.created`
4. **Dispatcher** buffers Critical/High alerts by category → uses LLM to generate consolidated tasks (one task can cover multiple related changes) → assigns to correct department
5. **Advisor** buffers gaps → proposes new or updated policies for human review
6. **Notifier** buffers Critical/High alerts → sends ONE summary digest email on demand (button trigger)

All of this happens without anyone clicking a button.

---

## Project Structure

```
├── server.js                  # Express entry point — starts agents + routes
├── db.js                      # MySQL connection pool (Azure)
├── schema.sql                 # Full database schema (13 tables) + seed data
├── .env                       # Credentials (DB, OpenAI, Pinecone)
│
├── agents/                    # 🤖 Agentic system (7 autonomous agents)
│   ├── orchestrator.js        # Starts all agents in correct order
│   ├── eventBus.js            # Shared event channel (Node EventEmitter)
│   ├── scraper.js             # Scrapes MAS, FATF, FinCEN, ECB, FCA — follows links to fetch full page content
│   ├── assessor.js            # AI-powered impact scoring — 3-step: Classify → Assess → Verify (RAG + GPT-4o-mini)
│   ├── analyzer.js            # AI-powered gap detection between regs & policies
│   ├── dispatcher.js          # Creates tasks — groups by category, one task can cover multiple changes/gaps
│   ├── versioner.js           # Snapshots policy history before every edit
│   └── notifier.js            # Buffers alerts, sends summary digest email on demand (Gmail)
│
├── routes/                    # REST API endpoints (frontend-facing)
│   ├── auth.js                # Login + user listing
│   ├── alerts.js              # Alert CRUD
│   ├── dashboard.js           # Summary stats, trends, charts data
│   ├── regulations.js         # Regulation CRUD (paginated + search)
│   ├── changes.js             # Change detection + impact assessment data + auto-task linkage
│   ├── tasks.js               # Task CRUD
│   ├── gaps.js                # Gap CRUD + AI analysis + gap-to-task linking
│   ├── sources.js             # Regulatory source CRUD
│   ├── policies.js            # Policy CRUD (triggers versioning agent)
│   ├── proposals.js           # AI policy proposals (accept/reject)
│   └── audit.js               # Filtered audit trail
│
├── services/                  # Shared services (used by agents)
│   ├── ragEngine.js           # RAG pipeline: Pinecone + OpenAI embeddings + GPT
│   ├── piiFilter.js           # Blocks personal data before reaching OpenAI
│   └── notificationService.js # Email sending (nodemailer)
│
├── middleware/
│   └── auditLog.js            # Logs every action to audit_logs table
│
├── frontend/                  # Dashboard UI (no framework, no build step)
│   ├── index.html             # 9 views + login + sidebar + modals
│   ├── script.js              # All frontend logic
│   └── styles.css             # Dark mode, responsive, print styles
│
├── assets/
│   └── image.png              # GLDB logo
│
└── docs/                      # Project documentation
```

---

## The 7 Agents

| Agent | File | What It Does | Triggers On | Feature It Powers |
|-------|------|-------------|-------------|-------------------|
| Scraper | `scraper.js` | Scrapes 5 regulatory websites, follows links to fetch full page content, deduplicates, detects changes via content diffing | Cron (14 days) + startup (if DB empty) + manual trigger | Change Detection, Regulatory Feed |
| Assessor | `assessor.js` | Three-step assessment: Classify → Assess → Verify. Uses RAG + GPT-4o-mini to score impact, extract deadline, detect penalties, identify affected areas from 23-term vocabulary, classify change type. Penalty-linked changes auto-scored Critical. | `regulation.new`, `regulation.updated` events | Impact Assessment, Alerts, Changes & Impact |
| Analyzer | `analyzer.js` | Cluster-based comparison of regulation groups against relevant policies using multi-step reasoning. Classifies gaps into 5 types: Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold | `regulation.new`, `regulation.updated` events | Compliance Gap Analysis |
| Dispatcher | `dispatcher.js` | Buffers Critical/High alerts, groups by category+department, uses LLM to generate consolidated smart tasks (one task can cover multiple related regulatory changes) | `alert.created`, `gap.created` events (batched by category) | Task & Workflow Management |
| Advisor | `advisor.js` | Analyzes recurring gap patterns, proposes new policies or updates with detailed PROCEDURES (3-6 steps), references only top 2-3 key gaps per proposal. Human-in-the-loop approval. | `gap.created` events (batched) | Knowledge Base Update, Policy Recommendations |
| Versioner | `versioner.js` | Saves old policy content before every edit (version history) | `policy.updated` event | Knowledge Base Update, Policy Version History |
| Notifier | `notifier.js` | Buffers Critical/High alerts, sends ONE summary digest email on demand with all insights consolidated | `alert.created`, `task.created` events (manual trigger) | Notification & Alert System |

---

## Dispatcher Agent — Smart Task Generation

The Dispatcher is the most complex agent. It handles two input streams — compliance gaps AND regulatory change alerts — and generates the minimum number of clear, consolidated tasks per department.

### How It Works — Gap Pipeline

```
gap.created events arrive (from Analyzer)
    ↓
Buffer for 5 seconds (collect related gaps)
    ↓
Group by department (using category → department mapping)
    ↓
For each department group:
    → Send all gaps to GPT-4o-mini
    → LLM decides: which gaps need 1 task vs separate tasks
    → Returns multiple tasks with gap_indices mapping
    ↓
Create tasks in DB, link to gaps via task_gaps junction table
    ↓
Auto-set all linked gaps to "In Review"
```

### How It Works — Alert Pipeline (Regulatory Changes)

```
alert.created events arrive (from Assessor) — Critical/High only
    ↓
Buffer for 2-5 seconds (collect related changes from same scraper run)
    ↓
Group by category + department (e.g., all AML changes → one cluster)
    ↓
For each cluster:
    → Send ALL changes in the cluster to GPT-4o-mini
    → LLM reads all changes, consolidates into minimum tasks
    → One task can cover multiple related regulatory changes
    → Returns tasks with alert_indices mapping
    ↓
Create tasks in DB, link to alerts via task_alerts junction table
    ↓
Visible in Changes & Impact tab → "Auto-Task" column
```

### Key Behaviors

| Behavior | How |
|----------|-----|
| Groups related gaps | One task can address multiple related gaps |
| Creates multiple tasks per department | If gaps need different types of work |
| Uses LLM for task titles | Specific, verb-led, actionable (not "review" or "address") |
| Links gaps to tasks | Many-to-many via `task_gaps` table |
| Auto-sets gap status | Open → In Review when task created |

### Gap Status Lifecycle (Fully Automated)

```
┌──────────────────────────────────────────────────────────────┐
│  OPEN → created by Analyzer agent                             │
│    ↓                                                         │
│  IN REVIEW → Dispatcher creates task (Critical/High only)    │
│    ↓                                                         │
│  REMEDIATED → User marks task "Completed" → auto-synced      │
└──────────────────────────────────────────────────────────────┘
```

| Status | Condition | Who Sets It |
|--------|-----------|-------------|
| **Open** | Gap severity is Medium or Low — no auto-task created. User can manually create a task via the "Create Task" button, or leave it as-is. | Analyzer agent (default on creation) |
| **In Review** | Gap severity is Critical or High — Dispatcher auto-creates a task and assigns it to the responsible department. Gap moves to In Review immediately. | Dispatcher agent (automatic) |
| **Remediated** | The linked task has been marked as "Completed" by the assignee. Backend auto-updates ALL gaps linked to that task. | Backend (triggered when task status → Completed) |

### Department Routing

| Regulation Category | Assigned Department | Deadline |
|--------------------|--------------------|----------|
| AML, KYC, AML/CFT | Compliance Operations | Critical: 3 days, High: 7 days |
| Banking Supervision, Capital Requirements | Risk Management | Critical: 3 days, High: 7 days |
| Cyber, TRM, Operational Risk | IT Security | High: 7 days |
| Financial Conduct, Consumer Protection | Legal & Compliance | Critical: 3 days, High: 7 days |
| Data Privacy, PDPA | Data Protection Office | High: 7 days |
| ESG, Green Finance | ESG & Green Finance | Medium: 14 days |
| Governance | Board Secretariat | High: 7 days |

---

## AI Agent Harness Format

Each AI-powered agent follows a structured **harness format** — a multi-turn message sequence where each message has a specific role. This is the standard pattern for building reliable AI agents with OpenAI's API.

### The Format

```
System:      Defines WHO the agent is. Sets identity and persona.
Developer:   Defines the RULES. Hard constraints the agent must follow.
User:        Provides the TASK. What the agent needs to do right now.
Assistant:   The agent's RESPONSE. Its reasoning or output.
Tool:        External DATA retrieved by the system (e.g., from Pinecone vector DB).
Assistant:   Agent incorporates tool data into its final answer.
User:        REFLECTION prompt. Asks agent to verify its own work.
Assistant:   FINAL verified response.
```

### Applied to Our System

**Assessor Agent (Impact Scoring — Three-Step Process):**
```
System:      You are a senior compliance assessment agent at GLDB.
Developer:   Strict scoring rules: Critical requires ALL THREE (penalty + deadline + new requirement).
             Downgrade rules. Affected areas from 23-term vocabulary only.
             Change type classification (New Requirement/Amended Threshold/Clarification/Revocation).
             Deadline extraction from regulation text (YYYY-MM-DD).
User:        [Policy chunks retrieved from Pinecone — 5 chunks for better coverage]
Assistant:   I have reviewed the GLDB internal policy context.
User:        STEP 1 — Classify: Is this binding? What type of change? Deadline? Which areas?
Assistant:   A. Yes binding (MAS). B. New Requirement. C. "by 1 March 2027". D. Transaction Monitoring.
User:        STEP 2 — Assess: Produce initial impact assessment as JSON.
Assistant:   {"impact_score": "High", "change_type": "New Requirement", "affected_areas": [...], ...}
User:        STEP 3 — Verify: Check all rules, correct if needed.
Assistant:   {"impact_score": "High", "confidence": 0.85, "revised": false, ...}
```

**Analyzer Agent (Gap Detection):**
```
System:      You are a compliance gap analysis agent at GLDB.
Developer:   Only flag gaps if regulation EXPLICITLY requires something policy misses.
User:        [Related regulation + policy chunks from Pinecone]
Assistant:   I have reviewed the context.
User:        STEP 1: Extract all requirements from this regulation as bullet points.
Assistant:   • Must conduct CDD • Must file STRs • Must do ongoing monitoring...
User:        STEP 2: Compare requirements against this policy. Flag unmet ones as JSON.
Assistant:   {"has_gaps": true, "gaps": [...], "compliance_score": 65}
User:        STEP 3: Review your gaps. Remove any that are inferred, not explicit.
Assistant:   {"has_gaps": true, "gaps": [...], "compliance_score": 72}
```

### Message Roles Explained

| Role | Purpose | Example |
|------|---------|---------|
| `system` | Defines the agent's identity and persona. Persists across the entire conversation. | "You are an impact assessment agent at GLDB..." |
| `developer` | Sets hard rules and constraints the model must follow. Acts as guardrails. | "Only score Critical if there are explicit penalties..." |
| `user` | Provides the actual task input — regulation text, policy text, or tool results. | "Assess this regulation: MAS Notice 626..." |
| `assistant` | Model's own responses — used in multi-turn to build reasoning chain. | `{"impact_score": "High", "confidence": 0.85}` |
| `tool` | Context retrieved from Pinecone vector database (RAG retrieval results). | "Retrieved policies: 1. GLDB AML Policy..." |

### Assessor Agent Harness (Three-Step: Classify → Assess → Verify)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ROLE: system                                                             │
│ "You are a senior compliance assessment agent at GLDB, a MAS-licensed    │
│  Digital Wholesale Bank in Singapore serving MSMEs. Your sole purpose    │
│  is to evaluate regulatory changes and produce structured, accurate      │
│  impact assessments. Be precise, conservative, and consistent."          │
│                                                                         │
│  [Full GLDB context: license type, core products, primary/secondary      │
│   regulators, internal policies listed]                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: developer (11 strict rules)                                        │
│ SCORING:                                                                │
│  1. Critical = ALL THREE: penalty + deadline + new requirement           │
│  2. High = direct new/amended MAS/FATF requirement                      │
│  3. Medium = clarification or non-binding international guidance         │
│  4. Low = informational, no binding force, or already covered            │
│ DOWNGRADES:                                                             │
│  5. Already compliant → downgrade one level                             │
│  6. Restatement of existing law → Low                                   │
│  7. FinCEN/ECB/FCA → start at Medium                                    │
│ AFFECTED AREAS: pick 1-4 from 23-term vocabulary only                   │
│ CHANGE TYPE: New Requirement / Amended Threshold / Clarification /       │
│              Revocation                                                  │
│ DEADLINE: scan for dates (YYYY-MM-DD or null)                           │
│ CONFIDENCE: 0.9+ certain, 0.7-0.8 clear, 0.5-0.6 uncertain            │
│                                                                         │
│ + Last 5 historical assessments for consistency                          │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (RAG context — 5 policy chunks from Pinecone)                │
│ "Retrieved GLDB internal policy context:                                 │
│  1. GLDB AML/CFT Policy: Automated eKYC and EDD procedures...           │
│  2. GLDB Transaction Monitoring Policy: Continuous monitoring..."         │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 1 — Classification — free text reasoning)               │
│ "A. Is this binding on Singapore banks? B. Change type?                  │
│  C. Specific compliance deadline stated? D. Which GLDB areas?            │
│  E. Does policy context show existing compliance?"                       │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (classification)                                         │
│ "A. Yes, binding (MAS Notice). B. Amended Threshold.                    │
│  C. 'by 1 March 2027'. D. Transaction Monitoring, Wire Transfers.       │
│  E. Partially — current policy covers monitoring but not new threshold."│
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 2 — Assessment — structured JSON)                       │
│ "Produce your initial assessment as JSON."                               │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (initial assessment)                                      │
│ {"impact_score":"High", "confidence":0.85, "change_type":"Amended        │
│   Threshold", "affected_areas":["Transaction Monitoring","Wire           │
│   Transfers"], "explicit_deadline":"2027-03-01", "reasoning":"MAS        │
│   amended DPT threshold; GLDB partially complies but needs update."}    │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 3 — Self-verification)                                  │
│ "Check: Did I apply scoring rules correctly? Downgrade rules?            │
│  Are affected_areas from the allowed vocabulary? Deadline correct?        │
│  Change type accurate? Consistent with history?"                         │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (final verified assessment)                               │
│ {"impact_score":"High", "confidence":0.85, "change_type":"Amended        │
│   Threshold", "affected_areas":["Transaction Monitoring","Wire           │
│   Transfers"], "explicit_deadline":"2027-03-01", "revised":false}        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Analyzer Agent Harness

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ROLE: system                                                             │
│ "You are a compliance gap analysis agent at GLDB. Your role is to        │
│  compare external regulations against internal bank policies and         │
│  identify specific areas where the policy fails to meet requirements.    │
│  Be precise — vague gaps are useless. Always output valid JSON."         │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: developer (rules/guardrails)                                       │
│ "Rules:                                                                  │
│  1. Only flag if regulation EXPLICITLY requires something policy misses  │
│  2. Severity: Critical=penalty, High=operational change, Medium=review   │
│  3. Each gap must have specific actionable recommendation                │
│  4. Include confidence score per gap (0.0-1.0)                           │
│  5. Maximum 5 gaps — focus on most significant                           │
│  6. If policy covers it in different wording, do NOT flag it"            │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (tool/RAG context)                                            │
│ "Context from vector store:                                              │
│  - Additional related regulations: [chunks from Pinecone]                │
│  - Additional related policies: [chunks from Pinecone]"                  │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 1 — requirement extraction)                             │
│ "Extract all specific compliance requirements from this regulation.      │
│  List each as a bullet point. Only ACTIONABLE requirements.              │
│  REGULATION: {title} — {content}"                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (extracted requirements)                                  │
│ "• Banks must conduct CDD before establishing business relations         │
│  • Enhanced due diligence for PEPs and high-risk customers               │
│  • STRs must be filed with STRO when suspicious activity detected..."    │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 2 — compare against policy)                             │
│ "Compare each requirement against this policy. Flag unmet ones.          │
│  POLICY: {policy_name} — {description}                                   │
│  Output as JSON: {has_gaps, gaps[], compliance_score}"                   │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (gap analysis)                                            │
│ {"has_gaps":true,"gaps":[{"description":"...","severity":"High",...}]}   │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: user (STEP 3 — self-verification)                                  │
│ "Review your gaps. For each ask:                                         │
│  1. Does the regulation EXPLICITLY require this?                         │
│  2. Does the policy already cover it in different wording?               │
│  3. Is it actionable enough for a compliance team?                       │
│  Remove failing gaps. Output FINAL revised JSON."                        │
├─────────────────────────────────────────────────────────────────────────┤
│ ROLE: assistant (final verified response)                                 │
│ {"has_gaps":true,"gaps":[...],"compliance_score":72}                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Policy Advisor Agent — Human-in-the-Loop Policy Recommendations

The Advisor agent watches for **recurring** compliance gaps (2+ gaps in the same category) and proposes either a brand new policy or an update to an existing one. Proposals are never applied automatically — a human compliance officer must review and Accept or Reject them first.

### Why Human Review Is Required

Policies are legal/operational documents. An AI should never silently rewrite what a bank promises to do. The Advisor's job is to draft a well-reasoned suggestion; a human's job is to approve it.

### Workflow

```
Gaps accumulate in a category (e.g., 3 AML gaps about record-keeping)
    ↓
Advisor buffers gaps for 8 seconds, waits for related ones
    ↓
Sends gap cluster + existing policies to GPT-4o-mini
    ↓
LLM decides: New Policy needed? Or Update to existing one?
    ↓
Self-verification step — checks proposal is specific, not vague
    ↓
Saved to policy_proposals table with status "Pending"
    ↓
Compliance Officer opens Policies tab → "AI Proposals" sub-tab
    ↓
Reviews proposed text + reasoning + which gaps justify it
    ↓
   ACCEPT                          REJECT
     ↓                                ↓
Applied to internal_policies    Proposal discarded
Embedded into Pinecone          No changes made
Old version saved (if update)
```

### Policies Tab — Two Views

| Tab | Purpose |
|-----|---------|
| **Current Policies** | Live policies in effect — CRUD, edit, version history |
| **AI Proposals** | Pending suggestions from the Advisor agent — Accept/Reject buttons |

### Advisor Agent Harness

```
System:      You are a policy advisory agent at GLDB. Your role is to review recurring
             compliance gaps and propose specific policy text to close them. You do NOT
             modify any policy directly — only draft proposals for human review.
Developer:   Rules:
             1. Only propose NEW policy if nothing covers this topic at all
             2. Only propose UPDATE if existing policy is too vague
             3. Proposed text must be specific — not "the bank will comply"
             4. Cite which gaps/regulations justify each proposal
             5. No duplicate proposals for the same topic
Assistant:   Understood. I will only propose when genuinely justified, with specific text.
User:        "Review these gaps related to AML:
             1. Record-keeping requirements not covered
             2. STR filing procedures not specified
             Existing policies: GLDB AML/CFT Compliance Policy (generic, high-level)"
Assistant:   {"proposals": [{"type": "Policy Update", "target_policy_name": "GLDB AML/CFT
             Compliance Policy", "policy_name": "...", "proposed_description": "...",
             "reasoning": "MAS Notice 626 requires 5-year record retention; current
             policy does not specify retention periods or STR filing timelines."}]}
User:        "Review your proposal. Is it specific? Does it match the existing policy
             correctly (Update vs New)? Revise if needed."
Assistant:   {"proposals": [...]} (final, verified)
```

### Dispatcher Agent Harness (Gap-Based)

```
System:      You are a task orchestration agent at GLDB. Create clear, actionable tasks
             that tell departments exactly what to do. Start every title with a verb.
Developer:   Rules:
             1. Each title starts with action verb (Implement, Draft, Establish, Update...)
             2. If gaps need different work types, create SEPARATE tasks
             3. If gaps can be fixed by one action, combine into ONE task
             4. Max 5 tasks per group. Be specific, not vague.
             5. Consider department expertise when phrasing.
Assistant:   Understood. I will create specific actionable tasks, splitting or combining as needed.
User:        "Analyze these gaps assigned to IT Security:
             1. Important business services not identified
             2. Impact tolerances not documented
             3. No resilience testing framework
             Create tasks."
Assistant:   {"tasks": [
               {"title": "Develop framework to identify important business services", "gap_indices": [1]},
               {"title": "Define and document impact tolerances for each service", "gap_indices": [2]},
               {"title": "Implement resilience testing and validation program", "gap_indices": [3]}
             ]}
```

### Dispatcher Agent Harness (Alert-Based — Category Clustering)

```
System:      You are a task orchestration agent at GLDB. Analyze a CLUSTER of related
             regulatory changes from the same compliance category and generate the minimum
             number of tasks. One task can and should cover multiple related changes if
             they require the same type of work.
Developer:   Rules:
             1. Read ALL changes before deciding task count
             2. Same policy/procedure update needed → ONE task for all
             3. Different work types → SEPARATE tasks
             4. Max 4 tasks per cluster. Reference specific changes.
             5. Use earliest regulatory deadline as task deadline hint.
Assistant:   Understood. I will read all 5 changes in this cluster and consolidate.
User:        "Analyze this CLUSTER of 5 Critical/High AML changes assigned to
             Compliance Operations:
             1. [Critical] MAS Notice 626 — new DPT monitoring threshold
             2. [High] FATF Recommendation — wire transfer originator info
             3. [High] MAS Notice 626 — enhanced CDD for high-risk jurisdictions
             4. [High] FATF — beneficial ownership registry requirements
             5. [High] MAS — STR filing timeline reduced from 15 to 5 days
             These changes are related — consolidate where possible."
Assistant:   {"tasks": [
               {"title": "Update Transaction Monitoring Policy to incorporate DPT
                thresholds and new high-risk jurisdiction CDD requirements",
                "alert_indices": [1, 3], "suggested_deadline": "2027-03-01"},
               {"title": "Implement enhanced wire transfer originator/beneficiary
                identification procedures per FATF requirements",
                "alert_indices": [2, 4]},
               {"title": "Revise STR filing procedures to meet new 5-day timeline",
                "alert_indices": [5]}
             ]}
```

### Why This Harness Matters

| Without Harness | With Harness |
|---|---|
| Single prompt, model guesses intent | Roles clearly separate identity, rules, and task |
| No constraints, model can hallucinate | Developer rules act as hard guardrails |
| One-shot response, no self-check | Reflection step catches errors before commit |
| No memory across calls | Historical context maintains consistency |
| No uncertainty awareness | Confidence score flags low-certainty decisions |
| Flat reasoning | Multi-step forces structured thinking (extract → compare → verify) |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js v18+ | Server-side JavaScript |
| Framework | Express.js | REST API |
| Database | MySQL (Azure) | 13 tables with foreign keys |
| Vector DB | Pinecone (cloud) | Semantic search for RAG pipeline |
| AI/LLM | OpenAI GPT-4o-mini | Impact assessment + gap analysis |
| Embeddings | text-embedding-3-small | Converts text to vectors for Pinecone |
| Auth | bcryptjs | Password hashing |
| Scraping | axios + cheerio | Web scraping regulatory sites |
| Scheduling | node-cron | Automated biweekly ingestion |
| Email | nodemailer | Alert notifications |
| Frontend | Bootstrap 5 + Vanilla JS + Chart.js | Dashboard UI |
| Privacy | PII Filter | Blocks NRIC/phone/email before reaching OpenAI |

---

## Database Schema (13 Tables)

| # | Table | Purpose |
|---|-------|---------|
| 1 | users | 3 roles: Compliance Officer, Internal Auditor, Admin |
| 2 | regulatory_sources | 5 regulatory bodies (MAS, FATF, FinCEN, ECB, FCA) |
| 3 | regulations | Scraped regulation content (full page text, up to 5000 chars) |
| 4 | regulation_changes | Version diffs with AI-assessed impact scores, old/new content for comparison |
| 5 | alerts | Auto-generated, severity-categorized, linked to changes |
| 6 | internal_policies | 15 GLDB policies with detailed procedures + 3 training programs |
| 7 | compliance_gaps | AI-identified gaps between regulations and policies |
| 8 | tasks | Remediation tasks (auto-created by Dispatcher for Critical/High) |
| 9 | audit_logs | Full trail of all user + LLM actions |
| 10 | departments | 6 departments with category-to-team mapping |
| 11 | task_gaps | Junction: one task links to multiple gaps (many-to-many) |
| 12 | task_alerts | Junction: one task links to multiple regulatory change alerts |
| 13 | policy_proposals | AI-generated policy proposals awaiting human accept/reject |
| 14 | policy_versions | Historical snapshots of policy edits |

### Data Storage: MySQL vs Pinecone

The system uses two databases for different purposes:

| Data | MySQL (Azure) | Pinecone (Cloud) |
|------|--------------|-----------------|
| Regulations | ✅ Full text, title, source, version, dates | ✅ Vector embeddings for semantic search |
| Internal Policies | ✅ Full text, name, last_updated | ✅ Vector embeddings for semantic search |
| Compliance Gaps | ✅ Description, status, links | ❌ Not needed |
| Tasks | ✅ Title, assignee, deadline, status | ❌ Not needed |
| Alerts | ✅ Severity, status, timestamps | ❌ Not needed |
| Audit Logs | ✅ Full action history + LLM logs | ❌ Not needed |
| Departments | ✅ Name, categories, assignees | ❌ Not needed |

**MySQL** = source of truth for everything displayed in the UI. Handles CRUD, relationships, queries, and status tracking.

**Pinecone** = used only during AI analysis. When the Assessor or Analyzer needs to find "which internal policies are relevant to this regulation?", it searches Pinecone by semantic similarity (meaning-based) rather than keyword matching. If Pinecone were unavailable, the UI would still function — only the AI-powered analysis would be disabled.

---

## RAG Pipeline (How AI Works)

```
1. CHUNK — Split regulation/policy text into ~500 char segments
2. EMBED — Convert chunks to vectors using text-embedding-3-small
3. STORE — Save vectors in Pinecone (2 namespaces: regulations, policies)
4. RETRIEVE — On query, find most relevant chunks via cosine similarity
5. AUGMENT — Combine retrieved chunks into enriched prompt
6. GENERATE — GPT-4o-mini produces impact score or gap analysis
7. GUARD — PII filter blocks any personal data before step 6
8. LOG — Every LLM call logged to audit_logs with input/output/duration
```

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- MySQL 8+ (or access to Azure database)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Edit `.env` with your credentials (DB, OpenAI key, Pinecone key + index name).

### Step 3: Create Database
Run `schema.sql` in MySQL Workbench against your database.

### Step 4: Start the Server
```bash
npm start
```

You should see:
```
Server is running on port 3000
Database connected successfully
╔══════════════════════════════════════════╗
║   AGENTIC SYSTEM — Starting Agents       ║
╚══════════════════════════════════════════╝
[RAG] Pinecone connected — Index: gldb-compliance
[Orchestrator] All 7 agents active
[Orchestrator] Flow: Scraper → Assessor → Analyzer → Dispatcher/Advisor → Notifier
```

### Step 5: Open the Dashboard
```
http://localhost:3000
```

Login:
| Role | Email | Password |
|------|-------|----------|
| Compliance Officer | officer@gldb.com | 123456 |
| Internal Auditor | auditor@gldb.com | 123456 |
| Admin | admin@gldb.com | 123456 |

---

## Dashboard Views (9 Total)

| View | Features | Agent(s) Responsible |
|------|----------|---------------------|
| Alerts | Summary cards, severity/status filters, department column, relative timestamps, bulk actions (Mark All Read, Dismiss Info), "View Change" navigation, email digest button, notification indicator | **Assessor** (generates alerts), **Notifier** (buffers for email digest) |
| Reports | 4 focused tabs: (1) Regulatory Changes — impact doughnut, category bar, changes timeline, penalty count (2) Gap Analysis — type distribution pie, gaps by policy, status bar, resolution rate (3) Tasks — status pie, department bar, burndown (4) Compliance Posture — overall score %, policy coverage heatmap | All agents contribute data |
| Tasks | CRUD with department, deadlines, urgency highlighting. Clickable linkage badges: 🔗 gaps → navigates to Gaps tab, 📋 changes → navigates to Changes & Impact filtered to related changes | **Dispatcher** (auto-creates tasks for Critical/High, groups by category) |
| Compliance Gaps | Progress bar, status cards, 5 gap type filters (Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold), gap-to-task linking modal | **Analyzer** (5-type cluster-based gap detection with multi-step reasoning) |
| Sources | CRUD for regulatory sources (MAS, FATF, FinCEN, ECB, FCA) | **Scraper** (ingests from these) |
| Regulations | Category/source/status filters, clickable titles → official source, "View Details" panel with full content + related changes + related gaps, status indicators, export CSV | **Scraper** (populates knowledge base) |
| Changes & Impact | 5 summary cards (Total/Critical/High/Medium/Auto-Tasks), 4 filters (impact, task status, affected areas, search), View Diff with old vs new side-by-side, penalty badge (pulsing ⚠️), auto-task column, "Run Scraper" button | **Scraper** (detects changes), **Assessor** (scores impact with penalty detection), **Dispatcher** (auto-tasks for Critical/High) |
| Policies | Card-based display with expandable procedures, "View Procedures" toggle, 🤖 AI badge for AI-generated policies, filter by history/AI-generated, version history tracking, AI Proposals sub-tab with formatted procedures + Accept/Reject | **Versioner** (snapshots edits), **Advisor** (proposes policies with procedures) |
| Audit Trail | Summary cards (Total/This Week/AI Actions/Human Actions), agent activity breakdown, 3 view modes (Table/Timeline/Response Chain), AI vs Human filter, expandable detail rows, response chain visualization (Scraped→Assessed→Gaps→Tasks→Status) | All agents log via audit middleware |

---

## User Journey Flow — Compliance Officer

```
                                    ┌─────────────────────┐
                                    │       LOGIN         │
                                    └─────────┬───────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │   REVIEW ALERTS     │
                                    │ (Severity, Dept,    │
                                    │  Unread count)      │
                                    └─────────┬───────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │   INVESTIGATE       │
                                    │ REGULATORY CHANGES  │
                                    │ (Changes & Impact)  │
                                    └─────────┬───────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │  COMPARE OLD & NEW  │
                                    │  (View Diff panel)  │
                                    └─────────┬───────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │ REVIEW COMPLIANCE   │
                                    │      GAPS           │
                                    │ (Identified by AI   │
                                    │  from changes)      │
                                    └─────────┬───────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
               ┌──────────────────────┐        ┌──────────────────────┐
               │  GAPS (Critical/High)│        │ CHANGES (Critical/   │
               │  trigger Dispatcher  │        │ High) trigger        │
               │                      │        │ Dispatcher           │
               └──────────┬───────────┘        └──────────┬───────────┘
                          │                               │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │  TASK AUTO-CREATED │
                                │  (by Dispatcher)  │
                                │ Groups by category│
                                │ 1 task = N changes│
                                └────────┬──────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
               ┌────────────────────┐  ┌────────────────────┐
               │ YES → View Task   │  │ NO (Medium/Low)    │
               │ (linked to gaps   │  │ → Create Task      │
               │  + changes)       │  │   manually         │
               └────────┬──────────┘  └────────┬───────────┘
                        │                      │
                        └──────────┬───────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │   MANAGE TASKS    │
                         │  Update Progress  │
                         │ Pending→InProgress│
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │  AI POLICY        │
                         │  PROPOSAL         │
                         │ (Accept / Reject) │
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │  MARK TASK        │
                         │  COMPLETED        │
                         │ (Auto-remediates  │
                         │  linked gaps)     │
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │ GENERATE REPORT   │
                         │ (4 tabs: Changes, │
                         │  Gaps, Tasks,     │
                         │  Posture)         │
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │ VERIFY AUDIT      │
                         │ TRAIL             │
                         │ (Response Chain)  │
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │ EMAIL SUMMARY     │
                         │ SENT (Digest)     │
                         └────────┬──────────┘
                                  │
                                  ▼
                         ┌───────────────────┐
                         │   CONTINUOUS      │
                         │   MONITORING      │◄──── Loop back to
                         │  (Next scan in    │      REVIEW ALERTS
                         │   2 weeks)        │
                         └───────────────────┘
```

**Key:** Task generation has TWO input arrows — tasks are auto-created when EITHER Critical/High gaps are found (from Analyzer) OR Critical/High impact changes are detected (from Assessor). Both feed into the Dispatcher agent which consolidates related items into smart tasks.

---

## Regulatory Sources

| Source | Region | Method |
|--------|--------|--------|
| MAS (Monetary Authority of Singapore) | Singapore | Web Scraping |
| FATF (Financial Action Task Force) | Global | Web Scraping |
| FinCEN (Financial Crimes Enforcement Network) | US | Web Scraping |
| ECB (European Central Bank) | Europe | Web Scraping |
| FCA (Financial Conduct Authority) | UK | Web Scraping |

All sources have fallback data for resilience when live sites return errors.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   EXTERNAL SOURCES                    │
│   MAS · FATF · FinCEN · ECB · FCA                   │
└──────────────────────┬──────────────────────────────┘
                       │ scrape
                       ▼
┌─────────────────────────────────────────────────────┐
│              AGENTIC LAYER (agents/)                  │
│                                                     │
│  Scraper → Assessor → Analyzer → Dispatcher → Notifier │
│                         ↕                            │
│                     Versioner                        │
│                                                     │
│  Communication: EventBus (publish/subscribe)        │
└──────────────────────┬──────────────────────────────┘
                       │ SQL + embeddings
                       ▼
┌─────────────────────────────────────────────────────┐
│              DATA LAYER                              │
│  MySQL (13 tables)  ·  Pinecone (2 namespaces)      │
└──────────────────────┬──────────────────────────────┘
                       │ queries
                       ▼
┌─────────────────────────────────────────────────────┐
│              API LAYER (routes/)                      │
│  25+ REST endpoints · Express.js · Audit middleware  │
└──────────────────────┬──────────────────────────────┘
                       │ JSON
                       ▼
┌─────────────────────────────────────────────────────┐
│              FRONTEND (frontend/)                     │
│  Bootstrap 5 · Chart.js · Vanilla JS · Dark Mode    │
└─────────────────────────────────────────────────────┘
```

---

## License

Internal use only — Green Link Digital Bank Pte. Ltd. © 2026
