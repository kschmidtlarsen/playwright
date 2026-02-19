/**
 * Checklist Parser Service
 * Parses markdown test checklists and extracts categories and items
 */

const fs = require('fs');
const path = require('path');

// Path to test checklists directory
const CHECKLISTS_DIR = '/data/websites/.platform/test-checklists';

// Project ID to checklist file mapping
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

/**
 * List all available checklists
 * @returns {Array} List of {projectId, name, filename, itemCount}
 */
function listChecklists() {
  const checklists = [];

  try {
    const files = fs.readdirSync(CHECKLISTS_DIR);

    for (const file of files) {
      if (file.endsWith('.md') && file !== 'README.md') {
        const filePath = path.join(CHECKLISTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseChecklist(content);

        // Extract project name from first H1
        const nameMatch = content.match(/^# (.+?)( - E2E Test Checklist)?$/m);
        const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');

        // Find project ID that maps to this file
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

/**
 * Get checklist for a specific project
 * @param {string} projectId - Project ID
 * @returns {Object|null} Parsed checklist or null if not found
 */
function getChecklist(projectId) {
  const filename = PROJECT_MAPPING[projectId];

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

/**
 * Parse markdown checklist content
 * @param {string} content - Markdown content
 * @returns {Object} {categories: [], items: []}
 */
function parseChecklist(content) {
  const lines = content.split('\n');
  const categories = [];
  const items = [];

  let currentCategory = null;
  let currentSubcategory = null;
  let itemIndex = 0;

  for (const line of lines) {
    // Match H2 headers (## Category Name)
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      currentCategory = h2Match[1].trim();
      currentSubcategory = null;

      // Skip non-test sections
      if (shouldSkipSection(currentCategory)) {
        currentCategory = null;
        continue;
      }

      if (!categories.includes(currentCategory)) {
        categories.push(currentCategory);
      }
      continue;
    }

    // Match H3 headers (### Subcategory)
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match && currentCategory) {
      currentSubcategory = h3Match[1].trim();
      continue;
    }

    // Match checklist items (- [ ] Item text)
    const itemMatch = line.match(/^- \[ \] (.+)$/);
    if (itemMatch && currentCategory) {
      const title = itemMatch[1].trim();

      // Build full category path
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

/**
 * Check if a section should be skipped (not test items)
 * @param {string} sectionName - Section name
 * @returns {boolean}
 */
function shouldSkipSection(sectionName) {
  const skipSections = [
    'API Endpoint Tests',
    'Playwright Test Outline',
    'Test Data Requirements',
    'Known Issues',
    'Skip Conditions',
    'Quick Reference',
    'Smoke Test Commands',
    'Test Categories',
    'Running Playwright Tests',
    'Verification Plan'
  ];

  return skipSections.some(skip =>
    sectionName.toLowerCase().includes(skip.toLowerCase())
  );
}

module.exports = {
  listChecklists,
  getChecklist,
  parseChecklist,
  CHECKLISTS_DIR,
  PROJECT_MAPPING
};
