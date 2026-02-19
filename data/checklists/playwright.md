# Playwright Dashboard - E2E Test Checklist

**URL:** https://playwright.exe.pm
**Auth:** None (Cloudflare Access protected)
**Tech:** Express + PostgreSQL + Vercel Serverless

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200 with `{"status":"ok"}`
- [ ] Dashboard homepage loads without errors
- [ ] No console errors on page load

### Basic Dashboard Display
- [ ] Summary cards section displays
- [ ] Test Results section displays
- [ ] Run History section displays
- [ ] Connection status indicator shows connected (green dot)

---

## Core Feature Tests

### Project Cards
- [ ] All tracked projects show as cards
- [ ] Each card shows project name
- [ ] Status badge displays (passed/failed/unknown)
- [ ] Stats show: Passed, Failed, Skipped, Total counts
- [ ] Last run timestamp displays
- [ ] "Run Tests" button links to GitHub Actions

### Project Filter
- [ ] Filter dropdown lists all projects
- [ ] Selecting a project filters the results
- [ ] "All Projects" option shows all results

### Status Filter
- [ ] Filter dropdown has: All Status, Passed, Failed, Skipped
- [ ] Selecting filters tests by status

### Test Results Section
- [ ] Project headers show with pass/fail/skip counts
- [ ] Clicking project header expands/collapses test list
- [ ] Tests display with status icon (checkmark/cross/circle)
- [ ] Test duration shows in milliseconds
- [ ] Click test to expand details panel
  - [ ] Test description shows (if available)
  - [ ] File path and line number display
  - [ ] Error messages show for failed tests

### Run History Section
- [ ] Recent runs from all projects display
- [ ] Each history card shows:
  - [ ] Project name
  - [ ] Timestamp (relative time format)
  - [ ] Pass/fail/skip counts

---

## API Endpoint Tests

### Results API
- [ ] `GET /api/projects` - Lists all tracked projects
- [ ] `GET /api/results` - Returns summary for all projects
- [ ] `GET /api/results/:projectId` - Returns detailed results for project
- [ ] `GET /api/history/:projectId` - Returns run history for project
- [ ] `GET /api/poll` - Returns update check with `hasUpdates` flag

### Upload API
- [ ] `POST /api/upload/:projectId` - Accepts JSON test results
- [ ] Validates project ID (alphanumeric, hyphens, max 100 chars)
- [ ] Rejects invalid project IDs with 400

---

## UI Interactions

### Polling & Refresh
- [ ] Auto-refresh indicator visible (green dot when connected)
- [ ] Manual refresh button updates data
- [ ] Toast notification shows on refresh

### Responsive Design
- [ ] Dashboard displays correctly on desktop (1400px+)
- [ ] Cards stack properly on tablet (768px-1400px)
- [ ] Mobile layout works (< 768px)
  - [ ] Header stacks vertically
  - [ ] Filter dropdowns full width

---

## Manual Testing API

### Checklist Endpoints
- [ ] `GET /api/manual/checklists` - Lists available checklists
- [ ] `GET /api/manual/checklists/:projectId` - Returns checklist items

### Session Management
- [ ] `POST /api/manual/sessions` - Creates new test session
- [ ] `GET /api/manual/sessions` - Lists active sessions
- [ ] `GET /api/manual/sessions/:id` - Returns session details

---

## Edge Cases

### No Data State
- [ ] Empty state message shows when no test results
- [ ] "No tests run yet" displays for projects without runs

### Error Handling
- [ ] Failed API call shows toast error
- [ ] Connection lost updates status indicator to red
- [ ] Invalid project ID in URL handled gracefully

---

## Running Playwright Tests

```bash
cd /data/websites/playwright/backend
npm run test:e2e
```

**Against production:**
```bash
E2E_BASE_URL=https://playwright.exe.pm npm run test:e2e
```
