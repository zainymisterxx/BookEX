# Security and Compliance Rules

## Security Standards and Protocols

### SEC-1: Authentication Security

#### SEC-1.1: Password Security

```
PASSWORD REQUIREMENTS (IMMUTABLE):

Complexity:
- Minimum length: 8 characters
- Must contain at least one uppercase letter (A-Z)
- Must contain at least one lowercase letter (a-z)
- Must contain at least one digit (0-9)
- Must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

Validation:
- Check against common password list (top 10,000 passwords)
- Cannot be same as email address
- Cannot be same as user's name
- Cannot contain sequential characters (123, abc)

Storage:
- MUST use bcrypt for hashing
- Salt rounds: minimum 10 (recommended 12)
- NEVER store plain text passwords
- NEVER log passwords (even hashed)
- Rotate salts on password change

Password Change:
- Require current password for changes
- Regenerate session on password change
- Invalidate all other sessions
- Email notification on password change
- Log password change events
```

#### SEC-1.2: Session Management

```
SESSION SECURITY:

Cookie Configuration:
- Use HTTP-only cookies (prevent XSS access)
- Set Secure flag (HTTPS only)
- Set SameSite=Strict (CSRF protection)
- Set appropriate expiration (24 hours)
- Use signed cookies

Session Data:
- Store session in database (MongoDB) or Redis
- Encrypt sensitive session data
- Include: userId, role, IP address, user agent
- Session timeout: 24 hours of inactivity
- Absolute timeout: 7 days (force re-login)

Session Lifecycle:
- Generate new session ID on login
- Regenerate session ID on privilege change
- Destroy session on logout
- Invalidate session on security events:
  * Password change
  * Role change
  * Account suspension
  * Suspicious activity detected

Session Monitoring:
- Track active sessions per user
- Allow user to view active sessions
- Allow user to terminate other sessions
- Admin can force logout users
```

#### SEC-1.3: Brute Force Protection

```
PROTECTION MECHANISMS:

Rate Limiting:
- Max login attempts: 5 per 15 minutes per IP
- Max login attempts: 10 per hour per account
- Max signup attempts: 5 per hour per IP

Account Lockout:
- Lock account after 10 failed attempts
- Lockout duration: 1 hour
- Notify user via email about lockout
- Require admin unlock after 3 lockouts

Progressive Delays:
- 1st failure: No delay
- 2nd failure: 1 second delay
- 3rd failure: 2 seconds delay
- 4th+ failure: Exponential backoff (max 30 seconds)

CAPTCHA:
- Show after 3 failed attempts
- Use on all authentication forms after threshold
- Use reCAPTCHA v3 (invisible) or hCaptcha

Monitoring:
- Log all failed login attempts
- Alert on suspicious patterns:
  * Many failures from single IP
  * Many failures on single account from different IPs
  * Failures outside normal hours
  * Geographic anomalies
```

#### SEC-1.4: Two-Factor Authentication (Future Enhancement)

```
2FA IMPLEMENTATION (When implemented):

Methods:
- TOTP (Time-based One-Time Password)
- Authenticator apps (Google Authenticator, Authy)
- SMS backup codes (last resort)

Requirements:
- Optional for regular users
- Mandatory for admin accounts
- Backup codes generated on 2FA setup
- Recovery mechanism for lost devices

Security:
- Secrets stored encrypted
- Rate limit 2FA attempts
- Lock account after 5 failed 2FA attempts
- Notify user of 2FA changes via email
```

---

### SEC-2: Authorization and Access Control

#### SEC-2.1: Role-Based Access Control (RBAC)

```
ROLE DEFINITIONS:

Role: visitor (unauthenticated)
Permissions:
- View public book listings
- View public communities
- Search books (limited)
- View public user profiles
Restrictions:
- Cannot create, update, delete any resources
- Cannot access messaging
- Cannot join communities
- Cannot propose exchanges

Role: user (authenticated standard user)
Permissions:
- All visitor permissions
- Create/edit/delete own book listings (rate limited)
- Propose exchanges
- Send messages
- Join/leave communities
- Post in communities (as member)
- Comment on posts
- Wishlist books
- Update own profile
- Initiate donations
- Report content
Restrictions:
- Cannot access admin dashboard
- Cannot moderate other users' content
- Cannot view other users' private data
- Cannot change own role

Role: organization (authenticated organization account)
Permissions:
- All user permissions
- Receive donation requests
- Accept/reject donations
- Manage donation campaigns
- View donation history
Restrictions:
- Same as regular user
- Cannot create book listings for sale (only donations)

Role: admin (elevated privileges)
Permissions:
- All user permissions
- Access admin dashboard
- View all user data (except passwords)
- Suspend/restore user accounts
- Delete content (soft delete)
- Moderate flagged content
- Resolve reports
- View system logs
- Run maintenance scripts
- Change user roles (except other admins)
- View analytics and statistics
- Configure system settings
Restrictions:
- Cannot delete other admin accounts
- Cannot suspend own account
- Cannot view password hashes
- Cannot impersonate users (no login as user)
- All actions are logged
```

#### SEC-2.2: Resource Ownership Verification

```
OWNERSHIP RULES:

Books:
- User can only edit/delete own books
- Check: book.userId === currentUser._id
- Admin can moderate any book

Posts:
- Author can edit within 15 minutes of creation
- Author can delete anytime
- Check: post.authorId === currentUser._id
- Moderators/admins can edit/delete any post

Comments:
- Author can edit/delete own comments
- Check: comment.authorId === currentUser._id
- Moderators can delete any comment

Messages:
- Sender cannot edit after sending
- Sender cannot delete from recipient's view
- Both participants can view message history
- Check: chat.participants.includes(currentUser._id)

Exchanges:
- Only participants can view exchange details
- Check: exchange.initiatorId === currentUser._id || exchange.recipientId === currentUser._id
- Admin can view for moderation

Donations:
- Donor and organization can view
- Check: donation.donorId === currentUser._id || donation.organizationId === currentUser._id

ENFORCEMENT:
- Verify ownership on EVERY operation (create, read, update, delete)
- Check on server side (never trust client)
- Return 403 Forbidden if ownership check fails
- Log authorization failures
```

#### SEC-2.3: API Endpoint Protection

```
PROTECTION LAYERS:

Layer 1: Authentication Check
- Verify user is logged in
- Check session validity
- Verify token/cookie signature
- Reject if not authenticated (401 Unauthorized)

Layer 2: Authorization Check
- Verify user has required role
- Verify user has permission for action
- Verify user owns resource (if applicable)
- Reject if not authorized (403 Forbidden)

Layer 3: Rate Limiting
- Check rate limit for user/IP
- Reject if exceeded (429 Too Many Requests)
- Log rate limit violations

Layer 4: Input Validation
- Validate request parameters
- Sanitize input
- Reject invalid input (400 Bad Request)

IMPLEMENTATION:
- Use middleware for layers 1-3
- Apply to all protected routes
- Cannot be bypassed or disabled
- Order: Authentication → Authorization → Rate Limiting → Business Logic
```

---

### SEC-3: Data Protection

#### SEC-3.1: Encryption Standards

```
ENCRYPTION IN TRANSIT:

HTTPS/TLS:
- MANDATORY: All traffic over HTTPS
- TLS version: 1.3 minimum (1.2 acceptable)
- Certificate: Valid SSL/TLS certificate
- Redirect HTTP to HTTPS (301 Permanent Redirect)
- HSTS header: max-age=31536000; includeSubDomains

Headers:
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin

WebSocket Security:
- Use WSS (WebSocket Secure)
- Same TLS standards as HTTPS
- Verify origin header

ENCRYPTION AT REST:

Database:
- Enable MongoDB encryption at rest
- Encrypt sensitive fields individually:
  * Phone numbers
  * Addresses (if added)
  * Payment info (future)
- Use envelope encryption (master key + data keys)

File Storage:
- Server-side encryption for cloud storage
- Encrypt files before upload (optional, performance trade-off)
- Store encryption keys securely (secrets manager)

Backups:
- Encrypt all backups
- Use separate encryption keys
- Test encrypted backup restoration

SESSION ENCRYPTION:
- Encrypt session data before storage
- Use AES-256 for session encryption
- Rotate encryption keys periodically
```

#### SEC-3.2: Data Sanitization

```
INPUT SANITIZATION:

HTML Content (Posts, Comments, Messages):
- Strip dangerous tags: <script>, <iframe>, <object>, <embed>
- Allow safe tags: <b>, <i>, <u>, <a>, <p>, <br>, <strong>, <em>
- Sanitize attributes (allow only safe attributes)
- Use DOMPurify or similar library
- Escape special characters: <, >, &, ", '

SQL/NoSQL Injection Prevention:
- Use parameterized queries (N/A for MongoDB)
- Validate and cast types
- Use Mongoose schema validation
- Never concatenate user input into queries
- Sanitize user input before database operations

Command Injection Prevention:
- NEVER execute user input as system commands
- Validate and sanitize file names
- Use safe APIs (avoid exec, eval)
- Whitelist allowed values

XSS Prevention:
- Escape output (React does this by default)
- Use dangerouslySetInnerHTML only when necessary
- Sanitize before using dangerouslySetInnerHTML
- Content Security Policy headers

OUTPUT SANITIZATION:

API Responses:
- Never include sensitive fields:
  * Password hashes
  * Session tokens
  * API keys
  * Internal system paths
- Use projection to exclude sensitive fields
- Sanitize error messages (no stack traces)

Logging:
- Redact sensitive data before logging:
  * Passwords
  * Tokens
  * Credit card numbers
  * PII (beyond necessary)
- Use [REDACTED] placeholder
```

#### SEC-3.3: File Upload Security

```
FILE UPLOAD RULES:

Validation:
- Allowed types: images (jpg, png, webp), PDF
- Max file size: 5 MB per file
- Verify MIME type (content-type header)
- Verify magic numbers (file signature)
- Reject executable files (.exe, .sh, .bat)

Processing:
- Rename files (use UUID, don't trust original filename)
- Store outside web document root
- Scan for malware (if scanner available)
- Generate thumbnails for images server-side
- Strip EXIF data from images (privacy)

Storage:
- Store in separate storage service (S3, GCS)
- Use signed URLs for access (time-limited)
- Enable CORS restrictions
- Set appropriate cache headers
- Enable versioning (for rollback)

Serving:
- Serve via CDN with security headers
- Set Content-Type correctly
- Use Content-Disposition: attachment for downloads
- Implement rate limiting for downloads
- Log download activity
```

---

### SEC-4: Content Security

#### SEC-4.1: Content Security Policy (CSP)

```
CSP HEADER CONFIGURATION:

default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
  // Note: 'unsafe-inline' required for Next.js, minimize in production
style-src 'self' 'unsafe-inline';
  // Note: 'unsafe-inline' required for styled components
img-src 'self' data: https: blob:;
  // Allow images from HTTPS sources and data URIs
font-src 'self' data:;
connect-src 'self' wss://yourdomain.com;
  // Include WebSocket endpoint
frame-ancestors 'none';
  // Prevent clickjacking
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
  // Upgrade HTTP to HTTPS automatically

IMPLEMENTATION:
- Set via Next.js headers configuration
- Test thoroughly (CSP can break functionality)
- Use report-uri for violation reporting
- Start with report-only mode, then enforce
```

#### SEC-4.2: Cross-Site Request Forgery (CSRF) Protection

```
CSRF PROTECTION:

Token-Based:
- Generate CSRF token on session creation
- Include token in forms as hidden field
- Verify token on state-changing requests (POST, PUT, DELETE)
- Reject requests with missing/invalid token

SameSite Cookies:
- Set SameSite=Strict for session cookies
- Prevents cookies from being sent on cross-site requests
- Provides automatic CSRF protection

Double Submit Cookie:
- Send CSRF token as both cookie and request parameter
- Verify both match on server
- Attacker cannot read cookie due to same-origin policy

EXEMPTIONS:
- GET requests (should be idempotent)
- Publicly accessible APIs (if any)
- Requests with valid API key authentication (future)

IMPLEMENTATION:
- Next.js Server Actions have built-in CSRF protection
- Verify on API routes manually
- Use csrf package for token generation/verification
```

#### SEC-4.3: Cross-Origin Resource Sharing (CORS)

```
CORS CONFIGURATION:

Allowed Origins:
- Production: https://yourdomain.com
- Development: http://localhost:3000
- NO wildcard (*) in production

Allowed Methods:
- GET, POST, PUT, PATCH, DELETE

Allowed Headers:
- Content-Type
- Authorization
- X-Requested-With

Credentials:
- Access-Control-Allow-Credentials: true
  // Required for cookies/session

Preflight Caching:
- Access-Control-Max-Age: 86400 (24 hours)

IMPLEMENTATION:
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    },
  ];
}

SECURITY:
- Validate Origin header on server
- Never echo Origin header without validation
- Log CORS violations
```

---

### SEC-5: Audit Logging and Monitoring

#### SEC-5.1: Security Event Logging

```
EVENTS TO LOG:

Authentication:
- Login attempts (success and failure)
  Log: timestamp, userId/email, IP, userAgent, result
- Logout events
  Log: timestamp, userId, IP
- Password changes
  Log: timestamp, userId, IP, initiator (user or admin)
- Failed authentication attempts
  Log: timestamp, email, IP, userAgent, reason
- Account lockouts
  Log: timestamp, email/userId, IP, lockout_duration
- Session creation/destruction
  Log: timestamp, userId, sessionId, IP
- Suspicious activity:
  * Multiple failures from same IP
  * Login from unusual location
  * Login from unusual device

Authorization:
- Access to protected resources
  Log: timestamp, userId, resource, action, result
- Permission denied events
  Log: timestamp, userId, resource, action, reason
- Role changes
  Log: timestamp, targetUserId, oldRole, newRole, changedBy, reason
- Privilege escalation attempts (critical)
  Log: timestamp, userId, attemptedAction, IP, userAgent

Data Modifications:
- User account changes
  Log: timestamp, targetUserId, changes, changedBy, reason
- Admin actions on content
  Log: timestamp, adminId, action, targetType, targetId, reason
- Bulk operations (critical)
  Log: timestamp, userId, operation, affectedCount
- Configuration changes
  Log: timestamp, adminId, setting, oldValue, newValue
- Report resolutions
  Log: timestamp, adminId, reportId, action, notes

Security Events:
- SQL/NoSQL injection attempts
  Log: timestamp, IP, endpoint, payload
- XSS attempts
  Log: timestamp, IP, endpoint, payload
- CSRF token violations
  Log: timestamp, userId, IP, endpoint
- Rate limit violations
  Log: timestamp, userId/IP, endpoint, limitType
- Malware upload attempts
  Log: timestamp, userId, filename, fileHash
```

#### SEC-5.2: Log Management

```
LOG FORMAT:

Structured Logging (JSON):
{
  timestamp: "2024-12-09T10:30:00.000Z",
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL",
  eventType: "AUTH_LOGIN" | "AUTH_FAILURE" | "AUTHORIZATION_DENIED" | ...,
  userId: "ObjectId or null",
  ip: "IPv4 or IPv6",
  userAgent: "string",
  action: "description of action",
  resource: "resource type and ID",
  result: "success" | "failure",
  reason: "explanation if failure",
  metadata: {
    // Additional context-specific data
  }
}

LOG LEVELS:
- DEBUG: Development only, not in production
- INFO: Normal operations, important events
- WARN: Potential issues, degraded functionality
- ERROR: Errors requiring attention
- CRITICAL: System failures, security breaches

LOG STORAGE:
- Centralized logging service (e.g., Datadog, Splunk, ELK stack)
- Separate security logs from application logs
- Encrypt logs in transit and at rest
- Immutable logs (append-only)

LOG RETENTION:
- Security logs: 1 year minimum (compliance)
- Activity logs: 90 days
- Error logs: 30 days
- Debug logs: 7 days (development only)
- Permanent retention for critical security events

LOG ACCESS:
- Restricted to admins and authorized personnel
- Log all access to logs (meta-logging)
- Separate read-only access for auditors
```

#### SEC-5.3: Real-Time Monitoring and Alerting

```
MONITORING TARGETS:

Security Metrics:
- Failed login attempts (rate and count)
- Account lockouts
- Authorization failures
- Rate limit violations
- CSRF token violations
- Malicious payload attempts
- Anomalous user behavior

System Metrics:
- Error rate (errors per minute)
- Response time (p50, p95, p99)
- Request rate (requests per second)
- CPU and memory usage
- Database connection pool usage
- WebSocket connection count

ALERTING RULES:

Critical Alerts (immediate response):
- Failed login attempts > 100 per minute (DDoS?)
- Multiple privilege escalation attempts
- Database connection failures
- System error rate > 10%
- Downtime detected

High Priority Alerts (respond within 1 hour):
- Failed login rate > 20 per minute
- Multiple account lockouts
- Unusual geographic login patterns
- Response time > 5 seconds consistently
- Memory usage > 90%

Medium Priority Alerts (respond within 4 hours):
- Error rate > 5%
- Rate limit violations increasing
- Slow database queries (> 1 second)

ALERT CHANNELS:
- Email for all alerts
- SMS for critical alerts
- Slack/Teams for team notifications
- PagerDuty for on-call engineers
```

---

### SEC-6: Compliance and Privacy

#### SEC-6.1: GDPR-Equivalent Compliance

```
DATA SUBJECT RIGHTS:

Right to Access:
- User can view all their data
- Provide data export functionality (JSON format)
- Response time: Within 30 days of request

Right to Rectification:
- User can update their profile information
- User can correct inaccurate data
- System updates related records

Right to Erasure (Right to be Forgotten):
- User can request account deletion
- Delete or anonymize personal data
- Retain necessary data for legal obligations (e.g., transaction records)
- Anonymize rather than delete where possible
- Response time: Within 30 days of request

Right to Data Portability:
- Provide data in machine-readable format (JSON)
- Include all personal data
- Allow transfer to another service (if requested)

Right to Object:
- User can object to data processing
- Option to disable analytics/tracking
- Option to disable email notifications

Right to Restrict Processing:
- User can request to restrict how data is used
- Mark account as "do not contact"

DATA MINIMIZATION:
- Collect only necessary data
- Clear purpose for each data point
- Delete data when no longer needed
- Regular data cleanup (inactive accounts, old messages)

CONSENT MANAGEMENT:
- Explicit consent for optional data collection
- Granular consent options (email, analytics, etc.)
- Easy withdrawal of consent
- Record consent timestamp and method
```

#### SEC-6.2: Privacy Policy

```
PRIVACY POLICY REQUIREMENTS:

Must Include:
1. What data is collected
   - Personal information (name, email, etc.)
   - Usage data (logs, analytics)
   - Technical data (IP address, device info)

2. How data is collected
   - User input (forms, uploads)
   - Automatic collection (cookies, analytics)
   - Third-party sources (OAuth, if implemented)

3. Why data is collected (purposes)
   - Provide service functionality
   - Improve user experience
   - Security and fraud prevention
   - Legal compliance

4. How data is used
   - Service provision
   - Communication
   - Personalization
   - Analytics (aggregated only)

5. Data sharing and disclosure
   - Third-party services (email, storage, AI)
   - Legal requirements
   - No selling of data

6. Data retention
   - Retention periods for each data type
   - Deletion after retention period

7. Security measures
   - Encryption in transit and at rest
   - Access controls
   - Regular security audits

8. User rights
   - All GDPR-equivalent rights
   - How to exercise rights
   - Contact information

9. Cookies and tracking
   - Types of cookies used
   - Purpose of each cookie
   - How to disable cookies

10. Changes to policy
    - Notification method for changes
    - Effective date of changes

11. Contact information
    - Privacy contact email
    - Data protection officer (if applicable)

IMPLEMENTATION:
- Accessible link in footer
- Show on registration
- Require acceptance (checkbox)
- Version tracking
- Notify users of changes
```

#### SEC-6.3: Age Restrictions and Parental Consent

```
AGE VERIFICATION:

Minimum Age: 13 years old (COPPA compliance)

Verification:
- Require birthdate during registration
- Validate age before account creation
- Reject registration if under 13
- Display clear age requirement

For Users Under 18 (optional, enhanced protection):
- Limited profile visibility
- Restricted messaging (optional)
- Parental consent option
- Additional privacy protections

CONTENT APPROPRIATENESS:
- Family-friendly content policy
- No adult content allowed
- Age-appropriate book recommendations
- Content warnings if needed
```

---

### SEC-7: Third-Party Security

#### SEC-7.1: Dependency Management

```
SECURE DEPENDENCY PRACTICES:

Vulnerability Scanning:
- Run npm audit regularly (weekly minimum)
- Use Snyk or Dependabot for continuous monitoring
- Auto-update security patches
- Review and fix vulnerabilities promptly

Dependency Updates:
- Keep dependencies up-to-date
- Review changelogs before updating
- Test after updates
- Pin major versions (allow minor/patch updates)

Dependency Selection:
- Prefer well-maintained packages
- Check package reputation (downloads, stars, maintainers)
- Avoid packages with known vulnerabilities
- Minimize number of dependencies

Supply Chain Security:
- Verify package integrity (checksums)
- Use lock files (package-lock.json)
- Review dependencies of dependencies
- Be cautious of typosquatting
```

#### SEC-7.2: API Key and Secrets Management

```
SECRETS HANDLING:

Storage:
- NEVER commit secrets to version control
- Use .env files for local development
- Use secrets manager in production (AWS Secrets Manager, Azure Key Vault)
- Encrypt secrets at rest

Environment Variables:
- Use environment variables for configuration
- Provide .env.example with no actual secrets
- Document all required environment variables
- Validate presence of required env vars on startup

API Keys:
- Rotate API keys regularly
- Use separate keys for dev/staging/production
- Restrict API key permissions (principle of least privilege)
- Monitor API key usage
- Revoke unused or compromised keys immediately

Access Control:
- Limit who can access secrets (need-to-know basis)
- Audit secret access
- Use different secrets for different services
- Never log secrets (even partially)

Key Rotation:
- Rotate encryption keys annually
- Rotate API keys quarterly
- Immediate rotation if compromise suspected
- Maintain key history for decryption of old data
```

#### SEC-7.3: Third-Party Service Security

```
SERVICE INTEGRATION SECURITY:

Email Service (SendGrid, AWS SES, future):
- Use API keys, not passwords
- Restrict sender addresses
- Enable DKIM, SPF, DMARC
- Monitor for abuse
- Rate limit emails sent

AI Service (Google Gemini):
- Secure API key storage
- Rate limit requests
- Validate responses
- Handle service failures gracefully
- Monitor usage and costs
- Don't send sensitive user data to AI

Storage Service (AWS S3, GCS):
- Use IAM roles, not access keys (if possible)
- Enable encryption at rest
- Restrict bucket access (private buckets)
- Use signed URLs for access
- Enable versioning and MFA delete
- Monitor access logs

WebSocket Service (Socket.IO + Redis):
- Secure Redis with password
- Use Redis over TLS
- Restrict Redis access (firewall)
- Monitor Redis performance
- Regular Redis backups

GENERAL PRACTICES:
- Minimize data sent to third parties
- Review third-party privacy policies
- Sign Data Processing Agreements (DPA)
- Monitor third-party security posture
- Have fallback plans for service failures
```

---

### SEC-8: Incident Response

#### SEC-8.1: Security Incident Response Plan

```
INCIDENT CATEGORIES:

Critical (immediate response):
- Data breach (unauthorized data access)
- System compromise (attacker access)
- Ransomware attack
- DDoS attack causing outage
- Multiple privilege escalation attempts

High (respond within 1 hour):
- Suspected data breach
- Multiple account compromises
- Malware detection
- Sustained DDoS attack

Medium (respond within 4 hours):
- Increased failed login attempts
- Suspected credential stuffing
- Content policy violations (spam wave)

Low (respond within 24 hours):
- Individual account compromise
- Minor policy violations
- Performance degradation

RESPONSE PROCESS:

1. Detection and Alert
   - Automated monitoring alerts
   - User reports
   - Security scan findings

2. Initial Assessment (within 15 minutes)
   - Confirm incident is real
   - Classify severity
   - Assign incident responder
   - Activate incident response team if critical

3. Containment (immediate for critical)
   - Isolate affected systems
   - Block malicious IPs
   - Suspend compromised accounts
   - Stop data exfiltration

4. Investigation
   - Analyze logs
   - Determine scope of breach
   - Identify root cause
   - Document findings

5. Eradication
   - Remove malware/attacker access
   - Patch vulnerabilities
   - Update security rules
   - Reset compromised credentials

6. Recovery
   - Restore systems from clean backups
   - Verify system integrity
   - Monitor for reinfection
   - Gradual service restoration

7. Post-Incident Review
   - Document incident details
   - Analyze response effectiveness
   - Identify improvements
   - Update security measures
   - Update incident response plan

8. Notification (if required)
   - Notify affected users (within 72 hours of discovery)
   - Notify authorities if legally required
   - Public disclosure if appropriate
   - Provide remediation steps to users
```

#### SEC-8.2: Data Breach Response

```
DATA BREACH PROTOCOL:

Immediate Actions:
1. Stop the breach (isolate systems)
2. Preserve evidence (logs, system state)
3. Assess scope (what data, how many users)
4. Notify incident response team

Within 24 Hours:
- Determine if personal data was compromised
- Identify affected users
- Assess risk to users
- Prepare notification template

Within 72 Hours (GDPR requirement):
- Notify data protection authority (if applicable)
- Notify affected users if high risk
- Provide:
  * Nature of breach
  * Categories of data affected
  * Number of users affected
  * Potential consequences
  * Measures taken
  * Measures users should take

User Notification:
- Email to affected users
- In-app notification
- Public statement (if large-scale)
- Offer credit monitoring (if financial data)
- Provide support contact

Follow-Up:
- Detailed investigation report
- Implement preventive measures
- Update security policies
- Train team on lessons learned
```

---

## Compliance Checklist for Security

Before deploying to production:

**Authentication:**
- [ ] Password complexity enforced (8+ chars, mixed case, number, special)
- [ ] bcrypt with salt rounds ≥ 10
- [ ] Session management secure (HTTP-only, Secure, SameSite cookies)
- [ ] Brute force protection implemented
- [ ] Rate limiting on auth endpoints

**Authorization:**
- [ ] RBAC implemented and enforced
- [ ] Ownership verification on all operations
- [ ] Admin actions logged
- [ ] API endpoints protected with auth middleware

**Data Protection:**
- [ ] HTTPS enforced (TLS 1.2+)
- [ ] Database encryption at rest enabled
- [ ] Sensitive fields encrypted
- [ ] Input sanitization implemented
- [ ] Output sanitization (no sensitive data exposed)

**Content Security:**
- [ ] CSP headers configured
- [ ] CSRF protection enabled
- [ ] CORS configured (no wildcard)
- [ ] File upload security implemented

**Audit and Monitoring:**
- [ ] Security event logging enabled
- [ ] Log retention policies defined
- [ ] Real-time monitoring configured
- [ ] Alerting rules defined

**Compliance:**
- [ ] Privacy policy published
- [ ] Data export functionality
- [ ] Account deletion option
- [ ] Age verification implemented
- [ ] Consent mechanisms in place

**Incident Response:**
- [ ] Incident response plan documented
- [ ] Team roles assigned
- [ ] Contact information current
- [ ] Backup and recovery tested

**Third-Party Security:**
- [ ] Dependency vulnerabilities scanned
- [ ] Secrets stored securely
- [ ] API keys rotated
- [ ] Third-party service agreements signed

**AI agents must verify all security measures before deployment.**

---

## Security by Design Principles

1. **Defense in Depth**: Multiple layers of security (authentication, authorization, rate limiting, input validation)
2. **Principle of Least Privilege**: Users/services have minimum permissions needed
3. **Fail Securely**: System fails to secure state (deny access) rather than open state
4. **Secure by Default**: Security features enabled by default, not opt-in
5. **Separation of Duties**: No single person has all privileges
6. **Complete Mediation**: Every access checked, no caching of auth decisions
7. **Open Design**: Security through solid design, not obscurity
8. **Psychological Acceptability**: Security measures don't hinder usability excessively

**All AI agents must follow these principles when implementing features.**
