# AI Rules Quick Reference Guide

## 📋 Document Overview

This guide provides quick access to all AI agent rules for the BookEx project.

---

## 📚 Available Documents

### 1. **[00_README.md](./00_README.md)** - Start Here
- Overview of AI rules system
- Purpose and compliance requirements
- Critical instructions for AI agents
- Forbidden actions list

### 2. **[01_CORE_SYSTEM_CONSTRAINTS.md](./01_CORE_SYSTEM_CONSTRAINTS.md)** - System Boundaries
**Core Topics:**
- User roles and permissions (visitor, user, admin, organization)
- Book listing lifecycle states
- Exchange workflow state machine
- Rate limiting requirements
- Content moderation pipeline
- Data integrity constraints
- Technology stack constraints
- Business logic rules
- Forbidden modifications

**Quick Rules:**
- First user becomes admin automatically
- Max 10 book listings per day per user
- Exchange proposals follow strict state machine
- All content must pass moderation
- Rate limits are non-negotiable

### 3. **[02_FUNCTIONAL_REQUIREMENTS.md](./02_FUNCTIONAL_REQUIREMENTS.md)** - Use Case Implementation
**Covers All 10 Use Cases:**
- UC-1: Register & Login
- UC-2: List Book for Sale/Exchange
- UC-3: Search & Browse Books
- UC-4: Exchange Books with Users
- UC-5: Real-Time Messaging
- UC-6: Join & Participate in Communities
- UC-7: AI-Assisted Book Discovery
- UC-8: Manage Wishlist & Profile
- UC-9: Donate Books to Organizations
- UC-10: Admin Dashboard & Moderation

**Quick Rules:**
- Password must be 8+ chars with complexity requirements
- All listings go through content moderation
- Debounce search input (500ms)
- Messages max 2000 characters
- Posts max 10,000 characters
- AI requests limited to 5 per hour per user

### 4. **[03_NON_FUNCTIONAL_REQUIREMENTS.md](./03_NON_FUNCTIONAL_REQUIREMENTS.md)** - Quality Standards
**Covers:**
- Performance Requirements (page load ≤3s, 500 concurrent users)
- Security Requirements (authentication, encryption, input validation)
- Reliability (99.5% uptime, backup strategy)
- Usability (WCAG 2.1 Level AA, mobile responsive)
- Scalability (horizontal scaling, data growth)
- Maintainability (code quality, documentation, testing)
- Portability (cloud/on-premise deployment)
- Privacy (GDPR compliance, data rights)
- Interoperability (REST API standards)

**Quick Rules:**
- HTTPS mandatory (TLS 1.2+)
- bcrypt with 10+ salt rounds
- Database indexes required for performance
- 80% test coverage target
- All admin actions logged

### 5. **[04_DATA_MODEL_ARCHITECTURE.md](./04_DATA_MODEL_ARCHITECTURE.md)** - Database & Architecture
**Covers:**
- Entity schemas (User, Book, Exchange, Chat, Community, Post, etc.)
- Relationship rules (one-to-many, many-to-many)
- MVC architecture pattern
- Next.js App Router structure
- Component organization
- State management
- API design principles
- Real-time architecture (Socket.IO)
- File storage architecture
- Database indexing strategy

**Quick Rules:**
- MongoDB with Mongoose ODM
- All entities use ObjectId
- Soft delete pattern (deletedAt field)
- Server Components by default
- Cursor-based pagination for feeds

### 6. **[05_SECURITY_COMPLIANCE.md](./05_SECURITY_COMPLIANCE.md)** - Security Protocols
**Covers:**
- Password security (complexity, hashing, storage)
- Session management
- Brute force protection
- RBAC (Role-Based Access Control)
- Data encryption (transit and rest)
- Input/output sanitization
- File upload security
- Content Security Policy (CSP)
- CSRF protection
- Audit logging
- GDPR compliance
- Privacy policy requirements
- Incident response plan

**Quick Rules:**
- Never store plain text passwords
- HTTP-only, Secure, SameSite=Strict cookies
- Max 5 login attempts per 15 minutes
- Log all security-relevant events
- Encrypt sensitive data
- HTTPS everywhere

### 7. **[06_TECHNOLOGY_STACK.md](./06_TECHNOLOGY_STACK.md)** - Approved Technologies
**Mandatory Technologies:**
- Frontend: Next.js 13+ (App Router), React 18+, TypeScript 5+
- UI: shadcn/ui, Tailwind CSS
- Forms: react-hook-form + Zod
- Backend: Node.js 18+, Next.js API Routes + Server Actions
- Database: MongoDB 5+ with Mongoose 7+
- Auth: NextAuth.js v5
- Real-time: Socket.IO 4+
- AI: Genkit with Gemini 2.5 Flash
- Deployment: Vercel (primary)

**Immutable Rule:**
🚫 **CANNOT replace these technologies without formal approval**

---

## 🔍 Quick Lookup by Topic

### Authentication & Authorization
- **Documents:** 01, 02 (UC-1), 03, 05, 06
- **Key Rules:** 
  - Password: 8+ chars, bcrypt with 10+ salt rounds
  - Session: 24-hour timeout, HTTP-only cookies
  - RBAC: visitor, user, admin, organization roles
  - First user is admin automatically

### Book Management
- **Documents:** 01, 02 (UC-2, UC-3), 04
- **Key Rules:**
  - Rate limit: 10 books per day
  - Types: "sell" or "exchange" (not both)
  - States: active, inactive, exchanged, sold, donated
  - Content moderation required

### Exchanges
- **Documents:** 01, 02 (UC-4), 04
- **Key Rules:**
  - States: proposed → accepted → completed
  - Both users must confirm completion
  - User must have exchange book to propose
  - Status changes logged in history

### Messaging
- **Documents:** 02 (UC-5), 03, 04, 06
- **Key Rules:**
  - Real-time via Socket.IO
  - Max 2000 chars per message
  - 50 messages per page
  - Fallback to HTTP if WebSocket fails

### Communities
- **Documents:** 02 (UC-6), 04
- **Key Rules:**
  - Posts max 10,000 chars
  - Comments max 2000 chars
  - Markdown support
  - Content moderation required

### AI Features
- **Documents:** 02 (UC-7), 03, 06
- **Key Rules:**
  - Rate limit: 5 requests per hour per user
  - Genkit + Gemini 2.5 Flash (immutable)
  - Natural language search
  - Book recommendations

### Admin Functions
- **Documents:** 02 (UC-10), 03, 05
- **Key Rules:**
  - All actions logged
  - Cannot delete other admins
  - Cannot suspend self
  - View-only access to passwords (hashed)

### Performance
- **Documents:** 03, 04
- **Key Rules:**
  - Page load ≤ 3 seconds
  - 500 concurrent users minimum
  - Database indexes required
  - Pagination mandatory

### Security
- **Documents:** 03, 05
- **Key Rules:**
  - HTTPS mandatory
  - Input sanitization always
  - Rate limiting enforced
  - Audit logging enabled
  - CSRF protection

---

## ⚠️ Critical Forbidden Actions

AI agents are **ABSOLUTELY PROHIBITED** from:

1. ❌ Modifying core authentication/authorization logic
2. ❌ Changing database from MongoDB to another system
3. ❌ Replacing Socket.IO with different WebSocket library
4. ❌ Changing AI from Gemini to another provider (OpenAI, Claude, etc.)
5. ❌ Removing or bypassing security checks
6. ❌ Disabling rate limiting
7. ❌ Disabling content moderation
8. ❌ Storing plain text passwords
9. ❌ Allowing users to self-assign admin role
10. ❌ Skipping input validation
11. ❌ Exposing sensitive data (passwords, tokens)
12. ❌ Implementing features not in SRS
13. ❌ Altering exchange state machine
14. ❌ Removing audit logging
15. ❌ Disabling HTTPS/TLS

---

## 🎯 AI Agent Workflow

### Before Making ANY Changes:

1. **Read Relevant Sections**
   - Identify which documents apply to your task
   - Read ALL relevant sections completely

2. **Verify Requirements**
   - Check functional requirements (02)
   - Check non-functional requirements (03)
   - Check data model constraints (04)
   - Check security requirements (05)
   - Check technology constraints (06)

3. **Check Forbidden Actions**
   - Review forbidden modifications list
   - Ensure change doesn't violate core constraints

4. **Validate Against SRS**
   - Confirm feature is defined in SRS
   - Match implementation to SRS specification

5. **Implement with Constraints**
   - Use approved technologies only
   - Follow architecture patterns
   - Implement all validations
   - Add appropriate logging

6. **Verify Compliance**
   - Run through compliance checklist
   - Verify tests exist
   - Verify security measures

### If You Encounter:

**❓ Ambiguity in Requirements**
→ STOP and flag for human review

**❓ Contradiction Between Rules**
→ STOP and flag for human review

**❓ Missing Specification**
→ STOP and flag for human review

**❓ Technical Impossibility**
→ STOP and flag for human review

**❓ Need for New Technology**
→ STOP and flag for human review (ADR required)

---

## 📊 Compliance Checklist Template

Before submitting code changes:

### Functional Requirements
- [ ] Feature matches SRS use case specification
- [ ] All mandatory steps implemented
- [ ] Validations on both client and server
- [ ] Error messages follow standards
- [ ] Rate limiting in place
- [ ] Content moderation integrated

### Non-Functional Requirements
- [ ] Performance targets met (page load ≤3s)
- [ ] Security measures implemented
- [ ] HTTPS enforced
- [ ] Input validation complete
- [ ] Audit logging added
- [ ] Tests written (80% coverage goal)

### Data Model & Architecture
- [ ] Schema matches ERD
- [ ] Indexes created
- [ ] Relationships properly defined
- [ ] MVC separation maintained
- [ ] State management follows conventions

### Security & Compliance
- [ ] Authentication required
- [ ] Authorization checks in place
- [ ] Data encrypted (transit and rest)
- [ ] Passwords hashed with bcrypt
- [ ] No sensitive data exposed
- [ ] GDPR compliance maintained

### Technology Stack
- [ ] Only approved technologies used
- [ ] No technology substitutions
- [ ] TypeScript strict mode
- [ ] ESLint passing
- [ ] Build succeeds

---

## 🆘 When to Seek Human Approval

Immediately escalate to human developers if:

1. **Security Decision:** Any security-related implementation choice
2. **Architecture Change:** Deviation from defined architecture
3. **New Technology:** Need to introduce library not in approved stack
4. **SRS Conflict:** Requirements seem to conflict with each other
5. **Performance Tradeoff:** Need to sacrifice security for performance
6. **Data Model Change:** Need to modify database schema beyond SRS
7. **Business Logic Uncertainty:** Unclear how business rule should work
8. **Compliance Question:** Unsure about GDPR/privacy requirement

---

## 📝 Quick Reference: Common Patterns

### Authentication Check (Server Component)
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

const session = await getServerSession(authOptions);
if (!session) redirect('/login');
```

### Authorization Check
```typescript
if (session.user.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Rate Limit Check
```typescript
// Check rate limit before operation
const canProceed = await checkRateLimit(userId, 'book_listing', 10, 24 * 60 * 60);
if (!canProceed) {
  throw new Error('Rate limit exceeded. Maximum 10 book listings per day');
}
```

### Input Validation (Zod)
```typescript
import { z } from 'zod';

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  condition: z.enum(['new', 'like-new', 'good', 'fair', 'poor']),
  listingType: z.enum(['sell', 'exchange']),
  price: z.number().positive().optional(),
});

// Validate
const result = bookSchema.safeParse(data);
if (!result.success) {
  // Handle validation errors
}
```

### Database Query with Error Handling
```typescript
try {
  await connectDB();
  const books = await Book.find({ status: 'active' })
    .limit(50)
    .sort({ createdAt: -1 });
  return books;
} catch (error) {
  console.error('Database query failed:', error);
  throw new Error('Failed to fetch books');
}
```

---

## 🎓 Final Reminders for AI Agents

1. **These rules exist to protect system integrity** - Don't try to work around them
2. **When in doubt, ask** - It's better to pause than break the system
3. **SRS is the source of truth** - Always defer to SRS specifications
4. **Security cannot be compromised** - No shortcuts with security
5. **Testing is mandatory** - Code without tests is incomplete
6. **Documentation is required** - Update docs with code changes

---

## 📞 Contact for Rules Updates

If you believe a rule needs updating:
1. Document the specific rule
2. Explain why it needs updating
3. Propose alternative
4. Flag for human review

**Do not modify rules without approval.**

---

**Last Updated:** December 9, 2025  
**SRS Version:** Phase 1  
**Rules Version:** 1.0
