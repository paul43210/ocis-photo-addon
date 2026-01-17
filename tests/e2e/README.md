# E2E Tests

End-to-end tests for the oCIS Photo Addon using Playwright.

## Prerequisites

### System Dependencies

Chromium requires system libraries. Install them with:

```bash
# Ubuntu/Debian
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libpango-1.0-0 libcairo2

# Or use Playwright's built-in installer (requires sudo)
npx playwright install-deps chromium
```

### Environment Variables

Set the following environment variables before running tests:

```bash
export OCIS_URL="https://cloud.faure.ca"  # Optional, defaults to cloud.faure.ca
export OCIS_USER="admin"                   # Optional, defaults to admin
export OCIS_PASSWORD="your-password"       # Required
```

## Running Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with browser UI visible
pnpm test:e2e:headed

# Run with Playwright UI (interactive)
pnpm test:e2e:ui

# Debug mode (step through tests)
pnpm test:e2e:debug
```

## Test Structure

- `global-setup.ts` - Authenticates once and saves session state
- `fixtures.ts` - Test fixtures with authenticated context
- `photo-gallery.spec.ts` - Photo gallery loading and display tests
- `lightbox.spec.ts` - Lightbox viewer functionality tests
- `map-view.spec.ts` - Map view and marker tests

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Writing New Tests

Import the custom fixtures to get authenticated context:

```typescript
import { test, expect } from './fixtures'

test('my test', async ({ page }) => {
  await page.goto('/files/spaces/personal/home')
  // ... test code
})
```

## CI/CD

For CI environments, ensure:
1. System dependencies are installed
2. `OCIS_PASSWORD` is set as a secret
3. Tests run with `pnpm test:e2e`
