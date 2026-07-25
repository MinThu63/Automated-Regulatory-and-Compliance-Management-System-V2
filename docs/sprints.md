Sprint 1: Backend & System Setup (FYP-EXCELSHEET.pdf)
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Day 5	Priority
20	As a compliance officer, I want the dashboard to have a professional sidebar navigation layout with 10 views, so that I can easily switch between different compliance management functions without page reloads. (Project setup: Express server, MySQL schema, db.js, .env, route structure)	Min Thu	4	3	1	0	0	0	Must Have
1	As a compliance officer, I want the system to automatically scrape regulatory updates from 7 international authorities (MAS, FATF, FinCEN, ECB, FCA, BIS, HKMA), so that the compliance team receives the latest regulatory data without manual effort.	Min Thu	5	4	3	0	0	0	Must Have
2	As a compliance officer, I want the system to automatically detect changes when a regulation is updated to a new version, so that I am aware of regulatory modifications that may affect the bank's compliance posture.	Min Thu	4	3	2	1	0	0	Must Have
3	As a compliance officer, I want the system to automatically assess the impact of each regulatory change using keyword analysis, so that high-risk changes are prioritized for immediate review.	Eaint	4	3	2	1	0	0	Must Have
4	As a compliance officer, I want the system to automatically generate alerts when new regulations are ingested or existing regulations are updated, so that the compliance team is notified of regulatory changes requiring attention.	Eaint	3	2	1	0	0	0	Must Have
14	As a compliance officer, I want to view and add regulatory sources, so that the system can track which authorities are being monitored. (Backend API: GET/POST)	Hsu	3	2	1	0	0	0	Must Have
15	As a compliance officer, I want to view, add, and edit regulations in the knowledge base, so that the compliance team has a centralized repository of all regulatory information. (Backend API: GET/POST/PUT with pagination)	Hsu	5	4	3	0	0	0	Must Have
18	As a compliance officer, I want to view and manage internal bank policies, so that I can reference and update them when performing compliance gap analysis. (Backend API: GET/POST/PUT)	Kay	3	2	1	0	0	0	Must Have
9	As a compliance officer, I want to view all outstanding compliance tasks with assignee and deadline information, so that I can monitor task progress and ensure timely completion. (Backend API: GET/POST/PATCH/DELETE)	Kay	5	4	3	1	0	0	Must Have
12	As a compliance officer, I want to view compliance gaps between regulations and internal policies, so that I can identify where the bank's policies fall short of regulatory requirements. (Backend API: GET/POST/PATCH)	Kay	4	3	2	1	0	0	Must Have
19	As a compliance officer, I want to view a searchable audit trail of all system actions with date and user filtering, so that the bank has a complete record for regulatory inspections and internal audits. (Backend API: GET with query filters)	Hsu	3	2	1	0	0	0	Must Have
8	As a compliance officer, I want to view a reports dashboard showing regulatory changes by category and alert trends over time, so that I can analyze compliance patterns and prepare management reports. (Backend API: summary, categories, trends)	Eaint	4	3	2	1	0	0	Must Have
Totals	Total Story Points: 24		47	35	22	7	0	0	

Sprint 2: Frontend & Views
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Priority
20	As a compliance officer, I want the dashboard to have a professional sidebar navigation layout with 10 views, so that I can easily switch between different compliance management functions without page reloads. (Frontend: sidebar, view switching, login page, welcome banner, footer)	Min Thu	5	4	2	0	1	Must Have
5	As a compliance officer, I want to view a list of all regulatory alerts with severity badges and status indicators, so that I can quickly identify which alerts require immediate attention.	Eaint	4	3	2	0	0	Must Have
6	As a compliance officer, I want to update the status of an alert (Unread, Read, Dismissed) directly from the dashboard, so that I can track which alerts have been reviewed.	Eaint	2	0	1	0	0	Must Have
7	As a compliance officer, I want to filter alerts by severity level and status, so that I can focus on the most critical alerts first.	Eaint	2	0	1	0	0	Must Have
8	As a compliance officer, I want to view a reports dashboard showing regulatory changes by category and alert trends over time, so that I can analyze compliance patterns and prepare management reports. (Frontend: 4 tabbed pages, 5 Chart.js charts)	Kay	5	4	2	0	1	Must Have
10	As a compliance officer, I want to add a new compliance task with an assignee and deadline, so that regulatory changes can be assigned to team members for action. (Frontend: add task form)	Kay	4	3	0	0	0	Must Have
11	As a compliance officer, I want to update the status of a task and delete completed or unnecessary tasks, so that the task list remains current and actionable. (Frontend: status dropdown, delete button)	Kay	2	2	0	0	0	Must Have
13	As a compliance officer, I want to add a new compliance gap and update gap statuses, so that identified gaps are tracked through to remediation. (Frontend: gap CRUD form and status dropdown)	Hsu	3	2	0	0	0	Must Have
16	As a compliance officer, I want to view all detected regulation changes with version history and impact scores, so that I can understand what changed between regulation versions.	Hsu	2	0	1	0	0	Must Have
17	As a compliance officer, I want to view an impact assessment dashboard with severity summary cards and prioritized sorting, so that I can quickly identify the highest-risk regulatory changes.	Hsu	3	2	1	0	0	Must Have
14 & 15	As a compliance officer, I want to view and add regulatory sources and view, add, and edit regulations in the knowledge base. (Frontend: Sources view + Regulations view with add/edit forms, search bar, pagination)	Min Thu	5	4	2	0	0	Must Have
18 & 19	As a compliance officer, I want to view and manage internal bank policies and view a searchable audit trail. (Frontend: Policies view with add/edit + Audit trail view with filter controls)	Min Thu	4	3	2	0	0	Must Have
Totals	Total Story Points: 28		41	29	14	0	3	

Sprint 3: Additional Features & Mid-Term Polish
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Priority
23	As a compliance officer, I want to export alerts as a CSV file, so that I can share compliance data with management offline.	Eaint	2	1	0	0	0	Should Have
24	As a compliance officer, I want to print a formatted compliance report from the Reports view, so that I can present findings in management meetings.	Kay	3	2	1	0	0	Should Have
22	As a compliance officer, I want to toggle dark mode on the dashboard, so that I can work comfortably in low-light environments.	Hsu	2	1	0	0	0	Nice to Have
25	As a compliance officer, I want all tables to display data page by page with pagination controls, so that I can navigate large datasets efficiently.	Hsu	3	2	1	0	0	Nice to Have
N/A	Test all CRUD operations across all views	All (shared)	6	4	2	0	0	Must Have
N/A	Test feed integrator pipeline end-to-end	Min Thu	3	2	1	0	0	Must Have
N/A	Fix bugs and UI polish for mid-term demo	Min Thu	5	4	3	1	0	Must Have
N/A	Prepare demo script and walkthrough for mid-term evaluation	All (shared)	5	4	2	1	0	Must Have
Totals	Total Story Points: 11		56					

Sprint 4: AI Agent Enhancement & Smart Pipeline (Start: 7/6/2026)
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Day 5	Priority
US3	Enhance Assessor agent: 3-step AI pipeline (Classify → Assess → Verify), penalty detection, deadline extraction, 23-term affected areas vocabulary, confidence scoring	Min Thu	8	6	5	3	1	0	Must Have
US7	Implement Analyzer agent: AI-powered policy selection (no hardcoded mapping), cluster-based gap analysis, 5 gap types (Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold)	Min Thu	8	6	5	3	1	0	Must Have
US9	Implement Dispatcher agent: buffer Critical/High alerts by category + department, LLM generates consolidated tasks, one task covers multiple changes, task_alerts + task_gaps linkage	Min Thu	6	5	4	2	0	0	Must Have
US12	Implement Policy Advisor agent: detect recurring gaps, propose New Policy or Policy Update with PROCEDURES (3-6 steps), limit to top 2-3 gaps, human-in-the-loop Accept/Reject	Eaint	6	5	4	2	0	0	Must Have
US18	Implement Notifier agent: buffer all Critical/High alerts, send ONE digest email on manual trigger, Gmail SMTP with App Password, formatted HTML digest	Eaint	4	3	2	1	0	0	Must Have
US11	Enhance Policies tab: card-based layout, expandable procedures, 🤖 AI badge, filter by history/AI-generated, version history with auto-versioning on Accept	Hsu	5	4	3	1	0	0	Must Have
US4	Enhance Alerts: department column, bulk actions (Mark All Read, Dismiss Info), relative timestamps, "View Change" navigation, email digest button	Kay	4	3	2	1	0	0	Must Have
N/A	Implement EventBus inter-agent communication + Orchestrator startup sequencing	Min Thu	3	2	1	0	0	0	Must Have
Totals	Total Story Points: 30		44	34	26	13	2	0	

Sprint 5: Change Detection, PDF Upload, URL Scraping & Reports (Start: 7/13/2026)
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Day 5	Priority
US6	Enhance Changes & Impact tab: 5 summary cards, 4 filters (impact/task/areas/search), View Diff old vs new side-by-side, structured diff, penalty badge, auto-task column	Min Thu	7	6	5	3	1	0	Must Have
US13	Implement PDF upload: text extraction (pdf-parse), smart version detection (LLM compares against existing), creates regulation_changes with old + new content, triggers full pipeline	Min Thu	6	5	4	2	0	0	Must Have
US14	Implement URL scraping: Puppeteer headless browser for JS-rendered pages, smart version detection, auto-detect title, category datalist with custom input	Min Thu	5	4	3	1	0	0	Must Have
US16	Rebuild Reports tab: 4 focused sub-tabs (Regulatory Changes, Gap Analysis, Tasks & Remediation, Compliance Posture), KPI cards, Chart.js charts, compliance score %, policy heatmap	Eaint	6	5	4	2	0	0	Must Have
US15	Enhance Regulations Knowledge Base: category/source/status filters, clickable titles → source, detail panel with content + related items, export CSV	Hsu	5	4	3	1	0	0	Must Have
US10	Enhance Tasks tab: clickable 🔗 gaps and 📋 changes linkage badges, navigate to related items, auto-remediate gaps on task completion	Kay	4	3	2	1	0	0	Must Have
US8	Enhance Gaps tab: 5 gap type filters, progress bar, "Create Task" modal linking gaps to tasks	Kay	4	3	2	1	0	0	Must Have
US19	Implement Home Page: GLDB branding, quick stats, "Go to Dashboard" button, sidebar hidden, GLDB logo returns to home	Hsu	3	2	1	0	0	0	Must Have
Totals	Total Story Points: 28		40	32	24	11	1	0	

Sprint 6: Testing, UI Polish, Deployment & Documentation (Start: 7/20/2026)
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Day 5	Priority
US17	Enhance Audit Trail: summary cards, agent breakdown, 3 view modes (Table/Timeline/Response Chain), AI vs Human filter, print audit report	Min Thu	5	4	3	1	0	0	Must Have
US20	UI enhancements: collapsible sidebar (☰ Menu), consistent table styling, sticky sidebar, increased font size, responsive design	Min Thu	4	3	2	1	0	0	Should Have
N/A	Full system integration test: Upload PDF → Assessor scores → Analyzer finds gaps → Dispatcher creates tasks → Advisor proposes policy → complete lifecycle	Min Thu	5	4	3	1	0	0	Must Have
N/A	Test penalty detection: upload regulation with penalty clauses, verify Critical scoring + PENALTY badge + 3-day task deadline	Eaint	3	2	1	0	0	0	Must Have
N/A	Test email notification: verify digest format, Gmail delivery, "Open Dashboard" link to Render URL	Eaint	2	1	0	0	0	0	Must Have
N/A	Test View Diff: upload old + new PDF versions, verify side-by-side comparison works	Hsu	3	2	1	0	0	0	Must Have
N/A	Test Response Chain: select regulation in Audit Trail, verify full chain (Scraped → Assessed → Gaps → Tasks → Status)	Hsu	2	1	0	0	0	0	Must Have
N/A	Test URL scraping with Puppeteer: verify MAS JS-rendered pages work on Render	Kay	3	2	1	0	0	0	Must Have
N/A	Render deployment: configure environment variables, test live system, verify all features work in production	Min Thu	4	3	2	1	0	0	Must Have
N/A	Generate test specification document (72 test cases), execute tests, capture screenshots	All (shared)	6	5	3	1	0	0	Must Have
N/A	Update README, product backlog, architecture diagrams, user journey flow	Min Thu	4	3	2	1	0	0	Must Have
N/A	Prepare final presentation, demo script, and project documentation	All (shared)	5	4	3	1	0	0	Must Have
Totals	Total Story Points: 21		46	34	21	7	0	0	

OVERALL SUMMARY
Sprint	Start Date	Story Points	Focus
Sprint 1	5/14/2026	24	Backend & System Setup
Sprint 2	5/21/2026	28	Frontend & Views
Sprint 3	5/28/2026	11	Additional Features & Mid-Term Polish
Sprint 4	7/6/2026	30	AI Agent Enhancement & Smart Pipeline
Sprint 5	7/13/2026	28	Change Detection, PDF Upload, URL Scraping & Reports
Sprint 6	7/20/2026	21	Testing, UI Polish, Deployment & Documentation
Total		142	

