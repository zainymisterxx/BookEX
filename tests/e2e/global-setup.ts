import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

// Test credentials — set via env or fall back to defaults for local dev
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testuser@bookex.test'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123!'

setup('authenticate test user', async ({ page }) => {
  // If auth state already exists and is recent (< 1 hour), reuse it
  if (fs.existsSync(AUTH_FILE)) {
    const stat = fs.statSync(AUTH_FILE)
    const ageMs = Date.now() - stat.mtimeMs
    if (ageMs < 60 * 60 * 1000) {
      console.log('Reusing existing auth state (< 1 hour old)')
      return
    }
  }

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Open auth modal via the Login button in header
  const loginButton = page.locator('button', { hasText: 'Login' }).first()
  await loginButton.waitFor({ state: 'visible' })
  await loginButton.click()

  // Wait for dialog
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

  // Fill login form
  await page.locator('#email-login').fill(TEST_EMAIL)
  await page.locator('#password-login').fill(TEST_PASSWORD)
  await page.locator('[role="dialog"] button[type="submit"]').click()

  // Wait for successful login — dialog should close
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
    // Dialog may already be gone
  })

  await page.waitForTimeout(2000)

  // Save storage state
  await page.context().storageState({ path: AUTH_FILE })
  console.log('Auth state saved to', AUTH_FILE)
})
