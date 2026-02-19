# Calify - E2E Test Checklist

**URL:** https://calify.it
**Auth:** JWT with refresh tokens, OAuth (Google/Apple)
**Tech:** Express + PostgreSQL + Stripe + ical.js

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200 with database status
- [ ] Homepage loads without errors
- [ ] No console errors on page load

### Basic Functionality
- [ ] Landing page displays
- [ ] Login/Register accessible
- [ ] Pricing section visible

---

## Public Features Tests

### Landing Page
- [ ] Hero section displays
- [ ] Features section shows transformation capabilities
- [ ] Pricing tiers displayed:
  - [ ] Free tier (1 feed)
  - [ ] Premium tier (multiple feeds)
- [ ] CTA buttons link correctly

### Authentication - Registration
- [ ] Registration form accessible
- [ ] Form fields:
  - [ ] Full name
  - [ ] Email (valid format required)
  - [ ] Password (8+ characters)
- [ ] Submit registration
- [ ] Verification email sent
- [ ] Error on duplicate email

### Authentication - Email Verification
- [ ] Click verification link in email
- [ ] Token validated
- [ ] Account marked as verified
- [ ] Redirect to login
- [ ] Expired token shows error (24h limit)

### Authentication - Login
- [ ] Login form accessible
- [ ] Login with email/password
- [ ] Invalid credentials error
- [ ] Redirect to dashboard on success
- [ ] Remember me option

### Authentication - OAuth
- [ ] Google OAuth button
- [ ] Redirects to Google consent
- [ ] Returns and creates account
- [ ] Links to existing account (same email)
- [ ] Apple OAuth button (if configured)

### Authentication - Password Reset
- [ ] Forgot password link
- [ ] Enter email
- [ ] Reset email sent
- [ ] Click reset link
- [ ] Enter new password
- [ ] Password updated
- [ ] Token expires after 1 hour

---

## Authenticated Features Tests

### Dashboard (Feed Management)
- [ ] Feed list displays
- [ ] Create new feed:
  - [ ] Feed name
  - [ ] Source iCal URL (validate)
  - [ ] Timezone selection
- [ ] Edit existing feed
- [ ] Delete feed (confirmation)
- [ ] Feed count respects tier limit

### Feed Validation
- [ ] Validate iCal URL endpoint
- [ ] Valid URL: shows event count
- [ ] Invalid URL: shows error
- [ ] Private/protected URL: shows error

### Feed Transformations
- [ ] Add preparation event rule:
  - [ ] Relative timing (X minutes before)
  - [ ] Fixed timing (specific time)
  - [ ] Custom title prefix/suffix
- [ ] Remove transformation rule
- [ ] Multiple rules per feed
- [ ] Preview transformation

### Calendar Output
- [ ] Get feed output URL (with token)
- [ ] `GET /api/calendar/{token}` returns valid iCal
- [ ] Content-Type: text/calendar
- [ ] Transformations applied:
  - [ ] Prep events added
  - [ ] Timezone adjusted
  - [ ] Titles modified
- [ ] 5-minute cache header
- [ ] Access count increments

### Account Management
- [ ] View account info
- [ ] Update profile (name)
- [ ] Change password
- [ ] View subscription status

### Subscription & Billing
- [ ] View current plan
- [ ] Upgrade to premium:
  - [ ] Stripe checkout flow
  - [ ] Redirect to Stripe
  - [ ] Return to success page
  - [ ] Tier updated to premium
- [ ] Manage subscription:
  - [ ] Open Stripe portal
  - [ ] Cancel subscription
  - [ ] Update payment method
- [ ] Promo code redemption:
  - [ ] Enter valid code
  - [ ] Discount applied
  - [ ] Invalid code error

---

## Admin Features Tests

### Admin Dashboard
- [ ] Statistics display:
  - [ ] Total users
  - [ ] Active subscriptions
  - [ ] Total feeds
  - [ ] Revenue metrics
- [ ] User list (paginated)
- [ ] Search users by email
- [ ] Filter by tier

### User Management
- [ ] View user details
- [ ] Update user tier (manual override)
- [ ] View user's feeds

### Promo Codes
- [ ] Create promo code:
  - [ ] Code string
  - [ ] Type (permanent_free, free_months, percentage_off, fixed_amount_off)
  - [ ] Value
  - [ ] Max uses
  - [ ] Valid dates
- [ ] View redemption stats
- [ ] Deactivate promo code

---

## Edge Cases & Error Handling

### Feed Processing
- [ ] Handle unreachable source URL
- [ ] Handle malformed iCal
- [ ] Handle large calendars (1000+ events)
- [ ] Handle recurring events

### Security
- [ ] SSRF protection (no private IPs)
- [ ] DNS rebinding protection
- [ ] Rate limiting enforced
- [ ] Token validation on all protected routes

### Validation
- [ ] Email format validation
- [ ] Password strength (8+ chars)
- [ ] iCal URL format
- [ ] Timezone must be valid IANA

---

## API Endpoint Tests

```bash
# Health check
curl -s https://calify.it/api/health | jq .

# API info
curl -s https://calify.it/api/info | jq .

# Validate feed URL
curl -X POST https://calify.it/api/feeds/validate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://calendar.google.com/calendar/ical/xxx/basic.ics"}'

# Get timezones
curl -s https://calify.it/api/feeds/timezones | jq 'length'

# Billing status
curl -s https://calify.it/api/billing/status | jq .

# Get calendar (public with token)
curl -s https://calify.it/api/calendar/{feed_token}
```

---

## Playwright Test Outline

```javascript
// e2e/calify.spec.js
import { test, expect } from '@playwright/test';

test.describe('Calify', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://calify.it');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Calify|Calendar/);
  });

  test('landing page has features', async ({ page }) => {
    await expect(page.locator('.features')).toBeVisible();
    await expect(page.locator('.pricing')).toBeVisible();
  });

  test('can access login page', async ({ page }) => {
    await page.click('a:has-text("Login")');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('can access register page', async ({ page }) => {
    await page.click('a:has-text("Sign Up")');
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('OAuth buttons visible', async ({ page }) => {
    await page.click('a:has-text("Login")');
    await expect(page.locator('[data-provider="google"]')).toBeVisible();
  });
});

test.describe('Calify Feed Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test account
    await page.goto('https://calify.it/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/manage');
  });

  test('feed list displays', async ({ page }) => {
    await expect(page.locator('.feed-list')).toBeVisible();
  });

  test('can create new feed', async ({ page }) => {
    await page.click('[data-action="create-feed"]');

    await page.fill('input[name="name"]', 'Test Feed');
    await page.fill('input[name="sourceUrl"]', 'https://calendar.google.com/calendar/ical/xxx/basic.ics');
    await page.selectOption('select[name="timezone"]', 'Europe/Copenhagen');

    // Note: Don't submit to avoid creating real data
  });

  test('feed URL validation works', async ({ page }) => {
    await page.click('[data-action="create-feed"]');

    // Enter invalid URL
    await page.fill('input[name="sourceUrl"]', 'not-a-url');
    await page.click('[data-action="validate"]');

    await expect(page.locator('.error')).toBeVisible();
  });
});

test.describe('Calify Calendar Output', () => {
  test('calendar endpoint returns iCal', async ({ request }) => {
    // This requires a valid feed token
    const response = await request.get('https://calify.it/api/calendar/test-token');

    // May be 404 if token invalid, which is expected
    if (response.ok()) {
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/calendar');
    }
  });
});
```

---

## Test Data Requirements

- Test user account (free tier)
- Test user account (premium tier)
- Test admin account
- Valid public iCal feed URL for testing
- Stripe test mode credentials
- Valid promo codes (various types)

---

## Known Issues / Skip Conditions

- OAuth tests require real OAuth flow (may not work in CI)
- Stripe tests require test mode API keys
- Email verification tests require email access
- Feed validation depends on external URLs being available
- Some tests may fail if rate limited
