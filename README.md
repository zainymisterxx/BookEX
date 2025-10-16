## BookEx

Community-driven platform to buy, sell, donate, and exchange books with real-time messaging, communities, and AI-assisted discovery.

### Features
- **Buy, Sell, Exchange**: List books, browse listings, and track exchange history
- **Communities**: Join topic or city-based communities, posts, comments, likes
- **Realtime Chat**: Socket.IO messaging per conversation and user channels
- **🆕 Image Sharing**: Upload and share images in DMs, posts, and group chats with real-time delivery
- **AI Assist**: Gemini via Genkit for summaries, recommendations, and search
- **Auth**: Credentials-based login with roles and account status
- **Admin Dashboards**: User/org/report management, content moderation
- **Performance & Security**: MongoDB indexes, optional Redis cache, rate limiting, security headers

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, MongoDB, NextAuth, Socket.IO
- **AI**: Genkit + GoogleAI (Gemini)
- **Caching/Rate-limit**: Redis (optional)

### Prerequisites
- Node.js 18+
- MongoDB database (Atlas or local)
- Redis (optional, recommended)

### Environment Variables
Create a `.env.local` in the repo root:

# Realtime (optional override)
SOCKET_PORT=3001

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# AI / Genkit
GEMINI_API_KEY="<your_google_ai_api_key>"

# 🆕 Image Upload (Cloudinary) - Required for image sharing
CLOUDINARY_CLOUD_NAME="<your_cloudinary_cloud_name>"
CLOUDINARY_API_KEY="<your_cloudinary_api_key>"
CLOUDINARY_API_SECRET="<your_cloudinary_api_secret>"
```

> 📸 **Image Sharing Setup**: See [IMAGE_SHARING_GUIDE.md](IMAGE_SHARING_GUIDE.md) for complete setup instructions or run `./setup-image-sharing.sh` for guided setup.

### Installation
```bash
npm install
```

### Running Locally
- Start Next.js (port 9002) and Socket.IO server together:
```bash
npm run dev
```

- Optional: Genkit Dev UI / watcher for AI flows
```bash
npm run genkit:dev
# or
npm run genkit:watch
```

### Scripts
```bash
# Dev servers (Next + Socket.IO)
npm run dev

# Build & start
npm run build
npm start

# Lint & typecheck
npm run lint
npm run typecheck

# Database ops (see scripts/*)
npm run setup:db
npm run optimize:db
npm run setup:indexes

# Maintenance / audits
npm run file:cleanup
npm run business:maintenance
npm run content:maintenance
npm run security:audit
```

### Project Structure
```text
src/
  app/                  # App Router pages & API routes
    (main)/             # User-facing pages (books, community, exchange, messages, profile, etc.)
    api/                # API routes (auth, admin, communities, files, business-logic)
    layout.tsx          # Root providers (auth, sockets, notifications, profile guard)
  components/           # UI kit and feature components (book, community, admin)
  lib/                  # Mongo, Redis, email, storage, security, rate limiting, utils
  ai/                   # Genkit config, flows (search, summary, recommendations), tools
server.ts               # Socket.IO realtime server
next.config.ts          # Next.js config (security headers, images)
```

### Architecture Notes
- **Next.js App Router** serves UI and API routes under `src/app/api/*`.
- **Auth** via NextAuth credentials provider (`src/lib/auth-config.ts`). Session tokens include `role`, `status`, `profileCompleted`.
- **Database** MongoDB client singleton in `src/lib/mongodb.ts` with helpers in `src/lib/data.ts`.
- **Realtime** Socket.IO server in `server.ts` listens on `SOCKET_PORT` and handles:
  - `joinChat`, `sendMessage` ➜ emits `receiveMessage`
  - Community rooms `community_{id}`: `newPost`, `newComment`, `postLikeUpdate`
  - User rooms `user_{id}`: `newNotification`
- **Redis (optional)** provides caching and rate-limiting; app degrades gracefully if unavailable.
- **AI** configured in `src/ai/genkit.ts` using Gemini. Flows live in `src/ai/flows/*`.

### Development Tips
- Ensure `MONGODB_URI`, `NEXTAUTH_SECRET`, and `GEMINI_API_KEY` are set; Redis is optional but useful.
- Next.js dev server runs at `http://localhost:9002`; Socket.IO defaults to `http://localhost:3001`.
- Security headers and image remote patterns are defined in `next.config.ts`.

### Deployment
- Provide all required env vars in your hosting platform.
- Run the web app and the Socket.IO server process.
- Configure CORS on Socket.IO if your frontend domain differs.
- Optionally enable Redis for caching and rate limits.

### Troubleshooting
- Mongo connection errors: verify `MONGODB_URI` and IP allowlist (Atlas).
- Missing AI key: `GEMINI_API_KEY` is required for AI features.
- Redis warnings: app continues without caching; set `REDIS_URL` to enable.
- NextAuth issues: ensure `NEXTAUTH_URL` and `NEXTAUTH_SECRET` are configured.

### License
This project is provided as-is for personal or organizational use. Add a license file if you plan to open source it.


