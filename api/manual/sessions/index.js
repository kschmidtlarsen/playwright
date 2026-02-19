const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CHECKLISTS_DIR = process.env.CHECKLISTS_DIR ||
  (fs.existsSync('/data/websites/.platform/test-checklists')
    ? '/data/websites/.platform/test-checklists'
    : path.join(process.cwd(), 'data/checklists'));

const PROJECT_MAPPING = {
  'kanban': 'kanban.md',
  'crossfit-generator': 'wodforge.md',
  'wodforge': 'wodforge.md',
  'rental': 'sorring-udlejning.md',
  'sorring-udlejning': 'sorring-udlejning.md',
  'sorring3d': 'sorring3d.md',
  'sorring-3d': 'sorring3d.md',
  'grablist': 'grablist.md',
  'shopping-list': 'grablist.md',
  'calify': 'calify.md',
  'ical-adjuster': 'calify.md',
  'playwright': 'playwright.md',
  'test-dashboard': 'playwright.md'
};

function parseChecklist(content) {
  const lines = content.split('\n');
  const categories = [];
  const items = [];
  let currentCategory = null;
  let currentSubcategory = null;
  let itemIndex = 0;

  const skipSections = [
    'API Endpoint Tests', 'Playwright Test Outline', 'Test Data Requirements',
    'Known Issues', 'Skip Conditions', 'Quick Reference', 'Smoke Test Commands',
    'Test Categories', 'Running Playwright Tests', 'Verification Plan'
  ];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      currentCategory = h2Match[1].trim();
      currentSubcategory = null;
      if (skipSections.some(s => currentCategory.toLowerCase().includes(s.toLowerCase()))) {
        currentCategory = null;
        continue;
      }
      if (!categories.includes(currentCategory)) {
        categories.push(currentCategory);
      }
      continue;
    }

    const h3Match = line.match(/^### (.+)$/);
    if (h3Match && currentCategory) {
      currentSubcategory = h3Match[1].trim();
      continue;
    }

    const itemMatch = line.match(/^- \[ \] (.+)$/);
    if (itemMatch && currentCategory) {
      const title = itemMatch[1].trim();
      const fullCategory = currentSubcategory
        ? `${currentCategory} > ${currentSubcategory}`
        : currentCategory;
      items.push({
        index: itemIndex++,
        category: fullCategory,
        title: title,
        status: 'pending'
      });
    }
  }

  return { categories, items };
}

function getChecklist(projectId) {
  const filename = PROJECT_MAPPING[projectId];
  if (filename === null) return null;

  if (!filename) {
    const directPath = path.join(CHECKLISTS_DIR, `${projectId}.md`);
    if (fs.existsSync(directPath)) {
      return parseChecklist(fs.readFileSync(directPath, 'utf-8'));
    }
    return null;
  }

  const filePath = path.join(CHECKLISTS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;

  return parseChecklist(fs.readFileSync(filePath, 'utf-8'));
}

function generateSessionId() {
  return 'session-' + crypto.randomBytes(8).toString('hex');
}

function isValidProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(projectId) && projectId.length <= 100;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - List sessions
  if (req.method === 'GET') {
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

      const result = await pool.query(query, params);

      return res.json(result.rows.map(row => ({
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
      return res.status(500).json({ error: 'Failed to list sessions' });
    }
  }

  // POST - Create session
  if (req.method === 'POST') {
    const { projectId, createdBy, notes } = req.body;

    if (!projectId || !isValidProjectId(projectId)) {
      return res.status(400).json({ error: 'Invalid or missing project ID' });
    }

    try {
      const projectChecklist = getChecklist(projectId);

      if (!projectChecklist) {
        return res.status(404).json({ error: 'Checklist not found for project' });
      }

      const sessionId = generateSessionId();
      const totalItems = projectChecklist.items.length;

      await pool.query(`
        INSERT INTO manual_test_sessions (session_id, project_id, status, total_items, created_by, notes)
        VALUES ($1, $2, 'in_progress', $3, $4, $5)
      `, [sessionId, projectId, totalItems, createdBy || null, notes || null]);

      for (const item of projectChecklist.items) {
        await pool.query(`
          INSERT INTO manual_test_items (session_id, item_index, category, title, status, is_custom)
          VALUES ($1, $2, $3, $4, 'pending', false)
        `, [sessionId, item.index, item.category, item.title]);
      }

      return res.status(201).json({
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
      return res.status(500).json({ error: 'Failed to create session' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
