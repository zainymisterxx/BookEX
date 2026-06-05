# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: guest-audit.spec.ts >> Guest Audit — Console error scan >> no critical JS errors on homepage
- Location: tests/e2e/guest-audit.spec.ts:368:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 2
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
          - heading "Give Your Books a New Chapter" [level=1] [ref=e29]
          - paragraph [ref=e30]: Join a community of book lovers to buy, sell, and exchange stories. Discover hidden gems and share your own literary treasures.
          - generic [ref=e31]:
            - link "Explore Collection" [ref=e32] [cursor=pointer]:
              - /url: /books
              - text: Explore Collection
              - img [ref=e33]
            - link "List a Book" [ref=e35] [cursor=pointer]:
              - /url: /books/sell
        - generic [ref=e36]:
          - img "Book cover collage" [ref=e37]
          - img "Book cover collage" [ref=e38]
          - img "Book cover collage" [ref=e39]
      - generic [ref=e41]:
        - generic [ref=e42]:
          - heading "Freshly Listed" [level=2] [ref=e43]
          - paragraph [ref=e44]: These stories just hit our shelves. Be the first to discover a new adventure.
        - generic [ref=e45]:
          - link "Cover of 1984 sell 1984 by George Orwell Karachi View Seller PKR 700 used" [ref=e47] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b46b
            - generic [ref=e49]:
              - generic [ref=e50]:
                - img "Cover of 1984" [ref=e51]
                - generic [ref=e53]: sell
              - generic [ref=e54]:
                - generic [ref=e55]:
                  - generic [ref=e56]: "1984"
                  - generic [ref=e57]: by George Orwell
                  - generic [ref=e58]:
                    - generic [ref=e59]:
                      - img [ref=e60]
                      - generic [ref=e63]: Karachi
                    - button "View Seller" [ref=e64]
                - generic [ref=e65]:
                  - paragraph [ref=e66]: PKR 700
                  - generic [ref=e67]: used
          - link "Cover of The Hitchhiker's Guide to the Galaxy exchange The Hitchhiker's Guide to the Galaxy by Douglas Adams Karachi View Seller Exchange like new" [ref=e69] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b46a
            - generic [ref=e71]:
              - generic [ref=e72]:
                - img "Cover of The Hitchhiker's Guide to the Galaxy" [ref=e73]
                - generic [ref=e75]: exchange
              - generic [ref=e76]:
                - generic [ref=e77]:
                  - generic [ref=e78]: The Hitchhiker's Guide to the Galaxy
                  - generic [ref=e79]: by Douglas Adams
                  - generic [ref=e80]:
                    - generic [ref=e81]:
                      - img [ref=e82]
                      - generic [ref=e85]: Karachi
                    - button "View Seller" [ref=e86]
                - generic [ref=e87]:
                  - paragraph [ref=e88]: Exchange
                  - generic [ref=e89]: like new
          - 'link "Cover of Sherlock Holmes: Complete Collection exchange Sherlock Holmes: Complete Collection by Arthur Conan Doyle Lahore View Seller Exchange used" [ref=e91] [cursor=pointer]':
            - /url: /books/699f190dc397439b6362b46d
            - generic [ref=e93]:
              - generic [ref=e94]:
                - 'img "Cover of Sherlock Holmes: Complete Collection" [ref=e95]'
                - generic [ref=e97]: exchange
              - generic [ref=e98]:
                - generic [ref=e99]:
                  - generic [ref=e100]: "Sherlock Holmes: Complete Collection"
                  - generic [ref=e101]: by Arthur Conan Doyle
                  - generic [ref=e102]:
                    - generic [ref=e103]:
                      - img [ref=e104]
                      - generic [ref=e107]: Lahore
                    - button "View Seller" [ref=e108]
                - generic [ref=e109]:
                  - paragraph [ref=e110]: Exchange
                  - generic [ref=e111]: used
          - link "Cover of The Alchemist exchange The Alchemist by Paulo Coelho Karachi View Seller Exchange like new" [ref=e113] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b46c
            - generic [ref=e115]:
              - generic [ref=e116]:
                - img "Cover of The Alchemist" [ref=e117]
                - generic [ref=e119]: exchange
              - generic [ref=e120]:
                - generic [ref=e121]:
                  - generic [ref=e122]: The Alchemist
                  - generic [ref=e123]: by Paulo Coelho
                  - generic [ref=e124]:
                    - generic [ref=e125]:
                      - img [ref=e126]
                      - generic [ref=e129]: Karachi
                    - button "View Seller" [ref=e130]
                - generic [ref=e131]:
                  - paragraph [ref=e132]: Exchange
                  - generic [ref=e133]: like new
          - link "Cover of Pride and Prejudice exchange Pride and Prejudice by Jane Austen Lahore View Seller Exchange worn" [ref=e135] [cursor=pointer]:
            - /url: /books/699f190dc397439b6362b469
            - generic [ref=e137]:
              - generic [ref=e138]:
                - img "Cover of Pride and Prejudice" [ref=e139]
                - generic [ref=e141]: exchange
              - generic [ref=e142]:
                - generic [ref=e143]:
                  - generic [ref=e144]: Pride and Prejudice
                  - generic [ref=e145]: by Jane Austen
                  - generic [ref=e146]:
                    - generic [ref=e147]:
                      - img [ref=e148]
                      - generic [ref=e151]: Lahore
                    - button "View Seller" [ref=e152]
                - generic [ref=e153]:
                  - paragraph [ref=e154]: Exchange
                  - generic [ref=e155]: worn
        - link "Browse All Listings" [ref=e157] [cursor=pointer]:
          - /url: /books
          - text: Browse All Listings
          - img [ref=e158]
      - generic [ref=e161]:
        - generic [ref=e162]:
          - heading "A World of Stories Awaits" [level=2] [ref=e163]
          - paragraph [ref=e164]: Engage with our community in three simple ways.
        - generic [ref=e165]:
          - generic [ref=e166]:
            - generic [ref=e167]:
              - img [ref=e169]
              - heading "Buy & Sell" [level=3] [ref=e172]
            - paragraph [ref=e174]: Find incredible deals on second-hand books or list your own to declutter and earn.
          - generic [ref=e175]:
            - generic [ref=e176]:
              - img [ref=e178]
              - heading "Exchange" [level=3] [ref=e183]
            - paragraph [ref=e185]: Swap books with fellow readers in your city. A cost-effective way to refresh your reading list.
          - generic [ref=e186]:
            - generic [ref=e187]:
              - img [ref=e189]
              - heading "Join the Community" [level=3] [ref=e194]
            - paragraph [ref=e196]: Connect with like-minded readers, discuss your favorite genres, and get amazing recommendations.
      - generic [ref=e198]:
        - generic [ref=e199]:
          - heading "Find Your Niche" [level=2] [ref=e200]
          - paragraph [ref=e201]: From sci-fi fanatics to history buffs, there's a group for everyone.
        - generic [ref=e202]:
          - link "BookEx Readers Lounge BookEx Readers Lounge The official BookEx community for book lovers! Share recommendations, discuss your favourites, and find your next great read. 3 members Join Now" [ref=e204] [cursor=pointer]:
            - /url: /community/699f190dc397439b6362b46e
            - img "BookEx Readers Lounge" [ref=e206]
            - generic [ref=e207]:
              - heading "BookEx Readers Lounge" [level=3] [ref=e208]
              - paragraph [ref=e209]: The official BookEx community for book lovers! Share recommendations, discuss your favourites, and find your next great read.
              - generic [ref=e210]:
                - generic [ref=e211]:
                  - img [ref=e212]
                  - generic [ref=e217]: 3 members
                - generic [ref=e218]:
                  - text: Join Now
                  - img [ref=e219]
          - link "Lahori Book Lahori Book Lahore community 1 members Join Now" [ref=e222] [cursor=pointer]:
            - /url: /community/69afcdb52c8d27125663abc7
            - img "Lahori Book" [ref=e224]
            - generic [ref=e225]:
              - heading "Lahori Book" [level=3] [ref=e226]
              - paragraph [ref=e227]: Lahore community
              - generic [ref=e228]:
                - generic [ref=e229]:
                  - img [ref=e230]
                  - generic [ref=e235]: 1 members
                - generic [ref=e236]:
                  - text: Join Now
                  - img [ref=e237]
    - contentinfo [ref=e239]:
      - generic [ref=e240]:
        - generic [ref=e241]:
          - generic [ref=e242]:
            - link "BookEx" [ref=e243] [cursor=pointer]:
              - /url: /
              - img [ref=e244]
              - generic [ref=e246]: BookEx
            - paragraph [ref=e247]: Your community for buying, selling, and exchanging pre-loved books. Give your stories a new home.
          - generic [ref=e248]:
            - heading "BookEx" [level=3] [ref=e249]
            - list [ref=e250]:
              - listitem [ref=e251]:
                - link "Buy" [ref=e252] [cursor=pointer]:
                  - /url: /books
              - listitem [ref=e253]:
                - link "Exchange" [ref=e254] [cursor=pointer]:
                  - /url: /exchange
              - listitem [ref=e255]:
                - link "Donate" [ref=e256] [cursor=pointer]:
                  - /url: /donate
          - generic [ref=e257]:
            - heading "Community" [level=3] [ref=e258]
            - list [ref=e259]:
              - listitem [ref=e260]:
                - link "Discussions" [ref=e261] [cursor=pointer]:
                  - /url: /community
              - listitem [ref=e262]:
                - link "My Profile" [ref=e263] [cursor=pointer]:
                  - /url: /profile/me
          - generic [ref=e264]:
            - heading "Join Our Newsletter" [level=3] [ref=e265]
            - paragraph [ref=e266]: Get the latest updates on new listings and community events.
            - generic [ref=e267]:
              - textbox "Email" [ref=e268]
              - button "Subscribe" [ref=e269] [cursor=pointer]
        - paragraph [ref=e271]: © 2026 BookEx. All rights reserved.
    - button "Open AI Assistant" [ref=e272] [cursor=pointer]:
      - img [ref=e273]
      - generic [ref=e275]: Open AI Assistant
  - region "Notifications (F8)":
    - list
  - alert [ref=e276]
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