import { test as base } from '@playwright/test'

export const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testuser@bookex.test'
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123!'

/** Open the auth modal and log in with given credentials */
export async function loginViaModal(page: import('@playwright/test').Page, email: string, password: string) {
  const loginButton = page.locator('button', { hasText: 'Login' }).first()
  await loginButton.click()
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' })
  await page.locator('#email-login').fill(email)
  await page.locator('#password-login').fill(password)
  await page.locator('[role="dialog"] button[type="submit"]').click()
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
}

export { base as test }
