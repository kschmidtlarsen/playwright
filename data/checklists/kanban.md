# Kanban Board - E2E Test Checklist

**URL:** https://kanban.exe.pm
**Auth:** None (Cloudflare Access protected)
**Tech:** Express + PostgreSQL + Socket.IO

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200 with `{"status":"ok"}`
- [ ] Homepage loads without errors
- [ ] No console errors on page load

### Basic Board Functionality
- [ ] Board displays with columns visible
- [ ] Cards render in correct columns
- [ ] Project selector appears and is functional

---

## Core Feature Tests

### Project Management
- [ ] Can switch between projects using selector
- [ ] Board filters to show only selected project's cards
- [ ] Can create a new project
  - [ ] Enter project name
  - [ ] Select color
  - [ ] Project appears in selector
- [ ] Can edit project name/color
- [ ] Can delete project (with confirmation)

### Column Display
- [ ] All 5 columns visible: Backlog, Discovered, In Development, Done, Cancelled
- [ ] Column headers display correctly
- [ ] Card counts show per column

### Card Creation
- [ ] Click "Add Card" or "+" button
- [ ] Modal opens for new card
- [ ] Enter card title (required)
- [ ] Enter description (optional)
- [ ] Select priority: High/Medium/Low
- [ ] Select type: Feature/Bug/Enhancement/Chore/Docs
- [ ] Set story points (optional)
- [ ] Card appears in Backlog column after save

### Card Editing
- [ ] Click card to open detail view
- [ ] Edit title - saves correctly
- [ ] Edit description - Markdown renders
- [ ] Change priority - badge updates
- [ ] Change type - label updates
- [ ] Add/edit acceptance criteria
  - [ ] Criteria can be checked/unchecked
  - [ ] Progress shows X/Y completed
- [ ] Add code references (URLs)
- [ ] Edit development checklist items

### Card Movement (Drag & Drop)
- [ ] Drag card within same column - reorders
- [ ] Drag card to different column - moves
- [ ] Position persists after page refresh
- [ ] Moving to "Done" column works
- [ ] Moving to "Cancelled" column works

### Card Actions
- [ ] Duplicate card - creates copy
- [ ] Delete card - confirms then removes
- [ ] Card history shows changes

### Real-time Updates (Socket.IO)
- [ ] Open board in two browser tabs
- [ ] Create card in Tab A - appears in Tab B
- [ ] Move card in Tab A - updates in Tab B
- [ ] Edit card in Tab A - reflects in Tab B

### Statistics
- [ ] Stats page loads
- [ ] Shows cards by status
- [ ] Time range filter works (6 months, 3 months, etc.)
- [ ] Charts display correctly

---

## Edge Cases & Error Handling

### Validation
- [ ] Cannot create card without title
- [ ] Long titles truncate properly in board view
- [ ] Special characters in titles handled correctly

### Performance
- [ ] Board loads with 50+ cards < 3 seconds
- [ ] Drag and drop remains responsive
- [ ] No memory leaks after extended use

### Offline Behavior
- [ ] Shows appropriate message when API unavailable
- [ ] Recovers when connection restored

---

## API Endpoint Tests

```bash
# Health check
curl -s https://kanban.exe.pm/api/health | jq .

# Get board
curl -s https://kanban.exe.pm/api/board | jq '.projects | length'

# Get cards
curl -s https://kanban.exe.pm/api/board/cards | jq 'length'

# Get columns
curl -s https://kanban.exe.pm/api/board/columns | jq '.[].name'

# Get stats
curl -s "https://kanban.exe.pm/api/board/stats?projectId=kanban&range=3months" | jq .
```

---

## Playwright Test Outline

```javascript
// e2e/kanban.spec.js
import { test, expect } from '@playwright/test';

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://kanban.exe.pm');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Kanban/);
    await expect(page.locator('.board')).toBeVisible();
  });

  test('smoke: columns visible', async ({ page }) => {
    await expect(page.locator('.column')).toHaveCount(5);
  });

  test('can create card', async ({ page }) => {
    await page.click('[data-action="add-card"]');
    await page.fill('input[name="title"]', 'Test Card');
    await page.click('button[type="submit"]');
    await expect(page.locator('.card:has-text("Test Card")')).toBeVisible();
  });

  test('can drag card between columns', async ({ page }) => {
    const card = page.locator('.card').first();
    const targetColumn = page.locator('.column[data-id="in-development"]');
    await card.dragTo(targetColumn);
    await expect(targetColumn.locator('.card').first()).toBeVisible();
  });
});
```

---

## Test Data Requirements

- At least 2 projects with different colors
- At least 5 cards per project distributed across columns
- Cards with various priorities and types
- Cards with acceptance criteria (some completed)

---

## Known Issues / Skip Conditions

- Skip drag-drop tests on mobile viewports (not supported)
- Socket.IO tests require special handling for WebSocket connections
