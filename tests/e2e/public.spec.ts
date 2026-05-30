import { test, expect } from '@playwright/test'

test.describe('Public pages — unauthenticated', () => {
  test('homepage loads with hero section and nav links', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle(/BookEX|Book/i)
    await expect(page.locator('h1')).toContainText(/Give Your Books a New Chapter/i)

    await expect(page.locator('a[href="/books"]').first()).toBeVisible()
    await expect(page.locator('a[href="/books/sell"]').first()).toBeVisible()
  })

  test('homepage shows Freshly Listed section', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Freshly Listed' })).toBeVisible()
  })

  test('homepage shows How It Works section', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Buy & Sell' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Exchange' })).toBeVisible()
    // Scroll to make sure the community card is in view
    await page.locator('text=Join the Community').first().scrollIntoViewIfNeeded()
    await expect(page.locator('text=Join the Community').first()).toBeVisible()
  })

  test('header navigation links are present', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('a[href="/books"]').first()).toBeVisible()
    await expect(page.locator('a[href="/exchange"]').first()).toBeVisible()
    await expect(page.locator('a[href="/community"]').first()).toBeVisible()
  })

  test('books listing page loads', async ({ page }) => {
    await page.goto('/books')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText(/Buy Books/i)
  })

  test('books page shows filter controls', async ({ page }) => {
    await page.goto('/books')
    await page.waitForLoadState('networkidle')

    const filterArea = page.locator('form, [class*="filter"], input[placeholder*="search" i]').first()
    await expect(filterArea).toBeVisible()
  })

  test('exchange listing page loads', async ({ page }) => {
    await page.goto('/exchange')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main, h1').first()).toBeVisible()
  })

  test('community page loads', async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
  })

  test('search page loads with empty state', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText(/Search Books/i)
    await expect(page.locator('text=Enter a search term above')).toBeVisible()
  })

  test('search page shows tabs for results query', async ({ page }) => {
    await page.goto('/search?q=book')
    await page.waitForLoadState('networkidle')

    // TabList should be present
    await expect(page.locator('[role="tablist"]')).toBeVisible()
    // Both For Sale and For Exchange tabs
    await expect(page.locator('[role="tab"]').first()).toBeVisible()
  })

  test('donate page loads', async ({ page }) => {
    await page.goto('/donate')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
  })

  test('health API endpoint responds', async ({ request }) => {
    const resp = await request.get('/api/health')
    expect(resp.status()).toBeLessThan(500)
  })
})
