---
title: Neon Postgres — managed-database support and bootstrap
type: plan
date: 2026-11-09
topic: neon-managed-postgres
status: Proposed
owner: Group 4
---

# Neon Postgres — managed-database support

**FRs:** none directly (NFR-004 deployability, NFR-008 operability) · **ACs:** none
**Modules:** all seven (persistence adapters), `shared/config` · **Supersedes:** nothing
**Relates to:** ADR-007 (schema per module), ADR-014 (TypeORM, per-module credentials)

---

## 0. Why

The deployment target for this project moved from a self-hosted Docker stack to managed
services. `docker-compose.yml` provides Postgres with `docker/postgres/init/01-roles.sql` and
`02-schemas.sql`, which **only run on a container's first boot**. A managed Postgres has no
equivalent hook, so two things are missing before the API can start against one:

1. the code has no way to speak TLS, and every managed Postgres requires it;
2. nothing creates the seven roles and seven schemas (ADR-007) on a host we do not control.

This plan adds both, driven entirely by configuration, so the local Docker workflow is
unchanged (TLS off, init scripts still run).

## 1. Verified third-party contracts

Read from the vendor's live documentation and from this machine, 2026-11-09. Not from memory.

### 1.1 Neon plan and limits

| Fact | Source |
|---|---|
| Free plan is **permanent**, "no time limits and no credit card required" | `neon.com/pricing` |
| **100 CU-hours per project per month**; exhausted ⇒ *"compute is suspended until the next billing period"* | `neon.com/pricing` FAQ |
| Smallest compute is **0.25 CU (1 GB RAM)**, `max_connections = 104` | `neon.com/docs/manage/computes` |
| `0.25 CU × 400 h = 100 CU-hours` — the plan's own worked example | `neon.com/docs/introduction/plans` |
| Scale-to-zero after **5 minutes** idle; free plan **cannot** disable it | `neon.com/docs/connect/connection-errors` |
| Exhausting the quota **never deletes data** | `neon.com/pricing` FAQ |
| TLS is **mandatory**; CA is **ISRG Root X1** (Let's Encrypt) | `neon.com/docs/connect/connect-securely` |
| `pg` ≥ 8.23 prints a security warning for `sslmode=require`; `verify-full` is recommended | `neon.com/docs/guides/typeorm` |

### 1.2 Neon's pooler cannot carry this codebase

`unsupported startup parameter in options` is documented as occurring **"when using a pooled
Neon connection string"**, and the pooler's supported startup parameters are limited to
`client_encoding`, `datestyle`, `timezone`, `standard_conforming_strings`, `application_name`
(`neon.com/docs/connect/connection-errors`).

This codebase sets `options: '-c search_path=<schema>,public'` on every one of the seven
DataSources. Therefore **the API must connect to the direct (unpooled) hostname** — the one
without `-pooler`. This is not a preference; the pooled host fails at connect time.

### 1.3 A `CREATEROLE`-but-not-superuser role cannot create a schema owned by another role

Verified locally against Postgres 17 in this repo's own container, because the answer decides
the shape of the bootstrap script and no vendor page states it:

```
CREATE ROLE t_as_mod LOGIN PASSWORD 'p';
CREATE SCHEMA t_sch AUTHORIZATION t_as_mod;
  ERROR:  must be able to SET ROLE "t_as_mod"
```

`CREATE SCHEMA ... AUTHORIZATION role` requires the creator to be able to `SET ROLE` into the
target. Neon's project owner is documented as a member of `neon_superuser`, which grants
`CREATEROLE` but is explicitly **not** a superuser account (`neon.com/docs/manage/roles`).

Verified workaround, in the same non-superuser context:

```
GRANT t_mod TO t_owner;                        -- owner may now SET ROLE into it
CREATE SCHEMA t_sch AUTHORIZATION t_mod;       -- succeeds
REVOKE t_mod FROM t_owner;                     -- isolation restored
```

Confirmed side effects: the schema owner is the module role (not the operator), and the module
role gains no membership back on the owner. The bootstrap script must do grant → create → revoke
in that order, or it fails on Neon while working fine on the local superuser.

`gen_random_uuid()` needs no extension: it is core since PostgreSQL 13, and Neon is 15+.

### 1.4 The arithmetic, stated plainly

```
required:  0.25 CU × 730 h  = 182.5 CU-hours/month
available:                        100 CU-hours/month
```

The outbox relay polls every 2 s, so the compute never reaches the 5-minute idle threshold and
never scales to zero. **An always-on API exhausts a Neon free project around day 16.** Data
survives; the compute is suspended until the next billing period, so the API cannot serve.

100 CU-hours still covers **400 hours/month** of 0.25 CU compute — about 13 hours a day. Neon
free is therefore usable for a **scheduled / demo-hours deployment**, not a 24/7 one. This plan
implements Neon correctly and documents that limit rather than pretending it away.

## 2. Design

### 2.1 `DATABASE_SSL` (configuration, default off)

Add to `ApiConfig`:

| Var | Default | Meaning |
|---|---|---|
| `DATABASE_SSL` | `false` | `true` ⇒ connect with TLS |
| `DATABASE_SSL_VERIFY` | `true` | `true` ⇒ validate the certificate chain |

Mapping: `ssl: true` when `DATABASE_SSL=true` and `DATABASE_SSL_VERIFY=false`;
`ssl: { rejectUnauthorized: true }` when both are true. Verified that Node 24's bundled store
contains ISRG Root X1, so strict verification works against Neon out of the box — the escape
hatch exists only for a CA-less environment, and defaults to the secure side.

Default **off** so `docker compose` on `localhost` is untouched: `pg` treats `ssl: false` as
plain TCP, and a local server without TLS would reject an attempted upgrade.

### 2.2 Pool caps

`extra.max` per module, default unchanged at `10`, overridable with `DATABASE_POOL_MAX`.
Seven modules × 10 = 70 connections, against Neon's 104 at 0.25 CU — too close for comfort once
a migration run and a psql session overlap, so the deployment template sets `2`
(7 × 2 = 14). `extra` is spread **after** TypeORM's own keys, so this wins over `poolSize`.

### 2.3 Bootstrap script for hosts we do not control

`scripts/bootstrap-managed-db.mjs`, following `scripts/migrate.mjs`'s shape (root `.env` loader,
`pg` from the workspace, no build step needed beyond what `db:migrate` already requires).

- Connects as an **admin** role: `DATABASE_ADMIN_USER` / `DATABASE_ADMIN_PASSWORD`.
- For each of the seven schemas: `CREATE ROLE ... LOGIN` (idempotent), `GRANT` to admin,
  `CREATE SCHEMA ... AUTHORIZATION`, `REVOKE`, then `REVOKE ALL ... FROM PUBLIC`.
- Role passwords come from the existing `databaseCredentials(schema)` accessor, so the script
  and the app can never disagree about them.
- Refuses to run when a module password is empty. A blank password on a public host is worse
  than a refused deploy.

### 2.4 What does **not** change

`apps/api/src/bootstrap/init-env.ts` still resolves `../../../../.env`. On a PaaS the platform
injects real environment variables, and `dotenv` does not overwrite an already-set variable, so
an absent file is harmless. No change needed, and adding a second loader path would create two
sources of truth.

## 3. Phases (one commit each)

| Phase | Change | Done when |
|---|---|---|
| **1** | `DATABASE_SSL`, `DATABASE_SSL_VERIFY`, `DATABASE_POOL_MAX` in `ApiConfig` + `ssl`/`max` in the 7 DataSources + the codegen template | `pnpm typecheck` green, `api-config.spec` green, local `db:migrate` unchanged |
| **2** | `scripts/bootstrap-managed-db.mjs`; `package.json` script `db:bootstrap` | runs twice in a row against a non-superuser owner without error (idempotent) |
| **3** | `.env.example` managed-database section; deployment doc §3.2 rewritten from "disqualified" to "supported, with a compute-hour limit"; ADR-016 amendment note if required | `pnpm verify` green |

Phase 3 is documentation and therefore has no behaviour to test beyond `pnpm verify`.

## 4. Risks

| Id | Risk | Mitigation |
|---|---|---|
| N1 | Compute suspends ~day 16 on an always-on API | Documented; run API on a schedule, or use a plan with more CU-hours. Data is never lost. |
| N2 | Copying the `-pooler` hostname silently breaks `search_path` | Doc states the direct host explicitly; the error message is quoted so it is recognisable |
| N3 | `DATABASE_SSL_VERIFY=false` weakens the connection | Defaults to `true`; documented as a last resort |
| N4 | Bootstrap run with a blank module password | Script refuses to start |
| N5 | Re-running bootstrap against a populated database | Every statement is `IF NOT EXISTS`-guarded; schemas and roles are never dropped |

## 5. Out of scope

- Migrating existing local data to Neon (`pg_dump` / `pg_restore` is a separate runbook).
- Reducing the outbox interval to allow scale-to-zero. That would break ADR-013's 2 s
  settlement latency, so it is a product decision, not a deployment tweak.
