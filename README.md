# Offline-First Kanban / Task App with Sync Engine

## Overview

This repository contains an offline-first kanban application prototype with a local-first React UI, IndexedDB persistence, an operation outbox, a backend sync API, and shared domain contracts. The current implementation focuses on preserving user changes locally first, then syncing queued operations when connectivity is available.

## Current Features

- Board, column, and card creation from the frontend
- Drag-and-drop card movement between kanban columns
- Optimistic UI updates backed by IndexedDB
- Operation outbox for local mutations
- Pending sync count, offline banner, sync status badge, conflict panel, and activity log panel
- Retry handling for failed sync pushes
- Conflict state support when the server reports stale versions
- Express sync API for bootstrap and batch operation sync
- Prisma schema for boards, columns, cards, users, and applied operation logs
- Socket.IO board rooms for joining, leaving, and broadcasting board operations

## Architecture

The web app is kept at the repository root for easy GitHub browsing. The API and shared contracts live in their own folders:

- `src`: React/Vite web app
- `apps/api`: Express API, Socket.IO setup, and Prisma schema
- `packages/shared`: shared TypeScript types for local entities, operations, sync responses, conflicts, and socket messages
- `docs/screenshots`: placeholder for screenshots and visual assets

The frontend currently uses an injectable sync transport. The local sync engine and backend sync API are implemented, but direct HTTP wiring between the frontend transport and the API is still a future integration step.

## Frontend

The frontend stores boards, columns, cards, queued operations, activity events, and conflicts in IndexedDB through Dexie. Mutations update IndexedDB first, then enqueue an outbox operation with:

- `id`
- `type`
- `entityType`
- `entityId`
- `payload`
- `baseVersion`
- `createdAt`
- `status`
- `retryCount`

Supported operation types include board, column, and card create/update/delete operations, plus card moves.

## Sync Engine

The sync engine reads pending outbox operations, pushes them through an injectable transport, records synced operations, retries failures, and stores conflict records when the remote side reports a version conflict. Sync status values are:

- `online`
- `offline`
- `syncing`
- `synced`
- `conflict`

Operation IDs are used for idempotency across client and server boundaries.

## Backend

The backend exposes:

- `POST /api/sync/bootstrap`: returns current board state, applied operation log entries, and server time
- `POST /api/sync`: accepts a batch of queued operations and returns per-operation results
- `GET /api/boards`: returns active boards with columns and cards
- `POST /api/boards`: creates a server-side board and broadcasts it to the board room

The sync route stores applied operations in `OperationLog`, checks `baseVersion` against the current server entity version, returns conflicts for stale clients, and broadcasts successful board changes through Socket.IO.

## Socket.IO

The socket layer supports board-scoped collaboration messages:

- `board:join`
- `board:leave`
- `board:operation`

Successful sync operations are broadcast to the affected board room.

## Testing

Vitest tests for the sync engine have been added in `src/sync/syncEngine.test.ts`. The tests cover:

- queued operations staying stored while offline
- pending operation flush when online
- duplicate remote operation acknowledgements being ignored
- version conflict handling
- retry behavior after failed sync attempts
- optimistic IndexedDB-backed local state updates

The tests were created but not run in this phase. No test command or runner dependency was installed as part of this update.

## Local Development

The project is split so the root web app, API, and shared package can evolve independently. Dependencies and services were not installed or started during this phase.

## Future Work

- Wire the frontend sync transport to the backend `/api/sync` endpoints
- Add authentication-backed board ownership
- Add conflict resolution actions in the UI
- Add generated Prisma client/migrations after schema review
- Add a formal Vitest setup and package script
- Add end-to-end coverage for offline-to-online sync flows
