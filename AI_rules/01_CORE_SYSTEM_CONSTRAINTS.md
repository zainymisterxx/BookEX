# Core System Constraints

## System Identity and Purpose

**System Name:** BookEx - Community Based Book Exchange and Sale Platform

**Core Mission:** Facilitate book exchanges, sales, and donations through a secure, community-driven platform with real-time communication and AI-assisted discovery.

## Fundamental System Boundaries

### DO NOT Modify These Core Concepts

1. **System Type:** Web-based platform (NOT mobile-first, NOT desktop application)
2. **Primary Functions:**
   - Book listing management (sale/exchange)
   - User-to-user exchange proposals
   - Donation to registered organizations
   - Real-time messaging via WebSocket
   - Community group participation
   - AI-assisted book discovery

3. **User Roles (FIXED):**
   - Visitor (unauthenticated)
   - Registered User (authenticated standard user)
   - Administrator (elevated privileges)
   - Organization (charitable entities for donations)

### Critical System Rules

#### R1: Authentication and Authorization

```
RULE: All protected features MUST require authentication
- Never bypass authentication checks
- Never allow role escalation without proper validation
- First registered user becomes admin automatically
- Admin role cannot be self-assigned after first user
```

#### R2: Book Listing States

```
RULE: Book listings have defined lifecycle states
Valid States: "active", "inactive", "exchanged", "sold", "donated"
- Never create custom states without SRS approval
- State transitions must follow business logic
- Cannot list same book for both sale AND exchange simultaneously
```

#### R3: Exchange Workflow

```
RULE: Exchange proposals follow strict state machine
Valid States: "proposed", "accepted", "rejected", "cancelled", "completed", "disputed"

Flow:
proposed → accepted → completed
proposed → rejected
proposed → cancelled
accepted → disputed

- Cannot skip states
- Cannot reverse completed exchanges
- Both users must mark as completed for finalization
```

#### R4: Communication Channels

```
RULE: Real-time communication uses WebSocket (Socket.IO)
- Direct messaging between users only
- No public broadcast messaging
- Messages stored in database with pagination (50 messages/load)
- Maximum message length: 2000 characters
- Automatic fallback to REST API if WebSocket fails
```

#### R5: Rate Limiting (MANDATORY)

```
RULE: Rate limits are security features and CANNOT be disabled

Enforced Limits:
- Book Listing: 10 books per day per user
- Signup: 5 attempts per hour per IP
- Wishlist Operations: 30 operations per minute per user
- AI Requests: 5 requests per hour per user

Violation Response: Display error message, log attempt, block temporarily
```

#### R6: Content Moderation

```
RULE: All user-generated content must pass moderation checks
- Book listings, community posts, messages, reviews
- Flagged content goes to quarantine for admin review
- Automated checks for spam, inappropriate content
- Admin can approve, reject, or delete content
- Content moderation cannot be bypassed or disabled
```

## Data Integrity Constraints

### D1: User Data

```typescript
MANDATORY FIELDS:
- name (string, non-empty)
- email (string, unique, valid format)
- password (min 8 chars, uppercase, lowercase, number, special char)
- role ("user" | "admin" | "organization")
- status ("active" | "suspended" | "deleted")

Password Storage: MUST use bcrypt hashing (never plain text)
```

### D2: Book Listing Data

```typescript
MANDATORY FIELDS:
- title (string, non-empty)
- author (string)
- condition (enum: "new", "like-new", "good", "fair", "poor")
- listingType ("sell" | "exchange")
- price (required if listingType = "sell", must be positive)
- city (string, from predefined list)
- status ("active" | "inactive" | "exchanged" | "sold")

OPTIONAL BUT RECOMMENDED:
- ISBN, genre, description, coverImage
```

### D3: Exchange Data

```typescript
MANDATORY FIELDS:
- initiatorId (User ObjectId)
- recipientId (User ObjectId)
- initiatorBookId (Book ObjectId)
- recipientBookId (Book ObjectId)
- status (state machine as per R3)
- proposedAt (timestamp)

VALIDATION:
- initiatorId ≠ recipientId
- Both books must be available for exchange
- Books must have listingType = "exchange"
```

## Technology Stack Constraints

### T1: Backend Framework

```
MANDATORY: Next.js (React framework with server-side rendering)
- Do not replace with Express.js, Fastify, or other Node frameworks
- Use Next.js App Router (not Pages Router)
- Server Actions for mutations
```

### T2: Database

```
MANDATORY: MongoDB with Mongoose ODM
- Do not replace with PostgreSQL, MySQL, or other RDBMS
- Use Mongoose schemas with validation
- Maintain defined indexes for performance
```

### T3: Real-time Communication

```
MANDATORY: Socket.IO for WebSocket connections
- Do not replace with plain WebSocket, SignalR, or other libraries
- Maintain fallback to HTTP long polling
- Use room-based messaging architecture
```

### T4: AI Integration

```
MANDATORY: Genkit with Gemini AI (Google Gemini 2.5 Flash)
- Do not replace with OpenAI, Claude, or other LLMs
- Use defined tools: searchBooksTool, generateBookSummaryTool
- Respect rate limiting (5 requests/hour/user)
```

### T5: Authentication

```
MANDATORY: Custom authentication with bcrypt + session management
- Do not implement JWT without approval
- Do not integrate OAuth without approval
- Session-based authentication only
```

## Business Logic Constraints

### B1: Exchange Restrictions

```
RULE: Users cannot propose exchanges unless they have at least one book listed for exchange
- Check before showing "Propose Exchange" button
- Validate on server side before creating proposal
- Display tooltip: "You must list at least one book for exchange before you can contact other traders"
```

### B2: Self-Transaction Prevention

```
RULE: Users cannot interact with their own listings
- Cannot wishlist own books
- Cannot propose exchange with self
- Cannot message self
- Enforce on both client and server side
```

### B3: Organization Donations

```
RULE: Donations only go to registered organizations
- Organizations must be approved by admin
- Donor and organization communicate via chat
- Donation states: "pending", "accepted", "rejected", "completed", "cancelled"
- Books can be from user's listings or manually entered
```

### B4: Community Groups

```
RULE: Group participation requires membership
- Users must join group before posting or commenting
- Group creators become administrators
- Admins can moderate discussions
- Groups can be public or private
- Posts support markdown formatting (max 10,000 chars)
```

### B5: Review System

```
RULE: Reviews given through chat after transaction completion
- No separate review entity in database
- Feedback stored in chat context
- Reputation score updated based on ratings
- Reviews can be flagged for moderation
```

## Performance Constraints

### P1: Response Time

```
RULE: All operations must complete within 3 seconds under normal load
- Optimize database queries with indexes
- Use pagination for large result sets
- Implement caching where appropriate
```

### P2: Concurrent Users

```
RULE: System must support 500 concurrent users without degradation
- Use connection pooling for database
- Optimize Socket.IO room management
- Monitor server resources
```

### P3: Pagination Standards

```
RULE: Implement pagination for all list endpoints
- Exchange books: 50 items per page
- Sale books: all items (with filtering)
- Messages: 50 messages per load
- Communities: paginated as needed
```

## Security Constraints

### S1: Password Requirements

```
RULE: Password validation is non-negotiable
Minimum Requirements:
- 8 characters length
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Enforcement: Client-side validation + Server-side validation
```

### S2: Input Sanitization

```
RULE: All user input must be sanitized
- HTML/Script tag stripping for text fields
- SQL injection prevention (parameterized queries)
- NoSQL injection prevention (schema validation)
- XSS prevention (escape output)
```

### S3: Admin Operations Logging

```
RULE: All admin actions must be logged
Logged Actions:
- User suspension/restoration
- Content deletion
- Report resolution
- Role changes
- Configuration updates

Log includes: timestamp, admin ID, action type, target, reason
```

## Deployment Constraints

### E1: Environment Support

```
RULE: System must be deployable on:
- Cloud platforms (Vercel, AWS, Azure, GCP)
- On-premise servers
- Requires minimal configuration changes between environments
```

### E2: Browser Compatibility

```
RULE: Support major modern browsers
Required: Chrome, Firefox, Safari, Edge (latest 2 versions)
Mobile: iOS Safari, Android Chrome
```

## Forbidden Modifications

🚫 **NEVER DO THE FOLLOWING:**

1. Remove or weaken password hashing (bcrypt)
2. Disable rate limiting for any feature
3. Allow users to self-assign admin role
4. Skip authentication checks on protected routes
5. Modify exchange state machine without approval
6. Remove content moderation pipeline
7. Expose sensitive data in API responses (passwords, tokens)
8. Allow SQL/NoSQL injection vulnerabilities
9. Disable audit logging for admin actions
10. Change database from MongoDB to another system
11. Replace Socket.IO with different WebSocket library
12. Modify AI model from Gemini to another provider
13. Allow direct database access from client side
14. Remove HTTPS/TLS encryption requirements
15. Bypass email uniqueness validation

## Error Handling Requirements

### E1: User-Facing Errors

```
RULE: Display meaningful error messages without exposing system internals
Good: "Invalid email or password"
Bad: "Database connection failed at line 247"
```

### E2: Server Errors

```
RULE: Log detailed errors server-side but return generic messages to client
- Log full stack traces server-side
- Return sanitized error messages to client
- Use appropriate HTTP status codes
```

## Validation Requirements

### V1: Client + Server Validation

```
RULE: Always implement dual validation
- Client-side: Immediate user feedback
- Server-side: Security enforcement
- Never rely solely on client-side validation
```

### V2: Schema Validation

```
RULE: Use Zod schemas for all form inputs and API requests
- Define schemas in shared location
- Reuse schemas between client and server
- Type-safe validation with TypeScript
```

---

## Compliance Checklist

Before implementing any feature, verify:

- [ ] Follows defined user roles and permissions
- [ ] Respects rate limiting constraints
- [ ] Implements content moderation
- [ ] Uses approved technology stack
- [ ] Validates on both client and server
- [ ] Logs appropriate actions
- [ ] Handles errors gracefully
- [ ] Maintains data integrity
- [ ] Follows security best practices
- [ ] Does not introduce forbidden modifications

**When in doubt, consult the SRS document and seek human approval.**
