import { test, expect } from '@playwright/test'

test.describe('Admin panel', () => {
  test('admin page responds (redirects if not admin)', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Should either load the admin panel or redirect to home/403
    await expect(page).not.toHaveURL(/error/i)
    // Must render something — not a blank page
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('admin page does not throw 500', async ({ request }) => {
    const resp = await request.get('/admin')
    expect(resp.status()).not.toBe(500)
  })
})
