# Technical Guide — GLDB Compliance System

## 1. System Requirements

| Component | Requirement |
|-----------|-------------|
| Runtime | Node.js v18+ |
| Database | MySQL 8+ (Azure or local) |
| Vector DB | Pinecone (cloud-hosted) |
| AI/LLM | OpenAI API key (GPT-4o-mini) |
| Email | Gmail account with App Password |
| Browser Engine | Puppeteer (bundled Chromium for URL scraping) |
| OS | Windows / macOS / Linux |

---

## 2. Project Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/MinThu63/Automated-Regulatory-and-Compliance-Management-System-V2.git
cd Automated-Regulatory-and-Compliance-Management-System-V2
```

### Step 2: Install Dependencies
```bash
npm install
```
This installs all required packages including: express, mysql2, openai, puppeteer, pdf-parse, multer, axios, cheerio, nodemailer, bcryptjs, node-cron, @pinecone-database/pinecone.

<<Put Screenshot of Terminal showing npm install completion>>

### Step 3: Configure Environment Variables

Create a `.env` file in the project root with:
```
DB_HOST=your-mysql-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
DB_PORT=3306
API_PORT=3000

OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini

PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX=gldb-compliance

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_RECIPIENT=your-email@gmail.com
```

> **Important:** Never commit the `.env` file to version control. It is excluded via `.gitignore`.

### Step 4: Set Up the Database

Open MySQL Workbench or any MySQL client and run:
```sql
source schema.sql;
```

This creates:
- The database `SOI-2026-0039-MinThu`
- 14 tables (users, regulations, regulation_changes, alerts, internal_policies, compliance_gaps, tasks, audit_logs, departments, task_gaps, task_alerts, policy_proposals, policy_versions)
- Seed data (3 users, 5 regulatory sources, 1 seed regulation, 15 internal policies with procedures, 3 training programs, 6 departments)

<<Put Screenshot of MySQL Workbench showing tables created>>

### Step 5: Set Up Pinecone

1. Go to https://app.pinecone.io
2. Create an index named `gldb-compliance`
3. Dimension: 1536 (for text-embedding-3-small)
4. Metric: cosine
5. Copy the API key to your `.env`

### Step 6: Set Up Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Copy the 16-character password to `EMAIL_PASS` in `.env`

---

## 3. Running the Server

### Local Development
```bash
npm start
```

Expected output:
```
Server is running on port 3000
Database connected successfully to SOI-2026-0039-MinThu
╔══════════════════════════════════════════╗
║   AGENTIC SYSTEM — Starting Agents       ║
╚══════════════════════════════════════════╝
[Orchestrator] All 7 agents active
[Orchestrator] Flow: Scraper → Assessor → Analyzer → Dispatcher/Advisor → Notifier
[RAG] Pinecone connected — Index: gldb-compliance
```

<<Put Screenshot of Terminal showing server started successfully>>

### Production (Render)
The system is deployed at: `https://automated-regulatory-and-compliance-bjn0.onrender.com`

Render configuration:
- Build Command: `npm install && npx puppeteer browsers install chrome`
- Start Command: `node server.js`
- Environment variables set in Render dashboard

---

## 4. System Architecture

```
├── server.js              — Express entry point, starts agents
├── db.js                  — MySQL connection pool
├── schema.sql             — Database schema + seed data
│
├── agents/                — 7 Autonomous AI Agents
│   ├── orchestrator.js    — Starts all agents
│   ├── eventBus.js        — Shared pub/sub communication
│   ├── scraper.js         — Scrapes 5 regulatory sources
│   ├── assessor.js        — 3-step impact assessment (Classify→Assess→Verify)
│   ├── analyzer.js        — AI-powered gap detection (5 types)
│   ├── dispatcher.js      — Consolidated task generation
│   ├── advisor.js         — Policy proposal generation
│   ├── versioner.js       — Policy version history
│   └── notifier.js        — Email digest buffering
│
├── routes/                — REST API endpoints
│   ├── auth.js            — Login
│   ├── alerts.js          — Alerts CRUD + bulk actions
│   ├── changes.js         — Changes & Impact + View Diff
│   ├── regulations.js     — Knowledge base + PDF upload + URL scrape
│   ├── tasks.js           — Tasks with auto-remediation
│   ├── gaps.js            — Gaps + AI analysis
│   ├── policies.js        — Policies + version history
│   ├── proposals.js       — AI proposal Accept/Reject
│   ├── audit.js           — Audit trail + response chain
│   ├── dashboard.js       — Summary stats
│   └── sources.js         — Regulatory sources
│
├── services/              — Shared services
│   ├── ragEngine.js       — Pinecone RAG pipeline
│   ├── piiFilter.js       — PII detection
│   └── notificationService.js — Gmail SMTP
│
├── frontend/              — Static dashboard UI
│   ├── index.html         — 9-tab dashboard
│   ├── script.js          — All frontend logic
│   └── styles.css         — Styling + dark mode
│
└── middleware/
    └── auditLog.js        — Audit logging utility
```

---

## 5. Agent Pipeline Flow

```
Scraper (regulation.new / regulation.updated)
    → Assessor (3-step AI: classify, assess, verify)
        → Creates alert + regulation_changes row
    → Analyzer (AI selects policies, cluster gap analysis)
        → Creates compliance_gaps
    → Dispatcher (buffers Critical/High, groups by category)
        → Creates consolidated tasks
    → Advisor (proposes policy updates with procedures)
        → Creates policy_proposals
    → Notifier (buffers for email digest)
```

All agents communicate via `eventBus.js` (Node.js EventEmitter). No agent calls another directly.

---

## 6. Database Schema Overview

| Table | Purpose |
|-------|---------|
| users | 3 roles: Compliance Officer, Internal Auditor, Admin |
| regulatory_sources | 5 sources: MAS, FATF, FinCEN, ECB, FCA |
| regulations | Scraped/uploaded regulation content |
| regulation_changes | Version diffs with impact scores + old/new content |
| alerts | Auto-generated, severity-categorised |
| internal_policies | 15 policies + 3 training programs with procedures |
| compliance_gaps | AI-identified gaps (5 types) |
| tasks | Remediation tasks (auto + manual) |
| audit_logs | Full action trail (AI + human) |
| departments | 6 departments with category mapping |
| task_gaps | Junction: tasks ↔ gaps (many-to-many) |
| task_alerts | Junction: tasks ↔ alerts (many-to-many) |
| policy_proposals | AI-drafted proposals pending review |
| policy_versions | Historical snapshots of policy edits |

<<Put Screenshot of Database ERD or table list in MySQL Workbench>>

---

## 7. Key API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/login | Authenticate user |
| GET | /api/alerts | List all alerts with department + task info |
| PATCH | /api/alerts/bulk | Bulk update alert statuses |
| GET | /api/regulation-changes/impact | Changes with auto-task linkage |
| GET | /api/regulation-changes/detail/:id | Full diff detail (old + new content) |
| POST | /api/regulations/upload-pdf | Upload PDF regulation |
| POST | /api/regulations/scrape-url | Scrape URL with Puppeteer |
| GET | /api/compliance-gaps | List gaps with task linkage |
| POST | /api/compliance-gaps/analyze | Trigger AI gap analysis |
| GET | /api/tasks | List tasks with gap/alert linkages |
| GET | /api/internal-policies | List policies with version count + AI flag |
| GET | /api/policy-proposals | List pending AI proposals |
| POST | /api/policy-proposals/:id/accept | Accept + apply proposal |
| GET | /api/audit-logs/stats | Audit summary statistics |
| GET | /api/audit-logs/response-chain/:regId | Full compliance chain |
| POST | /api/admin/test-email | Send test email digest |

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to server" on login | Ensure server is running (`npm start`). Check port 3000. |
| "EADDRINUSE port 3000" | Kill existing node process: `taskkill /F /IM node.exe` |
| Blank affected areas | Restart server — AI backfill runs on startup for NULL rows |
| PDF upload fails | Ensure `pdf-parse` and `multer` are installed. Check file size < 10MB. |
| URL scrape fails | Puppeteer needs Chrome. Run `npx puppeteer browsers install chrome`. |
| Email fails (ENETUNREACH) | IPv6 issue — the system forces IPv4 (`family: 4` in SMTP config). |
| View Diff blank panels | Only shows content when both old + new versions exist in DB. Upload old version first, then new. |
| Render cold start (30s delay) | Normal for free tier. First request after inactivity takes time. |

---

## 9. Deployment Checklist (Render)

- [ ] Push code to GitHub
- [ ] Create Web Service on Render, connect repo
- [ ] Set Build Command: `npm install && npx puppeteer browsers install chrome`
- [ ] Set Start Command: `node server.js`
- [ ] Add all environment variables in Render dashboard
- [ ] Verify Azure MySQL allows Render's IP (or set to allow all)
- [ ] Test login at the Render URL
- [ ] Verify all 7 agents start (check Render logs)
- [ ] Test email notification (Send Test Alert Email button)

<<Put Screenshot of Render Dashboard showing service running>>

---

## 10. Maintenance

### Adding New Regulatory Sources
Add via the Sources tab UI or directly in `regulatory_sources` table.

### Updating Internal Policies
Edit via Policies tab → auto-versions old content. Or accept AI proposals.

### Monitoring Agent Activity
Check Audit Trail → Agent Activity Breakdown for counts per agent.

### Backup
- Database: Azure handles backups automatically
- Code: GitHub repository
- Pinecone vectors: regenerated on server startup from DB content
