# Grablist - E2E Test Checklist

**URL:** https://grablist.org
**Auth:** None (single-user MVP)
**Tech:** Express + PostgreSQL + PWA
**Language:** Danish UI

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200 with database status
- [ ] Homepage loads without errors
- [ ] No console errors on page load
- [ ] Service Worker registers (PWA)

### Basic Functionality
- [ ] Active shopping list displays
- [ ] Categories visible
- [ ] Quick-add input field present

---

## Core Feature Tests

### Shopping List Management
- [ ] View all lists
- [ ] Create new list
  - [ ] Enter list name
  - [ ] Select store (optional)
  - [ ] List appears in list view
- [ ] View active list
- [ ] Rename list
- [ ] Delete list (with confirmation)
- [ ] Archive completed list

### Quick Add Items
- [ ] Focus quick-add input
- [ ] Type single item (e.g., "mælk")
  - [ ] Item appears in list
  - [ ] Auto-categorized correctly
- [ ] Add multiple items with delimiter (e.g., "mælk + æg 6 stk + brød")
  - [ ] All items parsed
  - [ ] Quantities extracted
  - [ ] Units recognized
- [ ] Add item with Danish decimal (e.g., "ost 0,5 kg")
- [ ] Fuzzy matching suggests existing catalog items

### Item Management
- [ ] Check/uncheck item
- [ ] Checked items move to "Checked" section
- [ ] Edit item quantity
- [ ] Edit item notes
- [ ] Delete item from list
- [ ] Change item category

### Category System
- [ ] All 12 categories display:
  - Frugt & Grønt
  - Mejeri & Æg
  - Kød & Fisk
  - Pålæg & Deli
  - Brød & Bageri
  - Kolonial
  - Frost
  - Drikkevarer
  - Snacks & Slik
  - Husholdning
  - Personlig pleje
  - Andet
- [ ] Items grouped by category
- [ ] Category icons (emojis) display
- [ ] Can reorder categories (admin)
- [ ] Category keyword matching works

### Shopping Mode
- [ ] Start shopping button
- [ ] List status changes to "shopping"
- [ ] Items sortable by store layout
- [ ] Finish shopping button
- [ ] List marked as completed
- [ ] Actual total calculated

### Store Management (Admin)
- [ ] View store chains (11 Danish chains)
- [ ] Add store location
- [ ] Set store as primary
- [ ] Configure category order per store
- [ ] Store layout saves

### Item Catalog (Admin)
- [ ] Search items
- [ ] Add new catalog item
  - [ ] Name
  - [ ] Category
  - [ ] Default unit
  - [ ] Default price
  - [ ] Aliases
- [ ] Edit catalog item
- [ ] Delete catalog item (usage check)

### Cost Tracking
- [ ] Estimated total updates as items added
- [ ] Actual total after shopping
- [ ] Item prices editable

### Offline Support (PWA)
- [ ] App works when offline
- [ ] Changes sync when back online
- [ ] Offline banner shows/hides appropriately

---

## Edge Cases & Error Handling

### Input Parsing
- [ ] Handles spaces in item names
- [ ] Handles special characters (æ, ø, å)
- [ ] Recognizes various units (stk, kg, g, l, ml, pk)
- [ ] Handles duplicate items (shows warning)

### Validation
- [ ] Cannot create list without name
- [ ] Cannot delete category with items
- [ ] Quantity must be positive number

### Performance
- [ ] List with 50+ items loads < 2 seconds
- [ ] Quick-add response < 500ms
- [ ] Search results appear while typing

---

## API Endpoint Tests

```bash
# Health check
curl -s https://grablist.org/api/health | jq .

# Get lists
curl -s https://grablist.org/api/lists | jq '.[].name'

# Get categories
curl -s https://grablist.org/api/categories | jq '.[].name'

# Search items
curl -s "https://grablist.org/api/items/search?q=mælk" | jq '.[].name'

# Category suggestion
curl -s "https://grablist.org/api/categories/suggest?q=ost" | jq .
```

---

## Playwright Test Outline

```javascript
// e2e/grablist.spec.js
import { test, expect } from '@playwright/test';

test.describe('Grablist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://grablist.org');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Grablist|Indkøbsliste/);
  });

  test('can add item via quick-add', async ({ page }) => {
    await page.fill('[data-testid="quick-add"]', 'mælk');
    await page.press('[data-testid="quick-add"]', 'Enter');

    await expect(page.locator('.list-item:has-text("mælk")')).toBeVisible();
  });

  test('can add multiple items', async ({ page }) => {
    await page.fill('[data-testid="quick-add"]', 'æg 6 stk + brød + ost');
    await page.press('[data-testid="quick-add"]', 'Enter');

    await expect(page.locator('.list-item')).toHaveCount(3);
  });

  test('can check item off', async ({ page }) => {
    // Add an item first
    await page.fill('[data-testid="quick-add"]', 'test item');
    await page.press('[data-testid="quick-add"]', 'Enter');

    // Check it off
    await page.click('.list-item:has-text("test item") [data-action="check"]');

    // Should be in checked section
    await expect(page.locator('.checked-items .list-item')).toContainText('test item');
  });

  test('categories display correctly', async ({ page }) => {
    await expect(page.locator('.category')).toHaveCount(12);
  });
});
```

---

## Test Data Requirements

- At least one active shopping list
- Items distributed across multiple categories
- At least one completed shopping trip in history

---

## Known Issues / Skip Conditions

- Single-user MVP - no multi-user tests needed
- Offline tests require service worker support
- Danish text in all UI elements
