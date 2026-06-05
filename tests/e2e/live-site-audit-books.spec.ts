import { test, Page } from '@playwright/test'

const SITE = 'https://bookex.farya.pk'

function collectAll(page: Page) {
  const errors: string[] = []
  const failed: { url: string; status: number }[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))
  page.on('requestfailed', req => {
    // Ignore prefetch aborts — they are expected behaviour for RSC prefetch
    const errText = req.failure()?.errorText ?? ''
    if (!errText.includes('ERR_ABORTED')) {
      errors.push(`REQUEST FAILED: ${req.url()} — ${errText}`)
    }
  })
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failed.push({ url: resp.url(), status: resp.status() })
    }
  })
  return { errors, failed }
}

test('books page — full resource check', async ({ page }) => {
  const { errors, failed } = collectAll(page)
  // Use 'load' not 'networkidle' — RSC prefetch keeps network alive indefinitely
  await page.goto(`${SITE}/books`, { waitUntil: 'load', timeout: 25000 })
  // Allow 2s for lazy assets
  await page.waitForTimeout(2000)

  console.log(`BOOKS_FAILED_RESOURCES: ${JSON.stringify(failed)}`)
  console.log(`BOOKS_ALL_ERRORS: ${JSON.stringify(errors)}`)

  const bookCards = await page.locator('[data-testid*="book"], [class*="book-card"], article, [class*="card"]').count()
  console.log(`BOOKS_CARD_COUNT: ${bookCards}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/books-page.png', fullPage: true })
})
