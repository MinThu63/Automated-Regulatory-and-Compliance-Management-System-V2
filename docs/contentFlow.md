Page 2 — Introduction
"Automated system that monitors MAS regulatory changes, assesses impact using AI (RAG + GPT), generates alerts, and helps compliance officers manage gaps and tasks."
One sentence on GLDB (MAS-licensed Digital Wholesale Bank serving MSMEs)
One sentence on the problem (manual tracking is slow, risky, error-prone)

Page 3 — Project Specification
Use Case Diagram (the PlantUML one we made)
Brief breakdown: 9 modules, 11 functional requirements, 11 business rules
Mention phased approach (MAS only for Phase 1)

Page 4 — Business Analysis
Business issue: manual compliance monitoring threatens GLDB's speed advantage
Market: RegTech market USD 15.8B → 85.9B by 2032
Solution: automated pipeline replacing manual tracking

Page 5 — System Design
Architecture diagram (the one with MAS → Automation → RAG → LLM → MySQL/Chroma → API → Frontend)
ERD (9 tables with relationships)
Tech stack table (Node.js, Express, MySQL, Chroma, OpenAI, Bootstrap)

Pages 6–9 — Task Allocation (already done ✅)

Page 10 — Meeting Records
Fill in your actual meeting dates with supervisor
Mark attendance for each member

Page 11 — Prototype Demo
Live demo: start Chroma → start server → open dashboard → login
Show: alerts view, gap analysis (trigger the RAG endpoint), audit trail showing LLM logs
Show terminal output proving MAS scraping and embedding works

---

## Live Demo — Who Presents What

### Min Thu | Lead Developer & AI/RAG Architect
**Demo: System startup + Feed Integration + RAG pipeline**

1. Start Chroma server (`chroma run --path ./chroma_data --port 8000`)
2. Start the app (`npm start`)
3. Show terminal output:
   - Server connected to database
   - Chroma collections initialized
   - Regulations and policies embedded into Chroma
   - MAS scraping triggered, items fetched
4. Show Sources view (MAS as the only source)
5. Show Regulations view (scraped MAS notices, search, pagination)
6. Trigger gap analysis (explain RAG flow: PII filter → Chroma retrieval → GPT → gaps created)
7. Show Audit Trail — point out LLM call logs (input, output, timestamp)

---

### Eaint | Alerts, Impact & Audit Module
**Demo: Alerts + Impact + Audit Trail**

1. Show Alerts view — severity badges (color-coded)
2. Filter alerts by severity (Immediate Action Required / Review Recommended / Informational)
3. Filter alerts by status (Unread / Read / Dismissed)
4. Update an alert status (click dropdown → change to Read)
5. Show Impact Assessment view — summary cards (Critical, High, Medium, Low counts)
6. Filter impact by level
7. Show Audit Trail view — filter by action type, show LLM logs

---

### Kay | Tasks, Reports & UI Features
**Demo: Tasks + Reports + UI features**

1. Show Tasks view — list of tasks with assignees and deadlines
2. Create a new task (fill form, assign to user, set deadline)
3. Update task status (Pending → In Progress)
4. Delete a task
5. Show Reports view — switch between tabbed pages (Overview, Trends, Categories, Status)
6. Show Chart.js charts (pie, bar, line, doughnut)
7. Click Print Report — show print dialog
8. Click Export CSV — show file download
9. Toggle Dark Mode on/off

---

### Hsu | Knowledge Base, Gaps & Compliance
**Demo: Regulations + Policies + Gaps + Changes**

1. Show Regulations view — browse, search by keyword, paginate
2. Add a new regulation (fill form, submit)
3. Edit an existing regulation
4. Show Policies view — list of 8 GLDB internal policies
5. Show Changes view — version diffs with impact scores
6. Show Gaps view — list of compliance gaps (including the ones GPT just created)
7. Update a gap status (Open → In Review → Remediated)
8. Show the "Analyze Gap" button (select regulation + policy, trigger RAG)

---

## Demo Flow Order (Suggested)

1. **Min Thu** — starts everything, shows terminal, explains architecture
2. **Eaint** — takes over browser, shows alerts and impact
3. **Kay** — shows tasks, reports, charts, dark mode
4. **Hsu** — shows regulations, policies, gaps, triggers gap analysis
5. **Min Thu** — wraps up, shows audit trail with LLM logs, explains RAG pipeline

---

## Demo Checklist (Before Presentation)

- [ ] Chroma server running on port 8000
- [ ] `npm start` runs without errors
- [ ] OpenAI credits working (no 429 errors)
- [ ] Dashboard loads, login works
- [ ] At least 1 gap analysis has been run (so gaps view has data)
- [ ] Audit trail has LLM log entries to show
- [ ] Dark mode toggle works
- [ ] Charts render correctly
