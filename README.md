# SkillSwap

SkillSwap là nền tảng mobile-first (web mobile + ứng dụng mobile Expo/React Native) kết nối sinh viên có nhu cầu học kỹ năng với sinh viên đã được xác minh năng lực để giảng dạy trực tuyến.

A peer-to-peer skill marketplace: learners top up real money into credits (1 credit = 1,000 VND) and book classes from verified student teachers; the platform keeps 10%. Integer VND everywhere, Vietnamese/English, mobile-first — responsive web plus native mobile app ([ADR-015](docs/adr/ADR-015-mobile-client-expo.md)).

## Stack

- **pnpm monorepo** — `apps/gateway` (NestJS BFF, :4000) · `apps/api` (NestJS modular monolith, :4001) · `apps/web` (Next.js 15 + next-intl, :3000) · `apps/mobile` (Expo/React Native, [ADR-015](docs/adr/ADR-015-mobile-client-expo.md)) · `packages/contracts` (Zod)
- **PostgreSQL 17** — one database, seven schemas, per-module roles/credentials ([ADR-014](docs/adr/ADR-014-persistence-typeorm.md), TypeORM)
- **RabbitMQ 3.13** — topic exchange `skillswap.events`, transactional outbox + idempotent consumers ([ADR-013](docs/adr/ADR-013-message-broker-rabbitmq.md))

## Quickstart

```bash
pnpm install
pnpm keys:gen          # dev JWT/signing keys
pnpm db:up             # postgres + rabbitmq (docker compose)
pnpm db:migrate        # build + apply migrations per module schema
pnpm dev               # gateway :4000, api :4001, web :3000
```

Full gate before claiming anything done:

```bash
pnpm verify            # lint && build && typecheck && test && test:arch
```

| Task | Command |
|---|---|
| Lint / build / typecheck / tests / arch rules | `pnpm lint` · `pnpm build` · `pnpm typecheck` · `pnpm test` · `pnpm test:arch` |
| Dev stack | `pnpm db:up` / `pnpm db:down` |
| Migrations | `pnpm db:migrate` |
| Dev keys | `pnpm keys:gen` |
| One app | `pnpm --filter @skillswap/api …` (`api`, `gateway`, `web`, `mobile`, `contracts`) |

Tests: jest (`api`, `gateway`, `contracts`, `mobile`), vitest (`web`). Lint is `--max-warnings=0`. CI runs `pnpm verify` on every push/PR (`.github/workflows/ci.yml`).

## Repository layout

```
apps/gateway    NestJS BFF — public REST, auth, route → RPC
apps/api        business logic — 7 hexagonal modules under src/modules/
apps/web        Next.js UI (register: product — see DESIGN.md)
apps/mobile     Expo/React Native client (ADR-015; booking flow is mock-only)
packages/contracts  Zod schemas shared by api/gateway
scripts/        migrate.mjs, generate-dev-keys.mjs, generate-api-modules.mjs
docker/         postgres init (7 roles + 7 schemas, ADR-007)
docs/           intent, plans (SRS/PRD/BRD), ADRs, C4 diagrams
```

## Documentation

**For agents/contributors — start with [AGENTS.md](AGENTS.md).**

- [ARCHITECTURE.md](ARCHITECTURE.md) — hard contract: contexts, boundaries, dependency rules (never edit)
- [PRODUCT.md](PRODUCT.md) · [DESIGN.md](DESIGN.md) — users, brand, visual system
- [docs/intent.md](docs/intent.md) — problem, outcome, users
- [docs/plans/SkillSwap-SRS.md](docs/plans/SkillSwap-SRS.md) — requirements with stable IDs (`FR`/`BR`/`NFR`/`OQ`/`AC`/`ST`)
- [docs/adr/](docs/adr/) — ADR-013 (RabbitMQ), ADR-014 (TypeORM), ADR-015 (mobile app + doc sync)
- [Conceptual và logical data model (DBML, SVG, PNG)](docs/diagrams/data/README.md)
- [SkillSwap MVP Software Development Blueprint](docs/plans/2026-09-15-001-feat-skillswap-mvp-requirements-plan.md)
- [GitHub Project: SkillSwap MVP Requirements](https://github.com/users/trankien022/projects/1)

The Blueprint is `Ready for Review`, not `Approved`: open product decisions remain visible as `OQ-###` Spike items and block only the affected requirements. In the personal GitHub Project, `Work Type` is the functional equivalent of the teacher model's reserved `Type` field, and built-in `Assignees` represents `Owner`.
