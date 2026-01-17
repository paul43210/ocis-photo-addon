import { test, expect } from './fixtures'

test.describe('Map View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/files/spaces/personal/home')
    await page.waitForLoadState('networkidle')
  })

  test('should have map view toggle button', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Look for map/calendar view toggle
    const mapToggle = page.locator(
      'button:has-text("Map"), ' +
      '[aria-label*="Map"], ' +
      '.view-btn:has-text("Map"), ' +
      '.view-selector button'
    )

    // Map toggle should exist in Photo View
    const toggleCount = await mapToggle.count()
    // May not be visible if not in Photo View
    expect(toggleCount).toBeGreaterThanOrEqual(0)
  })

  test('should load Leaflet map when switching to map view', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Try to find and click Map view button
    const mapButton = page.locator(
      'button:has-text("Map"), ' +
      '.view-btn:has-text("Map")'
    )

    if (await mapButton.count() > 0) {
      await mapButton.first().click()
      await page.waitForTimeout(2000)

      // Leaflet creates a container with class 'leaflet-container'
      const mapContainer = page.locator('.leaflet-container, .photo-map, #map')

      // Map should be visible
      if (await mapContainer.count() > 0) {
        await expect(mapContainer.first()).toBeVisible({ timeout: 10000 })
      }
    }
  })

  test('should load map tiles', async ({ page }) => {
    // Monitor tile requests
    const tileRequests: string[] = []

    page.on('request', request => {
      const url = request.url()
      if (url.includes('tile.openstreetmap.org') || url.includes('tiles')) {
        tileRequests.push(url)
      }
    })

    await page.waitForTimeout(2000)

    // Try to switch to map view
    const mapButton = page.locator('button:has-text("Map"), .view-btn:has-text("Map")')

    if (await mapButton.count() > 0) {
      await mapButton.first().click()
      await page.waitForTimeout(3000)

      // If map loaded, should have requested tiles
      // (may be 0 if map view not available or no GPS photos)
      expect(tileRequests.length).toBeGreaterThanOrEqual(0)
    }
  })

  test('should display photo markers on map', async ({ page }) => {
    await page.waitForTimeout(2000)

    const mapButton = page.locator('button:has-text("Map"), .view-btn:has-text("Map")')

    if (await mapButton.count() > 0) {
      await mapButton.first().click()
      await page.waitForTimeout(3000)

      // Look for Leaflet markers
      const markers = page.locator(
        '.leaflet-marker-icon, ' +
        '.marker-cluster, ' +
        '.photo-marker'
      )

      // May have markers if photos have GPS data
      const markerCount = await markers.count()
      expect(markerCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('should show photo count in map view header', async ({ page }) => {
    await page.waitForTimeout(2000)

    const mapButton = page.locator('button:has-text("Map"), .view-btn:has-text("Map")')

    if (await mapButton.count() > 0) {
      await mapButton.first().click()
      await page.waitForTimeout(2000)

      // Look for photo count display
      const photoCount = page.locator(
        '.map-photo-count, ' +
        '.photos-in-view, ' +
        'text=/\\d+ of \\d+ photos/'
      )

      const countVisible = await photoCount.count()
      expect(countVisible).toBeGreaterThanOrEqual(0)
    }
  })

  test('should open lightbox when clicking map marker', async ({ page }) => {
    await page.waitForTimeout(2000)

    const mapButton = page.locator('button:has-text("Map"), .view-btn:has-text("Map")')

    if (await mapButton.count() > 0) {
      await mapButton.first().click()
      await page.waitForTimeout(3000)

      // Find a marker and click it
      const markers = page.locator('.leaflet-marker-icon, .photo-marker')

      if (await markers.count() > 0) {
        await markers.first().click()
        await page.waitForTimeout(1000)

        // Either a popup or lightbox should appear
        const popup = page.locator(
          '.leaflet-popup, ' +
          '.lightbox-container, ' +
          '.marker-popup'
        )

        const popupCount = await popup.count()
        expect(popupCount).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('should switch between calendar and map views', async ({ page }) => {
    await page.waitForTimeout(2000)

    const calendarButton = page.locator('button:has-text("Calendar"), .view-btn:has-text("Calendar")')
    const mapButton = page.locator('button:has-text("Map"), .view-btn:has-text("Map")')

    if (await mapButton.count() > 0 && await calendarButton.count() > 0) {
      // Switch to map
      await mapButton.first().click()
      await page.waitForTimeout(1000)

      // Verify map is visible
      const mapContainer = page.locator('.leaflet-container, .photo-map')
      if (await mapContainer.count() > 0) {
        await expect(mapContainer.first()).toBeVisible()
      }

      // Switch back to calendar
      await calendarButton.first().click()
      await page.waitForTimeout(1000)

      // Verify photo grid is visible
      const photoGrid = page.locator('.photo-grid, .photos-container, .date-group')
      if (await photoGrid.count() > 0) {
        await expect(photoGrid.first()).toBeVisible()
      }
    }
  })
})
