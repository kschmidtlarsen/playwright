# Sorring Udlejning - E2E Test Checklist

**URL:** https://sorringudlejning.dk
**Auth:** JWT (admin only, httpOnly cookies)
**Tech:** Express + PostgreSQL + OpenAI (optional)
**Language:** Danish/English (i18n)

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200
- [ ] Homepage loads without errors
- [ ] No console errors on page load
- [ ] PWA manifest loads

### Basic Functionality
- [ ] Hero section displays
- [ ] Featured tools carousel visible
- [ ] Category chips functional
- [ ] Language toggle works

---

## Public Features Tests

### Homepage
- [ ] Hero section with search
- [ ] Featured tools carousel
- [ ] Category filter chips
- [ ] Campaign banner (if enabled)
- [ ] Contact section

### Language Toggle
- [ ] Switch Danish → English
- [ ] All text updates to English
- [ ] Switch English → Danish
- [ ] Preference persists (localStorage)
- [ ] URL remains the same

### Theme Toggle
- [ ] Switch Light → Dark
- [ ] Colors update correctly
- [ ] Gold accent (#FFC107) consistent
- [ ] Preference persists
- [ ] System preference detection (auto)

### Tools Listing Page
- [ ] All tools display
- [ ] Grid/List view toggle
- [ ] Category filter works
- [ ] Availability filter works
- [ ] Sort options (price, name, date)
- [ ] Search by name
- [ ] Search by description
- [ ] Pagination (if many tools)

### Tool Detail Page
- [ ] Tool info displays:
  - [ ] Name (DA/EN)
  - [ ] Manufacturer
  - [ ] Description (DA/EN)
  - [ ] Daily rate (DKK)
  - [ ] Availability status
- [ ] Image gallery:
  - [ ] Primary image
  - [ ] Thumbnails
  - [ ] Lightbox mode
  - [ ] Keyboard navigation (arrows, ESC)
- [ ] Contact form:
  - [ ] Pre-filled with tool name
  - [ ] Name field (required)
  - [ ] Email field (required)
  - [ ] Phone (optional)
  - [ ] Date from/to
  - [ ] Message
  - [ ] Disabled if tool unavailable

### Contact Form Submission
- [ ] Form validation:
  - [ ] Name required
  - [ ] Email required (valid format)
  - [ ] Date range valid
- [ ] Submit inquiry
- [ ] Success message displayed
- [ ] Confirmation email sent to customer
- [ ] Notification email sent to owner

### Categories
- [ ] All categories load
- [ ] Filter tools by category
- [ ] Category names in both languages

### Campaign Banner
- [ ] Displays when enabled
- [ ] Heading/description show
- [ ] CTA button links correctly
- [ ] Background image loads

---

## Admin Features Tests

### Admin Authentication
- [ ] `/admin` shows login page
- [ ] Login with valid credentials
- [ ] Invalid credentials error
- [ ] Session persists (httpOnly cookie)
- [ ] Auth check endpoint works
- [ ] Logout clears session
- [ ] CSRF protection (X-Requested-With header)

### Dashboard
- [ ] Statistics show:
  - [ ] Total tools
  - [ ] Available tools
  - [ ] Total categories
  - [ ] Contact submissions

### Tool Management
- [ ] Tool list displays
- [ ] Add new tool:
  - [ ] Name (DA/EN)
  - [ ] Manufacturer
  - [ ] Description (DA/EN)
  - [ ] Daily rate
  - [ ] Condition
  - [ ] Categories (multi-select)
  - [ ] Featured flag
  - [ ] Availability toggle
- [ ] Image upload:
  - [ ] Drag-and-drop
  - [ ] Set primary image
  - [ ] Reorder images
  - [ ] Delete image
- [ ] Edit existing tool
- [ ] Delete tool (confirmation)
- [ ] AI features (if OpenAI configured):
  - [ ] Auto-translate DA ↔ EN
  - [ ] Generate description

### Category Management
- [ ] Category list displays
- [ ] Add category:
  - [ ] Name (DA)
  - [ ] Name (EN)
  - [ ] Description (DA/EN)
- [ ] Edit category
- [ ] Delete category (usage check)
- [ ] Reorder categories

### Contact Submissions
- [ ] Submission list displays
- [ ] Filter by status (new/read/responded/closed)
- [ ] View submission details:
  - [ ] Customer info
  - [ ] Requested tools
  - [ ] Date range
  - [ ] Message
- [ ] Update status
- [ ] Delete submission

### Settings
- [ ] Campaign banner settings:
  - [ ] Enable/disable
  - [ ] Heading (DA/EN)
  - [ ] Description (DA/EN)
  - [ ] CTA text/link
  - [ ] Background image upload
- [ ] Placeholder image upload
- [ ] API keys (OpenAI)

### Profile Management
- [ ] Update password
- [ ] Update email

---

## Edge Cases & Error Handling

### Responsive Design
- [ ] Mobile view (< 768px)
- [ ] Tablet view (768-1024px)
- [ ] Desktop view (1024-1920px)
- [ ] Ultrawide view (> 2560px)

### Image Handling
- [ ] Placeholder for tools without images
- [ ] Max 5MB image upload
- [ ] Only image types accepted
- [ ] Gallery handles missing images

### Rate Limiting
- [ ] Contact form: 5 submissions/hour/IP
- [ ] General API: 100 requests/15 min

### Validation
- [ ] Email format validation
- [ ] Date range logical (from < to)
- [ ] Daily rate positive number

---

## API Endpoint Tests

```bash
# Health check
curl -s https://sorringudlejning.dk/api/health | jq .

# Get tools
curl -s https://sorringudlejning.dk/api/tools | jq '.[].name_da'

# Get tool by slug
curl -s https://sorringudlejning.dk/api/tools/slug/borehammer | jq .

# Get categories
curl -s https://sorringudlejning.dk/api/tools/categories/all | jq '.[].name_da'

# Get config
curl -s https://sorringudlejning.dk/api/config | jq .

# Get campaign
curl -s https://sorringudlejning.dk/api/config/campaign | jq .

# Submit contact (test)
curl -X POST https://sorringudlejning.dk/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Test inquiry"}'
```

---

## Playwright Test Outline

```javascript
// e2e/sorring-udlejning.spec.js
import { test, expect } from '@playwright/test';

test.describe('Sorring Udlejning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://sorringudlejning.dk');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Sorring|Udlejning/);
  });

  test('language toggle works', async ({ page }) => {
    // Check Danish by default
    await expect(page.locator('html')).toHaveAttribute('lang', 'da');

    // Switch to English
    await page.click('[data-action="toggle-language"]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('theme toggle works', async ({ page }) => {
    // Get initial theme
    const html = page.locator('html');

    // Toggle theme
    await page.click('[data-action="toggle-theme"]');
    // Verify theme class changed
  });

  test('can browse tools', async ({ page }) => {
    await page.click('a:has-text("Værktøj")');
    await expect(page.locator('.tool-card')).toHaveCount.greaterThan(0);
  });

  test('category filter works', async ({ page }) => {
    await page.click('a:has-text("Værktøj")');
    await page.click('.category-chip:first-child');

    // Tools should be filtered
    await expect(page.locator('.tool-card')).toHaveCount.greaterThan(0);
  });

  test('tool detail page loads', async ({ page }) => {
    await page.click('.tool-card:first-child a');

    await expect(page.locator('.tool-detail')).toBeVisible();
    await expect(page.locator('.contact-form')).toBeVisible();
  });

  test('lightbox opens on image click', async ({ page }) => {
    await page.click('.tool-card:first-child a');
    await page.click('.tool-gallery img');

    await expect(page.locator('.lightbox')).toBeVisible();

    // Close with ESC
    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox')).not.toBeVisible();
  });
});

test.describe('Sorring Udlejning Admin', () => {
  test('admin login page accessible', async ({ page }) => {
    await page.goto('https://sorringudlejning.dk/admin.html');
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });

  // Note: Full admin tests require credentials
});
```

---

## Test Data Requirements

- Admin test account
- At least 5 tools with images
- Tools across multiple categories
- At least one unavailable tool
- Contact submissions in various statuses
- Campaign banner configured (enabled and disabled states)

---

## Known Issues / Skip Conditions

- OpenAI tests require API key
- Email tests require SMTP configured
- Admin tests require valid credentials
- Rate limiting may affect rapid test runs
