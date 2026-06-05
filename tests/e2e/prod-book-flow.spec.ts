/**
 * Production smoke test — book listing & detail flow
 * Target: https://bookex.farya.pk
 * Run: BASE_URL=https://bookex.farya.pk npx playwright test tests/e2e/prod-book-flow.spec.ts --project=public
 */
import { test, expect, Page } from '@playwright/test'

const BASE = 'https://bookex.farya.pk'

// Collect console errors per test
function collectConsoleErrors(page: Page): string[] {
  const errs: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errs.push(msg.text())
  })
  page.on('pageerror', err => errs.push(`[pageerror] ${err.message}`))
  return errs
}

test.describe('Prod — book listing & detail flow', () => {

  test('1. /books page loads — grid/list renders', async ({ page }) => {
    const errs = collectConsoleErrors(page)
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })

    // Page title
    await expect(page.locator('h1')).toContainText(/buy books/i)

    // At least one book card OR a "no results" message
    const bookLinks   = page.locator('a[href*="/books/"]')
    const noResults   = page.locator('text=/no books found/i')
    const cardOrEmpty = (await bookLinks.count()) > 0 || await noResults.isVisible()
    expect(cardOrEmpty, 'Expected book cards or no-results message').toBe(true)

    // Store count for context
    const count = await bookLinks.count()
    console.log(`Book links found: ${count}`)
    console.log(`Console errors on /books: ${JSON.stringify(errs)}`)
    expect(errs, `Console errors on /books: ${errs.join(' | ')}`).toHaveLength(0)
  })

  test('2. Book detail page — title, author, condition, price/exchange, seller info', async ({ page }) => {
    const errs = collectConsoleErrors(page)
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })

    const firstLink = page.locator('a[href^="/books/"]').filter({ not: page.locator('[href="/books/sell"], [href="/books/my-listings"]') }).first()
    const href = await firstLink.getAttribute('href')
    expect(href, 'No book link found on /books page').toBeTruthy()

    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
    await expect(page).not.toHaveURL(/error/i)

    // Title — h1 or prominent heading
    const titleEl = page.locator('h1, h2').first()
    await expect(titleEl).toBeVisible()
    const titleText = await titleEl.textContent()
    console.log(`Book title: "${titleText?.trim()}"`)

    // Author
    const authorEl = page.locator('text=/author/i, [data-testid*="author"], [class*="author"]').first()
    const authorVisible = await authorEl.isVisible().catch(() => false)
    console.log(`Author visible: ${authorVisible}`)
    expect(authorVisible, 'Author field not visible on detail page').toBe(true)

    // Condition
    const conditionEl = page.locator('text=/condition/i, [data-testid*="condition"], [class*="condition"]').first()
    const conditionVisible = await conditionEl.isVisible().catch(() => false)
    console.log(`Condition visible: ${conditionVisible}`)
    expect(conditionVisible, 'Condition field not visible on detail page').toBe(true)

    // Price OR exchange preference
    const priceEl = page.locator('text=/price|exchange|for sale|for exchange/i').first()
    const priceVisible = await priceEl.isVisible().catch(() => false)
    console.log(`Price/exchange visible: ${priceVisible}`)
    expect(priceVisible, 'Price or exchange preference not visible on detail page').toBe(true)

    // Seller info
    const sellerEl = page.locator('text=/seller|listed by|owner|posted by/i').first()
    const sellerVisible = await sellerEl.isVisible().catch(() => false)
    console.log(`Seller info visible: ${sellerVisible}`)
    expect(sellerVisible, 'Seller info not visible on detail page').toBe(true)

    console.log(`Console errors on detail page: ${JSON.stringify(errs)}`)
    expect(errs, `Console errors on detail: ${errs.join(' | ')}`).toHaveLength(0)
  })

  test('3. Book detail — images load or placeholder shown', async ({ page }) => {
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })
    const firstLink = page.locator('a[href^="/books/"]').filter({ not: page.locator('[href="/books/sell"], [href="/books/my-listings"]') }).first()
    const href = await firstLink.getAttribute('href')
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })

    // Check images — either real img loaded or a placeholder element
    const images = page.locator('img')
    const imgCount = await images.count()
    console.log(`Images on detail page: ${imgCount}`)

    if (imgCount > 0) {
      // Check first image actually loaded (naturalWidth > 0)
      const firstImgLoaded = await images.first().evaluate((img: HTMLImageElement) =>
        img.complete && img.naturalWidth > 0
      )
      console.log(`First image loaded (naturalWidth>0): ${firstImgLoaded}`)
      // Not a hard failure — placeholder SVG can have naturalWidth 0; just report
      if (!firstImgLoaded) {
        // Check for a visible placeholder/fallback element
        const placeholder = page.locator('[data-testid*="placeholder"], [class*="placeholder"], svg').first()
        const placeholderVisible = await placeholder.isVisible().catch(() => false)
        console.log(`Placeholder/SVG visible as fallback: ${placeholderVisible}`)
        expect(placeholderVisible, 'Image broken with no placeholder fallback').toBe(true)
      }
    } else {
      // No img tag at all — look for placeholder
      const placeholder = page.locator('[data-testid*="placeholder"], [class*="placeholder"], svg').first()
      const placeholderVisible = await placeholder.isVisible().catch(() => false)
      console.log(`No img tag; placeholder visible: ${placeholderVisible}`)
      expect(placeholderVisible, 'No image and no placeholder on detail page').toBe(true)
    }
  })

  test('4. Book detail — "Contact Seller" button exists', async ({ page }) => {
    const errs = collectConsoleErrors(page)
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })
    const firstLink = page.locator('a[href^="/books/"]').filter({ not: page.locator('[href="/books/sell"], [href="/books/my-listings"]') }).first()
    const href = await firstLink.getAttribute('href')
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })

    const btn = page.locator('button, a').filter({ hasText: /contact seller|contact/i }).first()
    const visible = await btn.isVisible().catch(() => false)
    console.log(`"Contact Seller" button visible: ${visible}`)
    expect(visible, '"Contact Seller" button not found on book detail page').toBe(true)
  })

  test('5. Book detail — Wishlist/heart button exists', async ({ page }) => {
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })
    const firstLink = page.locator('a[href^="/books/"]').filter({ not: page.locator('[href="/books/sell"], [href="/books/my-listings"]') }).first()
    const href = await firstLink.getAttribute('href')
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })

    // Heart button can be icon-only so match by aria-label or testid or svg heart
    const heartBtn = page.locator(
      'button[aria-label*="wishlist" i], button[aria-label*="heart" i], button[aria-label*="save" i], [data-testid*="wishlist"], [data-testid*="heart"]'
    ).first()
    const heartVisible = await heartBtn.isVisible().catch(() => false)

    // Fallback: any button containing an svg near the main CTA area
    const svgBtn = page.locator('button svg').first()
    const svgVisible = await svgBtn.isVisible().catch(() => false)

    console.log(`Wishlist/heart button (aria-label): ${heartVisible}`)
    console.log(`Any button with SVG icon: ${svgVisible}`)
    expect(heartVisible || svgVisible, 'No wishlist/heart button found on detail page').toBe(true)
  })

  test('6. Book detail — "Propose Exchange" button exists', async ({ page }) => {
    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })
    const firstLink = page.locator('a[href^="/books/"]').filter({ not: page.locator('[href="/books/sell"], [href="/books/my-listings"]') }).first()
    const href = await firstLink.getAttribute('href')
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })

    const btn = page.locator('button, a').filter({ hasText: /propose exchange|exchange/i }).first()
    const visible = await btn.isVisible().catch(() => false)
    console.log(`"Propose Exchange" button visible: ${visible}`)
    expect(visible, '"Propose Exchange" button not found on book detail page').toBe(true)
  })

  test('7. Non-existent book ID — graceful error handling', async ({ page }) => {
    const errs = collectConsoleErrors(page)
    const response = await page.goto(`${BASE}/books/000000000000000000000000`, { waitUntil: 'networkidle' })

    const status = response?.status()
    const url    = page.url()
    console.log(`Response status: ${status}`)
    console.log(`Final URL: ${url}`)

    // Should NOT crash to a blank/broken page
    await expect(page.locator('body')).toBeVisible()

    // Acceptable outcomes: 404 page, redirect to /books, or a "not found" message
    const notFoundText = page.locator('text=/not found|doesn.t exist|no longer available|404/i').first()
    const notFoundVisible = await notFoundText.isVisible().catch(() => false)
    const redirectedToBooks = url.includes('/books') && !url.includes('000000000000000000000000')
    const is404Status = status === 404

    console.log(`404 status: ${is404Status}, not-found text: ${notFoundVisible}, redirected: ${redirectedToBooks}`)
    expect(
      is404Status || notFoundVisible || redirectedToBooks,
      `Bad book ID should yield 404/not-found page or redirect; got status ${status} at ${url}`
    ).toBe(true)

    console.log(`Console errors on 404 page: ${JSON.stringify(errs)}`)
  })

})
