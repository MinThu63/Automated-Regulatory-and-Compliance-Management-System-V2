User Story ID
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
23
24
22
25
User Story
As a compliance officer,
I want the system to automatically scrape regulatory updates from 7 international authorities (MAS, FATF, FinCEN,
ECB, FCA, BIS, HKMA),
so that the compliance team receives the latest regulatory data without manual effort.
Given that the server is running, when the automated cron job triggers (every 14 days or on startup), then the
feedIntegrator.js service scrapes regulatory websites, checks for duplicates, and inserts new regulations into the
MySQL database.
Acceptance Criteria:
â€¢ The system shall scrape regulatory data from 7 sources: MAS, FATF, FinCEN, ECB, FCA, BIS, and HKMA.
â€¢ The system shall use node-cron to schedule the scraping job to run automatically every 14 days.
â€¢ The system shall check for duplicate regulations by title and source before inserting.
As a compliance officer,
I want the system to automatically detect changes when a regulation is updated to a new version,
so that I am aware of regulatory modifications that may affect the bank's compliance posture.
Given that the feed integrator has scraped a regulation that already exists in the database, when the scraped version
number is higher than the stored version, then the system updates the regulation record and creates a
regulation_changes entry.
Acceptance Criteria:
â€¢ The system shall compare the version of a scraped regulation against the stored version in the database.
â€¢ If the version is higher, the system shall update the regulation and create a record in the regulation_changes
table.
As a compliance officer,
I want the system to automatically assess the impact of each regulatory change using keyword analysis,
so that high-risk changes are prioritized for immediate review.
Given that a new regulation is ingested or an existing regulation is updated, when the system processes the
regulation content, then it assigns an impact score of Critical, High, Medium, or Low based on keyword analysis.
Acceptance Criteria:
â€¢ The system shall analyze the title and content of each regulation for impact keywords.
â€¢ The system shall assign an impact score: Critical, High, Medium, or Low.
â€¢ Critical and High impact regulations shall be flagged as Immediate Action Required.
â€¢ Medium impact regulations shall be flagged as Review Recommended.
â€¢ Low impact regulations shall be flagged as Informational.
As a compliance officer,
I want the system to automatically generate alerts when new regulations are ingested or existing regulations are
updated,
so that the compliance team is notified of regulatory changes requiring attention.
Given that a regulation has been inserted or updated by the feed integrator, when the change detection and impact
assessment are complete, then the system creates an alert with the appropriate severity level and a default status of
Unread.
Acceptance Criteria:
â€¢ The system shall create an alert for every new or updated regulation.
â€¢ Each alert shall have a severity level derived from the impact assessment.
As a compliance officer,
I want to view a list of all regulatory alerts with severity badges and status indicators,
so that I can quickly identify which alerts require immediate attention.
Given that I am on the Alerts view of the dashboard, when the page loads, then the system retrieves all alerts joined
with regulation titles and displays them with color-coded severity badges and summary cards.
Acceptance Criteria:
â€¢ The system shall display all alerts in a table with columns: Alert ID, Regulation Title, Severity Level, Status, and
Actions.
â€¢ Severity levels shall be displayed as color-coded Bootstrap badges.
â€¢ The system shall display summary cards showing total alerts, unread count, and counts by severity level.
As a compliance officer,
I want to update the status of an alert (Unread, Read, Dismissed) directly from the dashboard,
so that I can track which alerts have been reviewed.
Given that I am viewing the alerts table, when I select a new status from the dropdown in the Actions column, then
the system sends a PATCH request to update the alert status and refreshes the summary cards.
Acceptance Criteria:
â€¢ Each alert row shall have a status dropdown with options: Unread, Read, Dismissed.
â€¢ The system shall validate the status value before updating.
â€¢ The system shall return HTTP 400 for invalid status values.
â€¢ The system shall return HTTP 404 if the alert does not exist.
â€¢ Summary cards shall refresh after a status update.
As a compliance officer,
I want to filter alerts by severity level and status,
so that I can focus on the most critical alerts first.
Given that I am on the Alerts view, when I select a severity level or status from the filter dropdowns, then the system
filters the displayed alerts client-side without making additional API calls, showing only alerts matching the selected
criteria.
Acceptance Criteria:
â€¢ The system shall provide filter dropdowns for severity level and status.
â€¢ Filtering shall be performed client-side on already-fetched data.
â€¢ Selecting All shall display all alerts.
As a compliance officer,
I want to view a reports dashboard showing regulatory changes by category and alert trends over time,
so that I can analyze compliance patterns and prepare management reports.
Given that I navigate to the Reports view, when the view loads, then the system displays a category breakdown table
showing regulation change counts grouped by category (AML, ESG, etc.), Chart.js charts showing alert trends over
time, and compliance status indicators showing the ratio of reviewed to unread alerts.
Acceptance Criteria:
â€¢ The system shall display regulation changes grouped by category from GET /api/dashboard/categories.
â€¢ The system shall render Chart.js charts (pie, bar, doughnut, line) across tabbed report pages.
â€¢ The system shall display a progress bar showing the alert review completion percentage.
As a compliance officer,
I want to view all outstanding compliance tasks with assignee and deadline information,
so that I can monitor task progress and ensure timely completion.
Given that I navigate to the Tasks view, when the view loads, then the system retrieves all tasks joined with assignee
usernames from the backend API and displays them in a table with status badges and deadline highlighting for tasks
due within 3 days or overdue.
Acceptance Criteria:
â€¢ The system shall display tasks with columns: Title, Description, Assignee, Deadline, Status, and Actions.
â€¢ Task status shall be displayed as color-coded badges (Pending, In Progress, Completed).
â€¢ Tasks with deadlines within 3 days or past due shall be highlighted in red.
As a compliance officer,
I want to add a new compliance task with an assignee and deadline,
so that regulatory changes can be assigned to team members for action.
Given that I am on the Tasks view, when I fill in the task form with a title, description, assignee, deadline, and
optional alert reference and click Add Task, then the system sends a POST request to create the task in the database
and refreshes the task list.
Acceptance Criteria:
â€¢ The system shall provide a form with fields: title (required), description, assignee dropdown (required), deadline
(required), and alert dropdown (optional).
â€¢ The system shall validate required fields before submission.
As a compliance officer,
I want to update the status of a task and delete completed or unnecessary tasks,
so that the task list remains current and actionable.
Given that I am viewing the tasks table, when I change a task's status via the dropdown or click the Delete button,
then the system sends a PATCH or DELETE request respectively, updates the database, and refreshes the task list.
Acceptance Criteria:
â€¢ Each task row shall have a status dropdown (Pending, In Progress, Completed) and a Delete button.
â€¢ The system shall validate status values before updating.
â€¢ The system shall prompt for confirmation before deleting a task.
â€¢ Deleted tasks shall be permanently removed from the database.
As a compliance officer,
I want to view compliance gaps between regulations and internal policies,
so that I can identify where the bank's policies fall short of regulatory requirements.
Given that I navigate to the Gaps view, when the view loads, then the system retrieves all compliance gaps joined
with regulation titles and policy names from the backend API and displays them in a table with color-coded status
badges.
Acceptance Criteria:
â€¢ The system shall display gaps with columns: Regulation, Policy, Gap Description, Status, Identified Date, and
Actions.
As a compliance officer,
I want to add a new compliance gap and update gap statuses,
so that identified gaps are tracked through to remediation.
Given that I am on the Gaps view, when I fill in the gap form selecting a regulation, policy, and description and click
Add Gap, then the system creates the gap record. When I change a gap's status via the dropdown, the system
updates the status in the database.
Acceptance Criteria:
â€¢ The system shall provide a form with regulation dropdown, policy dropdown, and gap description textarea.
â€¢ The system shall populate dropdowns from GET /api/regulations and GET /api/internal-policies.
â€¢ Each gap row shall have a status dropdown (Open, In Review, Remediated).
As a compliance officer,
I want to view and add regulatory sources,
so that the system can track which authorities are being monitored.
Given that I navigate to the Sources view, when the view loads, then the system displays all regulatory sources in a
table. When I fill in the source form with a name and URL and click Add Source, the system creates the source
record.
Acceptance Criteria:
â€¢ The system shall display sources with columns: Source Name, Base URL, and Created Date.
â€¢ The system shall provide a form to add new sources with source_name and base_url fields.
â€¢ The system shall validate that both fields are provided before submission.
As a compliance officer,
I want to view, add, and edit regulations in the knowledge base,
so that the compliance team has a centralized repository of all regulatory information.
Given that I navigate to the Regulations view, when the view loads, then the system displays all regulations with
source names. When I add a new regulation via the form or click Edit on an existing one, the system creates or
updates the regulation record.
Acceptance Criteria:
â€¢ The system shall display regulations with columns: Title, Source, Category, Version, Published Date, and Actions.
â€¢ The system shall provide an add form with source dropdown, title, category, content, version, and published
date fields.
â€¢ The system shall provide an edit form pre-populated with existing regulation data.
As a compliance officer,
I want to view all detected regulation changes with version history and impact scores,
so that I can understand what changed between regulation versions.
Given that I navigate to the Changes view, when the view loads, then the system displays all regulation changes in a
table with color-coded impact score badges and semantic difference descriptions.
Acceptance Criteria:
â€¢ The system shall display changes with columns: Regulation Title, Previous Version, New Version, Impact Score,
Semantic Differences, and Detected Date.
â€¢ Impact scores shall be displayed as color-coded badges (Critical=red, High=amber, Medium=blue, Low=green).
As a compliance officer,
I want to view an impact assessment dashboard with severity summary cards and prioritized sorting,
so that I can quickly identify the highest-risk regulatory changes.
Given that I navigate to the Impact view, when the view loads, then the system displays summary cards showing
counts for Critical, High, Medium, and Low impact changes, and a table sorted by severity with Critical and High rows
highlighted.
Acceptance Criteria:
â€¢ The system shall display 4 summary cards with counts per impact level.
â€¢ The table shall be sorted by severity: Critical first, then High, Medium, Low.
â€¢ Critical rows shall be highlighted with a red background.
â€¢ High rows shall be highlighted with an amber background.
As a compliance officer,
I want to view and manage internal bank policies,
so that I can reference and update them when performing compliance gap analysis.
Given that I navigate to the Policies view, when the view loads, then the system displays all internal policies in a
table. When I add or edit a policy, the system creates or updates the record.
Acceptance Criteria:
â€¢ The system shall display policies with columns: Policy Name, Description, Last Updated, and Actions.
â€¢ The system shall provide add and edit forms for policy name and description.
â€¢ The system shall retrieve data from GET /api/internal-policies.
â€¢ Dates shall be formatted in a readable format.
As a compliance officer,
I want to view a searchable audit trail of all system actions with date and user filtering,
so that the bank has a complete record for regulatory inspections and internal audits.
Given that I navigate to the Audit Trail view, when the view loads, then the system displays all audit log entries. When
I apply filters (user, action type, target table, date range), the system retrieves filtered results from the backend.
Acceptance Criteria:
â€¢ The system shall display audit logs with columns: Username, Action Type, Target Table, Target ID, Description,
and Timestamp.
â€¢ The system shall provide filter controls: user dropdown, action type input, target table input, start date picker,
and end date picker.
â€¢ The system shall provide Apply Filters and Clear Filters buttons.
As a compliance officer,
I want the dashboard to have a professional sidebar navigation layout with 10 views,
so that I can easily switch between different compliance management functions without page reloads.
Given that I open the dashboard in my browser, when the page loads, then I see a dark sidebar with navigation links
for all 10 views (Alerts, Reports, Tasks, Gaps, Sources, Regulations, Changes, Impact, Policies, Audit Trail). When I
click a link, the corresponding view is displayed and the sidebar highlights the active link.
Acceptance Criteria:
â€¢ The system shall display a persistent dark sidebar with 10 navigation links.
â€¢ Each link shall have an SVG icon and label.
â€¢ Clicking a link shall show the target view and hide all others without a full page reload.
â€¢ The active link shall be visually highlighted.
â€¢ The Alerts view shall be the default view on page load.
As a compliance officer,
I want to securely log in with my email and password,
so that only authorized personnel can access the compliance dashboard.
Given that I open the dashboard, when I enter my email and password and click Sign In, then the system validates
credentials using bcrypt and grants access if valid.
Acceptance Criteria:
â€¢ The system shall display a login overlay before granting dashboard access.
â€¢ The system shall validate email and bcrypt-hashed password against the users table.
â€¢ The system shall return HTTP 401 for invalid credentials.
â€¢ Upon successful login, the system shall display the user's name and role in the header.
As a compliance officer,
I want to export alerts as a CSV file,
so that I can share compliance data with management offline.
Given that I am on the Alerts view, when I click the Export CSV button, then the system generates and downloads a
CSV file containing all current alert data.
Acceptance Criteria:
â€¢ The system shall provide an Export CSV button on the Alerts view.
â€¢ The CSV shall include columns: Alert ID, Regulation Title, Severity Level, Status.
As a compliance officer,
I want to print a formatted compliance report from the Reports view,
so that I can present findings in management meetings.
Given that I am on the Reports view, when I click Print Report, then the system generates a formatted report and
opens the browser print dialog.
Acceptance Criteria:
â€¢ The report shall include: Executive Summary, Changes by Category, High-Impact Changes, Outstanding Tasks,
and Open Compliance Gaps.
â€¢ The print layout shall hide the sidebar, navbar, and footer.
As a compliance officer,
I want to toggle dark mode on the dashboard,
so that I can work comfortably in low-light environments.
Given that I am logged in, when I click the dark mode toggle button, then the entire dashboard switches to a dark
color scheme and the preference is saved.
Acceptance Criteria:
â€¢ The system shall provide a toggle button in the header.
â€¢ Dark mode shall apply to all views, tables, forms, cards, and navigation.
As a compliance officer,
I want all tables to display data page by page with pagination controls,
so that I can navigate large datasets efficiently.
Given that a table has more than 10 items, when the view loads, then the system displays only 10 items per page
with Previous/Next buttons and page numbers.
Acceptance Criteria:
â€¢ All table views shall display a maximum of 10 items per page.
â€¢ Pagination controls shall show page numbers, Previous, and Next buttons.
â€¢ Page 1 shall be shown by default.
Total Story Points:
Story Point Priority
5 Must Have
3 Must Have
3 Must Have
3 Must Have
3 Must Have
2 Must Have
2 Must Have
3 Must Have
2 Must Have
3 Must Have
2 Must Have
2 Must Have
3 Must Have
2 Must Have
3 Must Have
2 Must Have
2 Must Have
1 Must Have
3 Must Have
3 Must Have
3 Should Have
2 Should Have
3 Should Have
1 Nice to Have
2 Nice to Have
63