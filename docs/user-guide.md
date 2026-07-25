# User Guide — GLDB Compliance Portal

## 1. Accessing the System

**Step 1:** Open your web browser and navigate to:
- **Local:** `http://localhost:3000`
- **Live:** `https://automated-regulatory-and-compliance-bjn0.onrender.com`

**Step 2:** You will see the login screen.

<<Put Screenshot of Login Page>>

**Step 3:** Enter your credentials:
| Role | Email | Password |
|------|-------|----------|
| Compliance Officer | officer@gldb.com | 123456 |
| Internal Auditor | auditor@gldb.com | 123456 |
| Admin | admin@gldb.com | 123456 |

**Step 4:** Click **"Sign In"**. You will be taken to the Home Page.

<<Put Screenshot of Home Page with stats and Go to Dashboard button>>

**Step 5:** Click **"Go to Dashboard →"** to enter the full compliance dashboard.

---

## 2. Home Page

The home page shows a quick overview:
- **Unread Alerts** count
- **Open Gaps** count
- **Pending Tasks** count

To return to the home page at any time, click the **GLDB logo** in the top navigation bar.

---

## 3. Navigating the Dashboard

The dashboard has a sidebar with 9 tabs. Click any tab to switch views.

<<Put Screenshot of Sidebar Navigation>>

To **hide the sidebar** for full-width content, click the **"☰ Menu"** button in the top-right corner. Click again to show it.

To enable **Dark Mode**, click the **🌙** button in the top-right corner.

---

## 4. Alerts Tab

### Viewing Alerts
**Step 1:** Click **"Alerts"** in the sidebar.

**Step 2:** Review the 5 summary cards at the top showing alert counts by severity.

<<Put Screenshot of Alerts Tab with Summary Cards>>

### Filtering Alerts
**Step 3:** Use the **severity** and **status** dropdowns to filter alerts.

### Bulk Actions
**Step 4:** Click **"✓ Mark All Read"** to mark all alerts as read, or **"Dismiss Info"** to dismiss all Informational alerts.

### Investigating an Alert
**Step 5:** Click **"View Change"** on any alert to navigate directly to the Changes & Impact detail for that regulatory change.

### Sending Email Digest
**Step 6:** Click **"📧 Send Test Alert Email"** to send a summary digest email to the configured Gmail address.

<<Put Screenshot of Email Received in Gmail>>

---

## 5. Changes & Impact Tab

### Viewing Regulatory Changes
**Step 1:** Click **"Changes & Impact"** in the sidebar.

**Step 2:** Review summary cards: Total Changes, Critical, High, Medium, Auto-Tasks Created.

<<Put Screenshot of Changes & Impact Tab>>

### Filtering
**Step 3:** Use the 4 filters: Impact Level, Task Status, Affected Areas, and Search.

### Viewing a Diff (Old vs New Comparison)
**Step 4:** Click **"🔍 View Diff"** on a regulation change that has both old and new versions.

**Step 5:** The detail panel opens showing:
- Previous Version (left panel, red border)
- Current Version (right panel, green border)
- Change summary, affected areas, compliance deadline

<<Put Screenshot of View Diff Panel showing Old vs New>>

### Penalty-Linked Changes
Changes with penalties show a pulsing **⚠️ PENALTY** badge and are always sorted first.

---

## 6. Tasks Tab

### Viewing Tasks
**Step 1:** Click **"Tasks"** in the sidebar.

**Step 2:** Review auto-generated tasks. Each task shows:
- Title and department
- Clickable **🔗 N gaps** badge → navigates to linked gaps
- Clickable **📋 N changes** badge → navigates to linked regulatory changes

<<Put Screenshot of Tasks Tab with Linkage Badges>>

### Updating Task Status
**Step 3:** Change the status dropdown: **Pending → In Progress → Completed**.

> **Note:** Marking a task as "Completed" automatically sets all linked compliance gaps to "Remediated".

### Creating a Manual Task
**Step 4:** Fill in the task form (Title, Department, Deadline) and click **"Add Task"**.

---

## 7. Compliance Gaps Tab

### Viewing Gaps
**Step 1:** Click **"Gaps"** in the sidebar.

**Step 2:** Review the progress bar and summary cards (Open, In Review, Remediated).

<<Put Screenshot of Gaps Tab with Progress Bar>>

### Filtering Gaps
**Step 3:** Filter by: Status, Severity, and **Gap Type** (5 types: Missing Procedure, Outdated Procedure, Insufficient Detail, Missing Control, Non-Compliant Threshold).

### Creating a Task from a Gap
**Step 4:** Click **"Create Task"** on any gap.

**Step 5:** Fill in the modal form (Title, Description, Department, Deadline) and click **"Create Task"**.

<<Put Screenshot of Create Task Modal>>

---

## 8. Regulations Knowledge Base Tab

### Viewing Regulations
**Step 1:** Click **"Regulations"** in the sidebar.

**Step 2:** Browse all scraped regulations. Click the **regulation title** to open the official source in a new tab.

<<Put Screenshot of Regulations Tab>>

### Viewing Regulation Details
**Step 3:** Click **"📄 View Details"** to open the detail panel showing full content, related changes, and related gaps.

### Uploading a PDF Regulation
**Step 4:** In the **"📄 Upload PDF Regulation"** section:
1. Enter a title (optional — auto-detects from filename)
2. Select a category
3. Select a source
4. Choose the PDF file
5. Click **"📤 Upload & Process"**

<<Put Screenshot of PDF Upload Form>>

**Step 5:** The system extracts text, detects if it's an update to an existing regulation, and triggers the full AI pipeline.

<<Put Screenshot of Upload Success Message>>

### Scraping a URL
**Step 6:** In the **"🔗 Scrape from URL"** section:
1. Paste the regulatory page URL
2. Enter title (optional)
3. Select category and source
4. Click **"🔍 Scrape & Process"**

The system uses a headless browser to render JavaScript-heavy pages.

---

## 9. Policies Tab

### Viewing Policies
**Step 1:** Click **"Policies"** in the sidebar.

**Step 2:** Policies are displayed as cards. Click **"📋 View Procedures"** to expand the step-by-step procedures.

<<Put Screenshot of Policy Card with Expanded Procedures>>

### Filtering Policies
**Step 3:** Use the filter dropdown: All Policies, Has Version History, No History, 🤖 AI Generated.

### Reviewing AI Proposals
**Step 4:** Click the **"🤖 AI Proposals"** sub-tab.

**Step 5:** Review the proposed policy text, procedures, and AI reasoning.

**Step 6:** Click **"✅ Accept & Apply"** to apply the policy, or **"❌ Reject"** to discard.

<<Put Screenshot of AI Proposal Card>>

### Viewing Policy History
**Step 7:** Click **"📜 History"** on any policy to see all previous versions.

---

## 10. Reports & Analytics Tab

**Step 1:** Click **"Reports"** in the sidebar.

**Step 2:** Navigate between 4 sub-tabs:
- **Regulatory Changes** — impact distribution, category bar, changes timeline
- **Gap Analysis** — gap type pie, gaps by policy, resolution rate
- **Tasks & Remediation** — task status, department workload, deadline burndown
- **Compliance Posture** — overall score %, policy coverage heatmap

<<Put Screenshot of Reports Tab - Compliance Posture>>

### Printing a Report
**Step 3:** Click **"🖨️ Print Report"** to generate a formatted printable report.

---

## 11. Audit Trail Tab

### Viewing the Audit Trail
**Step 1:** Click **"Audit Trail"** in the sidebar.

**Step 2:** Review summary cards: Total Actions, This Week, 🤖 AI Agent Actions, 👤 Human Actions.

<<Put Screenshot of Audit Trail with Summary Cards>>

### Switching Views
**Step 3:** Use the view mode dropdown:
- **📋 Table View** — traditional table format
- **⏱️ Timeline View** — chronological feed with icons
- **🔗 Response Chain** — select a regulation to see its full compliance lifecycle

<<Put Screenshot of Response Chain View>>

### Filtering by Actor
**Step 4:** Use the **"All Actors"** dropdown to filter: 🤖 AI Agent Only or 👤 Human Only.

### Printing Audit Report
**Step 5:** Click **"🖨️ Print Audit Report"** to generate a formatted audit document for regulatory inspections.

---

## 12. Sources Tab

**Step 1:** Click **"Sources"** in the sidebar.

**Step 2:** View the 5 regulatory sources (MAS, FATF, FinCEN, ECB, FCA).

**Step 3:** To add a new source, fill in the name and URL and click **"Add Source"**.

---

## 13. Logging Out

**Step 1:** Click **"Logout"** in the top-right corner to end your session and return to the login screen.
