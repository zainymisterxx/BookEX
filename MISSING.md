# BookEX — Verified Missing & Broken Items

> All items verified against actual source code. False positives removed.
> Last verified: 2026-05-29 | Last updated: 2026-05-30

**Progress: 101 fixed / 197 total — 96 remaining**

---

## 1. EXCHANGE FLOW

- [x] `rejectExchange()` Server Action does not exist — fixed: added in d4a72e7
- [x] `acceptExchange()` never touches the books collection — fixed: books go `reserved` in a transaction (28fb49b, d4a72e7)
- [x] No `reserved` or `on_hold` status type in `types.ts` BookStatus union — fixed: `on_hold` added d4a72e7; `reserved` was already present
- [x] `cancelExchange()` sets status to `cancelled` but never restores book statuses — fixed: books restored to `active` in d4a72e7
- [x] `confirmExchangeCompletion()` sends no email to either party on completion — fixed: emails sent to both parties on bothConfirmed
- [x] `proposeExchange()` never calls `createExchangeProposalNotification()` — fixed: d4a72e7
- [x] `acceptExchange()` never calls `createExchangeUpdateNotification()` — fixed: d4a72e7
- [x] `confirmExchangeCompletion()` creates no notification for either party — fixed: d4a72e7
- [x] `cancelExchange()` creates no notification — fixed: d4a72e7
- [ ] No timeout or auto-expiry for stale in-progress exchanges — if one party disappears, exchange is stuck forever
- [x] Exchange completion never auto-updates book status to `exchanged` — fixed: transaction in confirmExchangeCompletion handles this (5392b2f)
- [x] `canUserReview()` only checks for a duplicate review — fixed: requires completed exchange between users (0c534d6)
- [x] Socket: client hook emits `joinExchange`/`leaveExchange` but `server.ts` has no handlers — fixed: handlers exist at server.ts:288 (was false positive)

---

## 2. DONATION FLOW

- [x] `orgConfirmed` field never set to `true` — fixed: `confirmDonationOffer` action added (d0f4611)
- [x] `confirmDonationReceipt()` never updates Book documents — fixed: books set to `donated` (d0f4611)
- [x] `initiateDonation` non-atomic — fixed: core writes wrapped in MongoDB transaction (d0f4611)
- [ ] `DonationBook.bookId` is optional and typically unpopulated — no reliable link back to Book documents
- [x] `updateDonationBooks()` no existence or ownership validation — fixed: validates each book (d0f4611)
- [x] No donation history page — fixed: `/donate/history` added in 0c534d6
- [x] No public organization profile page — fixed: `/organizations/[id]` added (cd4883c)

---

## 3. AUTHENTICATION & ONBOARDING

- [x] Email verification unimplemented — fixed: token collection, verify-email page, signUpUser sends link (f6b2719)
- [x] `deactivateUser()` does not exist — fixed: cancels exchanges, restores books, sets deactivatedAt (f6b2719)
- [ ] No account recovery flow for deactivated accounts
- [x] `suspendUser()` stores no timestamps — fixed: suspendedAt + suspensionReason added (8d62a17)
- [ ] No email change verification
- [x] `signUpUser()` no DB unique index on email — fixed: sparse unique index added (f6b2719)
- [ ] Profile completion modal can be permanently dismissed via localStorage — incomplete profile is not blocked

---

## 4. BOOK LISTING & DISCOVERY

- [ ] `listBook()` has zero content moderation calls — books go live immediately with no toxicity/spam check
- [x] `deleteBook()` uses hard `deleteOne()` — fixed: soft delete with `deletedAt` (0c534d6)
- [ ] `intelligentBookSearch` and `generateBookSummary` AI flows implemented but never called from any UI
- [ ] `getBooksForSale()` uses `$regex` search; `getBooksForExchange()` uses MongoDB `$text` index — inconsistent strategy
- [x] `getBooksForSale()` no pagination — fixed: page/limit added, returns paginated envelope (8d62a17)
- [ ] No "My Books" management page for sellers — no Edit/Delete buttons on book detail page
- [x] No global `/search` results page — fixed: `/search` page added in 0c534d6
- [x] No exchange detail standalone page (`/exchange/[id]`) — fixed: added in cd4883c

---

## 5. MESSAGING

- [x] `startChat()` race condition — fixed: atomic findOneAndUpdate upsert (3f9bd00)
- [x] Socket `sendMessage` writes message to DB first, then emits — already guarded: emit is inside `if (modifiedCount > 0)` block (false positive)
- [ ] Unread count calculated two different ways in legacy vs new chat route handlers — no single source of truth
- [x] Blocking is one-directional — only blocker's `blockedUsers` array updated — fixed: blockUser/unblockUser now update both parties
- [x] `messagesRead` never emitted by `server.ts` — fixed: f4c6a89
- [x] `newChatCreated` never emitted by `server.ts` — fixed: f4c6a89
- [ ] Two competing Socket.IO implementations: `server.ts` (room `user_${id}`) vs `src/lib/socket-server.ts` (room `user:${id}`)

**Partially fixed (5fce5ca):**
- [x] `sendMessage` trusts client-provided `senderId` — fixed: uses `socket.userId`
- [x] `joinUserRoom` accepts any userId — fixed: verified against `socket.userId`
- [x] `joinChat` allows unauthenticated sockets — fixed: hard auth gate + participant check

---

## 6. COMMUNITY

- [x] `toggleCommunityMembership()` allows direct join regardless of `visibility: 'private'` — fixed: 0c534d6
- [x] Admin post delete is a silent soft-delete — fixed: post author notified in 0c534d6
- [ ] No comment locking (prevent further replies on a specific comment)
- [ ] No post moving between channels
- [ ] No bulk moderation actions (bulk delete, bulk ban)
- [ ] Moderators cannot edit other users' posts
- [ ] No moderator reaction removal
- [ ] Community moderation queue tab is explicitly coded as a stub: "will be implemented"
- [ ] Community analytics tab is explicitly coded as a stub: "will be displayed"

---

## 7. REVIEWS & RATINGS

- [x] `canUserReview()` only checks for a duplicate review — fixed: requires completed exchange (0c534d6)
- [x] `Review` interface has no `transactionId` field — fixed: transactionId added to Review interface in types.ts
- [x] Review received creates no in-app notification for the reviewee — fixed: 0c534d6

---

## 8. NOTIFICATIONS

- [x] Exchange proposal: `createExchangeProposalNotification()` never called by `proposeExchange()` — fixed: d4a72e7
- [x] Exchange accepted: `createExchangeUpdateNotification()` never called by `acceptExchange()` — fixed: d4a72e7
- [x] Exchange completed: no notification created — fixed: d4a72e7
- [x] Exchange cancelled: no notification created — fixed: d4a72e7
- [x] Review received: no notification created — fixed: 0c534d6
- [x] Admin moderated your content: no notification created — fixed: 0c534d6
- [ ] Community @mention: no @mention detection exists anywhere in the codebase
- [ ] Reply to your comment in a thread: no notification created
- [ ] New member joined your community: no notification created
- [ ] Book wishlisted by someone: one-way only
- [x] Report resolution does not notify the reporter — fixed: 0c534d6
- [ ] Notification preferences cover only 4 types — no preferences for: community mentions, comment replies, reviews, admin actions
- [ ] Weekly digest preference field exists in User type but no job ever sends it

---

## 9. ADMIN PANEL

- [ ] No book/listing management section — cannot view, search, remove, or feature any listing from admin
- [ ] No exchange/transaction oversight section — cannot view exchanges or intervene in disputes
- [ ] Audit log viewer missing — activity logs are written to DB but no admin UI reads them
- [ ] Report management UI missing — `getAdminReports()` Server Action exists but no admin tab surfaces it
- [ ] System settings are view-only — all "Configure" buttons have no `onClick` handlers
- [ ] No announcement/broadcast system
- [ ] No user search or filter in admin
- [ ] No bulk operations — no bulk suspend, bulk activate, bulk export
- [ ] No staff/admin management
- [ ] No analytics date range filter — charts have no date picker
- [ ] No dispute resolution tools
- [ ] No organization activity view or suspension capability
- [ ] Dashboard Quick Actions buttons have no `onClick` handlers — non-functional
- [x] `suspendUser()` and `removeContentAndResolveReport()` write no activity log entries — fixed: suspendUser now inserts to auditLogs
- [ ] Admin search API (`/api/admin/search`) exists but is not referenced by any admin UI tab

---

## 10. SOCKET.IO / REAL-TIME

- [ ] Socket.IO Redis adapter never initialized in `server.ts` — multi-server deployment: room broadcasts do not cross instances
- [ ] JWT verified only once at `authenticate` event — expired tokens accepted for the full session lifetime
- [x] `joinUserRoom` (server.ts:99) accepts client-provided `userId` with zero JWT verification — fixed: 5fce5ca
- [x] `joinChat` (server.ts:168) allows unauthenticated sockets to join any chat room — fixed: 5fce5ca
- [x] `sendMessage` (server.ts:204) trusts client-provided `senderId` — fixed: 5fce5ca
- [ ] No socket event emitted when a new book is listed
- [ ] No socket event emitted when a review is submitted
- [ ] Admin notification creation has explicit TODO comment — real-time emit not implemented

---

## 11. SECURITY & VALIDATION

- [ ] Only ~30 of 104 exported Server Actions have any Zod parsing
- [ ] `submitReport` — no Zod schema, no rate limit, no moderation, IDs not validated
- [ ] `submitReview` — no Zod schema, no moderation, no rate limit
- [ ] `confirmDonationReceipt` — `receiptData` accepted raw
- [ ] `editPost` — manual validation only, no re-moderation on edited content
- [ ] `startChat` — no input validation, no rate limit
- [ ] `applyForOrganization` — uses custom validator instead of Zod schema
- [x] No `src/middleware.ts` — fixed: added NextAuth route protection in 0c534d6
- [x] `resetPassword` has no rate limit — fixed: 0c534d6
- [x] 4 critical actions missing rate limits — fixed: submitReport, submitReview, startChat, blockUser (ac3bfa8)
- [ ] Auth rate limiting uses in-memory `Map` — resets on server restart, bypassed under load balancing
- [ ] NextAuth `authorize` handler never calls `recordAuthResult()` on failure — brute-force bypasses account lockout
- [ ] CSP header uses `'unsafe-eval'` + `'unsafe-inline'` in `script-src`
- [ ] Hardcoded `'dev-media-secret'` fallback in upload-token route
- [ ] Content moderation applied only to community posts/comments — missing from book listings, user bios, reviews, org descriptions

---

## 12. DATA MODEL — MISSING FIELDS

- [x] `User.emailVerified` (boolean) — fixed: added in f6b2719
- [x] `User.emailVerifiedAt` (ISO string) — fixed: added in f6b2719
- [x] `User.lastLoginAt` (ISO string) — fixed: added to types.ts
- [x] `User.failedLoginAttempts` (number) — fixed: added to types.ts
- [x] `User.suspendedAt` (ISO string) — fixed: added in 8d62a17
- [x] `User.suspensionReason` (string) — fixed: added in 8d62a17
- [x] `User.deactivatedAt` (ISO string) — fixed: added in f6b2719
- [x] `Book.viewCount` (number) — fixed: added to types.ts
- [x] `Book.contactCount` (number) — fixed: added to types.ts
- [x] `Book.reportCount` (number) — fixed: added to types.ts
- [x] `Exchange.disputeReason` (string) — fixed: added to types.ts
- [x] `Exchange.disputeOpenedAt` (ISO string) — fixed: added to types.ts
- [x] `Exchange.disputeResolvedAt` (ISO string) — fixed: added to types.ts
- [x] `Exchange.disputeResolvedBy` (string) — fixed: added to types.ts
- [x] `Exchange.timeline[]` (array of change events for full audit trail) — fixed: added to types.ts
- [x] `Chat.lastMessageAt` (ISO string) — fixed: added to types.ts
- [x] `Chat.lastMessagePreview` (string) — fixed: added to types.ts
- [x] `Chat.unreadCountByParticipant` ({userId: number}) — fixed: added to types.ts
- [x] `Review.transactionId` (ObjectId) — fixed: added to types.ts
- [x] `Community.postCount` (number, denormalized) — fixed: added to types.ts

---

## 13. DATA MODEL — MISSING COLLECTIONS

- [x] `email_verification_tokens` — fixed: collection + indexes added in f6b2719
- [x] `sessions` — fixed: collection indexes added (userId, TTL)
- [x] `feature_flags` — fixed: unique key index added
- [x] `search_analytics` — fixed: query + createdAt indexes added
- [x] `book_views` — fixed: bookId, userId+bookId, createdAt indexes added

---

## 14. DATABASE — MISSING INDEXES

- [x] `adminNotifications` collection — no indexes — fixed: 0c534d6
- [x] `notifications.{read, type}` compound index — fixed: 0c534d6
- [x] `organizations.{'representatives.userId'}` nested field index — fixed: 0c534d6
- [x] `comments.{postId, parentId}` compound index — fixed: 0c534d6
- [x] `books.deletedAt` sparse index — fixed: 0c534d6
- [x] `communities.deletedAt` sparse index — fixed: 0c534d6

---

## 15. SEARCH

- [ ] Sale books use `$regex`; exchange books use `$text` index — inconsistent on the same data type
- [ ] `levenshteinDistance()` implemented in `utils.ts` but never called from any search path
- [ ] User search (`/api/users/search`) has a hardcoded limit of 10 with no pagination support
- [ ] No community search endpoint
- [ ] No organization search endpoint
- [ ] No autocomplete or suggestion API
- [ ] No search analytics or query logging
- [x] No unified `/search` results page — fixed: 0c534d6

---

## 16. BACKGROUND JOBS (zero scheduled jobs exist in the codebase)

- [ ] Expired book listings cleanup — books past `expiresAt` stay visible forever
- [ ] Stale exchange auto-cancellation — exchanges stay `in_progress` permanently if a party disappears
- [ ] Weekly email digest — preference field exists in User type but nothing sends it
- [ ] Redis cache warming on cold restart
- [ ] Scheduled database maintenance
- [ ] Inactive user warning emails before suspension
- [ ] Donation follow-up reminders for pending donations

---

## 17. FRONTEND PAGES — MISSING OR INCOMPLETE

- [x] Donation history page — fixed: `/donate/history` added in 0c534d6
- [x] Global search results page (`/search`) — fixed: 0c534d6
- [x] Exchange detail standalone page — fixed: `/exchange/[id]` added (cd4883c)
- [ ] Book management page for sellers (My Listings with inline edit/delete)
- [ ] Public organization profile page (`/organizations/[id]`)
- [x] `loading.tsx` missing on `/books`, `/books/[id]`, `/exchange`, `/community` — fixed: 1e76334 (admin route doesn't exist yet)
- [x] `error.tsx` missing on same routes — fixed: 1e76334
- [x] No OpenGraph or Twitter Card meta tags on any dynamic page — fixed: root layout updated in 0c534d6
- [ ] Messages list missing: unread count badges, last message preview text, pin/archive actions

---

## 18. CONFIGURATION & DEPLOYMENT

- [ ] `media-api/server.ts:13` and 6 other files — hardcoded `'https://media.farya.pk'` fallback
- [ ] `src/lib/url-utils.ts:27` — hardcoded `'http://localhost:9002'` fallback
- [ ] `src/app/api/messages/.../read/route.ts:96` and `notification-utils.ts:156` — `'http://localhost:3001'` fallback
- [ ] `next.config.ts:128` — `process.env.VERCEL_URL` baked into CSP at build time
- [x] `.env.example` missing media API + admin env vars — fixed: 0c534d6
- [ ] `env-validation.ts` does not validate `MEDIA_API_SECRET`
- [ ] No `Dockerfile` or `docker-compose.yml`
- [ ] No `.github/workflows/` CI/CD pipeline
- [ ] No `vercel.json` — Socket.IO incompatible with Vercel serverless
- [x] No `public/robots.txt` — fixed: 0c534d6
- [x] No sitemap generation — fixed: `src/app/sitemap.ts` added in 0c534d6
- [x] No `public/manifest.json` (PWA support) — fixed: 0c534d6
- [x] No OpenGraph meta tags in root `layout.tsx` — fixed: 0c534d6
- [ ] `next.config.ts` image domains include `picsum.photos` and `placehold.co` (placeholder services)
- [x] No `/api/health` endpoint — fixed: 3f9bd00
- [ ] Media API not integrated into main `build` or `start` npm scripts

---

## 19. ERROR HANDLING — SILENT FAILURES

- [ ] Redis failure returns `allowed: true` for rate limit — limits silently disabled when Redis is down
- [ ] `initiateDonation` — 4-step operation with no MongoDB transaction
- [x] `resetPassword` — two separate `updateOne` calls, no transaction — fixed: 1a22983
- [x] `deleteReview` — delete + stats update not atomic — fixed: 1a22983
- [ ] Socket `sendMessage` broadcasts even when the DB `updateOne` fails
- [ ] Email failures after chat/exchange creation are only `console.warn`
- [ ] 10+ MongoDB `insertOne`/`updateOne` results not checked after the call
- [ ] 15+ missing null guards after `findOne`
- [ ] `redis-cache.ts` `get()` returns `null` on Redis error — callers cannot distinguish cache miss from Redis failure

---

## 20. TYPE SAFETY

- [ ] 25+ exported Server Actions have no return type annotation
- [ ] 150+ `as any` type assertions on MongoDB documents across `actions.ts` and `community-admin-actions.ts`
- [ ] 8 MongoDB update helper functions return `any` instead of `UpdateFilter<T>` (`mongodb-types.ts:119–195`)
- [ ] `Notification.metadata` and `AdminNotification.metadata` use `[key: string]: any` escape hatch
- [ ] Zod `bookSchema` does not include `titleNormalized`, `authorNormalized`, `duplicateHash`
- [ ] `UserRole` and `UserStatus` defined as inline string literals in 3+ places
- [ ] NextAuth `auth-config.ts` uses `(user as any).role` / `(user as any).status`
- [x] `mongodb-types.ts` `PostDocument` — fixed: isPinned, isLocked, deletedAt, deletedBy, status added
- [x] `mongodb-types.ts` `BookDocument` — fixed: all 6 fields added

---

**Total: 137 verified items | 71 fixed [x] | 66 remaining [ ]**

### Fixed summary by commit:
- **5392b2f** — exchange/donation core fixes (book status on completion, donation flow)
- **28fb49b** — 6 review findings (atomic book reservation, race conditions)
- **0c534d6** — parallel batch: 8 indexes, 2 pages, notifications, soft delete, middleware, infra
- **d4a72e7** — exchange state machines: on_hold/reserved, rejectExchange, all exchange notifications
- **d0f4611** — donation flow: book status on completion, org confirm action, atomic inserts, book validation
- **cd4883c** — new pages: /exchange/[id] detail + /organizations/[id] profile
- **bac8317** — email: migrate nodemailer → Resend SDK (16 functions, API key wired)

### Removed from original list (verified as already implemented):
- ~~No mark all as read~~ — exists in `notification-provider.tsx:96`
- ~~No DB unique constraint on reviews~~ — exists in `database-maintenance.ts:141`
- ~~Price not required for type=sale~~ — validated in `schemas.ts:69`
- ~~All 4 AI flows not wired to UI~~ — `analyzeBookCondition` wired to sell page, `getBookRecommendations` wired to floating assistant
- ~~No server-side HTML sanitization~~ — `sanitizeInput()` in `utils.ts` properly escapes HTML entities
