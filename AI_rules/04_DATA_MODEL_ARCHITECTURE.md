# Data Model and Architecture Rules

## Entity-Relationship Model Rules

### Core Entities

#### E1: User Entity

```typescript
SCHEMA DEFINITION:

User {
  _id: ObjectId (Primary Key)
  name: string (required, non-empty)
  email: string (required, unique, validated)
  password: string (required, bcrypt hashed)
  role: enum ["user", "admin", "organization"] (default: "user")
  status: enum ["active", "suspended", "deleted"] (default: "active")
  
  // Profile Information
  city: string (required for profile completion)
  bio: string (optional, max 500 chars)
  phone: string (optional, validated format)
  interests: string[] (optional)
  birthdate: Date (optional, must be 13+ years old)
  profilePicture: string (optional, URL)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  lastLoginAt: Date (tracked)
  deletedAt: Date (soft delete timestamp)
  
  // References
  wishlist: ObjectId[] (references Book._id)
  listings: virtual (reverse reference from Book)
}

INDEXES:
- email: unique index
- role, status: compound index
- createdAt: index for sorting

VALIDATIONS:
- Email: unique, valid format
- Password: 8+ chars, complexity requirements
- Role: only admin can set to "admin" (except first user)
- Status: only admin can change
- City: must be from predefined list
```

#### E2: Book Entity

```typescript
SCHEMA DEFINITION:

Book {
  _id: ObjectId (Primary Key)
  userId: ObjectId (required, references User._id)
  
  // Book Information
  title: string (required, non-empty)
  author: string (required, non-empty)
  isbn: string (optional, validated format)
  genre: string (optional, from predefined list)
  description: string (optional, max 2000 chars)
  condition: enum ["new", "like-new", "good", "fair", "poor"] (required)
  coverImage: string (optional, URL)
  
  // Listing Details
  listingType: enum ["sell", "exchange"] (required)
  price: number (required if listingType="sell", must be positive)
  city: string (required, from predefined list)
  status: enum ["active", "inactive", "exchanged", "sold", "donated", "pending_review"] (default: "active")
  
  // Metadata
  views: number (default: 0)
  wishlists: number (count of users who wishlisted)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  deletedAt: Date (soft delete timestamp)
  
  // References
  owner: virtual (populated from User)
}

INDEXES:
- userId: index
- title, author, description: text index (for search)
- city, condition, listingType: compound index (for filters)
- status: index
- createdAt: index (for sorting)

VALIDATIONS:
- Title: non-empty string
- Author: non-empty string
- Condition: must be one of enum values
- ListingType: must be "sell" or "exchange"
- Price: required and positive if listingType="sell"
- Status: state transitions follow business rules
- UserId: must reference existing active user

BUSINESS RULES:
- User can list max 10 books per day (rate limit)
- Cannot have same ISBN listed twice by same user (active)
- Status="sold" or "exchanged" removes from active listings
- Deletion is soft delete (sets deletedAt)
```

#### E3: Exchange Entity

```typescript
SCHEMA DEFINITION:

Exchange {
  _id: ObjectId (Primary Key)
  
  // Participants
  initiatorId: ObjectId (required, references User._id)
  recipientId: ObjectId (required, references User._id)
  
  // Books Involved
  initiatorBookId: ObjectId (required, references Book._id)
  recipientBookId: ObjectId (required, references Book._id)
  
  // Exchange Details
  status: enum ["proposed", "accepted", "rejected", "cancelled", "completed", "disputed"] (default: "proposed")
  notes: string (optional, max 500 chars)
  
  // Timeline
  proposedAt: Date (auto-generated)
  respondedAt: Date (when accepted/rejected)
  completedAt: Date (when both parties confirm)
  
  // Status History
  statusHistory: [{
    status: string,
    timestamp: Date,
    updatedBy: ObjectId (references User._id),
    reason: string (optional)
  }]
  
  // Completion Confirmations
  initiatorConfirmed: boolean (default: false)
  recipientConfirmed: boolean (default: false)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  deletedAt: Date (soft delete timestamp)
  
  // Associated Chat
  chatId: ObjectId (references Chat._id)
}

INDEXES:
- initiatorId, recipientId: compound index
- status: index
- proposedAt: index (for sorting)

VALIDATIONS:
- InitiatorId ≠ RecipientId
- Both books must be available (status="active")
- Both books must have listingType="exchange"
- Both users must be active (not suspended)
- Status transitions follow state machine rules

STATE MACHINE:
proposed → accepted | rejected | cancelled
accepted → completed | disputed
disputed → completed (admin resolution)

BUSINESS RULES:
- Only recipient can accept/reject proposal
- Either party can cancel if status="proposed"
- Both parties must confirm for status="completed"
- Completed exchanges are immutable
- Status changes logged in statusHistory
```

#### E4: Chat Entity

```typescript
SCHEMA DEFINITION:

Chat {
  _id: ObjectId (Primary Key)
  
  // Participants
  participants: ObjectId[] (required, exactly 2 users, references User._id)
  
  // Messages
  messages: [{
    _id: ObjectId (auto-generated)
    senderId: ObjectId (required, references User._id)
    text: string (required, max 2000 chars)
    attachments: [{
      url: string,
      type: enum ["image", "pdf"],
      name: string
    }]
    readBy: ObjectId[] (references User._id)
    createdAt: Date (auto-generated)
    updatedAt: Date (if edited within 15 min)
    deletedAt: Date (soft delete)
  }]
  
  // Metadata
  lastMessage: Date (timestamp of most recent message)
  unreadCount: {
    userId: ObjectId,
    count: number
  }[] (unread message count per user)
  
  // Context
  exchangeId: ObjectId (optional, references Exchange._id)
  donationId: ObjectId (optional, references Donation._id)
  bookId: ObjectId (optional, references Book._id, context book)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  archivedBy: ObjectId[] (users who archived this chat)
}

INDEXES:
- participants: index (for finding chats by user)
- lastMessage: index (for sorting)
- exchangeId, donationId: indexes

VALIDATIONS:
- Exactly 2 participants
- Both participants must be active users
- SenderId must be one of the participants
- Message text: 1-2000 characters
- Attachments: max 3 per message, max 5MB each

BUSINESS RULES:
- Messages ordered by createdAt (oldest first)
- Pagination: 50 messages per page
- Messages can be edited within 15 minutes of creation
- Soft delete (deletedAt) for messages
- UnreadCount decremented when messages marked as read
```

#### E5: Community Entity

```typescript
SCHEMA DEFINITION:

Community {
  _id: ObjectId (Primary Key)
  
  // Basic Information
  name: string (required, unique, non-empty)
  description: string (required, max 1000 chars)
  category: string (optional, from predefined list)
  avatar: string (optional, URL)
  coverImage: string (optional, URL)
  
  // Settings
  privacy: enum ["public", "private"] (default: "public")
  rules: string (optional, markdown, max 5000 chars)
  
  // Members
  members: [{
    userId: ObjectId (references User._id)
    role: enum ["admin", "moderator", "member"] (default: "member")
    joinedAt: Date (auto-generated)
  }]
  
  // Statistics
  memberCount: number (default: 0, computed)
  postCount: number (default: 0, computed)
  
  // System Fields
  createdBy: ObjectId (required, references User._id)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  deletedAt: Date (soft delete timestamp)
}

INDEXES:
- name: unique index
- category: index
- members.userId: index
- createdAt: index (for sorting)

VALIDATIONS:
- Name: unique, non-empty, 3-50 characters
- Description: required, max 1000 characters
- Creator automatically becomes admin
- Cannot delete community with posts (archive instead)

BUSINESS RULES:
- Public communities visible to all
- Private communities require invite or approval
- Admins and moderators can moderate content
- Member roles: admin > moderator > member
- Community creator cannot leave (must transfer ownership)
```

#### E6: Post Entity

```typescript
SCHEMA DEFINITION:

Post {
  _id: ObjectId (Primary Key)
  communityId: ObjectId (required, references Community._id)
  authorId: ObjectId (required, references User._id)
  
  // Content
  title: string (optional, max 200 chars)
  content: string (required, markdown, max 10,000 chars)
  attachments: [{
    url: string,
    type: enum ["image", "pdf"],
    name: string
  }]
  
  // Moderation
  status: enum ["published", "pending_review", "quarantined", "deleted"] (default: "published")
  moderationNotes: string (optional, admin/moderator use)
  
  // Engagement
  comments: number (count of comments)
  isPinned: boolean (default: false)
  isLocked: boolean (default: false, prevents comments)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (if edited)
  deletedAt: Date (soft delete timestamp)
  editedAt: Date (last edit timestamp)
}

INDEXES:
- communityId, createdAt: compound index (for feed)
- authorId: index
- status: index

VALIDATIONS:
- Content: required, max 10,000 characters
- Author must be community member
- Content passes moderation checks

BUSINESS RULES:
- Author can edit within 15 minutes
- Author can delete anytime (soft delete)
- Moderators/admins can edit, delete, pin, lock
- Pinned posts appear at top of feed
- Locked posts prevent new comments
- Deleted posts hidden but preserved for audit
```

#### E7: Comment Entity

```typescript
SCHEMA DEFINITION:

Comment {
  _id: ObjectId (Primary Key)
  postId: ObjectId (required, references Post._id)
  authorId: ObjectId (required, references User._id)
  
  // Content
  content: string (required, markdown, max 2000 chars)
  
  // Threading (optional for nested comments)
  parentCommentId: ObjectId (optional, references Comment._id)
  
  // Moderation
  status: enum ["published", "pending_review", "deleted"] (default: "published")
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (if edited)
  deletedAt: Date (soft delete timestamp)
  editedAt: Date (last edit timestamp)
}

INDEXES:
- postId, createdAt: compound index (for thread)
- authorId: index
- parentCommentId: index (for nested comments)

VALIDATIONS:
- Content: required, max 2000 characters
- Author must be community member
- Post must not be locked

BUSINESS RULES:
- Author can edit/delete own comments
- Moderators can delete any comment
- Nested comments max depth: 3 levels
```

#### E8: Donation Entity

```typescript
SCHEMA DEFINITION:

Donation {
  _id: ObjectId (Primary Key)
  
  // Participants
  donorId: ObjectId (required, references User._id)
  organizationId: ObjectId (required, references User._id with role="organization")
  
  // Books Donated
  books: [{
    // Either from listing or manual entry
    bookId: ObjectId (optional, references Book._id)
    
    // Manual entry fields
    title: string,
    author: string,
    condition: enum ["new", "like-new", "good", "fair", "poor"],
    quantity: number (default: 1),
    notes: string (optional, max 500 chars)
  }]
  
  // Status
  status: enum ["pending", "accepted", "rejected", "completed", "cancelled"] (default: "pending")
  
  // Communication
  chatId: ObjectId (references Chat._id)
  notes: string (optional, max 1000 chars)
  rejectionReason: string (if rejected)
  cancellationReason: string (if cancelled)
  
  // Timeline
  proposedAt: Date (auto-generated)
  respondedAt: Date (when accepted/rejected)
  completedAt: Date (when delivered)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
  deletedAt: Date (soft delete timestamp)
}

INDEXES:
- donorId, organizationId: compound index
- status: index
- proposedAt: index (for sorting)

VALIDATIONS:
- At least one book required
- Donor must be active user
- Organization must have role="organization" and be approved
- Books from listings must belong to donor

STATE MACHINE:
pending → accepted | rejected
accepted → completed | cancelled
```

#### E9: Notification Entity

```typescript
SCHEMA DEFINITION:

Notification {
  _id: ObjectId (Primary Key)
  userId: ObjectId (required, references User._id)
  
  // Notification Content
  type: enum ["exchange", "message", "donation", "community", "admin", "system"]
  title: string (required, max 100 chars)
  message: string (required, max 500 chars)
  
  // Context
  relatedEntityType: enum ["exchange", "book", "chat", "post", "user"]
  relatedEntityId: ObjectId
  
  // Action
  actionUrl: string (optional, URL to navigate to)
  
  // Status
  isRead: boolean (default: false)
  readAt: Date (when marked as read)
  
  // System Fields
  createdAt: Date (auto-generated)
  expiresAt: Date (optional, auto-delete after this date)
}

INDEXES:
- userId, isRead, createdAt: compound index
- expiresAt: TTL index (auto-delete)

BUSINESS RULES:
- Notifications auto-expire after 30 days
- User can mark as read/unread
- User can delete notification
- System notifications cannot be deleted
```

#### E10: Report Entity

```typescript
SCHEMA DEFINITION:

Report {
  _id: ObjectId (Primary Key)
  
  // Reporter
  reporterId: ObjectId (required, references User._id)
  
  // Reported Entity
  reportedEntityType: enum ["user", "book", "post", "comment", "message"]
  reportedEntityId: ObjectId (required)
  reportedUserId: ObjectId (optional, if entity has owner)
  
  // Report Details
  reason: enum ["spam", "inappropriate", "harassment", "fraud", "other"] (required)
  description: string (optional, max 1000 chars)
  severity: enum ["low", "medium", "high", "critical"] (computed or manual)
  
  // Resolution
  status: enum ["pending", "reviewing", "resolved", "dismissed"] (default: "pending")
  reviewedBy: ObjectId (optional, references User._id with role="admin")
  resolution: string (optional, admin notes, max 2000 chars)
  action: enum ["none", "warning", "content_removed", "user_suspended", "user_banned"]
  
  // Timeline
  reportedAt: Date (auto-generated)
  reviewedAt: Date (when admin starts review)
  resolvedAt: Date (when resolved/dismissed)
  
  // System Fields
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-updated)
}

INDEXES:
- status, severity, reportedAt: compound index
- reportedEntityType, reportedEntityId: compound index
- reporterId: index

VALIDATIONS:
- Reporter cannot be same as reported user
- Reported entity must exist
- Reason is required

BUSINESS RULES:
- Reports are confidential (reporter identity hidden from reported user)
- Multiple reports on same entity tracked separately
- Resolution requires admin action
- Resolved reports archived after 90 days
```

---

## Relationship Rules

### R1: User ↔ Book (One-to-Many)

```
RELATIONSHIP: User owns many Books
- User can create multiple book listings
- Book must have exactly one owner (userId)
- Cascade: User deletion (soft) keeps books but marks inactive
- Referential integrity: userId must reference existing User

QUERIES:
- Get all books by user: Book.find({ userId: userId })
- Count user's books: Book.countDocuments({ userId: userId })
```

### R2: User ↔ Exchange (One-to-Many)

```
RELATIONSHIP: User initiates/receives many Exchanges
- User can be initiator in multiple exchanges
- User can be recipient in multiple exchanges
- Same pair of users can have multiple exchanges (different books)
- Cascade: User deletion cancels pending exchanges

QUERIES:
- Get user's exchanges: Exchange.find({ 
    $or: [{ initiatorId: userId }, { recipientId: userId }] 
  })
```

### R3: Book ↔ Exchange (Many-to-Many via Exchange entity)

```
RELATIONSHIP: Books can be involved in multiple exchange proposals
- Same book can have multiple proposals (if not accepted)
- Once exchange accepted, book should not be in new proposals
- Exchange completion changes book status

BUSINESS RULES:
- Active exchanges must use available books (status="active")
- Book status changes to "pending_exchange" when exchange accepted
- Book status changes to "exchanged" when exchange completed
```

### R4: User ↔ Chat ↔ User (Many-to-Many)

```
RELATIONSHIP: Users communicate via Chats
- Each chat has exactly 2 participants
- Same pair of users can only have one active chat
- Chat exists independently of books/exchanges (persistent)

QUERIES:
- Get user's chats: Chat.find({ participants: userId })
- Find chat between two users: Chat.findOne({ 
    participants: { $all: [userId1, userId2] } 
  })
```

### R5: Exchange ↔ Chat (One-to-One)

```
RELATIONSHIP: Each Exchange has one associated Chat
- Exchange proposal creates or links to existing chat
- Chat can exist without exchange (general messaging)
- Exchange details visible in chat interface

QUERIES:
- Get chat for exchange: Chat.findById(exchange.chatId)
- Get exchange for chat: Exchange.findOne({ chatId: chatId })
```

### R6: User ↔ Community (Many-to-Many via members array)

```
RELATIONSHIP: Users join multiple Communities
- User can be member of multiple communities
- Community has multiple members with roles
- Community creator automatically becomes admin

QUERIES:
- Get user's communities: Community.find({ "members.userId": userId })
- Get community members: community.members
- Check if user is member: Community.exists({ 
    _id: communityId, 
    "members.userId": userId 
  })
```

### R7: Community ↔ Post (One-to-Many)

```
RELATIONSHIP: Community contains many Posts
- Each post belongs to one community
- Posts are scoped to community (not global)
- Community deletion cascades to posts (soft delete)

QUERIES:
- Get community posts: Post.find({ 
    communityId: communityId, 
    status: "published" 
  }).sort({ createdAt: -1 })
```

### R8: Post ↔ Comment (One-to-Many)

```
RELATIONSHIP: Post has many Comments
- Comments belong to one post
- Nested comments reference parent comment
- Post deletion cascades to comments (soft delete)

QUERIES:
- Get post comments: Comment.find({ 
    postId: postId, 
    status: "published" 
  }).sort({ createdAt: 1 })
- Get nested comments: Comment.find({ parentCommentId: commentId })
```

### R9: User ↔ Donation ↔ Organization (Many-to-Many)

```
RELATIONSHIP: Users donate to Organizations
- User (donor) can make multiple donations
- Organization can receive multiple donations
- Donation links donor and organization

QUERIES:
- Get user's donations: Donation.find({ donorId: userId })
- Get organization's donations: Donation.find({ organizationId: orgId })
```

### R10: User ↔ Wishlist ↔ Book (Many-to-Many via array)

```
RELATIONSHIP: Users wishlist multiple Books
- User has array of wishlisted book IDs
- Book tracks count of wishlists
- Wishlist is user-specific

QUERIES:
- Get user's wishlist: Book.find({ _id: { $in: user.wishlist } })
- Check if wishlisted: user.wishlist.includes(bookId)
- Add to wishlist: User.updateOne(
    { _id: userId }, 
    { $addToSet: { wishlist: bookId } }
  )
```

---

## Architecture Rules

### A1: MVC Architecture Pattern

```
LAYER SEPARATION:

Model Layer (Data):
- Mongoose schemas and models
- Database connection management
- Data validation logic
- Located in: /src/lib/ or /src/models/

View Layer (Presentation):
- React components
- UI logic
- Client-side state management
- Located in: /src/components/, /src/app/

Controller Layer (Business Logic):
- API route handlers (Next.js API routes)
- Server Actions
- Business logic functions
- Located in: /src/app/api/, /src/app/actions.ts

RULES:
- Views should NOT directly access database
- Controllers orchestrate model interactions
- Models should NOT contain UI logic
- Clear separation between layers
```

### A2: Next.js App Router Structure

```
FOLDER STRUCTURE:

/src/app/
  ├── (main)/              # Main application routes (grouped)
  │   ├── page.tsx         # Home page
  │   ├── books/
  │   ├── exchange/
  │   └── messages/
  ├── admin/               # Admin dashboard routes
  │   ├── layout.tsx       # Admin layout with auth check
  │   ├── page.tsx         # Admin dashboard
  │   └── [feature]/       # Admin feature pages
  ├── api/                 # API routes
  │   ├── auth/
  │   ├── books/
  │   └── messages/
  ├── actions.ts           # Server Actions
  ├── layout.tsx           # Root layout
  └── globals.css          # Global styles

CONVENTIONS:
- Route groups use (name) syntax
- Dynamic routes use [param] syntax
- Loading states in loading.tsx
- Error handling in error.tsx
- Layouts for shared UI
```

### A3: Component Organization

```
COMPONENT STRUCTURE:

/src/components/
  ├── ui/                  # Base UI components (shadcn/ui)
  │   ├── button.tsx
  │   ├── input.tsx
  │   └── dialog.tsx
  ├── [feature]/           # Feature-specific components
  │   ├── book-card.tsx
  │   ├── book-filters.tsx
  │   └── book-list.tsx
  ├── auth-modal.tsx       # Global shared components
  ├── header.tsx
  └── footer.tsx

RULES:
- UI components are reusable and stateless
- Feature components contain business logic
- One component per file
- Co-locate related components in feature folders
- Use composition over inheritance
```

### A4: State Management

```
STATE CATEGORIES:

1. Server State (Database-backed):
   - Use React Server Components (RSC)
   - Fetch data in Server Components
   - Pass data as props to Client Components
   - Revalidate on mutations

2. Client State (UI-only):
   - Use React hooks (useState, useReducer)
   - Context API for shared state
   - No global state library unless necessary

3. Form State:
   - Use react-hook-form
   - Zod for validation
   - Server-side validation always

4. URL State (Query params):
   - Use useSearchParams for filters
   - useRouter for navigation
   - Preserve state in URL for bookmarking

RULES:
- Keep state as local as possible
- Lift state only when necessary
- Server state is source of truth
- Minimize client-side state
```

### A5: API Design Principles

```
REST API CONVENTIONS:

Endpoint Structure:
- /api/[resource]
- /api/[resource]/[id]
- /api/[resource]/[id]/[action]

Examples:
- GET /api/books - List books
- GET /api/books/:id - Get book details
- POST /api/books - Create book
- PUT /api/books/:id - Update book
- DELETE /api/books/:id - Delete book
- POST /api/books/:id/wishlist - Add to wishlist

Server Actions:
- Prefer Server Actions for mutations
- Located in app/actions.ts or feature folders
- Use 'use server' directive
- Return serializable results
- Handle errors gracefully

RULES:
- RESTful resource naming (plural nouns)
- Use HTTP methods correctly
- Return consistent response format
- Include proper status codes
- Validate input on server side
```

### A6: Real-Time Architecture (Socket.IO)

```
WEBSOCKET STRUCTURE:

Server Setup:
- Socket.IO server in server.ts (custom server)
- Integrated with Next.js dev server
- Redis adapter for horizontal scaling

Client Setup:
- Socket.IO client in components/socket-provider.tsx
- React Context for socket instance
- Auto-reconnection logic

Event Namespacing:
- Default namespace: /
- Future: namespaces for different features

Room Management:
- Each chat is a room (room name = chatId)
- Users join room on chat open
- Leave room on chat close or disconnect

RULES:
- Use rooms for targeted messaging
- Validate user authorization before emitting
- Handle disconnections gracefully
- Fall back to HTTP polling if WebSocket fails
- Emit minimal data (IDs, not full objects)
```

### A7: File Storage Architecture

```
STORAGE STRATEGY:

Development:
- Local file system for testing
- Store in /public/uploads/

Production:
- Cloud storage (AWS S3, Google Cloud Storage)
- CDN for asset delivery
- Separate buckets/folders:
  * /books/ - Book cover images
  * /avatars/ - User profile pictures
  * /attachments/ - Chat attachments
  * /community/ - Community images

FILE HANDLING:
- Upload directly to storage (not via server)
- Generate presigned URLs for uploads
- Store only URLs in database
- Validate file type and size before upload
- Scan for malware (if available)
- Serve via CDN with cache headers

RULES:
- Never store files in database (only URLs)
- Use unique filenames (UUID or hash)
- Implement cleanup for orphaned files
- Compress images on upload
- Generate thumbnails for images
```

### A8: AI Integration Architecture

```
AI SERVICE STRUCTURE:

Genkit Setup:
- Flows defined in /src/ai/flows/
- Tools defined in /src/ai/tools/
- Configuration in /src/ai/genkit.ts

Flows:
1. getBookRecommendationsFlow
   - Input: user preferences
   - Output: recommended books with reasons
   
2. searchBooksFlow
   - Input: natural language query
   - Uses searchBooksTool
   - Output: conversational response + books

3. generateBookSummaryFlow
   - Input: book details
   - Output: 150-300 word summary

Tools:
- searchBooksTool: Query database for books
- generateBookSummaryTool: Generate summaries
- More tools as needed

RULES:
- All AI requests must be rate limited
- Validate and sanitize AI inputs
- Cache AI responses where appropriate
- Handle AI service failures gracefully
- Never expose API keys to client
- Log AI usage for monitoring
```

### A9: Authentication Architecture

```
AUTH SYSTEM:

Session-Based Authentication:
- NextAuth.js for auth framework
- Custom credentials provider
- Session stored in database (MongoDB)
- HTTP-only secure cookies

Auth Flow:
1. User submits credentials
2. Verify against database (bcrypt)
3. Create session record
4. Set session cookie
5. Return user object (no password)

Protected Routes:
- Middleware checks authentication
- Redirect to login if not authenticated
- Pass user to page/component props

Auth Utilities:
- getServerSession(): Get session in Server Components
- useSession(): Get session in Client Components
- signIn(), signOut(): Auth actions

RULES:
- Never expose password hashes
- Always verify on server side
- Regenerate session on login
- Clear session on logout
- Implement CSRF protection
```

### A10: Error Handling Architecture

```
ERROR HANDLING LAYERS:

1. Client-Side (UI):
   - Try-catch for async operations
   - Error boundaries for component errors
   - Toast notifications for user errors
   - Error pages for route errors

2. Server-Side (API/Actions):
   - Try-catch for all operations
   - Log detailed errors
   - Return sanitized errors to client
   - Use proper HTTP status codes

3. Database Layer:
   - Handle connection errors
   - Validate before save (Mongoose validation)
   - Handle unique constraint violations
   - Transaction rollback on error

ERROR RESPONSE FORMAT:
{
  success: false,
  error: {
    message: "User-friendly message",
    code: "ERROR_CODE",
    field: "fieldName" (for validation errors)
  }
}

RULES:
- Never expose stack traces to client
- Log all errors with context
- Provide actionable error messages
- Handle errors at appropriate level
- Monitor error rates
```

---

## Database Design Rules

### D1: Indexing Strategy

```
REQUIRED INDEXES:

Performance Indexes:
- Text indexes for search fields
- Compound indexes for common filter combinations
- Indexes on foreign keys
- Indexes on sort fields

Uniqueness Indexes:
- User.email (unique)
- Community.name (unique)

AVOID:
- Over-indexing (impacts write performance)
- Indexes on low-cardinality fields
- Duplicate indexes

MONITOR:
- Index usage statistics
- Slow query log
- Query execution plans
```

### D2: Data Normalization

```
NORMALIZATION RULES:

Embed When:
- Data is always retrieved together
- Data does not grow unbounded
- Examples: User profile fields, Book details

Reference When:
- Data can be large or grow unbounded
- Data is shared across documents
- Need to update independently
- Examples: User references, Book references

DENORMALIZATION (for performance):
- User name in messages (avoid joins)
- Book title in exchanges (for display)
- Member count in communities (computed)

RULES:
- Balance normalization with performance
- Update denormalized data on source change
- Document denormalization decisions
```

### D3: Soft Delete Pattern

```
SOFT DELETE IMPLEMENTATION:

Instead of: db.collection.deleteOne()
Use: db.collection.updateOne({}, { $set: { deletedAt: new Date() } })

Queries:
- Filter out soft-deleted: { deletedAt: { $exists: false } }
- Include soft-deleted: (no filter)
- Only soft-deleted: { deletedAt: { $exists: true } }

REASONS:
- Audit trail preservation
- Data recovery capability
- Referential integrity maintenance
- Compliance requirements

CLEANUP:
- Permanent delete after retention period (1 year)
- Admin tool for permanent deletion
- Scheduled cleanup job
```

### D4: Pagination Patterns

```
CURSOR-BASED PAGINATION (preferred for large datasets):

Query:
- Sort by _id or createdAt
- Use last document's cursor value
- Next page: { _id: { $gt: cursor } }

Advantages:
- Consistent results
- Better performance for deep pages
- No page drift

OFFSET-BASED PAGINATION (for small datasets):

Query:
- Skip N documents
- Limit M documents
- Page = skip / limit

Advantages:
- Simpler implementation
- Direct page access
- Total count available

RULES:
- Use cursor-based for feeds and infinite scroll
- Use offset-based for fixed page controls
- Always include total count if using offset
```

### D5: Transaction Handling

```
WHEN TO USE TRANSACTIONS:

Required:
- Multi-document updates that must be atomic
- Exchange completion (update both books, exchange, users)
- Money transfers (future feature)

Not Needed:
- Single document updates (MongoDB atomicity)
- Read operations
- Independent writes

TRANSACTION PATTERN:
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Model1.updateOne({}, {}, { session });
  await Model2.updateOne({}, {}, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}

RULES:
- Keep transactions short
- Avoid long-running operations
- Handle rollback errors
- Log transaction failures
```

---

## Compliance Checklist for Data and Architecture

Before implementing any data model or architectural change:

- [ ] Entity schema matches SRS ERD
- [ ] All required fields defined
- [ ] Validations implemented (Mongoose + Zod)
- [ ] Indexes created for query optimization
- [ ] Relationships properly defined
- [ ] Soft delete implemented where needed
- [ ] MVC layers properly separated
- [ ] State management follows conventions
- [ ] API endpoints follow REST principles
- [ ] Error handling implemented at all layers
- [ ] Authentication and authorization enforced
- [ ] Logging and monitoring configured

**AI agents must verify architecture compliance before implementation.**
