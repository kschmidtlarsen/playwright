# E2E Test Checklists

Comprehensive test checklists for all production sites. These serve as:
1. **Manual testing guides** - Step-by-step verification during deployments
2. **Playwright test blueprints** - Specifications for automated E2E tests
3. **Feature documentation** - Reference for site capabilities

---

## Quick Reference

| Site | URL | Auth | Key Features |
|------|-----|------|--------------|
| [Kanban](kanban.md) | kanban.exe.pm | Cloudflare Access | Project boards, cards, drag-drop, real-time |
| [WODForge](wodforge.md) | wodforge.exe.pm | JWT (optional) | AI workout generation, timers, benchmarks |
| [Grablist](grablist.md) | grablist.org | None (MVP) | Shopping lists, Danish UI, PWA |
| [Sorring 3D](sorring3d.md) | sorring3d.dk | JWT (admin) | 3D print orders, email, gallery |
| [Sorring Udlejning](sorring-udlejning.md) | sorringudlejning.dk | JWT (admin) | Tool rental, i18n, campaign |
| [Calify](calify.md) | calify.it | JWT + OAuth | iCal feeds, subscriptions, Stripe |

---

## Smoke Test Commands

Quick health checks for all sites:

```bash
#!/bin/bash
# Run all smoke tests

sites=(
  "https://kanban.exe.pm/api/health"
  "https://wodforge.exe.pm/api/health"
  "https://grablist.org/api/health"
  "https://sorring3d.dk/api/health"
  "https://sorringudlejning.dk/api/health"
  "https://calify.it/api/health"
)

for url in "${sites[@]}"; do
  echo -n "$url: "
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$response" == "200" ]; then
    echo "✅ OK"
  else
    echo "❌ FAILED ($response)"
  fi
done
```

---

## Test Categories

### Smoke Tests
Run on every deployment. Must pass before going live.
- Health endpoint responds
- Homepage loads
- No console errors

### Core Feature Tests
Main functionality verification.
- CRUD operations
- Form submissions
- Navigation flows

### Admin Tests
Backend/admin panel verification.
- Authentication
- Data management
- Settings

### Edge Cases
Error handling and boundary conditions.
- Validation errors
- Network failures
- Performance limits

---

## Running Playwright Tests

### Setup
```bash
cd /data/websites/{project}/backend
npm install
npx playwright install
```

### Run Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/smoke.spec.js

# Run with UI
npm run test:e2e:ui

# Against production
E2E_BASE_URL=https://{domain} npm run test:e2e
```

### Upload Results to Dashboard
```bash
# After test run
node scripts/upload-results.js {project}
```

---

## Test Data Management

Each site needs appropriate test data. See individual checklists for requirements.

### Common Test Accounts
Store in environment variables or secrets:
- `TEST_EMAIL` - Test user email
- `TEST_PASSWORD` - Test user password
- `ADMIN_EMAIL` - Admin account email
- `ADMIN_PASSWORD` - Admin account password

### Data Reset
Before running full test suite, consider:
1. Creating fresh test data
2. Using test-specific accounts
3. Cleaning up after tests

---

## Integration with CI/CD

### GitHub Actions
Tests run automatically on:
- Push to main branch
- Pull requests
- Manual trigger

### Vercel Preview Deployments
For PRs, tests run against preview URLs:
```
https://{project}-{branch}-{owner}.vercel.app
```

### Test Dashboard
Results uploaded to: https://playwright.exe.pm

---

## Adding New Tests

1. **Update checklist** - Add test cases to relevant `.md` file
2. **Create Playwright spec** - Add `e2e/{feature}.spec.js`
3. **Update CI config** - Ensure new tests run in pipeline
4. **Document test data** - Note any required setup

---

## Checklist Template

When creating tests for a new site:

```markdown
# {Site Name} - E2E Test Checklist

**URL:** https://{domain}
**Auth:** {auth method}
**Tech:** {tech stack}

---

## Smoke Tests (Run on every deployment)
- [ ] Health endpoint
- [ ] Page loads
- [ ] No console errors

## Core Feature Tests
- [ ] Feature 1
- [ ] Feature 2

## Admin Tests
- [ ] Login
- [ ] CRUD operations

## Edge Cases
- [ ] Error handling
- [ ] Validation
```

---

## Maintenance

- Update checklists when features change
- Add new test cases for bug fixes
- Remove obsolete tests
- Keep API endpoint tests current
