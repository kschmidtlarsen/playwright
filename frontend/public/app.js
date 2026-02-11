// API Base URL
const API_BASE = window.location.origin;

// WebSocket connection
let ws = null;
let wsReconnectAttempts = 0;
const WS_MAX_RECONNECT_ATTEMPTS = 5;
const WS_RECONNECT_DELAY = 3000;

// State
let projects = [];
let results = {};
let expandedProjects = new Set();
let expandedTests = new Set();
let runningProjects = new Set();

// DOM Elements
const summaryCards = document.getElementById('summaryCards');
const resultsContainer = document.getElementById('resultsContainer');
const historyContainer = document.getElementById('historyContainer');
const projectFilter = document.getElementById('projectFilter');
const statusFilter = document.getElementById('statusFilter');
const runAllBtn = document.getElementById('runAllBtn');
const refreshBtn = document.getElementById('refreshBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');

// WebSocket setup
function connectWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    wsReconnectAttempts = 0;
    updateConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    if (wsReconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS) {
      wsReconnectAttempts++;
      console.log(`Reconnecting... attempt ${wsReconnectAttempts}`);
      setTimeout(connectWebSocket, WS_RECONNECT_DELAY);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.classList.toggle('connected', connected);
    statusEl.classList.toggle('disconnected', !connected);
    statusEl.title = connected ? 'Connected - Real-time updates active' : 'Disconnected - Reconnecting...';
  }
}

function handleWebSocketMessage(message) {
  const { event, data, timestamp } = message;

  switch (event) {
    case 'tests:started':
      runningProjects.add(data.projectId);
      showToast(`Tests started for ${data.projectId}${data.grep ? ` (${data.grep})` : ''}`, 'info');
      updateProjectRunningState(data.projectId, true);
      break;

    case 'tests:completed':
      runningProjects.delete(data.projectId);
      const { run, projectId } = data;
      showToast(`Tests completed for ${projectId}: ${run.stats.passed}/${run.stats.total} passed`,
                run.stats.failed > 0 ? 'error' : 'success');
      updateProjectRunningState(projectId, false);
      loadResults(); // Refresh all results
      break;

    case 'tests:error':
      runningProjects.delete(data.projectId);
      showToast(`Test error for ${data.projectId}: ${data.error}`, 'error');
      updateProjectRunningState(data.projectId, false);
      break;

    case 'results:uploaded':
      const uploadedRun = data.run;
      showToast(`Results uploaded for ${data.projectId}: ${uploadedRun.stats.passed}/${uploadedRun.stats.total} passed`, 'success');
      loadResults(); // Refresh all results
      break;

    default:
      console.log('Unknown WebSocket event:', event);
  }
}

function updateProjectRunningState(projectId, isRunning) {
  const card = document.querySelector(`[data-project-id="${projectId}"]`);
  if (card) {
    const btn = card.querySelector('.run-btn');
    if (btn) {
      btn.disabled = isRunning;
      btn.textContent = isRunning ? 'Running...' : 'Run Tests';
      if (isRunning) {
        btn.classList.add('running');
      } else {
        btn.classList.remove('running');
      }
    }
  }
}

// Initialize
async function init() {
  await loadProjects();
  await loadResults();
  setupEventListeners();
  connectWebSocket();
}

// Load projects
async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    projects = await res.json();

    // Populate project filter
    projectFilter.innerHTML = '<option value="all">All Projects</option>';
    projects.forEach(p => {
      projectFilter.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
  } catch (err) {
    showToast('Failed to load projects', 'error');
  }
}

// Load all results
async function loadResults() {
  try {
    const res = await fetch(`${API_BASE}/api/results`);
    results = await res.json();
    renderSummaryCards();
    renderResults();
    renderHistory();
  } catch (err) {
    showToast('Failed to load results', 'error');
  }
}

// Render summary cards
function renderSummaryCards() {
  summaryCards.innerHTML = '';

  for (const project of projects) {
    const data = results[project.id] || {};
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.setAttribute('data-project-id', project.id);

    const statusClass = data.status === 'failed' ? 'status-failed' :
                        data.status === 'passed' ? 'status-passed' : 'status-unknown';

    const lastRunText = data.lastRun ?
      formatDate(data.lastRun.timestamp) : 'Never run';

    const isRunning = runningProjects.has(project.id);

    card.innerHTML = `
      <div class="summary-card-header">
        <span class="summary-card-title">${project.name}</span>
        <span class="summary-card-status ${statusClass}">
          ${data.status || 'Unknown'}
        </span>
      </div>
      <div class="summary-card-stats">
        <div class="stat">
          <div class="stat-value passed">${data.passed || 0}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat">
          <div class="stat-value failed">${data.failed || 0}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value skipped">${data.skipped || 0}</div>
          <div class="stat-label">Skipped</div>
        </div>
        <div class="stat">
          <div class="stat-value total">${data.total || 0}</div>
          <div class="stat-label">Total</div>
        </div>
      </div>
      <div class="summary-card-footer">
        <span class="last-run">Last run: ${lastRunText}</span>
        <button class="btn btn-sm btn-primary run-btn ${isRunning ? 'running' : ''}"
                onclick="runTests('${project.id}')" ${isRunning ? 'disabled' : ''}>
          ${isRunning ? 'Running...' : 'Run Tests'}
        </button>
      </div>
    `;

    summaryCards.appendChild(card);
  }
}

// Render detailed results
async function renderResults() {
  resultsContainer.innerHTML = '';

  const selectedProject = projectFilter.value;
  const selectedStatus = statusFilter.value;

  const projectsToShow = selectedProject === 'all' ?
    projects : projects.filter(p => p.id === selectedProject);

  for (const project of projectsToShow) {
    try {
      const res = await fetch(`${API_BASE}/api/results/${project.id}`);
      const data = await res.json();

      if (!data.lastRun) {
        const div = document.createElement('div');
        div.className = 'project-results';
        div.innerHTML = `
          <div class="project-header">
            <span class="project-name">${project.name}</span>
            <span class="project-summary">No tests run yet</span>
          </div>
        `;
        resultsContainer.appendChild(div);
        continue;
      }

      const tests = extractTests(data.lastRun.suites, selectedStatus);
      const isExpanded = expandedProjects.has(project.id);

      const div = document.createElement('div');
      div.className = 'project-results';
      div.innerHTML = `
        <div class="project-header" onclick="toggleProject('${project.id}')">
          <span class="project-name">${project.name}</span>
          <div class="project-summary">
            <span style="color: var(--success)">✓ ${data.lastRun.stats.passed}</span>
            <span style="color: var(--error)">✗ ${data.lastRun.stats.failed}</span>
            <span style="color: var(--warning)">○ ${data.lastRun.stats.skipped}</span>
          </div>
        </div>
        <div class="test-list ${isExpanded ? 'expanded' : ''}" id="tests-${project.id}">
          ${tests.map((t, idx) => {
            const testId = `${project.id}-test-${idx}`;
            const isTestExpanded = expandedTests.has(testId);
            return `
              <div class="test-item-wrapper">
                <div class="test-item" onclick="toggleTestDetails('${testId}')">
                  <div class="test-name">
                    <span class="test-status-icon ${t.status}">${getStatusIcon(t.status)}</span>
                    <span>${t.title}</span>
                  </div>
                  <div class="test-meta">
                    <span class="test-duration">${t.duration}ms</span>
                    ${t.description ? '<span class="test-info-icon" title="Click for details">ℹ</span>' : ''}
                  </div>
                </div>
                <div class="test-details ${isTestExpanded ? 'expanded' : ''}" id="details-${testId}">
                  ${t.description ? `
                    <div class="test-description">
                      <strong>What this test does:</strong>
                      <p>${t.description}</p>
                    </div>
                  ` : ''}
                  ${t.file ? `<div class="test-file"><strong>File:</strong> ${t.file}:${t.line}</div>` : ''}
                  ${t.errors && t.errors.length > 0 ? `
                    <div class="test-errors">
                      <strong>Errors:</strong>
                      <pre>${t.errors.map(e => e.message || e).join('\n')}</pre>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      resultsContainer.appendChild(div);
    } catch (err) {
      console.error(`Failed to load results for ${project.id}:`, err);
    }
  }

  if (resultsContainer.innerHTML === '') {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p>No test results available</p>
        <button class="btn btn-primary" onclick="runAllTests()">Run Tests</button>
      </div>
    `;
  }
}

// Extract tests from suites
function extractTests(suites, statusFilter) {
  const tests = [];

  function traverse(suites, prefix = '') {
    for (const suite of suites || []) {
      const suiteName = prefix ? `${prefix} > ${suite.title}` : suite.title;

      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const result = test.results?.[0];
          const status = result?.status || 'unknown';
          const normalizedStatus = status === 'expected' ? 'passed' :
                                   status === 'unexpected' ? 'failed' : status;

          if (statusFilter === 'all' || normalizedStatus === statusFilter) {
            // Extract description from annotations
            const descAnnotation = test.annotations?.find(a => a.type === 'description');
            const description = descAnnotation?.description || null;

            tests.push({
              title: `${suiteName} > ${spec.title}`,
              status: normalizedStatus,
              duration: result?.duration || 0,
              description: description,
              file: spec.file || null,
              line: spec.line || null,
              errors: result?.errors || []
            });
          }
        }
      }

      traverse(suite.suites, suiteName);
    }
  }

  traverse(suites);
  return tests;
}

// Toggle test details
function toggleTestDetails(testId) {
  if (expandedTests.has(testId)) {
    expandedTests.delete(testId);
  } else {
    expandedTests.add(testId);
  }

  const details = document.getElementById(`details-${testId}`);
  if (details) {
    details.classList.toggle('expanded');
  }
}

// Render history
async function renderHistory() {
  historyContainer.innerHTML = '';

  const allHistory = [];

  for (const project of projects) {
    try {
      const res = await fetch(`${API_BASE}/api/history/${project.id}`);
      const runs = await res.json();

      for (const run of runs.slice(0, 5)) {
        allHistory.push({
          project: project.name,
          projectId: project.id,
          ...run
        });
      }
    } catch (err) {
      console.error(`Failed to load history for ${project.id}:`, err);
    }
  }

  // Sort by timestamp descending
  allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const run of allHistory.slice(0, 10)) {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-header">
        <span class="history-project">${run.project}</span>
        <span class="history-time">${formatDate(run.timestamp)}</span>
      </div>
      <div class="history-stats">
        <span style="color: var(--success)">✓ ${run.stats.passed}</span>
        <span style="color: var(--error)">✗ ${run.stats.failed}</span>
        <span style="color: var(--warning)">○ ${run.stats.skipped}</span>
      </div>
    `;
    historyContainer.appendChild(card);
  }

  if (allHistory.length === 0) {
    historyContainer.innerHTML = `
      <div class="empty-state">
        <p>No test history available</p>
      </div>
    `;
  }
}

// Toggle project expansion
function toggleProject(projectId) {
  if (expandedProjects.has(projectId)) {
    expandedProjects.delete(projectId);
  } else {
    expandedProjects.add(projectId);
  }

  const testList = document.getElementById(`tests-${projectId}`);
  if (testList) {
    testList.classList.toggle('expanded');
  }
}

// Run tests for a single project
async function runTests(projectId) {
  // Mark as running immediately for UI feedback
  runningProjects.add(projectId);
  updateProjectRunningState(projectId, true);

  try {
    const res = await fetch(`${API_BASE}/api/run/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Failed to start tests', 'error');
      runningProjects.delete(projectId);
      updateProjectRunningState(projectId, false);
      return;
    }

    // WebSocket will handle the tests:started and tests:completed events
    // No need to poll - updates come via WebSocket automatically
  } catch (err) {
    showToast('Failed to start tests', 'error');
    runningProjects.delete(projectId);
    updateProjectRunningState(projectId, false);
  }
}

// Run all tests
async function runAllTests() {
  try {
    const res = await fetch(`${API_BASE}/api/run-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    // Mark all runnable projects as running
    if (data.projects) {
      data.projects.forEach(projectId => {
        runningProjects.add(projectId);
        updateProjectRunningState(projectId, true);
      });
    }

    showToast('Running tests for all projects...', 'success');
    // WebSocket will handle updates as tests complete
  } catch (err) {
    showToast('Failed to start tests', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  runAllBtn.addEventListener('click', runAllTests);
  refreshBtn.addEventListener('click', loadResults);
  projectFilter.addEventListener('change', renderResults);
  statusFilter.addEventListener('change', renderResults);
}

// Utility functions
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusIcon(status) {
  switch (status) {
    case 'passed': return '✓';
    case 'failed': return '✗';
    case 'skipped': return '○';
    default: return '?';
  }
}

function showLoading(show) {
  loadingOverlay.classList.toggle('hidden', !show);
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Make functions available globally
window.runTests = runTests;
window.runAllTests = runAllTests;
window.toggleProject = toggleProject;
window.toggleTestDetails = toggleTestDetails;

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
