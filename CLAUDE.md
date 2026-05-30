# BookEX

## Commands

- Dev: `npm run dev` (Next.js port 9002 + Socket.IO concurrently)
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Single server: `npm run dev:next` or `npm run dev:socket`
- DB setup: `npm run setup:db` / `npm run setup:indexes`

## Architecture

- Reads: Server Components call `src/lib/data.ts` directly
- Writes: ALL mutations go through `src/app/actions.ts` (Server Actions only)
- Real-time: standalone `server.ts` (Socket.IO) — not Next.js API routes
- Database: MongoDB native driver — no Prisma, Drizzle, or Mongoose

## Key Constraints

- Tech stack is immutable per SRS — see `AI_rules/06_TECHNOLOGY_STACK.md`
- Soft deletes only: use `deletedAt` timestamp, never hard-delete user data
- State machines enforced in business logic, not in DB schema
- Read the relevant `AI_rules/` doc before any significant change

## Domain

- Book states: `active → on_hold → reserved → sold / exchanged`
- Exchange states: `proposed → accepted → completed | rejected | cancelled | disputed`
- User roles (fixed): `visitor | user | admin | organization`
