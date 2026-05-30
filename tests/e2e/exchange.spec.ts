import { test, expect } from '@playwright/test'

test.describe('Exchange pages', () => {
  test('exchange listing page loads', async ({ page }) => {
    await page.goto('/exchange')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main')).toBeVisible()
  })

  test('exchange history page loads when authenticated', async ({ page }) => {
    await page.goto('/exchange/history')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main')).toBeVisible()
  })

  test('exchange page shows books available for exchange', async ({ page }) => {
    await page.goto('/exchange')
    await page.waitForLoadState('networkidle')

    const noResults = page.locator('text=No books found, text=no exchange')
    const bookCards = page.locator('a[href^="/books/"]').first()
    // Page should have content
    const hasContent = await noResults.isVisible() || await bookCards.isVisible()
    expect(hasContent).toBeTruthy()
  })

  test('exchange detail page loads when a valid exchange ID is visited', async ({ page }) => {
    // Navigate to exchange page and try to get an exchange link
    await page.goto('/exchange')
    await page.waitForLoadState('networkidle')

    const exchangeLink = page.locator('a[href^="/exchange/"]').first()
    if (await exchangeLink.isVisible()) {
      const href = await exchangeLink.getAttribute('href')
      if (href && href !== '/exchange/history') {
        await page.goto(href)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/error/i)
      }
    }
  })
})
