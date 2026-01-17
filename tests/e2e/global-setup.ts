import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '.auth/user.json')

/**
 * Global setup - authenticates once and saves session state
 * All tests reuse this authenticated session
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'https://cloud.faure.ca'

  // Check if auth file exists and is recent (less than 10 minutes old)
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile)
    const ageMs = Date.now() - stats.mtimeMs
    const ageMinutes = ageMs / 1000 / 60
    if (ageMinutes < 10) {
      console.log(`Using existing auth file (${ageMinutes.toFixed(1)} minutes old)`)
      return
    }
  }

  // Get credentials from environment
  const username = process.env.OCIS_USER || 'admin'
  const password = process.env.OCIS_PASSWORD

  if (!password) {
    console.log('OCIS_PASSWORD not set, skipping authentication setup')
    console.log('Set OCIS_PASSWORD environment variable to run E2E tests')
    return
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to oCIS login page
    await page.goto(baseURL)

    // Wait for login form (oCIS uses OIDC/LibreGraph)
    await page.waitForSelector('input[name="login"], input[type="text"], input[id="oc-login-username"]', {
      timeout: 10000
    })

    // Fill in credentials
    const usernameInput = page.locator('input[name="login"], input[type="text"], input[id="oc-login-username"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()

    await usernameInput.fill(username)
    await passwordInput.fill(password)

    // Submit login form
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Log in")').first()
    await submitButton.click()

    // Wait for successful login - should redirect to files page
    try {
      await page.waitForURL('**/files/**', { timeout: 30000 })
    } catch (e) {
      console.log('Current URL after login attempt:', page.url())
      await page.screenshot({ path: 'test-results/auth-debug.png' })
      console.log('Screenshot saved to test-results/auth-debug.png')
      throw e
    }

    // Save authentication state
    await context.storageState({ path: authFile })
    console.log('Authentication successful, state saved to', authFile)

  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
