# Automated Regulatory Monitoring and Compliance Management System

**Green Link Digital Bank (GLDB) — MAS-Licensed Digital Wholesale Bank, Singapore**

---

## Table of Contents

- [Motivation](#motivation)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Technical Highlights](#technical-highlights)
- [Getting Started](#getting-started)
- [Demo](#demo)
- [Roadmap](#roadmap)
- [License](#license)

---

## Motivation

Financial institutions must comply with regulations from multiple international authorities (MAS, FATF, FinCEN, ECB, FCA). Manual monitoring is slow, expensive, and error-prone. For GLDB — a Digital Wholesale Bank serving 369,500+ Singapore MSMEs — any delay in detecting regulatory changes risks fines, license revocation, and operational disruption.

This system eliminates manual compliance tracking by deploying 7 autonomous AI agents that scrape, assess, analyze, and act on regulatory changes without human intervention.

---

## Features

- **Multi-Source Scraping** — Automatically retrieves regulations from 5 authorities (MAS, FATF, FinCEN, ECB, FCA)
- **Content-Based Change Detection** — Compares actual text to detect real changes, produces LLM-powered structured diff
- **3-Step Impact Assessment** — Classify → Assess → Verify pipeline with RAG + GPT-4o-mini
- **AI Gap Analysis** — Cluster-based comparison against all 13 internal policies (5 gap types)
- **Auto-Task Generation** — Consolidated remediation tasks for Critical/High changes
- **AI Policy Advisory** — Proposes new/updated policies with structured procedures (human approval required)
- **Side-by-Side Diff View** — Previous Version vs Current Version comparison
- **Email Digest** — Formatted HTML summary of Critical/High alerts on demand
- **PII Filtering** — Blocks personal data before reaching OpenAI (PDPA compliance)
- **Full Audit Trail** — Every agent action and LLM call logged with response chain tracing
- **10-View Dashboard** — Alerts, Reports, Tasks, Gaps, Sources, Regulations, Changes & Impact, Policies, Audit Trail

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
│                     Versioner + Advisor              │
│                                                     │
│  Communication: EventBus (publish/subscribe)        │
└──────────────────────┬──────────────────────────────┘
                       │ SQL + embeddings
                       ▼
┌─────────────────────────────────────────────────────┐
│              DATA LAYER                              │
│  MySQL (13 tables)  ·  Pinecone (vector search)     │
└──────────────────────┬──────────────────────────────┘
                       │ queries
                       ▼
┌─────────────────────────────────────────────────────┐
│              API LAYER (routes/)                      │
│  30+ REST endpoints · Express.js · Audit middleware  │
└──────────────────────┬──────────────────────────────┘
                       │ JSON
                       ▼
┌─────────────────────────────────────────────────────┐
│              FRONTEND (frontend/)                     │
│  Bootstrap 5 · Chart.js · Vanilla JS · Dark Mode    │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
├── server.js                  # Express entry point — starts agents + routes
├── db.js                      # MySQL connection pool (Azure)
├── schema.sql                 # Full database schema (13 tables) + seed data
├── .env                       # Credentials (DB, OpenAI, Pinecone, Email)
│
├── agents/                    # 🤖 7 autonomous agents
│   ├── orchestrator.js        # Starts all agents in correct order
│   ├── eventBus.js            # Shared pub/sub event channel
│   ├── scraper.js             # Scrapes 5 sources, content-based change detection
│   ├── assessor.js            # 3-step impact scoring (Classify → Assess → Verify)
│   ├── analyzer.js            # Cluster gap analysis vs relevant policies
│   ├── dispatcher.js          # Auto-generates consolidated tasks
│   ├── advisor.js             # Proposes policies with procedures
│   ├── versioner.js           # Snapshots policy history
│   └── notifier.js            # Email digest on demand
│
├── routes/                    # REST API (30+ endpoints)
│   ├── auth.js, alerts.js, dashboard.js, regulations.js
│   ├── changes.js, tasks.js, gaps.js, sources.js
│   ├── policies.js, proposals.js, audit.js
│
├── services/                  # Shared services
│   ├── ragEngine.js           # Pinecone + OpenAI embeddings + retrieval
│   ├── piiFilter.js           # PII detection (NRIC, phone, email)
│   └── notificationService.js # Gmail SMTP email
│
├── middleware/
│   └── auditLog.js            # Shared audit logging
│
├── frontend/                  # Dashboard (no framework, no build step)
│   ├── index.html             # 10 views + login
│   ├── script.js              # All frontend logic
│   └── styles.css             # Dark mode, responsive
│
└── Documentation/             # Project docs (reports, test plans, backlog)
```

---

## Technical Highlights

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js v18+ | Server-side JavaScript |
| Framework | Express.js | REST API |
| Database | MySQL (Azure) | 13 tables with foreign keys |
| Vector DB | Pinecone (cloud) | Semantic search for RAG |
| AI/LLM | OpenAI GPT-4o-mini | Impact assessment, gap analysis, task generation, policy advisory, change diff |
| Embeddings | text-embedding-3-small | 1536-dim vectors for Pinecone |
| Auth | bcryptjs | Password hashing |
| Scraping | axios + cheerio | Web scraping 5 regulatory sites |
| Scheduling | node-cron | 14-day automated scraping cycle |
| Email | nodemailer | Gmail SMTP alert digest |
| Frontend | Bootstrap 5 + Vanilla JS + Chart.js | Dashboard UI |
| PII | Custom regex filter | Blocks NRIC/phone/email before OpenAI |
| Deployment | Azure App Service + Render | Cloud hosting |

### The 7 Agents

| Agent | What It Does | Triggers On |
|-------|-------------|-------------|
| Scraper | Scrapes 5 sources, detects content changes, produces LLM diff | Cron (14 days) + startup |
| Assessor | 3-step impact scoring with RAG, penalty detection, deadline extraction | `regulation.new`, `regulation.updated` |
| Analyzer | Cluster gap analysis — 5 types, links to most relevant policy | `regulation.new`, `regulation.updated` |
| Dispatcher | Buffers alerts/gaps, generates consolidated tasks via LLM | `alert.created`, `gap.created` |
| Advisor | Proposes policies with procedures when 2+ gaps accumulate | `gap.created` |
| Versioner | Snapshots old policy content before edits | `policy.updated` |
| Notifier | Buffers Critical/High alerts, sends email digest on demand | `alert.created` |

### RAG Pipeline

```
1. CHUNK — Split text into ~500 char segments
2. EMBED — Convert to vectors (text-embedding-3-small)
3. STORE — Save in Pinecone (2 namespaces: regulations, policies)
4. RETRIEVE — Cosine similarity search on query
5. AUGMENT — Combine retrieved chunks into LLM prompt
6. GENERATE — GPT-4o-mini produces assessment/gap analysis
7. GUARD — PII filter blocks personal data before step 6
8. LOG — Every LLM call logged to audit_logs
```

### Regulatory Sources

| Source | Region | Status |
|--------|--------|--------|
| MAS (Monetary Authority of Singapore) | Singapore | Active |
| FATF (Financial Action Task Force) | Global | Active |
| FinCEN (Financial Crimes Enforcement Network) | US | Active |
| ECB (European Central Bank) | Europe | Active |
| FCA (Financial Conduct Authority) | UK | Active |

---

## Getting Started

### Prerequisites
- Node.js v18+
- MySQL 8+ (or access to Azure database)

### Install
```bash
npm install
```

### Configure
Edit `.env` with your credentials (DB, OpenAI, Pinecone, Gmail).

### Database
Run `schema.sql` in MySQL Workbench.

### Start
```bash
npm start
```

### Login
| Role | Email | Password |
|------|-------|----------|
| Compliance Officer | officer@gldb.com | 123456 |
| Internal Auditor | auditor@gldb.com | 123456 |
| Admin | admin@gldb.com | 123456 |

---

## Demo

**Live:** https://automated-regulatory-and-compliance-bj0l.onrender.com

**GitHub:** https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System-V2

---

## Roadmap

- Multi-language regulation support (Mandarin, Malay)
- SharePoint integration for auto-syncing internal policies
- Role-based access control (Admin, Officer, Auditor)
- Expanded sources (BIS, HKMA, APRA)
- Compliance trend analytics over time
- GRC platform integration (ServiceNow, Archer)

---

## License

Internal use only — Green Link Digital Bank Pte. Ltd. © 2026
