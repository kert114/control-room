---
name: verify-fintech-tool
description: Quality gate for a Control Room internal tool. Use when a module under src/modules is added or changed, or when the user asks to verify authorization, audit, concurrency, browser behaviour, or the production build before a PR.
---

# Verify a Control Room internal tool

Run this end to end. Do not report a module as done with a step skipped; fix the
cause instead. Record the exact command output for the PR.

## 1. Authorization

- List every server action and page in the module. Each must call
  `requirePermission` (or `requireActor` plus `can`) before reading or writing.
  UI-only gating does not count.
- Confirm the auditor holds no write permission for the module in
  `src/platform/authz/policy.ts`, and add a unit test asserting it.
- For any approval step, confirm `canApproveOwnRecord(actorId, createdById)` is
  checked server-side and that a violation raises `SeparationOfDutiesError`.
- For production feature-flag changes, confirm the approval comes from a
  different user than the requester.

## 2. Audit

- Every mutation writes exactly one audit event through `context.audit`.
- The audit action is in the typed union in `src/platform/audit/events.ts`.
- Metadata carries identifiers, states, versions, and amounts only — no reasons,
  names, emails, card or account identifiers. `assertNoSensitiveMetadata` must
  pass for every metadata shape the module emits.
- The recorded `entityVersion` is the version after the mutation.

## 3. Concurrency

- Every update filters with `versionedWhere` and increments with `bumpVersion`.
- Every update result passes through `assertRowUpdated`.
- The UI renders the conflict as a changed-record state that reloads the record,
  not as a generic failure.
- Prove it: open the record in two sessions, submit both, and confirm the second
  submission is rejected without partial writes and without an audit event.

## 4. Browser checks

- `npm run db:migrate && npm run db:seed` (requires `DEMO_MODE=true`).
- `npm run build && npm run test:e2e`.
- Manually or with a test, for each role: the tool's happy path, the read-only
  auditor view, an empty state, a validation failure, and a rejected approval by
  the requester.
- Check the narrow viewport (430px) and keyboard-only row selection with Enter
  and Space.

## 5. Build verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## 6. Report

State the commands run, their outcome, the roles exercised, the concurrency
result, and any gap left open. A failing or unrun step is a gap, not a pass.
