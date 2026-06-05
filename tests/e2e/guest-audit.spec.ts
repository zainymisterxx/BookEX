/**
 * Guest Audit — tests the production site at https://bookex.farya.pk
 * Runs without any auth state (pure visitor / unauthenticated).
 *
 * Covers:
 *  1. Homepage load + hero + nav
 *  2. Book detail page
 *  3. "Contact Seller" gate
 *  4. "Add to Wishlist" gate
 *  5. Community list
 *  6. Community detail + posts
 *  7. /exchange as guest
 *  8. Console error capture per page
 */

import { test, expect, Page } from '@playwright/test'

const BASE = 'https://bookex.farya.pk'

// ─── helpers ────────────────────────────────────────────────────────────────

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))
  return errors
}

async function screenshotStep(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/guest-audit-${name}.png`,
    fullPage: false,
  })
}

// ─── 1. Homepage ─────────────────────────────────────────────────────────────

test.describe('Guest Audit — Homepage', () => {
  test('homepage loads and shows hero heading', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await screenshotStep(page, '01-homepage')

    // Title check
    await expect(page).toHaveTitle(/BookEX|Book/i)

    // Hero heading
    const hero = page.locator('h1').first()
    await expect(hero).toBeVisible()
    const heroText = await hero.textContent()
    expect(heroText).toBeTruthy()

    // Nav links present
    await expect(page.locator('a[href="/books"]').first()).toBeVisible()
    await expect(page.locator('a[href="/exchange"]').first()).toBeVisible()
    await expect(page.locator('a[href="/community"]').first()).toBeVisible()

    // Report console errors (non-blocking — we store them for reporting)
    ;(test.info() as any)._consoleErrors = errors
  })

  test('homepage hero CTA buttons are present', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' })

    // At minimum one CTA (Browse Books / Start Selling / etc.)
    const ctas = page.locator('a, button').filter({ hasText: /Browse|Sell|Start|Get Started|Shop/i })
    await expect(ctas.first()).toBeVisible()
  })

  test('Freshly Listed / featured books section exists on homepage', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' })

    // Scroll down to find any book-listing section
    await page.evaluate(() => window.scrollTo(0, 600))
    await page.waitForTimeout(500)

    const section = page.locator('h2, h3').filter({ hasText: /Fresh|Listed|Book|Featured|Browse/i }).first()
    const bookCards = page.locator('a[href^="/books/"]').first()
    const hasSection = (await section.isVisible().catch(() => false)) ||
                       (await bookCards.isVisible().catch(() => false))
    expect(hasSection).toBeTruthy()
    await screenshotStep(page, '01-homepage-scroll')
  })
})

// ─── 2. Book detail page ──────────────────────────────────────────────────────

test.describe('Guest Audit — Book Detail', () => {
  test('book detail page loads from /books listing', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })
    await screenshotStep(page, '02-books-list')

    const firstBook = page.locator('a[href^="/books/"]').first()
    await expect(firstBook).toBeVisible()

    const bookHref = await firstBook.getAttribute('href')
    expect(bookHref).toBeTruthy()

    // Navigate to the detail page
    const detailUrl = bookHref!.startsWith('http') ? bookHref! : `${BASE}${bookHref}`
    await page.goto(detailUrl, { waitUntil: 'networkidle' })
    await screenshotStep(page, '02-book-detail')

    // Should not redirect to error / 404
    await expect(page).not.toHaveURL(/error|404/i)

    // Main content visible
    await expect(page.locator('main')).toBeVisible()

    // Title / book name visible
    const heading = page.locator('h1, [class*="title"]').first()
    await expect(heading).toBeVisible()

    ;(test.info() as any)._consoleErrors = errors
  })
})

// ─── 3. Contact Seller gate ───────────────────────────────────────────────────

test.describe('Guest Audit — Contact Seller gate', () => {
  test('clicking Contact Seller as guest prompts login', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })

    const firstBook = page.locator('a[href^="/books/"]').first()
    await expect(firstBook).toBeVisible()
    const bookHref = await firstBook.getAttribute('href')
    const detailUrl = bookHref!.startsWith('http') ? bookHref! : `${BASE}${bookHref}`

    await page.goto(detailUrl, { waitUntil: 'networkidle' })
    await screenshotStep(page, '03-book-detail-before-contact')

    // Find the Contact Seller button
    const contactBtn = page.locator('button, a').filter({ hasText: /Contact.*Seller|Message.*Seller|Chat.*Seller/i }).first()
    const exists = await contactBtn.isVisible().catch(() => false)

    if (!exists) {
      // Report as a bug — button not found
      test.info().annotations.push({ type: 'bug', description: 'Contact Seller button not found on book detail page' })
      await screenshotStep(page, '03-contact-seller-missing')
      return
    }

    await contactBtn.click()
    await page.waitForTimeout(800)
    await screenshotStep(page, '03-after-contact-click')

    // Expect: auth modal / redirect to /sign-in / login prompt
    const authModal = page.locator('[role="dialog"], [class*="modal"], [class*="auth"]').filter({
      hasText: /sign in|log in|login|register|auth/i,
    }).first()
    const redirectedToAuth = page.url().includes('sign-in') ||
                             page.url().includes('login') ||
                             page.url().includes('auth')
    const loginPromptVisible = await authModal.isVisible().catch(() => false)

    const hasAuthGate = redirectedToAuth || loginPromptVisible

    if (!hasAuthGate) {
      test.info().annotations.push({
        type: 'bug',
        description: `Contact Seller gate MISSING — no auth modal and no redirect. URL: ${page.url()}`,
      })
    }

    // We assert but capture for reporting
    expect(hasAuthGate).toBeTruthy()

    ;(test.info() as any)._consoleErrors = errors
  })
})

// ─── 4. Add to Wishlist gate ──────────────────────────────────────────────────

test.describe('Guest Audit — Wishlist gate', () => {
  test('clicking Add to Wishlist as guest prompts login', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' })

    const firstBook = page.locator('a[href^="/books/"]').first()
    await expect(firstBook).toBeVisible()
    const bookHref = await firstBook.getAttribute('href')
    const detailUrl = bookHref!.startsWith('http') ? bookHref! : `${BASE}${bookHref}`

    await page.goto(detailUrl, { waitUntil: 'networkidle' })
    await screenshotStep(page, '04-book-detail-before-wishlist')

    // Find the Wishlist button — heart icon / "Add to Wishlist"
    const wishlistBtn = page.locator('button, a').filter({
      hasText: /wishlist|save|♥|favorite/i,
    }).first()

    // Also check for heart/bookmark SVG buttons that have aria-label
    const heartBtn = page.locator('[aria-label*="wishlist" i], [aria-label*="save" i], [aria-label*="favorite" i], [title*="wishlist" i]').first()

    const wishlistVisible = await wishlistBtn.isVisible().catch(() => false)
    const heartVisible = await heartBtn.isVisible().catch(() => false)

    if (!wishlistVisible && !heartVisible) {
      test.info().annotations.push({
        type: 'bug',
        description: 'Wishlist / heart button not found on book detail page — feature missing or hidden for guests',
      })
      await screenshotStep(page, '04-wishlist-missing')
      return
    }

    const btn = wishlistVisible ? wishlistBtn : heartBtn
    await btn.click()
    await page.waitForTimeout(800)
    await screenshotStep(page, '04-after-wishlist-click')

    const authModal = page.locator('[role="dialog"], [class*="modal"]').filter({
      hasText: /sign in|log in|login|register/i,
    }).first()
    const redirectedToAuth = page.url().includes('sign-in') ||
                             page.url().includes('login') ||
                             page.url().includes('auth')
    const loginPromptVisible = await authModal.isVisible().catch(() => false)

    const hasAuthGate = redirectedToAuth || loginPromptVisible

    if (!hasAuthGate) {
      test.info().annotations.push({
        type: 'bug',
        description: `Wishlist gate MISSING — no auth modal and no redirect. URL: ${page.url()}`,
      })
    }

    expect(hasAuthGate).toBeTruthy()

    ;(test.info() as any)._consoleErrors = errors
  })
})

// ─── 5. Community list ────────────────────────────────────────────────────────

test.describe('Guest Audit — Community', () => {
  test('community list page loads with content', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/community`, { waitUntil: 'networkidle' })
    await screenshotStep(page, '05-community-list')

    await expect(page).not.toHaveURL(/error|404/i)
    await expect(page.locator('main')).toBeVisible()

    // Heading
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible()

    // Either community cards or empty state
    const communityCards = page.locator('a[href^="/community/"]').first()
    const emptyState = page.locator('text=/no communit/i').first()
    const hasContent = await communityCards.isVisible().catch(() => false) ||
                       await emptyState.isVisible().catch(() => false)
    expect(hasContent).toBeTruthy()

    ;(test.info() as any)._consoleErrors = errors
  })

  // ─── 6. Community detail + posts ─────────────────────────────────────────

  test('community detail page loads with posts or empty state', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/community`, { waitUntil: 'networkidle' })

    const communityLink = page.locator('a[href^="/community/"]').first()
    const communityVisible = await communityLink.isVisible().catch(() => false)

    if (!communityVisible) {
      test.info().annotations.push({ type: 'skip', description: 'No community cards found — cannot test detail page' })
      return
    }

    const href = await communityLink.getAttribute('href')
    // Skip settings-type links
    if (!href || href.includes('settings') || href.includes('create')) return

    const detailUrl = href.startsWith('http') ? href : `${BASE}${href}`
    await page.goto(detailUrl, { waitUntil: 'networkidle' })
    await screenshotStep(page, '06-community-detail')

    await expect(page).not.toHaveURL(/error|404/i)
    await expect(page.locator('main')).toBeVisible()

    // Posts list, or empty state, or auth gate
    const posts = page.locator('article, [class*="post"], [class*="Post"]').first()
    const emptyPosts = page.locator('text=/no post|be the first/i').first()
    const hasPostArea = await posts.isVisible().catch(() => false) ||
                        await emptyPosts.isVisible().catch(() => false) ||
                        await page.locator('main').isVisible()
    expect(hasPostArea).toBeTruthy()

    ;(test.info() as any)._consoleErrors = errors
  })
})

// ─── 7. /exchange as guest ────────────────────────────────────────────────────

test.describe('Guest Audit — Exchange page', () => {
  test('exchange listing page loads for guest', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto(`${BASE}/exchange`, { waitUntil: 'networkidle' })
    await screenshotStep(page, '07-exchange-guest')

    await expect(page).not.toHaveURL(/\/error\b/i)
    await expect(page.locator('main')).toBeVisible()

    // Should show book cards OR empty state OR auth gate — anything but a crash
    const heading = page.locator('h1').first()
    const hasHeading = await heading.isVisible().catch(() => false)
    const hasMain = await page.locator('main').isVisible()
    expect(hasMain).toBeTruthy()

    if (hasHeading) {
      const text = await heading.textContent()
      test.info().annotations.push({ type: 'info', description: `Exchange page h1: "${text}"` })
    }

    const urlAfter = page.url()
    test.info().annotations.push({ type: 'info', description: `Exchange final URL: ${urlAfter}` })

    ;(test.info() as any)._consoleErrors = errors
  })

  test('exchange page does not hard-crash with 500 error', async ({ page }) => {
    const responses: { url: string; status: number }[] = []
    page.on('response', resp => {
      if (resp.status() >= 500) {
        responses.push({ url: resp.url(), status: resp.status() })
      }
    })

    await page.goto(`${BASE}/exchange`, { waitUntil: 'networkidle' })

    if (responses.length > 0) {
      test.info().annotations.push({
        type: 'bug',
        description: `500 responses on /exchange: ${JSON.stringify(responses)}`,
      })
    }

    expect(responses.length).toBe(0)
  })
})

// ─── 8. Console errors per key page ──────────────────────────────────────────

test.describe('Guest Audit — Console error scan', () => {
  const pages = [
    { name: 'homepage', path: '/' },
    { name: 'books', path: '/books' },
    { name: 'exchange', path: '/exchange' },
    { name: 'community', path: '/community' },
  ]

  for (const { name, path } of pages) {
    test(`no critical JS errors on ${name}`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await screenshotStep(page, `08-console-${name}`)

      // Filter out known benign third-party noise
      const critical = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('gtag') &&
        !e.includes('analytics') &&
        !e.includes('ads') &&
        !e.includes('fonts.gstatic') &&
        !e.includes('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT') &&
        !e.toLowerCase().includes('third-party')
      )

      if (critical.length > 0) {
        test.info().annotations.push({
          type: 'bug',
          description: `Console errors on ${name}: ${critical.join(' | ')}`,
        })
      }

      // Soft assertion — log but don't hard-fail for non-critical
      expect(critical.length).toBe(0)
    })
  }
})
