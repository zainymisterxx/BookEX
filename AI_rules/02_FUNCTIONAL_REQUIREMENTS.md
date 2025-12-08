# Functional Requirements Rules

## Use Case Implementation Standards

All use cases defined in the SRS **MUST** be implemented exactly as specified. This document provides detailed rules for each use case.

---

## UC-1: Register & Login

### Registration Rules

#### R1.1: User Registration Flow

```typescript
MANDATORY STEPS:
1. User clicks "Sign Up" button → Display registration form
2. User enters name, email, password → Validate format
3. System validates:
   - Email is unique (not already in database)
   - Password meets strength requirements:
     * Minimum 8 characters
     * At least 1 uppercase letter
     * At least 1 lowercase letter
     * At least 1 number
     * At least 1 special character
4. Hash password using bcrypt
5. Create user with role:
   - "admin" if first user in database
   - "user" for all subsequent users
6. Redirect to profile completion or dashboard
```

#### R1.2: Registration Validations

```
MUST ENFORCE:
- Email uniqueness check before creation
- Email format validation (RFC 5322 compliant)
- Password strength validation (both client and server)
- Rate limiting: 5 signup attempts per hour per IP
- Name must be non-empty string
```

#### R1.3: Registration Error Messages

```
STANDARD ERROR MESSAGES:
- "A user with this email already exists" (duplicate email)
- "Password must be at least 8 characters" (weak password)
- "Too many signup attempts. Please try again later" (rate limit)
- "Please enter a valid email address" (invalid format)
```

#### R1.4: Login Flow

```typescript
MANDATORY STEPS:
1. User enters email and password
2. System finds user by email
3. Compare password hash using bcrypt
4. If valid:
   - Create session
   - Redirect to dashboard
5. If invalid:
   - Display: "Invalid email or password"
   - Do NOT specify which field is incorrect (security)
```

---

## UC-2: List Book for Sale/Exchange

### Book Listing Rules

#### R2.1: Listing Creation Flow

```typescript
MANDATORY STEPS:
1. User clicks "List a Book" → Display listing form
2. User enters required fields:
   - Title (required, non-empty)
   - Author (required, non-empty)
   - ISBN (optional)
   - Condition (required, enum)
   - Description (optional)
3. User uploads book cover image:
   - Validate file type (image only: jpg, png, webp)
   - Upload to storage
   - Return URL
4. OPTIONAL: AI Suggestions
   - User clicks "Get AI Suggestions"
   - System uses Genkit + Gemini AI
   - Analyzes condition from image and description
   - Suggests condition rating and price range
5. User selects listing type: "sell" or "exchange"
6. If "sell": User enters price (required, must be positive number)
7. User selects city from dropdown (auto-populate from profile)
8. System validates all fields using Zod schema
9. System checks rate limit (10 books per day)
10. Create listing with status "active"
11. Listing appears in marketplace search results
12. Log activity: book listing creation
```

#### R2.2: Listing Validations

```
MUST ENFORCE:
- Title: non-empty string
- Author: non-empty string
- Condition: enum ["new", "like-new", "good", "fair", "poor"]
- ListingType: enum ["sell", "exchange"]
- Price: required if listingType="sell", must be positive number
- City: must be from predefined city list
- Image: optional, must be valid image format
- User must be authenticated
- User must have completed profile
- Rate limit: 10 books per day per user
```

#### R2.3: Listing Type Rules

```
RULE: Listing can be EITHER "sell" OR "exchange", not both

If listingType = "sell":
- Price is REQUIRED and must be positive
- Book appears in "Books for Sale" section
- Cannot be used in exchange proposals

If listingType = "exchange":
- Price is optional
- Book appears in "Books for Exchange" section
- Can be used in exchange proposals
- User must have at least one exchange book to propose exchanges
```

#### R2.4: AI Suggestion Feature

```
OPTIONAL FEATURE: AI-powered condition and price suggestions

Rules:
- Only available during listing creation
- Uses Genkit with Gemini AI
- Analyzes: book cover image + description
- Returns: suggested condition rating + price range
- User can accept or override suggestions
- Respects AI rate limit (5 requests/hour/user)
```

#### R2.5: Content Moderation for Listings

```
MANDATORY: All listings pass through content moderation

Checks:
- Spam detection
- Inappropriate content in title/description
- Duplicate listings (same ISBN by same user)

If flagged:
- Quarantine listing
- Notify admin for review
- Prompt user to revise
- Listing status = "pending_review"
```

---

## UC-3: Search & Browse Books

### Search and Discovery Rules

#### R3.1: Search Implementation

```typescript
MANDATORY FEATURES:
1. Text search across:
   - Book title
   - Author name
   - Description
2. Debounced input (500ms delay)
3. Filters:
   - Genre (multi-select)
   - Condition (multi-select)
   - City (single select)
   - Price range (min-max sliders)
   - Listing type (sale/exchange)
4. Sort options:
   - Relevance (default)
   - Newest first
   - Price: Low to High
   - Price: High to Low
5. Pagination:
   - Exchange books: 50 per page
   - Sale books: all items with filters
6. Display active filter tags with remove option
```

#### R3.2: Search Optimization

```
PERFORMANCE REQUIREMENTS:
- Use MongoDB compound indexes on:
  * title, author, description (text search)
  * city, condition, listingType (filter queries)
  * createdAt (sorting)
- Implement query parameter caching
- Debounce search input (500ms)
- Return results within 3 seconds
```

#### R3.3: Search Results Display

```
EACH BOOK CARD MUST SHOW:
- Cover image (or placeholder)
- Title
- Author
- Condition
- Price (if for sale)
- City
- Listing type (sale/exchange icon)
- Quick action buttons (wishlist, contact)

CLICKING CARD:
- Navigate to detailed book page
- Show full description
- Show seller information
- Show action buttons (exchange/contact/wishlist)
```

#### R3.4: AI-Assisted Search

```
OPTIONAL FEATURE: Natural language search via AI Assistant

Implementation:
- Floating AI Assistant button on browse pages
- Two tabs: "Search" and "Recommendations"
- Natural language input: "Find sci-fi books under 500 PKR"
- System uses Genkit AI with searchBooksTool
- Returns conversational response + book results
- Respects rate limit (5 requests/hour/user)
```

#### R3.5: Book Summary Generation

```
OPTIONAL FEATURE: AI-generated book summaries

Rules:
- Available on book detail page
- Uses generateBookSummaryTool via Gemini AI
- Generates 150-300 word summary
- Based on title, author, description
- Cached to reduce API calls
- Respects rate limit
```

#### R3.6: No Results Handling

```
IF NO BOOKS MATCH CRITERIA:
- Display message: "No books found matching your criteria"
- Show "Clear Filters" button
- Suggest alternative searches
- Do NOT show empty grid without message
```

---

## UC-4: Exchange Books with Users

### Exchange Proposal Rules

#### R4.1: Exchange Proposal Flow

```typescript
MANDATORY STEPS:
1. User views book listed for exchange
2. System checks:
   - User is authenticated
   - User is not the book owner
   - User has at least one book listed for exchange
3. Display "Propose Exchange" button
4. User clicks button → Open exchange modal
5. Modal shows user's available exchange books
6. User selects their book to offer
7. User adds optional notes (max 500 characters)
8. System validates:
   - Both books are available
   - Both books have listingType="exchange"
   - Users are different
9. Create exchange record:
   - status: "proposed"
   - proposedAt: current timestamp
10. Create/open chat conversation
11. Send exchange proposal in chat with Accept/Reject buttons
12. Notify recipient via notification system
```

#### R4.2: Exchange Validations

```
MUST ENFORCE BEFORE PROPOSAL:
- Proposer must have at least one book listed for exchange
- Proposer cannot be the book owner
- Target book must be available (status="active")
- Target book must have listingType="exchange"
- Both users must be active (not suspended)

DISPLAY TOOLTIP IF INVALID:
"You must list at least one book for exchange before you can contact other traders"
```

#### R4.3: Exchange State Machine

```
VALID STATES AND TRANSITIONS:

proposed → accepted (recipient accepts)
proposed → rejected (recipient rejects)
proposed → cancelled (either party cancels)
accepted → completed (both parties confirm)
accepted → disputed (either party raises issue)
disputed → completed (admin resolves)

RULES:
- Cannot skip states
- Cannot go backwards (except dispute resolution)
- Both users must mark as completed for finalization
- Completed exchanges are immutable
```

#### R4.4: Exchange Status Updates

```typescript
STATUS UPDATE RULES:

When status = "accepted":
- Update both books' status to "pending_exchange"
- Create status history entry
- Notify both parties

When status = "completed":
- Update both books' status to "exchanged"
- Books removed from active listings
- Allow reviews/feedback in chat
- Update user activity logs

When status = "rejected" or "cancelled":
- Revert books to "active" status
- Notify proposer
- Close exchange record (soft delete)

When status = "disputed":
- Create admin notification
- Provide dispute resolution interface
- Freeze exchange status until resolved
```

#### R4.5: Exchange Chat Integration

```
RULE: Each exchange proposal creates/opens a chat

Chat Features:
- Direct messaging between parties
- Exchange status visible in chat
- Accept/Reject buttons embedded in chat
- Status update notifications in chat
- File attachments allowed
- Message history preserved
```

---

## UC-5: Real-Time Messaging

### Messaging System Rules

#### R5.1: Chat Creation and Access

```typescript
MANDATORY FLOW:
1. User clicks "Contact Seller" on book page
2. System validates:
   - User is authenticated
   - User is not the seller
   - Both users are active
3. System creates or retrieves chat using ObjectId-based system
4. Navigate to chat page with chatId
5. Establish Socket.IO connection
6. Join chat room (room name: chatId)
7. Fetch message history (paginated, 50 messages per load)
8. Mark unread messages as read
9. Emit "messagesRead" event to update sender's UI
```

#### R5.2: Message Sending

```typescript
MESSAGE SEND FLOW:
1. User types message in input field
2. Show typing indicator to other user
3. User submits message (Enter or Send button)
4. Optimistic UI update with temporary ID
5. Emit "sendMessage" event via Socket.IO:
   {
     chatId: string,
     senderId: string,
     text: string,
     attachments: string[] (optional)
   }
6. Server validates:
   - Message content is not empty
   - User is participant in chat
   - Message length ≤ 2000 characters
   - HTML/script tags sanitized
7. Store message in chat.messages array
8. Update chat.lastMessage timestamp
9. Broadcast message to recipient's socket
10. Replace optimistic message with confirmed message
11. Show delivery confirmation
```

#### R5.3: Message Validations

```
MUST ENFORCE:
- Maximum message length: 2000 characters
- HTML sanitization (strip <script>, <iframe>, etc.)
- XSS prevention (escape special characters)
- Sender must be chat participant
- Chat must exist and be active
```

#### R5.4: Real-Time Features

```
SOCKET.IO EVENTS:

Client → Server:
- "sendMessage": Send new message
- "typing": User is typing
- "stopTyping": User stopped typing
- "markAsRead": Mark messages as read

Server → Client:
- "newMessage": Receive new message
- "messageDelivered": Confirm message delivery
- "userTyping": Other user is typing
- "messagesRead": Other user read messages
- "userOnline": Chat participant came online
- "userOffline": Chat participant went offline
```

#### R5.5: Message History and Pagination

```
PAGINATION RULES:
- Load 50 messages initially (most recent)
- Cursor-based pagination for older messages
- "Load More" button at top of chat
- Scroll to bottom on new message
- Preserve scroll position when loading older messages
```

#### R5.6: File Attachments

```
ATTACHMENT RULES:
- Allowed types: images (jpg, png, webp), PDFs
- Maximum file size: 5 MB per file
- Maximum 3 files per message
- Upload to storage before sending message
- Include attachment URLs in message object
- Display inline preview for images
- Download link for PDFs
```

#### R5.7: Fallback Mechanism

```
IF SOCKET CONNECTION FAILS:
- Display warning banner: "Connection lost. Trying to reconnect..."
- Fall back to REST API for message sending
- Poll for new messages every 5 seconds
- Attempt WebSocket reconnection every 10 seconds
- Show connection status indicator
```

#### R5.8: Browser Notifications

```
NOTIFICATION RULES:
- Request permission on first message received
- Show browser notification if:
  * User has enabled notifications
  * Chat window is not in focus
  * Message is from other user
- Notification includes:
  * Sender name
  * Message preview (first 50 characters)
  * Book context (if exchange-related)
```

---

## UC-6: Join & Participate in Communities

### Community Participation Rules

#### R6.1: Community Discovery

```typescript
BROWSE COMMUNITIES FLOW:
1. User navigates to Communities page
2. Display list of communities:
   - Community name
   - Description
   - Member count
   - Category/topic
   - Privacy (public/private)
3. Search by name (regex search)
4. Filter by category
5. Sort by: member count, newest, most active
```

#### R6.2: Joining Communities

```typescript
JOIN FLOW:
1. User clicks on community card → Navigate to detail page
2. Display community information:
   - Description
   - Rules
   - Member list
   - Recent posts
3. User clicks "Join Community"
4. System validates:
   - User is authenticated
   - Community is public OR user is invited (if private)
   - User is not already a member
5. Add user to community.members array with role "member"
6. Update member count
7. Display success message
8. User can now post and comment
```

#### R6.3: Creating Posts

```typescript
POST CREATION FLOW:
1. User clicks "Create Post" in community
2. System checks user is member
3. Display markdown editor
4. User writes content with markdown syntax
5. System provides live preview
6. User submits post
7. System validates:
   - Content length ≤ 10,000 characters
   - User is community member
   - Content passes moderation checks
8. Create post with:
   - authorId
   - communityId
   - content (markdown)
   - createdAt
   - status: "published" or "pending_review"
9. Post appears in community feed
10. Notify community members (optional setting)
```

#### R6.4: Commenting on Posts

```typescript
COMMENT FLOW:
1. User clicks "Comment" on post
2. Display comment input (markdown support)
3. User writes comment (max 2000 characters)
4. Submit comment
5. Validate user is community member
6. Create comment linked to post
7. Display comment in thread
8. Notify post author
```

#### R6.5: Community Moderation

```
MODERATOR/ADMIN ACTIONS:
- Edit community details
- Delete inappropriate posts/comments
- Ban members from community
- Pin/unpin posts
- Lock posts (prevent comments)

RULES:
- Only community creator and admins can moderate
- Deleted content is soft-deleted (set deletedAt)
- Banned users cannot see or interact with community
- Audit log for all moderation actions
```

#### R6.6: Content Moderation

```
AUTOMATIC CHECKS:
- Spam detection
- Inappropriate language
- Duplicate posts
- External link validation

IF FLAGGED:
- Quarantine post/comment
- Notify moderators/admins
- Prompt author to revise
- Admin reviews and approves/rejects
```

---

## UC-7: AI-Assisted Book Discovery

### AI Integration Rules

#### R7.1: AI Assistant Interface

```
IMPLEMENTATION:
- Floating button on bottom-right of browse pages
- Opens dialog with two tabs:
  1. Search (natural language search)
  2. Recommendations (personalized suggestions)
- Rate limit: 5 AI requests per hour per user
- Display remaining quota
```

#### R7.2: AI Recommendations

```typescript
RECOMMENDATION FLOW:
1. User selects "Recommendations" tab
2. User enters mood/interest (e.g., "fast-paced sci-fi thriller")
3. System validates:
   - Input length: 1-500 characters
   - Content policy compliance (no inappropriate content)
   - Rate limit not exceeded
4. Invoke getBookRecommendationsFlow using Genkit
5. Use Gemini 2.5 Flash model
6. AI analyzes:
   - User's input
   - Available books in database
   - User's browsing history (if available)
7. Return list of recommended books with explanations
8. Display books with "Why recommended" snippets
```

#### R7.3: Natural Language Search

```typescript
NL SEARCH FLOW:
1. User switches to "Search" tab
2. User enters query: "Find fantasy books, then summarize the first one"
3. System validates input and checks rate limit
4. Parse intent using AI
5. Execute search using searchBooksTool
6. If summary requested, use generateBookSummaryTool
7. Return conversational response + book results
8. Display results in chat-like interface
```

#### R7.4: AI Tools

```typescript
MANDATORY TOOLS:

1. searchBooksTool:
   - Parameters: query, filters (genre, condition, city, priceRange)
   - Returns: Array of matching books
   - Uses MongoDB text search + filters

2. generateBookSummaryTool:
   - Parameters: bookId or (title + author)
   - Returns: 150-300 word summary
   - Based on title, author, description, genre
   - Cached for 24 hours

3. getBookRecommendationsFlow:
   - Parameters: userInput (mood/interest)
   - Returns: Recommended books with reasons
   - Considers user history and preferences
```

#### R7.5: Rate Limiting for AI

```
RATE LIMIT: 5 AI requests per hour per user

ENFORCEMENT:
- Check before processing request
- Return error if exceeded: "You've made too many requests. Please try again in an hour"
- Display countdown timer
- Admin accounts have higher limit (20/hour)
```

#### R7.6: Content Policy for AI

```
FORBIDDEN INPUTS:
- Inappropriate or offensive content
- Requests to generate harmful content
- Attempts to bypass content moderation
- Personal data requests about other users

IF DETECTED:
- Block request immediately
- Display: "Please refine your request and avoid inappropriate content"
- Log incident for review
- Repeated violations → temporary AI ban
```

#### R7.7: AI Error Handling

```
IF AI SERVICE UNAVAILABLE:
- Catch error gracefully
- Display: "AI service temporarily unavailable. Please try again later"
- Fall back to traditional search
- Log error for monitoring
```

---

## UC-8: Manage Wishlist & Profile

### Wishlist Rules

#### R8.1: Wishlist Operations

```typescript
ADD TO WISHLIST:
1. User clicks heart icon on book card/page
2. System checks:
   - User is authenticated
   - User is not the book owner
   - Rate limit not exceeded (30 ops/minute)
3. Add bookId to user.wishlist array
4. Update UI (fill heart icon)
5. Show toast: "Added to wishlist"

REMOVE FROM WISHLIST:
1. User clicks filled heart icon
2. Remove bookId from user.wishlist array
3. Update UI (unfill heart icon)
4. Show toast: "Removed from wishlist"
```

#### R8.2: Wishlist Validations

```
MUST ENFORCE:
- User cannot wishlist own books
- Book must exist and be active
- Rate limit: 30 wishlist operations per minute
- Duplicate prevention (book can only be wishlisted once)
```

#### R8.3: Wishlist Display

```
WISHLIST PAGE SHOWS:
- Grid of wishlisted books
- Book condition, price, location
- Quick remove button
- Link to book detail page
- Filter by availability (still active vs sold/exchanged)
- Sort by: date added, price, condition
```

### Profile Management Rules

#### R8.4: Profile Information

```typescript
PROFILE FIELDS:
Required:
- name (string, non-empty)
- email (string, unique, validated)
- city (from predefined list)

Optional:
- bio (max 500 characters)
- phone (validated format)
- interests (array of strings)
- birthdate (date, must be 13+ years old)
- profilePicture (image URL)
```

#### R8.5: Profile Update Flow

```typescript
UPDATE FLOW:
1. User clicks "Edit Profile"
2. Display form with current data
3. User updates fields
4. System validates each field with Zod schema:
   - Name: non-empty string
   - Email: unique and valid format
   - City: from allowed list
   - Bio: max 500 characters
   - Phone: valid format (optional)
   - Interests: array of valid tags
   - Birthdate: user must be 13+ years old
5. Check content moderation (bio, interests)
6. Update user document
7. Revalidate cache
8. Show success message
```

#### R8.6: Profile Content Moderation

```
MODERATION CHECKS:
- Bio text for inappropriate content
- Profile picture for inappropriate images
- Interests for spam/inappropriate tags

IF FLAGGED:
- Display: "Profile content violates community guidelines. Please revise."
- Highlight problematic fields
- Revert to previous values
- Log incident
```

#### R8.7: Profile Completion

```
PROFILE COMPLETION RULES:
- New users must complete profile before:
  * Listing books
  * Proposing exchanges
  * Posting in communities
- Required fields for completion:
  * Name
  * City
  * Bio (at least 20 characters)
- Profile completion modal shown after first login
- Can skip but features locked until completed
```

---

## UC-9: Donate Books to Organizations

### Donation Rules

#### R9.1: Organization Registration

```
ORGANIZATION REQUIREMENTS:
- Must register as "organization" role
- Requires admin approval to become active
- Provide:
  * Organization name
  * Mission statement
  * Contact information
  * Verification documents
- Status: "pending" until approved by admin
```

#### R9.2: Donation Flow

```typescript
DONATION STEPS:
1. User navigates to "Donate Books" page
2. Display list of approved organizations:
   - Organization name
   - Mission
   - Location
   - Books accepted
3. User browses and filters by city, name
4. User clicks "Donate to this Organization"
5. System validates user is authenticated
6. Display donation form with options:
   a) Select from user's existing book listings
   b) Add books manually (not yet listed)
7. User selects books (multiple selection allowed)
8. For manual entry, user provides:
   - Title, author, condition, quantity, notes
9. User confirms donation
10. System validates at least one book selected
11. Create donation record:
    - status: "pending"
    - donorId, organizationId
    - books: array of book objects
    - createdAt
12. Create/open chat between donor and organization
13. Notify organization
```

#### R9.3: Donation Validations

```
MUST ENFORCE:
- User must be authenticated
- Organization must be approved
- At least one book must be included
- If from listings: books must belong to donor
- If manual: validate all required fields
```

#### R9.4: Donation State Machine

```
VALID STATES:

pending → accepted (organization accepts)
pending → rejected (organization rejects with reason)
accepted → completed (donation delivered)
accepted → cancelled (either party cancels with reason)

RULES:
- Organization must provide reason for rejection
- Cancellation requires reason
- Completed donations are immutable
- Status history tracked
```

#### R9.5: Donation Chat Integration

```
CHAT FEATURES:
- Direct communication between donor and organization
- Coordination of pickup/delivery
- Donation status visible in chat
- Accept/Reject buttons for organization
- File attachments (photos of books, receipts)
```

---

## UC-10: Admin Dashboard & Moderation

### Administrative Rules

#### R10.1: Admin Access Control

```
ACCESS RULES:
- Only users with role="admin" can access /admin routes
- Non-admin access attempts → redirect to home with error
- Admin authentication required for all admin actions
- Admin actions are logged with timestamp and actor
```

#### R10.2: Dashboard Statistics

```
DISPLAY REAL-TIME STATS:
- Total users (active, suspended, deleted)
- Total books (by status: active, exchanged, sold)
- Total messages sent (today, this week, all time)
- Total communities and members
- Total reports (pending, resolved)
- System health metrics:
  * Moderation queue size
  * Flagged content count
  * Banned users count
  * Active warnings
```

#### R10.3: User Management

```typescript
ADMIN ACTIONS ON USERS:

View User Details:
- Profile information
- Listing count and status
- Exchange history
- Reviews and ratings
- Activity log
- Reports filed/received

Suspend User:
- Confirm action (prevent accidents)
- Update user.status to "suspended"
- User cannot login
- All listings become inactive
- Notify user via email
- Log action with reason

Restore User:
- Update user.status to "active"
- Reactivate listings
- Notify user
- Log action

Delete User (soft delete):
- Set user.deletedAt timestamp
- Hide from searches
- Preserve data for records
- Cannot be undone
- Requires confirmation + reason
```

#### R10.4: Content Moderation Queue

```typescript
MODERATION WORKFLOW:

1. Flagged content appears in queue:
   - Posts, comments, book listings, profiles
   - Sorted by severity: critical > high > medium > low
   - Show reporter info, reason, timestamp

2. Admin reviews content:
   - View full content and context
   - See user history
   - Check previous violations

3. Admin actions:
   a) Approve: Publish content, remove from queue
   b) Reject: Delete content, warn user, log action
   c) Edit: Modify and publish with note
   d) Ban User: If repeated violations

4. Resolution notes:
   - Required for all actions
   - Visible to user (for rejects)
   - Logged for audit
```

#### R10.5: Report Management

```typescript
REPORT HANDLING:

View Reports:
- Display pending reports
- Filter by type: user, book, post, comment, message
- Sort by severity and date
- Show reporter, reported entity, reason

Process Report:
1. Admin reviews report details
2. Views reported content in context
3. Takes action:
   - Dismiss (false positive)
   - Warn user
   - Remove content
   - Suspend user
   - Ban user (extreme cases)
4. Mark report as resolved
5. Add resolution notes
6. Notify reporter and reported user
7. Log action
```

#### R10.6: System Health Monitoring

```
MONITOR:
- Moderation queue size (alert if > 50 items)
- Flagged content count
- Banned users count
- Active warnings
- System errors (last 24 hours)
- Database performance metrics
- API response times

MAINTENANCE SCRIPTS:
- File cleanup (orphaned images)
- Business logic maintenance
- Content moderation maintenance
- Database optimization (run manually)
```

#### R10.7: Admin Action Restrictions

```
FORBIDDEN ADMIN ACTIONS:
- Delete other admin users
- Suspend own account
- Bypass rate limits for personal use
- Access user passwords (only hashes)
- Modify financial transactions without proper authorization
```

---

## General Functional Rules

### Cross-Cutting Concerns

#### F1: Activity Logging

```
LOG ALL USER ACTIONS:
- Book listing creation/update/deletion
- Exchange proposals and status changes
- Messages sent
- Wishlist additions/removals
- Profile updates
- Community joins/posts/comments
- Donations initiated/completed
- Reports filed

Log includes: userId, action, timestamp, metadata
```

#### F2: Notification System

```typescript
NOTIFICATION TRIGGERS:
- Exchange proposal received
- Exchange status changed
- Message received (if offline)
- Community post in joined groups
- Admin actions on user content
- Donation status update

NOTIFICATION CHANNELS:
- In-app notifications (bell icon)
- Browser notifications (if enabled)
- Email notifications (configurable)

NOTIFICATION MANAGEMENT:
- Mark as read/unread
- Delete notification
- Navigate to related content
- Notification preferences in profile
```

#### F3: Error Messages Standards

```
USER-FACING ERRORS:
- Clear and actionable
- No technical jargon
- No system internals exposed
- Suggest resolution steps

EXAMPLES:
Good: "Please enter a valid email address"
Bad: "Regex validation failed at line 47"

Good: "This book is no longer available"
Bad: "Document not found in MongoDB collection"
```

#### F4: Cache Revalidation

```
REVALIDATE CACHE ON:
- Book listing created/updated/deleted
- User profile updated
- Exchange status changed
- Community membership changed
- Admin actions

PATHS TO REVALIDATE:
- /books (all listings)
- /books/[id] (specific book)
- /profile/[userId] (user profile)
- /communities/[id] (community page)
```

---

## Testing Requirements for Functional Features

### Test Coverage Rules

```
EVERY USE CASE MUST HAVE:

1. Unit Tests:
   - Validation functions
   - Business logic
   - State machine transitions
   - Error handling

2. Integration Tests:
   - Database operations
   - API endpoints
   - Socket.IO events
   - AI integrations

3. End-to-End Tests:
   - Complete user flows
   - Critical paths (register, list, exchange)
   - Error scenarios
   - Edge cases

4. Acceptance Tests:
   - Verify against SRS use cases
   - User acceptance criteria
   - Performance benchmarks
```

---

## Compliance Checklist for Functional Requirements

Before marking any use case as complete:

- [ ] All mandatory steps implemented exactly as specified
- [ ] All validations enforced on both client and server
- [ ] Error messages follow standards
- [ ] Rate limiting in place
- [ ] Content moderation integrated
- [ ] Activity logging implemented
- [ ] Notifications triggered correctly
- [ ] Cache revalidation configured
- [ ] Tests written and passing
- [ ] SRS use case verified

**AI agents must verify each checkbox before considering a feature complete.**
