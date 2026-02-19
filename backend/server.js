const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const checklist = require('./services/checklist');

const app = express();

// Generate unique session ID
function generateSessionId() {
  return 'session-' + crypto.randomBytes(8).toString('hex');
}
const PORT = process.env.PORT || 3030;

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Security: Validate projectId to prevent injection
function isValidProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(projectId) && projectId.length <= 100;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'playwright-dashboard' });
});

// API health check (for Vercel)
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'playwright-dashboard', timestamp: new Date().toISOString() });
});

// Get list of projects
app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, base_url, port FROM projects ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get all results summary (for dashboard overview)
app.get('/api/results', async (req, res) => {
  try {
    // Get latest run for each project
    const result = await db.query(`
      SELECT DISTINCT ON (project_id)
        project_id,
        run_id,
        timestamp,
        stats_total,
        stats_passed,
        stats_failed,
        stats_skipped,
        stats_duration,
        exit_code
      FROM test_runs
      ORDER BY project_id, timestamp DESC
    `);

    // Get project names
    const projects = await db.query('SELECT id, name FROM projects');
    const projectNames = {};
    projects.rows.forEach(p => { projectNames[p.id] = p.name; });

    // Build summary
    const summary = {};
    result.rows.forEach(row => {
      summary[row.project_id] = {
        name: projectNames[row.project_id] || row.project_id,
        lastRun: {
          id: row.run_id,
          timestamp: row.timestamp,
          stats: {
            total: row.stats_total,
            passed: row.stats_passed,
            failed: row.stats_failed,
            skipped: row.stats_skipped,
            duration: row.stats_duration
          }
        },
        passed: row.stats_passed,
        failed: row.stats_failed,
        skipped: row.stats_skipped,
        total: row.stats_total,
        status: row.stats_failed > 0 ? 'failed' : row.stats_passed > 0 ? 'passed' : 'unknown'
      };
    });

    // Add projects with no runs
    projects.rows.forEach(p => {
      if (!summary[p.id]) {
        summary[p.id] = {
          name: p.name,
          lastRun: null,
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          status: 'unknown'
        };
      }
    });

    res.json(summary);
  } catch (err) {
    console.error('Error fetching results summary:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get test results for a specific project
app.get('/api/results/:projectId', async (req, res) => {
  const { projectId } = req.params;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const result = await db.query(`
      SELECT
        run_id as id,
        timestamp,
        stats_total as total,
        stats_passed as passed,
        stats_failed as failed,
        stats_skipped as skipped,
        stats_duration as duration,
        source,
        exit_code,
        suites,
        errors
      FROM test_runs
      WHERE project_id = $1
      ORDER BY timestamp DESC
      LIMIT 20
    `, [projectId]);

    if (result.rows.length === 0) {
      return res.json({ runs: [], lastRun: null });
    }

    const runs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      stats: {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        skipped: row.skipped,
        duration: row.duration
      },
      source: row.source,
      exitCode: row.exit_code,
      suites: row.suites,
      errors: row.errors
    }));

    res.json({
      runs,
      lastRun: runs[0]
    });
  } catch (err) {
    console.error('Error fetching project results:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get test run history for a project
app.get('/api/history/:projectId', async (req, res) => {
  const { projectId } = req.params;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const result = await db.query(`
      SELECT
        run_id as id,
        timestamp,
        stats_total as total,
        stats_passed as passed,
        stats_failed as failed,
        stats_skipped as skipped,
        stats_duration as duration,
        source,
        exit_code
      FROM test_runs
      WHERE project_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `, [projectId]);

    const runs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      stats: {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        skipped: row.skipped,
        duration: row.duration
      },
      source: row.source,
      exitCode: row.exit_code
    }));

    res.json(runs);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Upload test results (for CI/CD and manual test runs)
app.post('/api/upload/:projectId', async (req, res) => {
  const { projectId } = req.params;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const { stats, suites, errors, source } = req.body;

  if (!stats || typeof stats !== 'object') {
    return res.status(400).json({ error: 'Invalid stats object' });
  }

  try {
    const runId = Date.now().toString();

    await db.query(`
      INSERT INTO test_runs (
        project_id, run_id, timestamp,
        stats_total, stats_passed, stats_failed, stats_skipped, stats_duration,
        source, exit_code, suites, errors
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      projectId,
      runId,
      stats.total || 0,
      stats.passed || 0,
      stats.failed || 0,
      stats.skipped || 0,
      stats.duration || 0,
      source || 'ci-upload',
      stats.failed > 0 ? 1 : 0,
      JSON.stringify(suites || []),
      JSON.stringify(errors || [])
    ]);

    // Ensure project exists
    await db.query(`
      INSERT INTO projects (id, name)
      VALUES ($1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [projectId]);

    // Clean up old runs (keep last 50 per project)
    await db.query(`
      DELETE FROM test_runs
      WHERE project_id = $1
      AND id NOT IN (
        SELECT id FROM test_runs
        WHERE project_id = $1
        ORDER BY timestamp DESC
        LIMIT 50
      )
    `, [projectId]);

    const run = {
      id: runId,
      timestamp: new Date().toISOString(),
      stats: {
        total: stats.total || 0,
        passed: stats.passed || 0,
        failed: stats.failed || 0,
        skipped: stats.skipped || 0,
        duration: stats.duration || 0
      },
      source: source || 'ci-upload',
      exitCode: stats.failed > 0 ? 1 : 0
    };

    console.log(`Results uploaded for ${projectId}: ${run.stats.passed}/${run.stats.total} passed (source: ${run.source})`);

    res.json({ message: 'Results uploaded', run });
  } catch (err) {
    console.error('Error uploading results:', err);
    res.status(500).json({ error: 'Failed to upload results' });
  }
});

// Poll endpoint - returns latest update timestamp for efficient polling
app.get('/api/poll', async (req, res) => {
  const { since } = req.query;

  try {
    let query = 'SELECT MAX(timestamp) as latest FROM test_runs';
    const result = await db.query(query);

    const latest = result.rows[0]?.latest;
    const hasUpdates = since ? new Date(latest) > new Date(since) : false;

    res.json({
      latest: latest?.toISOString() || null,
      hasUpdates
    });
  } catch (err) {
    console.error('Error polling:', err);
    res.status(500).json({ error: 'Failed to poll' });
  }
});

// ==========================================
// MANUAL TESTING API ROUTES
// ==========================================

// List available checklists
app.get('/api/manual/checklists', (req, res) => {
  try {
    const checklists = checklist.listChecklists();
    res.json(checklists);
  } catch (err) {
    console.error('Error listing checklists:', err);
    res.status(500).json({ error: 'Failed to list checklists' });
  }
});

// Get checklist for a specific project
app.get('/api/manual/checklists/:projectId', (req, res) => {
  const { projectId } = req.params;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const projectChecklist = checklist.getChecklist(projectId);

    if (!projectChecklist) {
      return res.status(404).json({ error: 'Checklist not found for project' });
    }

    res.json(projectChecklist);
  } catch (err) {
    console.error('Error getting checklist:', err);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
});

// List manual test sessions
app.get('/api/manual/sessions', async (req, res) => {
  const { projectId, status, limit = 20 } = req.query;

  try {
    let query = `
      SELECT session_id, project_id, status, started_at, completed_at,
             total_items, passed_items, failed_items, skipped_items, notes
      FROM manual_test_sessions
    `;
    const params = [];
    const conditions = [];

    if (projectId) {
      if (!isValidProjectId(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID' });
      }
      conditions.push(`project_id = $${params.length + 1}`);
      params.push(projectId);
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await db.query(query, params);

    res.json(result.rows.map(row => ({
      sessionId: row.session_id,
      projectId: row.project_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      totalItems: row.total_items,
      passedItems: row.passed_items,
      failedItems: row.failed_items,
      skippedItems: row.skipped_items,
      notes: row.notes
    })));
  } catch (err) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Start a new manual test session
app.post('/api/manual/sessions', async (req, res) => {
  const { projectId, createdBy, notes } = req.body;

  if (!projectId || !isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid or missing project ID' });
  }

  try {
    // Get checklist for project
    const projectChecklist = checklist.getChecklist(projectId);

    if (!projectChecklist) {
      return res.status(404).json({ error: 'Checklist not found for project' });
    }

    const sessionId = generateSessionId();
    const totalItems = projectChecklist.items.length;

    // Create session
    await db.query(`
      INSERT INTO manual_test_sessions (session_id, project_id, status, total_items, created_by, notes)
      VALUES ($1, $2, 'in_progress', $3, $4, $5)
    `, [sessionId, projectId, totalItems, createdBy || null, notes || null]);

    // Create items from checklist
    for (const item of projectChecklist.items) {
      await db.query(`
        INSERT INTO manual_test_items (session_id, item_index, category, title, status, is_custom)
        VALUES ($1, $2, $3, $4, 'pending', false)
      `, [sessionId, item.index, item.category, item.title]);
    }

    res.status(201).json({
      sessionId,
      projectId,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      totalItems,
      passedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      items: projectChecklist.items
    });
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get a specific session with all items
app.get('/api/manual/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Get session
    const sessionResult = await db.query(`
      SELECT session_id, project_id, status, started_at, completed_at,
             total_items, passed_items, failed_items, skipped_items, created_by, notes
      FROM manual_test_sessions
      WHERE session_id = $1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get items
    const itemsResult = await db.query(`
      SELECT id, item_index, category, title, status, error_description,
             is_custom, tested_at, kanban_card_id
      FROM manual_test_items
      WHERE session_id = $1
      ORDER BY item_index
    `, [sessionId]);

    res.json({
      sessionId: session.session_id,
      projectId: session.project_id,
      status: session.status,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      totalItems: session.total_items,
      passedItems: session.passed_items,
      failedItems: session.failed_items,
      skippedItems: session.skipped_items,
      createdBy: session.created_by,
      notes: session.notes,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        index: item.item_index,
        category: item.category,
        title: item.title,
        status: item.status,
        errorDescription: item.error_description,
        isCustom: item.is_custom,
        testedAt: item.tested_at,
        kanbanCardId: item.kanban_card_id
      }))
    });
  } catch (err) {
    console.error('Error getting session:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Update session (complete/cancel)
app.patch('/api/manual/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['in_progress', 'completed', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updates = [];
    const params = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);

      if (status === 'completed' || status === 'cancelled') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (notes !== undefined) {
      params.push(notes);
      updates.push(`notes = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(sessionId);
    const query = `
      UPDATE manual_test_sessions
      SET ${updates.join(', ')}
      WHERE session_id = $${params.length}
      RETURNING session_id, project_id, status, started_at, completed_at,
                total_items, passed_items, failed_items, skipped_items, notes
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    res.json({
      sessionId: session.session_id,
      projectId: session.project_id,
      status: session.status,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      totalItems: session.total_items,
      passedItems: session.passed_items,
      failedItems: session.failed_items,
      skippedItems: session.skipped_items,
      notes: session.notes
    });
  } catch (err) {
    console.error('Error updating session:', err);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Add custom item to session
app.post('/api/manual/sessions/:sessionId/items', async (req, res) => {
  const { sessionId } = req.params;
  const { category, title } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    // Get max item_index for session
    const maxResult = await db.query(`
      SELECT COALESCE(MAX(item_index), -1) as max_index
      FROM manual_test_items
      WHERE session_id = $1
    `, [sessionId]);

    const newIndex = maxResult.rows[0].max_index + 1;

    // Insert new custom item
    const result = await db.query(`
      INSERT INTO manual_test_items (session_id, item_index, category, title, status, is_custom)
      VALUES ($1, $2, $3, $4, 'pending', true)
      RETURNING id, item_index, category, title, status, is_custom
    `, [sessionId, newIndex, category || 'Custom', title]);

    // Update session total_items
    await db.query(`
      UPDATE manual_test_sessions
      SET total_items = total_items + 1
      WHERE session_id = $1
    `, [sessionId]);

    const item = result.rows[0];
    res.status(201).json({
      id: item.id,
      index: item.item_index,
      category: item.category,
      title: item.title,
      status: item.status,
      isCustom: item.is_custom
    });
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update item status (pass/fail/skip)
app.patch('/api/manual/items/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { status, errorDescription } = req.body;

  const validStatuses = ['pending', 'passed', 'failed', 'skipped'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (status === 'failed' && !errorDescription) {
    return res.status(400).json({ error: 'Error description required for failed items' });
  }

  try {
    // Get current item to find session and old status
    const currentResult = await db.query(`
      SELECT session_id, status as old_status
      FROM manual_test_items
      WHERE id = $1
    `, [itemId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { session_id: sessionId, old_status: oldStatus } = currentResult.rows[0];

    // Update item
    const result = await db.query(`
      UPDATE manual_test_items
      SET status = $1, error_description = $2, tested_at = NOW()
      WHERE id = $3
      RETURNING id, item_index, category, title, status, error_description, tested_at
    `, [status, status === 'failed' ? errorDescription : null, itemId]);

    const item = result.rows[0];

    // Update session counters
    const counterUpdates = [];
    if (oldStatus === 'passed') counterUpdates.push('passed_items = passed_items - 1');
    if (oldStatus === 'failed') counterUpdates.push('failed_items = failed_items - 1');
    if (oldStatus === 'skipped') counterUpdates.push('skipped_items = skipped_items - 1');

    if (status === 'passed') counterUpdates.push('passed_items = passed_items + 1');
    if (status === 'failed') counterUpdates.push('failed_items = failed_items + 1');
    if (status === 'skipped') counterUpdates.push('skipped_items = skipped_items + 1');

    if (counterUpdates.length > 0) {
      await db.query(`
        UPDATE manual_test_sessions
        SET ${counterUpdates.join(', ')}
        WHERE session_id = $1
      `, [sessionId]);
    }

    res.json({
      id: item.id,
      index: item.item_index,
      category: item.category,
      title: item.title,
      status: item.status,
      errorDescription: item.error_description,
      testedAt: item.tested_at
    });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete/skip item from session
app.delete('/api/manual/items/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    // Get item info first
    const itemResult = await db.query(`
      SELECT session_id, status, is_custom
      FROM manual_test_items
      WHERE id = $1
    `, [itemId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { session_id: sessionId, status, is_custom: isCustom } = itemResult.rows[0];

    if (isCustom) {
      // Delete custom items entirely
      await db.query('DELETE FROM manual_test_items WHERE id = $1', [itemId]);

      // Update session counters
      const counterUpdates = ['total_items = total_items - 1'];
      if (status === 'passed') counterUpdates.push('passed_items = passed_items - 1');
      if (status === 'failed') counterUpdates.push('failed_items = failed_items - 1');
      if (status === 'skipped') counterUpdates.push('skipped_items = skipped_items - 1');

      await db.query(`
        UPDATE manual_test_sessions
        SET ${counterUpdates.join(', ')}
        WHERE session_id = $1
      `, [sessionId]);

      res.json({ deleted: true });
    } else {
      // Mark predefined items as skipped
      await db.query(`
        UPDATE manual_test_items
        SET status = 'skipped', tested_at = NOW()
        WHERE id = $1
      `, [itemId]);

      // Update counters
      const counterUpdates = ['skipped_items = skipped_items + 1'];
      if (status === 'passed') counterUpdates.push('passed_items = passed_items - 1');
      if (status === 'failed') counterUpdates.push('failed_items = failed_items - 1');

      if (status !== 'skipped') {
        await db.query(`
          UPDATE manual_test_sessions
          SET ${counterUpdates.join(', ')}
          WHERE session_id = $1
        `, [sessionId]);
      }

      res.json({ skipped: true });
    }
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Generate bug cards for failed items
app.post('/api/manual/sessions/:sessionId/report', async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Get session info
    const sessionResult = await db.query(`
      SELECT session_id, project_id, started_at
      FROM manual_test_sessions
      WHERE session_id = $1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get all failed items grouped by category
    const failedResult = await db.query(`
      SELECT id, category, title, error_description
      FROM manual_test_items
      WHERE session_id = $1 AND status = 'failed'
      ORDER BY category, item_index
    `, [sessionId]);

    if (failedResult.rows.length === 0) {
      return res.json({ message: 'No failed items', cards: [] });
    }

    // Group by category
    const groupedFailures = {};
    for (const item of failedResult.rows) {
      const cat = item.category || 'Uncategorized';
      if (!groupedFailures[cat]) {
        groupedFailures[cat] = [];
      }
      groupedFailures[cat].push(item);
    }

    // Get category totals for context
    const categoryTotals = {};
    const totalsResult = await db.query(`
      SELECT category, COUNT(*) as total,
             SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM manual_test_items
      WHERE session_id = $1
      GROUP BY category
    `, [sessionId]);

    for (const row of totalsResult.rows) {
      categoryTotals[row.category || 'Uncategorized'] = {
        total: parseInt(row.total, 10),
        passed: parseInt(row.passed, 10),
        failed: parseInt(row.failed, 10)
      };
    }

    // Create bug cards via Kanban API
    const createdCards = [];
    const KANBAN_API = 'https://kanban.exe.pm/api/board';

    for (const [category, items] of Object.entries(groupedFailures)) {
      const failCount = items.length;
      const totals = categoryTotals[category] || { total: failCount, passed: 0, failed: failCount };

      // Build card description
      let description = `## Manual Test Failures\n\n`;
      description += `**Project:** ${session.project_id}\n`;
      description += `**Category:** ${category}\n`;
      description += `**Session:** ${session.session_id}\n`;
      description += `**Tested:** ${new Date(session.started_at).toISOString()}\n\n`;
      description += `---\n\n### Failed Tests\n\n`;

      for (const item of items) {
        description += `#### ❌ ${item.title}\n`;
        description += `**Error:** ${item.error_description}\n\n`;
      }

      description += `---\n\n### Session Summary\n`;
      description += `- Total in category: ${totals.total}\n`;
      description += `- Passed: ${totals.passed}\n`;
      description += `- Failed: ${totals.failed}\n`;

      const cardTitle = `BUG: ${category} - ${failCount} test failure${failCount > 1 ? 's' : ''}`;

      try {
        const response = await fetch(`${KANBAN_API}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cardTitle,
            description: description,
            projectId: session.project_id,
            columnId: 'backlog',
            priority: 'high',
            type: 'bug'
          })
        });

        if (response.ok) {
          const cardData = await response.json();
          createdCards.push({
            category,
            failCount,
            cardId: cardData.id,
            cardUrl: `https://kanban.exe.pm/card/${cardData.id}`
          });

          // Update items with kanban_card_id
          const itemIds = items.map(i => i.id);
          await db.query(`
            UPDATE manual_test_items
            SET kanban_card_id = $1
            WHERE id = ANY($2::int[])
          `, [cardData.id, itemIds]);
        } else {
          console.error('Failed to create Kanban card:', await response.text());
          createdCards.push({
            category,
            failCount,
            error: 'Failed to create card'
          });
        }
      } catch (fetchErr) {
        console.error('Error calling Kanban API:', fetchErr);
        createdCards.push({
          category,
          failCount,
          error: fetchErr.message
        });
      }
    }

    res.json({
      message: `Created ${createdCards.filter(c => c.cardId).length} bug cards`,
      cards: createdCards
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Start server only if run directly (not imported for testing or Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Playwright Dashboard running on http://localhost:${PORT}`);
  });
}

// Export for Vercel and testing
module.exports = app;
