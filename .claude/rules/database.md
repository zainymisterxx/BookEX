---
paths:
  - "scripts/migrations/**"
  - "src/lib/mongodb*.ts"
  - "src/lib/database*.ts"
---

# Database (MongoDB Native)

This project uses MongoDB native driver — no Prisma, Drizzle, Mongoose, or migration framework.

- Use atomic operators (`$set`, `$inc`, `$addToSet`, `$pull`) for updates — never full-document replacement.
- Soft deletes only: set `deletedAt: new Date()`. Never hard-delete documents.
- Always use connection pooling via the singleton in `src/lib/mongodb.ts`.
- Filter queries must use indexed fields. Check `src/lib/database-*.ts` for index definitions before adding new queries.
- Never drop or rename fields without confirming no active code reads them.
- One-off migration scripts go in `scripts/migrations/`. They must be idempotent (safe to re-run).
- Never seed production data in migration scripts — use dedicated seed files.
