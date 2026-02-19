# WODForge - E2E Test Checklist

**URL:** https://wodforge.exe.pm
**Auth:** JWT with refresh tokens (optional for workout generation)
**Tech:** Express + PostgreSQL + OpenAI API

---

## Smoke Tests (Run on every deployment)

### Health & Availability
- [ ] `GET /api/health` returns 200
- [ ] Homepage loads without errors
- [ ] No console errors on page load
- [ ] PWA manifest loads correctly

### Basic Functionality
- [ ] Main workout generator form visible
- [ ] Timer page accessible
- [ ] Benchmarks page loads

---

## Core Feature Tests

### Workout Generation (No Auth)
- [ ] Select experience level (Beginner/Intermediate/Advanced)
- [ ] Select duration (15-120 min slider)
- [ ] Select equipment preset from dropdown
- [ ] Select focus area (optional)
- [ ] Click "Generate Workout"
- [ ] Loading indicator shows
- [ ] Workout displays with sections:
  - [ ] Warmup (if enabled)
  - [ ] Strength (if enabled)
  - [ ] Metcon (always)
  - [ ] Finisher (if enabled)
  - [ ] Cooldown (if enabled)
- [ ] Workout name generated
- [ ] Token count displayed (admin info)

### Authentication
- [ ] Registration form accessible
- [ ] Can register with email/password
- [ ] Login form accessible
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error
- [ ] Logout works
- [ ] Token refresh happens automatically

### Timer System
- [ ] Timer types available:
  - [ ] For Time
  - [ ] AMRAP
  - [ ] EMOM
  - [ ] Tabata
  - [ ] Stations
  - [ ] Countdown
  - [ ] Stopwatch
- [ ] Can set work/rest intervals
- [ ] Start/pause/reset buttons work
- [ ] Audio cues play (10, 3, 2, 1, GO!)
- [ ] Round counter updates
- [ ] Timer saves to favorites

### Workout Logging
- [ ] Can upload whiteboard photo
- [ ] OCR processes image
- [ ] Results extracted and editable
- [ ] Can save workout to history
- [ ] Weather data captured (if location set)

### My Workouts (Authenticated)
- [ ] History list loads
- [ ] Search works (by name, movements)
- [ ] Filter by focus area works
- [ ] Filter by date range works
- [ ] Can view workout details
- [ ] PR badges display correctly

### Benchmarks
- [ ] Benchmark list loads
- [ ] Filter by category (Girls, Heroes, Open, Custom)
- [ ] Can view benchmark details
- [ ] Can log benchmark attempt
- [ ] Scoreboard shows history
- [ ] Best times highlighted

### Equipment Management (Authenticated)
- [ ] Equipment categories list
- [ ] Can add new equipment item
- [ ] Can create equipment preset
- [ ] Can set default preset

### Injury Tracking (Authenticated)
- [ ] Can add injury
- [ ] Severity scale works (1-10)
- [ ] Affected movements list
- [ ] Injuries filter workout generation

### Goals (Authenticated)
- [ ] Can add training goal
- [ ] Priority system works
- [ ] Goals influence workout generation

### Configuration
- [ ] Can update location (lat/lon)
- [ ] Auto-detect location works
- [ ] Can toggle sections (warmup, strength, etc.)
- [ ] Inclusion percentages adjustable

---

## Edge Cases & Error Handling

### API Errors
- [ ] OpenAI API timeout handled gracefully
- [ ] Invalid image upload shows error
- [ ] Network error shows retry option

### Validation
- [ ] Duration must be 15-120 minutes
- [ ] Experience level required for generation
- [ ] Login requires valid email format
- [ ] Password minimum 8 characters

### Performance
- [ ] Workout generation < 15 seconds
- [ ] History loads with 100+ workouts < 3 seconds
- [ ] Timer accurate to within 100ms

---

## API Endpoint Tests

```bash
# Health check
curl -s https://wodforge.exe.pm/api/health | jq .

# Get equipment presets (public)
curl -s https://wodforge.exe.pm/api/workouts/presets | jq '.[].name'

# Get benchmarks
curl -s https://wodforge.exe.pm/api/workouts/benchmarks | jq 'length'

# Generate workout (may require auth)
curl -X POST https://wodforge.exe.pm/api/workouts/generate \
  -H "Content-Type: application/json" \
  -d '{"experienceLevel":"intermediate","durationMinutes":30}'
```

---

## Playwright Test Outline

```javascript
// e2e/wodforge.spec.js
import { test, expect } from '@playwright/test';

test.describe('WODForge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://wodforge.exe.pm');
  });

  test('smoke: page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/WODForge|CrossFit/);
  });

  test('can generate workout', async ({ page }) => {
    await page.selectOption('[name="experienceLevel"]', 'intermediate');
    await page.fill('[name="duration"]', '30');
    await page.click('button:has-text("Generate")');

    // Wait for generation (can take up to 15s)
    await expect(page.locator('.workout-result')).toBeVisible({ timeout: 20000 });
  });

  test('timer starts and stops', async ({ page }) => {
    await page.click('a:has-text("Timer")');
    await page.click('[data-timer="fortime"]');
    await page.click('button:has-text("Start")');

    await page.waitForTimeout(2000);
    await page.click('button:has-text("Pause")');

    const display = await page.locator('.timer-display').textContent();
    expect(display).not.toBe('00:00');
  });

  test('benchmarks page loads', async ({ page }) => {
    await page.click('a:has-text("Benchmarks")');
    await expect(page.locator('.benchmark-card')).toHaveCount(39);
  });
});
```

---

## Test Data Requirements

- Test user account for authenticated tests
- At least one completed workout in history
- Equipment preset configured
- Location set for weather tests

---

## Known Issues / Skip Conditions

- OpenAI API may rate limit during heavy testing
- Whiteboard OCR accuracy varies with image quality
- Audio tests require unmuted browser context
