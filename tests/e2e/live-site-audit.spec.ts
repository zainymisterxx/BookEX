/**
 * Live site audit — tests run directly against https://bookex.farya.pk
 * No auth, no local server needed.
 */
import { test, expect, Page } from '@playwright/test'

const SITE = 'https://bookex.farya.pk'

// Collect console errors per test
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))
  return errors
}

// ── 1. Exchange page (guest) ──────────────────────────────────────────────────
test('exchange page — guest redirect or state', async ({ page }) => {
  const errors = collectConsoleErrors(page)

  const response = await page.goto(`${SITE}/exchange`, { waitUntil: 'networkidle' })

  const finalUrl = page.url()
  const statusCode = response?.status() ?? 0

  // Capture for reporting
  console.log(`EXCHANGE_FINAL_URL: ${finalUrl}`)
  console.log(`EXCHANGE_STATUS: ${statusCode}`)
  console.log(`EXCHANGE_ERRORS: ${JSON.stringify(errors)}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/exchange-guest.png', fullPage: true })
})

// ── 2. Homepage navigation ────────────────────────────────────────────────────
test('homepage — loads and nav links visible', async ({ page }) => {
  const errors = collectConsoleErrors(page)

  const response = await page.goto(SITE, { waitUntil: 'networkidle' })
  const statusCode = response?.status() ?? 0

  console.log(`HOME_STATUS: ${statusCode}`)
  console.log(`HOME_URL: ${page.url()}`)

  // Collect all nav links
  const navLinks = await page.locator('nav a, header a').all()
  const linkData: { text: string; href: string }[] = []
  for (const link of navLinks) {
    const text = (await link.textContent())?.trim() ?? ''
    const href = (await link.getAttribute('href')) ?? ''
    if (text || href) linkData.push({ text, href })
  }
  console.log(`NAV_LINKS: ${JSON.stringify(linkData)}`)
  console.log(`HOME_ERRORS: ${JSON.stringify(errors)}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/homepage.png', fullPage: true })
})

// ── 3. Click every nav link ───────────────────────────────────────────────────
test('nav links — click each and check for 404 or errors', async ({ page }) => {
  await page.goto(SITE, { waitUntil: 'networkidle' })

  const navLinks = await page.locator('nav a, header a').all()
  const hrefs: string[] = []
  for (const link of navLinks) {
    const href = (await link.getAttribute('href')) ?? ''
    if (href && href.startsWith('/') && !href.startsWith('//')) hrefs.push(href)
  }

  // Deduplicate
  const unique = [...new Set(hrefs)]
  console.log(`NAV_HREFS_TO_TEST: ${JSON.stringify(unique)}`)

  const results: { href: string; status: number; url: string; errors: string[] }[] = []

  for (const href of unique) {
    const errors = collectConsoleErrors(page)
    const res = await page.goto(`${SITE}${href}`, { waitUntil: 'networkidle' })
    const status = res?.status() ?? 0
    const finalUrl = page.url()

    // Check for visible 404 text
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const has404Text = /404|not found|page not found/i.test(bodyText)

    results.push({ href, status, url: finalUrl, errors: [...errors] })
    console.log(`NAV_RESULT: ${JSON.stringify({ href, status, finalUrl, errorCount: errors.length, has404Text })}`)

    await page.screenshot({
      path: `/Users/ahmed/Desktop/BookEX/test-results/nav-${href.replace(/\//g, '_') || 'root'}.png`,
      fullPage: true
    })
  }

  console.log(`NAV_SUMMARY: ${JSON.stringify(results)}`)
})

// ── 4. Footer links ───────────────────────────────────────────────────────────
test('footer — links visible and clickable', async ({ page }) => {
  const errors = collectConsoleErrors(page)

  await page.goto(SITE, { waitUntil: 'networkidle' })

  const footerLinks = await page.locator('footer a').all()
  const footerData: { text: string; href: string }[] = []
  for (const link of footerLinks) {
    const text = (await link.textContent())?.trim() ?? ''
    const href = (await link.getAttribute('href')) ?? ''
    footerData.push({ text, href })
  }

  console.log(`FOOTER_LINKS: ${JSON.stringify(footerData)}`)
  console.log(`FOOTER_ERRORS: ${JSON.stringify(errors)}`)

  const footerEl = page.locator('footer')
  const footerExists = await footerEl.count()
  console.log(`FOOTER_EXISTS: ${footerExists > 0}`)

  if (footerExists > 0) {
    await footerEl.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/footer.png' })
  }
})

// ── 5. Mobile viewport (375px) ───────────────────────────────────────────────
test('mobile viewport — homepage layout at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const errors = collectConsoleErrors(page)

  await page.goto(SITE, { waitUntil: 'networkidle' })

  console.log(`MOBILE_ERRORS: ${JSON.stringify(errors)}`)

  // Check for horizontal overflow (sign of broken layout)
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  const viewportWidth = await page.evaluate(() => window.innerWidth)
  const hasHorizontalOverflow = bodyWidth > viewportWidth + 5 // 5px tolerance

  console.log(`MOBILE_BODY_WIDTH: ${bodyWidth}`)
  console.log(`MOBILE_VIEWPORT_WIDTH: ${viewportWidth}`)
  console.log(`MOBILE_HORIZONTAL_OVERFLOW: ${hasHorizontalOverflow}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/mobile-375.png', fullPage: true })

  // Check mobile menu / hamburger
  const hamburger = await page.locator('[aria-label*="menu" i], [aria-label*="nav" i], button[class*="hamburger" i], button[class*="mobile" i], [data-testid*="menu" i]').count()
  console.log(`MOBILE_HAMBURGER_FOUND: ${hamburger > 0}`)

  // Check exchange page on mobile
  await page.goto(`${SITE}/exchange`, { waitUntil: 'networkidle' })
  const mobileExchangeUrl = page.url()
  console.log(`MOBILE_EXCHANGE_URL: ${mobileExchangeUrl}`)
  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/mobile-exchange.png', fullPage: true })
})
