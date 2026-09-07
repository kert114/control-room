# Control Room: key decisions

## The plan

Implement the skeleton first, then build the tools on top of it. In order:

1. `src/platform`: auth, roles, audit, transactions, database access, shared UI pieces.
2. Lock the contract every tool has to satisfy.
3. Build the three tools against that contract, in parallel.

I went with three tools rather than one polished one. A single tool might look more polished and
better, but it doesnt show well how the client could scale to 10 tools, which
was the actual problem. With the skeleton in place a new tool can be added under
`src/modules` and one line in the registry, and it inherits
navigation, permissions, audit and routing. It runs on Vercel against Neon Postgres with real migrations and seeded
synthetic data, so it's something you log into rather than a mockup.


## Engineering decisions

**Modules cannot import each other.** Shared types live in `src/platform` only.
This was important as three tools were built at the same time, in three Devin
sessions. 

**One permission matrix.** 4 roles, 18 permissions, one file. `requirePermission`
runs inside the server action that does the work. This mimics what Dataverse security roles give you. 

**Audit commits inside the transaction.** `recordAuditEvent` accepts a
transaction handle and nothing else. So an approval cannot commit without its
audit row. 

**Version column on every mutable row.** An update matches on `version`. No match
means someone else wrote first, and the user sees "record changed".

## Working with Devin

- Wrote `AGENTS.md` before any feature work with file boundaries, security
  invariants, transaction and audit rules, and testing
- Order of devleopment: throwaway UI prototype, the skeleton, one
  PR that locked the shared contracts, 3 features in parallel, security and code quality review, clean up. 
- Every stage of the development was first planned out with Devin in local CLI and then /handoff was used to direct the work to the cloud.
- Every PR had to pass lint, typecheck, unit tests, build and Playwright against
  a seeded database.


## What I'd do differently

- Ship one Datadog adapter. The ServiceHealthProvider interface already exists in
  flags/health and every adapter behind it is a mock. A real one is a single file
  plus a registry line. I think adding a real connector would have made the project much stronger

- In the demo video I believe my video turned out to be more of a sales pitch. If i could do it
again I would focus on being more calculated and actually try to weight the pluses and minuses on why the customer should start using Devin. 

- Demo real Microsoft SSO. The Entra login path is coded but has never run
  against a live tenant, so the demo signs in with fake accounts.


