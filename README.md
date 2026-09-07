# Control Room

Control Room is an internal-tools platform for a fintech engineering team: one
authenticated, audited, role-aware shell that many small operational tools plug
into. It replaces the Power Apps pattern of one disconnected app per workflow.

This branch delivers the shared foundation plus stable routes for the three
first tools: KYC reviews, Refunds, and Feature flags.

## What the platform gives every tool

- Authentication (Auth.js) with a synthetic demo path and a Microsoft Entra ID
  path, failing closed when neither is configured.
- Server-side authorization from a single permission matrix over the roles
  `operator`, `approver`, `administrator`, `auditor`.
- Typed audit events that commit in the same transaction as the mutation they
  describe, and that refuse to copy sensitive values.
- Optimistic concurrency helpers that turn a stale write into a "record changed"
  outcome instead of a silent overwrite.
- UI primitives: data table, action dialog, status badge, empty state, activity
  timeline, panel, and the responsive application shell.

## Layout

| Path | Contents |
| --- | --- |
| `src/platform` | Shared platform: auth, authz, audit, mutations, db, reporting, UI |
| `src/modules/<tool>` | One internal tool, self-contained |
| `src/app/(app)` | Authenticated routes |
| `e2e` | Playwright foundation tests |
| `drizzle` | Generated SQL migrations |

Adding a tool: create `src/modules/<tool>/module.ts` implementing
`ModuleDefinition`, register it in `src/modules/registry.ts`, and add
`src/app/(app)/<route>/page.tsx`. Navigation, permissions, audit, and the shell
follow automatically.

## Getting started

```bash
cp .env.example .env.local   # set DATABASE_URL and AUTH_SECRET
pnpm install
pnpm db:migrate
pnpm db:seed               # synthetic data; requires DEMO_MODE=true
pnpm dev
```

Demo accounts (only when `DEMO_MODE=true`), password `control-room-demo`:

| Account | Role |
| --- | --- |
| `operator@demo.control-room.test` | operator |
| `approver@demo.control-room.test` | approver |
| `admin@demo.control-room.test` | administrator |
| `auditor@demo.control-room.test` | auditor (read-only) |

Known limitation: demo credential sign-in has no rate limiting or lockout. The
password is shown on the sign-in page, so throttling would protect nothing;
the real SSO path (Entra ID) carries its own protections.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright browser tests (needs a migrated, seeded database) |
| `pnpm db:generate` | Generate a migration from the Drizzle schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Load synthetic demo data |

Contributor rules live in [AGENTS.md](./AGENTS.md).
