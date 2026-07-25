# C300 Final Year Project Report

## Automated Regulatory Monitoring and Compliance Management System
### Green Link Digital Bank Pte. Ltd. (GLDB)

**Team ID:** SOI-2026-0039
**Team Members:** Min Thu (Lead Developer), Eaint, Kay, Hsu
**Supervisor:** [Supervisor Name]
**Academic Year:** AY2025 Semester 1

---

## 1. Project Specification and Plan

### 1.1 Project Overview

**Project Motivation**

Financial institutions face increasing challenges in keeping up with rapidly evolving regulatory requirements issued by authorities such as the Monetary Authority of Singapore (MAS), the Financial Action Task Force (FATF), the Financial Crimes Enforcement Network (FinCEN), the European Central Bank (ECB), and other governing bodies. For Greenlink Digital Bank (GLDB), a Digital Wholesale Bank licensed by MAS to serve the Micro, Small, and Medium Enterprise (MSME) segment, manual tracking of regulatory changes is time-consuming, prone to oversight, and directly threatens the bank's core value proposition of near-instantaneous supply chain financing. Any delay in detecting and responding to regulatory changes could result in non-compliance penalties, operational disruptions, or loss of the DWB license.

This project addresses this critical business need by developing an automated regulatory monitoring and compliance management system that eliminates manual tracking, provides real-time regulatory intelligence, and equips compliance officers with actionable dashboards and workflow tools.

**Project Objectives**

- Automate the retrieval of regulatory updates from MAS via web scraping, with a phased expansion plan for other international regulatory bodies (FATF, FinCEN, ECB, FCA, BIS, HKMA).
- Detect and analyze changes in regulatory documents by comparing versions and recording semantic differences.
- Assess how new regulations affect existing compliance processes using LLM-powered impact analysis (Critical, High, Medium, Low) with keyword-based fallback.
- Provide automated alerts categorized by severity (Immediate Action Required, Review Recommended, Informational) and user-friendly dashboards for compliance teams.
- Maintain a centralized, searchable archive of all regulatory changes, LLM interactions, and corresponding staff actions for audit purposes.
- Implement PII guardrails to prevent personal identification information from being processed or stored by the system.
- Deliver a working Proof of Concept (POC) focused initially on MAS regulations, with a phased expansion plan for other regulatory bodies.

**Implementation Approach**

Following guidance from GLDB's industry partner (Patrick), the project evolved from a phased approach to a fully operational multi-source system:
- All 5 regulatory sources (MAS, FATF, FinCEN, ECB, FCA) are active and scraping live
- 13 internal policies seeded covering all operational areas
- 7 autonomous AI agents processing the full compliance lifecycle
- Deployed on Azure App Service with public access

**Project Scope**

The system covers 11 functional modules:

1. Regulatory Feed Integration (Multi-source web scraping: MAS, FATF, FinCEN, ECB, FCA)
2. Change Detection (Content-based comparison with LLM-powered semantic diff)
3. Impact Assessment (3-step LLM pipeline: Classify → Assess → Verify with RAG)
4. Notification and Alert System (Severity-categorized alerts with email digest)
5. Knowledge Base Management (Regulations + 13 internal policies CRUD)
6. Compliance Gap Analysis (AI-powered cluster analysis with 5 gap types across all policies)
7. Task and Workflow Management (Auto-generated consolidated tasks + manual creation)
8. Historical Archive and Audit Trail (Searchable, filterable agent action logs)
9. Reporting and Dashboards (4 sub-tabs with KPI cards and charts)
10. AI Policy Advisory (LLM-generated policy proposals with accept/reject workflow)
11. Multi-Agent Orchestration (7 autonomous agents with event-driven pub/sub communication)

**Deliverables:**
- Working web application deployed on Azure App Service (Node.js backend + decoupled HTML/JS frontend)
- MySQL database with 13 normalized tables hosted on Azure
- 7 autonomous AI agents (Scraper, Assessor, Analyzer, Dispatcher, Advisor, Versioner, Notifier) with event-driven orchestration
- RAG pipeline with Pinecone vector database and OpenAI embeddings
- Content-based regulatory change detection with LLM-powered semantic diff
- PII detection and filtering service (PDPA compliance)
- Email notification system (Gmail SMTP)
- Project documentation and report

**Project Assumptions**

- The system is deployed on Azure App Service and accessible via a public URL.
- Regulatory source websites (MAS, FATF, FinCEN, ECB, FCA) maintain their current HTML structure. If a site changes its layout, the scraper falls back to cached reference data.
- All team members have access to Node.js (v18+), MySQL, and the shared Azure database server.
- The industry partner (GLDB) will provide sample Policy & Procedure Manuals (PMPs) for validation of the compliance gap analysis module.
- LLM integration uses the OpenAI API (GPT-4o-mini) for impact assessment, gap analysis, policy advisory, and change detection. API costs are managed within the project budget.
- PII (Personal Identification Information) must not be uploaded to or processed by the LLM. Guardrail mechanisms filter sensitive data before LLM calls.
- Vector embeddings are stored in Pinecone (cloud-hosted) for semantic retrieval in the RAG pipeline.

---

### 1.2 Functional Requirements

**FR1: Regulatory Feed Integration**
The system must connect to external regulatory databases, central banks, and government portals (primarily MAS for Phase 1, with expansion to FATF, FinCEN, ECB, FCA, BIS, and HKMA in Phase 2) via web scraping to retrieve regulatory updates. It must parse the retrieved HTML data using axios and cheerio, perform duplicate detection against existing records, and store new regulations in the internal MySQL knowledge base with source attribution, category classification, and version tracking. The system includes fallback reference data to ensure continuity when live sources are unreachable.

**FR2: Automated Change Detection**
The system must automatically scan for updates in regulatory documents every 14 days using a node-cron scheduled job and on server startup. When a regulation's content has meaningfully changed (detected via content-based comparison, not version numbers), the system must capture the old content, generate a structured LLM-powered diff (added/removed/modified requirements), extract any explicit compliance deadlines, and record the change in the regulation_changes table with old_content, new_content, change_diff, and semantic_differences. The diff is displayed in a side-by-side "Previous Version vs Current Version" view. For new regulations with no prior version, only the current version is displayed.

**FR3: Impact Assessment and Risk Scoring**
The system must analyze each new or updated regulation using a 3-step LLM pipeline (Classify → Assess → Verify) with RAG context from Pinecone vector store. Step 1 classifies binding status, change type, and penalty implications. Step 2 produces a structured JSON assessment with impact score, affected areas (from a 23-term standardized vocabulary), explicit deadline extraction, and confidence scoring. Step 3 self-verifies and revises if needed. Impact scores (Critical, High, Medium, Low) determine alert severity and auto-task generation. Confidence below 0.6 triggers automatic downgrade to Medium.

**FR4: Notification and Alert Management**
The system must automatically generate alerts categorized by severity (Immediate Action Required, Review Recommended, Informational) when new regulations are ingested or existing regulations are updated. Compliance officers must be able to view alerts with color-coded severity badges, filter alerts by severity level and status using client-side filtering, and update alert status (Unread, Read, Dismissed) directly from the dashboard.

**FR5: Knowledge Base Management**
The system must maintain a centralized knowledge base of all ingested regulations with source attribution, version history, and category classification. Compliance officers must be able to view, add, and edit regulations and internal policies through the dashboard.

**FR6: Compliance Gap Analysis**
The system must automatically identify compliance gaps using AI-powered cluster analysis. The Analyzer agent groups regulations by category, uses AI to select the most relevant internal policies (from all 13 seeded policies), and compares each cluster against those policies using a 3-step LLM pipeline (Extract Requirements → Compare → Self-Verify). Gaps are classified into 5 types: Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold. Each gap is linked to the most relevant policy (not just the first one) with severity scoring, confidence rating, and actionable recommendations.

**FR7: Task and Workflow Management**
The system must allow compliance officers to create tasks for relevant departments with task assignment to specific users, deadline setting, optional linking to related alerts, and progress tracking through a status lifecycle of Pending, In Progress, and Completed. Tasks with deadlines within 3 days or past due must be visually highlighted.

**FR8: Historical Archive and Audit Trail**
The database must maintain a fully searchable archive of every regulatory change detected. The system must record all actions taken by GLDB staff in an audit_logs table with user attribution, action type, target table, target identifier, description, and timestamp. The audit trail must also capture all LLM interactions including the input prompt, output response, target regulation/policy, and processing timestamp. Compliance officers must be able to filter audit logs by user, action type, target table, and date range.

**FR9: Reporting and Dashboards**
The system must provide a professional, multi-view dashboard with sidebar navigation across 10 views. The Reports view must display regulatory changes summarized by category in a table, alert trends over time in a Chart.js line chart, severity distribution in a pie chart, impact distribution in a doughnut chart, task status in a bar chart, and compliance status indicators with a progress bar.

**FR10: PII Detection and Filtering**
The system must implement a PII (Personal Identification Information) detection filter that scans all text content before it is sent to the LLM or stored in the database. The filter must detect Singapore NRIC/FIN numbers (pattern: [STFGM]\d{7}[A-Z]), phone numbers, email addresses, physical addresses, and personal names. When PII is detected, the system must block the content from being transmitted to the LLM, log the detection event in the audit trail, and return an appropriate error message to the user. This ensures compliance with PDPA (Personal Data Protection Act) requirements and prevents sensitive data leakage to third-party AI services.

**FR11: LLM Interaction Audit Logging**
The system must log every interaction with the LLM (OpenAI API) in the audit trail for full traceability. Each log entry must record: the timestamp of the call, the input prompt sent to the LLM (with any PII-filtered content noted), the full response received from the LLM, the regulation or policy being analyzed, the resulting impact score or gap assessment, and the processing duration. This audit trail must be queryable through the existing audit log interface and satisfies MAS requirements for explainability and accountability in AI-assisted decision-making.

**Business Rules**

BR1 (Alert Categorization): All incoming regulatory alerts must be strictly categorized into one of three severity levels: Immediate Action Required, Review Recommended, or Informational.

BR2 (Audit Immutability): The audit_logs table must act as an append-only ledger. Past compliance actions and historical regulation versions cannot be overwritten or deleted.

BR3 (Compliance Gap Identification): New regulatory requirements must be systematically compared against GLDB's existing internal policies to highlight outdated, missing, or non-compliant areas.

BR4 (Duplicate Prevention): The system must not insert duplicate regulations. Before inserting, the system must check for an existing record with the same title and source.

BR5 (Impact-to-Severity Mapping): Critical and High impact scores must generate Immediate Action Required alerts. Medium impact must generate Review Recommended alerts. Low impact must generate Informational alerts.

BR6 (Task Deadline Escalation): Tasks with deadlines within 3 calendar days or past due must be visually flagged as urgent.

BR7 (Regulatory Source Resilience): If a live regulatory source is unreachable, the system must gracefully fall back to cached reference data and continue processing remaining sources.

BR8 (Alert Status Validation): Alert status updates must only accept Unread, Read, or Dismissed. Task status must only accept Pending, In Progress, or Completed. Gap status must only accept Open, In Review, or Remediated.

BR9 (Scheduled Scanning Interval): The automated feed integration must execute on a biweekly schedule and also run immediately upon system startup.

BR10 (PII Guardrails): No personally identifiable information (NRIC numbers, personal names, phone numbers, physical addresses) shall be transmitted to external LLM services or stored in regulation content fields. The system must scan and block PII before any LLM API call.

BR11 (LLM Traceability): Every LLM API call must be recorded in the audit_logs table with full input/output content, enabling compliance officers and auditors to review AI-assisted decisions at any time.

---

### 1.3 Project Plan

**Development Methodology:** Agile/Scrum with 3 sprints across 3 weeks

**Sprint Schedule:**

| Sprint | Duration | Focus | Story Points | Team Hours |
|--------|----------|-------|-------------|------------|
| Sprint 1 | Week 3 (Wed-Fri) to Week 4 (Mon-Tue) — 5 days | Backend: All API endpoints, feed integrator, database | 24 | 47 |
| Sprint 2 | Week 4 (Wed-Fri) to Week 5 (Mon) — 4 days | Frontend: All 10 dashboard views, charts, UI | 28 | 41 |
| Sprint 3 | Week 5 (Tue-Fri) — 4 days | Should Have/Nice to Have features, testing, bug fixes, demo prep | 11 | 56 |

**Team Allocation:**

| Team Member | Role | Modules Owned | Total Hours |
|-------------|------|---------------|-------------|
| Min Thu | Main Developer | Modules 1, 2 (Feed Integration, Change Detection) + project setup | 42 |
| Eaint | Alerts and Audit | Modules 3, 4 (Impact Assessment, Alerts) + login | 38 |
| Kay | Reports and Tasks | Modules 7, 9 (Tasks, Reporting) | 38 |
| Hsu | Knowledge Base and Gaps | Modules 5, 6 (Knowledge Base, Gap Analysis) | 30 |

**Overall Timeline:**

| Week | Activity | Deliverable |
|------|----------|-------------|
| Week 2 | Requirements, business analysis, project planning | Sections 1, 2, 3 of report |
| Week 3 | System architecture design + Sprint 1 begins | Section 4.1 |
| Week 4 | Sprint 1 ends, Sprint 2 begins | Section 4.2 (backend) |
| Week 5 | Sprint 2 ends, Sprint 3 (testing + polish) | Section 4.2 (frontend), Section 5 |
| Week 6-7 | Mid-term evaluation, documentation | Sections 6, 7 |

**Sprint Outcomes:**

| Sprint | Planned | Completed | Notes |
|--------|---------|-----------|-------|
| Sprint 1 | All backend API endpoints, feed integrator, database schema | 25+ endpoints, feed integrator (MAS web scraping with fallback), 9-table schema with seed data, audit middleware | All planned items delivered. 30+ MAS regulations ingested on first run. |
| Sprint 2 | All 10 frontend dashboard views, charts, UI | 10 sidebar views, login overlay, Chart.js visualizations (pie, bar, doughnut, line), dark mode, pagination, CSV export, print report | All planned items delivered. Minor CSS adjustments carried to Sprint 3. |
| Sprint 3 | Should Have/Nice to Have features, testing, bug fixes, demo prep | Dark mode persistence, responsive sidebar, toast notifications, impact filtering, deadline highlighting, LLM integration (RAG pipeline with Chroma), PII guardrails, audit trail formatting, comprehensive testing (25 test specifications passed) | All Must Have and Should Have features completed. RAG pipeline and PII filter fully implemented. |

---

## 2. Business Analysis

### 2.1 Business Issues

**Current Business Situation**

Greenlink Digital Bank (GLDB) operates as an inaugural holder of the Digital Wholesale Bank (DWB) license issued by the Monetary Authority of Singapore (MAS), and is purpose-built to serve the Micro, Small, and Medium Enterprise (MSME) segment and the broader supply chain ecosystem. GLDB's core value proposition is "Supply Chain Finance 2.0," which heavily relies on the "Speed of Execution" to provide near-instantaneous financing for MSME invoices. To maintain this agility, GLDB utilizes a cloud-native, API-first architecture designed for rapid integration with B2B marketplaces and logistics platforms. As a primary facilitator for businesses operating in the China-Singapore corridor, GLDB must continuously navigate and adhere to a complex landscape of cross-border trade laws, green finance (ESG) mandates, and evolving regulations from authorities such as MAS, FATF, FinCEN, and the ECB.

**The Difficulties and Business Issues to Solve**

The primary business issue is that financial institutions face increasing challenges in keeping up with these rapidly evolving regulatory requirements, largely because the manual tracking of these regulatory changes is highly time-consuming and prone to oversight. For GLDB, these manual bottlenecks present a critical threat to their entire operational model. Relying on slow, manual compliance checks and updates leads to delays in internal processes, which directly contradicts their promise of near-instantaneous financing and fast MSME onboarding.

Furthermore, as a DWB license holder, GLDB operates under very strict regulatory guardrails, such as being restricted from taking retail deposits and facing limitations on certain lending activities compared to full banks. Any human oversight in tracking these complex MAS updates or high-impact changes could result in immediate risk or severe penalties. Ultimately, the business issue we are trying to solve is the dangerous bottleneck created by manual regulatory monitoring, which threatens GLDB's competitive advantage in execution speed and risks non-compliance with strict digital banking regulations.

### 2.2 Market Analysis

**Size of Business and Market Segment**

The global RegTech market was valued at USD 15.80 billion in 2024 and is projected to reach USD 85.92 billion by 2032, representing a CAGR of 23.6% (Fortune Business Insights). Singapore hosts 354,600 MSMEs representing 99.6% of all enterprises and contributing 47.3% to GDP (Department of Statistics Singapore, 2024). GLDB is one of 5 Digital Bank license holders in Singapore (3 Digital Full Banks: GXS Bank, MariBank, Trust Bank; 2 Digital Wholesale Banks: ANEXT Bank, Green Link Digital Bank). Singapore ranks 4th globally in the Global Financial Centres Index (GFCI 39, Z/Yen Group, 2026).

**Competitive Analysis**

| Solution | Type | Strengths | Weaknesses |
|----------|------|-----------|------------|
| Manual Compliance Teams | In-house | Deep institutional knowledge | Slow, expensive, error-prone |
| Thomson Reuters Regulatory Intelligence | Commercial SaaS | Comprehensive global coverage | Expensive enterprise pricing |
| Wolters Kluwer OneSumX | Commercial SaaS | End-to-end regulatory reporting | High implementation cost |
| Our System (GLDB POC) | Custom-built | Tailored to GLDB's exact sources, LLM-powered analysis, zero licensing cost, API-first | POC stage, expanding to full coverage |

### 2.3 Business Solutions

**Process Flow**

The current manual compliance process at GLDB involves compliance officers manually visiting regulatory websites, reading through documents, identifying changes, and updating internal procedures. This process is reactive, slow, and prone to human error.

Our automated system transforms this into a proactive, real-time pipeline powered by 7 autonomous AI agents:

1. **Automated Ingestion (Scraper Agent):** Scrapes 5 regulatory sources (MAS, FATF, FinCEN, ECB, FCA) every 14 days and on startup. Follows links on listing pages, fetches full page content, skips PDFs/binary files, and strips website boilerplate. Fallback reference data ensures continuity when sources are unreachable.
2. **Content-Based Change Detection (Scraper Agent):** Compares freshly scraped content against stored content using normalized text comparison. When a meaningful difference is detected, captures both old and new versions, calls the LLM to produce a structured diff (added/removed/modified requirements), and auto-increments the version number.
3. **3-Step Impact Assessment (Assessor Agent):** Each change is analyzed using a multi-step LLM pipeline with RAG context from Pinecone: (1) Classify binding status and change type, (2) Score impact with affected areas from a 23-term vocabulary, (3) Self-verify and revise. Extracts explicit compliance deadlines. Confidence scoring prevents overrating.
4. **AI Gap Analysis (Analyzer Agent):** Groups regulations by category, uses AI to select 2-5 relevant policies from all 13 internal policies, and performs cluster-based gap comparison. Identifies 5 gap types: Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold. Each gap linked to the most relevant policy.
5. **Auto-Task Generation (Dispatcher Agent):** Buffers Critical/High alerts and gaps, groups by category + department, and uses LLM to generate the minimum number of consolidated remediation tasks with verb-led titles.
6. **Policy Advisory (Advisor Agent):** When 2+ gaps exist in the same category, proposes new or updated policies with 3-6 step procedures. Proposals await human accept/reject in the UI.
7. **Email Notification (Notifier Agent):** Buffers all Critical/High alerts. Sends a formatted HTML digest email on demand via Gmail SMTP.
8. **Audit Trail:** Every agent action, LLM call, and user action is logged automatically, providing a searchable archive for regulatory inspections.

**How IT Helps**

The IT solution eliminates the manual bottleneck by automating the entire regulatory monitoring lifecycle. Instead of compliance officers spending hours manually checking websites, the system does it automatically and presents only actionable intelligence. This reduces response time from days to seconds, ensures no regulatory change is missed, and provides audit-ready documentation that satisfies MAS inspection requirements.

---

## 3. System Design and Implementation

### 3.1 System Architecture

The system follows a strict API-First, Decoupled Architecture with three independent layers:

**Use Case Diagram:**

```
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Compliance Officer" as CO
actor "Internal Auditor" as IA
actor "Admin" as AD
actor "node-cron Scheduler" as CRON
actor "Regulatory Websites" as RW
actor "OpenAI LLM" as LLM

rectangle "Automated Regulatory Monitoring System" {
  usecase "Login / Authenticate" as UC1
  usecase "View Alerts Dashboard" as UC2
  usecase "Filter Alerts by Severity/Status" as UC3
  usecase "Update Alert Status" as UC4
  usecase "View Regulations Knowledge Base" as UC5
  usecase "Add/Edit Regulations" as UC6
  usecase "View Regulation Changes" as UC7
  usecase "View Impact Assessment" as UC8
  usecase "Create/Manage Tasks" as UC9
  usecase "Identify Compliance Gaps" as UC10
  usecase "View/Manage Internal Policies" as UC11
  usecase "View Audit Trail" as UC12
  usecase "Generate Reports" as UC13
  usecase "Export CSV" as UC14
  usecase "Print Compliance Report" as UC15
  usecase "Toggle Dark Mode" as UC16
  usecase "Scrape Regulatory Sources" as UC17
  usecase "Detect Regulation Changes" as UC18
  usecase "Assess Impact (LLM)" as UC19
  usecase "Generate Alerts" as UC20
  usecase "Filter PII" as UC21
  usecase "Log LLM Interactions" as UC22
  usecase "Compare Regulations vs Policies (LLM)" as UC23
  usecase "Manage Users" as UC24
  usecase "Manage Regulatory Sources" as UC25
}

CO --> UC1
CO --> UC2
CO --> UC3
CO --> UC4
CO --> UC5
CO --> UC6
CO --> UC7
CO --> UC8
CO --> UC9
CO --> UC10
CO --> UC11
CO --> UC12
CO --> UC13
CO --> UC14
CO --> UC15
CO --> UC16

IA --> UC1
IA --> UC12
IA --> UC13

AD --> UC1
AD --> UC24
AD --> UC25
AD --> UC12

CRON --> UC17
CRON --> UC18
UC17 --> RW
UC18 --> UC19
UC19 --> LLM
UC19 --> UC21
UC19 --> UC20
UC19 --> UC22
UC23 --> LLM
UC23 --> UC21
UC10 --> UC23
@enduml
```

**Architecture Diagram:**

```
Browser (index.html + script.js + styles.css)
    |
    | fetch() HTTP requests
    v
Express REST API (server.js + routes/)
    |
    |--- mysql2 pool queries --> MySQL Database (13 tables on Azure)
    |--- Pinecone SDK --------> Pinecone Vector DB (cloud, 1536-dim embeddings)
    |--- OpenAI SDK ----------> OpenAI GPT-4o-mini (impact, gaps, advisory, diff)
    ^
    | Event-driven agent system (EventBus pub/sub)
    |
Agent Orchestrator (7 agents):
  1. Scraper (IngestionAgent) → Scrapes 5 sources, content-based change detection
  2. Assessor (ImpactAgent) → 3-step impact assessment with RAG
  3. Analyzer (GapAnalysisAgent) → Cluster-based gap analysis vs all policies
  4. Dispatcher → Auto-generates consolidated tasks for Critical/High changes
  5. Advisor → Proposes new/updated policies when 2+ gaps exist
  6. Versioner → Snapshots policy versions on update
  7. Notifier → Buffers alerts, sends email digest on demand
```

**Backend Layer:** Node.js/Express server exposing 30+ RESTful API endpoints returning raw JSON. Routes organized into 11 modules. 7 autonomous AI agents communicate via an EventBus (pub/sub pattern). Authentication uses bcryptjs. Shared audit logging middleware records all actions.

**Frontend Layer:** Decoupled application in the frontend/ directory built with HTML, Bootstrap 5, and vanilla JavaScript. Communicates exclusively through fetch() HTTP requests. Uses Chart.js for visualization. 10 sidebar navigation views plus login overlay.

**Agent Layer:** 7 agents orchestrated by orchestrator.js, started on server boot. Agents subscribe to events (regulation.new, regulation.updated, impact.assessed, alert.created, gap.created, policy.updated) and react autonomously. The Scraper agent runs on a 14-day cron schedule and on startup if the DB is empty. It scrapes 5 regulatory sources (MAS, FATF, FinCEN, ECB, FCA) using axios+cheerio, follows links to fetch full page content, performs content-based change detection, and emits events for downstream agents.

**Database:** MySQL with 13 normalized tables (users, regulatory_sources, regulations, regulation_changes, alerts, internal_policies, compliance_gaps, tasks, audit_logs, departments, task_gaps, task_alerts, policy_proposals, policy_versions) hosted on Azure (dft-fyp.mysql.database.azure.com).

**Technology Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js v18+ | Server-side JavaScript |
| Framework | Express.js | RESTful API routing |
| Database | MySQL + mysql2 | Persistent storage with connection pooling |
| Authentication | bcryptjs | Password hashing |
| Scraping | axios + cheerio | HTTP requests + HTML parsing |
| Scheduling | node-cron | Automated 14-day feed integration |
| Configuration | dotenv | Externalized credentials and URLs |
| AI/LLM | OpenAI API (GPT-4o-mini) | Impact assessment, gap analysis, policy advisory, change diff |
| Embeddings | OpenAI text-embedding-3-small | 1536-dimension vector embeddings for RAG |
| Vector DB | Pinecone (cloud-hosted) | Semantic vector search for RAG pipeline |
| PII Filter | Custom regex service | NRIC, phone, email, address, credit card detection |
| Email | Nodemailer + Gmail SMTP | Alert digest email notifications |
| Frontend | HTML + Bootstrap 5 + Vanilla JS | Decoupled dashboard UI |
| Visualization | Chart.js (CDN) | Pie, bar, doughnut, and line charts |
| Deployment | Azure App Service + Azure MySQL | Cloud hosting |

### 3.2 Detailed System Design

**Entity Relationship Diagram**

The database consists of 9 tables with the following relationships:

- regulatory_sources (1) → (many) regulations
- regulations (1) → (many) regulation_changes
- regulations (1) → (many) alerts
- regulation_changes (1) → (many) alerts
- regulations (1) → (many) compliance_gaps
- internal_policies (1) → (many) compliance_gaps
- alerts (1) → (many) tasks
- users (1) → (many) tasks
- users (1) → (many) audit_logs

**API Endpoint Design (25+ endpoints):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | Authentication with bcrypt |
| GET | /api/users | List all users |
| GET | /api/alerts | List alerts with regulation titles |
| PATCH | /api/alerts/:id | Update alert status |
| GET | /api/dashboard/summary | Aggregated alert metrics |
| GET | /api/dashboard/categories | Changes grouped by category |
| GET | /api/dashboard/trends | Alert counts by date |
| GET | /api/regulations | Paginated regulations with search |
| POST | /api/regulations | Create regulation |
| PUT | /api/regulations/:id | Update regulation |
| GET | /api/regulation-changes | All detected changes |
| GET | /api/regulation-changes/:regId | Changes for specific regulation |
| GET | /api/tasks | Tasks with assignee info |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task status |
| DELETE | /api/tasks/:id | Delete task |
| GET | /api/compliance-gaps | Gaps with regulation + policy info |
| POST | /api/compliance-gaps | Create gap |
| POST | /api/compliance-gaps/analyze | RAG-powered gap analysis (LLM) |
| PATCH | /api/compliance-gaps/:id | Update gap status |
| GET | /api/regulatory-sources | List sources |
| POST | /api/regulatory-sources | Add source |
| GET | /api/internal-policies | List policies |
| POST | /api/internal-policies | Create policy |
| PUT | /api/internal-policies/:id | Update policy |
| GET | /api/audit-logs | Filtered audit trail |

**File Structure:**

```
server.js                    # Express app entry point (route mounting, startup backfill)
db.js                        # MySQL connection pool
schema.sql                   # Database schema (13 tables) + seed data (13 policies, 5 sources)
.env                         # Environment variables (DB, OpenAI, Pinecone, Email)
agents/
  orchestrator.js            # Starts all 7 agents
  scraper.js                 # Ingestion Agent — multi-source scraping + content-based change detection
  assessor.js                # Impact Agent — 3-step LLM assessment with RAG
  analyzer.js                # Gap Analysis Agent — cluster-based policy comparison
  dispatcher.js              # Task Dispatcher — auto-generates consolidated tasks
  advisor.js                 # Policy Advisor — proposes new/updated policies
  versioner.js               # Policy Versioning — snapshots old policy versions
  notifier.js                # Notification Agent — email digest buffering
  eventBus.js                # Shared pub/sub event emitter
routes/
  auth.js                    # Login + users
  alerts.js                  # Alert CRUD + bulk actions
  dashboard.js               # Summary, categories, trends
  regulations.js             # Regulation CRUD (paginated)
  changes.js                 # Regulation changes + detail (old vs new)
  tasks.js                   # Task CRUD + linkage
  gaps.js                    # Compliance gap CRUD + cluster analysis trigger
  sources.js                 # Regulatory sources
  policies.js                # Internal policies CRUD + versioning + AI proposals
  audit.js                   # Audit logs (filtered)
  proposals.js               # AI policy proposals (accept/reject)
middleware/
  auditLog.js                # Shared audit logging helper
services/
  feedIntegrator.js          # Legacy feed service (superseded by agents/scraper.js)
  ragEngine.js               # RAG pipeline (Pinecone embedding, retrieval, chunking)
  piiFilter.js               # PII detection and blocking (PDPA compliance)
  notificationService.js     # Email sending (Gmail SMTP, HTML digest)
frontend/
  index.html                 # Dashboard UI (10 views, login overlay)
  styles.css                 # All custom CSS (dark mode, responsive)
  script.js                  # All frontend logic (~3000 lines)
```

**Regulatory Sources:**

| Source | Method | Scope | Status |
|--------|--------|-------|--------|
| MAS | Web Scraping (axios + cheerio, follows links, fetches full content) | Singapore | Active |
| FATF | Web Scraping (same pipeline) | Global | Active |
| FinCEN | Web Scraping (same pipeline) | US | Active |
| ECB | Web Scraping (same pipeline) | Europe | Active |
| FCA | Web Scraping (same pipeline) | UK | Active |

**Sequence Diagram — Automated Multi-Agent Pipeline:**

```
@startuml
participant "node-cron\nScheduler" as CRON
participant "Scraper Agent\n(scraper.js)" as SCRAPER
participant "Regulatory\nWebsites (5)" as WEB
participant "EventBus" as EB
participant "Assessor Agent" as ASSESSOR
participant "Analyzer Agent" as ANALYZER
participant "Dispatcher Agent" as DISPATCHER
participant "Advisor Agent" as ADVISOR
participant "Notifier Agent" as NOTIFIER
participant "Pinecone\n(Vector DB)" as PINE
participant "OpenAI LLM" as LLM
participant "MySQL Database" as DB
participant "PII Filter" as PII

CRON -> SCRAPER: trigger (every 14 days / startup)
SCRAPER -> WEB: axios GET (scrape 5 sources, follow links)
WEB --> SCRAPER: HTML pages
SCRAPER -> SCRAPER: cheerio parse, strip boilerplate, extract content
SCRAPER -> DB: SELECT content WHERE title + source_id (check existing)
alt Content changed (contentSignificantlyDifferent = true)
  SCRAPER -> LLM: detectChanges(old_content, new_content)
  LLM --> SCRAPER: structured diff {added, removed, modified, deadline}
  SCRAPER -> DB: UPDATE regulations (new content, incremented version)
  SCRAPER -> PINE: embed updated regulation
  SCRAPER -> EB: emit "regulation.updated" {old_content, new_content, diff}
else New regulation
  SCRAPER -> DB: INSERT INTO regulations
  SCRAPER -> PINE: embed new regulation
  SCRAPER -> EB: emit "regulation.new"
else No change
  SCRAPER -> SCRAPER: skip (content identical)
end

EB -> ASSESSOR: regulation.new / regulation.updated
ASSESSOR -> PII: scan content
ASSESSOR -> PINE: retrieve relevant policy chunks (RAG)
ASSESSOR -> LLM: 3-step pipeline (Classify → Assess → Verify)
LLM --> ASSESSOR: impact_score, affected_areas, deadline, confidence
ASSESSOR -> DB: INSERT regulation_changes + alerts
ASSESSOR -> EB: emit "impact.assessed", "alert.created"

EB -> ANALYZER: regulation.new / regulation.updated
ANALYZER -> DB: SELECT all policies
ANALYZER -> LLM: select 2-5 relevant policies
ANALYZER -> LLM: 3-step gap analysis (Extract → Compare → Verify)
LLM --> ANALYZER: gaps [{description, gap_type, severity, policy_name}]
ANALYZER -> DB: INSERT compliance_gaps (linked to best-match policy)
ANALYZER -> EB: emit "gap.created"

EB -> DISPATCHER: alert.created, gap.created
DISPATCHER -> DISPATCHER: buffer 2-5 seconds, group by category
DISPATCHER -> LLM: generate consolidated task titles
DISPATCHER -> DB: INSERT tasks (linked via task_alerts, task_gaps)

EB -> ADVISOR: gap.created (2+ in same category)
ADVISOR -> LLM: propose new/updated policy with procedures
ADVISOR -> DB: INSERT policy_proposals

EB -> NOTIFIER: alert.created (Critical/High)
NOTIFIER -> NOTIFIER: buffer alerts for email digest
@enduml
**Sequence Diagram — LLM-Powered Gap Analysis:**

```
@startuml
actor "Compliance Officer" as CO
participant "Frontend\nDashboard" as FE
participant "Express API\n(routes/gaps.js)" as API
participant "PII Filter" as PII
participant "OpenAI LLM" as LLM
participant "MySQL Database" as DB
participant "Audit Logger" as AUDIT

CO -> FE: Click "Analyze Gap" (select regulation + policy)
FE -> API: POST /api/compliance-gaps/analyze {reg_id, policy_id}
API -> DB: SELECT regulation content WHERE reg_id
API -> DB: SELECT policy description WHERE policy_id
API -> PII: scan regulation + policy text
alt PII detected
  PII --> API: BLOCKED (PII found)
  API --> FE: 400 {error: "PII detected, content blocked"}
  FE --> CO: Error toast notification
else No PII
  PII --> API: content clean
  API -> LLM: POST /chat/completions\n("Compare this regulation against this policy.\nIdentify compliance gaps.")
  LLM --> API: gap analysis response (gaps identified, severity, recommendations)
  API -> AUDIT: log LLM call (input, output, reg_id, policy_id, timestamp)
  API -> DB: INSERT INTO compliance_gaps (auto-generated gaps)
  API --> FE: 201 {gaps: [...], llm_analysis: "..."}
  FE --> CO: Display gaps with LLM recommendations
end
@enduml
```

---

## 4. System Testing

**Test Strategy**

System testing was conducted during Sprint 3 (Week 5) across four categories:

**4.1 CRUD Operation Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Create a new task with title, assignee, and deadline | Task appears in task list | Task created and displayed | Pass |
| Update alert status from Unread to Read | Status updates, summary cards refresh | Status updated correctly | Pass |
| Delete a task after confirmation | Task removed from database and list | Task deleted successfully | Pass |
| Create a compliance gap linking regulation to policy | Gap appears in gaps table | Gap created with correct links | Pass |
| Add a new regulatory source | Source appears in sources table | Source added successfully | Pass |
| Edit an existing regulation | Updated fields reflected in table | Regulation updated correctly | Pass |
| Add a new internal policy | Policy appears in policies table | Policy created successfully | Pass |
| Update gap status from Open to Remediated | Status badge changes color | Status updated correctly | Pass |

**4.2 Feed Integrator Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Server startup triggers feed integration | MAS source scraped, data inserted | 30+ MAS regulations inserted on first run | Pass |
| Duplicate regulation detected | Skipped with log message | "Skipping duplicate" logged correctly | Pass |
| Source unreachable (403/404) | Fallback data used, no crash | Fallback activated, system continued | Pass |
| Second run with no new data | All items skipped as duplicates | 0 new insertions, all skipped | Pass |

**4.3 Authentication Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Login with valid credentials | Dashboard loads, user badge shown | Login successful | Pass |
| Login with wrong password | Error message displayed | "Invalid email or password" shown | Pass |
| Login with non-existent email | Error message displayed | "Invalid email or password" shown | Pass |
| Logout | Login overlay reappears | Logged out successfully | Pass |

**4.4 UI/UX Testing**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| Dark mode toggle | All views switch to dark theme | Dark mode applied correctly | Pass |
| Pagination on tables with 10+ items | Page controls appear, 10 items per page | Pagination working | Pass |
| Impact filter (Critical/High/Medium/Low) | Table filters to selected level | Filtering works correctly | Pass |
| Print report generation | Formatted report opens in print dialog | Report generated with all 5 sections | Pass |
| CSV export | File downloads with alert data | CSV downloaded successfully | Pass |
| Responsive sidebar on small screen | Sidebar collapses to icons | Responsive behavior correct | Pass |

---

## 5. User and Technical Documentation

### 5.1 User Documentation/Guide/Manual

**Getting Started**

1. Open the dashboard by navigating to the deployed URL or localhost:3000
2. Log in with your credentials (e.g., officer@gldb.com / 123456)
3. The Alerts view loads by default showing all regulatory alerts with severity badges

**Dashboard Navigation**

The left sidebar provides access to 10 views:
- **Alerts** — View, filter, and manage regulatory alerts by severity and status. Bulk actions (Mark All Read, Dismiss Info). Send email digest.
- **Reports** — 4 sub-tabs: Regulatory Changes, Gap Analysis, Task Progress, Compliance Posture. KPI cards and Chart.js visualizations.
- **Tasks** — Auto-generated and manual tasks with linkage badges (🔗 gaps, 📋 changes). Status workflow: Pending → In Progress → Completed.
- **Gaps** — AI-identified compliance gaps with 5 types, severity, progress bar, and remediation task linking.
- **Sources** — View and manage the 5 regulatory authority sources being monitored.
- **Regulations** — Knowledge base with filters (category, source, status), detail panel, and related changes/gaps.
- **Changes & Impact** — Detected changes with summary cards, impact filters, side-by-side diff (Previous vs Current Version), structured diff (Added/Removed/Modified), and auto-task visibility.
- **Policies** — Card-based policy management with expandable procedures, 🤖 AI badge, version history, and AI proposal review (accept/reject).
- **Audit Trail** — Full agent activity breakdown, 3 view modes (Table, Timeline, Response Chain), AI vs Human filter, printable audit report.

**Key Features**
- Click the moon/sun icon in the header to toggle dark mode
- Use the Export CSV button on the Alerts view to download alert data
- Click Print Report on the Reports view to generate a formatted compliance report
- All tables support pagination with page navigation controls
- "Send Test Alert Email" sends a formatted digest to the configured Gmail recipient
- Manual scrape trigger available via Menu button for immediate re-scrape

### 5.2 Technical Documentation (Installation Guide)

**Prerequisites:**
- Node.js v18 or higher
- MySQL v8 or higher (or access to the shared Azure database)
- Git

**Installation Steps:**

1. Clone the repository:
   ```
   git clone https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System-V2.git
   ```
2. Navigate to the project folder:
   ```
   cd Automated-Regulatory-and-Compliance-Management-System-V2
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Configure .env with database credentials, OpenAI API key, Pinecone API key, and Gmail credentials
5. Run schema.sql in MySQL Workbench against the target database (creates 13 tables + seeds data)
6. Start the server:
   ```
   npm start
   ```
7. Access the dashboard at localhost:3000 (or the deployed Azure URL)

**Project Structure:**
- server.js — Express app entry point + agent startup
- db.js — MySQL connection pool
- agents/ — 7 autonomous AI agents + orchestrator + EventBus
- routes/ — 11 API route modules
- middleware/ — Shared audit logging
- services/ — RAG engine, PII filter, notification service
- frontend/ — Decoupled HTML/CSS/JS dashboard

### 5.3 Generative AI Usage Declaration

| Generative AI Tool Used | How the Output Was Used |
|------------------------|------------------------|
| Kiro (AI-powered IDE) | Used for code generation, debugging, and refactoring of Node.js backend routes, Express server setup, MySQL schema design, frontend JavaScript logic, CSS styling, and feedIntegrator.js scraping service. All generated code was reviewed, tested, and modified by the team. |
| Kiro (AI-powered IDE) | Used for generating project documentation including product backlog user stories, sprint planning, functional requirements, business rules, system architecture descriptions, and this report template. All content was reviewed and adapted by the team. |
| Gemini AI | Used for researching and verifying market analysis statistics (RegTech market size, MSME demographics, digital bank license information, compliance cost data). All statistics were cross-referenced with original sources. |

### 5.4 Git Repository

**Repository URL:** https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System-V2

**Deployed URL:** https://automated-regulatory-and-compliance-bj0l.onrender.com

**Branch Strategy:** Single main branch with direct deployment.

**Commit History:** All code changes are tracked with descriptive commit messages.

---

## 6. Conclusions

The Automated Regulatory Monitoring and Compliance Management System successfully addresses the core business problem of manual regulatory tracking at Green Link Digital Bank. The system automates the entire compliance monitoring lifecycle — from multi-source data ingestion, content-based change detection with LLM-powered semantic diff, 3-step RAG-enhanced impact assessment, AI-powered cluster gap analysis against 13 internal policies, auto-task generation, and policy advisory — all orchestrated by 7 autonomous agents communicating via an event-driven architecture.

Key achievements:
- Built a fully functional 11-module compliance platform with 30+ REST API endpoints, deployed on Azure App Service
- Implemented 7 autonomous AI agents (Scraper, Assessor, Analyzer, Dispatcher, Advisor, Versioner, Notifier) with event-driven pub/sub orchestration
- Automated web scraping from 5 regulatory sources (MAS, FATF, FinCEN, ECB, FCA) with full page content extraction and PDF/binary file rejection
- Developed content-based change detection that compares actual regulatory text (not version numbers) and produces structured LLM-powered diffs with old vs new version comparison
- Implemented a 3-step LLM impact assessment pipeline (Classify → Assess → Verify) with confidence scoring, deadline extraction, and 23-term affected areas vocabulary
- Built AI-powered cluster gap analysis comparing regulations against all relevant internal policies (not just one), with 5 gap type classifications and policy-specific linking
- Developed auto-task generation (Dispatcher) that consolidates related Critical/High changes into minimum tasks with LLM-generated verb-led titles
- Implemented AI Policy Advisor that proposes new or updated policies with structured procedures when gaps accumulate
- Built a complete RAG pipeline using Pinecone (cloud-hosted) vector database with OpenAI text-embedding-3-small for context-aware assessments
- Implemented PII detection and filtering (NRIC, phone, email, postal codes, credit cards, passports) for PDPA compliance
- Developed email notification system (Gmail SMTP) with formatted HTML digest for Critical/High alerts
- Built a professional 10-view dashboard with login, dark mode, pagination, Chart.js visualizations, CSV export, print reports, and responsive sidebar
- Deployed to Azure App Service with Azure MySQL for production access
- Seeded 13 comprehensive internal policies covering AML/CFT, KYC, transaction monitoring, STR, sanctions, data privacy, green finance, credit risk, cybersecurity, wholesale banking, wire transfers, record keeping, and third-party risk management
- Implemented comprehensive audit logging of all agent actions, LLM interactions, and user actions for MAS traceability requirements

The system demonstrates that automated compliance monitoring powered by a multi-agent AI architecture is not only technically feasible for a Digital Wholesale Bank but is an operational necessity. By replacing manual regulatory tracking with 7 autonomous agents, GLDB can maintain its competitive advantage in execution speed while ensuring continuous compliance with MAS and international regulatory requirements.

**Future Enhancements:**
- PDF document parsing for Notices and Circulars
- Multi-language regulation support
- Compliance dashboard analytics with historical trend charts
- Integration with GRC (Governance, Risk, Compliance) platforms
- SharePoint integration for automatic internal policy retrieval
- Real-time WebSocket notifications for new alerts
- Role-based access control with restricted views per role

**Industry Partner Feedback (Meeting with Patrick, GLDB):**
- Confirmed all functional requirements are aligned with GLDB's needs
- Recommended phased approach: start with MAS regulations and sample PMPs before expanding
- Suggested integrating LLMs for analysis and comparison (multiple models may be needed)
- Emphasized PII guardrails and audit trail for LLM usage
- Offered to provide sample PMPs for validation
- Agreed the initial goal is a working POC/pilot, not a complete product
- Suggested future SharePoint integration for automatic knowledge base updates
