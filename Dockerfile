# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install libc compat for native modules on alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ─── Stage 2: Build Next.js app ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars required by Next.js (no secrets — these are public)
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# next build outputs a standalone bundle
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static  ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public

# Copy Socket.IO server and its dependencies.
# server.ts is run with tsx (included in node_modules from the build stage).
# We copy the full node_modules because server.ts imports src/ modules at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/server.ts     ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/src           ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules  ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json  ./package.json

USER nextjs

# Next.js app
EXPOSE 3000
# Socket.IO server
EXPOSE 3001

# Runtime env vars — supply these via docker run -e / docker-compose / K8s secrets:
#   MONGODB_URI          (required)
#   NEXTAUTH_SECRET      (required, ≥32 chars)
#   NEXTAUTH_URL         (required, e.g. https://bookex.example.com)
#   NEXT_PUBLIC_APP_URL  (required)
#   MEDIA_API_SECRET     (required)
#   SOCKET_URL           (optional — internal URL the Next.js app uses to reach the socket server)
#   RESEND_API_KEY       (optional — email notifications)
#   REDIS_URL            (optional — caching / rate-limiting)
#   GEMINI_API_KEY       (optional — AI features)

# Start both processes. In production prefer a process manager (PM2, s6) or
# separate containers. This CMD is a convenience fallback for single-container runs.
CMD ["sh", "-c", "node server.js & node_modules/.bin/tsx server.ts"]
