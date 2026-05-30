import { test, expect } from '@playwright/test'

// Dismiss profile completion modal if it appears — set localStorage flag before each test
async function dismissProfileModal(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('profile-modal-dismissed', 'true')
  })
}

test.describe('Profile pages — authenticated', () => {
  test('my profile page loads', async ({ page }) => {
    await dismissProfileModal(page)
    await page.goto('/profile/me')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator("main").first()).toBeVisible()
  })

  test('profile settings page loads', async ({ page }) => {
    await dismissProfileModal(page)
    await page.goto('/profile/settings')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator("main").first()).toBeVisible()
  })

  test('profile settings page has form fields', async ({ page }) => {
    await dismissProfileModal(page)
    await page.goto('/profile/settings')
    await page.waitForLoadState('networkidle')

    const inputCount = await page.locator('input').count()
    expect(inputCount).toBeGreaterThan(0)
  })

  test('wishlist page loads', async ({ page }) => {
    await dismissProfileModal(page)
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator("main").first()).toBeVisible()
  })

  test('messages page loads', async ({ page }) => {
    await dismissProfileModal(page)
    await page.goto('/messages')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main, [class*="chat"], [class*="message"]').first()).toBeVisible()
  })
})
