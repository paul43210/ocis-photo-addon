import { test as base, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '.auth/user.json')

/**
 * Extended test fixtures with authenticated context
 */
export const test = base.extend({
  // Use saved authentication state if available
  storageState: async ({}, use) => {
    try {
      // Check if auth file exists
      const fs = await import('fs')
      if (fs.existsSync(authFile)) {
        await use(authFile)
      } else {
        await use(undefined)
      }
    } catch {
      await use(undefined)
    }
  },
})

export { expect }

/**
 * Helper to navigate to files and switch to Photo View
 */
export async function navigateToPhotoView(page: any) {
  // Navigate to personal files
  await page.goto('/files/spaces/personal/home')

  // Wait for file list to load
  await page.waitForSelector('[data-test-resource-path], .files-table, .oc-resource', {
    timeout: 30000
  })

  // Look for the view switcher and click Photo View
  // The photo-addon registers as a folderView extension
  const viewSwitcher = page.locator('[data-testid="view-options-btn"], .view-option-switch, button[aria-label*="view"]')

  if (await viewSwitcher.count() > 0) {
    await viewSwitcher.first().click()

    // Find and click Photo View option
    const photoViewOption = page.locator('text=Photo View, text=photo-view, [data-testid="photo-view"]')
    if (await photoViewOption.count() > 0) {
      await photoViewOption.first().click()
    }
  }
}

/**
 * Helper to wait for photos to load
 */
export async function waitForPhotosLoaded(page: any) {
  // Wait for either photos to appear or loading to finish
  await Promise.race([
    page.waitForSelector('.photo-item, .photo-stack, .photo-grid img', { timeout: 30000 }),
    page.waitForSelector('.photos-empty, .no-photos', { timeout: 30000 }),
  ])
}
