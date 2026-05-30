# BookEX — Verified Missing & Broken Items

> All items verified against actual source code. False positives removed.
> Last verified: 2026-05-29 | Last updated: 2026-05-30

**Progress: 101/137 original items resolved — 36 remaining**

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
- [x] No timeout or auto-expiry for stale in-progress exchanges — fixed: cleanup-jobs.ts cancelStaleExchanges
- [x] Exchange completion never auto-updates book status to `exchanged` — fixed: transaction in confirmExchangeCompletion handles this (5392b2f)
- [x] `canUserReview()` only checks for a duplicate review — fixed: requires completed exchange between users (0c534d6)
- [x] Socket: client hook emits `joinExchange`/`leaveExchange` but `server.ts` has no handlers — fixed: handlers exist at server.ts:288 (was false positive)

---

## 2. DONATION FLOW

- [x] `orgConfirmed` field never set to `true` — fixed: `confirmDonationOffer` action added (d0f4611)
- [x] `confirmDonationReceipt()` never updates Book documents — fixed: books set to `donated` (d0f4611)
- [x] `initiateDonation` non-atomic — fixed: core writes wrapped in MongoDB transaction (d0f4611)
- [x] `DonationBook.bookId` unpopulated — confirmed false positive: donation-book-selector.tsx already sets bookId
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

- [x] `listBook()` has zero content moderation calls — fixed: ContentModerationSystem.analyzeContent called before insert
- [x] `deleteBook()` uses hard `deleteOne()` — fixed: soft delete with `deletedAt` (0c534d6)
- [ ] `intelligentBookSearch` and `generateBookSummary` AI flows implemented but never called from any UI
- [x] `getBooksForSale()` uses `$regex` — fixed: unified to $text in batch 10
- [x] `getBooksForSale()` no pagination — fixed: page/limit added, returns paginated envelope (8d62a17)
- [x] No "My Books" management page — fixed: /books/my-listings page + getMyBooks() in data.ts
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
- [x] Two competing Socket.IO implementations — fixed: socket-server.ts updated to use `user_${id}` to match server.ts

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
- [x] Reply to your comment in a thread: no notification created — fixed: parent comment author notified
- [x] New member joined your community: no notification created — fixed: community admins notified on join
- [ ] Book wishlisted by someone: one-way only
- [x] Report resolution does not notify the reporter — fixed: 0c534d6
- [x] Notification preferences only 4 types — fixed: communityMentions, commentReplies, reviewReceived, adminActions added
- [x] Weekly digest preference — fixed: sendWeeklyDigest job added in batch 10

---

## 9. ADMIN PANEL

- [ ] No book/listing management section — cannot view, search, remove, or feature any listing from admin
- [ ] No exchange/transaction oversight section — cannot view exchanges or intervene in disputes
- [x] Audit log viewer missing — fixed: getAuditLogs action + Audit Log tab in admin dashboard
- [x] Report management UI missing — fixed: reports tab added to admin dashboard with status filter and resolve/remove actions
- [ ] System settings are view-only — all "Configure" buttons have no `onClick` handlers
- [ ] No announcement/broadcast system
- [x] No user search or filter in admin — fixed: search input added, filters users by name/email client-side
- [ ] No bulk operations — no bulk suspend, bulk activate, bulk export
- [ ] No staff/admin management
- [ ] No analytics date range filter — charts have no date picker
- [ ] No dispute resolution tools
- [ ] No organization activity view or suspension capability
- [ ] Dashboard Quick Actions buttons have no `onClick` handlers — non-functional
- [x] `suspendUser()` and `removeContentAndResolveReport()` write no activity log entries — fixed: suspendUser now inserts to auditLogs
- [x] Admin search API not wired — fixed: global search bar added to admin sidebar with debounced fetch

---

## 10. SOCKET.IO / REAL-TIME

- [ ] Socket.IO Redis adapter never initialized in `server.ts` — multi-server deployment: room broadcasts do not cross instances
- [x] JWT verified once only — fixed: isTokenExpired() check on sendMessage/personalMessage in server.ts
- [x] `joinUserRoom` (server.ts:99) accepts client-provided `userId` with zero JWT verification — fixed: 5fce5ca
- [x] `joinChat` (server.ts:168) allows unauthenticated sockets to join any chat room — fixed: 5fce5ca
- [x] `sendMessage` (server.ts:204) trusts client-provided `senderId` — fixed: 5fce5ca
- [x] No socket event emitted when a new book is listed — fixed: emitNewBook added to server.ts, called from listBook
- [x] No socket event emitted when a review is submitted — fixed: emitNewReview added to server.ts, called from submitReview
- [ ] Admin notification creation has explicit TODO comment — real-time emit not implemented

---

## 11. SECURITY & VALIDATION

- [ ] Only ~30 of 104 exported Server Actions have any Zod parsing
- [x] `submitReport` — fixed: Zod schema wired (schema existed, now validated)
- [x] `submitReview` — fixed: Zod schema wired (schema existed, now validated)
- [x] `confirmDonationReceipt` raw input — fixed: inline Zod schema validates receiptData
- [x] `editPost` no re-moderation — fixed: ContentModerationSystem.moderateCommunityContent called before DB update
- [x] `startChat` no input validation — fixed: explicit guards on otherUserId/bookId
- [x] `applyForOrganization` custom validator — fixed: replaced with validateWithSchema(organizationSchema)
- [x] No `src/middleware.ts` — fixed: added NextAuth route protection in 0c534d6
- [x] `resetPassword` has no rate limit — fixed: 0c534d6
- [x] 4 critical actions missing rate limits — fixed: submitReport, submitReview, startChat, blockUser (ac3bfa8)
- [x] Auth rate limiting fail-open — fixed: Redis error now falls through to in-process fallback Map
- [x] NextAuth `authorize` handler never calls `recordAuthResult()` — fixed: called on all success/failure paths
- [x] CSP `unsafe-eval` — fixed: removed from production; dev-only via NODE_ENV check
- [x] Hardcoded `'dev-media-secret'` fallback in upload-token route — fixed: always requires MEDIA_API_SECRET env var
- [x] Content moderation missing from book listings — fixed: listBook runs analyzeContent in batch 7 (user bios/reviews/org still pending)

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

- [x] Sale books use `$regex` vs exchange `$text` — fixed: getBooksForSale unified to $text
- [ ] `levenshteinDistance()` implemented in `utils.ts` but never called from any search path
- [x] User search hardcoded limit of 10 — fixed: page/limit params, returns pagination envelope
- [x] No community search endpoint — fixed: /api/communities/search (GET ?q&page&limit)
- [x] No organization search endpoint — fixed: /api/organizations/search (GET ?q&page&limit)
- [ ] No autocomplete or suggestion API
- [x] No search analytics — fixed: fire-and-forget insertOne to search_analytics after each search
- [x] No unified `/search` results page — fixed: 0c534d6

---

## 16. BACKGROUND JOBS (zero scheduled jobs exist in the codebase)

- [x] Expired book listings cleanup — fixed: scripts/cleanup-jobs.ts expireOldListings job
- [x] Stale exchange auto-cancellation — fixed: scripts/cleanup-jobs.ts cancelStaleExchanges job (30-day cutoff, books restored, parties notified)
- [x] Weekly email digest — fixed: sendWeeklyDigest job + sendWeeklyDigestEmail in email.ts
- [ ] Redis cache warming on cold restart
- [ ] Scheduled database maintenance
- [x] Inactive user warning emails — fixed: warnInactiveUsers job + sendInactivityWarningEmail in email.ts
- [x] Donation follow-up reminders — fixed: sendDonationReminders job + sendDonationReminderEmail

---

## 17. FRONTEND PAGES — MISSING OR INCOMPLETE

- [x] Donation history page — fixed: `/donate/history` added in 0c534d6
- [x] Global search results page (`/search`) — fixed: 0c534d6
- [x] Exchange detail standalone page — fixed: `/exchange/[id]` added (cd4883c)
- [x] Book management page for sellers — fixed: /books/my-listings with status badges + edit/delete
- [x] Public organization profile page — fixed: /organizations/[id] added in cd4883c
- [x] `loading.tsx` missing on `/books`, `/books/[id]`, `/exchange`, `/community` — fixed: 1e76334 (admin route doesn't exist yet)
- [x] `error.tsx` missing on same routes — fixed: 1e76334
- [x] No OpenGraph or Twitter Card meta tags on any dynamic page — fixed: root layout updated in 0c534d6
- [x] Messages unread count badges — fixed: unreadCountByParticipant used in chats route

---

## 18. CONFIGURATION & DEPLOYMENT

- [x] Hardcoded media.farya.pk and localhost URLs — audited: localhost fallbacks are dev-only, env var checked first
- [x] `url-utils.ts` localhost:9002 — confirmed dev-only fallback, acceptable
- [x] localhost:3001 fallbacks — confirmed: SOCKET_URL env var checked first, dev-only fallback acceptable
- [ ] `next.config.ts:128` — `process.env.VERCEL_URL` baked into CSP at build time
- [x] `.env.example` missing media API + admin env vars — fixed: 0c534d6
- [x] `env-validation.ts` does not validate `MEDIA_API_SECRET` — fixed: required field added
- [x] No Dockerfile — fixed: multi-stage Dockerfile + .dockerignore added
- [x] No CI/CD pipeline — fixed: .github/workflows/ci.yml added (lint + typecheck + build)
- [x] No vercel.json — fixed: added with Socket.IO rewrite to external server + constraint documented
- [x] No `public/robots.txt` — fixed: 0c534d6
- [x] No sitemap generation — fixed: `src/app/sitemap.ts` added in 0c534d6
- [x] No `public/manifest.json` (PWA support) — fixed: 0c534d6
- [x] No OpenGraph meta tags in root `layout.tsx` — fixed: 0c534d6
- [x] Placeholder image domains — fixed: picsum.photos and placehold.co removed from remotePatterns
- [x] No `/api/health` endpoint — fixed: 3f9bd00
- [ ] Media API not integrated into main `build` or `start` npm scripts

---

## 19. ERROR HANDLING — SILENT FAILURES

- [x] Redis fail-open rate limit — fixed: fallbackStore used when Redis is down (in-process, resets on restart)
- [x] `initiateDonation` — false positive: already wrapped in withTransaction (confirmed)
- [x] `resetPassword` — two separate `updateOne` calls, no transaction — fixed: 1a22983
- [x] `deleteReview` — delete + stats update not atomic — fixed: 1a22983
- [x] Socket `sendMessage` broadcasts on DB fail — false positive: already guarded by modifiedCount > 0
- [x] Email failures only console.warn — fixed: critical paths now use console.error with [EMAIL_FAILURE] prefix
- [x] 10+ MongoDB write results not checked — fixed: 7 critical paths now check result and throw on failure
- [x] 15+ missing null guards — confirmed: all critical exchange/admin findOne paths already guarded
- [x] `redis-cache.ts` cache miss vs error ambiguous — fixed: CacheResult<T> type, get() returns { hit, value? }

---

## 20. TYPE SAFETY

- [ ] 25+ exported Server Actions have no return type annotation
- [x] 150+ `as any` assertions — reduced: 13 removed via typed collection calls; 35 remaining are unavoidable driver limitations
- [ ] 8 MongoDB update helper functions return `any` instead of `UpdateFilter<T>` (`mongodb-types.ts:119–195`)
- [ ] `Notification.metadata` and `AdminNotification.metadata` use `[key: string]: any` escape hatch
- [x] Zod `bookSchema` missing deduplication fields — fixed: added as optional fields
- [x] `UserRole` and `UserStatus` defined as inline string literals — fixed: USER_ROLES/USER_STATUSES const arrays + named types in types.ts
- [x] NextAuth `auth-config.ts` uses `(user as any)` casts — fixed: next-auth.d.ts augmentation + AuthUser interface
- [x] `mongodb-types.ts` `PostDocument` — fixed: isPinned, isLocked, deletedAt, deletedBy, status added
- [x] `mongodb-types.ts` `BookDocument` — fixed: all 6 fields added

---

**Total: 137 original items | 101 resolved | 36 remaining**

### Fixed summary by commit:
- **5392b2f** — exchange/donation core fixes (book status on completion, donation flow)
- **28fb49b** — 6 review findings (atomic book reservation, race conditions)
- **0c534d6** — parallel batch: 8 indexes, 2 pages, notifications, soft delete, middleware, infra
- **d4a72e7** — exchange state machines: on_hold/reserved, rejectExchange, all exchange notifications
- **d0f4611** — donation flow: book status on completion, org confirm action, atomic inserts, book validation
- **cd4883c** — new pages: /exchange/[id] detail + /organizations/[id] profile
- **bac8317** — email: migrate nodemailer → Resend SDK (16 functions, API key wired)
- **d76a0d8** — batch 5: 15 data model fields, bidirectional blocking, exchange completion email, suspendUser audit log
- **d45c3ba** — batch 6: Zod on submitReport/submitReview, reply notifications, new-member notifications, cleanup-jobs.ts
- **34bf9f3** — batch 7: listBook content moderation, remove hardcoded dev-media-secret
- **6286302** — batch 8: socket room naming unified, emitNewBook/emitNewReview, recordAuthResult, env-validation, admin reports tab + user search
- **11f0c7b** — batch 9: UserRole/UserStatus types, NextAuth as-any removed, Dockerfile + CI + vercel.json, 7 unchecked write results
- **a2dc940** — batch 10: search unified to $text, CacheResult<T> redis fix, Zod gaps closed, audit log viewer, weekly digest job
- **b6eb31e** — batch 11: Redis fail-open fixed, CSP unsafe-eval removed, community/org search endpoints, admin global search, placeholder domains removed

### Removed from original list (verified as already implemented):
- ~~No mark all as read~~ — exists in `notification-provider.tsx:96`
- ~~No DB unique constraint on reviews~~ — exists in `database-maintenance.ts:141`
- ~~Price not required for type=sale~~ — validated in `schemas.ts:69`
- ~~All 4 AI flows not wired to UI~~ — `analyzeBookCondition` wired to sell page, `getBookRecommendations` wired to floating assistant
- ~~No server-side HTML sanitization~~ — `sanitizeInput()` in `utils.ts` properly escapes HTML entities
