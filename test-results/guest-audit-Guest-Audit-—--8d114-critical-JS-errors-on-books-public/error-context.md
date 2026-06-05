# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-audit.spec.ts >> Guest Audit — Console error scan >> no critical JS errors on books
- Location: tests/e2e/guest-audit.spec.ts:368:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "BookEx" [ref=e6] [cursor=pointer]:
          - /url: /
          - img [ref=e7]
          - generic [ref=e9]: BookEx
        - navigation [ref=e10]:
          - link "Buy" [ref=e11] [cursor=pointer]:
            - /url: /books
          - link "Exchange" [ref=e12] [cursor=pointer]:
            - /url: /exchange
          - link "Community" [ref=e13] [cursor=pointer]:
            - /url: /community
          - link "Chat" [ref=e14] [cursor=pointer]:
            - /url: /messages
          - link "Donate" [ref=e15] [cursor=pointer]:
            - /url: /donate
        - generic [ref=e16]:
          - generic [ref=e17]:
            - searchbox "Search books..." [ref=e18]
            - img [ref=e19]
          - generic [ref=e22]:
            - button "Login" [ref=e23] [cursor=pointer]
            - button "Sign Up" [ref=e24] [cursor=pointer]
    - main [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e28]:
          - heading "Buy Books" [level=1] [ref=e29]
          - paragraph [ref=e30]: Browse through a collection of books from sellers in our community. Find your next favorite read.
        - generic [ref=e32]:
          - generic [ref=e33]:
            - textbox "Search by title, author, or description..." [ref=e34]
            - img [ref=e35]
          - generic [ref=e38]:
            - combobox [ref=e39] [cursor=pointer]:
              - img [ref=e40]
              - generic: Relevance
              - img [ref=e43]
            - button "Toggle advanced filters" [ref=e46] [cursor=pointer]:
              - img [ref=e47]
        - heading "4 books found" [level=2] [ref=e50]
        - generic [ref=e51]:
          - link "Cover of 1984 sell 1984 by George Orwell Karachi View Seller PKR 700 used" [ref=e53] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b46b
            - generic [ref=e55]:
              - generic [ref=e56]:
                - img "Cover of 1984" [ref=e57]
                - generic [ref=e59]: sell
              - generic [ref=e60]:
                - generic [ref=e61]:
                  - generic [ref=e62]: "1984"
                  - generic [ref=e63]: by George Orwell
                  - generic [ref=e64]:
                    - generic [ref=e65]:
                      - img [ref=e66]
                      - generic [ref=e69]: Karachi
                    - button "View Seller" [ref=e70]
                - generic [ref=e71]:
                  - paragraph [ref=e72]: PKR 700
                  - generic [ref=e73]: used
          - 'link "Cover of Mistborn: The Final Empire sell Mistborn: The Final Empire by Brandon Sanderson Lahore View Seller PKR 850 new" [ref=e75] [cursor=pointer]':
            - /url: /books/699f190dc397439b6362b464
            - generic [ref=e77]:
              - generic [ref=e78]:
                - 'img "Cover of Mistborn: The Final Empire" [ref=e79]'
                - generic [ref=e81]: sell
              - generic [ref=e82]:
                - generic [ref=e83]:
                  - generic [ref=e84]: "Mistborn: The Final Empire"
                  - generic [ref=e85]: by Brandon Sanderson
                  - generic [ref=e86]:
                    - generic [ref=e87]:
                      - img [ref=e88]
                      - generic [ref=e91]: Lahore
                    - button "View Seller" [ref=e92]
                - generic [ref=e93]:
                  - paragraph [ref=e94]: PKR 850
                  - generic [ref=e95]: new
          - link "Cover of Sapiens sell Sapiens by Yuval Noah Harari Islamabad View Seller PKR 1,200 like new" [ref=e97] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b466
            - generic [ref=e99]:
              - generic [ref=e100]:
                - img "Cover of Sapiens" [ref=e101]
                - generic [ref=e103]: sell
              - generic [ref=e104]:
                - generic [ref=e105]:
                  - generic [ref=e106]: Sapiens
                  - generic [ref=e107]: by Yuval Noah Harari
                  - generic [ref=e108]:
                    - generic [ref=e109]:
                      - img [ref=e110]
                      - generic [ref=e113]: Islamabad
                    - button "View Seller" [ref=e114]
                - generic [ref=e115]:
                  - paragraph [ref=e116]: PKR 1,200
                  - generic [ref=e117]: like new
          - link "Cover of Atomic Habits sell Atomic Habits by James Clear Lahore View Seller PKR 950 new" [ref=e119] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b468
            - generic [ref=e121]:
              - generic [ref=e122]:
                - img "Cover of Atomic Habits" [ref=e123]
                - generic [ref=e125]: sell
              - generic [ref=e126]:
                - generic [ref=e127]:
                  - generic [ref=e128]: Atomic Habits
                  - generic [ref=e129]: by James Clear
                  - generic [ref=e130]:
                    - generic [ref=e131]:
                      - img [ref=e132]
                      - generic [ref=e135]: Lahore
                    - button "View Seller" [ref=e136]
                - generic [ref=e137]:
                  - paragraph [ref=e138]: PKR 950
                  - generic [ref=e139]: new
    - contentinfo [ref=e140]:
      - generic [ref=e141]:
        - generic [ref=e142]:
          - generic [ref=e143]:
            - link "BookEx" [ref=e144] [cursor=pointer]:
              - /url: /
              - img [ref=e145]
              - generic [ref=e147]: BookEx
            - paragraph [ref=e148]: Your community for buying, selling, and exchanging pre-loved books. Give your stories a new home.
          - generic [ref=e149]:
            - heading "BookEx" [level=3] [ref=e150]
            - list [ref=e151]:
              - listitem [ref=e152]:
                - link "Buy" [ref=e153] [cursor=pointer]:
                  - /url: /books
              - listitem [ref=e154]:
                - link "Exchange" [ref=e155] [cursor=pointer]:
                  - /url: /exchange
              - listitem [ref=e156]:
                - link "Donate" [ref=e157] [cursor=pointer]:
                  - /url: /donate
          - generic [ref=e158]:
            - heading "Community" [level=3] [ref=e159]
            - list [ref=e160]:
              - listitem [ref=e161]:
                - link "Discussions" [ref=e162] [cursor=pointer]:
                  - /url: /community
              - listitem [ref=e163]:
                - link "My Profile" [ref=e164] [cursor=pointer]:
                  - /url: /profile/me
          - generic [ref=e165]:
            - heading "Join Our Newsletter" [level=3] [ref=e166]
            - paragraph [ref=e167]: Get the latest updates on new listings and community events.
            - generic [ref=e168]:
              - textbox "Email" [ref=e169]
              - button "Subscribe" [ref=e170] [cursor=pointer]
        - paragraph [ref=e172]: © 2026 BookEx. All rights reserved.
    - button "Open AI Assistant" [ref=e173] [cursor=pointer]:
      - img [ref=e174]
      - generic [ref=e176]: Open AI Assistant
  - region "Notifications (F8)":
    - list
  - alert [ref=e177]
```

# Test source

```ts
  297 |     const emptyPosts = page.locator('text=/no post|be the first/i').first()
  298 |     const hasPostArea = await posts.isVisible().catch(() => false) ||
  299 |                         await emptyPosts.isVisible().catch(() => false) ||
  300 |                         await page.locator('main').isVisible()
  301 |     expect(hasPostArea).toBeTruthy()
  302 | 
  303 |     ;(test.info() as any)._consoleErrors = errors
  304 |   })
  305 | })
  306 | 
  307 | // ─── 7. /exchange as guest ────────────────────────────────────────────────────
  308 | 
  309 | test.describe('Guest Audit — Exchange page', () => {
  310 |   test('exchange listing page loads for guest', async ({ page }) => {
  311 |     const errors = collectConsoleErrors(page)
  312 | 
  313 |     await page.goto(`${BASE}/exchange`, { waitUntil: 'networkidle' })
  314 |     await screenshotStep(page, '07-exchange-guest')
  315 | 
  316 |     await expect(page).not.toHaveURL(/\/error\b/i)
  317 |     await expect(page.locator('main')).toBeVisible()
  318 | 
  319 |     // Should show book cards OR empty state OR auth gate — anything but a crash
  320 |     const heading = page.locator('h1').first()
  321 |     const hasHeading = await heading.isVisible().catch(() => false)
  322 |     const hasMain = await page.locator('main').isVisible()
  323 |     expect(hasMain).toBeTruthy()
  324 | 
  325 |     if (hasHeading) {
  326 |       const text = await heading.textContent()
  327 |       test.info().annotations.push({ type: 'info', description: `Exchange page h1: "${text}"` })
  328 |     }
  329 | 
  330 |     const urlAfter = page.url()
  331 |     test.info().annotations.push({ type: 'info', description: `Exchange final URL: ${urlAfter}` })
  332 | 
  333 |     ;(test.info() as any)._consoleErrors = errors
  334 |   })
  335 | 
  336 |   test('exchange page does not hard-crash with 500 error', async ({ page }) => {
  337 |     const responses: { url: string; status: number }[] = []
  338 |     page.on('response', resp => {
  339 |       if (resp.status() >= 500) {
  340 |         responses.push({ url: resp.url(), status: resp.status() })
  341 |       }
  342 |     })
  343 | 
  344 |     await page.goto(`${BASE}/exchange`, { waitUntil: 'networkidle' })
  345 | 
  346 |     if (responses.length > 0) {
  347 |       test.info().annotations.push({
  348 |         type: 'bug',
  349 |         description: `500 responses on /exchange: ${JSON.stringify(responses)}`,
  350 |       })
  351 |     }
  352 | 
  353 |     expect(responses.length).toBe(0)
  354 |   })
  355 | })
  356 | 
  357 | // ─── 8. Console errors per key page ──────────────────────────────────────────
  358 | 
  359 | test.describe('Guest Audit — Console error scan', () => {
  360 |   const pages = [
  361 |     { name: 'homepage', path: '/' },
  362 |     { name: 'books', path: '/books' },
  363 |     { name: 'exchange', path: '/exchange' },
  364 |     { name: 'community', path: '/community' },
  365 |   ]
  366 | 
  367 |   for (const { name, path } of pages) {
  368 |     test(`no critical JS errors on ${name}`, async ({ page }) => {
  369 |       const errors: string[] = []
  370 |       page.on('console', msg => {
  371 |         if (msg.type() === 'error') errors.push(msg.text())
  372 |       })
  373 |       page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))
  374 | 
  375 |       await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  376 |       await screenshotStep(page, `08-console-${name}`)
  377 | 
  378 |       // Filter out known benign third-party noise
  379 |       const critical = errors.filter(e =>
  380 |         !e.includes('favicon') &&
  381 |         !e.includes('gtag') &&
  382 |         !e.includes('analytics') &&
  383 |         !e.includes('ads') &&
  384 |         !e.includes('fonts.gstatic') &&
  385 |         !e.includes('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT') &&
  386 |         !e.toLowerCase().includes('third-party')
  387 |       )
  388 | 
  389 |       if (critical.length > 0) {
  390 |         test.info().annotations.push({
  391 |           type: 'bug',
  392 |           description: `Console errors on ${name}: ${critical.join(' | ')}`,
  393 |         })
  394 |       }
  395 | 
  396 |       // Soft assertion — log but don't hard-fail for non-critical
> 397 |       expect(critical.length).toBe(0)
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  398 |     })
  399 |   }
  400 | })
  401 | 
```