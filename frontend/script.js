// ==================== STATE ====================
let allAlerts = [];
let trendChart = null;
let currentUser = null;
let regCurrentPage = 1;
let regTotalPages = 1;
let regSearchQuery = '';
const API_BASE = '';
const ITEMS_PER_PAGE = 10;

// Pagination state for all tabs
let alertsPage = 1;
let changesPage = 1;
let impactPage = 1;
let impactFilter = '';
let tasksPage = 1;
let gapsPage = 1;
let sourcesPage = 1;
let policiesPage = 1;
let auditPage = 1;

// ==================== GENERIC PAGINATION HELPER ====================

function renderPagination(containerId, currentPage, totalItems, onPageChange, customPageSize) {
  var pageSize = customPageSize || ITEMS_PER_PAGE;
  var totalPages = Math.ceil(totalItems / pageSize) || 1;
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (totalItems <= pageSize) return; // No pagination needed

  var nav = document.createElement('nav');
  nav.innerHTML = '<ul class="pagination pagination-sm justify-content-center mb-0"></ul>';
  var ul = nav.querySelector('ul');

  // Previous button
  var prevLi = document.createElement('li');
  prevLi.className = 'page-item' + (currentPage <= 1 ? ' disabled' : '');
  prevLi.innerHTML = '<a class="page-link" href="#">Previous</a>';
  prevLi.addEventListener('click', function(e) { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); });
  ul.appendChild(prevLi);

  // Page numbers
  for (var i = 1; i <= totalPages; i++) {
    var li = document.createElement('li');
    li.className = 'page-item' + (i === currentPage ? ' active' : '');
    li.innerHTML = '<a class="page-link" href="#">' + i + '</a>';
    (function(pageNum) {
      li.addEventListener('click', function(e) { e.preventDefault(); onPageChange(pageNum); });
    })(i);
    ul.appendChild(li);
  }

  // Next button
  var nextLi = document.createElement('li');
  nextLi.className = 'page-item' + (currentPage >= totalPages ? ' disabled' : '');
  nextLi.innerHTML = '<a class="page-link" href="#">Next</a>';
  nextLi.addEventListener('click', function(e) { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); });
  ul.appendChild(nextLi);

  container.appendChild(nav);
}

function paginateArray(arr, page) {
  var start = (page - 1) * ITEMS_PER_PAGE;
  return arr.slice(start, start + ITEMS_PER_PAGE);
}

// ==================== PRINT REPORT ====================

async function printReport() {
  try {
    var printContent = document.getElementById('printContent');
    printContent.innerHTML = '<p style="color:#666;">Generating report...</p>';
    document.getElementById('printDate').textContent = 'Generated: ' + new Date().toLocaleString();

    // Fetch all data for the report
    var [summaryResp, categoriesResp, changesResp, tasksResp, gapsResp] = await Promise.all([
      fetch(API_BASE + '/api/dashboard/summary'),
      fetch(API_BASE + '/api/dashboard/categories'),
      fetch(API_BASE + '/api/regulation-changes'),
      fetch(API_BASE + '/api/tasks'),
      fetch(API_BASE + '/api/compliance-gaps')
    ]);

    var summary = await summaryResp.json();
    var categories = await categoriesResp.json();
    var changes = await changesResp.json();
    var tasks = await tasksResp.json();
    var gaps = await gapsResp.json();

    var html = '';

    // Section 1: Executive Summary
    html += '<h3 style="margin-top:20px; border-bottom:1px solid #ccc; padding-bottom:8px;">1. Executive Summary</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Alerts</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.total || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Unread Alerts</strong></td><td style="padding:8px; border:1px solid #ddd; color:red;">' + (summary.unread || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Immediate Action Required</strong></td><td style="padding:8px; border:1px solid #ddd; color:red;">' + (summary.immediate || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Review Recommended</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.review || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Informational</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (summary.informational || 0) + '</td></tr>';
    html += '</table>';

    // Section 2: Regulatory Changes by Category
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">2. Regulatory Changes by Category</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr style="background:#f5f5f5;"><th style="padding:8px; border:1px solid #ddd; text-align:left;">Category</th><th style="padding:8px; border:1px solid #ddd; text-align:left;">Changes Detected</th></tr>';
    categories.forEach(function(c) {
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">' + c.category + '</td><td style="padding:8px; border:1px solid #ddd;">' + c.change_count + '</td></tr>';
    });
    html += '</table>';

    // Section 3: High-Impact Changes
    var highImpact = changes.filter(function(c) { return c.impact_score === 'Critical' || c.impact_score === 'High'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">3. High-Impact Changes (' + highImpact.length + ')</h3>';
    if (highImpact.length === 0) {
      html += '<p style="color:#666;">No high-impact changes detected.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Regulation</th><th style="padding:6px; border:1px solid #ddd;">Impact</th><th style="padding:6px; border:1px solid #ddd;">Details</th></tr>';
      highImpact.forEach(function(c) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + c.regulation_title + '</td><td style="padding:6px; border:1px solid #ddd; font-weight:bold; color:' + (c.impact_score === 'Critical' ? 'red' : 'orange') + ';">' + c.impact_score + '</td><td style="padding:6px; border:1px solid #ddd;">' + (c.semantic_differences || '').substring(0, 100) + '</td></tr>';
      });
      html += '</table>';
    }

    // Section 4: Outstanding Tasks
    var pendingTasks = tasks.filter(function(t) { return t.status !== 'Completed'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">4. Outstanding Tasks (' + pendingTasks.length + ')</h3>';
    if (pendingTasks.length === 0) {
      html += '<p style="color:#666;">All tasks completed.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Task</th><th style="padding:6px; border:1px solid #ddd;">Assignee</th><th style="padding:6px; border:1px solid #ddd;">Deadline</th><th style="padding:6px; border:1px solid #ddd;">Status</th></tr>';
      pendingTasks.forEach(function(t) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + t.title + '</td><td style="padding:6px; border:1px solid #ddd;">' + t.assignee + '</td><td style="padding:6px; border:1px solid #ddd;">' + formatDate(t.deadline) + '</td><td style="padding:6px; border:1px solid #ddd;">' + t.status + '</td></tr>';
      });
      html += '</table>';
    }

    // Section 5: Open Compliance Gaps
    var openGaps = gaps.filter(function(g) { return g.status !== 'Remediated'; });
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">5. Open Compliance Gaps (' + openGaps.length + ')</h3>';
    if (openGaps.length === 0) {
      html += '<p style="color:#666;">All gaps remediated.</p>';
    } else {
      html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.85rem;">';
      html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">Regulation</th><th style="padding:6px; border:1px solid #ddd;">Policy</th><th style="padding:6px; border:1px solid #ddd;">Gap</th><th style="padding:6px; border:1px solid #ddd;">Status</th></tr>';
      openGaps.forEach(function(g) {
        html += '<tr><td style="padding:6px; border:1px solid #ddd;">' + g.regulation_title + '</td><td style="padding:6px; border:1px solid #ddd;">' + g.policy_name + '</td><td style="padding:6px; border:1px solid #ddd;">' + (g.gap_description || '').substring(0, 80) + '</td><td style="padding:6px; border:1px solid #ddd;">' + g.status + '</td></tr>';
      });
      html += '</table>';
    }

    // Footer
    html += '<div style="margin-top:40px; padding-top:15px; border-top:1px solid #ccc; font-size:0.75rem; color:#999; text-align:center;">';
    html += 'This report was auto-generated by the GLDB Compliance Portal. For internal use only. Confidential.';
    html += '</div>';

    printContent.innerHTML = html;

    // Trigger print
    setTimeout(function() { window.print(); }, 300);
  } catch (err) {
    showToast('Failed to generate print report', 'danger');
  }
}

// ==================== DARK MODE ====================

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  var btn = document.getElementById('darkModeBtn');
  if (document.body.classList.contains('dark-mode')) {
    btn.textContent = '☀️';
    localStorage.setItem('darkMode', 'true');
  } else {
    btn.textContent = '🌙';
    localStorage.setItem('darkMode', 'false');
  }
}

function toggleSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var btn = document.getElementById('sidebarToggleBtn');
  sidebar.classList.toggle('collapsed');
  btn.textContent = sidebar.classList.contains('collapsed') ? '☰ Show Menu' : '☰ Hide Menu';
}

function loadDarkModePreference() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('darkModeBtn').textContent = '☀️';
  }
}

// ==================== WELCOME BANNER ====================

async function showWelcomeBanner() {
  if (!currentUser) return;
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) return;
    var summary = await response.json();
    document.getElementById('welcomeText').textContent = 'Welcome back, ' + currentUser.username + '!';
    document.getElementById('welcomeSummary').textContent = 'You have ' + (summary.unread || 0) + ' unread alerts and ' + (summary.immediate || 0) + ' requiring immediate action.';
    document.getElementById('welcomeBanner').classList.remove('d-none');
  } catch (err) { /* silent */ }
}

// ==================== LAST SYNCED ====================

function updateLastSynced() {
  var el = document.getElementById('lastSyncedTime');
  if (el) {
    el.textContent = 'Last synced: ' + new Date().toLocaleString();
  }
}

// ==================== EXPORT CSV ====================

function exportTableCSV(type) {
  var data = [];
  var filename = type + '_export.csv';

  if (type === 'alerts') {
    data = allAlerts;
    var csv = 'Alert ID,Regulation Title,Severity Level,Status\n';
    data.forEach(function(row) {
      csv += row.alert_id + ',"' + (row.title || '').replace(/"/g, '""') + '","' + row.severity_level + '","' + row.status + '"\n';
    });
    downloadCSV(csv, filename);
  }
}

function downloadCSV(csv, filename) {
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  showToast('CSV exported successfully', 'success');
}

// ==================== SIDEBAR BADGES ====================

async function updateSidebarBadges() {
  try {
    var [alertsResp, tasksResp, gapsResp] = await Promise.all([
      fetch(API_BASE + '/api/dashboard/summary'),
      fetch(API_BASE + '/api/tasks'),
      fetch(API_BASE + '/api/compliance-gaps')
    ]);
    if (alertsResp.ok) {
      var summary = await alertsResp.json();
      var alertBadge = document.querySelector('.sidebar .nav-link:nth-child(1) .nav-badge');
      if (!alertBadge) {
        var firstLink = document.querySelector('.sidebar .nav-link:nth-child(1)');
        if (firstLink) {
          var badge = document.createElement('span');
          badge.className = 'nav-badge badge bg-danger';
          badge.id = 'sidebarAlertBadge';
          badge.textContent = summary.unread || 0;
          firstLink.appendChild(badge);
        }
      } else {
        alertBadge.textContent = summary.unread || 0;
      }
    }
  } catch (err) { /* silent */ }
}

// ==================== LOGIN ====================

function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value;
  var password = document.getElementById('loginPassword').value;
  var loginError = document.getElementById('loginError');
  loginError.classList.add('d-none');

  fetch(API_BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  })
  .then(function(response) { return response.json().then(function(data) { return { ok: response.ok, data: data }; }); })
  .then(function(result) {
    if (!result.ok) {
      loginError.textContent = result.data.error || 'Login failed';
      loginError.classList.remove('d-none');
      return;
    }
    currentUser = result.data.user;
    document.getElementById('loginOverlay').classList.add('d-none');
    document.getElementById('headerUserBadge').textContent = currentUser.username + ' (' + currentUser.role + ')';
    document.getElementById('logoutBtn').classList.remove('d-none');
    // Show home page instead of immediately loading dashboard
    showHomePage();
    updateSidebarBadges();
    updateLastSynced();
    loadDarkModePreference();
  })
  .catch(function() {
    loginError.textContent = 'Cannot connect to server. Is the backend running?';
    loginError.classList.remove('d-none');
  });
}

function logout() {
  currentUser = null;
  document.getElementById('loginOverlay').classList.remove('d-none');
  document.getElementById('headerUserBadge').textContent = '';
  document.getElementById('logoutBtn').classList.add('d-none');
  document.getElementById('loginForm').reset();
}

// ==================== TOAST NOTIFICATION ====================

function showToast(message, type) {
  var toast = document.getElementById('toastNotification');
  var toastMsg = document.getElementById('toastMessage');
  toastMsg.textContent = message;
  toast.className = 'toast align-items-center border-0 text-bg-' + (type || 'success');
  var bsToast = new bootstrap.Toast(toast, { delay: 3000 });
  bsToast.show();
}

// ==================== LOADING SPINNER ====================

function showLoading(containerId) {
  var container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Loading data...</p></div>';
  }
}

function showEmpty(containerId, message) {
  var container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">' + (message || 'No data found.') + '</td></tr>';
  }
}

// ==================== HELPER FUNCTIONS ====================

function getSeverityClass(severity) {
  if (severity === 'Immediate Action Required') return 'bg-danger';
  if (severity === 'Review Recommended') return 'bg-warning text-dark';
  if (severity === 'Informational') return 'bg-info';
  return 'bg-secondary';
}

function getTaskStatusClass(status) {
  if (status === 'Pending') return 'bg-warning text-dark';
  if (status === 'In Progress') return 'bg-primary';
  if (status === 'Completed') return 'bg-success';
  return 'bg-secondary';
}

function getGapStatusClass(status) {
  if (status === 'Open') return 'bg-danger';
  if (status === 'In Review') return 'bg-warning text-dark';
  if (status === 'Remediated') return 'bg-success';
  return 'bg-secondary';
}

function isDeadlineUrgent(deadline) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return deadlineDate <= threeDaysFromNow;
}

function showError(message) {
  var errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.remove('d-none');
}

function hideError() {
  var errorMsg = document.getElementById('errorMsg');
  errorMsg.classList.add('d-none');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ==================== HOME PAGE ====================

async function showHomePage() {
  // Hide all dashboard views, show home
  document.querySelectorAll('[id^="view-"]').forEach(function(v) { v.classList.add('d-none'); });
  document.getElementById('view-home').classList.remove('d-none');

  // Hide sidebar
  document.querySelector('.sidebar').classList.add('d-none');

  // Remove sidebar active state
  document.querySelectorAll('.sidebar .nav-link').forEach(function(link) {
    link.classList.remove('active', 'bg-primary', 'rounded');
  });

  // Load quick stats for home page
  try {
    var [alertsResp, gapsResp, tasksResp] = await Promise.all([
      fetch(API_BASE + '/api/dashboard/summary'),
      fetch(API_BASE + '/api/compliance-gaps'),
      fetch(API_BASE + '/api/tasks')
    ]);
    if (alertsResp.ok) {
      var summary = await alertsResp.json();
      document.getElementById('homeAlertCount').textContent = summary.unread || 0;
    }
    if (gapsResp.ok) {
      var gaps = await gapsResp.json();
      var openGaps = gaps.filter(function(g) { return g.status === 'Open'; }).length;
      document.getElementById('homeGapCount').textContent = openGaps;
    }
    if (tasksResp.ok) {
      var tasks = await tasksResp.json();
      var pending = tasks.filter(function(t) { return t.status === 'Pending'; }).length;
      document.getElementById('homeTaskCount').textContent = pending;
    }
  } catch (e) { /* silent */ }
}

function enterDashboard() {
  document.getElementById('view-home').classList.add('d-none');
  document.querySelector('.sidebar').classList.remove('d-none');
  showView('alerts');
}

// ==================== VIEW SWITCHING (Task 3.1) ====================

function showView(viewName) {
  // Hide home page
  var homePage = document.getElementById('view-home');
  if (homePage) homePage.classList.add('d-none');

  // Hide welcome banner when navigating
  var welcomeBanner = document.getElementById('welcomeBanner');
  if (welcomeBanner && viewName !== 'alerts') welcomeBanner.classList.add('d-none');

  // Hide all views
  document.querySelectorAll('[id^="view-"]').forEach(function (v) {
    v.classList.add('d-none');
  });
  // Show target view
  document.getElementById('view-' + viewName).classList.remove('d-none');
  // Update sidebar active state
  document.querySelectorAll('.sidebar .nav-link').forEach(function (link) {
    link.classList.remove('active', 'bg-primary', 'rounded');
  });
  // Find the clicked link and make it active
  var links = document.querySelectorAll('.sidebar .nav-link');
  var viewIndex = { alerts: 0, reports: 1, tasks: 2, gaps: 3, sources: 4, regulations: 5, changes: 6, policies: 7, audit: 8 };
  if (links[viewIndex[viewName]] !== undefined) {
    links[viewIndex[viewName]].classList.add('active', 'bg-primary', 'rounded');
  }
  // Load data for the view
  if (viewName === 'alerts') { loadAlerts(); loadSummary(); }
  if (viewName === 'reports') { loadReports(); }
  if (viewName === 'tasks') { loadTasks(); }
  if (viewName === 'gaps') { loadGaps(); }
  if (viewName === 'sources') { loadSources(); }
  if (viewName === 'regulations') { loadRegulations(); loadSourcesDropdown(); }
  if (viewName === 'changes') { loadCI(); }
  if (viewName === 'impact') { loadCI(); }
  if (viewName === 'policies') { loadPolicies(); loadPolicyProposals(); }
  if (viewName === 'audit') { loadAuditLogs(); loadUsersDropdown(); }
}

// ==================== ALERTS VIEW (Task 3.3) ====================

async function loadAlerts() {
  try {
    showLoading('alertsBody');
    var response = await fetch(API_BASE + '/api/alerts');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    allAlerts = await response.json();
    if (allAlerts.length === 0) {
      showEmpty('alertsBody', 'No alerts found.');
    } else {
      renderAlerts(allAlerts);
    }
    hideError();
  } catch (err) {
    showError('Unable to load alert data. Please try again later.');
  }
}

async function loadSummary() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var summary = await response.json();
    document.getElementById('cardTotal').textContent = summary.total || 0;
    document.getElementById('cardUnread').textContent = summary.unread || 0;
    document.getElementById('cardImmediate').textContent = summary.immediate || 0;
    document.getElementById('cardReview').textContent = summary.review || 0;
    document.getElementById('cardInformational').textContent = summary.informational || 0;
  } catch (err) {
    showError('Unable to load summary data. Please try again later.');
  }
}

function renderAlerts(alerts) {
  var tbody = document.getElementById('alertsBody');
  tbody.innerHTML = '';

  if (alerts.length === 0) {
    showEmpty('alertsBody', 'No alerts found.');
    document.getElementById('alertsPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(alerts, alertsPage);

  pageData.forEach(function(alert) {
    var tr = document.createElement('tr');
    tr.id = 'alert-row-' + alert.alert_id;
    if (alert.status === 'Unread' && alert.severity_level === 'Immediate Action Required') {
      tr.style.borderLeft = '4px solid #dc3545';
    }

    // Regulation title — clickable to Changes & Impact detail
    var tdTitle = document.createElement('td');
    var titleHtml = '<span class="fw-semibold">' + escapeHtml(alert.title) + '</span>';
    if (alert.category) titleHtml += '<br><span class="badge bg-info text-dark" style="font-size:0.6rem;">' + escapeHtml(alert.category) + '</span>';
    if (alert.change_id) {
      titleHtml += ' <a href="#" class="small text-primary" onclick="navigateToChangeDetail(' + alert.change_id + '); return false;">View Change</a>';
    }
    if (alert.source_url) {
      titleHtml += ' <a href="' + escapeHtml(alert.source_url) + '" target="_blank" class="small text-muted">🔗</a>';
    }
    tdTitle.innerHTML = titleHtml;
    tr.appendChild(tdTitle);

    // Severity Badge
    var tdSeverity = document.createElement('td');
    tdSeverity.innerHTML = '<span class="badge ' + getSeverityClass(alert.severity_level) + '">' + escapeHtml(alert.severity_level) + '</span>';
    if (alert.impact_score) {
      tdSeverity.innerHTML += '<br><small class="text-muted">' + alert.impact_score + ' impact</small>';
    }
    tr.appendChild(tdSeverity);

    // Department
    var tdDept = document.createElement('td');
    tdDept.innerHTML = alert.department
      ? '<span class="badge bg-secondary" style="font-size:0.7rem;">' + escapeHtml(alert.department) + '</span>'
      : '<span class="text-muted small">—</span>';
    if (alert.auto_task) {
      tdDept.innerHTML += '<br><span class="badge bg-success mt-1" style="font-size:0.6rem;">⚡ Task: ' + escapeHtml(alert.auto_task.task_status) + '</span>';
    }
    tr.appendChild(tdDept);

    // Detected time (relative)
    var tdTime = document.createElement('td');
    tdTime.innerHTML = '<small class="fw-semibold">' + timeAgo(alert.created_at) + '</small><br><small class="text-muted">' + formatDate(alert.created_at) + '</small>';
    tr.appendChild(tdTime);

    // Status
    var tdStatus = document.createElement('td');
    var statusBadge = alert.status === 'Unread' ? 'bg-danger' : alert.status === 'Read' ? 'bg-secondary' : 'bg-dark';
    tdStatus.innerHTML = '<span class="badge ' + statusBadge + '" style="font-size:0.7rem;">' + alert.status + '</span>';
    tr.appendChild(tdStatus);

    // Actions
    var tdActions = document.createElement('td');
    var select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.style.fontSize = '0.75rem';
    ['Unread', 'Read', 'Dismissed'].forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      if (alert.status === s) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function() { updateAlertStatus(alert.alert_id, this.value); });
    tdActions.appendChild(select);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  renderPagination('alertsPagination', alertsPage, alerts.length, function(page) {
    alertsPage = page;
    renderAlerts(alerts);
  });

  // Highlight target alerts if navigated from Tasks
  if (window._highlightAlertIds && window._highlightAlertIds.length > 0) {
    var targetIds = window._highlightAlertIds;
    window._highlightAlertIds = null;
    setTimeout(function() {
      targetIds.forEach(function(id) {
        var row = document.getElementById('alert-row-' + id);
        if (row) {
          row.style.outline = '2px solid #0d6efd';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }, 100);
  }
}

async function bulkAlertAction(status, severityFilter) {
  try {
    var body = { status: status };
    if (severityFilter) body.severity_filter = severityFilter;
    var resp = await fetch(API_BASE + '/api/alerts/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('Failed');
    var result = await resp.json();
    showToast('Updated ' + result.affected + ' alerts to ' + status, 'success');
    loadAlerts();
    loadSummary();
  } catch (err) {
    showToast('Bulk update failed', 'danger');
  }
}

async function sendTestEmail() {
  try {
    var resp = await fetch(API_BASE + '/api/admin/test-email', { method: 'POST' });
    var result = await resp.json();
    if (resp.ok) {
      showToast('✉️ ' + result.message, 'success');
    } else {
      showToast('Email failed: ' + result.error, 'danger');
    }
  } catch (err) {
    showToast('Email send failed', 'danger');
  }
}

function navigateToChangeDetail(changeId) {
  window._openChangeDetailId = changeId;
  showView('changes');
  setTimeout(function() {
    if (window._openChangeDetailId) {
      openCIDetail(window._openChangeDetailId);
      window._openChangeDetailId = null;
    }
  }, 500);
}

async function updateAlertStatus(alertId, newStatus) {
  try {
    var response = await fetch(API_BASE + '/api/alerts/' + alertId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!response.ok) throw new Error('Failed to update alert status');
    // Update local data
    allAlerts = allAlerts.map(function (a) {
      if (a.alert_id === alertId) {
        return Object.assign({}, a, { status: newStatus });
      }
      return a;
    });
    applyFilters();
    loadSummary();
    showToast('Alert status updated to ' + newStatus, 'success');
  } catch (err) {
    showError('Failed to update alert status. Please try again.');
    showToast('Failed to update alert status', 'danger');
  }
}

// ==================== FILTERING (Task 3.6) ====================

function applyFilters() {
  var severityFilter = document.getElementById('filterSeverity').value;
  var statusFilter = document.getElementById('filterStatus').value;
  var filtered = allAlerts;

  if (severityFilter) {
    filtered = filtered.filter(function (a) {
      return a.severity_level === severityFilter;
    });
  }
  if (statusFilter) {
    filtered = filtered.filter(function (a) {
      return a.status === statusFilter;
    });
  }
  alertsPage = 1; // Reset to page 1 when filtering
  renderAlerts(filtered);
}

// ==================== REPORTS VIEW (Task 3.8) ====================

function showReportTab(tabName) {
  // Hide all report pages
  document.querySelectorAll('[id^="reportPage-"]').forEach(function(el) { el.classList.add('d-none'); });
  // Show target page
  document.getElementById('reportPage-' + tabName).classList.remove('d-none');
  // Update tab active state
  document.querySelectorAll('[id^="reportTab-"]').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('reportTab-' + tabName).classList.add('active');
}

// ==================== NEW REPORTS LOADING ====================

var rptCharts = {};

async function loadReports() {
  try {
    var [changesResp, gapsResp, tasksResp, regsResp, policiesResp] = await Promise.all([
      fetch(API_BASE + '/api/regulation-changes'),
      fetch(API_BASE + '/api/compliance-gaps'),
      fetch(API_BASE + '/api/tasks'),
      fetch(API_BASE + '/api/regulations?page=1&limit=999'),
      fetch(API_BASE + '/api/internal-policies')
    ]);

    var changes = changesResp.ok ? await changesResp.json() : [];
    var gaps = gapsResp.ok ? await gapsResp.json() : [];
    var tasks = tasksResp.ok ? await tasksResp.json() : [];
    var regsData = regsResp.ok ? await regsResp.json() : {};
    var regs = regsData.data || regsData || [];
    var policies = policiesResp.ok ? await policiesResp.json() : [];

    // --- Tab 1: Regulatory Changes ---
    var critHigh = changes.filter(function(c) { return c.impact_score === 'Critical' || c.impact_score === 'High'; }).length;
    var penaltyLinked = changes.filter(function(c) { return c.explicit_deadline && (c.impact_score === 'Critical'); }).length;
    document.getElementById('rptTotalChanges').textContent = changes.length;
    document.getElementById('rptCritHighCount').textContent = critHigh;
    document.getElementById('rptPenaltyCount').textContent = penaltyLinked;

    // Impact doughnut
    var impactCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    changes.forEach(function(c) { if (impactCounts.hasOwnProperty(c.impact_score)) impactCounts[c.impact_score]++; });
    renderChart('rptImpactDoughnut', 'doughnut', Object.keys(impactCounts), Object.values(impactCounts), ['#dc3545', '#fd7e14', '#ffc107', '#198754']);

    // Category bar
    var catCounts = {};
    changes.forEach(function(c) { var cat = c.category || 'Other'; catCounts[cat] = (catCounts[cat] || 0) + 1; });
    renderChart('rptCategoryBar', 'bar', Object.keys(catCounts), Object.values(catCounts), ['#0d6efd']);

    // Changes over time (group by date)
    var dateCounts = {};
    changes.forEach(function(c) { var d = formatDate(c.detected_at); dateCounts[d] = (dateCounts[d] || 0) + 1; });
    var sortedDates = Object.keys(dateCounts).sort(function(a, b) { return new Date(a) - new Date(b); });
    renderChart('rptChangesTimeline', 'line', sortedDates, sortedDates.map(function(d) { return dateCounts[d]; }), ['#0d6efd']);

    // --- Tab 2: Gap Analysis ---
    var gapOpen = gaps.filter(function(g) { return g.status === 'Open'; }).length;
    var gapReview = gaps.filter(function(g) { return g.status === 'In Review'; }).length;
    var gapRemediated = gaps.filter(function(g) { return g.status === 'Remediated'; }).length;
    var resRate = gaps.length > 0 ? Math.round((gapRemediated / gaps.length) * 100) : 0;
    document.getElementById('rptGapsOpen').textContent = gapOpen;
    document.getElementById('rptGapsReview').textContent = gapReview;
    document.getElementById('rptGapsRemediated').textContent = gapRemediated;
    document.getElementById('rptGapsResRate').textContent = resRate + '%';

    // Gap type distribution
    var typeCounts = {};
    gaps.forEach(function(g) {
      var typeMatch = (g.gap_description || '').match(/\[Type:\s*([^\]]+)\]/);
      var type = typeMatch ? typeMatch[1] : 'Unclassified';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    renderChart('rptGapTypePie', 'pie', Object.keys(typeCounts), Object.values(typeCounts), ['#dc3545', '#fd7e14', '#ffc107', '#0dcaf0', '#6f42c1', '#6c757d']);

    // Gaps by policy
    var policyGapCounts = {};
    gaps.forEach(function(g) { var pn = g.policy_name || 'Unknown'; policyGapCounts[pn] = (policyGapCounts[pn] || 0) + 1; });
    var sortedPolicies = Object.entries(policyGapCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    renderChart('rptGapsByPolicy', 'bar', sortedPolicies.map(function(p) { return p[0].replace('GLDB ', '').substring(0, 25); }), sortedPolicies.map(function(p) { return p[1]; }), ['#fd7e14']);

    // Gap status bar
    renderChart('rptGapStatusBar', 'bar', ['Open', 'In Review', 'Remediated'], [gapOpen, gapReview, gapRemediated], ['#dc3545', '#ffc107', '#198754']);

    // --- Tab 3: Tasks ---
    var taskPending = tasks.filter(function(t) { return t.status === 'Pending'; }).length;
    var taskProgress = tasks.filter(function(t) { return t.status === 'In Progress'; }).length;
    var taskCompleted = tasks.filter(function(t) { return t.status === 'Completed'; }).length;
    document.getElementById('rptTasksTotal').textContent = tasks.length;
    document.getElementById('rptTasksPending').textContent = taskPending;
    document.getElementById('rptTasksProgress').textContent = taskProgress;
    document.getElementById('rptTasksCompleted').textContent = taskCompleted;

    renderChart('rptTaskStatusPie', 'doughnut', ['Pending', 'In Progress', 'Completed'], [taskPending, taskProgress, taskCompleted], ['#ffc107', '#0d6efd', '#198754']);

    // Tasks by department
    var deptCounts = {};
    tasks.forEach(function(t) { var d = t.department || 'Unassigned'; deptCounts[d] = (deptCounts[d] || 0) + 1; });
    renderChart('rptTasksByDept', 'bar', Object.keys(deptCounts), Object.values(deptCounts), ['#6f42c1']);

    // Task burndown (tasks by deadline)
    var deadlineCounts = {};
    tasks.filter(function(t) { return t.status !== 'Completed'; }).forEach(function(t) {
      var d = formatDate(t.deadline); deadlineCounts[d] = (deadlineCounts[d] || 0) + 1;
    });
    var sortedDeadlines = Object.keys(deadlineCounts).sort(function(a, b) { return new Date(a) - new Date(b); });
    renderChart('rptTaskBurndown', 'bar', sortedDeadlines, sortedDeadlines.map(function(d) { return deadlineCounts[d]; }), ['#dc3545']);

    // --- Tab 4: Compliance Posture ---
    var compScore = gaps.length > 0 ? Math.round((gapRemediated / gaps.length) * 100) : 100;
    var scoreEl = document.getElementById('rptComplianceScore');
    scoreEl.textContent = compScore + '%';
    scoreEl.style.color = compScore >= 80 ? '#198754' : compScore >= 50 ? '#ffc107' : '#dc3545';
    document.getElementById('rptRegsMonitored').textContent = regs.length;
    document.getElementById('rptPoliciesCount').textContent = policies.length;

    // Policy heatmap
    var heatmapBody = document.getElementById('rptPolicyHeatmap');
    heatmapBody.innerHTML = '';
    var policyGapMap = {};
    gaps.forEach(function(g) {
      var pn = g.policy_name || 'Unknown';
      if (!policyGapMap[pn]) policyGapMap[pn] = { open: 0, review: 0, remediated: 0 };
      if (g.status === 'Open') policyGapMap[pn].open++;
      else if (g.status === 'In Review') policyGapMap[pn].review++;
      else if (g.status === 'Remediated') policyGapMap[pn].remediated++;
    });
    Object.keys(policyGapMap).sort().forEach(function(pn) {
      var p = policyGapMap[pn];
      var total = p.open + p.review + p.remediated;
      var bgClass = p.open > 3 ? 'table-danger' : p.open > 0 ? 'table-warning' : 'table-success';
      heatmapBody.innerHTML += '<tr class="' + bgClass + '"><td>' + escapeHtml(pn.replace('GLDB ', '')) + '</td><td class="text-center">' + p.open + '</td><td class="text-center">' + p.review + '</td><td class="text-center">' + p.remediated + '</td><td class="text-center fw-bold">' + total + '</td></tr>';
    });

  } catch (err) {
    console.error('Reports load error:', err);
  }
}

function renderChart(canvasId, type, labels, data, colors) {
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (rptCharts[canvasId]) rptCharts[canvasId].destroy();
  rptCharts[canvasId] = new Chart(ctx.getContext('2d'), {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: type === 'line' ? 'rgba(13,110,253,0.1)' : colors,
        borderColor: type === 'line' ? '#0d6efd' : (type === 'bar' ? colors[0] : undefined),
        fill: type === 'line',
        tension: type === 'line' ? 0.3 : undefined,
        borderWidth: type === 'pie' || type === 'doughnut' ? 2 : 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: type === 'pie' || type === 'doughnut' } },
      scales: type === 'bar' || type === 'line' ? { y: { beginAtZero: true } } : undefined
    }
  });
}

async function loadCategories() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/categories');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var categories = await response.json();
    var tbody = document.getElementById('categoriesBody');
    tbody.innerHTML = '';

    categories.forEach(function (cat) {
      var tr = document.createElement('tr');

      var tdCategory = document.createElement('td');
      tdCategory.textContent = cat.category;
      tr.appendChild(tdCategory);

      var tdCount = document.createElement('td');
      tdCount.textContent = cat.change_count;
      tr.appendChild(tdCount);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load category data. Please try again later.');
  }
}

async function loadTrends() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/trends');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var trends = await response.json();

    var ctx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trends.map(function (d) { return d.date; }),
        datasets: [{
          label: 'Alerts',
          data: trends.map(function (d) { return d.count; }),
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    showError('Unable to load trend data. Please try again later.');
  }
}

async function loadReportsSummary() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var summary = await response.json();
    var container = document.getElementById('complianceStatus');
    container.innerHTML = '';

    // Unread/Total ratio as progress bar
    var total = summary.total || 0;
    var unread = summary.unread || 0;
    var readPercent = total > 0 ? Math.round(((total - unread) / total) * 100) : 0;

    var ratioDiv = document.createElement('div');
    ratioDiv.className = 'mb-3';
    ratioDiv.innerHTML =
      '<h6 class="fw-semibold">Alert Review Progress</h6>' +
      '<p class="text-muted mb-1">' + (total - unread) + ' of ' + total + ' alerts reviewed (' + readPercent + '%)</p>' +
      '<div class="progress" style="height: 20px;">' +
        '<div class="progress-bar bg-success" role="progressbar" style="width: ' + readPercent + '%;" aria-valuenow="' + readPercent + '" aria-valuemin="0" aria-valuemax="100">' + readPercent + '%</div>' +
      '</div>';
    container.appendChild(ratioDiv);

    // Severity distribution as colored badges with counts
    var distDiv = document.createElement('div');
    distDiv.className = 'mt-3';
    distDiv.innerHTML =
      '<h6 class="fw-semibold">Severity Distribution</h6>' +
      '<span class="badge bg-danger me-2">Immediate: ' + (summary.immediate || 0) + '</span>' +
      '<span class="badge bg-warning text-dark me-2">Review: ' + (summary.review || 0) + '</span>' +
      '<span class="badge bg-info me-2">Informational: ' + (summary.informational || 0) + '</span>';
    container.appendChild(distDiv);
  } catch (err) {
    showError('Unable to load compliance status. Please try again later.');
  }
}

// ==================== ADDITIONAL REPORT CHARTS ====================

var severityPieChart = null;
var categoryBarChart = null;
var impactDoughnutChart = null;
var taskStatusChart = null;

async function loadSeverityPieChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/summary');
    if (!response.ok) return;
    var summary = await response.json();

    var ctx = document.getElementById('severityPieChart').getContext('2d');
    if (severityPieChart) severityPieChart.destroy();

    severityPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Immediate Action Required', 'Review Recommended', 'Informational'],
        datasets: [{
          data: [summary.immediate || 0, summary.review || 0, summary.informational || 0],
          backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15 } }
        }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadCategoryBarChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/categories');
    if (!response.ok) return;
    var categories = await response.json();

    var ctx = document.getElementById('categoryBarChart').getContext('2d');
    if (categoryBarChart) categoryBarChart.destroy();

    var colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1', '#0dcaf0', '#fd7e14', '#20c997'];

    categoryBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories.map(function(c) { return c.category; }),
        datasets: [{
          label: 'Regulation Changes',
          data: categories.map(function(c) { return c.change_count; }),
          backgroundColor: categories.map(function(_, i) { return colors[i % colors.length]; }),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadImpactDoughnutChart() {
  try {
    var response = await fetch(API_BASE + '/api/regulation-changes');
    if (!response.ok) return;
    var changes = await response.json();

    var counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    changes.forEach(function(c) { if (counts.hasOwnProperty(c.impact_score)) counts[c.impact_score]++; });

    var ctx = document.getElementById('impactDoughnutChart').getContext('2d');
    if (impactDoughnutChart) impactDoughnutChart.destroy();

    impactDoughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [counts.Critical, counts.High, counts.Medium, counts.Low],
          backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15 } }
        }
      }
    });
  } catch (err) { /* silent */ }
}

async function loadTaskStatusChart() {
  try {
    var response = await fetch(API_BASE + '/api/tasks');
    if (!response.ok) return;
    var tasks = await response.json();

    var counts = { Pending: 0, 'In Progress': 0, Completed: 0 };
    tasks.forEach(function(t) { if (counts.hasOwnProperty(t.status)) counts[t.status]++; });

    var ctx = document.getElementById('taskStatusChart').getContext('2d');
    if (taskStatusChart) taskStatusChart.destroy();

    taskStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Pending', 'In Progress', 'Completed'],
        datasets: [{
          label: 'Tasks',
          data: [counts.Pending, counts['In Progress'], counts.Completed],
          backgroundColor: ['#ffc107', '#0d6efd', '#198754'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (err) { /* silent */ }
}

// ==================== ENHANCED REPORT CHARTS ====================

var gapResolutionChart = null;
var sourceActivityChartInstance = null;
var responseTimeChartInstance = null;
var taskDeadlineChartInstance = null;

// 1. Compliance Gap Resolution Rate — gaps opened vs resolved over time
async function loadGapResolutionChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/gap-resolution');
    if (!response.ok) return;
    var data = await response.json();

    var allDates = [];
    data.opened.forEach(function(d) { if (allDates.indexOf(d.date) === -1) allDates.push(d.date); });
    data.resolved.forEach(function(d) { if (allDates.indexOf(d.date) === -1) allDates.push(d.date); });
    allDates.sort();

    var openedData = allDates.map(function(date) {
      var found = data.opened.find(function(d) { return d.date === date; });
      return found ? found.count : 0;
    });
    var resolvedData = allDates.map(function(date) {
      var found = data.resolved.find(function(d) { return d.date === date; });
      return found ? found.count : 0;
    });

    var labels = allDates.map(function(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });

    var ctx = document.getElementById('gapResolutionChart').getContext('2d');
    if (gapResolutionChart) gapResolutionChart.destroy();

    gapResolutionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Gaps Opened',
            data: openedData.length > 0 ? openedData : [0],
            backgroundColor: 'rgba(220, 53, 69, 0.7)',
            borderRadius: 4
          },
          {
            label: 'Gaps Resolved',
            data: resolvedData.length > 0 ? resolvedData : [0],
            backgroundColor: 'rgba(25, 135, 84, 0.7)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } catch (err) { /* silent */ }
}

// 2. Regulatory Source Activity — which sources generate the most regulations/changes
async function loadSourceActivityChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/source-activity');
    if (!response.ok) return;
    var sources = await response.json();

    var ctx = document.getElementById('sourceActivityChart').getContext('2d');
    if (sourceActivityChartInstance) sourceActivityChartInstance.destroy();

    var colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1', '#0dcaf0', '#fd7e14'];

    sourceActivityChartInstance = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: sources.map(function(s) { return s.source_name; }),
        datasets: [{
          data: sources.map(function(s) { return s.regulation_count; }),
          backgroundColor: sources.map(function(_, i) { return colors[i % colors.length] + '99'; }),
          borderColor: sources.map(function(_, i) { return colors[i % colors.length]; }),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } },
          title: { display: true, text: 'Regulations per Source', font: { size: 13 } }
        }
      }
    });

    // Also populate the source activity table
    var tbody = document.getElementById('sourceActivityBody');
    if (tbody) {
      tbody.innerHTML = '';
      sources.forEach(function(s) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + s.source_name + '</td><td>' + s.regulation_count + '</td><td>' + s.change_count + '</td>';
        tbody.appendChild(tr);
      });
    }
  } catch (err) { /* silent */ }
}

// 3. Alert Response Rate — reviewed vs pending over time
async function loadResponseTimeChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/response-time');
    if (!response.ok) throw new Error('Failed to fetch');
    var data = await response.json();

    var labels = data.map(function(d) { return new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });
    var reviewedData = data.map(function(d) { return d.reviewed; });
    var pendingData = data.map(function(d) { return d.pending; });

    var ctx = document.getElementById('responseTimeChart').getContext('2d');
    if (responseTimeChartInstance) responseTimeChartInstance.destroy();

    responseTimeChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Reviewed (Read/Dismissed)',
            data: reviewedData.length > 0 ? reviewedData : [0],
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Pending (Unread)',
            data: pendingData.length > 0 ? pendingData : [0],
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });

    // Response metrics summary
    var totalAlerts = data.reduce(function(sum, d) { return sum + d.total; }, 0);
    var totalReviewed = data.reduce(function(sum, d) { return sum + d.reviewed; }, 0);
    var reviewRate = totalAlerts > 0 ? Math.round((totalReviewed / totalAlerts) * 100) : 0;

    var metricsDiv = document.getElementById('responseMetrics');
    if (metricsDiv) {
      metricsDiv.innerHTML =
        '<div class="row text-center">' +
        '<div class="col-4"><h3 class="text-primary mb-0">' + totalAlerts + '</h3><small class="text-muted">Total Alerts</small></div>' +
        '<div class="col-4"><h3 class="text-success mb-0">' + totalReviewed + '</h3><small class="text-muted">Reviewed</small></div>' +
        '<div class="col-4"><h3 class="text-' + (reviewRate >= 70 ? 'success' : reviewRate >= 40 ? 'warning' : 'danger') + ' mb-0">' + reviewRate + '%</h3><small class="text-muted">Review Rate</small></div>' +
        '</div>' +
        '<div class="progress mt-3" style="height: 24px;">' +
        '<div class="progress-bar bg-success" style="width: ' + reviewRate + '%;">' + reviewRate + '% Reviewed</div>' +
        '<div class="progress-bar bg-danger" style="width: ' + (100 - reviewRate) + '%;">' + (100 - reviewRate) + '% Pending</div>' +
        '</div>';
    }
  } catch (err) {
    var metricsDiv = document.getElementById('responseMetrics');
    if (metricsDiv) {
      metricsDiv.innerHTML =
        '<div class="row text-center">' +
        '<div class="col-4"><h3 class="text-primary mb-0">0</h3><small class="text-muted">Total Alerts</small></div>' +
        '<div class="col-4"><h3 class="text-success mb-0">0</h3><small class="text-muted">Reviewed</small></div>' +
        '<div class="col-4"><h3 class="text-muted mb-0">0%</h3><small class="text-muted">Review Rate</small></div>' +
        '</div>' +
        '<div class="progress mt-3" style="height: 24px;">' +
        '<div class="progress-bar bg-secondary" style="width: 100%;">No data available</div>' +
        '</div>';
    }
  }
}

// 4. Task Deadline Burndown — upcoming deadlines on a timeline
async function loadTaskDeadlineChart() {
  try {
    var response = await fetch(API_BASE + '/api/dashboard/task-deadlines');
    if (!response.ok) return;
    var tasks = await response.json();

    if (tasks.length === 0) {
      var ctx = document.getElementById('taskDeadlineChart').getContext('2d');
      if (taskDeadlineChartInstance) taskDeadlineChartInstance.destroy();
      taskDeadlineChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['No pending tasks'], datasets: [{ data: [0], backgroundColor: '#198754' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
      return;
    }

    var now = new Date();
    var labels = tasks.map(function(t) { return t.title.length > 20 ? t.title.substring(0, 20) + '...' : t.title; });
    var daysUntilDeadline = tasks.map(function(t) {
      var deadline = new Date(t.deadline);
      return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    });
    var barColors = daysUntilDeadline.map(function(days) {
      if (days < 0) return '#dc3545';       // Overdue — red
      if (days <= 3) return '#ffc107';       // Urgent — yellow
      if (days <= 7) return '#fd7e14';       // Soon — orange
      return '#198754';                       // Safe — green
    });

    var ctx = document.getElementById('taskDeadlineChart').getContext('2d');
    if (taskDeadlineChartInstance) taskDeadlineChartInstance.destroy();

    taskDeadlineChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Days Until Deadline',
          data: daysUntilDeadline,
          backgroundColor: barColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Days Until Deadline (red = overdue, yellow = urgent, green = safe)', font: { size: 12 } },
          tooltip: {
            callbacks: {
              label: function(context) {
                var days = context.raw;
                if (days < 0) return Math.abs(days) + ' days overdue';
                if (days === 0) return 'Due today';
                return days + ' days remaining';
              },
              afterLabel: function(context) {
                return 'Assignee: ' + tasks[context.dataIndex].assignee;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Days' },
            grid: { color: function(context) { return context.tick.value === 0 ? '#dc3545' : 'rgba(0,0,0,0.1)'; } }
          }
        }
      }
    });
  } catch (err) { /* silent */ }
}

// ==================== TASKS VIEW (Task 3.9 + 5.8 Enhanced) ====================

async function loadTasks() {
  try {
    showLoading('tasksBody');
    var response = await fetch(API_BASE + '/api/tasks');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var tasks = await response.json();
    var tbody = document.getElementById('tasksBody');
    tbody.innerHTML = '';

    // Populate alert dropdown
    try {
      var alertsResp = await fetch(API_BASE + '/api/alerts');
      if (alertsResp.ok) {
        var alertsList = await alertsResp.json();
        var taskAlertSelect = document.getElementById('taskAlertSelect');
        taskAlertSelect.innerHTML = '<option value="">None</option>';
        alertsList.forEach(function (a) {
          var opt = document.createElement('option');
          opt.value = a.alert_id;
          opt.textContent = a.title || ('Alert #' + a.alert_id);
          taskAlertSelect.appendChild(opt);
        });
      }
    } catch (e) { /* dropdown population failed silently */ }

    if (tasks.length === 0) {
      showEmpty('tasksBody', 'No tasks found.');
      return;
    }

    var pageData = paginateArray(tasks, tasksPage);

    pageData.forEach(function (task) {
      var tr = document.createElement('tr');

      // Highlight urgent deadlines
      if (isDeadlineUrgent(task.deadline)) {
        tr.classList.add('table-danger');
      }

      var tdTitle = document.createElement('td');
      var hasGaps = task.gap_ids && task.gap_ids.length > 0;
      var hasAlerts = task.alert_ids && task.alert_ids.length > 0;

      // Task title — always clickable
      var titleSpan = document.createElement('span');
      titleSpan.textContent = task.title;
      titleSpan.className = 'fw-semibold';
      tdTitle.appendChild(titleSpan);

      // Linkage badges below title — clickable navigation
      if (hasGaps) {
        var gapLink = document.createElement('a');
        gapLink.href = '#';
        gapLink.className = 'badge bg-warning text-dark me-1 mt-1 d-inline-block text-decoration-none';
        gapLink.textContent = '🔗 ' + task.gap_ids.length + ' gap' + (task.gap_ids.length > 1 ? 's' : '');
        gapLink.title = 'View linked compliance gaps';
        (function(gapIds) {
          gapLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToGaps(gapIds);
          });
        })(task.gap_ids);
        tdTitle.appendChild(document.createElement('br'));
        tdTitle.appendChild(gapLink);
      }

      if (hasAlerts) {
        var changeLink = document.createElement('a');
        changeLink.href = '#';
        changeLink.className = 'badge bg-info text-dark me-1 mt-1 d-inline-block text-decoration-none';
        changeLink.textContent = '📋 ' + task.alert_ids.length + ' change' + (task.alert_ids.length > 1 ? 's' : '');
        changeLink.title = 'View linked regulatory changes';
        (function(alertIds) {
          changeLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToChanges(alertIds);
          });
        })(task.alert_ids);
        if (!hasGaps) tdTitle.appendChild(document.createElement('br'));
        tdTitle.appendChild(changeLink);
      }

      tdTitle.title = task.description || '';
      tr.appendChild(tdTitle);

      var tdDept = document.createElement('td');
      if (task.department) {
        var deptBadge = document.createElement('span');
        deptBadge.className = 'badge bg-secondary';
        deptBadge.textContent = task.department;
        tdDept.appendChild(deptBadge);
      } else {
        tdDept.innerHTML = '<span class="text-muted">—</span>';
      }
      tr.appendChild(tdDept);

      var tdDeadline = document.createElement('td');
      tdDeadline.textContent = formatDate(task.deadline);
      tr.appendChild(tdDeadline);

      // Status dropdown
      var tdStatus = document.createElement('td');
      var statusSelect = document.createElement('select');
      statusSelect.className = 'form-select form-select-sm';
      statusSelect.setAttribute('aria-label', 'Change task status');
      ['Pending', 'In Progress', 'Completed'].forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (task.status === s) opt.selected = true;
        statusSelect.appendChild(opt);
      });
      statusSelect.addEventListener('change', function () {
        updateTaskStatus(task.task_id, this.value);
      });
      tdStatus.appendChild(statusSelect);
      tr.appendChild(tdStatus);

      // Actions - Delete button
      var tdActions = document.createElement('td');
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function () {
        deleteTask(task.task_id);
      });
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });

    renderPagination('tasksPagination', tasksPage, tasks.length, function(page) {
      tasksPage = page;
      loadTasks();
    });
  } catch (err) {
    showError('Unable to load task data. Please try again later.');
  }
}

// Navigate from Tasks to specific Gap card(s)
function navigateToGap(gapId) {
  window._scrollToGapIds = [gapId];
  showView('gaps');
}

function navigateToGaps(gapIds) {
  window._scrollToGapIds = gapIds;
  showView('gaps');
}

function navigateToAlerts(alertIds) {
  window._highlightAlertIds = alertIds;
  showView('alerts');
}

// Navigate from Tasks to Changes & Impact filtered to specific change_ids
function navigateToChanges(alertIds) {
  window._filterChangeAlertIds = alertIds;
  showView('changes');
}

async function submitTask(e) {
  e.preventDefault();
  try {
    var title = document.getElementById('taskTitleInput').value;
    var description = document.getElementById('taskDescInput').value;
    var department = document.getElementById('taskDeptSelect').value;
    var deadline = document.getElementById('taskDeadlineInput').value;
    var alert_id = document.getElementById('taskAlertSelect').value;

    var body = { department: department, title: title, deadline: deadline };
    if (description) body.description = description;
    if (alert_id) body.alert_id = alert_id;

    var response = await fetch(API_BASE + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to create task');
    document.getElementById('taskForm').reset();
    loadTasks();
    showToast('Task created successfully', 'success');
  } catch (err) {
    showError('Failed to create task. Please try again.');
    showToast('Failed to create task', 'danger');
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    var response = await fetch(API_BASE + '/api/tasks/' + taskId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (!response.ok) throw new Error('Failed to update task status');
    loadTasks();
  } catch (err) {
    showError('Failed to update task status. Please try again.');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    var response = await fetch(API_BASE + '/api/tasks/' + taskId, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete task');
    loadTasks();
  } catch (err) {
    showError('Failed to delete task. Please try again.');
  }
}

// ==================== GAPS VIEW (Task 3.11 + 5.7 Enhanced) ====================

async function loadGaps() {
  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var gaps = await response.json();

    // Update summary cards and progress bar
    var openCount = 0, reviewCount = 0, remediatedCount = 0;
    gaps.forEach(function(g) {
      if (g.status === 'Open') openCount++;
      else if (g.status === 'In Review') reviewCount++;
      else if (g.status === 'Remediated') remediatedCount++;
    });
    var total = gaps.length || 1;
    var remediatedPct = Math.round((remediatedCount / total) * 100);
    var reviewPct = Math.round((reviewCount / total) * 100);

    document.getElementById('gapOpenCount').textContent = openCount;
    document.getElementById('gapReviewCount').textContent = reviewCount;
    document.getElementById('gapRemediatedCount').textContent = remediatedCount;
    document.getElementById('gapProgressText').textContent = remediatedCount + ' of ' + gaps.length + ' resolved (' + remediatedPct + '%)';
    document.getElementById('gapProgressBar').style.width = remediatedPct + '%';
    document.getElementById('gapProgressBar').textContent = remediatedPct + '%';
    document.getElementById('gapInReviewBar').style.width = reviewPct + '%';
    document.getElementById('gapInReviewBar').textContent = reviewPct > 0 ? reviewPct + '%' : '';

    // Populate regulation dropdown
    try {
      var regsResp = await fetch(API_BASE + '/api/regulations');
      if (regsResp.ok) {
        var regsData = await regsResp.json();
        var regs = regsData.data || regsData;
        var gapRegSelect = document.getElementById('gapRegSelect');
        gapRegSelect.innerHTML = '<option value="">Select regulation...</option>';
        regs.forEach(function (r) {
          var opt = document.createElement('option');
          opt.value = r.reg_id;
          opt.textContent = r.title;
          gapRegSelect.appendChild(opt);
        });
      }
    } catch (e) { /* silent */ }

    // Populate policy dropdown
    try {
      var polResp = await fetch(API_BASE + '/api/internal-policies');
      if (polResp.ok) {
        var policies = await polResp.json();
        var gapPolicySelect = document.getElementById('gapPolicySelect');
        gapPolicySelect.innerHTML = '<option value="">Select policy...</option>';
        policies.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.policy_id;
          opt.textContent = p.policy_name;
          gapPolicySelect.appendChild(opt);
        });
      }
    } catch (e) { /* silent */ }

    if (gaps.length === 0) {
      document.getElementById('gapsContainer').innerHTML = '<div class="col-12 text-center text-muted py-4">No compliance gaps found.</div>';
      return;
    }

    // Apply filters
    var statusFilter = document.getElementById('gapStatusFilter') ? document.getElementById('gapStatusFilter').value : '';
    var severityFilter = document.getElementById('gapSeverityFilter') ? document.getElementById('gapSeverityFilter').value : '';
    var typeFilter = document.getElementById('gapTypeFilter') ? document.getElementById('gapTypeFilter').value : '';

    if (statusFilter) {
      gaps = gaps.filter(function(g) { return g.status === statusFilter; });
    }
    if (severityFilter) {
      gaps = gaps.filter(function(g) {
        var sev = 'Medium';
        if (g.gap_description) {
          var m = g.gap_description.match(/\[Severity:\s*(Critical|High|Medium|Low)\]/i);
          if (m) sev = m[1];
        }
        return sev === severityFilter;
      });
    }
    if (typeFilter) {
      gaps = gaps.filter(function(g) {
        var type = 'Missing Procedure';
        if (g.gap_description) {
          var m = g.gap_description.match(/\[Type:\s*(Missing Procedure|Outdated Procedure)\]/i);
          if (m) type = m[1];
        }
        return type === typeFilter;
      });
    }

    if (gaps.length === 0) {
      document.getElementById('gapsContainer').innerHTML = '<div class="col-12 text-center text-muted py-4">No gaps match the selected filters.</div>';
      document.getElementById('gapsPagination').innerHTML = '';
      return;
    }

    // If navigated from Tasks, show ONLY the target gap(s)
    var singleGapMode = false;
    if (window._scrollToGapIds && window._scrollToGapIds.length > 0) {
      var targetIds = window._scrollToGapIds;
      window._scrollToGapIds = null;
      var filteredGaps = gaps.filter(function(g) { return targetIds.indexOf(g.gap_id) >= 0; });
      if (filteredGaps.length > 0) {
        gaps = filteredGaps;
        singleGapMode = true;
      }
    }

    var GAPS_PER_PAGE = 5;
    var container = document.getElementById('gapsContainer');
    container.innerHTML = '';

    // Show back button if viewing single gap
    if (singleGapMode) {
      var backRow = document.createElement('div');
      backRow.className = 'col-12 mb-2';
      backRow.innerHTML = '<button class="btn btn-outline-secondary btn-sm" onclick="loadGaps()">← Back to all gaps</button>';
      container.appendChild(backRow);
    }

    var gapsTotalPages = Math.ceil(gaps.length / GAPS_PER_PAGE);
    var startIdx = (gapsPage - 1) * GAPS_PER_PAGE;
    var pageData = gaps.slice(startIdx, startIdx + GAPS_PER_PAGE);

    pageData.forEach(function (gap) {
      // Parse severity from gap_description (gap-level severity takes priority)
      var severity = 'Medium';
      if (gap.gap_description) {
        var sevMatch = gap.gap_description.match(/\[Severity:\s*(Critical|High|Medium|Low)\]/i);
        if (sevMatch) severity = sevMatch[1];
      }
      // Fallback to regulation-level impact only if no gap severity found
      if (!gap.gap_description || !gap.gap_description.includes('[Severity:')) {
        if (gap.impact_score) severity = gap.impact_score;
      }

      // Parse gap_type (Missing Procedure vs Outdated Procedure)
      var gapType = 'Missing Procedure';
      if (gap.gap_description) {
        var typeMatch = gap.gap_description.match(/\[Type:\s*(Missing Procedure|Outdated Procedure)\]/i);
        if (typeMatch) gapType = typeMatch[1];
      }

      var severityColor = severity === 'Critical' ? 'danger' : severity === 'High' ? 'warning' : severity === 'Medium' ? 'info' : 'success';
      var borderColor = severity === 'Critical' ? 'border-danger' : severity === 'High' ? 'border-warning' : '';
      var typeColor = gapType === 'Outdated Procedure' ? 'dark' : 'secondary';
      var typeIcon = gapType === 'Outdated Procedure' ? '🕒' : '📋';

      // Parse gap description parts
      var gapText = gap.gap_description || '';
      var recommendation = '';
      var descOnly = gapText;
      if (gapText.includes('| Recommendation:')) {
        var parts = gapText.split('| Recommendation:');
        descOnly = parts[0].replace(/\s*\[Type:\s*[\w\s]+\]\s*/g, '').replace(/\s*\[Severity:\s*\w+\]\s*/g, '').replace(/\s*\| Sources:.*$/g, '').trim();
        recommendation = parts[1] ? parts[1].replace(/\s*\| Sources:.*$/g, '').trim() : '';
      } else {
        descOnly = gapText.replace(/\s*\[Type:\s*[\w\s]+\]\s*/g, '').replace(/\s*\[Severity:\s*\w+\]\s*/g, '').replace(/\s*\| Sources:.*$/g, '').trim();
      }

      // Clean regulation content
      var regContent = gap.regulation_content ? gap.regulation_content.replace(/^Scraped from [^:]+:\s*\S+\s*—?\s*/, '') : '';

      var col = document.createElement('div');
      col.className = 'col-12';
      col.id = 'gap-card-' + gap.gap_id;

      var card = document.createElement('div');
      card.className = 'card shadow-sm ' + borderColor;
      card.style.borderLeftWidth = '4px';

      var cardBody = document.createElement('div');
      cardBody.className = 'card-body';

      // Header row: impact badge + gap type badge, centered top
      var topBar = document.createElement('div');
      topBar.className = 'text-center mb-2';
      topBar.innerHTML = '<span class="badge bg-' + severityColor + ' px-3 py-2 me-2">' + severity + ' Impact</span>' +
        '<span class="badge bg-' + typeColor + ' px-3 py-2">' + typeIcon + ' ' + gapType + '</span>';
      cardBody.appendChild(topBar);

      var statusRow = document.createElement('div');
      statusRow.className = 'd-flex justify-content-between align-items-start mb-2';
      var statusBadgeColor = gap.status === 'Remediated' ? 'success' : gap.status === 'In Review' ? 'warning text-dark' : 'secondary';
      statusRow.innerHTML = '<div><small class="text-uppercase text-secondary fw-bold">Gap Description</small><br>' +
        '<strong class="text-dark">' + descOnly.substring(0, 120) + (descOnly.length > 120 ? '...' : '') + '</strong></div>' +
        '<span class="badge bg-' + statusBadgeColor + '">' + gap.status + '</span>';
      cardBody.appendChild(statusRow);

      // Two-column comparison: External Regulation vs Internal Policy
      var comparison = document.createElement('div');
      comparison.className = 'row g-3 mb-3';

      // Left: External Regulation
      var leftCol = document.createElement('div');
      leftCol.className = 'col-md-6';
      var leftContent = '<div class="p-2 bg-light rounded" style="min-height: 80px;">';
      leftContent += '<small class="text-uppercase text-secondary fw-bold d-block mb-1">External Regulation</small>';
      if (gap.source_url) {
        leftContent += '<a href="' + gap.source_url + '" target="_blank" class="fw-semibold text-primary text-decoration-none">' + gap.regulation_title + '</a>';
      } else {
        leftContent += '<span class="fw-semibold">' + gap.regulation_title + '</span>';
      }
      if (regContent) {
        leftContent += '<p class="text-muted small mb-0 mt-1">' + (regContent.length > 150 ? regContent.substring(0, 150) + '...' : regContent) + '</p>';
      }
      leftContent += '</div>';
      leftCol.innerHTML = leftContent;
      comparison.appendChild(leftCol);

      // Right: Internal Policy
      var rightCol = document.createElement('div');
      rightCol.className = 'col-md-6';
      var fullPolicyDesc = (gap.policy_description || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      var rightContent = '<div class="p-2 bg-light rounded" style="min-height: 80px;">';
      rightContent += '<small class="text-uppercase text-secondary fw-bold d-block mb-1">Internal Policy</small>';
      rightContent += '<span class="fw-semibold" style="cursor:pointer; border-bottom: 1px dashed #6c757d;" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-placement="top" data-bs-content="' + fullPolicyDesc + '">' + gap.policy_name + '</span>';
      if (gap.policy_description) {
        var polText = gap.policy_description.length > 150 ? gap.policy_description.substring(0, 150) + '...' : gap.policy_description;
        rightContent += '<p class="text-muted small mb-0 mt-1">' + polText + '</p>';
      }
      rightContent += '</div>';
      rightCol.innerHTML = rightContent;
      comparison.appendChild(rightCol);

      cardBody.appendChild(comparison);

      // Recommendation row
      if (recommendation) {
        var recDiv = document.createElement('div');
        recDiv.className = 'alert alert-light py-2 px-3 mb-2';
        recDiv.innerHTML = '<small class="fw-semibold text-secondary">💡 Recommendation:</small> <small>' + recommendation + '</small>';
        cardBody.appendChild(recDiv);
      }

      // Footer: Linked task or Create Task button (only for non-Critical/High)
      var footer = document.createElement('div');
      footer.className = 'd-flex justify-content-between align-items-center';

      var taskInfo = '';
      if (gap.linked_task_id) {
        var taskColor = gap.linked_task_status === 'Completed' ? 'success' : gap.linked_task_status === 'In Progress' ? 'warning' : 'secondary';
        taskInfo = '<span class="badge bg-' + taskColor + '">📋 ' + (gap.linked_task_title || 'Linked Task') + ' (' + gap.linked_task_status + ')</span>';
      } else if (severity === 'Critical' || severity === 'High') {
        taskInfo = '<span class="badge bg-info text-dark">⚡ Auto-assigned to department</span>';
      }
      footer.innerHTML = '<div>' + taskInfo + '</div>';

      // Show Create Task button ONLY for Medium/Low (non-critical) without a linked task
      if (!gap.linked_task_id && severity !== 'Critical' && severity !== 'High' && gap.status !== 'Remediated') {
        var taskBtn = document.createElement('button');
        taskBtn.className = 'btn btn-sm btn-outline-primary';
        taskBtn.innerHTML = '📋 Create Task';
        taskBtn.addEventListener('click', function() { openLinkGapTaskModal(gap); });
        footer.appendChild(taskBtn);
      }

      cardBody.appendChild(footer);
      card.appendChild(cardBody);
      col.appendChild(card);
      container.appendChild(col);
    });

    renderPagination('gapsPagination', gapsPage, gaps.length, function(page) {
      gapsPage = page;
      loadGaps();
    }, GAPS_PER_PAGE);

    // Initialize Bootstrap popovers for policy descriptions
    var popoverTriggers = document.querySelectorAll('[data-bs-toggle="popover"]');
    popoverTriggers.forEach(function(el) {
      new bootstrap.Popover(el, { container: 'body' });
    });

    // Highlight the card if in single gap mode
    if (singleGapMode) {
      document.getElementById('gapsPagination').innerHTML = '';
      var firstCard = container.querySelector('.card');
      if (firstCard) {
        firstCard.style.boxShadow = '0 0 0 3px #0d6efd';
      }
    }
  } catch (err) {
    showError('Unable to load compliance gap data. Please try again later.');
  }
}

// AI Gap Analysis
async function analyzeGapWithAI() {
  var regId = document.getElementById('gapRegSelect').value;
  var policyId = document.getElementById('gapPolicySelect').value;

  if (!regId || !policyId) {
    showToast('Please select both a regulation and a policy first', 'warning');
    return;
  }

  var resultDiv = document.getElementById('gapAIResult');
  var contentDiv = document.getElementById('gapAIContent');
  resultDiv.classList.remove('d-none');
  contentDiv.innerHTML = '<strong>🔄 Analyzing with AI...</strong> (RAG pipeline: retrieving policy chunks, sending to GPT-4o-mini)';

  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_id: regId, policy_id: policyId })
    });

    if (!response.ok) {
      var errData = await response.json();
      throw new Error(errData.error || 'Analysis failed');
    }

    var result = await response.json();

    var html = '<div class="d-flex justify-content-between align-items-start">';
    html += '<div><strong>✅ AI Gap Analysis Complete</strong></div>';
    html += '<button class="btn btn-sm btn-outline-secondary" onclick="clearGapAnalysis()">✕ Clear</button>';
    html += '</div>';
    html += '<hr class="my-2">';
    html += '<strong>Regulation:</strong> ' + result.regulation + '<br>';
    html += '<strong>Policy:</strong> ' + result.policy + '<br>';

    if (result.analysis && result.analysis.has_gaps && result.analysis.gaps && result.analysis.gaps.length > 0) {
      html += '<strong>Gaps Found:</strong> ' + result.analysis.gaps.length + '<br>';
      if (result.analysis.compliance_score !== undefined) {
        html += '<strong>Compliance Score:</strong> ' + result.analysis.compliance_score + '/100<br>';
      }
      html += '<div class="mt-2">';
      result.analysis.gaps.forEach(function(g, i) {
        html += '<div class="card card-body p-2 mb-2">';
        html += '<div class="d-flex justify-content-between align-items-center">';
        html += '<span>' + (i+1) + '. ' + (g.description || g) + '</span>';
        html += '<button class="btn btn-sm btn-success ms-2" onclick="saveGapFromAI(' + i + ')">Save</button>';
        html += '</div>';
        if (g.severity) html += '<small class="badge bg-' + getImpactBadgeColor(g.severity) + ' mt-1">' + g.severity + '</small>';
        if (g.recommendation) html += '<small class="text-muted d-block">Recommendation: ' + g.recommendation + '</small>';
        html += '</div>';
      });
      html += '</div>';
      if (result.analysis.recommendations && result.analysis.recommendations.length > 0) {
        html += '<strong class="mt-2 d-block">Recommendations:</strong><ul class="mb-0">';
        result.analysis.recommendations.forEach(function(r) { html += '<li><small>' + r + '</small></li>'; });
        html += '</ul>';
      }
    } else {
      html += '<span class="text-success">✓ No significant gaps identified. Policy appears compliant.</span>';
    }

    contentDiv.innerHTML = html;

    // Store analysis result for saving individual gaps
    window._lastGapAnalysis = result;

    showToast('AI gap analysis completed', 'success');
  } catch (err) {
    contentDiv.innerHTML = '<strong class="text-danger">Analysis Failed:</strong> ' + err.message + '<br><small class="text-muted">Ensure Pinecone is connected and OpenAI API key is valid.</small><br><button class="btn btn-sm btn-outline-secondary mt-2" onclick="clearGapAnalysis()">Clear</button>';
    showToast('Gap analysis failed: ' + err.message, 'danger');
  }
}

function clearGapAnalysis() {
  document.getElementById('gapAIResult').classList.add('d-none');
  document.getElementById('gapAIContent').innerHTML = '';
  window._lastGapAnalysis = null;
}

async function saveGapFromAI(index) {
  var analysis = window._lastGapAnalysis;
  if (!analysis || !analysis.analysis || !analysis.analysis.gaps || !analysis.analysis.gaps[index]) return;

  var gap = analysis.analysis.gaps[index];
  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reg_id: analysis.reg_id,
        policy_id: analysis.policy_id,
        gap_description: gap.description || gap
      })
    });
    if (!response.ok) throw new Error('Failed to save gap');
    showToast('Gap saved successfully', 'success');
    loadGaps();
  } catch (err) {
    showToast('Failed to save gap: ' + err.message, 'danger');
  }
}

async function submitGap(e) {
  e.preventDefault();
  try {
    var reg_id = document.getElementById('gapRegSelect').value;
    var policy_id = document.getElementById('gapPolicySelect').value;
    var gap_description = document.getElementById('gapDescInput').value;

    var response = await fetch(API_BASE + '/api/compliance-gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_id: reg_id, policy_id: policy_id, gap_description: gap_description })
    });
    if (!response.ok) throw new Error('Failed to create gap');
    document.getElementById('gapForm').reset();
    document.getElementById('gapAIResult').classList.add('d-none');
    loadGaps();
    showToast('Compliance gap created successfully', 'success');
  } catch (err) {
    showError('Failed to create compliance gap. Please try again.');
    showToast('Failed to create gap', 'danger');
  }
}

async function updateGapStatus(gapId, status) {
  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps/' + gapId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    if (!response.ok) throw new Error('Failed to update gap status');
    loadGaps();
    showToast('Gap status updated to ' + status, 'success');
  } catch (err) {
    showError('Failed to update gap status. Please try again.');
  }
}

// ==================== GAP-TO-TASK LINKING ====================

async function openLinkGapTaskModal(gap) {
  document.getElementById('linkGapId').value = gap.gap_id;
  document.getElementById('linkGapInfo').innerHTML = '<strong>Gap:</strong> ' + (gap.gap_description ? gap.gap_description.substring(0, 150) : 'N/A') + '<br><strong>Regulation:</strong> ' + gap.regulation_title;

  // Pre-fill title with a suggestion
  document.getElementById('linkTaskTitle').value = 'Remediate: ' + (gap.regulation_title || '').substring(0, 80);
  document.getElementById('linkTaskDesc').value = 'Address compliance gap: ' + (gap.gap_description || '');

  // Set default deadline to 14 days from now
  var deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);
  document.getElementById('linkTaskDeadline').value = deadline.toISOString().split('T')[0];

  document.getElementById('linkTaskDepartment').value = '';

  var modal = new bootstrap.Modal(document.getElementById('linkGapTaskModal'));
  modal.show();
}

async function submitLinkedTask() {
  var gapId = document.getElementById('linkGapId').value;
  var title = document.getElementById('linkTaskTitle').value;
  var description = document.getElementById('linkTaskDesc').value;
  var department = document.getElementById('linkTaskDepartment').value;
  var deadline = document.getElementById('linkTaskDeadline').value;

  if (!title || !department || !deadline) {
    showToast('Please fill in all required fields, including department', 'warning');
    return;
  }

  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps/' + gapId + '/link-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        description: description,
        department: department,
        deadline: deadline
      })
    });

    if (!response.ok) {
      var errData = await response.json();
      throw new Error(errData.error || 'Failed to create task');
    }

    // Close modal
    var modalEl = document.getElementById('linkGapTaskModal');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast('Remediation task created and linked to gap', 'success');
    loadGaps();
    loadTasks(); // Refresh tasks view too
  } catch (err) {
    showToast('Failed to create task: ' + err.message, 'danger');
  }
}

// Bulk AI Gap Analysis — analyzes all regulation-policy pairs
async function runBulkGapAnalysis() {
  var btn = document.getElementById('bulkAnalyzeBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Analyzing...';
  showToast('Running bulk AI gap analysis across all regulations and policies. This may take a minute...', 'info');

  try {
    var response = await fetch(API_BASE + '/api/compliance-gaps/analyze-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      var errData = await response.json();
      throw new Error(errData.error || 'Bulk analysis failed');
    }

    var result = await response.json();
    btn.disabled = false;
    btn.innerHTML = '🤖 Auto-Analyze All';

    if (result.total_gaps_found > 0) {
      showToast('Found ' + result.total_gaps_found + ' real compliance gaps across ' + result.details.length + ' regulation-policy pairs', 'success');
    } else {
      showToast('No new gaps found. All existing pairs have already been analyzed.', 'info');
    }

    loadGaps();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '🤖 Auto-Analyze All';
    showToast('Bulk analysis failed: ' + err.message, 'danger');
  }
}

// ==================== SOURCES VIEW (Task 5.2) ====================

async function loadSources() {
  try {
    showLoading('sourcesBody');
    var response = await fetch(API_BASE + '/api/regulatory-sources');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var sources = await response.json();
    var tbody = document.getElementById('sourcesBody');
    tbody.innerHTML = '';

    if (sources.length === 0) {
      showEmpty('sourcesBody', 'No regulatory sources found.');
      return;
    }

    var pageData = paginateArray(sources, sourcesPage);

    pageData.forEach(function (source) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = source.source_name;
      tr.appendChild(tdName);

      var tdUrl = document.createElement('td');
      tdUrl.textContent = source.base_url;
      tr.appendChild(tdUrl);

      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(source.created_at);
      tr.appendChild(tdDate);

      var tdActions = document.createElement('td');
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-warning btn-sm me-1';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function() { editSource(source); });
      tdActions.appendChild(editBtn);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', function() { deleteSource(source.source_id); });
      tdActions.appendChild(deleteBtn);

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

    renderPagination('sourcesPagination', sourcesPage, sources.length, function(page) {
      sourcesPage = page;
      loadSources();
    });
  } catch (err) {
    showError('Unable to load sources data. Please try again later.');
  }
}

function editSource(source) {
  document.getElementById('editSourceSection').classList.remove('d-none');
  document.getElementById('editSourceName').value = source.source_name || '';
  document.getElementById('editSourceUrl').value = source.base_url || '';
  document.getElementById('editSourceId').value = source.source_id;
}

async function submitSourceEdit() {
  try {
    var id = document.getElementById('editSourceId').value;
    var source_name = document.getElementById('editSourceName').value;
    var base_url = document.getElementById('editSourceUrl').value;
    var body = {};
    if (source_name) body.source_name = source_name;
    if (base_url) body.base_url = base_url;

    var response = await fetch(API_BASE + '/api/regulatory-sources/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update source');
    document.getElementById('editSourceSection').classList.add('d-none');
    loadSources();
    showToast('Source updated successfully', 'success');
  } catch (err) {
    showToast('Failed to update source', 'danger');
  }
}

function cancelSourceEdit() {
  document.getElementById('editSourceSection').classList.add('d-none');
}

async function deleteSource(sourceId) {
  if (!confirm('Are you sure you want to delete this source? This will also delete all regulations linked to it.')) return;
  try {
    var response = await fetch(API_BASE + '/api/regulatory-sources/' + sourceId, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete source');
    loadSources();
    showToast('Source deleted successfully', 'success');
  } catch (err) {
    showToast('Failed to delete source', 'danger');
  }
}

async function submitSource(e) {
  e.preventDefault();
  try {
    var source_name = document.getElementById('sourceNameInput').value;
    var base_url = document.getElementById('sourceUrlInput').value;

    var response = await fetch(API_BASE + '/api/regulatory-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_name: source_name, base_url: base_url })
    });
    if (!response.ok) throw new Error('Failed to create source');
    document.getElementById('sourceForm').reset();
    loadSources();
    showToast('Regulatory source added successfully', 'success');
  } catch (err) {
    showError('Failed to create source. Please try again.');
    showToast('Failed to create source', 'danger');
  }
}

// ==================== REGULATIONS VIEW (Task 5.3) ====================

var editRegId = null;

async function loadRegulations() {
  try {
    showLoading('regulationsBody');
    var url = API_BASE + '/api/regulations?page=' + regCurrentPage + '&limit=20';
    if (regSearchQuery) url += '&search=' + encodeURIComponent(regSearchQuery);
    var response = await fetch(url);
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var result = await response.json();
    var regulations = result.data || result;
    var tbody = document.getElementById('regulationsBody');
    tbody.innerHTML = '';

    // Apply client-side filters
    var catFilter = document.getElementById('regCategoryFilter') ? document.getElementById('regCategoryFilter').value : '';
    var srcFilter = document.getElementById('regSourceFilter') ? document.getElementById('regSourceFilter').value : '';
    var statusFilter = document.getElementById('regStatusFilter') ? document.getElementById('regStatusFilter').value : '';

    if (catFilter) regulations = regulations.filter(function(r) { return (r.category || '').toLowerCase().includes(catFilter.toLowerCase()); });
    if (srcFilter) regulations = regulations.filter(function(r) { return (r.source_name || '').toLowerCase().includes(srcFilter.toLowerCase()); });

    // For status filter, we need to know which regs have been assessed
    // Use a quick check: regs with changes = assessed
    if (statusFilter) {
      var [assessedResp] = await Promise.all([fetch(API_BASE + '/api/regulation-changes')]);
      if (assessedResp.ok) {
        var changes = await assessedResp.json();
        var assessedRegIds = changes.map(function(c) { return c.reg_id; });
        if (statusFilter === 'assessed') {
          regulations = regulations.filter(function(r) { return assessedRegIds.indexOf(r.reg_id) !== -1; });
        } else if (statusFilter === 'pending') {
          regulations = regulations.filter(function(r) { return assessedRegIds.indexOf(r.reg_id) === -1; });
        }
      }
    }

    // Store for detail view
    window._allRegsData = regulations;

    // Update count badge
    var badge = document.getElementById('regTotalBadge');
    if (badge) badge.textContent = regulations.length + ' regulations';

    if (regulations.length === 0) {
      showEmpty('regulationsBody', 'No regulations found.');
      document.getElementById('regPagination').innerHTML = '';
      return;
    }

    // Pagination
    if (result.totalPages) regTotalPages = result.totalPages;
    var totalItems = result.total || regulations.length;
    renderPagination('regPagination', regCurrentPage, totalItems, function(page) {
      regCurrentPage = page;
      loadRegulations();
    });

    regulations.forEach(function(reg) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';

      // Title — clickable to official source
      var tdTitle = document.createElement('td');
      var titleLink = document.createElement('a');
      titleLink.href = reg.source_url || '#';
      titleLink.target = '_blank';
      titleLink.textContent = reg.title;
      titleLink.className = 'fw-semibold text-primary text-decoration-none';
      titleLink.title = 'Open official source';
      titleLink.addEventListener('mouseenter', function() { this.style.textDecoration = 'underline'; });
      titleLink.addEventListener('mouseleave', function() { this.style.textDecoration = 'none'; });
      tdTitle.appendChild(titleLink);
      // View Details link below
      var detailLink = document.createElement('a');
      detailLink.href = '#';
      detailLink.className = 'd-block text-muted small mt-1';
      detailLink.textContent = '📄 View Details';
      (function(regData) {
        detailLink.addEventListener('click', function(e) { e.preventDefault(); openRegDetail(regData); });
      })(reg);
      tdTitle.appendChild(detailLink);
      tr.appendChild(tdTitle);

      // Source
      var tdSource = document.createElement('td');
      tdSource.innerHTML = '<span class="badge bg-secondary">' + escapeHtml(reg.source_name || '') + '</span>';
      tr.appendChild(tdSource);

      // Category
      var tdCat = document.createElement('td');
      tdCat.innerHTML = '<span class="badge bg-info text-dark">' + escapeHtml(reg.category || '') + '</span>';
      tr.appendChild(tdCat);

      // Version
      var tdVer = document.createElement('td');
      tdVer.textContent = 'v' + (reg.version || '1.0');
      tr.appendChild(tdVer);

      // Published
      var tdDate = document.createElement('td');
      tdDate.textContent = formatDate(reg.published_date);
      tr.appendChild(tdDate);

      // Status
      var tdStatus = document.createElement('td');
      tdStatus.innerHTML = '<span class="badge bg-success" style="font-size:0.65rem;">✅ Ingested</span>';
      tr.appendChild(tdStatus);

      // Actions
      var tdActions = document.createElement('td');
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline-warning btn-sm py-0 px-1';
      editBtn.style.fontSize = '0.7rem';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', function(e) { e.stopPropagation(); editRegulation(reg); });
      tdActions.appendChild(editBtn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  } catch (err) {
    showError('Unable to load regulations data. Please try again later.');
  }
}

function searchRegulations() {
  regSearchQuery = document.getElementById('regSearchInput') ? document.getElementById('regSearchInput').value : '';
  regCurrentPage = 1;
  loadRegulations();
}

function clearRegSearch() {
  document.getElementById('regSearchInput').value = '';
  if (document.getElementById('regCategoryFilter')) document.getElementById('regCategoryFilter').value = '';
  if (document.getElementById('regSourceFilter')) document.getElementById('regSourceFilter').value = '';
  if (document.getElementById('regStatusFilter')) document.getElementById('regStatusFilter').value = '';
  regSearchQuery = '';
  regCurrentPage = 1;
  loadRegulations();
}

async function openRegDetail(reg) {
  document.getElementById('regListCard').classList.add('d-none');
  document.getElementById('regDetailPanel').classList.remove('d-none');

  document.getElementById('regDetailTitle').textContent = reg.title;
  document.getElementById('regDetailSourceLink').href = reg.source_url || '#';
  document.getElementById('regDetailSource').textContent = reg.source_name || 'Unknown';
  document.getElementById('regDetailCategory').textContent = reg.category || 'N/A';
  document.getElementById('regDetailVersion').textContent = 'v' + (reg.version || '1.0');
  document.getElementById('regDetailDate').textContent = formatDate(reg.published_date);
  document.getElementById('regDetailContent').textContent = reg.content || 'No content available.';

  // Load related items
  var relatedDiv = document.getElementById('regDetailRelated');
  relatedDiv.innerHTML = '<div class="text-center py-2"><small class="text-muted">Loading related items...</small></div>';

  try {
    var [changesResp, gapsResp] = await Promise.all([
      fetch(API_BASE + '/api/regulation-changes/' + reg.reg_id),
      fetch(API_BASE + '/api/compliance-gaps')
    ]);

    var html = '';

    // Related changes
    if (changesResp.ok) {
      var changes = await changesResp.json();
      if (changes.length > 0) {
        html += '<div class="mb-3"><small class="text-uppercase text-secondary fw-bold d-block mb-1">📋 Impact Changes Detected (' + changes.length + ')</small>';
        changes.forEach(function(c) {
          html += '<div class="p-2 bg-light rounded mb-1 small"><span class="badge ' + getImpactClass(c.impact_score) + ' me-1">' + c.impact_score + '</span>' + escapeHtml((c.semantic_differences || '').substring(0, 100)) + '</div>';
        });
        html += '</div>';
      }
    }

    // Related gaps
    if (gapsResp.ok) {
      var allGaps = await gapsResp.json();
      var regGaps = allGaps.filter(function(g) { return g.reg_id === reg.reg_id; });
      if (regGaps.length > 0) {
        html += '<div class="mb-3"><small class="text-uppercase text-secondary fw-bold d-block mb-1">⚠️ Compliance Gaps (' + regGaps.length + ')</small>';
        regGaps.slice(0, 5).forEach(function(g) {
          var cleanDesc = (g.gap_description || '').replace(/\[.*?\]/g, '').replace(/\|.*$/g, '').trim().substring(0, 100);
          html += '<div class="p-2 bg-light rounded mb-1 small"><span class="badge ' + getGapStatusClass(g.status) + ' me-1">' + g.status + '</span>' + escapeHtml(cleanDesc) + '</div>';
        });
        html += '</div>';
      }
    }

    if (!html) html = '<p class="text-muted small">No related changes or gaps found for this regulation.</p>';
    relatedDiv.innerHTML = html;
  } catch (e) {
    relatedDiv.innerHTML = '<p class="text-muted small">Failed to load related items.</p>';
  }
}

function closeRegDetail() {
  document.getElementById('regDetailPanel').classList.add('d-none');
  document.getElementById('regListCard').classList.remove('d-none');
}

async function loadSourcesDropdown() {
  try {
    var response = await fetch(API_BASE + '/api/regulatory-sources');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var sources = await response.json();

    var regSourceSelect = document.getElementById('regSourceSelect');
    regSourceSelect.innerHTML = '<option value="">Select source...</option>';
    sources.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.source_id;
      opt.textContent = s.source_name;
      regSourceSelect.appendChild(opt);
    });

    var editRegSourceSelect = document.getElementById('editRegSourceSelect');
    editRegSourceSelect.innerHTML = '<option value="">Select source...</option>';
    sources.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.source_id;
      opt.textContent = s.source_name;
      editRegSourceSelect.appendChild(opt);
    });
  } catch (err) {
    showError('Unable to load sources for dropdown. Please try again later.');
  }
}

async function submitRegulation(e) {
  e.preventDefault();
  try {
    var source_id = document.getElementById('regSourceSelect').value;
    var title = document.getElementById('regTitleInput').value;
    var category = document.getElementById('regCategoryInput').value;
    var content = document.getElementById('regContentInput').value;
    var version = document.getElementById('regVersionInput').value;
    var published_date = document.getElementById('regDateInput').value;

    var body = { source_id: source_id, title: title, category: category, content: content };
    if (version) body.version = version;
    if (published_date) body.published_date = published_date;

    var response = await fetch(API_BASE + '/api/regulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to create regulation');
    document.getElementById('regulationForm').reset();
    loadRegulations();
  } catch (err) {
    showError('Failed to create regulation. Please try again.');
  }
}

function editRegulation(reg) {
  document.getElementById('editRegSection').classList.remove('d-none');
  document.getElementById('editRegTitle').value = reg.title || '';
  document.getElementById('editRegCategory').value = reg.category || '';
  document.getElementById('editRegContent').value = reg.content || '';
  document.getElementById('editRegVersion').value = reg.version || '';
  document.getElementById('editRegDate').value = reg.published_date ? reg.published_date.substring(0, 10) : '';
  document.getElementById('editRegId').value = reg.reg_id;
  editRegId = reg.reg_id;
}

async function submitRegulationEdit() {
  try {
    var id = editRegId || document.getElementById('editRegId').value;
    var title = document.getElementById('editRegTitle').value;
    var category = document.getElementById('editRegCategory').value;
    var content = document.getElementById('editRegContent').value;
    var version = document.getElementById('editRegVersion').value;
    var published_date = document.getElementById('editRegDate').value;

    var body = {};
    if (title) body.title = title;
    if (category) body.category = category;
    if (content) body.content = content;
    if (version) body.version = version;
    if (published_date) body.published_date = published_date;

    var response = await fetch(API_BASE + '/api/regulations/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update regulation');
    document.getElementById('editRegSection').classList.add('d-none');
    editRegId = null;
    loadRegulations();
  } catch (err) {
    showError('Failed to update regulation. Please try again.');
  }
}

function cancelRegulationEdit() {
  document.getElementById('editRegSection').classList.add('d-none');
  editRegId = null;
}

// ==================== REGULATIONS PAGINATION & SEARCH ====================

function changeRegPage(delta) {
  regCurrentPage += delta;
  if (regCurrentPage < 1) regCurrentPage = 1;
  if (regCurrentPage > regTotalPages) regCurrentPage = regTotalPages;
  loadRegulations();
}

// ==================== CHANGES VIEW (Task 5.4) ====================

function getImpactClass(impact) {
  if (impact === 'Critical') return 'bg-danger';
  if (impact === 'High') return 'bg-warning text-dark';
  if (impact === 'Medium') return 'bg-info';
  if (impact === 'Low') return 'bg-success';
  return 'bg-secondary';
}

// ==================== CHANGES & IMPACT VIEW ====================

var allCIData = [];
var ciImpactFilter = '';
var ciTaskFilter = '';
var ciAreaFilter = '';
var ciSearchQuery = '';
var ciPage = 1;

async function loadCI() {
  try {
    showLoading('ciBody');
    var response = await fetch(API_BASE + '/api/regulation-changes/impact');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    allCIData = await response.json();

    var counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    var autoTaskCount = 0;
    allCIData.forEach(function(c) {
      if (counts.hasOwnProperty(c.impact_score)) counts[c.impact_score]++;
      if (c.auto_task_id) autoTaskCount++;
    });
    document.getElementById('ciTotalCount').textContent = allCIData.length;
    document.getElementById('ciCritical').textContent = counts.Critical;
    document.getElementById('ciHigh').textContent = counts.High;
    document.getElementById('ciMedium').textContent = counts.Medium;
    document.getElementById('ciAutoTasks').textContent = autoTaskCount;

    ciImpactFilter = ''; ciTaskFilter = ''; ciAreaFilter = ''; ciSearchQuery = ''; ciPage = 1;
    var f1 = document.getElementById('ciImpactFilter');
    var f2 = document.getElementById('ciTaskFilter');
    var f3 = document.getElementById('ciSearchInput');
    var f4 = document.getElementById('ciAreaFilter');
    if (f1) f1.value = '';
    if (f2) f2.value = '';
    if (f3) f3.value = '';

    // If navigating from Tasks with specific alert IDs, filter to those changes
    if (window._filterChangeAlertIds) {
      var targetAlertIds = window._filterChangeAlertIds;
      window._filterChangeAlertIds = null;
      // Filter allCIData to only rows matching those alert_ids
      allCIData = allCIData.filter(function(c) {
        return c.alert_id && targetAlertIds.indexOf(c.alert_id) !== -1;
      });
    }

    // Populate affected areas dropdown from live data (unique areas across all rows)
    if (f4) {
      var areaSet = {};
      allCIData.forEach(function(c) {
        if (c.affected_areas) {
          c.affected_areas.split(',').forEach(function(a) {
            var t = a.trim();
            if (t) areaSet[t] = true;
          });
        }
      });
      var sortedAreas = Object.keys(areaSet).sort();
      f4.innerHTML = '<option value="">All Affected Areas</option>';
      sortedAreas.forEach(function(area) {
        var opt = document.createElement('option');
        opt.value = area;
        opt.textContent = area;
        f4.appendChild(opt);
      });
      f4.value = '';
    }

    renderCITable();
  } catch (err) {
    showError('Unable to load changes & impact data. Please try again later.');
  }
}

function filterCI() {
  ciImpactFilter = document.getElementById('ciImpactFilter') ? document.getElementById('ciImpactFilter').value : '';
  ciTaskFilter   = document.getElementById('ciTaskFilter')   ? document.getElementById('ciTaskFilter').value   : '';
  ciAreaFilter   = document.getElementById('ciAreaFilter')   ? document.getElementById('ciAreaFilter').value   : '';
  ciSearchQuery  = document.getElementById('ciSearchInput')  ? document.getElementById('ciSearchInput').value.toLowerCase().trim() : '';
  ciPage = 1;
  renderCITable();
}

function renderCITable() {
  var data = allCIData;
  if (ciImpactFilter) data = data.filter(function(c) { return c.impact_score === ciImpactFilter; });
  if (ciTaskFilter === 'has_task') data = data.filter(function(c) { return !!c.auto_task_id; });
  if (ciTaskFilter === 'no_task')  data = data.filter(function(c) { return !c.auto_task_id; });
  if (ciAreaFilter) data = data.filter(function(c) {
    return c.affected_areas && c.affected_areas.toLowerCase().indexOf(ciAreaFilter.toLowerCase()) !== -1;
  });
  if (ciSearchQuery) {
    data = data.filter(function(c) {
      return (c.regulation_title || '').toLowerCase().includes(ciSearchQuery) ||
             (c.semantic_differences || '').toLowerCase().includes(ciSearchQuery);
    });
  }

  var tbody = document.getElementById('ciBody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    showEmpty('ciBody', 'No changes found for the selected filters.');
    document.getElementById('ciPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(data, ciPage);

  pageData.forEach(function(change) {
    var tr = document.createElement('tr');
    var borderColor = change.impact_score === 'Critical' ? '#dc3545'
      : change.impact_score === 'High' ? '#fd7e14'
      : change.impact_score === 'Medium' ? '#ffc107' : '#198754';
    tr.style.borderLeft = '4px solid ' + borderColor;

    // Regulation
    var tdTitle = document.createElement('td');
    var titleHtml = '<span class="fw-semibold">' + escapeHtml(change.regulation_title) + '</span>';
    if (change.category) titleHtml += '<br><small class="text-muted">' + escapeHtml(change.category) + '</small>';
    if (change.source_url) titleHtml += '<br><a href="' + escapeHtml(change.source_url) + '" target="_blank" class="text-muted small text-decoration-none">🔗 Source</a>';
    titleHtml += '<br><a href="#" class="text-primary small ci-diff-link" data-changeid="' + change.change_id + '">' + (change.has_diff ? '🔍 View Diff' : '📄 View Details') + '</a>';
    tdTitle.innerHTML = titleHtml;
    tdTitle.querySelector('.ci-diff-link').addEventListener('click', function(e) {
      e.preventDefault(); openCIDetail(change.change_id);
    });
    tr.appendChild(tdTitle);

    // Summary
    var tdSummary = document.createElement('td');
    var summary = (change.semantic_differences || 'No details available').replace(/^\[[^\]]+\]\s*/, '');
    if (summary.length > 140) {
      tdSummary.innerHTML = '<span class="ci-short">' + escapeHtml(summary.substring(0, 140)) + '… <a href="#" class="text-primary small" onclick="this.closest(\'td\').querySelector(\'.ci-short\').classList.add(\'d-none\');this.closest(\'td\').querySelector(\'.ci-full\').classList.remove(\'d-none\');return false;">more</a></span>'
        + '<span class="ci-full d-none">' + escapeHtml(summary) + ' <a href="#" class="text-secondary small" onclick="this.closest(\'td\').querySelector(\'.ci-full\').classList.add(\'d-none\');this.closest(\'td\').querySelector(\'.ci-short\').classList.remove(\'d-none\');return false;">less</a></span>';
    } else { tdSummary.textContent = summary; }
    tr.appendChild(tdSummary);

    // Affected Areas
    var tdAreas = document.createElement('td');
    var areasVal = change.affected_areas || '';
    if (areasVal) {
      areasVal.split(',').forEach(function(area) {
        var b = document.createElement('span');
        b.className = 'badge bg-secondary me-1 mb-1';
        b.style.fontSize = '0.7rem';
        b.textContent = area.trim();
        tdAreas.appendChild(b);
      });
    } else {
      tdAreas.innerHTML = '<span class="text-muted small" title="Assessor agent did not return affected areas for this change">—</span>';
    }
    tr.appendChild(tdAreas);

    // Impact
    var tdImpact = document.createElement('td');
    var impBadge = document.createElement('span');
    impBadge.className = 'badge ' + getImpactClass(change.impact_score);
    impBadge.textContent = change.impact_score;
    tdImpact.appendChild(impBadge);
    if (change.explicit_deadline) {
      tdImpact.innerHTML += '<br><span class="badge bg-dark mt-1" style="font-size:0.65rem;">⏰ ' + formatDate(change.explicit_deadline) + '</span>';
    }
    // Penalty prioritization indicator for Critical + deadline
    if (change.impact_score === 'Critical' && change.explicit_deadline) {
      tdImpact.innerHTML += '<br><span class="badge bg-danger mt-1" style="font-size:0.6rem; animation: pulse 1.5s infinite;">⚠️ PENALTY</span>';
    }
    tr.appendChild(tdImpact);

    // Detected
    var tdDate = document.createElement('td');
    tdDate.innerHTML = '<span class="small fw-semibold">' + timeAgo(change.detected_at) + '</span><br><small class="text-muted">' + formatDate(change.detected_at) + '</small>';
    tr.appendChild(tdDate);

    // Task
    var tdTask = document.createElement('td');
    if (change.auto_task_id) {
      var sc = change.auto_task_status === 'Completed' ? 'bg-success' : change.auto_task_status === 'In Progress' ? 'bg-warning text-dark' : 'bg-secondary';
      tdTask.innerHTML = '<span class="badge ' + sc + '" style="font-size:0.7rem;">⚡ ' + escapeHtml(change.auto_task_status || 'Pending') + '</span>'
        + '<br><button class="btn btn-outline-secondary btn-sm mt-1 py-0 px-1" style="font-size:0.7rem;" onclick="showView(\'tasks\')">View</button>';
    } else if (change.impact_score === 'Critical' || change.impact_score === 'High') {
      // Critical/High without auto-task — show "No Task" badge only (agent should have created it)
      tdTask.innerHTML = '<span class="badge bg-danger" style="font-size:0.7rem;">No Task</span>';
    } else {
      // Medium/Low — offer manual task creation
      tdTask.innerHTML = '<button class="btn btn-outline-primary btn-sm py-0 px-1" style="font-size:0.7rem;" onclick="prefillTaskFromImpact(' + change.change_id + ',\'' + escapeHtml((change.regulation_title || '').replace(/'/g, '')) + '\',\'' + escapeHtml((change.department || 'Compliance Operations').replace(/'/g, '')) + '\')">+ Create</button>';
    }
    tr.appendChild(tdTask);

    tbody.appendChild(tr);
  });

  renderPagination('ciPagination', ciPage, data.length, function(page) { ciPage = page; renderCITable(); });
}

// ==================== DETAIL PANEL ====================

async function openCIDetail(changeId) {
  try {
    var response = await fetch(API_BASE + '/api/regulation-changes/detail/' + changeId);
    if (!response.ok) throw new Error('Failed to load change detail');
    var detail = await response.json();

    document.getElementById('detailRegTitle').textContent = detail.regulation_title;

    var impBadge = document.getElementById('detailImpactBadge');
    impBadge.className = 'badge fs-6 px-3 py-2 ' + getImpactClass(detail.impact_score);
    impBadge.textContent = detail.impact_score + ' Impact';

    var ctMatch = detail.semantic_differences ? detail.semantic_differences.match(/^\[([^\]]+)\]/) : null;
    var ctBadge = document.getElementById('detailChangeTypeBadge');
    ctBadge.textContent = ctMatch ? ctMatch[1] : 'Change';
    ctBadge.className = 'badge me-1 ' + (ctMatch && ctMatch[1] === 'New Requirement' ? 'bg-danger'
      : ctMatch && ctMatch[1] === 'Amended Threshold' ? 'bg-warning text-dark'
      : ctMatch && ctMatch[1] === 'Clarification' ? 'bg-info'
      : ctMatch && ctMatch[1] === 'Revocation' ? 'bg-dark' : 'bg-secondary');
    var catBadge = document.getElementById('detailCategoryBadge');
    catBadge.textContent = detail.category || '';
    catBadge.className = 'badge bg-secondary' + (detail.category ? '' : ' d-none');

    var areaContainer = document.getElementById('detailAffectedAreasBadges');
    areaContainer.innerHTML = '';
    // Try detail.affected_areas first, fall back to the cached allCIData record
    var ciRec = allCIData.find(function(c) { return c.change_id === changeId; });
    var areasStr = detail.affected_areas || (ciRec && ciRec.affected_areas) || '';
    if (areasStr) {
      areasStr.split(',').forEach(function(area) {
        var b = document.createElement('span');
        b.className = 'badge bg-secondary me-1 mb-1';
        b.style.fontSize = '0.7rem';
        b.textContent = area.trim();
        areaContainer.appendChild(b);
      });
    } else {
      areaContainer.innerHTML = '<span class="text-muted small">Not specified</span>';
    }

    document.getElementById('detailDeadline').textContent = detail.explicit_deadline ? '⏰ ' + formatDate(detail.explicit_deadline) : 'None stated';
    document.getElementById('detailDetectedDate').textContent = formatDate(detail.detected_at) + ' (' + timeAgo(detail.detected_at) + ')';

    var cleanSummary = (detail.semantic_differences || 'No summary available.').replace(/^\[[^\]]+\]\s*/, '');
    document.getElementById('detailSummary').textContent = cleanSummary;

    var diffSection = document.getElementById('detailDiffSection');
    diffSection.innerHTML = '';
    if (detail.change_diff && typeof detail.change_diff === 'object') {
      var diff = detail.change_diff;
      if (diff.added && diff.added.length > 0) diffSection.innerHTML += '<div class="mb-2 p-2 bg-success bg-opacity-10 rounded"><strong class="text-success">➕ Added:</strong><ul class="mb-0 mt-1">' + diff.added.map(function(a) { return '<li class="small">' + escapeHtml(a) + '</li>'; }).join('') + '</ul></div>';
      if (diff.removed && diff.removed.length > 0) diffSection.innerHTML += '<div class="mb-2 p-2 bg-danger bg-opacity-10 rounded"><strong class="text-danger">➖ Removed:</strong><ul class="mb-0 mt-1">' + diff.removed.map(function(r) { return '<li class="small">' + escapeHtml(r) + '</li>'; }).join('') + '</ul></div>';
      if (diff.modified && diff.modified.length > 0) diffSection.innerHTML += '<div class="mb-2 p-2 bg-warning bg-opacity-10 rounded"><strong class="text-warning">✏️ Modified:</strong><ul class="mb-0 mt-1">' + diff.modified.map(function(m) { return '<li class="small">' + escapeHtml(m) + '</li>'; }).join('') + '</ul></div>';
    }

    document.getElementById('detailOldLink').href = detail.source_url || '#';
    document.getElementById('detailNewLink').href = detail.source_url || '#';

    var oldPanel = document.getElementById('detailOldPanel');
    var newPanel = document.getElementById('detailNewPanel');

    // Always reset panel classes first
    oldPanel.className = 'col-md-6';
    newPanel.className = 'col-md-6';
    oldPanel.classList.remove('d-none');

    if (detail.old_content && detail.new_content) {
      document.getElementById('detailOldContent').textContent = detail.old_content;
      document.getElementById('detailNewContent').textContent = detail.new_content;
    } else {
      // No previous version — hide old panel, show new full width
      oldPanel.classList.add('d-none');
      newPanel.className = 'col-md-12';
      document.getElementById('detailNewContent').textContent = detail.new_content || 'Regulation content available in Regulations tab.';
    }

    var taskSection = document.getElementById('detailTaskSection');
    var ciRecord = allCIData.find(function(c) { return c.change_id === changeId; });
    taskSection.innerHTML = '';
    if (ciRecord && ciRecord.auto_task_id) {
      var sc = ciRecord.auto_task_status === 'Completed' ? 'success' : ciRecord.auto_task_status === 'In Progress' ? 'warning' : 'secondary';
      taskSection.innerHTML = '<div class="alert alert-secondary py-2 mb-0"><strong>⚡ Auto-Task:</strong> '
        + escapeHtml(ciRecord.auto_task_title || '') + ' — <span class="badge bg-' + sc + '">' + escapeHtml(ciRecord.auto_task_status || 'Pending') + '</span>'
        + ' &nbsp;<button class="btn btn-sm btn-outline-secondary py-0" onclick="showView(\'tasks\')">View in Tasks</button></div>';
    } else if (detail.impact_score === 'Critical' || detail.impact_score === 'High') {
      taskSection.innerHTML = '<div class="alert alert-warning py-2 mb-0">⚠ No remediation task created yet for this '
        + detail.impact_score + '-impact change. <button class="btn btn-sm btn-primary ms-2" onclick="prefillTaskFromImpact('
        + changeId + ',\'' + escapeHtml((detail.regulation_title || '').replace(/'/g, '')) + '\',\'Compliance Operations\')">+ Create Task</button></div>';
    }

    document.getElementById('ciListCard').classList.add('d-none');
    document.getElementById('ciDetailCard').classList.remove('d-none');
  } catch (err) {
    showToast('Failed to load change details', 'danger');
  }
}

function closeCIDetail() {
  document.getElementById('ciDetailCard').classList.add('d-none');
  document.getElementById('ciListCard').classList.remove('d-none');
}

function prefillTaskFromImpact(changeId, regulationTitle, department) {
  showView('tasks');
  setTimeout(function() {
    var titleEl = document.getElementById('taskTitleInput');
    var descEl  = document.getElementById('taskDescInput');
    var deptEl  = document.getElementById('taskDeptSelect');
    if (titleEl) titleEl.value = 'Remediate: ' + regulationTitle;
    if (descEl)  descEl.value  = 'Remediation task for regulatory change ID ' + changeId + '. Review the change and update affected policies/procedures accordingly.';
    if (deptEl) {
      for (var i = 0; i < deptEl.options.length; i++) {
        if (deptEl.options[i].value === department) { deptEl.selectedIndex = i; break; }
      }
    }
  }, 300);
}

// Legacy aliases
function loadChanges() { loadCI(); }
function loadImpact()  { loadCI(); }

// ==================== MANUAL SCRAPER TRIGGER ====================

async function triggerScraper() {
  var btn = document.getElementById('scrapeBtn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '⏳ Scraping…';

  try {
    var response = await fetch(API_BASE + '/api/admin/scrape', { method: 'POST' });
    var result = await response.json();

    if (response.status === 409) {
      showToast('Scraper is already running. Please wait.', 'warning');
      btn.disabled = false;
      btn.innerHTML = '🔄 Run Scraper';
      return;
    }

    showToast('Scraper triggered — check server logs for progress. Refreshing in 60s…', 'success');

    // Poll every 10s for up to 90s then auto-reload the table
    var waited = 0;
    var poll = setInterval(async function() {
      waited += 10;
      btn.innerHTML = '⏳ Running (' + waited + 's)…';
      if (waited >= 90) {
        clearInterval(poll);
        btn.disabled = false;
        btn.innerHTML = '🔄 Run Scraper';
        await loadCI();
        showToast('Scraper complete. Table refreshed.', 'success');
      }
    }, 10000);

  } catch (err) {
    showToast('Failed to trigger scraper: ' + err.message, 'danger');
    btn.disabled = false;
    btn.innerHTML = '🔄 Run Scraper';
  }
}

// ==================== POLICIES VIEW (Task 5.6) ====================

var allPoliciesData = [];

async function loadPolicies() {
  try {
    var container = document.getElementById('policiesContainer');
    container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

    var response = await fetch(API_BASE + '/api/internal-policies');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    allPoliciesData = await response.json();

    // Reset filters
    var hf = document.getElementById('policyHistoryFilter');
    var sf = document.getElementById('policySearchInput');
    if (hf) hf.value = '';
    if (sf) sf.value = '';

    renderPoliciesCards(allPoliciesData);
  } catch (err) {
    showError('Unable to load policies data. Please try again later.');
  }
}

function filterPoliciesByHistory(value) {
  var search = (document.getElementById('policySearchInput') ? document.getElementById('policySearchInput').value : '').toLowerCase().trim();
  var filtered = allPoliciesData;

  if (value === 'has_history') {
    filtered = filtered.filter(function(p) { return p.version_count > 0; });
  } else if (value === 'no_history') {
    filtered = filtered.filter(function(p) { return !p.version_count || p.version_count === 0; });
  } else if (value === 'ai_generated') {
    filtered = filtered.filter(function(p) { return p.ai_generated > 0; });
  }

  if (search) {
    filtered = filtered.filter(function(p) { return p.policy_name.toLowerCase().includes(search); });
  }

  policiesPage = 1;
  renderPoliciesCards(filtered);
}

function renderPoliciesCards(policies) {
  var container = document.getElementById('policiesContainer');
  container.innerHTML = '';

  if (policies.length === 0) {
    container.innerHTML = '<div class="col-12"><div class="alert alert-info">No policies found matching your filter.</div></div>';
    document.getElementById('policiesPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(policies, policiesPage);

    pageData.forEach(function(policy) {
      // Split description into brief (before PROCEDURES/TRAINING/CERTIFICATION) and procedures
      var desc = policy.description || '';
      var briefDesc = desc;
      var procedures = '';
      
      // Match various procedure section headers
      var procMatch = desc.match(/\n?\n?(PROCEDURES|TRAINING MODULES|CERTIFICATION REQUIREMENTS):\s*/);
      if (procMatch) {
        briefDesc = desc.substring(0, procMatch.index).trim();
        procedures = desc.substring(procMatch.index + procMatch[0].length).trim();
      } else {
        // AI-generated format: "...PROCEDURES: Step 1 — ..." or "... Step 1 —"
        var stepMatch = desc.match(/\s*PROCEDURES:\s*/i);
        if (stepMatch) {
          briefDesc = desc.substring(0, stepMatch.index).trim();
          procedures = desc.substring(stepMatch.index + stepMatch[0].length).trim();
        } else {
          // Try to detect "Step 1 —" pattern directly
          var directStepMatch = desc.match(/\.\s*(Step 1\s*[—–-])/);
          if (directStepMatch) {
            briefDesc = desc.substring(0, directStepMatch.index + 1).trim();
            procedures = desc.substring(directStepMatch.index + 1).trim();
          }
        }
      }

      var col = document.createElement('div');
      col.className = 'col-md-6';

      var card = document.createElement('div');
      card.className = 'card shadow-sm h-100';

      // Card header with policy name + AI badge + last updated
      var header = document.createElement('div');
      header.className = 'card-header bg-white d-flex justify-content-between align-items-center py-2';
      var headerLeft = '<h6 class="mb-0 fw-bold">' + escapeHtml(policy.policy_name) + '</h6>';
      if (policy.ai_generated > 0) {
        headerLeft = '<h6 class="mb-0 fw-bold">' + escapeHtml(policy.policy_name) + ' <span class="badge bg-info ms-1" style="font-size:0.6rem;">🤖 AI</span></h6>';
      }
      header.innerHTML = headerLeft + '<small class="text-muted">' + formatDate(policy.last_updated) + '</small>';
      card.appendChild(header);

      // Card body with brief description
      var body = document.createElement('div');
      body.className = 'card-body py-2';
      body.innerHTML = '<p class="small mb-2">' + escapeHtml(briefDesc) + '</p>';

      // Expandable procedures section
      if (procedures) {
        var detailId = 'policyDetail-' + policy.policy_id;
        var toggleBtn = document.createElement('a');
        toggleBtn.href = '#';
        toggleBtn.className = 'small text-primary';
        toggleBtn.textContent = '📋 View Procedures';
        toggleBtn.addEventListener('click', function(e) {
          e.preventDefault();
          var detail = document.getElementById(detailId);
          if (detail.classList.contains('d-none')) {
            detail.classList.remove('d-none');
            this.textContent = '▲ Hide Procedures';
          } else {
            detail.classList.add('d-none');
            this.textContent = '📋 View Procedures';
          }
        });
        body.appendChild(toggleBtn);

        // Procedures detail (hidden by default)
        var detailDiv = document.createElement('div');
        detailDiv.id = detailId;
        detailDiv.className = 'd-none mt-2 p-2 bg-light rounded';
        detailDiv.style.maxHeight = '300px';
        detailDiv.style.overflowY = 'auto';

        // Parse procedures into formatted list — handle multiple formats
        var procLines = procedures.replace(/^(PROCEDURES|TRAINING MODULES|CERTIFICATION REQUIREMENTS):\s*/i, '');
        // Split by numbered items: "1. ", "Step 1 —", "Step 1:", etc.
        var items = procLines.split(/(?:\.\s+|\n)(?=\d+\.\s|Step \d)/i).filter(function(l) { return l.trim() && l.trim().length > 10; });
        // If splitting didn't work well, try splitting by "Step N"
        if (items.length <= 1) {
          items = procLines.split(/(?:Step \d+\s*[—–:-]\s*)/i).filter(function(l) { return l.trim() && l.trim().length > 10; });
        }
        if (items.length > 0) {
          var ol = document.createElement('ol');
          ol.className = 'small mb-0 ps-3';
          items.forEach(function(item) {
            var li = document.createElement('li');
            li.className = 'mb-1';
            // Clean step prefix: "1. ", "Step 1 — ", etc.
            var cleaned = item.replace(/^\d+\.\s*/, '').replace(/^Step\s*\d+\s*[—–:-]\s*/i, '').trim();
            // Bold the title (text before first colon or period)
            var colonIdx = cleaned.indexOf(':');
            var dotIdx = cleaned.indexOf('.');
            var splitIdx = colonIdx > 0 && colonIdx < 80 ? colonIdx : (dotIdx > 0 && dotIdx < 80 ? dotIdx : -1);
            if (splitIdx > 0) {
              li.innerHTML = '<strong>' + escapeHtml(cleaned.substring(0, splitIdx)) + '</strong>' + escapeHtml(cleaned.substring(splitIdx));
            } else {
              li.textContent = cleaned;
            }
            ol.appendChild(li);
          });
          detailDiv.appendChild(ol);
        } else {
          detailDiv.innerHTML = '<p class="small mb-0">' + escapeHtml(procLines) + '</p>';
        }
        body.appendChild(detailDiv);
      }

      card.appendChild(body);

      // Card footer with action buttons
      var footer = document.createElement('div');
      footer.className = 'card-footer bg-white border-top-0 d-flex gap-2 py-2';
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline-warning btn-sm';
      editBtn.textContent = '✏️ Edit';
      editBtn.addEventListener('click', function() { editPolicy(policy); });
      footer.appendChild(editBtn);

      var historyBtn = document.createElement('button');
      historyBtn.className = 'btn btn-outline-info btn-sm';
      historyBtn.innerHTML = '📜 History' + (policy.version_count > 0 ? ' <span class="badge bg-info">' + policy.version_count + '</span>' : '');
      historyBtn.addEventListener('click', function() { viewPolicyHistory(policy.policy_id, policy.policy_name); });
      footer.appendChild(historyBtn);

      card.appendChild(footer);
      col.appendChild(card);
      container.appendChild(col);
    });

    renderPagination('policiesPagination', policiesPage, policies.length, function(page) {
      policiesPage = page;
      renderPoliciesCards(policies);
    });
}

async function submitPolicy(e) {
  e.preventDefault();
  try {
    var policy_name = document.getElementById('policyNameInput').value;
    var description = document.getElementById('policyDescInput').value;

    var response = await fetch(API_BASE + '/api/internal-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_name: policy_name, description: description })
    });
    if (!response.ok) throw new Error('Failed to create policy');
    document.getElementById('policyForm').reset();
    loadPolicies();
    showToast('Policy created successfully', 'success');
  } catch (err) {
    showError('Failed to create policy. Please try again.');
    showToast('Failed to create policy', 'danger');
  }
}

function editPolicy(policy) {
  document.getElementById('editPolicySection').classList.remove('d-none');
  document.getElementById('editPolicyName').value = policy.policy_name || '';
  document.getElementById('editPolicyDesc').value = policy.description || '';
  document.getElementById('editPolicyId').value = policy.policy_id;
}

async function submitPolicyEdit() {
  try {
    var id = document.getElementById('editPolicyId').value;
    var policy_name = document.getElementById('editPolicyName').value;
    var description = document.getElementById('editPolicyDesc').value;

    var body = {};
    if (policy_name) body.policy_name = policy_name;
    if (description) body.description = description;

    var response = await fetch(API_BASE + '/api/internal-policies/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to update policy');
    document.getElementById('editPolicySection').classList.add('d-none');
    loadPolicies();
    showToast('Policy updated successfully', 'success');
  } catch (err) {
    showError('Failed to update policy. Please try again.');
    showToast('Failed to update policy', 'danger');
  }
}

function cancelPolicyEdit() {
  document.getElementById('editPolicySection').classList.add('d-none');
}

// ==================== POLICY SUB-TABS ====================

function showPolicyTab(tabName) {
  document.getElementById('policyPage-current').classList.add('d-none');
  document.getElementById('policyPage-proposals').classList.add('d-none');
  document.getElementById('policyPage-' + tabName).classList.remove('d-none');

  document.getElementById('policyTab-current').classList.remove('active');
  document.getElementById('policyTab-proposals').classList.remove('active');
  document.getElementById('policyTab-' + tabName).classList.add('active');

  if (tabName === 'proposals') loadPolicyProposals();
}

// ==================== AI POLICY PROPOSALS ====================

async function loadPolicyProposals() {
  try {
    var response = await fetch(API_BASE + '/api/policy-proposals?status=Pending');
    if (!response.ok) throw new Error('Failed to load proposals');
    var proposals = await response.json();

    var container = document.getElementById('proposalsContainer');
    container.innerHTML = '';

    // Update badge count
    var badge = document.getElementById('proposalCountBadge');
    if (proposals.length > 0) {
      badge.textContent = proposals.length;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }

    if (proposals.length === 0) {
      container.innerHTML = '<div class="col-12 text-center text-muted py-4">No pending AI proposals. The Policy Advisor agent will propose new policies here when it detects recurring compliance gaps.</div>';
      return;
    }

    proposals.forEach(function(p) {
      var col = document.createElement('div');
      col.className = 'col-12';

      var typeColor = p.proposal_type === 'New Policy' ? 'success' : 'warning';
      var typeIcon = p.proposal_type === 'New Policy' ? '✨' : '✏️';

      // Parse proposed_description into brief + procedures
      var propDesc = p.proposed_description || '';
      var briefProp = propDesc;
      var procSection = '';
      var procMatch = propDesc.match(/\n?(PROCEDURES|TRAINING MODULES|CERTIFICATION REQUIREMENTS):/);
      if (procMatch) {
        briefProp = propDesc.substring(0, procMatch.index).trim();
        procSection = propDesc.substring(procMatch.index).trim();
      }

      // Format procedures as a numbered list
      var procHtml = '';
      if (procSection) {
        var procLines = procSection.replace(/^(PROCEDURES|TRAINING MODULES|CERTIFICATION REQUIREMENTS):\n?/, '');
        var items = procLines.split(/\n(?=\d+\.\s|Step \d)/).filter(function(l) { return l.trim(); });
        if (items.length > 0) {
          procHtml = '<div class="mt-2 p-2 bg-white border rounded"><small class="text-uppercase text-secondary fw-bold d-block mb-1">📋 Procedures</small><ol class="small mb-0 ps-3">';
          items.forEach(function(item) {
            var cleaned = item.replace(/^\d+\.\s*/, '').replace(/^Step \d+\s*[—–-]\s*/i, '').trim();
            var colonIdx = cleaned.indexOf(':');
            if (colonIdx > 0 && colonIdx < 60) {
              procHtml += '<li class="mb-1"><strong>' + escapeHtml(cleaned.substring(0, colonIdx)) + '</strong>: ' + escapeHtml(cleaned.substring(colonIdx + 1).trim()) + '</li>';
            } else {
              procHtml += '<li class="mb-1">' + escapeHtml(cleaned) + '</li>';
            }
          });
          procHtml += '</ol></div>';
        }
      }

      // Related gaps — max 3 shown
      var relatedGapsHtml = '';
      if (p.related_gaps && p.related_gaps.length > 0) {
        var gapsToShow = p.related_gaps.slice(0, 3);
        relatedGapsHtml = '<div class="mt-2"><small class="text-uppercase text-secondary fw-bold">Related Gaps (' + gapsToShow.length + ')</small><ul class="small mb-0 mt-1">';
        gapsToShow.forEach(function(g) {
          var cleanDesc = (g.gap_description || '').replace(/\s*\[Severity:.*?\]/g, '').replace(/\s*\[Type:.*?\]/g, '').replace(/\s*\| Recommendation:.*$/g, '').replace(/\s*\| Sources:.*$/g, '').substring(0, 120);
          relatedGapsHtml += '<li>' + escapeHtml(cleanDesc) + '</li>';
        });
        relatedGapsHtml += '</ul></div>';
      }

      col.innerHTML =
        '<div class="card shadow-sm border-' + typeColor + ' mb-3">' +
          '<div class="card-header bg-white d-flex justify-content-between align-items-center py-2">' +
            '<div><span class="badge bg-' + typeColor + '">' + typeIcon + ' ' + p.proposal_type + '</span> ' +
            '<strong class="ms-2">' + escapeHtml(p.policy_name) + '</strong></div>' +
            '<small class="text-muted">' + formatDate(p.created_at) + '</small>' +
          '</div>' +
          '<div class="card-body py-3">' +
            '<p class="small mb-2">' + escapeHtml(briefProp) + '</p>' +
            procHtml +
            '<div class="alert alert-light py-2 px-3 mb-2 mt-2">' +
              '<small class="fw-semibold text-secondary">💡 AI Reasoning:</small> <small>' + escapeHtml(p.reasoning || '') + '</small>' +
            '</div>' +
            relatedGapsHtml +
            '<div class="d-flex gap-2 mt-3">' +
              '<button class="btn btn-success btn-sm" onclick="reviewProposal(' + p.proposal_id + ', \'accept\')">✅ Accept & Apply</button>' +
              '<button class="btn btn-outline-danger btn-sm" onclick="reviewProposal(' + p.proposal_id + ', \'reject\')">❌ Reject</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.appendChild(col);
    });

  } catch (err) {
    showToast('Failed to load AI proposals', 'danger');
  }
}

async function reviewProposal(proposalId, action) {
  try {
    var response = await fetch(API_BASE + '/api/policy-proposals/' + proposalId + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('Failed to ' + action + ' proposal');

    showToast(action === 'accept' ? 'Proposal accepted and applied to policies' : 'Proposal rejected', 'success');
    loadPolicyProposals();
    if (action === 'accept') loadPolicies(); // refresh current policies list too
  } catch (err) {
    showToast('Failed to ' + action + ' proposal', 'danger');
  }
}

// View policy version history
async function viewPolicyHistory(policyId, policyName) {
  try {
    var response = await fetch(API_BASE + '/api/internal-policies/' + policyId + '/history');
    if (!response.ok) throw new Error('Failed to fetch history');
    var data = await response.json();

    var html = '<h5>Version History: ' + policyName + '</h5><hr>';

    // Current version
    if (data.current) {
      html += '<div class="card mb-2 border-primary"><div class="card-body py-2">';
      html += '<div class="d-flex justify-content-between"><strong>Current Version</strong><small class="text-muted">' + formatDate(data.current.last_updated) + '</small></div>';
      html += '<p class="mb-0 mt-1 small">' + data.current.description.substring(0, 300) + '</p>';
      html += '</div></div>';
    }

    // Historical versions
    if (data.history.length === 0) {
      html += '<p class="text-muted">No previous versions recorded yet.</p>';
    } else {
      data.history.forEach(function(v) {
        html += '<div class="card mb-2"><div class="card-body py-2">';
        html += '<div class="d-flex justify-content-between"><strong>v' + v.version_number + '</strong><small class="text-muted">' + formatDate(v.created_at) + '</small></div>';
        if (v.change_reason) html += '<small class="badge bg-secondary">' + v.change_reason + '</small>';
        html += '<p class="mb-0 mt-1 small text-muted">' + v.description.substring(0, 300) + '</p>';
        html += '</div></div>';
      });
    }

    html += '<button class="btn btn-secondary btn-sm mt-2" onclick="document.getElementById(\'policyHistoryModal\').classList.add(\'d-none\')">Close</button>';

    // Show in a simple overlay
    var modal = document.getElementById('policyHistoryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'policyHistoryModal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(modal);
    }
    modal.classList.remove('d-none');
    modal.innerHTML = '<div class="bg-white rounded shadow p-4" style="max-width:600px;max-height:80vh;overflow-y:auto;">' + html + '</div>';

  } catch (err) {
    showToast('Failed to load version history', 'danger');
  }
}

// ==================== AUDIT TRAIL VIEW (Task 5.9) ====================

// ==================== AUDIT LOG DESCRIPTION FORMATTER ====================

function formatAuditDescription(description) {
  if (!description) return { summary: '—', isLLM: false };

  // Try to parse as JSON (LLM audit logs store JSON in description)
  try {
    var data = JSON.parse(description);
    if (data && typeof data === 'object' && data.model) {
      // This is an LLM audit log entry
      var summary = '';
      summary += '<strong>Model:</strong> ' + (data.model || 'N/A');
      if (data.embedding_model) summary += ' &nbsp;|&nbsp; <strong>Embeddings:</strong> ' + data.embedding_model;
      if (data.vector_db) summary += ' &nbsp;|&nbsp; <strong>Vector DB:</strong> ' + data.vector_db;
      summary += '<br>';
      if (data.target) summary += '<strong>Target:</strong> ' + data.target + '<br>';
      if (data.result) summary += '<strong>Result:</strong> <span class="badge bg-' + getImpactBadgeColor(data.result) + '">' + data.result + '</span><br>';
      if (data.chunks_retrieved !== undefined) summary += '<strong>Chunks Retrieved:</strong> ' + data.chunks_retrieved + '<br>';
      if (data.duration_ms) summary += '<strong>Duration:</strong> ' + data.duration_ms + 'ms';

      // Build expandable details
      var details = '';
      if (data.input) {
        // Extract just the key parts from the prompt, not the full text
        var inputPreview = data.input.length > 150 ? data.input.substring(0, 150) + '...' : data.input;
        details += '<div class="mt-2"><strong>Prompt Preview:</strong><br><small class="text-muted" style="white-space:pre-wrap; word-break:break-word;">' + escapeHtml(inputPreview) + '</small></div>';
      }
      if (data.output) {
        var outputPreview = data.output.length > 200 ? data.output.substring(0, 200) + '...' : data.output;
        details += '<div class="mt-2"><strong>LLM Output:</strong><br><code style="white-space:pre-wrap; word-break:break-word; font-size:0.8rem;">' + escapeHtml(outputPreview) + '</code></div>';
      }
      if (data.timestamp) details += '<div class="mt-1"><small class="text-muted"><strong>LLM Call Time:</strong> ' + new Date(data.timestamp).toLocaleString() + '</small></div>';

      return { summary: summary, details: details, isLLM: true };
    }
  } catch (e) {
    // Not JSON — treat as plain text
  }

  // Plain text description (non-LLM logs)
  if (description.length > 100) {
    return { summary: description.substring(0, 100) + '...', details: description, isLLM: false };
  }
  return { summary: description, isLLM: false };
}

function getImpactBadgeColor(impact) {
  if (impact === 'Critical') return 'danger';
  if (impact === 'High') return 'warning text-dark';
  if (impact === 'Medium') return 'info';
  if (impact === 'Low') return 'success';
  return 'secondary';
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  var now = new Date();
  var then = new Date(dateStr);
  var diff = Math.floor((now - then) / 1000); // seconds
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  if (diff < 31536000) return Math.floor(diff / 2592000) + 'mo ago';
  return Math.floor(diff / 31536000) + 'y ago';
}

// ==================== AUDIT TRAIL VIEW (Task 5.9) ====================

async function loadAuditLogs(filters) {
  try {
    // Load stats
    loadAuditStats();

    showLoading('auditBody');
    var url = API_BASE + '/api/audit-logs';
    if (filters) {
      var params = [];
      if (filters.user_id) params.push('user_id=' + encodeURIComponent(filters.user_id));
      if (filters.action_type) params.push('action_type=' + encodeURIComponent(filters.action_type));
      if (filters.target_table) params.push('target_table=' + encodeURIComponent(filters.target_table));
      if (filters.start_date) params.push('start_date=' + encodeURIComponent(filters.start_date));
      if (filters.end_date) params.push('end_date=' + encodeURIComponent(filters.end_date));
      if (params.length > 0) url += '?' + params.join('&');
    }

    var response = await fetch(url);
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var logs = await response.json();

    // Apply actor filter (AI vs Human) client-side
    var actorFilter = window._auditActorFilter || '';
    if (actorFilter === 'ai') {
      logs = logs.filter(function(l) { return isAgentAction(l.action_type); });
    } else if (actorFilter === 'human') {
      logs = logs.filter(function(l) { return !isAgentAction(l.action_type); });
    }

    window._auditLogs = logs;

    var viewMode = document.getElementById('auditViewMode') ? document.getElementById('auditViewMode').value : 'table';
    if (viewMode === 'timeline') { renderAuditTimeline(logs); }
    else { renderAuditTable(logs); }

    // Populate regulation dropdown for response chain view
    loadChainRegulations();
  } catch (err) {
    showError('Unable to load audit logs. Please try again later.');
  }
}

async function loadAuditStats() {
  try {
    var resp = await fetch(API_BASE + '/api/audit-logs/stats');
    if (!resp.ok) return;
    var stats = await resp.json();
    document.getElementById('auditTotalCount').textContent = stats.total || 0;
    document.getElementById('auditWeekCount').textContent = stats.this_week || 0;
    document.getElementById('auditAICount').textContent = stats.ai_actions || 0;
    document.getElementById('auditHumanCount').textContent = stats.human_actions || 0;
    document.getElementById('agentScraper').textContent = stats.agents.scraper || 0;
    document.getElementById('agentAssessor').textContent = stats.agents.assessor || 0;
    document.getElementById('agentAnalyzer').textContent = stats.agents.analyzer || 0;
    document.getElementById('agentDispatcher').textContent = stats.agents.dispatcher || 0;
    document.getElementById('agentAdvisor').textContent = stats.agents.advisor || 0;
  } catch (e) { /* silent */ }
}

function toggleAuditView(mode) {
  document.getElementById('auditTableView').classList.add('d-none');
  document.getElementById('auditTimelineView').classList.add('d-none');
  document.getElementById('auditChainView').classList.add('d-none');
  if (mode === 'table') document.getElementById('auditTableView').classList.remove('d-none');
  else if (mode === 'timeline') document.getElementById('auditTimelineView').classList.remove('d-none');
  else if (mode === 'chain') document.getElementById('auditChainView').classList.remove('d-none');

  if (window._auditLogs) {
    if (mode === 'timeline') renderAuditTimeline(window._auditLogs);
    else if (mode === 'table') renderAuditTable(window._auditLogs);
  }
}

function renderAuditTable(logs) {
  var tbody = document.getElementById('auditBody');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    showEmpty('auditBody', 'No audit logs found.');
    document.getElementById('auditPagination').innerHTML = '';
    return;
  }

  var pageData = paginateArray(logs, auditPage);

  pageData.forEach(function(log, index) {
    var tr = document.createElement('tr');
    var isAI = isAgentAction(log.action_type);

    // User
    var tdUser = document.createElement('td');
    tdUser.innerHTML = isAI
      ? '<span class="badge bg-info">🤖 System</span>'
      : '<span class="badge bg-dark">👤 ' + escapeHtml(log.username) + '</span>';
    tr.appendChild(tdUser);

    // Action
    var tdAction = document.createElement('td');
    tdAction.innerHTML = '<span class="badge ' + getActionTypeBadge(log.action_type) + '">' + escapeHtml(log.action_type) + '</span>';
    tr.appendChild(tdAction);

    // Target
    var tdTarget = document.createElement('td');
    tdTarget.innerHTML = '<small>' + escapeHtml(log.target_table) + ' #' + (log.target_id || '') + '</small>';
    tr.appendChild(tdTarget);

    // Description (expandable)
    var tdDesc = document.createElement('td');
    tdDesc.style.maxWidth = '400px';
    var formatted = formatAuditDescription(log.description);
    if (formatted.isLLM) {
      var summaryDiv = document.createElement('div');
      summaryDiv.innerHTML = formatted.summary;
      tdDesc.appendChild(summaryDiv);
      if (formatted.details) {
        var detailsId = 'auditDetail-' + auditPage + '-' + index;
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-sm btn-outline-secondary mt-1 py-0 px-1';
        toggleBtn.style.fontSize = '0.7rem';
        toggleBtn.textContent = '▼ Details';
        toggleBtn.setAttribute('data-bs-toggle', 'collapse');
        toggleBtn.setAttribute('data-bs-target', '#' + detailsId);
        tdDesc.appendChild(toggleBtn);
        var detailsDiv = document.createElement('div');
        detailsDiv.className = 'collapse mt-2';
        detailsDiv.id = detailsId;
        detailsDiv.innerHTML = '<div class="card card-body p-2" style="font-size:0.75rem; max-height:200px; overflow-y:auto;">' + formatted.details + '</div>';
        tdDesc.appendChild(detailsDiv);
      }
    } else {
      tdDesc.innerHTML = '<small>' + escapeHtml(formatted.summary) + '</small>';
    }
    tr.appendChild(tdDesc);

    // Timestamp
    var tdTime = document.createElement('td');
    tdTime.innerHTML = '<small>' + timeAgo(log.timestamp) + '<br><span class="text-muted">' + formatDate(log.timestamp) + '</span></small>';
    tr.appendChild(tdTime);

    tbody.appendChild(tr);
  });

  renderPagination('auditPagination', auditPage, logs.length, function(page) {
    auditPage = page;
    renderAuditTable(logs);
  });
}

function renderAuditTimeline(logs) {
  var container = document.getElementById('auditTimeline');
  container.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = '<p class="text-muted">No events to show.</p>';
    return;
  }

  var pageData = paginateArray(logs, auditPage);

  pageData.forEach(function(log) {
    var isAI = isAgentAction(log.action_type);
    var icon = isAI ? '🤖' : '👤';
    var borderColor = log.action_type.includes('CRITICAL') || log.action_type.includes('IMMEDIATE') ? '#dc3545'
      : isAI ? '#0dcaf0' : '#6c757d';

    var item = document.createElement('div');
    item.className = 'mb-3 p-3 bg-white rounded shadow-sm';
    item.style.borderLeft = '4px solid ' + borderColor;
    item.innerHTML =
      '<div class="d-flex justify-content-between align-items-start">'
      + '<div><span class="me-2">' + icon + '</span><strong class="small">' + escapeHtml(log.action_type) + '</strong>'
      + ' <span class="badge ' + getActionTypeBadge(log.action_type) + ' ms-1" style="font-size:0.65rem;">' + escapeHtml(log.target_table) + '</span></div>'
      + '<small class="text-muted">' + timeAgo(log.timestamp) + '</small></div>'
      + '<p class="small mb-0 mt-1 text-muted">' + escapeHtml((log.description || '').substring(0, 150)) + '</p>';
    container.appendChild(item);
  });

  renderPagination('auditTimelinePagination', auditPage, logs.length, function(page) {
    auditPage = page;
    renderAuditTimeline(logs);
  });
}

function isAgentAction(actionType) {
  if (!actionType) return false;
  var agentTypes = ['IMPACT_ASSESSED', 'TASK_AUTO_CREATED', 'LLM_CLUSTER_GAP_ANALYSIS', 'BULK_CLUSTER_ANALYSIS', 'POLICY_PROPOSED', 'GAP_AUTO_STATUS', 'AI_POLICY_CREATED', 'AI_POLICY_UPDATED', 'POLICY_FLAGGED'];
  return agentTypes.indexOf(actionType) !== -1;
}

async function loadChainRegulations() {
  try {
    var select = document.getElementById('auditChainRegSelect');
    if (!select) return;
    var resp = await fetch(API_BASE + '/api/regulations?page=1&limit=50');
    if (!resp.ok) return;
    var data = await resp.json();
    var regs = data.data || data;
    select.innerHTML = '<option value="">Select regulation…</option>';
    regs.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.reg_id;
      opt.textContent = r.title;
      select.appendChild(opt);
    });
  } catch (e) { /* silent */ }
}

async function loadResponseChain(regId) {
  var container = document.getElementById('auditChainContent');
  if (!regId) { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div></div>';

  try {
    var resp = await fetch(API_BASE + '/api/audit-logs/response-chain/' + regId);
    if (!resp.ok) throw new Error('Failed');
    var chain = await resp.json();

    var html = '<div class="card shadow-sm"><div class="card-body">';
    html += '<h5 class="mb-3">' + escapeHtml(chain.regulation.title) + ' <span class="badge bg-secondary">' + escapeHtml(chain.regulation.category) + '</span></h5>';

    // Step 1: Regulation scraped
    html += '<div class="d-flex align-items-start mb-3"><span class="badge bg-primary me-3 mt-1">1</span><div><strong>Regulation Scraped</strong><br><small class="text-muted">Ingested into knowledge base</small></div></div>';

    // Step 2: Impact assessed
    if (chain.changes.length > 0) {
      html += '<div class="d-flex align-items-start mb-3"><span class="badge bg-info me-3 mt-1">2</span><div><strong>Impact Assessed</strong>';
      chain.changes.forEach(function(c) {
        html += '<br><span class="badge ' + getImpactClass(c.impact_score) + ' me-1">' + c.impact_score + '</span>';
        html += '<small class="text-muted">' + escapeHtml((c.semantic_differences || '').substring(0, 100)) + '</small>';
      });
      html += '</div></div>';
    }

    // Step 3: Alerts created
    if (chain.alerts.length > 0) {
      html += '<div class="d-flex align-items-start mb-3"><span class="badge bg-warning text-dark me-3 mt-1">3</span><div><strong>Alerts Created (' + chain.alerts.length + ')</strong>';
      chain.alerts.forEach(function(a) {
        html += '<br><span class="badge ' + getSeverityClass(a.severity_level) + '">' + a.severity_level + '</span> <small>Status: ' + a.status + '</small>';
      });
      html += '</div></div>';
    }

    // Step 4: Gaps identified
    if (chain.gaps.length > 0) {
      html += '<div class="d-flex align-items-start mb-3"><span class="badge bg-danger me-3 mt-1">4</span><div><strong>Compliance Gaps Identified (' + chain.gaps.length + ')</strong>';
      chain.gaps.forEach(function(g) {
        html += '<br><span class="badge ' + getGapStatusClass(g.status) + ' me-1">' + g.status + '</span>';
        html += '<small>' + escapeHtml((g.gap_description || '').replace(/\[.*?\]/g, '').substring(0, 80)) + '</small>';
      });
      html += '</div></div>';
    }

    // Step 5: Tasks created
    if (chain.tasks.length > 0) {
      html += '<div class="d-flex align-items-start mb-3"><span class="badge bg-success me-3 mt-1">5</span><div><strong>Remediation Tasks (' + chain.tasks.length + ')</strong>';
      chain.tasks.forEach(function(t) {
        var sc = t.status === 'Completed' ? 'bg-success' : t.status === 'In Progress' ? 'bg-warning text-dark' : 'bg-secondary';
        html += '<br><span class="badge ' + sc + ' me-1">' + t.status + '</span>';
        html += '<small>' + escapeHtml(t.title.substring(0, 80)) + ' → ' + t.department + '</small>';
      });
      html += '</div></div>';
    }

    // Final status
    var allTasksComplete = chain.tasks.length > 0 && chain.tasks.every(function(t) { return t.status === 'Completed'; });
    if (allTasksComplete) {
      html += '<div class="alert alert-success py-2 mt-3">✅ <strong>Fully Remediated</strong> — All tasks completed for this regulation.</div>';
    } else if (chain.tasks.length > 0) {
      html += '<div class="alert alert-warning py-2 mt-3">⏳ <strong>In Progress</strong> — Tasks pending completion.</div>';
    } else if (chain.gaps.length > 0) {
      html += '<div class="alert alert-danger py-2 mt-3">⚠ <strong>Gaps Open</strong> — No remediation tasks created yet.</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div class="alert alert-danger">Failed to load response chain.</div>';
  }
}

async function printAuditReport() {
  try {
    var printContent = document.getElementById('printContent');
    printContent.innerHTML = '<p style="color:#666;">Generating audit report...</p>';
    document.getElementById('printDate').textContent = 'Generated: ' + new Date().toLocaleString();

    // Fetch audit data
    var [logsResp, statsResp] = await Promise.all([
      fetch(API_BASE + '/api/audit-logs'),
      fetch(API_BASE + '/api/audit-logs/stats')
    ]);

    var logs = logsResp.ok ? await logsResp.json() : [];
    var stats = statsResp.ok ? await statsResp.json() : {};

    var html = '';

    // Section 1: Summary
    html += '<h3 style="margin-top:20px; border-bottom:1px solid #ccc; padding-bottom:8px;">1. Audit Summary</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Actions Logged</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (stats.total || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Actions This Week</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (stats.this_week || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>AI Agent Actions</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (stats.ai_actions || 0) + '</td></tr>';
    html += '<tr><td style="padding:8px; border:1px solid #ddd;"><strong>Human Actions</strong></td><td style="padding:8px; border:1px solid #ddd;">' + (stats.human_actions || 0) + '</td></tr>';
    html += '</table>';

    // Section 2: Agent Activity
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">2. Agent Activity</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0;">';
    html += '<tr style="background:#f5f5f5;"><th style="padding:8px; border:1px solid #ddd;">Agent</th><th style="padding:8px; border:1px solid #ddd;">Actions</th></tr>';
    if (stats.agents) {
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">Scraper (Regulations Ingested)</td><td style="padding:8px; border:1px solid #ddd;">' + (stats.agents.scraper || 0) + '</td></tr>';
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">Assessor (Impact Assessments)</td><td style="padding:8px; border:1px solid #ddd;">' + (stats.agents.assessor || 0) + '</td></tr>';
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">Analyzer (Gap Analyses)</td><td style="padding:8px; border:1px solid #ddd;">' + (stats.agents.analyzer || 0) + '</td></tr>';
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">Dispatcher (Tasks Auto-Created)</td><td style="padding:8px; border:1px solid #ddd;">' + (stats.agents.dispatcher || 0) + '</td></tr>';
      html += '<tr><td style="padding:8px; border:1px solid #ddd;">Advisor (Policy Proposals)</td><td style="padding:8px; border:1px solid #ddd;">' + (stats.agents.advisor || 0) + '</td></tr>';
    }
    html += '</table>';

    // Section 3: Recent Actions (last 50)
    html += '<h3 style="margin-top:30px; border-bottom:1px solid #ccc; padding-bottom:8px;">3. Recent Actions (Last 50)</h3>';
    html += '<table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:0.8rem;">';
    html += '<tr style="background:#f5f5f5;"><th style="padding:6px; border:1px solid #ddd;">User</th><th style="padding:6px; border:1px solid #ddd;">Action</th><th style="padding:6px; border:1px solid #ddd;">Target</th><th style="padding:6px; border:1px solid #ddd;">Description</th><th style="padding:6px; border:1px solid #ddd;">Timestamp</th></tr>';
    logs.slice(0, 50).forEach(function(log) {
      var isAI = isAgentAction(log.action_type);
      html += '<tr><td style="padding:5px; border:1px solid #ddd;">' + (isAI ? '🤖 System' : '👤 ' + (log.username || '')) + '</td>';
      html += '<td style="padding:5px; border:1px solid #ddd;">' + (log.action_type || '') + '</td>';
      html += '<td style="padding:5px; border:1px solid #ddd;">' + (log.target_table || '') + ' #' + (log.target_id || '') + '</td>';
      html += '<td style="padding:5px; border:1px solid #ddd;">' + ((log.description || '').substring(0, 80)) + '</td>';
      html += '<td style="padding:5px; border:1px solid #ddd;">' + formatDate(log.timestamp) + '</td></tr>';
    });
    html += '</table>';

    // Footer
    html += '<div style="margin-top:40px; padding-top:15px; border-top:1px solid #ccc; font-size:0.75rem; color:#999; text-align:center;">';
    html += 'GLDB Compliance Audit Report — Auto-generated. For internal use and regulatory inspection purposes. Confidential.';
    html += '</div>';

    printContent.innerHTML = html;
    setTimeout(function() { window.print(); }, 300);
  } catch (err) {
    showToast('Failed to generate audit report', 'danger');
  }
}

function getActionTypeBadge(actionType) {
  if (!actionType) return 'bg-secondary';
  var type = actionType.toUpperCase();
  if (type.indexOf('LLM') >= 0) return 'bg-purple';
  if (type.indexOf('CREATE') >= 0 || type.indexOf('INSERT') >= 0) return 'bg-success';
  if (type.indexOf('UPDATE') >= 0 || type.indexOf('EDIT') >= 0) return 'bg-warning text-dark';
  if (type.indexOf('DELETE') >= 0) return 'bg-danger';
  if (type.indexOf('LOGIN') >= 0) return 'bg-info';
  if (type.indexOf('VIEW') >= 0 || type.indexOf('READ') >= 0) return 'bg-light text-dark';
  return 'bg-secondary';
}

async function loadUsersDropdown() {
  try {
    var response = await fetch(API_BASE + '/api/users');
    if (!response.ok) throw new Error('Server responded with status ' + response.status);
    var users = await response.json();
    var auditUserSelect = document.getElementById('auditUserSelect');
    auditUserSelect.innerHTML = '<option value="">All Users</option>';
    users.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.user_id;
      opt.textContent = u.username;
      auditUserSelect.appendChild(opt);
    });
  } catch (err) {
    showError('Unable to load users for dropdown. Please try again later.');
  }
}

function applyAuditFilters() {
  var filters = {};
  var actorFilter = document.getElementById('auditActorFilter') ? document.getElementById('auditActorFilter').value : '';
  var userId = document.getElementById('auditUserSelect').value;
  var actionType = document.getElementById('auditActionFilter') ? document.getElementById('auditActionFilter').value : '';
  var startDate = document.getElementById('auditStartDate').value;
  var endDate = document.getElementById('auditEndDate').value;

  if (userId) filters.user_id = userId;
  if (actionType) filters.action_type = actionType;
  if (startDate) filters.start_date = startDate;
  if (endDate) filters.end_date = endDate;

  auditPage = 1;

  // If actor filter is set, we filter client-side after loading
  window._auditActorFilter = actorFilter;
  loadAuditLogs(filters);
}

function clearAuditFilters() {
  document.getElementById('auditUserSelect').value = '';
  if (document.getElementById('auditActionFilter')) document.getElementById('auditActionFilter').value = '';
  if (document.getElementById('auditActorFilter')) document.getElementById('auditActorFilter').value = '';
  document.getElementById('auditStartDate').value = '';
  document.getElementById('auditEndDate').value = '';
  window._auditActorFilter = '';
  auditPage = 1;
  loadAuditLogs();
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function () {
  // Attach login handler
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Attach filter event listeners
  document.getElementById('filterSeverity').addEventListener('change', applyFilters);
  document.getElementById('filterStatus').addEventListener('change', applyFilters);

  // Attach form submit handlers for new views
  document.getElementById('sourceForm').addEventListener('submit', submitSource);
  document.getElementById('regulationForm').addEventListener('submit', submitRegulation);
  document.getElementById('taskForm').addEventListener('submit', submitTask);

  // PDF upload form
  var pdfForm = document.getElementById('pdfUploadForm');
  if (pdfForm) {
    pdfForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var fileInput = document.getElementById('pdfFileInput');
      var resultDiv = document.getElementById('pdfUploadResult');
      if (!fileInput.files[0]) { showToast('Please select a PDF file', 'danger'); return; }

      var formData = new FormData();
      formData.append('pdf', fileInput.files[0]);
      formData.append('title', document.getElementById('pdfTitle').value || '');
      formData.append('category', document.getElementById('pdfCategory').value);
      formData.append('source_id', document.getElementById('pdfSource').value);

      resultDiv.innerHTML = '<span class="text-muted small">⏳ Uploading and processing PDF...</span>';

      try {
        var resp = await fetch(API_BASE + '/api/regulations/upload-pdf', { method: 'POST', body: formData });
        var result = await resp.json();
        if (resp.ok) {
          resultDiv.innerHTML = '<span class="text-success small">✅ ' + result.message + ' (' + result.chars_extracted + ' chars extracted, ' + result.pages + ' pages)</span>';
          showToast('PDF uploaded — AI pipeline triggered', 'success');
          pdfForm.reset();
          loadRegulations();
        } else {
          resultDiv.innerHTML = '<span class="text-danger small">❌ ' + result.error + '</span>';
          showToast(result.error, 'danger');
        }
      } catch (err) {
        resultDiv.innerHTML = '<span class="text-danger small">❌ Upload failed</span>';
        showToast('PDF upload failed', 'danger');
      }
    });
  }

  // URL Scrape form
  var urlForm = document.getElementById('urlScrapeForm');
  if (urlForm) {
    urlForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var urlInput = document.getElementById('scrapeUrlInput');
      var resultDiv = document.getElementById('urlScrapeResult');
      if (!urlInput.value) { showToast('Please enter a URL', 'danger'); return; }

      resultDiv.innerHTML = '<span class="text-muted small">⏳ Fetching and processing URL...</span>';

      try {
        var resp = await fetch(API_BASE + '/api/regulations/scrape-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlInput.value,
            title: document.getElementById('scrapeUrlTitle').value || '',
            category: document.getElementById('scrapeUrlCategory').value,
            source_id: document.getElementById('scrapeUrlSource').value
          })
        });
        var result = await resp.json();
        if (resp.ok) {
          resultDiv.innerHTML = '<span class="text-success small">✅ ' + result.message + ' (' + result.chars_extracted + ' chars)</span>';
          showToast(result.message, 'success');
          urlForm.reset();
          loadRegulations();
        } else {
          resultDiv.innerHTML = '<span class="text-danger small">❌ ' + result.error + '</span>';
          showToast(result.error, 'danger');
        }
      } catch (err) {
        resultDiv.innerHTML = '<span class="text-danger small">❌ Scrape failed</span>';
        showToast('URL scrape failed', 'danger');
      }
    });
  }

  // Attach click handlers for regulation edit
  document.getElementById('editRegUpdateBtn').addEventListener('click', submitRegulationEdit);
  document.getElementById('editRegCancelBtn').addEventListener('click', cancelRegulationEdit);

  // Attach handlers for policy CRUD
  document.getElementById('policyForm').addEventListener('submit', submitPolicy);
  document.getElementById('editPolicyUpdateBtn').addEventListener('click', submitPolicyEdit);
  document.getElementById('editPolicyCancelBtn').addEventListener('click', cancelPolicyEdit);

  // Attach handlers for source edit
  document.getElementById('editSourceUpdateBtn').addEventListener('click', submitSourceEdit);
  document.getElementById('editSourceCancelBtn').addEventListener('click', cancelSourceEdit);

  // Attach click handlers for audit filters
  document.getElementById('auditApplyBtn').addEventListener('click', applyAuditFilters);
  document.getElementById('auditClearBtn').addEventListener('click', clearAuditFilters);
});
