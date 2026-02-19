# Sorring 3D - E2E Test Checklist

**URL:** https://sorring3d.dk
**Auth:** JWT (admin only)
**Tech:** Express + PostgreSQL + Resend (email)
**Language:** Danish UI

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200
- [ ] Homepage loads without errors
- [ ] No console errors on page load
- [ ] Hero section with gallery displays

### Basic Functionality
- [ ] Materials section visible
- [ ] Order form accessible
- [ ] Gallery carousel works

---

## Public Features Tests

### Homepage
- [ ] Hero section displays
- [ ] Showcase gallery images load
- [ ] Gallery carousel navigates (left/right arrows)
- [ ] Materials section shows PLA, PETG, ABS
- [ ] Pricing per gram displayed
- [ ] Contact section visible

### Materials & Pricing
- [ ] `GET /api/materials` returns active materials
- [ ] Each material shows:
  - [ ] Name (PLA, PETG, ABS)
  - [ ] Price per gram
  - [ ] Description
  - [ ] Properties list

### Color Selection
- [ ] `GET /api/colors` returns available colors
- [ ] Colors grouped by material
- [ ] Color swatches display

### Gallery
- [ ] `GET /api/gallery` returns gallery items
- [ ] Showcase items on homepage
- [ ] Full gallery accessible
- [ ] Images load correctly
- [ ] Prices display (where set)

### Order Submission
- [ ] Order form fields:
  - [ ] Customer name (required)
  - [ ] Email (required, valid format)
  - [ ] Phone (optional)
  - [ ] Material selection (dropdown)
  - [ ] Color request (text)
  - [ ] Quantity (number)
  - [ ] Delivery method (pickup/shipping)
  - [ ] Shipping address (if shipping selected)
  - [ ] Notes (optional)
- [ ] File upload:
  - [ ] Accepts .stl, .obj, .3mf files
  - [ ] Max 50MB file size
  - [ ] Multiple files allowed
- [ ] URL reference:
  - [ ] Can add URL instead of file
  - [ ] Valid URL format required
- [ ] Submit order:
  - [ ] Validation errors show
  - [ ] Success message on submit
  - [ ] Order confirmation email sent

---

## Admin Features Tests

### Admin Authentication
- [ ] `/admin` redirects to login if not authenticated
- [ ] Login form:
  - [ ] Email field
  - [ ] Password field
  - [ ] Remember me checkbox
- [ ] Valid credentials log in
- [ ] Invalid credentials show error
- [ ] Brute force lockout after 3 failed attempts
- [ ] Logout works
- [ ] Session persists on refresh

### Admin Dashboard
- [ ] Statistics display:
  - [ ] Total orders
  - [ ] Orders by status
  - [ ] Pending orders count
- [ ] Quick actions accessible

### Order Management
- [ ] Order list loads
- [ ] Filter by status (pending/quoted/paid/completed/cancelled)
- [ ] View order details
- [ ] Download uploaded files
- [ ] Update order status:
  - [ ] Pending → Quoted (enter price, send email)
  - [ ] Quoted → Paid (manual confirmation)
  - [ ] Paid → Completed (send notification)
  - [ ] Any → Cancelled (with reason)
- [ ] Add admin notes
- [ ] Generate Stripe payment link
- [ ] Email sent on status change

### Filament Management
- [ ] Filament inventory list
- [ ] Add new filament:
  - [ ] Material type
  - [ ] Color name
  - [ ] Color hex code
  - [ ] Stock quantity
  - [ ] Cost per kg
- [ ] Edit filament details
- [ ] Deactivate filament (soft delete)
- [ ] Stock levels update

### Material Management
- [ ] Material types list
- [ ] Add new material:
  - [ ] Name
  - [ ] Display name
  - [ ] Price per gram
  - [ ] Description
  - [ ] Properties
- [ ] Edit material
- [ ] Deactivate material
- [ ] Reactivate material

### Gallery Management
- [ ] Gallery items list
- [ ] Add gallery item:
  - [ ] Upload image (max 10MB)
  - [ ] Title
  - [ ] Description
  - [ ] Price (optional)
  - [ ] Showcase flag
- [ ] Edit gallery item
- [ ] Delete gallery item
- [ ] Set as showcase

### Email Conversations
- [ ] Email threads list
- [ ] Unread count badge
- [ ] View thread messages
- [ ] Send reply to customer
- [ ] Mark as read
- [ ] Update thread status (open/closed/archived)
- [ ] Link thread to order
- [ ] View participants
- [ ] Download attachments

---

## Edge Cases & Error Handling

### File Uploads
- [ ] Reject files > 50MB
- [ ] Reject non-allowed file types
- [ ] Handle upload errors gracefully

### Email
- [ ] Handle Resend API unavailable
- [ ] Queue emails if service down
- [ ] Email content renders correctly

### Validation
- [ ] Email format validation
- [ ] Phone number format (optional)
- [ ] Price must be positive
- [ ] Quantity must be positive integer

---

## API Endpoint Tests

```bash
# Health check
curl -s https://sorring3d.dk/api/health | jq .

# Get materials
curl -s https://sorring3d.dk/api/materials | jq '.[].name'

# Get colors
curl -s https://sorring3d.dk/api/colors | jq .

# Get gallery
curl -s https://sorring3d.dk/api/gallery | jq 'length'

# Submit order (form-data)
curl -X POST https://sorring3d.dk/api/orders \
  -F "customerName=Test User" \
  -F "email=test@example.com" \
  -F "material=pla" \
  -F "colorRequest=Rød" \
  -F "quantity=1" \
  -F "deliveryMethod=pickup" \
  -F "file=@test-model.stl"
```

---

## Playwright Test Outline

```javascript
// e2e/sorring3d.spec.js
import { test, expect } from '@playwright/test';

test.describe('Sorring 3D', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://sorring3d.dk');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Sorring 3D|3D Print/);
  });

  test('materials section visible', async ({ page }) => {
    await expect(page.locator('.materials')).toBeVisible();
    await expect(page.locator('.material-card')).toHaveCount(3);
  });

  test('gallery carousel works', async ({ page }) => {
    await expect(page.locator('.gallery-carousel')).toBeVisible();
    await page.click('.carousel-next');
    // Verify carousel moved
  });

  test('order form validation', async ({ page }) => {
    await page.click('[data-action="submit-order"]');
    // Should show validation errors for required fields
    await expect(page.locator('.error:has-text("navn")')).toBeVisible();
    await expect(page.locator('.error:has-text("email")')).toBeVisible();
  });

  test('can fill order form', async ({ page }) => {
    await page.fill('[name="customerName"]', 'Test Bruger');
    await page.fill('[name="email"]', 'test@example.com');
    await page.selectOption('[name="material"]', 'pla');
    await page.fill('[name="colorRequest"]', 'Rød');
    await page.fill('[name="quantity"]', '1');
    await page.click('[value="pickup"]');

    // Form should be valid (not submitting to avoid real order)
    await expect(page.locator('button[type="submit"]:not(:disabled)')).toBeVisible();
  });
});

test.describe('Sorring 3D Admin', () => {
  test('admin login page accessible', async ({ page }) => {
    await page.goto('https://sorring3d.dk/admin');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  // Note: Full admin tests require test credentials
});
```

---

## Test Data Requirements

- Admin test account
- At least one order in each status
- Filaments with various colors
- Gallery items (some showcase, some not)
- Email thread with messages

---

## Known Issues / Skip Conditions

- Email tests require Resend API key configured
- File upload tests need test .stl files
- Admin tests require valid credentials
- Brute force lockout may interfere with repeated test runs
