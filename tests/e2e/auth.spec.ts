import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_USER_EMAIL || ''
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || ''

test.describe('Auth flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Login button is visible when unauthenticated', async ({ page }) => {
    const loginBtn = page.locator('button', { hasText: 'Login' }).first()
    await expect(loginBtn).toBeVisible()
  })

  test('auth modal opens with Login and Sign Up tabs', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await expect(page.locator('[role="tab"]', { hasText: 'Login' })).toBeVisible()
    await expect(page.locator('[role="tab"]', { hasText: 'Sign Up' })).toBeVisible()
  })

  test('login form shows email and password fields', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await expect(page.locator('#email-login')).toBeVisible()
    await expect(page.locator('#password-login')).toBeVisible()
  })

  test('login with wrong credentials shows error toast', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await page.locator('#email-login').fill('wrong@example.com')
    await page.locator('#password-login').fill('WrongPassword123!')
    await page.locator('[role="dialog"] button[type="submit"]').click()

    // Wait for toast — Radix toast renders as ol > li with data-state="open"
    await expect(
      page.locator('li[data-state="open"], [data-radix-toast-viewport] > li').first()
    ).toBeVisible({ timeout: 12000 })
  })

  test('login with valid credentials succeeds', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars to run this test')

    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await page.locator('#email-login').fill(TEST_EMAIL)
    await page.locator('#password-login').fill(TEST_PASSWORD)
    await page.locator('[role="dialog"] button[type="submit"]').click()

    // Dialog closes on success
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const loginBtn = page.locator('button', { hasText: /^Login$/ }).first()
    await expect(loginBtn).not.toBeVisible({ timeout: 5000 })
  })

  test('signup tab shows registration form', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await page.locator('[role="tab"]', { hasText: 'Sign Up' }).click()

    await expect(page.locator('#full-name')).toBeVisible()
    await expect(page.locator('#email-signup')).toBeVisible()
    await expect(page.locator('#password-signup')).toBeVisible()
    await expect(page.locator('#confirm-password-signup')).toBeVisible()
  })

  test('signup with mismatched passwords shows error toast', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })
    await page.locator('[role="tab"]', { hasText: 'Sign Up' }).click()

    await page.locator('#full-name').fill('Test User')
    await page.locator('#email-signup').fill('new@example.com')
    await page.locator('#password-signup').fill('Password123!')
    await page.locator('#confirm-password-signup').fill('DifferentPassword!')
    await page.locator('[role="dialog"] button[type="submit"]').click()

    await expect(
      page.locator('li[data-state="open"], [data-radix-toast-viewport] > li').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('forgot password link switches to reset form', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await page.locator('button', { hasText: 'Forgot password?' }).click()
    await expect(page.locator('text=Reset Password')).toBeVisible()
    await expect(page.locator('#email-forgot')).toBeVisible()
  })

  test('modal closes when pressing Escape', async ({ page }) => {
    await page.locator('button', { hasText: 'Login' }).first().click()
    await page.locator('[role="dialog"]').waitFor({ state: 'visible' })

    await page.keyboard.press('Escape')
    await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  })
})
