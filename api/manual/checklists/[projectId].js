const fs = require('fs');
const path = require('path');

// Try local dev path first, fallback to bundled checklists
function getChecklistsDir() {
  if (fs.existsSync('/data/websites/.platform/test-checklists')) {
    return '/data/websites/.platform/test-checklists';
  }
  const bundledPath = path.join(process.cwd(), 'data/checklists');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  return path.join(__dirname, '../../../data/checklists');
}
const CHECKLISTS_DIR = process.env.CHECKLISTS_DIR || getChecklistsDir();

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

  if (filename === null) {
    return null; // Explicitly no checklist
  }

  if (!filename) {
    // Try direct match
    const directPath = path.join(CHECKLISTS_DIR, `${projectId}.md`);
    if (fs.existsSync(directPath)) {
      const content = fs.readFileSync(directPath, 'utf-8');
      return parseChecklist(content);
    }
    return null;
  }

  const filePath = path.join(CHECKLISTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseChecklist(content);
}

function isValidProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(projectId) && projectId.length <= 100;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId } = req.query;

  if (!isValidProjectId(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    const projectChecklist = getChecklist(projectId);

    if (!projectChecklist) {
      return res.status(404).json({ error: 'Checklist not found for project' });
    }

    res.json(projectChecklist);
  } catch (err) {
    console.error('Error getting checklist:', err);
    res.status(500).json({ error: 'Failed to get checklist' });
  }
};
