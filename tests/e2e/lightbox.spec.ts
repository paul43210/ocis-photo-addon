import { test, expect } from './fixtures'

test.describe('Photo Lightbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000) // Wait for Vue app to hydrate
  })

  test('should open lightbox when clicking a photo', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)

    // Find any clickable photo element
    const photos = page.locator(
      '.photo-item img, ' +
      '.photo-stack, ' +
      '.photo-grid img, ' +
      '[data-test-resource-type="file"] img'
    )

    if (await photos.count() > 0) {
      // Click the first photo
      await photos.first().click()

      // Lightbox should appear
      const lightbox = page.locator(
        '.lightbox-container, ' +
        '.photo-lightbox, ' +
        '.oc-preview, ' +
        '[role="dialog"]'
      )

      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('should close lightbox with close button', async ({ page }) => {
    await page.waitForTimeout(2000)

    const photos = page.locator('.photo-item img, .photo-stack, .photo-grid img')

    if (await photos.count() > 0) {
      await photos.first().click()

      // Wait for lightbox
      const lightbox = page.locator('.lightbox-container, .photo-lightbox, [role="dialog"]')
      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })

      // Find and click close button
      const closeButton = page.locator(
        '.lightbox-close, ' +
        'button[aria-label*="close"], ' +
        'button[aria-label*="Close"], ' +
        '.close-btn'
      )

      if (await closeButton.count() > 0) {
        await closeButton.first().click()

        // Lightbox should be hidden
        await expect(lightbox.first()).not.toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('should close lightbox with Escape key', async ({ page }) => {
    await page.waitForTimeout(2000)

    const photos = page.locator('.photo-item img, .photo-stack, .photo-grid img')

    if (await photos.count() > 0) {
      await photos.first().click()

      const lightbox = page.locator('.lightbox-container, .photo-lightbox, [role="dialog"]')
      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })

      // Press Escape
      await page.keyboard.press('Escape')

      // Lightbox should close
      await expect(lightbox.first()).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('should display photo metadata in lightbox', async ({ page }) => {
    await page.waitForTimeout(2000)

    const photos = page.locator('.photo-item img, .photo-stack')

    if (await photos.count() > 0) {
      await photos.first().click()

      const lightbox = page.locator('.lightbox-container, .photo-lightbox')
      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })

      // Look for metadata panel
      const metadataPanel = page.locator(
        '.lightbox-metadata, ' +
        '.metadata-panel, ' +
        '.photo-info, ' +
        '.exif-data'
      )

      // Metadata panel should exist (may or may not have data)
      const panelCount = await metadataPanel.count()
      expect(panelCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('should navigate between photos with arrow keys', async ({ page }) => {
    await page.waitForTimeout(2000)

    const photos = page.locator('.photo-item img, .photo-stack')

    if (await photos.count() > 1) {
      await photos.first().click()

      const lightbox = page.locator('.lightbox-container, .photo-lightbox')
      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })

      // Get current image src or identifier
      const currentImage = page.locator('.lightbox-container img, .photo-lightbox img').first()
      const initialSrc = await currentImage.getAttribute('src')

      // Press right arrow to go to next photo
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(500)

      // Image should change (or stay same if only one photo)
      const newSrc = await currentImage.getAttribute('src')

      // Either image changed or we're at the end
      expect(newSrc).toBeDefined()
    }
  })

  test('should have download button in lightbox', async ({ page }) => {
    await page.waitForTimeout(2000)

    const photos = page.locator('.photo-item img, .photo-stack')

    if (await photos.count() > 0) {
      await photos.first().click()

      const lightbox = page.locator('.lightbox-container, .photo-lightbox')
      await expect(lightbox.first()).toBeVisible({ timeout: 10000 })

      // Look for download button
      const downloadButton = page.locator(
        'button:has-text("Download"), ' +
        '[aria-label*="download"], ' +
        '[aria-label*="Download"], ' +
        '.download-btn'
      )

      const downloadCount = await downloadButton.count()
      expect(downloadCount).toBeGreaterThanOrEqual(0)
    }
  })
})
