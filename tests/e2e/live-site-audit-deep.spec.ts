/**
 * Deep audit pass — identifies the failing 500 resource and checks
 * auth-guarded nav items more precisely.
 */
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
    errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`)
  })
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failed.push({ url: resp.url(), status: resp.status() })
    }
  })
  return { errors, failed }
}

test('identify 500 resource on homepage', async ({ page }) => {
  const { errors, failed } = collectAll(page)
  await page.goto(SITE, { waitUntil: 'networkidle' })

  console.log(`FAILED_RESOURCES: ${JSON.stringify(failed)}`)
  console.log(`ALL_ERRORS: ${JSON.stringify(errors)}`)
})

test('identify 500 resource on /exchange redirect', async ({ page }) => {
  const { errors, failed } = collectAll(page)
  await page.goto(`${SITE}/exchange`, { waitUntil: 'networkidle' })

  console.log(`EXCHANGE_FAILED_RESOURCES: ${JSON.stringify(failed)}`)
  console.log(`EXCHANGE_ALL_ERRORS: ${JSON.stringify(errors)}`)
  console.log(`EXCHANGE_FINAL_URL: ${page.url()}`)

  const h1 = await page.locator('h1').first().textContent().catch(() => 'none')
  const heading = await page.locator('[class*="heading"], [class*="title"]').first().textContent().catch(() => 'none')
  console.log(`EXCHANGE_PAGE_H1: ${h1}`)
  console.log(`EXCHANGE_PAGE_HEADING: ${heading}`)
})

test('footer link /profile/me — guest behavior', async ({ page }) => {
  const { errors, failed } = collectAll(page)
  // Use domcontentloaded so we don't wait forever on a stuck page
  await page.goto(`${SITE}/profile/me`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
  // Give it a bit more time
  await page.waitForTimeout(3000)

  const finalUrl = page.url()
  console.log(`PROFILE_ME_URL: ${finalUrl}`)
  console.log(`PROFILE_ME_FAILED: ${JSON.stringify(failed)}`)
  console.log(`PROFILE_ME_ERRORS: ${JSON.stringify(errors)}`)

  const h1 = await page.locator('h1').first().textContent().catch(() => 'none')
  const bodyText = await page.locator('body').innerText().catch(() => '').then(t => t.slice(0, 300))
  console.log(`PROFILE_ME_H1: ${h1}`)
  console.log(`PROFILE_ME_BODY: ${bodyText}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/profile-me-guest.png', fullPage: true })
})

test('books page — full resource check', async ({ page }) => {
  const { errors, failed } = collectAll(page)
  await page.goto(`${SITE}/books`, { waitUntil: 'networkidle' })

  console.log(`BOOKS_FAILED_RESOURCES: ${JSON.stringify(failed)}`)
  console.log(`BOOKS_ALL_ERRORS: ${JSON.stringify(errors)}`)

  const bookCards = await page.locator('[data-testid*="book"], [class*="book-card"], article, [class*="card"]').count()
  console.log(`BOOKS_CARD_COUNT: ${bookCards}`)
})

test('mobile — check nav menu toggle at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const { errors, failed } = collectAll(page)

  await page.goto(SITE, { waitUntil: 'networkidle' })

  const buttons = await page.locator('button').all()
  const buttonData: { text: string; ariaLabel: string; class: string }[] = []
  for (const btn of buttons) {
    const text = (await btn.textContent())?.trim() ?? ''
    const ariaLabel = (await btn.getAttribute('aria-label')) ?? ''
    const cls = (await btn.getAttribute('class')) ?? ''
    buttonData.push({ text, ariaLabel, class: cls })
  }
  console.log(`MOBILE_BUTTONS: ${JSON.stringify(buttonData)}`)

  const navLinks = await page.locator('nav a, header a').all()
  const visibleLinks: string[] = []
  for (const link of navLinks) {
    const visible = await link.isVisible()
    const text = (await link.textContent())?.trim() ?? ''
    if (visible) visibleLinks.push(text)
  }
  console.log(`MOBILE_VISIBLE_NAV_LINKS: ${JSON.stringify(visibleLinks)}`)
  console.log(`MOBILE_FAILED: ${JSON.stringify(failed)}`)
  console.log(`MOBILE_ERRORS: ${JSON.stringify(errors)}`)

  await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/mobile-nav.png', fullPage: false })

  // Click the hamburger menu toggle
  const toggle = page.locator('button').filter({ hasText: 'Toggle navigation menu' }).first()
  if (await toggle.count() > 0) {
    await toggle.click()
    await page.waitForTimeout(500)
    const afterToggleLinks = await page.locator('nav a, header a, [role="menu"] a').all()
    const afterVisible: string[] = []
    for (const link of afterToggleLinks) {
      const visible = await link.isVisible()
      const text = (await link.textContent())?.trim() ?? ''
      if (visible) afterVisible.push(text)
    }
    console.log(`MOBILE_AFTER_TOGGLE_LINKS: ${JSON.stringify(afterVisible)}`)
    await page.screenshot({ path: '/Users/ahmed/Desktop/BookEX/test-results/mobile-nav-open.png', fullPage: false })
  }
})
