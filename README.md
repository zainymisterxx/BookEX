# BookEx

**Community-driven platform for buying, selling, donating, and exchanging books with real-time messaging, communities, and AI-assisted discovery.**

[![Tech Stack](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5+-green?logo=mongodb)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-white?logo=socket.io&logoColor=black)](https://socket.io/)

> 📘 **For AI Agents & Developers:** Review the [`AI_rules/`](./AI_rules/) directory for comprehensive development constraints, security requirements, and SRS-compliant implementation guidelines.

---

## ✨ Features

### Core Functionality
- 📚 **Buy, Sell, Exchange** - List books, browse catalog, track exchange history
- 🤝 **Book Exchange System** - State-managed exchange workflow with chat integration
- 💝 **Donation Management** - Organization-verified donation program
- 🔍 **Advanced Search** - Multi-filter search with AI-powered recommendations

### Community & Social
- 👥 **Communities** - Topic and city-based communities with posts, comments, and likes
- 💬 **Real-Time Chat** - Socket.IO messaging with file attachments and typing indicators
- ⭐ **Reviews & Ratings** - User reputation system
- 🔔 **Smart Notifications** - Real-time updates for messages, exchanges, and community activity

### AI-Powered Features
- 🤖 **AI Discovery** - Gemini-powered book recommendations and summaries
- 🎯 **Content Moderation** - Automated harmful content detection
- 📝 **Smart Suggestions** - AI-assisted book descriptions and categorization

### Administration & Security
- 🛡️ **Role-Based Access Control** - Visitor, User, Admin, Organization roles
- 📊 **Admin Dashboard** - User management, content moderation, system monitoring
- 🔒 **Security First** - bcrypt passwords, rate limiting, audit logs, CSRF protection
- 📈 **Performance** - MongoDB indexes, Redis caching, optimized queries

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router) with React 18
- **Language:** TypeScript 5+ (strict mode)
- **Styling:** Tailwind CSS 3+ with shadcn/ui components
- **Forms:** react-hook-form + Zod validation
- **State:** Server Components (default), React hooks

### Backend
- **Runtime:** Node.js 18+
- **API:** Next.js API Routes + Server Actions
- **Database:** MongoDB 5+ with Mongoose 7+ ODM
- **Authentication:** NextAuth.js v5 with bcrypt
- **Real-Time:** Socket.IO 4+ with Redis adapter
- **AI Engine:** Genkit + Google Gemini 2.5 Flash
- **Caching:** Redis (optional, recommended for production)
- **Storage:** AWS S3 / Google Cloud Storage support

### DevOps & Deployment
- **Primary:** Vercel
- **Database:** MongoDB Atlas
- **Monitoring:** Vercel Analytics
- **CI/CD:** GitHub Actions ready

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MongoDB** 5+ (Atlas or local instance)
- **Redis** (optional but recommended for production)
- **Google AI API Key** for Gemini features

---

## 🚀 Getting Started

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/sabih-haider1/BookEX.git
cd BookEX

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the project root:

```bash
# Database
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/bookex"

# Authentication
NEXTAUTH_URL="http://localhost:9002"
NEXTAUTH_SECRET="your-secret-key-here"

# Real-Time (optional override)
SOCKET_PORT=3001

# Redis (optional, recommended for production)
REDIS_URL="redis://localhost:6379"

# AI / Genkit
GEMINI_API_KEY="your-google-ai-api-key"

# Storage (optional)
# AWS_ACCESS_KEY_ID="your-aws-access-key"
# AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
# AWS_REGION="us-east-1"
# AWS_BUCKET="your-bucket-name"
```

> 💡 **Tip:** Copy `env.production.example` for a complete list of available variables.

### 3. Database Setup

```bash
# Create database indexes
npm run setup:indexes

# Optional: Run database optimization
npm run optimize:db
```

### 4. Run Development Server

```bash
# Start Next.js (port 9002) and Socket.IO server together
npm run dev
```

The application will be available at:
- **Web App:** http://localhost:9002
- **Socket.IO Server:** http://localhost:3001

### 5. Optional: AI Development Tools

```bash
# Genkit Dev UI for testing AI flows
npm run genkit:dev

# Or watch mode
npm run genkit:watch
```

---

## 📜 Available Scripts

### Development
```bash
npm run dev          # Start Next.js + Socket.IO servers
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

### Database Operations
```bash
npm run setup:db          # Initialize database
npm run setup:indexes     # Create database indexes
npm run optimize:db       # Optimize database performance
```

### Maintenance & Security
```bash
npm run file:cleanup           # Clean up old files
npm run business:maintenance   # Business logic maintenance
npm run content:maintenance    # Content moderation tasks
npm run security:audit        # Security audit
```

### AI Development
```bash
npm run genkit:dev    # Genkit Dev UI
npm run genkit:watch  # Genkit watch mode
```

---

## 📁 Project Structure

```text
BookEX/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (main)/            # User-facing pages
│   │   │   ├── books/         # Book listing & search
│   │   │   ├── community/     # Community features
│   │   │   ├── exchange/      # Exchange management
│   │   │   ├── messages/      # Real-time chat
│   │   │   └── profile/       # User profiles
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── admin/         # Admin operations
│   │   │   ├── communities/   # Community APIs
│   │   │   └── files/         # File upload/management
│   │   └── layout.tsx         # Root providers & layout
│   │
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── admin/            # Admin dashboard components
│   │   └── community/        # Community components
│   │
│   ├── lib/                   # Core libraries
│   │   ├── mongodb.ts        # Database connection
│   │   ├── auth-config.ts    # NextAuth configuration
│   │   ├── data.ts           # Data access layer
│   │   ├── security/         # Security utilities
│   │   └── rate-limiting.ts  # Rate limiting logic
│   │
│   ├── ai/                    # AI integration
│   │   ├── genkit.ts         # Genkit configuration
│   │   ├── flows/            # AI flows (search, recommendations)
│   │   └── tools/            # AI tools & utilities
│   │
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript type definitions
│
├── AI_rules/                  # 🤖 AI Agent Guidelines
│   ├── 00_README.md          # Overview & critical instructions
│   ├── 01_CORE_SYSTEM_CONSTRAINTS.md
│   ├── 02_FUNCTIONAL_REQUIREMENTS.md
│   ├── 03_NON_FUNCTIONAL_REQUIREMENTS.md
│   ├── 04_DATA_MODEL_ARCHITECTURE.md
│   ├── 05_SECURITY_COMPLIANCE.md
│   ├── 06_TECHNOLOGY_STACK.md
│   ├── QUICK_REFERENCE.md    # Quick lookup guide
│   └── PROJECT_SUMMARY.md    # Visual overview
│
├── server.ts                  # Socket.IO real-time server
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

---

## 🏗️ Architecture Overview

### Application Flow
```
User Request → Next.js App Router → Server Components → MongoDB
                    ↓
              API Routes → Business Logic → Data Layer
                    ↓
            Socket.IO Server → Real-Time Updates
                    ↓
              Redis Cache → Performance Layer
```

### Key Architectural Decisions

#### 1. **Next.js App Router**
- Server Components by default for optimal performance
- API routes under `src/app/api/*` for REST endpoints
- Server Actions for form submissions and mutations

#### 2. **Authentication & Authorization**
- NextAuth.js v5 with credentials provider
- Session tokens include: `role`, `status`, `profileCompleted`
- bcrypt password hashing (10+ salt rounds)
- Role-Based Access Control (RBAC): Visitor, User, Admin, Organization

#### 3. **Database Architecture**
- MongoDB with Mongoose ODM
- 10 core entities with proper indexing
- Soft delete pattern (`deletedAt` timestamps)
- Transaction support for multi-document updates
- Connection pooling (min 10, max 100)

#### 4. **Real-Time Communication**
Socket.IO server (`server.ts`) handles:
- **Chat rooms:** Direct messaging between users
  - `joinChat`, `sendMessage` → `receiveMessage`
- **Community rooms:** `community_{id}`
  - `newPost`, `newComment`, `postLikeUpdate`
- **User rooms:** `user_{id}`
  - `newNotification` for alerts

#### 5. **Redis Integration** (Optional)
- Caching for frequently accessed data
- Rate limiting enforcement
- Socket.IO adapter for multi-server scaling
- Graceful degradation if unavailable

#### 6. **AI Integration**
- Genkit framework with Google Gemini 2.5 Flash
- Flows: search, recommendations, summaries, content moderation
- Rate limited: 5 requests per user per hour
- Tools in `src/ai/tools/*`

### State Management

#### Book Listing States
```
Draft → Active → On Hold ⟷ Reserved → Sold/Exchanged
                    ↓
                 Inactive
```

#### Exchange Workflow
```
Proposed → Accepted → In Progress → Completed
    ↓          ↓            ↓
Rejected   Cancelled   Cancelled
```

---

## 🔒 Security Features

- **Password Security:** bcrypt hashing with 10+ salt rounds
- **Rate Limiting:** 
  - 10 book listings per user per day
  - 5 AI requests per user per hour
  - 30 profile updates per minute
- **Content Moderation:** AI-powered harmful content detection
- **Audit Logging:** All security events logged with 1-year retention
- **HTTPS Only:** TLS 1.3 required in production
- **Input Validation:** Zod schemas for all user inputs
- **CSRF Protection:** Built-in with NextAuth.js
- **Security Headers:** CSP, HSTS, X-Frame-Options configured

---

## 🤖 For AI Agents & Developers

### **Important: Review AI Rules Before Contributing**

This project follows strict development guidelines to maintain system integrity and security. Before making any code changes:

1. **Read:** [`AI_rules/00_README.md`](./AI_rules/00_README.md) for overview
2. **Check:** [`AI_rules/QUICK_REFERENCE.md`](./AI_rules/QUICK_REFERENCE.md) for quick lookups
3. **Review:** Relevant detailed documents (01-06) for your feature area
4. **Verify:** Your changes don't violate any forbidden actions

### Key Constraints
- ❌ **Cannot replace** approved technology stack
- ❌ **Cannot modify** user role hierarchy or state machines
- ❌ **Cannot bypass** authentication, authorization, or rate limiting
- ❌ **Cannot disable** content moderation or audit logging
- ❌ **Cannot skip** input validation or security measures

### Documentation Structure
```
AI_rules/
├── 00_README.md                      # Start here
├── 01_CORE_SYSTEM_CONSTRAINTS.md     # System boundaries
├── 02_FUNCTIONAL_REQUIREMENTS.md     # All 10 use cases
├── 03_NON_FUNCTIONAL_REQUIREMENTS.md # Performance & quality
├── 04_DATA_MODEL_ARCHITECTURE.md     # Database & patterns
├── 05_SECURITY_COMPLIANCE.md         # Security protocols
├── 06_TECHNOLOGY_STACK.md            # Immutable tech list
├── QUICK_REFERENCE.md                # Quick lookups
└── PROJECT_SUMMARY.md                # Visual overview
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect Repository:** Link your GitHub repository to Vercel
2. **Configure Environment Variables:** Add all variables from `.env.local`
3. **Deploy:** Vercel will automatically build and deploy

```bash
# Build command
npm run build

# Start command
npm start

# Install command
npm install
```

### Environment Variables (Production)
Ensure these are set in your deployment platform:
- `MONGODB_URI` - MongoDB connection string
- `NEXTAUTH_URL` - Production URL
- `NEXTAUTH_SECRET` - Secure random string
- `GEMINI_API_KEY` - Google AI API key
- `REDIS_URL` - Redis connection (optional)
- `SOCKET_PORT` - Socket.IO port (default: 3001)

### Additional Considerations
- Run both Next.js app and Socket.IO server
- Configure CORS for Socket.IO if domains differ
- Enable Redis for production scaling
- Set up MongoDB Atlas with IP allowlist
- Configure CDN for static assets

---

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Errors**
```bash
# Verify connection string
echo $MONGODB_URI

# Check Atlas IP allowlist
# Add 0.0.0.0/0 for testing (not recommended for production)
```

**NextAuth Configuration**
```bash
# Generate a secure secret
openssl rand -base64 32

# Set in .env.local
NEXTAUTH_SECRET="your-generated-secret"
```

**Missing AI Features**
- Ensure `GEMINI_API_KEY` is set
- Verify API quota in Google AI Studio
- Check rate limiting (5 requests/hour per user)

**Redis Warnings**
- App continues without caching if Redis unavailable
- Set `REDIS_URL` to enable caching and rate limiting
- Install Redis locally: `brew install redis` (macOS)

**Socket.IO Connection Issues**
- Verify `SOCKET_PORT` is not blocked by firewall
- Check CORS configuration in `server.ts`
- Ensure WebSocket support on hosting platform

---

## 📚 Documentation

- **[Development Guide](./DEV_GUIDE.md)** - Detailed development instructions
- **[ERD](./ERD.md)** - Entity Relationship Diagram
- **[Message Notifications](./MESSAGE_NOTIFICATIONS.md)** - Notification system docs
- **[AI Rules](./AI_rules/)** - Comprehensive AI agent guidelines
- **[SRS Document](./AI_rules/)** - System Requirements Specification

---

## 🤝 Contributing

1. Review the [`AI_rules/`](./AI_rules/) documentation
2. Create a feature branch
3. Follow coding standards (ESLint, Prettier)
4. Ensure all tests pass
5. Submit a pull request with clear description

### Code Quality Standards
- **Test Coverage:** ≥80%
- **TypeScript:** Strict mode enabled
- **Linting:** ESLint with strict rules
- **Formatting:** Prettier
- **Documentation:** JSDoc for public APIs

---

## 📄 License

This project is provided as-is for personal or organizational use.

---

## 👥 Team

**Repository:** [sabih-haider1/BookEX](https://github.com/sabih-haider1/BookEX)  
**Maintained by:** Development Team  
**Last Updated:** December 2025

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- AI powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Real-time communication via [Socket.IO](https://socket.io/)

---

<div align="center">
  <strong>📖 Happy Reading & Exchanging Books! 📚</strong>
</div>


