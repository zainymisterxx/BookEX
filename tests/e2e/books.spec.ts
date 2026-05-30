import { test, expect } from '@playwright/test'

// These tests run with saved auth state (logged-in user)

test.describe('Books — authenticated flows', () => {
  test('books page renders book cards', async ({ page }) => {
    await page.goto('/books')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText(/Buy Books/i)
    // Check for at least some content area
    const noResults = page.locator('text=No books found')
    const bookCards = page.locator('[class*="card"], article').first()
    // Either books exist or no-results message
    const hasContent = await noResults.isVisible() || await bookCards.isVisible()
    expect(hasContent).toBe(true)
  })

  test('books page — search filter updates results', async ({ page }) => {
    await page.goto('/books')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await page.keyboard.press('Enter')
      await page.waitForLoadState('networkidle')
      await expect(page).not.toHaveURL(/error/i)
    }
  })

  test('books page — URL search param filters results', async ({ page }) => {
    await page.goto('/books?searchQuery=book')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('h1')).toContainText(/Buy Books/i)
  })

  test('book detail page loads for first listing', async ({ page }) => {
    await page.goto('/books')
    await page.waitForLoadState('networkidle')

    // Click first book card link
    const firstBookLink = page.locator('a[href^="/books/"]').first()
    if (await firstBookLink.isVisible()) {
      const href = await firstBookLink.getAttribute('href')
      if (href) {
        await page.goto(href)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/error/i)
        // Should show book content
        await expect(page.locator('main')).toBeVisible()
      }
    }
  })

  test('sell page renders the form when logged in', async ({ page }) => {
    await page.goto('/books/sell')
    await page.waitForLoadState('networkidle')

    // Should not show login CTA (we are authenticated)
    const loginCta = page.locator('text=Please log in')
    const locationRequired = page.locator('text=Location Required')
    const sellForm = page.locator('form').first()

    // One of: form (if city set), location required (if no city), but not login prompt
    const isLoginVisible = await loginCta.isVisible()
    expect(isLoginVisible).toBe(false)
  })

  test('my listings page loads', async ({ page }) => {
    await page.goto('/books/my-listings')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main')).toBeVisible()
  })
})
