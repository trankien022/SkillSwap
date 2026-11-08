# E2E — B1's required `title` broke every class-creating fixture

Date: 2026-11-08
Found: CI run `42414380804` on PR #97, job `e2e`
Root cause commit: `9efa031` (B1)

## What was wrong

B1 made `title` a required field on `POST /api/classes`. Seven e2e spec files create classes
through that endpoint and none of them sent one, so the route answered `400 title: Required` and
every downstream assertion cascaded:

```
{"level":40,"context":"api.http","statusCode":400,"msg":"title: Required"}
```

```
FAIL test/booking-flow.e2e-spec.ts
  ● runs the whole happy path and reconciles the ledger
    Expected: 201
    Received: 400
  ● keeps an unfunded booking pending, then confirms it after a funded retry
    TypeError: Cannot read properties of null (reading 'id')
FAIL test/room-idle-payment.e2e-spec.ts    (8 failures)
FAIL test/room-idle.e2e-spec.ts            (8 failures)
FAIL test/chat.e2e-spec.ts                 (8 failures)
FAIL test/class-reminder.e2e-spec.ts       (8 failures)
FAIL test/publish-gate.e2e-spec.ts
```

Six suites, same single cause. The `TypeError: ... reading 'id'` ones are the cascade: the class
was never created, so `created.json.id` is `undefined`, and the next line dereferences `null`.

## Why `pnpm verify` could not catch it

`pnpm verify` runs `pnpm test`, which excludes `apps/api/test/**`. E2E is a separate CI job
(`pnpm --filter @skillswap/api test:e2e`) requiring real Postgres + RabbitMQ. So the gate I was
using — and the one the repo's Definition of Done names — is structurally blind to this class of
breakage. That is the actual lesson here, not the seven missing lines.

CI recorded `e2e` green on `main` at 2026-11-06, so this was a regression introduced by B1, not a
pre-existing failure being inherited.

## The fix

Fourteen `title` values added across seven files. Each is the same string as that fixture's
`description` unless the description mentions internals, so the fixture keeps reading as what it
is ("Intro to guitar", "No expiry class"), and the title is never a placeholder like `'test'`.

| File | Call sites |
|---|---|
| `booking-flow.e2e-spec.ts` | 5 |
| `room-idle-payment.e2e-spec.ts` | 1 |
| `room-idle.e2e-spec.ts` | 1 |
| `chat.e2e-spec.ts` | 1 |
| `class-reminder.e2e-spec.ts` | 1 |
| `publish-gate.e2e-spec.ts` | 1 shared `publishBody()` helper covering 5 POSTs |
| `jitsi.e2e-spec.ts` | 1 |

`jitsi.e2e-spec.ts` did not appear in the CI failure list because the suite self-skips without a
Jitsi container (`JITSI_WEB_URL` is unset in CI), but it creates a class the same way and would
have failed the moment that skip lifted. Fixed alongside rather than left as a landmine.

## Evidence

A script scanned every `api.post('/api/classes'` call site for a `title` in the body — 15 sites,
0 missing after the change (the five `publish-gate` hits all route through the shared helper).

Local run against real Postgres + RabbitMQ:

```
Test Suites: 19 passed, 19 total
Tests:       82 passed, 82 total
```

Full gate after the change:

```
pnpm verify — lint (--max-warnings=0), build, typecheck, all suites,
depcruise 1013 modules / 2938 dependencies, 0 violations
```

## Noticed while fixing — stale build artifact

The first local e2e run failed to even compile, with 19 suites reporting:

```
request-document-upload.use-case.ts:52 TS2739: Type '{ documentId; uploadUrl; objectKey; expiresAt }'
is missing the following properties from type '{ ...; method: "POST"; fields: Record<string,string> }'
```

`method`/`fields` exist only in `packages/contracts/dist/index.d.ts` — a build artifact left over
from a different branch (`feat/cloudinary-and-jaas`) that had been checked out in this working
tree. This branch's `packages/contracts/src` has no such fields. Rebuilding the contracts package
cleared it. Nothing was committed for this; it is a local-artifact hazard, recorded here so the
next person who switches branches mid-session recognises the error instead of chasing it.

## Considered and rejected

- **Making `title` optional again.** Wrong direction: B1 exists because clients were inventing
  names from skill and description, and an optional title lets that pass unnoticed again.
- **A default in `createClassSchema`.** Would hide the same missing field from real clients too,
  and a title derived from a description is exactly the invention B1 removed.
- **Leaving `jitsi.e2e-spec.ts` alone because CI skips it.** Its skip is environmental, not
  intentional; it would fail the first time someone runs e2e with Jitsi up.
