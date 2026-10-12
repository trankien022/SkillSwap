# AGENTS.md

Instructions for AI agents (and new humans) working in this repository.

## Read first (in order)

1. **`ARCHITECTURE.md`** — the hard contract: bounded contexts, module boundaries, ports, dependency rules. Never edit it; code must follow it.
2. **`PRODUCT.md`** — who the product serves, brand personality ("trustworthy, clear, peer-to-peer"), design principles.
3. **`DESIGN.md`** — visual tokens and rules (slate neutrals + Campus Emerald, pill CTAs, flat-by-default). Read before touching any UI.
4. **`docs/plans/SkillSwap-SRS.md`** — requirements with stable IDs (`FR`/`BR`/`NFR`/`OQ`/`AC`/`ST`). Only **Confirmed** FRs are implementable.
5. **`docs/adr/`** — decisions: `ADR-013` (RabbitMQ + outbox), `ADR-014` (TypeORM persistence, 7 schemas, per-module credentials), `ADR-015` (Expo mobile client + doc sync). ADRs are append-mostly: don't rewrite history.

## Agent Skills

- If the Agent Skills plugin is available, let Codex select a relevant skill from the task description, or invoke one explicitly with `@skill-name` (for example, `@planning-and-task-breakdown` or `@code-review-and-quality`).
- Use skills as task workflows, not as replacements for repository guidance. This file, `ARCHITECTURE.md`, confirmed SRS requirements, and applicable ADRs remain authoritative when a skill suggests a conflicting process or implementation.
- For code changes, the **Plan before code** rule below still applies: write a detailed multi-phase plan first and commit each phase separately. Skills such as `planning-and-task-breakdown` and `incremental-implementation` can help carry out that rule.
- For feature work, implement only **Confirmed** FRs in `docs/plans/SkillSwap-SRS.md`; an invoked skill does not make an unconfirmed requirement implementable.
- Do not copy a skill's full instructions into this file. Invoke or load only the skill relevant to the current task.

## Repo map

```
apps/gateway    NestJS BFF, port 4000 — public REST, auth, route → RPC
apps/api        NestJS modular monolith, port 4001 — business logic
  src/modules/  account-profile, admin-operation, live-class, schedule,
                skill-verification, student-verification, wallet-ledger
                (hexagonal: domain/ application/ adapter/ internal/)
  src/shared/   config, messaging (amqplib only here), cross-cutting
apps/web        Next.js 15 + next-intl (vi/en), port 3000
apps/mobile     Expo/React Native client (ADR-015; domain/application/infrastructure/ui)
packages/contracts  Zod schemas shared by api/gateway (EVT-001 etc.)
scripts/        migrate.mjs, generate-dev-keys.mjs, generate-api-modules.mjs
githooks/       commit-msg convention gate (enable: git config core.hooksPath githooks)
docker/         postgres init (7 roles + 7 schemas, ADR-007)
```

## Commands

| Task | Command |
|---|---|
| Full gate (run before claiming done) | `pnpm verify` |
| Lint / build / typecheck / tests / arch rules | `pnpm lint` · `pnpm build` · `pnpm typecheck` · `pnpm test` · `pnpm test:arch` |
| Dev stack (postgres + rabbitmq) | `pnpm db:up` (down: `pnpm db:down`) |
| Apply DB migrations | `pnpm db:migrate` |
| One-command demo (up + migrate + seed) | `pnpm db:demo` |
| Regenerate API reference docs | `pnpm docs:api` |
| Dev JWT/signing keys | `pnpm keys:gen` |
| One app | `pnpm --filter @skillswap/api …` (names: `api`, `gateway`, `web`, `mobile`, `contracts`) |

Test runners: **jest** in `api`, `gateway`, `contracts`; **vitest** in `web`. Lint runs with `--max-warnings=0`.

## Hard rules

- **Plan before code:** before implementing, fixing, or refactoring anything in the codebase except docs, first write a detailed plan split into multiple phases, and land each phase as its own meaningful commit. Docs-only changes are exempt.
- **Money:** integer VND everywhere; 1 credit = 1,000 VND; platform fee 1000 bps (10%, 90/10 split). Never floats.
- **Persistence:** TypeORM only (ADR-014). One database `skillswap`, seven schemas, each owned by role `skillswap_<schema>`; app code connects with per-module credentials (`ApiConfig.databaseCredentials`). No cross-schema joins/foreign keys.
- **Migrations:** generated entities only; the migration table is `schema_migrations` in each schema. Prefer the existing data-source pattern; don't hand-edit applied migrations.
- **Events:** transactional outbox + idempotent consumers (ADR-013). Broker access lives in `apps/api/src/shared/messaging` only; exchange `skillswap.events`. Contracts: don't invent event schemas beyond those in `packages/contracts`.
- **Module codegen:** `scripts/generate-api-modules.mjs` overwrites module scaffolding — only run with `--force` when you mean it.
- **Never edit `ARCHITECTURE.md`.** If reality must change, add/update an ADR in `docs/adr/` first.
- **Diagrams:** edit `docs/diagrams/c4/source/workspace.dsl` and the six `structurizr-*.puml` views beside it, then re-render via the plantuml-skill `render.py` (`C:\Users\LENOVO\.agents\skills\plantuml-skill\scripts\render.py`) into `docs/diagrams/c4/generated`. Keep ORM mentions in sync with ADR-014 ("TypeORM", never "TypeORM/Prisma" — except the historical quote in `ARCHITECTURE.md`/ADR-014 themselves).
- **Frontend:** design comes from `DESIGN.md` (register: `product`). No gradient heroes / SaaS-landing patterns. Mobile-first 360 px, no horizontal scroll, vn/en never mixed on one screen, status always text + color.

## Conventions

- TypeScript strict everywhere; path alias via `tsconfig.base.json`.
- **Commits:** `git commit -m "type(scope): msg" -m "desc"` — type from `build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test`, scope optional (lowercase, dashes), subject ≤ 72 chars, body explains why. This rule is enforced at git-hook level: `githooks/commit-msg` rejects anything else **before the commit lands** (enable once per clone with `git config core.hooksPath githooks`).
- Ports: gateway 4000, api 4001, web 3000 (postgres 5432, rabbitmq 5672/15672).
- Env: copy `.env.example`; secrets never committed (`.env`, `.secrets/` are gitignored).
- IDs in docs: requirement IDs stay stable — reference them, don't renumber.
- New API module = domain/application/adapter(internal) layers with dependency-cruiser rules already enforcing the boundary (`pnpm test:arch`); if you add a module, extend the module rule list in `.dependency-cruiser.cjs`.

## Definition of done

1. `pnpm verify` green.
2. No new lint warnings; no float money; no cross-schema SQL.
3. Docs touched only where the change demands (SRS ID updates, ADR for decisions, diagrams re-rendered).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
