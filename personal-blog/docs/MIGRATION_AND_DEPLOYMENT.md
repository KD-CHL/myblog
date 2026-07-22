# Migration And Deployment

## Existing SQLite upgrade

The migration runner is additive and recognizes the original `posts`, `subscriptions` and `sessions` tables.

On first run after this refactor it will:

1. Checkpoint the local WAL and create a timestamped database backup.
2. Create `schema_migrations` and the new settings, audit and revision tables.
3. Add article version/archive columns and session/subscription security columns.
4. Hash legacy session tokens, then rotate legacy token-shaped session IDs to UUIDs.
5. Mark legacy subscriptions without a usable unsubscribe credential inactive.
6. Backfill one initial revision for every existing article.
7. Import `content.json` only if the posts table is empty.

Run and inspect:

```bash
npm run db:migrate
npm run test
npm run build
```

## Local rollback

1. Stop the API process.
2. Keep the failed database for investigation.
3. Replace `apps/api/data/blog.sqlite` with the latest `blog.sqlite.backup-<timestamp>`.
4. Restore the previous application version.
5. Start the API and verify `/api/health` plus a public article detail.

Migrations are forward-only in code because they add security data and immutable revisions. Restoring the automatic pre-migration file is safer than destructive down migrations.

## Vercel and Turso

The production adapter is selected automatically when `TURSO_DATABASE_URL` exists. It uses the same SQLite-compatible schema and migration runner as local development.

Without Turso, public reads fall back to the bundled seed content so the site remains viewable. The health endpoint stays unavailable and all authentication or write operations remain disabled; this is a preview safeguard, not a persistence substitute.

Recommended setup:

1. Link or create the Vercel project.
2. Install Turso Cloud from Vercel Marketplace so `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are injected.
3. Add `ADMIN_USERNAME`, `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`, and a 32+ character `SESSION_SECRET`.
4. Add the canonical site origin to `ALLOWED_ORIGINS`, for example `https://blog.example.com`.
5. Deploy the project.
6. Verify `/api/health` reports `provider: turso` and migration version 6.
7. Log in, create a draft, publish it, and confirm it survives a new deployment.

The migration transaction rechecks each version after taking a write transaction, so simultaneous cold starts do not apply the same migration twice.

## Cloud rollback

- Roll the Vercel deployment back to the previous known-good build.
- Restore or branch the Turso database from a provider backup taken before migration.
- Do not point an older build at a database after incompatible future migrations without checking its supported schema version.

## Production checklist

- `/api/health` returns HTTP 200.
- No default admin password is configured.
- `SESSION_SECRET` is unique to this project and environment.
- Turso credentials are available to Production and the intended Preview environments.
- `ALLOWED_ORIGINS` contains only real site origins.
- Login, draft creation, publish, archive/restore, settings, subscription and export have been exercised.
- Vercel runtime logs contain request IDs and no raw secrets.
