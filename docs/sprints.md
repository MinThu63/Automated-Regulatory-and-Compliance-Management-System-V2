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
Sprint 2: Frontend & Views (FYP-EXCELSHEET (1).pdf)
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
Sprint 3: Additional Features, Testing & Polish (FYP-EXCELSHEET (2).pdf)
User Story ID	Sprint Backlog Item	Assign To	Est. Effort-hour	Day 1	Day 2	Day 3	Day 4	Priority
23	As a compliance officer, I want to export alerts as a CSV file, so that I can share compliance data with management offline.	Eaint	2	1	0	0	0	Should Have
24	As a compliance officer, I want to print a formatted compliance report from the Reports view, so that I can present findings in management meetings.	Kay	3	2	1	0	0	Should Have
22	As a compliance officer, I want to toggle dark mode on the dashboard, so that I can work comfortably in low-light environments.	Hsu	2	1	0	0	0	Nice to Have
25	As a compliance officer, I want all tables to display data page by page with pagination controls, so that I can navigate large datasets efficiently.	Hsu	3	2	1	0	0	Nice to Have
N/A	Test all CRUD operations: alerts (view, filter, update status)	Eaint	3	2	1	0	0	Must Have
N/A	Test all CRUD operations: tasks (create, update status, delete, deadline highlighting)	Kay	3	2	1	0	0	Must Have
N/A	Test all CRUD operations: gaps (create, update status), policies (create, edit)	Hsu	3	2	1	0	0	Must Have
N/A	Test all CRUD operations: regulations (create, edit, search, pagination), sources (create)	Hsu	3	2	1	0	0	Must Have
N/A	Test feed integrator: restart server, verify scraping populates all tabs (alerts, changes, impact, regulations)	Min Thu	3	2	1	0	0	Must Have
N/A	Test login with all 3 roles (officer, auditor, admin), test logout	Eaint	2	1	0	0	0	Must Have
N/A	Test edge cases: empty tables show No data found, invalid form inputs rejected, 404 API responses	Kay	3	2	1	0	0	Must Have
N/A	Test reports: all 5 charts render, tabbed pages switch, print report generates correctly	Kay	3	2	1	0	0	Must Have
N/A	Fix bugs found during testing	Min Thu	5	4	3	1	0	Must Have
N/A	UI polish: verify toast notifications, loading spinners, welcome banner, last synced timestamp	Min Thu	3	2	1	0	0	Must Have
N/A	Final integration test: full pipeline (scrape -> change detect -> impact assess -> alert -> task -> audit)	Min Thu	4	3	2	1	0	Must Have
N/A	Prepare demo script and walkthrough for mid-term evaluation	All (shared)	5	4	2	1	0	Must Have
Totals	Total Story Points: 11		56					

