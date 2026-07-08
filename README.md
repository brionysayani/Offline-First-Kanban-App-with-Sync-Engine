# Offline-First Kanban / Task App with Sync Engine

## Overview

This is an offline-first kanban application with a React/Vite web app, IndexedDB persistence, an operation outbox, an Express sync API, Socket.IO board rooms, Prisma, and PostgreSQL. It is prepared for deployment with:

- Vercel for the root web app
- Railway for the API
- Railway managed PostgreSQL or another managed PostgreSQL provider

## Current Features

- Email/password register and login with JWT authentication
- Board, column, and card creation
- Drag-and-drop card movement between columns
- Optimistic local updates backed by IndexedDB
- Operation outbox for local-first mutations
- Automatic sync bootstrap when the web app is online
- Pending sync count, offline banner, sync status badge, conflict panel, and activity log
- Retry handling for failed sync pushes
- Version conflict detection and conflict storage
- Backend sync API with operation idempotency through `OperationLog`
- Socket.IO board rooms for real-time board operation broadcasts
- Vitest sync-engine tests

## Project Structure

- `src`: Vercel-deployed React/Vite web app
- `apps/api`: Railway-deployed Express API, Socket.IO server, and Prisma schema
- `packages/shared`: shared TypeScript contracts
- `docs/screenshots`: screenshots and visual assets

## Environment Variables

Web app, configured in Vercel:

```txt
VITE_API_URL=https://your-railway-api.up.railway.app
```

API, configured in Railway:

```txt
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=https://your-vercel-app.vercel.app
NODE_ENV=production
PORT=4000
```

Templates are included in `.env.example` and `apps/api/.env.example`.

## Deploying the Web App to Vercel

Use the repository root as the Vercel project root.

Vercel settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL`

The root `vercel.json` includes the Vite output directory and SPA rewrite.

## Deploying the API to Railway

Create a Railway service using `apps/api` as the service root. Attach a managed PostgreSQL database and set the API environment variables above.

Railway uses `apps/api/railway.json`:

- Build command: `npm run build`
- Start command: `npm run start`
- Health check: `/health`

The API start script runs `prisma migrate deploy` before starting the compiled server.

## Database

The Prisma schema models users, boards, columns, cards, and applied operation logs. A production migration is checked in under:

```txt
apps/api/prisma/migrations/20260708000000_initial_production_schema/migration.sql
```

Railway will apply this migration during API startup through `prisma migrate deploy`.

## Sync Flow

1. The UI writes every mutation to IndexedDB first.
2. The same transaction queues an outbox operation.
3. The sync engine posts pending operations to `POST /api/sync`.
4. The API checks operation IDs for idempotency.
5. The API compares client `baseVersion` with server entity version.
6. Successful operations are stored in `OperationLog`.
7. Conflicts are returned and stored locally.
8. Successful board operations are broadcast through Socket.IO.
9. The web app joins board rooms and refreshes sync state on board broadcasts.

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/boards`
- `POST /api/boards`
- `POST /api/sync/bootstrap`
- `POST /api/sync`
- `GET /health`

## Tests

Vitest tests are in:

```txt
src/sync/syncEngine.test.ts
```

They cover offline queueing, online flush, duplicate operation handling, conflict handling, retries, and optimistic IndexedDB state updates.

Run tests locally only after dependencies are installed:

```txt
npm test
```

Tests were not run during this production-readiness pass.

## Production Notes

- Set a long random `JWT_SECRET` in Railway.
- Set `CORS_ORIGIN` to the exact Vercel deployment URL.
- Set `VITE_API_URL` to the Railway API URL with no trailing slash.
- Keep Railway PostgreSQL private to the Railway project when possible.
- Use Vercel and Railway build logs as the source of truth after first deployment.

## Remaining Hardening

- Add CI to run frontend tests, API build, and type checks on every PR.
- Add rate limiting for auth endpoints.
- Add refresh tokens or session rotation if long-lived sessions are required.
- Add richer UI actions for resolving conflicts.
- Add end-to-end tests for offline-to-online sync.
