# BookEx AI Rules Documentation - Project Summary

## 📋 Overview

**Project:** BookEx SRS Phase 1 AI Agent Rules  
**Created:** January 2025  
**Purpose:** Protect system integrity by defining strict rules for AI agents working on BookEx  
**Source Document:** 73-page SRS PDF (BookEx Phase 1 Specification)

---

## 🎯 Mission Statement

These AI rules ensure that **no AI agent can alter the intended functionality** of the BookEx system as defined in the SRS. All code generation, suggestions, and modifications must strictly adhere to these documented constraints.

---

## 📚 Documentation Structure

### Core Documentation Files (8 Total)

| File | Lines | Purpose | Key Content |
|------|-------|---------|-------------|
| **00_README.md** | ~200 | Entry point & overview | Critical instructions, forbidden actions |
| **01_CORE_SYSTEM_CONSTRAINTS.md** | ~500 | Fundamental boundaries | User roles, state machines, rate limits |
| **02_FUNCTIONAL_REQUIREMENTS.md** | ~700 | Implementation rules | All 10 use cases in detail |
| **03_NON_FUNCTIONAL_REQUIREMENTS.md** | ~550 | Quality standards | Performance, security, reliability |
| **04_DATA_MODEL_ARCHITECTURE.md** | ~600 | Database & design | 10 entities, relationships, patterns |
| **05_SECURITY_COMPLIANCE.md** | ~650 | Security protocols | Auth, encryption, GDPR, audit logs |
| **06_TECHNOLOGY_STACK.md** | ~500 | Approved technologies | IMMUTABLE tech list |
| **QUICK_REFERENCE.md** | ~250 | Navigation guide | Quick lookups, workflows |

**Total Documentation:** ~3,950 lines of comprehensive AI agent rules

---

## 🔒 Critical Protection Mechanisms

### 1. **Immutable Technology Stack**
```
✅ APPROVED & LOCKED:
- Next.js 13+ (App Router)
- React 18+ & TypeScript 5+
- MongoDB 5+ with Mongoose 7+
- Socket.IO 4+ for real-time
- NextAuth.js v5 + bcrypt
- Genkit + Gemini 2.5 Flash
- Tailwind CSS + shadcn/ui
```

### 2. **Forbidden Actions (15 Critical Items)**
❌ Cannot replace approved technologies  
❌ Cannot bypass authentication/authorization  
❌ Cannot modify user role hierarchy  
❌ Cannot change exchange state machine  
❌ Cannot disable rate limiting  
❌ Cannot skip content moderation  
❌ Cannot store plain-text passwords  
❌ Cannot expose sensitive data in logs  
❌ Cannot modify data relationships  
❌ Cannot skip input validation  
❌ Cannot disable audit logging  
❌ Cannot bypass GDPR compliance  
❌ Cannot modify security headers  
❌ Cannot change backup retention  
❌ Cannot skip transaction handling  

### 3. **Mandatory Compliance Checks**
Every AI-generated code change must verify:
- [ ] SRS alignment
- [ ] Security requirements met
- [ ] Rate limits enforced
- [ ] Error handling included
- [ ] Audit logging present
- [ ] Input validation implemented
- [ ] Access control verified
- [ ] Data model integrity maintained

---

## 🏗️ System Architecture (SRS-Defined)

### User Roles & Permissions
```
Visitor → User → Admin → Organization
   ↓       ↓        ↓          ↓
Browse  Transact  Moderate  Donations
```

### Book Listing States
```
Draft → Active → On Hold ⟷ Reserved → Sold/Exchanged
                    ↓
                 Inactive
```

### Exchange Workflow State Machine
```
Proposed → Accepted → In Progress → Completed
    ↓          ↓            ↓           ↓
Rejected   Cancelled   Cancelled   (Final)
```

### Core Entities (10 Total)
1. **User** - Authentication, profiles, preferences
2. **Book** - Listings (sale/exchange/donation)
3. **Exchange** - Transaction state management
4. **Chat** - Real-time messaging (Socket.IO)
5. **Community** - Posts, comments, discussions
6. **Post** - Community content
7. **Comment** - Nested discussions
8. **Donation** - Organization-managed donations
9. **Notification** - User alerts
10. **Report** - Content moderation

---

## ⚙️ Critical System Parameters

### Rate Limits (IMMUTABLE)
```typescript
Book Listings:    10 per user per day
AI Requests:      5 per user per hour
Profile Updates:  30 per minute
Message Length:   2000 characters
Community Posts:  10,000 characters
Search Debounce:  500ms
Pagination:       50 items per page
```

### Security Requirements
```typescript
Password:         8+ chars (mixed case, number, special)
Hashing:          bcrypt (10+ salt rounds)
Session:          7 days default, 30 days "remember me"
HTTPS:            TLS 1.3 required
Audit Retention:  1 year (security), 90 days (general)
Database:         Encryption at rest
```

### Performance Targets
```typescript
Page Load:        ≤3 seconds
Concurrent Users: 500 minimum
Uptime:           99.5% SLA
Database Indexes: Required on all queries
API Response:     ≤500ms (p95)
```

---

## 🚀 Use Cases Covered

| UC | Name | Critical Rules |
|----|------|----------------|
| UC-1 | Register & Login | bcrypt, session management, OAuth |
| UC-2 | List Book | Rate limits, AI suggestions, moderation |
| UC-3 | Search & Browse | Debounced search, pagination, filters |
| UC-4 | Exchange Books | State machine, chat integration |
| UC-5 | Messaging | Socket.IO, 2000 char limit, attachments |
| UC-6 | Community | 10K char posts, markdown, moderation |
| UC-7 | AI Discovery | Genkit+Gemini, 5/hour rate limit |
| UC-8 | Wishlist/Profile | 30 ops/min, profile completion |
| UC-9 | Donations | Organization approval required |
| UC-10 | Admin Dashboard | Audit logs, cannot delete admins |

---

## 🔐 Security & Compliance Summary

### Authentication Flow
```
1. User submits credentials
2. Validate password complexity
3. bcrypt comparison (10+ rounds)
4. Create session (NextAuth.js)
5. Set httpOnly cookie
6. Audit log login event
```

### Content Moderation Pipeline
```
User Input → Sanitization → AI Check (Gemini) → Approval/Rejection
                ↓               ↓                      ↓
         Strip HTML      Detect harmful         Log decision
```

### GDPR Compliance
- ✅ Data export functionality
- ✅ Right to deletion
- ✅ Privacy policy required
- ✅ Age restriction (13+)
- ✅ Breach notification (72 hours)
- ✅ Audit trails maintained

---

## 📊 Technology Stack Deep Dive

### Frontend Stack
```typescript
Framework:     Next.js 13+ (App Router, Server Components)
Language:      TypeScript 5+ (strict mode)
UI Library:    React 18+
Styling:       Tailwind CSS 3+
Components:    shadcn/ui (Radix UI primitives)
Forms:         react-hook-form + Zod validation
State:         Server Components (default), React hooks
```

### Backend Stack
```typescript
Runtime:       Node.js 18+
Framework:     Next.js API Routes + Server Actions
Database:      MongoDB 5+ with Mongoose 7+ ODM
Auth:          NextAuth.js v5
Encryption:    bcrypt (passwords)
Real-time:     Socket.IO 4+ with Redis adapter
AI:            Genkit + Google Gemini 2.5 Flash
Storage:       AWS S3 / Google Cloud Storage
```

### Deployment & DevOps
```typescript
Primary:       Vercel
Database:      MongoDB Atlas
Caching:       Redis (Socket.IO adapter)
Monitoring:    Vercel Analytics
Backups:       Daily automated (7-day retention)
RTO:           1 hour
RPO:           24 hours
```

---

## 🛠️ Development Standards

### Code Quality
```typescript
Test Coverage:     ≥80%
Linting:           ESLint (strict)
Formatting:        Prettier
Type Safety:       TypeScript strict mode
Code Review:       Required for all changes
Documentation:     JSDoc for public APIs
```

### Database Patterns
```typescript
Indexing:          Required on all query fields
Soft Delete:       deletedAt timestamps
Transactions:      Multi-document updates
Pagination:        Cursor-based (feeds), offset (pages)
Validation:        Mongoose schemas + Zod
Connection Pool:   Min 10, Max 100 connections
```

### Error Handling
```typescript
API Responses:     Consistent error format
Logging:           Structured logs (JSON)
User Messages:     Friendly, non-technical
Stack Traces:      Never exposed to clients
Rate Limiting:     429 responses with Retry-After
```

---

## 📖 How AI Agents Should Use This Documentation

### Step-by-Step Workflow

1. **Before Any Code Change:**
   - Read `QUICK_REFERENCE.md` for topic location
   - Review relevant detailed document (01-06)
   - Check forbidden actions list
   - Verify SRS alignment

2. **During Code Generation:**
   - Follow technology stack constraints
   - Implement required security measures
   - Add audit logging
   - Include error handling
   - Validate inputs

3. **After Code Generation:**
   - Run compliance checklist
   - Verify no forbidden actions violated
   - Ensure backward compatibility
   - Document any SRS interpretations

4. **When Uncertain:**
   - Escalate to human developer
   - Do NOT guess or improvise
   - Reference specific SRS sections
   - Suggest clarification questions

### Quick Navigation Table

| Need | Go To |
|------|-------|
| User roles & permissions | 01_CORE_SYSTEM_CONSTRAINTS.md |
| Use case implementation | 02_FUNCTIONAL_REQUIREMENTS.md |
| Performance targets | 03_NON_FUNCTIONAL_REQUIREMENTS.md |
| Database schema | 04_DATA_MODEL_ARCHITECTURE.md |
| Security protocols | 05_SECURITY_COMPLIANCE.md |
| Tech stack approval | 06_TECHNOLOGY_STACK.md |
| Quick lookup | QUICK_REFERENCE.md |
| Overview & critical rules | 00_README.md |

---

## ⚠️ Escalation Guidelines

### When to Escalate to Human Developer

1. **Ambiguous Requirements:** SRS not clear on implementation
2. **Technology Conflicts:** Approved tech doesn't support requirement
3. **Security Tradeoffs:** Performance vs. security decisions
4. **Schema Changes:** Database model alterations needed
5. **External Dependencies:** Third-party service integration
6. **Performance Issues:** Target metrics cannot be met
7. **Compliance Questions:** GDPR or legal interpretation
8. **State Machine Modifications:** Exchange workflow changes

### Never Proceed Without Approval For:
- ❌ Technology stack changes
- ❌ User role modifications
- ❌ State machine alterations
- ❌ Security protocol changes
- ❌ Data model relationship changes
- ❌ Rate limit adjustments
- ❌ Authentication flow modifications

---

## 📈 Success Metrics

### Documentation Completeness
- ✅ All 10 use cases documented
- ✅ All 10 entities documented
- ✅ All functional requirements covered
- ✅ All non-functional requirements specified
- ✅ All security protocols defined
- ✅ All technologies documented
- ✅ Forbidden actions clearly listed

### Protection Mechanisms
- ✅ Immutable technology stack enforced
- ✅ State machines locked
- ✅ Rate limits documented
- ✅ Security requirements mandatory
- ✅ Compliance checklists provided
- ✅ Escalation guidelines clear

### Usability Features
- ✅ Quick reference guide
- ✅ Navigation tables
- ✅ Topic-based lookups
- ✅ Code pattern examples
- ✅ Compliance templates
- ✅ Clear workflows

---

## 🔄 Maintenance Plan

### When to Update These Rules

1. **SRS Phase Updates:** New requirements added
2. **Technology Upgrades:** Major version updates approved
3. **Security Patches:** Critical vulnerabilities addressed
4. **Compliance Changes:** GDPR or legal updates
5. **Performance Tuning:** Targets adjusted based on metrics
6. **Lessons Learned:** Production issues inform new rules

### Update Process
1. Review SRS changes
2. Identify affected rule documents
3. Update specific sections
4. Maintain forbidden actions list
5. Update QUICK_REFERENCE.md
6. Version control commit
7. Notify development team

---

## 🎓 Key Takeaways for AI Agents

### Golden Rules
1. **SRS is Law:** Never deviate from specifications
2. **Security First:** No shortcuts on authentication/authorization
3. **Immutable Stack:** Cannot replace approved technologies
4. **State Machines:** Follow defined workflows exactly
5. **Rate Limits:** Always enforce documented limits
6. **Audit Everything:** Log all security-relevant actions
7. **Validate Always:** Never trust user input
8. **Fail Safely:** Graceful degradation, never expose internals
9. **Escalate Doubts:** When unsure, ask humans
10. **Document Decisions:** Explain SRS interpretations

### Common Pitfalls to Avoid
- ❌ Assuming requirements not explicitly stated
- ❌ Optimizing away security checks
- ❌ Bypassing rate limits "temporarily"
- ❌ Using unapproved libraries
- ❌ Storing sensitive data in logs
- ❌ Modifying state machines
- ❌ Disabling validation "for convenience"
- ❌ Exposing internal errors to users

---

## 📞 Contact & Support

**Documentation Maintained By:** Development Team  
**SRS Source:** BookEx Phase 1 Specification (73 pages)  
**Last Updated:** January 2025  
**Version:** 1.0.0

**For Questions:**
- Review relevant documentation section first
- Check QUICK_REFERENCE.md for quick answers
- Escalate to human developer when uncertain
- Never guess or improvise on SRS requirements

---

## ✅ Final Checklist for AI Agents

Before submitting any code:

- [ ] Read relevant rule sections
- [ ] Checked forbidden actions list
- [ ] Verified technology stack compliance
- [ ] Implemented required security measures
- [ ] Added audit logging
- [ ] Included error handling
- [ ] Validated all inputs
- [ ] Followed state machines
- [ ] Enforced rate limits
- [ ] Maintained data model integrity
- [ ] Added appropriate tests
- [ ] Documented code appropriately
- [ ] No SRS deviations
- [ ] Escalated any uncertainties

---

**Remember:** These rules exist to protect the BookEx system's integrity. When in doubt, always choose the most conservative, SRS-compliant approach. 🛡️

