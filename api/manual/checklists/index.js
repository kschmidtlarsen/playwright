const fs = require('fs');
const path = require('path');

// Try local dev path first, fallback to bundled checklists
const CHECKLISTS_DIR = process.env.CHECKLISTS_DIR ||
  (fs.existsSync('/data/websites/.platform/test-checklists')
    ? '/data/websites/.platform/test-checklists'
    : path.join(__dirname, '../../../data/checklists'));

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

function listChecklists() {
  const checklists = [];

  try {
    if (!fs.existsSync(CHECKLISTS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(CHECKLISTS_DIR);

    for (const file of files) {
      if (file.endsWith('.md') && file !== 'README.md') {
        const filePath = path.join(CHECKLISTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseChecklist(content);

        const nameMatch = content.match(/^# (.+?)( - E2E Test Checklist)?$/m);
        const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');

        const projectId = Object.entries(PROJECT_MAPPING)
          .find(([_, filename]) => filename === file)?.[0] || file.replace('.md', '');

        checklists.push({
          projectId,
          name,
          filename: file,
          itemCount: parsed.items.length,
          categoryCount: parsed.categories.length
        });
      }
    }
  } catch (err) {
    console.error('Error listing checklists:', err);
  }

  return checklists;
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

  try {
    const checklists = listChecklists();
    res.json(checklists);
  } catch (err) {
    console.error('Error listing checklists:', err);
    res.status(500).json({ error: 'Failed to list checklists' });
  }
};
