# Control Room agent rules

Control Room is a shared internal-tools platform. `src/platform` is the platform;
each internal tool lives in its own folder under `src/modules`. These rules are
binding for every session that edits this repository.

## File boundaries

- Shared platform code lives in `src/platform` only: auth, authorization, audit,
  transactions, reporting, module contract, UI primitives.
- Tool code lives in `src/modules/kyc`, `src/modules/refunds`, `src/modules/flags`.
  A module must not import from another module.
- A module registers itself in `src/modules/registry.ts` and must satisfy
  `ModuleDefinition` in `src/platform/module/contract.ts`.
- Changing a shared contract (`contract.ts`, `authz/policy.ts`, `audit/events.ts`,
  `mutations/transaction.ts`) breaks parallel module sessions. Extend it additively
  — new permissions, new audit actions — rather than reshaping existing types.
- Routes live in `src/app/(app)/<module route>` and stay stable.

## Security

- Roles are `operator`, `approver`, `administrator`, `auditor`.
- Authorization is enforced on the server. Hiding a control in the UI is never
  the enforcement point; call `requirePermission` in the server component or
  server action that performs the work.
- The auditor is read-only and must never be granted a write permission.
- A user may not approve a request they created; check `canApproveOwnRecord`.
- Production feature-flag changes require an approval from a second user.
- Credential sign-in exists only when `DEMO_MODE=true`. The UI must show that it
  is in demo mode. Microsoft Entra ID is the real SSO path.
- If neither demo mode nor a complete Entra configuration is present, the app
  fails closed and refuses to serve an authenticated session.
- Never commit secrets, connection strings, or real customer data.

## Transactions and concurrency

- A business mutation and its audit event commit in the same database
  transaction. Use `withBusinessTransaction` and the `context.audit` handle;
  `recordAuditEvent` only accepts a transaction handle, never the pool.
- Mutable records carry `version`. Update with `versionedWhere(table, id, version)`
  plus `bumpVersion(table)` and pass the result through `assertRowUpdated`, which
  raises `OptimisticConcurrencyError` when the record changed underneath the user.
- Surface a concurrency conflict as a "record changed" state, not a generic error.

## Audit

- Audit rows describe what happened; they never copy sensitive values. Metadata
  is a flat map of short strings, numbers, booleans, and nulls, and rejects keys
  such as passwords, tokens, card or account identifiers, emails, and free-text
  reasons.
- Audit actions are a typed union in `src/platform/audit/events.ts`.

## Synthetic data

- All demo data is synthetic and labelled as such. Names use fictional entities.
- `npm run db:seed` refuses to run unless `DEMO_MODE=true`, and it truncates and
  rewrites only the seeded tables.
- Never seed, paste, or fixture real customer data.

## Testing

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must pass
  before a PR. `npm run test:e2e` needs a migrated and seeded database.
- Unit tests cover authorization, audit metadata, environment fail-closed
  behaviour, concurrency helpers, and the module registry. New rules need new
  unit tests.
- Browser tests cover the signed-out redirect, demo sign-in, module routes, and
  the audit trail. Add a browser test for each new user-facing workflow.
- Run `.agents/skills/verify-fintech-tool/SKILL.md` before handing work over.
