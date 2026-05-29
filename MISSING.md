# BookEX — Verified Missing & Broken Items

> All items verified against actual source code. False positives removed.
> Last verified: 2026-05-29

---

## 1. EXCHANGE FLOW

- [ ] `rejectExchange()` Server Action does not exist — responder has no way to decline a proposal
- [ ] `acceptExchange()` (actions.ts:5236) never touches the books collection — both books stay `active` while exchange is ongoing; same book can enter multiple simultaneous exchanges
- [ ] No `reserved` or `on_hold` status type in `types.ts` BookStatus union
- [ ] `cancelExchange()` sets status to `cancelled` but never restores book statuses
- [ ] `confirmExchangeCompletion()` sends no email to either party on completion
- [ ] `proposeExchange()` never calls `createExchangeProposalNotification()` despite the function existing in `notification-utils.ts:63`
- [ ] `acceptExchange()` never calls `createExchangeUpdateNotification()` — no notification on acceptance
- [ ] `confirmExchangeCompletion()` creates no notification for either party
- [ ] `cancelExchange()` creates no notification
- [ ] No timeout or auto-expiry for stale in-progress exchanges — if one party disappears, exchange is stuck forever
- [ ] Exchange completion never auto-updates book status to `exchanged` — seller must manually call `updateBookStatus()`
- [ ] `canUserReview()` only checks for a duplicate review — does NOT verify a completed exchange exists between the two users; any user can review anyone
- [ ] Socket: client hook (`use-exchange-realtime.ts:60,95`) emits `joinExchange` / `leaveExchange` but `server.ts` has no handlers for either event

---

## 2. DONATION FLOW

- [ ] `orgConfirmed` field initialized to `false` on creation (actions.ts:2208, 2320) but no function, API, or UI ever sets it to `true` — org cannot explicitly accept a donation offer
- [ ] `confirmDonationReceipt()` never updates any Book documents — books stay `active` after donation completes
- [ ] Donation creation (`initiateDonation`) and book selection (`updateDonationBooks`) are two separate non-atomic calls — if second call fails, donation exists with empty books array
- [ ] `DonationBook.bookId` is optional and typically unpopulated — no reliable link back to Book documents for status updates
- [ ] `updateDonationBooks()` accepts any books with no existence or ownership validation
- [ ] No donation history page — no route, no component anywhere
- [ ] No public organization profile page (`/organizations/[id]`)

---

## 3. AUTHENTICATION & ONBOARDING

- [ ] Email verification completely unimplemented — no `emailVerified` field on User type, no verification token collection, no verify-email route, users set to `status: 'active'` immediately on signup
- [ ] `deactivateUser()` Server Action does not exist — `deactivated` status exists in the type but nothing sets it
- [ ] No account recovery flow for deactivated accounts
- [ ] `suspendUser()` stores no `suspendedAt` timestamp or `suspensionReason` on the User document
- [ ] No email change verification — updating email in profile settings requires no re-verification
- [ ] `signUpUser()` email uniqueness is app-level only — no DB unique index; race condition can create duplicate email accounts
- [ ] Profile completion modal can be permanently dismissed via localStorage — incomplete profile is not blocked

---

## 4. BOOK LISTING & DISCOVERY

- [ ] `listBook()` has zero content moderation calls — books go live immediately with no toxicity/spam check (moderation only runs on community posts/comments)
- [ ] `deleteBook()` (actions.ts:6114) uses hard `deleteOne()` — violates the project's own soft-delete policy; no `deletedAt` field set
- [ ] `intelligentBookSearch` and `generateBookSummary` AI flows are implemented in `src/ai/flows/` but never called from any UI, route, or API endpoint
- [ ] `getBooksForSale()` uses `$regex` search; `getBooksForExchange()` uses MongoDB `$text` index — inconsistent strategy on the same data type
- [ ] `getBooksForSale()` has no pagination — unbounded query returning all matching documents
- [ ] No "My Books" management page for sellers — no Edit/Delete buttons on book detail page; seller must navigate back to the sell form manually
- [ ] No global `/search` results page — search only works as filter params on `/books` and `/exchange`
- [ ] No exchange detail standalone page (`/exchange/[id]`)

---

## 5. MESSAGING

- [ ] `startChat()` (actions.ts:1560) — find-or-create is not wrapped in a MongoDB transaction; race condition can create duplicate chats for the same two users
- [ ] Socket `sendMessage` writes message to DB first, then emits to room — if the emit fails, message is persisted but client never gets `receiveMessage` confirmation
- [ ] Unread count calculated two different ways in the legacy vs new chat route handlers — no single source of truth
- [ ] Blocking is one-directional — only blocker's `blockedUsers` array updated; blocked user is not flagged and gets a generic error only when they attempt contact
- [ ] `messagesRead` event is listened on client (`messages-page.tsx:542`) but never emitted by `server.ts`
- [ ] `newChatCreated` event is listened on client (`messages-page.tsx:624`) but never emitted by `server.ts`
- [ ] Two competing Socket.IO implementations: `server.ts` (room naming `user_${id}`) vs `src/lib/socket-server.ts` (room naming `user:${id}`) — inconsistent, typing indicators only in the secondary one

---

## 6. COMMUNITY

- [ ] `toggleCommunityMembership()` (actions.ts:672) allows direct join regardless of `visibility: 'private'` — `requestToJoinCommunity` exists but is never called from the toggle path
- [ ] Admin post delete (`community-admin-actions.ts:949`) is a silent soft-delete — post author never receives a notification
- [ ] No comment locking (prevent further replies on a specific comment)
- [ ] No post moving between channels
- [ ] No bulk moderation actions (bulk delete, bulk ban)
- [ ] Moderators cannot edit other users' posts
- [ ] No moderator reaction removal
- [ ] Community moderation queue tab is explicitly coded as a stub: "will be implemented"
- [ ] Community analytics tab is explicitly coded as a stub: "will be displayed"

---

## 7. REVIEWS & RATINGS

- [ ] `canUserReview()` only checks for a duplicate review — no verification that a completed exchange exists between the two users
- [ ] `Review` interface has no `transactionId` field — linking a review to a specific exchange/donation is architecturally impossible without it
- [ ] Review received creates no in-app notification for the reviewee

---

## 8. NOTIFICATIONS

- [ ] Exchange proposal: `createExchangeProposalNotification()` exists in `notification-utils.ts:63` but `proposeExchange()` never calls it — email sent, no in-app record created
- [ ] Exchange accepted: `createExchangeUpdateNotification()` exists but `acceptExchange()` never calls it
- [ ] Exchange completed: no notification created
- [ ] Exchange cancelled: no notification created
- [ ] Review received: no notification created
- [ ] Admin moderated your content: no notification created
- [ ] Community @mention: no @mention detection exists anywhere in the codebase
- [ ] Reply to your comment in a thread: no notification created
- [ ] New member joined your community: no notification created
- [ ] Book wishlisted by someone: one-way only (you get notified when a wishlisted book is listed, not when your book is wishlisted)
- [ ] Report resolution does not notify the reporter — `removeContentAndResolveReport()` updates status silently
- [ ] Notification preferences cover only 4 types — no preferences for: community mentions, comment replies, reviews, admin actions
- [ ] Weekly digest preference field exists in User type but no job ever sends it

---

## 9. ADMIN PANEL

- [ ] No book/listing management section — cannot view, search, remove, or feature any listing from admin
- [ ] No exchange/transaction oversight section — cannot view exchanges or intervene in disputes
- [ ] Audit log viewer missing — activity logs are written to DB but no admin UI reads them
- [ ] Report management UI missing — `getAdminReports()` Server Action exists but no admin tab surfaces it
- [ ] System settings are view-only — all "Configure" buttons have no `onClick` handlers / functionality
- [ ] No announcement/broadcast system — no way to send system-wide or targeted messages to users
- [ ] No user search or filter in admin — can list users but cannot search by name, email, status, or join date
- [ ] No bulk operations — no bulk suspend, bulk activate, bulk export
- [ ] No staff/admin management — cannot promote users to admin, view admin action history, or revoke access
- [ ] No analytics date range filter — charts have no date picker
- [ ] No dispute resolution tools
- [ ] No organization activity view or suspension capability
- [ ] Dashboard Quick Actions buttons (Manage Users, Security Logs, etc.) have no `onClick` handlers — non-functional
- [ ] `suspendUser()` and `removeContentAndResolveReport()` write no activity log entries
- [ ] Admin search API (`/api/admin/search`) exists but is not referenced by any admin UI tab

---

## 10. SOCKET.IO / REAL-TIME

- [ ] Socket.IO Redis adapter never initialized in `server.ts` — multi-server/load-balanced deployment: room broadcasts do not cross instance boundaries
- [ ] JWT verified only once at the `authenticate` socket event — expired tokens accepted for the full session lifetime with no re-check
- [ ] `joinUserRoom` (server.ts:99) accepts client-provided `userId` with zero JWT verification — any socket can claim any user identity
- [ ] `joinChat` (server.ts:168) allows unauthenticated sockets to join any chat room — `socket.userId` check is tracking-only, not a gate
- [ ] `sendMessage` (server.ts:204) trusts client-provided `senderId` — attacker can send messages appearing to come from any other participant
- [ ] No socket event emitted when a new book is listed
- [ ] No socket event emitted when a review is submitted
- [ ] Admin notification creation has explicit TODO comment — real-time emit not implemented (`api/admin/notifications/route.ts:202`, `admin-notifications.ts:76`)

---

## 11. SECURITY & VALIDATION

- [ ] Only ~30 of 104 exported Server Actions have any Zod parsing — the majority accept raw unvalidated input
- [ ] `submitReport` (actions.ts:2803) — no Zod schema, no rate limit, no moderation, IDs not validated
- [ ] `submitReview` (actions.ts:2837) — no Zod schema, no moderation, no rate limit
- [ ] `confirmDonationReceipt` — `receiptData` accepted raw
- [ ] `editPost` — manual validation only, no re-moderation on edited content
- [ ] `startChat` — no input validation, no rate limit
- [ ] `applyForOrganization` — uses custom validator instead of Zod schema
- [ ] No `src/middleware.ts` — no global auth checks, CORS enforcement, or request-level rate limiting
- [ ] `resetPassword` (actions.ts:261) has no rate limit call — token guessing/brute-force possible
- [ ] 12+ Server Actions missing rate limits (submitReport, submitReview, blockUser, checkUsernameAvailability, startChat, applyForOrganization, etc.)
- [ ] Auth rate limiting uses in-memory `Map` — resets on server restart, bypassed under load balancing
- [ ] NextAuth `authorize` handler (auth-config.ts:18) never calls `recordAuthResult()` on failure — brute-force bypasses account lockout
- [ ] CSP header uses `'unsafe-eval'` + `'unsafe-inline'` in `script-src` — substantially reduces XSS protection
- [ ] Hardcoded `'dev-media-secret'` fallback string in upload-token route — anyone who knows it can forge upload tokens
- [ ] Content moderation applied only to community posts/comments — missing from book listings, user bios, reviews, and org descriptions

---

## 12. DATA MODEL — MISSING FIELDS

- [ ] `User.emailVerified` (boolean)
- [ ] `User.emailVerifiedAt` (ISO string)
- [ ] `User.lastLoginAt` (ISO string) — security auditing, fraud detection
- [ ] `User.failedLoginAttempts` (number) — brute-force detection
- [ ] `User.suspendedAt` (ISO string) — admin audit trail
- [ ] `User.suspensionReason` (string)
- [ ] `User.deactivatedAt` (ISO string)
- [ ] `Book.viewCount` (number)
- [ ] `Book.contactCount` (number)
- [ ] `Book.reportCount` (number)
- [ ] `Exchange.disputeReason` (string)
- [ ] `Exchange.disputeOpenedAt` (ISO string)
- [ ] `Exchange.disputeResolvedAt` (ISO string)
- [ ] `Exchange.disputeResolvedBy` (string)
- [ ] `Exchange.timeline[]` (array of change events for full audit trail)
- [ ] `Chat.lastMessageAt` (ISO string) — inbox sorted without scanning messages array
- [ ] `Chat.lastMessagePreview` (string) — inbox preview without fetching full messages
- [ ] `Chat.unreadCountByParticipant` ({userId: number}) — avoids filtering entire messages array for counts
- [ ] `Review.transactionId` (ObjectId) — required to link review to specific exchange/donation and gate review creation
- [ ] `Community.postCount` (number, denormalized) — query performance for community listings

---

## 13. DATA MODEL — MISSING COLLECTIONS

- [ ] `email_verification_tokens` — entire email verification feature is blocked without this
- [ ] `sessions` — active session tracking, "log out all devices", concurrent session fraud detection
- [ ] `feature_flags` — gradual rollout and kill switches
- [ ] `search_analytics` — query tracking for product decisions
- [ ] `book_views` — engagement analytics

---

## 14. DATABASE — MISSING INDEXES

- [ ] `adminNotifications` collection — no indexes defined anywhere in the codebase
- [ ] `notifications.{read, type}` compound index — admin notification filtering does full collection scans
- [ ] `organizations.{'representatives.userId'}` nested field index
- [ ] `comments.{postId, parentId}` compound index for threaded comment queries
- [ ] `books.deletedAt` sparse index — soft-delete filter queries scan entire collection
- [ ] `communities.deletedAt` sparse index — same issue

---

## 15. SEARCH

- [ ] Sale books use `$regex`; exchange books use `$text` index — inconsistent on the same data type
- [ ] `levenshteinDistance()` implemented in `utils.ts` but never called from any search path
- [ ] User search (`/api/users/search`) has a hardcoded limit of 10 with no pagination support
- [ ] No community search endpoint
- [ ] No organization search endpoint
- [ ] No autocomplete or suggestion API
- [ ] No search analytics or query logging
- [ ] No unified `/search` results page

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

- [ ] Donation history page — no route, no component
- [ ] Global search results page (`/search`)
- [ ] Exchange detail standalone page (`/exchange/[id]`)
- [ ] Book management page for sellers (My Listings with inline edit/delete)
- [ ] Public organization profile page (`/organizations/[id]`)
- [ ] `loading.tsx` missing on: `/books`, `/books/[id]`, `/exchange`, `/community`, `/admin`, `/admin/organizations/[id]`
- [ ] `error.tsx` missing on same routes
- [ ] No OpenGraph or Twitter Card meta tags on any dynamic page
- [ ] Messages list missing: unread count badges, last message preview text, pin/archive actions

---

## 18. CONFIGURATION & DEPLOYMENT

- [ ] `media-api/server.ts:13` and 6 other files — hardcoded `'https://media.farya.pk'` fallback; breaks any non-Farya deployment
- [ ] `src/lib/url-utils.ts:27` — hardcoded `'http://localhost:9002'` fallback used silently in production if env var unset
- [ ] `src/app/api/messages/.../read/route.ts:96` and `notification-utils.ts:156` — `'http://localhost:3001'` fallback; socket calls go to localhost
- [ ] `next.config.ts:128` — `process.env.VERCEL_URL` baked into CSP string at build time; CSP becomes invalid on re-deploy or non-Vercel host
- [ ] `.env.example` missing: `MEDIA_API_SECRET`, `NEXT_PUBLIC_MEDIA_API_URL`, `NEXT_PUBLIC_MEDIA_PUBLIC_URL`, `MEDIA_PORT`, `MEDIA_BIND_HOST`, `MEDIA_STORAGE_ROOT`, `ADMIN_EMAIL`
- [ ] `env-validation.ts` does not validate `MEDIA_API_SECRET` — hardcoded fallback used silently
- [ ] No `Dockerfile` or `docker-compose.yml`
- [ ] No `.github/workflows/` CI/CD pipeline
- [ ] No `vercel.json` — Socket.IO requires persistent connections; incompatible with Vercel serverless without explicit routing config
- [ ] No `public/robots.txt`
- [ ] No sitemap generation (`src/app/sitemap.ts` or `public/sitemap.xml`)
- [ ] No `public/manifest.json` (PWA support)
- [ ] No OpenGraph meta tags in root `layout.tsx`
- [ ] `next.config.ts` image domains include `picsum.photos` and `placehold.co` (placeholder services, not production)
- [ ] No `/api/health` endpoint for load balancers / uptime monitors
- [ ] Media API not integrated into main `build` or `start` npm scripts — must be started manually as a separate process

---

## 19. ERROR HANDLING — SILENT FAILURES

- [ ] Redis failure returns `allowed: true` for rate limit — limits silently disabled when Redis is down (`redis-cache.ts:230`)
- [ ] `initiateDonation` — 4-step operation with no MongoDB transaction; failure at step 3 or 4 leaves orphaned donation/chat records
- [ ] `resetPassword` — two separate `updateOne` calls with no transaction; token can be marked `used: true` while password update fails
- [ ] `deleteReview` — deletes review document then updates user rating stats in a separate call; if stats update fails, counts are permanently wrong
- [ ] Socket `sendMessage` broadcasts `receiveMessage` to room even when the DB `updateOne` fails
- [ ] Email failures after chat/exchange creation are only `console.warn` — the operation is considered successful but the user is never notified
- [ ] 10+ MongoDB `insertOne`/`updateOne` results not checked after the call
- [ ] 15+ missing null guards after `findOne` — code accesses `.name`, `.email`, `.avatarUrl` on potentially null documents
- [ ] `redis-cache.ts` `get()` returns `null` on Redis error — callers cannot distinguish a cache miss from a Redis failure

---

## 20. TYPE SAFETY

- [ ] 25+ exported Server Actions have no return type annotation
- [ ] 150+ `as any` type assertions on MongoDB documents across `actions.ts` and `community-admin-actions.ts`
- [ ] 8 MongoDB update helper functions return `any` instead of `UpdateFilter<T>` (`mongodb-types.ts:119–195`)
- [ ] `Notification.metadata` and `AdminNotification.metadata` use `[key: string]: any` escape hatch
- [ ] Zod `bookSchema` does not include `titleNormalized`, `authorNormalized`, `duplicateHash` — schema and `Book` TypeScript type are out of sync
- [ ] `UserRole` and `UserStatus` defined as inline string literals in 3+ places instead of exported const union types
- [ ] NextAuth `auth-config.ts` uses `(user as any).role` / `(user as any).status` instead of the extended User type
- [ ] `mongodb-types.ts` `PostDocument` is missing fields present in `types.ts` `Post`: `isPinned`, `isLocked`, `deletedAt`, `deletedBy`, `status`, `editHistory`
- [ ] `mongodb-types.ts` `BookDocument` is missing fields present in `types.ts` `Book`: `titleNormalized`, `authorNormalized`, `duplicateHash`, `cityNormalized`, `status`, `expiresAt`

---

**Total: 137 verified items across 20 categories**

### Removed from original list (verified as already implemented):
- ~~No mark all as read~~ — exists in `notification-provider.tsx:96`
- ~~No DB unique constraint on reviews~~ — exists in `database-maintenance.ts:141`
- ~~Price not required for type=sale~~ — validated in `schemas.ts:69`
- ~~All 4 AI flows not wired to UI~~ — `analyzeBookCondition` wired to sell page, `getBookRecommendations` wired to floating assistant
- ~~No server-side HTML sanitization~~ — `sanitizeInput()` in `utils.ts` properly escapes HTML entities
