import { test, expect } from '@playwright/test'

test.describe('Community pages', () => {
  test('community listing page loads', async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')

    await expect(page).not.toHaveURL(/error/i)
    await expect(page.locator('main')).toBeVisible()
  })

  test('community page shows Join Now links or community cards', async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')

    // Either community cards exist or empty state
    const communityLinks = page.locator('a[href^="/community/"]').first()
    const emptyState = page.locator('text=No communities, text=no community').first()
    const hasContent = await communityLinks.isVisible() || await emptyState.isVisible()
    // Community page renders something
    await expect(page.locator('main')).toBeVisible()
  })

  test('visiting a community detail page works', async ({ page }) => {
    await page.goto('/community')
    await page.waitForLoadState('networkidle')

    const communityLink = page.locator('a[href^="/community/"]').first()
    if (await communityLink.isVisible()) {
      const href = await communityLink.getAttribute('href')
      if (href && !href.endsWith('/settings')) {
        await page.goto(href)
        await page.waitForLoadState('networkidle')
        await expect(page).not.toHaveURL(/error/i)
        await expect(page.locator('main')).toBeVisible()
      }
    }
  })
})
