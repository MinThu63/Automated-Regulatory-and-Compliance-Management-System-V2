# System / User Acceptance Test Plan

**Version:** 1.0  
**Prepared by:** SOI-2026-0039  
**Date:** 30 May 2026  
**System Under Test:** Automated Regulatory Monitoring and Compliance Management System (GLDB)

---

## Test Specification ID: TS-001
**Name of Tester:** Min Thu  
**Use Case ID:** US-1 (Automated Regulatory Scraping)  
**Date of Test:**  
**Description of Test:** Verify that the system automatically scrapes regulatory updates from MAS and ingests them into the database without manual effort.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Automated Regulatory Scraping** |||||
| 1 | Start the server (`node server.js`) and observe console output for feed integration activity | • Feed integrator triggers automatically on startup<br>• Console logs show "Scraping MAS..." messages<br>• New regulations are inserted into the MySQL database | | |
| 2 | Verify the cron job is scheduled to run every 14 days | • `node-cron` schedule is set to `0 0 */14 * *`<br>• Console logs confirm scheduler is active | | |
| 3 | Verify duplicate checking — run feed integrator when regulations already exist in database | • System checks for existing regulations by title and source before inserting<br>• Duplicate regulations are skipped with "Skipping duplicate" log message<br>• No duplicate entries appear in the `regulations` table | | |
| 4 | Verify MAS website scraping using axios and cheerio | • System fetches HTML from MAS regulatory page<br>• Cheerio parses the HTML and extracts regulation titles and content<br>• Extracted data matches the structure on the MAS website | | |
| 5 | Verify MAS Official API data fetch (exchange rates, interest rates, money supply) | • System sends GET request to MAS API endpoint<br>• API response is parsed and stored in regulations table with correct category<br>• No authentication key required (free API) | | |

---

## Test Specification ID: TS-002
**Name of Tester:** Min Thu  
**Use Case ID:** US-2 (Regulation Change Detection)  
**Date of Test:**  
**Description of Test:** Verify that the system detects when a regulation is updated to a new version and creates a change record.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Regulation Change Detection** |||||
| 1 | Simulate a regulation version change by inserting a regulation with a higher version number than the existing record | • System compares scraped version against stored version<br>• Detects that new version is higher<br>• Updates the regulation record in the database | | |
| 2 | Verify that a `regulation_changes` record is created when a version change is detected | • New row inserted into `regulation_changes` table<br>• Contains: reg_id, previous_version, new_version, semantic_differences, impact_score<br>• `detected_at` timestamp is set automatically | | |
| 3 | Verify that no change record is created when the version is the same or lower | • System logs "Skipping duplicate" message<br>• No new row in `regulation_changes` table<br>• Existing regulation record remains unchanged | | |

---

## Test Specification ID: TS-003
**Name of Tester:** Min Thu  
**Use Case ID:** US-3 (Impact Assessment)  
**Date of Test:**  
**Description of Test:** Verify that the system assesses the impact of each regulatory change and assigns a severity score (Critical, High, Medium, Low).

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Impact Assessment** |||||
| 1 | Ingest a regulation containing high-risk keywords (e.g., "penalty", "enforcement action", "mandatory") | • System assigns impact score of "Critical" or "High"<br>• Impact score is stored in `regulation_changes` table<br>• Alert severity is set to "Immediate Action Required" | | |
| 2 | Ingest a regulation containing medium-risk keywords (e.g., "review", "update", "guideline") | • System assigns impact score of "Medium"<br>• Alert severity is set to "Review Recommended" | | |
| 3 | Ingest a regulation with general/informational content (no risk keywords) | • System assigns impact score of "Low"<br>• Alert severity is set to "Informational" | | |
| 4 | Verify RAG-powered impact assessment sends regulation + policy context to LLM | • LLM receives regulation text and relevant policy chunks from Chroma<br>• Returns valid JSON: `{impact_score, reasoning, affected_areas}`<br>• Result is logged to `audit_logs` table | | |

---

## Test Specification ID: TS-004
**Name of Tester:** Eaint  
**Use Case ID:** US-4 (Automatic Alert Generation)  
**Date of Test:**  
**Description of Test:** Verify that the system automatically generates alerts when new regulations are ingested or existing regulations are updated.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Automatic Alert Generation** |||||
| 1 | Insert a new regulation via the feed integrator | • System creates an alert in the `alerts` table<br>• Alert references the correct `reg_id`<br>• Alert status defaults to "Unread" | | |
| 2 | Update an existing regulation to a new version | • System creates an alert linked to the regulation and the change record<br>• Alert `change_id` references the new `regulation_changes` entry<br>• Severity level matches the impact assessment result | | |
| 3 | Verify severity mapping: Critical/High impact → "Immediate Action Required" | • Alert severity_level is "Immediate Action Required" for Critical and High impact scores | | |
| 4 | Verify severity mapping: Medium impact → "Review Recommended" | • Alert severity_level is "Review Recommended" for Medium impact score | | |
| 5 | Verify severity mapping: Low impact → "Informational" | • Alert severity_level is "Informational" for Low impact score | | |

---

## Test Specification ID: TS-005
**Name of Tester:** Eaint  
**Use Case ID:** US-5 (View Alerts with Severity Badges)  
**Date of Test:**  
**Description of Test:** Verify that the Alerts view displays all alerts with color-coded severity badges and summary cards.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Alerts** |||||
| 1 | Navigate to the Alerts view after login | • Alerts table loads with columns: Alert ID, Regulation Title, Severity Level, Status, Actions<br>• All alerts from the database are displayed | | |
| 2 | Verify severity badges are color-coded correctly | • "Immediate Action Required" → red badge (bg-danger)<br>• "Review Recommended" → yellow badge (bg-warning)<br>• "Informational" → blue badge (bg-info) | | |
| 3 | Verify summary cards display correct counts | • Total Alerts card matches total rows in `alerts` table<br>• Unread count matches alerts with status "Unread"<br>• Immediate/Review/Informational counts match respective severity levels | | |
| 4 | Verify alerts are joined with regulation titles from the `regulations` table | • Each alert row shows the regulation title (not just reg_id)<br>• Title matches the linked regulation record | | |

---

## Test Specification ID: TS-006
**Name of Tester:** Eaint  
**Use Case ID:** US-6 (Update Alert Status)  
**Date of Test:**  
**Description of Test:** Verify that a compliance officer can update the status of an alert directly from the dashboard.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Update Alert Status** |||||
| 1 | Change alert status from "Unread" to "Read" using the dropdown in the Actions column | • PATCH request sent to `/api/alerts/:id`<br>• Alert status updates in the database<br>• Toast notification confirms "Alert status updated to Read"<br>• Summary cards refresh with updated counts | | |
| 2 | Change alert status from "Read" to "Dismissed" | • Alert status updates successfully<br>• Summary cards refresh (unread count unchanged, total unchanged) | | |
| 3 | Attempt to update alert with invalid status value (e.g., "Deleted") | • System returns HTTP 400 with error message<br>• Alert status remains unchanged | | |
| 4 | Attempt to update a non-existent alert (invalid alert_id) | • System returns HTTP 404<br>• Error message indicates alert not found | | |

---

## Test Specification ID: TS-007
**Name of Tester:** Eaint  
**Use Case ID:** US-7 (Filter Alerts)  
**Date of Test:**  
**Description of Test:** Verify that alerts can be filtered by severity level and status client-side.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Filter Alerts** |||||
| 1 | Select "Immediate Action Required" from the severity filter dropdown | • Only alerts with severity "Immediate Action Required" are displayed<br>• Other alerts are hidden<br>• No additional API call is made (client-side filtering) | | |
| 2 | Select "Unread" from the status filter dropdown | • Only alerts with status "Unread" are displayed<br>• Other alerts are hidden | | |
| 3 | Apply both severity and status filters simultaneously | • Only alerts matching both criteria are displayed | | |
| 4 | Select "All" from both filter dropdowns | • All alerts are displayed again<br>• No filtering applied | | |

---

## Test Specification ID: TS-008
**Name of Tester:** Kay  
**Use Case ID:** US-8 (Reports Dashboard)  
**Date of Test:**  
**Description of Test:** Verify the Reports view displays category breakdown, Chart.js charts, and compliance status indicators.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Reports Dashboard** |||||
| 1 | Navigate to Reports view, click "Overview" tab | • Alert Review Progress bar shows correct percentage (reviewed/total)<br>• Severity Distribution badges show correct counts for each level | | |
| 2 | Click "Trends" tab | • Line chart renders showing alert counts by date<br>• Data fetched from `GET /api/dashboard/trends`<br>• Chart is responsive | | |
| 3 | Click "Categories" tab | • Bar chart renders showing regulation changes grouped by category (AML, ESG, etc.)<br>• Table below shows category names and change counts<br>• Data fetched from `GET /api/dashboard/categories` | | |
| 4 | Click "Status" tab | • Pie chart renders showing severity distribution<br>• Doughnut chart shows impact score distribution<br>• Charts use correct colors (red, yellow, blue, green) | | |

---

## Test Specification ID: TS-009
**Name of Tester:** Kay  
**Use Case ID:** US-9 (View Tasks)  
**Date of Test:**  
**Description of Test:** Verify that the Tasks view displays all compliance tasks with assignee, deadline, and status information.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Tasks** |||||
| 1 | Navigate to the Tasks view | • Tasks table loads with columns: Title, Description, Assignee, Deadline, Status, Actions<br>• Tasks are joined with assignee usernames from the `users` table | | |
| 2 | Verify task status badges are color-coded | • "Pending" → yellow badge (bg-warning)<br>• "In Progress" → blue badge (bg-primary)<br>• "Completed" → green badge (bg-success) | | |
| 3 | Verify deadline highlighting for tasks due within 3 days | • Tasks with deadlines within 3 days or past due are highlighted in red<br>• Tasks with future deadlines beyond 3 days are displayed normally | | |

---

## Test Specification ID: TS-010
**Name of Tester:** Kay  
**Use Case ID:** US-10 (Create Task)  
**Date of Test:**  
**Description of Test:** Verify that a compliance officer can create a new task with assignee and deadline.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Create Task** |||||
| 1 | Fill in all required fields (title, assignee, deadline) and optional fields (description, alert reference), click "Add Task" | • POST request sent to `/api/tasks`<br>• Task is created in the database<br>• Toast notification confirms creation<br>• Task list refreshes and shows new task | | |
| 2 | Submit form with empty title field | • Form validation prevents submission<br>• Error indication on the required field | | |
| 3 | Submit form without selecting an assignee | • Form validation prevents submission<br>• Error indication on the required field | | |
| 4 | Submit form without selecting a deadline | • Form validation prevents submission<br>• Error indication on the required field | | |

---

## Test Specification ID: TS-011
**Name of Tester:** Kay  
**Use Case ID:** US-11 (Update/Delete Task)  
**Date of Test:**  
**Description of Test:** Verify that task status can be updated and tasks can be deleted.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Update Task Status** |||||
| 1 | Change task status from "Pending" to "In Progress" via dropdown | • PATCH request sent to `/api/tasks/:id`<br>• Status updates in database<br>• Badge color changes to blue | | |
| 2 | Change task status from "In Progress" to "Completed" | • Status updates successfully<br>• Badge color changes to green | | |
| 3 | Attempt to set invalid status value | • System returns HTTP 400<br>• Status remains unchanged | | |
| **Delete Task** |||||
| 4 | Click Delete button on a task | • Confirmation prompt appears<br>• Upon confirmation, DELETE request sent to `/api/tasks/:id`<br>• Task is permanently removed from database<br>• Task list refreshes | | |
| 5 | Cancel deletion when confirmation prompt appears | • Task remains in the table<br>• No DELETE request is sent | | |

---

## Test Specification ID: TS-012
**Name of Tester:** Hsu  
**Use Case ID:** US-12 (View Compliance Gaps)  
**Date of Test:**  
**Description of Test:** Verify that compliance gaps are displayed with regulation titles, policy names, and status badges.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Compliance Gaps** |||||
| 1 | Navigate to the Gaps view | • Gaps table loads with columns: Regulation, Policy, Gap Description, Status, Identified Date, Actions<br>• Gaps are joined with regulation titles and policy names | | |
| 2 | Verify gap status badges are color-coded | • "Open" → red badge (bg-danger)<br>• "In Review" → yellow badge (bg-warning)<br>• "Remediated" → green badge (bg-success) | | |

---

## Test Specification ID: TS-013
**Name of Tester:** Hsu  
**Use Case ID:** US-13 (Create/Update Compliance Gap)  
**Date of Test:**  
**Description of Test:** Verify that compliance gaps can be created and their statuses updated.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Create Compliance Gap** |||||
| 1 | Select a regulation from dropdown, select a policy from dropdown, enter gap description, click "Add Gap" | • POST request sent to `/api/compliance-gaps`<br>• Gap is created in the database<br>• Toast notification confirms creation<br>• Gap list refreshes | | |
| 2 | Verify regulation dropdown is populated from `GET /api/regulations` | • Dropdown shows all regulations from the database<br>• Each option displays the regulation title | | |
| 3 | Verify policy dropdown is populated from `GET /api/internal-policies` | • Dropdown shows all internal policies<br>• Each option displays the policy name | | |
| **Update Gap Status** |||||
| 4 | Change gap status from "Open" to "In Review" via dropdown | • Status updates in database<br>• Badge color changes to yellow | | |
| 5 | Change gap status from "In Review" to "Remediated" | • Status updates successfully<br>• Badge color changes to green | | |

---

## Test Specification ID: TS-014
**Name of Tester:** Hsu  
**Use Case ID:** US-14 (View/Add Regulatory Sources)  
**Date of Test:**  
**Description of Test:** Verify that regulatory sources can be viewed and new sources can be added.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View and Add Regulatory Sources** |||||
| 1 | Navigate to the Sources view | • Sources table loads with columns: Source Name, Base URL, Created Date<br>• MAS is displayed as the primary source (Phase 1) | | |
| 2 | Fill in source name and base URL, click "Add Source" | • POST request sent to `/api/regulatory-sources`<br>• Source is created in the database<br>• Source list refreshes with new entry | | |
| 3 | Submit form with empty source name | • Validation prevents submission<br>• Error message indicates field is required | | |
| 4 | Submit form with empty base URL | • Validation prevents submission<br>• Error message indicates field is required | | |

---

## Test Specification ID: TS-015
**Name of Tester:** Hsu  
**Use Case ID:** US-15 (Regulations Knowledge Base)  
**Date of Test:**  
**Description of Test:** Verify that regulations can be viewed, added, and edited in the knowledge base.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Regulations** |||||
| 1 | Navigate to the Regulations view | • Regulations table loads with columns: Title, Source, Category, Version, Published Date, Actions<br>• Source names are displayed (not source_id) | | |
| **Add Regulation** |||||
| 2 | Fill in all fields (source dropdown, title, category, content, version, published date), click submit | • POST request sent to `/api/regulations`<br>• Regulation is created in the database<br>• Regulation list refreshes | | |
| 3 | Submit form with empty required fields | • Validation prevents submission<br>• Error messages indicate missing fields | | |
| **Edit Regulation** |||||
| 4 | Click Edit on an existing regulation | • Edit form appears pre-populated with existing data<br>• All fields are editable | | |
| 5 | Modify the title and save | • PUT request sent to `/api/regulations/:id`<br>• Regulation is updated in the database<br>• Updated title appears in the table | | |

---

## Test Specification ID: TS-016
**Name of Tester:** Eaint  
**Use Case ID:** US-16 (View Regulation Changes)  
**Date of Test:**  
**Description of Test:** Verify that regulation changes are displayed with version history and color-coded impact scores.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Regulation Changes** |||||
| 1 | Navigate to the Changes view | • Changes table loads with columns: Regulation Title, Previous Version, New Version, Impact Score, Semantic Differences, Detected Date | | |
| 2 | Verify impact score badges are color-coded | • "Critical" → red badge<br>• "High" → amber/orange badge<br>• "Medium" → blue badge<br>• "Low" → green badge | | |
| 3 | Verify semantic differences text is displayed | • Differences text shows what changed between versions<br>• Long text is truncated or scrollable | | |

---

## Test Specification ID: TS-017
**Name of Tester:** Eaint  
**Use Case ID:** US-17 (Impact Assessment Dashboard)  
**Date of Test:**  
**Description of Test:** Verify the Impact view displays summary cards and a prioritized table sorted by severity.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Impact Assessment Dashboard** |||||
| 1 | Navigate to the Impact view | • 4 summary cards display counts for Critical, High, Medium, and Low impact changes<br>• Counts match the data in `regulation_changes` table | | |
| 2 | Verify table is sorted by severity (Critical first) | • Table rows are ordered: Critical → High → Medium → Low<br>• Critical rows have red background highlight<br>• High rows have amber background highlight | | |
| 3 | Filter by impact level (e.g., select "Critical" only) | • Only Critical impact changes are displayed<br>• Other rows are hidden | | |

---

## Test Specification ID: TS-018
**Name of Tester:** Hsu  
**Use Case ID:** US-18 (Internal Policies Management)  
**Date of Test:**  
**Description of Test:** Verify that internal policies can be viewed, added, and edited.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Internal Policies Management** |||||
| 1 | Navigate to the Policies view | • Policies table loads with columns: Policy Name, Description, Last Updated, Actions<br>• All 8 GLDB internal policies are displayed<br>• Data fetched from `GET /api/internal-policies` | | |
| 2 | Click "Add Policy", fill in policy name and description, submit | • POST request sent to `/api/internal-policies`<br>• Policy is created in the database<br>• Policy list refreshes | | |
| 3 | Click Edit on an existing policy, modify description, save | • PUT request sent to `/api/internal-policies/:id`<br>• Policy is updated<br>• Updated description appears in the table | | |
| 4 | Verify dates are formatted in a readable format | • `last_updated` column shows dates like "May 30, 2026" (not raw ISO string) | | |

---

## Test Specification ID: TS-019
**Name of Tester:** Hsu  
**Use Case ID:** US-19 (Audit Trail)  
**Date of Test:**  
**Description of Test:** Verify the Audit Trail view displays searchable, filterable logs of all system actions.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **View Audit Logs** |||||
| 1 | Navigate to the Audit Trail view | • Audit logs table loads with columns: Username, Action Type, Target Table, Target ID, Description, Timestamp<br>• Action types display as color-coded badges | | |
| 2 | Verify LLM audit logs display formatted summary (not raw JSON) | • LLM logs show: Model, Target, Result (badge), Duration<br>• "View Details" button expands to show prompt preview and LLM output<br>• No raw JSON blob visible in the table | | |
| **Filter Audit Logs** |||||
| 3 | Select a user from the user dropdown filter | • Only logs from the selected user are displayed | | |
| 4 | Enter an action type (e.g., "LLM_IMPACT_ASSESSMENT") in the action type filter | • Only logs matching the action type are displayed | | |
| 5 | Enter a target table (e.g., "regulations") in the target table filter | • Only logs targeting the specified table are displayed | | |
| 6 | Set a start date and end date, click "Apply Filters" | • Only logs within the specified date range are displayed | | |
| 7 | Click "Clear Filters" | • All filters reset to default<br>• All logs displayed again | | |

---

## Test Specification ID: TS-020
**Name of Tester:** Min Thu  
**Use Case ID:** US-20 (Sidebar Navigation)  
**Date of Test:**  
**Description of Test:** Verify the sidebar navigation with 10 views works correctly without page reloads.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Sidebar Navigation** |||||
| 1 | Open the dashboard after login | • Dark sidebar is visible with 10 navigation links<br>• Each link has an SVG icon and label<br>• Alerts view is shown by default | | |
| 2 | Click each sidebar link (Alerts, Reports, Tasks, Gaps, Sources, Regulations, Changes, Impact, Policies, Audit Trail) | • Corresponding view is displayed<br>• All other views are hidden<br>• No full page reload occurs (SPA behavior) | | |
| 3 | Verify active link highlighting | • Clicked link is visually highlighted (bg-primary, rounded)<br>• Previously active link loses highlight | | |
| 4 | Verify "● System Online" badge is visible in the navbar | • Green badge with "System Online" text is visible on all screen sizes | | |

---

## Test Specification ID: TS-021
**Name of Tester:** Min Thu  
**Use Case ID:** US-21 (User Authentication)  
**Date of Test:**  
**Description of Test:** Verify secure login with email and bcrypt password validation.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **User Authentication** |||||
| 1 | Open the dashboard without logging in | • Login overlay is displayed blocking access to the dashboard<br>• No data is loaded until authentication | | |
| 2 | Enter valid email and correct password, click "Sign In" | • System validates credentials using bcrypt<br>• Login overlay disappears<br>• User's name and role displayed in the header<br>• Dashboard loads with data | | |
| 3 | Enter valid email with incorrect password | • System returns HTTP 401<br>• Error message "Invalid email or password" displayed<br>• User remains on login screen | | |
| 4 | Enter non-existent email | • System returns HTTP 401<br>• Error message displayed<br>• User remains on login screen | | |
| 5 | Leave email or password field empty | • Form validation prevents submission<br>• Error indication on empty field | | |
| 6 | Click Logout button | • User is logged out<br>• Login overlay reappears<br>• User info cleared from header | | |

---

## Test Specification ID: TS-022
**Name of Tester:** Kay  
**Use Case ID:** US-23 (Export CSV)  
**Date of Test:**  
**Description of Test:** Verify that alerts can be exported as a CSV file.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Export CSV** |||||
| 1 | Navigate to Alerts view, click "Export CSV" button | • CSV file is generated and downloaded automatically<br>• File contains headers: Alert ID, Regulation Title, Severity Level, Status<br>• All current alert data is included in the file | | |
| 2 | Verify CSV content matches displayed alerts | • Number of rows in CSV matches total alerts<br>• Data values match what is shown in the table | | |

---

## Test Specification ID: TS-023
**Name of Tester:** Kay  
**Use Case ID:** US-24 (Print Report)  
**Date of Test:**  
**Description of Test:** Verify that a formatted compliance report can be printed from the Reports view.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Print Report** |||||
| 1 | Navigate to Reports view, click "Print Report" button | • Formatted report is generated with all sections<br>• Browser print dialog opens | | |
| 2 | Verify report content includes all required sections | • Executive Summary (alert counts)<br>• Regulatory Changes by Category<br>• High-Impact Changes table<br>• Outstanding Tasks table<br>• Open Compliance Gaps table | | |
| 3 | Verify print layout hides non-essential elements | • Sidebar is hidden in print view<br>• Navbar is hidden<br>• Footer is hidden<br>• Only the report content is visible | | |

---

## Test Specification ID: TS-024
**Name of Tester:** Kay  
**Use Case ID:** US-22 (Dark Mode)  
**Date of Test:**  
**Description of Test:** Verify that dark mode can be toggled and the preference is saved.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Dark Mode** |||||
| 1 | Click the dark mode toggle button (🌙) in the header | • Entire dashboard switches to dark color scheme<br>• All views, tables, forms, cards, and navigation are styled in dark mode<br>• Button icon changes to ☀️ | | |
| 2 | Click the toggle button again (☀️) | • Dashboard switches back to light mode<br>• Button icon changes to 🌙 | | |
| 3 | Enable dark mode, then refresh the page | • Dark mode preference is preserved via localStorage<br>• Page loads in dark mode after refresh | | |

---

## Test Specification ID: TS-025
**Name of Tester:** Hsu  
**Use Case ID:** US-25 (Pagination)  
**Date of Test:**  
**Description of Test:** Verify that all tables display data page by page with pagination controls when more than 10 items exist.

| S/No | Test Case | Expected Result | Pass/Fail | Remarks |
|------|-----------|-----------------|-----------|---------|
| **Pagination** |||||
| 1 | View a table with more than 10 items (e.g., Alerts, Regulations) | • Only 10 items displayed per page<br>• Pagination controls appear below the table<br>• Page 1 is shown by default | | |
| 2 | Click "Next" button | • Next 10 items are displayed<br>• Page number updates<br>• "Previous" button becomes enabled | | |
| 3 | Click "Previous" button | • Previous 10 items are displayed<br>• Page number updates | | |
| 4 | Click a specific page number | • Corresponding page of items is displayed<br>• Clicked page number is highlighted as active | | |
| 5 | View a table with fewer than 10 items | • All items displayed on one page<br>• No pagination controls appear | | |
