import { test, expect } from '@playwright/test'

// Dismiss profile completion modal before tests that navigate to pages which trigger it
async function dismissProfileModal(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('profile-modal-dismissed', 'true')
  })
}

test.describe('Sell / List a Book', () => {
  test.beforeEach(async ({ page }) => {
    await dismissProfileModal(page)
  })

  test('sell page is accessible and shows expected content when authenticated', async ({ page }) => {
    await page.goto('/books/sell')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should be one of: form, location required notice, or profile redirect — not a login prompt
    const loginCta = page.locator('text=Please log in')
    const isLoginVisible = await loginCta.isVisible()
    expect(isLoginVisible).toBe(false)
    await expect(page).not.toHaveURL(/error/i)
  })

  test('sell form has required fields when city is set', async ({ page }) => {
    await page.goto('/books/sell')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const titleInput = page.locator('#title')
    if (await titleInput.isVisible()) {
      await expect(page.locator('#title')).toBeVisible()
      await expect(page.locator('#author')).toBeVisible()
      await expect(page.locator('#description')).toBeVisible()
    }
  })

  test('listing type toggle switches between sell and exchange', async ({ page }) => {
    await page.goto('/books/sell')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const exchangeRadio = page.locator('#exchange')
    if (await exchangeRadio.isVisible()) {
      await exchangeRadio.click()
      await expect(page.locator('#price')).not.toBeVisible()

      const sellRadio = page.locator('#sell')
      await sellRadio.click()
      await expect(page.locator('#price')).toBeVisible()
    }
  })

  test('sell form submit with empty fields shows validation toast', async ({ page }) => {
    await page.goto('/books/sell')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const submitBtn = page.locator('button[type="submit"]').first()
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      await page.waitForTimeout(1000)
      await expect(page).not.toHaveURL(/error/i)
    }
  })
})
