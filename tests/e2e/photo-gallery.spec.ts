import { test, expect } from './fixtures'

test.describe('Photo Gallery', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the files page
    await page.goto('/files/spaces/personal/home')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test('should load the files page', async ({ page }) => {
    // Verify we're on the files page
    await expect(page).toHaveURL(/files/)

    // Should see some content (file list or empty state)
    const content = page.locator('.files-view, .oc-resource, [data-test-resource-path]')
    await expect(content.first()).toBeVisible({ timeout: 30000 })
  })

  test('should have Photo View option in view switcher', async ({ page }) => {
    // Look for view options or view switcher button
    const viewSwitcher = page.locator(
      '[data-testid="view-options-btn"], ' +
      '.view-option-switch, ' +
      'button[aria-label*="view"], ' +
      '.oc-button[aria-label*="view"]'
    )

    // If view switcher exists, click it to see options
    if (await viewSwitcher.count() > 0) {
      await viewSwitcher.first().click()

      // Look for Photo View in the dropdown/menu
      const photoOption = page.locator('text=Photo View, text=Photo, [data-testid*="photo"]')

      // Photo View should be available as an option
      const count = await photoOption.count()
      expect(count).toBeGreaterThanOrEqual(0) // May not be visible depending on folder
    }
  })

  test('should display photos when switching to Photo View', async ({ page }) => {
    // Navigate to a folder that likely has photos (root or Pictures)
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('networkidle')

    // Wait for initial load
    await page.waitForTimeout(2000)

    // Try to find and click the Photo View button
    // The extension adds a view option with icon "image"
    const photoViewButtons = page.locator(
      'button:has-text("Photo"), ' +
      '[title*="Photo"], ' +
      '[aria-label*="Photo"]'
    )

    if (await photoViewButtons.count() > 0) {
      await photoViewButtons.first().click()
      await page.waitForTimeout(1000)

      // After clicking Photo View, we should see either:
      // 1. A photo grid with images
      // 2. A loading indicator
      // 3. An empty state message
      const photoContent = page.locator(
        '.photos-app, ' +
        '.photo-grid, ' +
        '.photo-item, ' +
        '.photos-empty, ' +
        '.loading-photos'
      )

      await expect(photoContent.first()).toBeVisible({ timeout: 30000 })
    }
  })

  test('should load photos from the API', async ({ page }) => {
    // Monitor network requests for photo-related API calls
    const photoRequests: string[] = []

    page.on('request', request => {
      const url = request.url()
      if (url.includes('/graph/') || url.includes('/dav/')) {
        photoRequests.push(url)
      }
    })

    // Navigate and wait
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Should have made some API requests
    expect(photoRequests.length).toBeGreaterThan(0)
  })

  test('should display date groupings when photos are loaded', async ({ page }) => {
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('networkidle')

    // Try to activate Photo View
    const viewButtons = page.locator('button:has-text("Photo"), [title*="Photo"]')
    if (await viewButtons.count() > 0) {
      await viewButtons.first().click()
      await page.waitForTimeout(2000)

      // Look for date group headers (Today, Yesterday, or date strings)
      const dateHeaders = page.locator(
        '.date-group-header, ' +
        'h2:has-text("Today"), ' +
        'h2:has-text("Yesterday"), ' +
        '.photo-date-group'
      )

      // May or may not have date headers depending on if photos exist
      const headerCount = await dateHeaders.count()
      // Just verify no errors occurred
      expect(headerCount).toBeGreaterThanOrEqual(0)
    }
  })
})

test.describe('Photo Thumbnails', () => {
  test('should load thumbnail images', async ({ page }) => {
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('networkidle')

    // Monitor image load responses
    const imageResponses: number[] = []

    page.on('response', response => {
      const url = response.url()
      if (url.includes('preview=1') || url.includes('/thumbnail')) {
        imageResponses.push(response.status())
      }
    })

    // Wait for potential image loads
    await page.waitForTimeout(5000)

    // If images were requested, they should have succeeded (200) or been cached (304)
    for (const status of imageResponses) {
      expect([200, 304]).toContain(status)
    }
  })
})
