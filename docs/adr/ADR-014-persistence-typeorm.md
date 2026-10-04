# ADR-014: Persistence framework — TypeORM

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-04

**Context.** `ARCHITECTURE.md` §1 Constraints states "Stack: Next.js frontend, NestJS backend, PostgreSQL with TypeORM/Prisma" — both alternatives are named, neither is decided. Rule G-1 forbids introducing a new datastore/persistence layer without an ADR, and ADR-007 (schema per module) plus ADR-009 (hexagonal, domain/application free of ORM) constrain what the persistence layer may look like. This record resolves the choice to a single ORM.

Decision drivers: Performance, Cost efficiency, Scalability, Security & Privacy, Modifiability, Testability, Interoperability, Time-to-market, Availability, Deployability.

Context notes: Seven modules, each owning its own PostgreSQL schema and its own migrations folder (ADR-007). The ORM must sit only behind outbound ports — domain and application packages may never import it (ADR-009, fitness function ADR-004/ADR-009).

**Options considered.**

| Driver | Weight | TypeORM | Prisma |
| --- | --- | --- | --- |
| Performance | 3 | 3 | 4 |
| Cost efficiency | 3 | 5 | 5 |
| Scalability | 2 | 4 | 4 |
| Security & Privacy | 2 | 4 | 4 |
| Modifiability | 2 | 5 | 3 |
| Testability | 2 | 4 | 3 |
| Interoperability | 2 | 4 | 4 |
| Time-to-market | 2 | 4 | 5 |
| Availability | 1 | 4 | 4 |
| Deployability | 1 | 4 | 4 |
| **Weighted total (/5)** | | **4.10** | **4.05** |

**Decision.** Adopt **TypeORM** (0.3.x) as the single persistence framework for all seven modules. Each module owns one `DataSource` bound to its own schema and its own `migrations/` folder; entities are plain classes decorated by TypeORM and live only in `internal/adapter/out/persistence/`. Domain entities (ADR-010 aggregates) are *not* ORM entities: repository adapters map between them. The gateway and web apps do no direct database access.

**Rationale.** TypeORM was chosen because it is strong on the priority drivers: Modifiability (decorators + hand-written migrations give per-schema control required by ADR-007), Testability (repositories can be faked behind ports; entities need no codegen step), Interoperability (first-class NestJS integration, raw-SQL escape hatch). Compared with Prisma: higher weighted score (4.10 vs 4.05). Prisma wins on query performance and time-to-market for simple CRUD, but loses on Modifiability and Testability here — its global schema/codegen model makes *seven independent schema+ migration units* (ADR-007) awkward (one `prisma` folder fighting seven module-owned migration folders), and its generated client is harder to fake in hexagonal unit tests than a port interface. The margin is thin; the deciding factor is ADR-007's schema-per-module rule, which TypeORM supports naturally with one DataSource + migrations folder per module.

**Consequences.**

- (+) Seven DataSources, seven migration folders, seven DB roles — mirrors ADR-007 exactly
- (+) Entities stay in the persistence adapter; domain stays ORM-free (fitness function ADR-009)
- (+) No codegen step in the build; `pnpm build` is a plain `tsc`/nest build
- (−) Query performance below Prisma on hot paths — mitigate with query-level tuning/caching later (a quality-attribute scenario, Performance priority 3)
- (−) Decorator-based entities leak persistence concerns if discipline lapses — enforced by the module-isolation and hexagonal architecture tests
- (−) TypeORM's migration tooling is per-DataSource; the pipeline must run 7 migration units (automated in `pnpm db:migrate`)

**Verification.** Architecture test: no file outside `adapter/out/persistence/` imports `typeorm`; `domain/` and `application/` packages import neither `typeorm` nor `@nestjs/*` (fitness function ADR-004/ADR-009). Build test: `pnpm typecheck` runs with no `typeorm` import reachable from domain/application. Migration test: a clean database plus `pnpm db:migrate` creates all seven schemas, each owned by its own role, and `schema_migrations` rows land in the correct schema.
