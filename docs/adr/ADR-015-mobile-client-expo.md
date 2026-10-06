# ADR-015: Mobile client — Expo (React Native) joins the MVP scope

- **Status:** Accepted
- **Level:** Sub-system (C4 Level 2 · Container)
- **Date:** 2026-10-06

**Context.** `docs/intent.md`, BRD §3.1/§4.2, the Blueprint §2, SRS §1.2 and PRODUCT.md all state that native mobile apps are out of MVP scope ("web responsive only, mobile-first"). The Product Owner has since decided that a native mobile app ships inside the MVP, which contradicts those statements and requires a stack decision before the delivery plan can grow an increment. Separately, `AGENTS.md` forbids editing `ARCHITECTURE.md` "if reality must change" unless an ADR is added first — the doc set also carries pre-scaffold drift (no Gateway/RabbitMQ containers, stale ORM wording) that must be synced with the code.

Decision drivers: Performance, Cost efficiency, Scalability, Security & Privacy, Modifiability, Testability, Interoperability, Time-to-market, Availability, Deployability.

Context notes: The repo is a TypeScript pnpm monorepo (`apps/gateway`, `apps/api`, `apps/web`, `packages/contracts`). The mobile app must talk to the same gateway under ADR-008 and must not reach the database or broker directly (ADR-005/ADR-007/ADR-013). No mobile code exists yet; this ADR records the decision, not a scaffold.

**Options considered.**

| Driver | Weight | Expo (React Native) | Flutter | Native (Kotlin/Swift) |
| --- | --- | --- | --- | --- |
| Performance | 3 | 3 | 4 | 5 |
| Cost efficiency | 3 | 5 | 4 | 2 |
| Scalability | 2 | 4 | 4 | 4 |
| Security & Privacy | 2 | 4 | 4 | 5 |
| Modifiability | 2 | 5 | 3 | 2 |
| Testability | 2 | 4 | 4 | 3 |
| Interoperability | 2 | 5 | 2 | 2 |
| Time-to-market | 2 | 5 | 4 | 2 |
| Availability | 1 | 3 | 3 | 3 |
| Deployability | 1 | 5 | 4 | 3 |
| **Weighted total (/5)** | | **4.30** | **3.65** | **3.15** |

**Decision.** Adopt **Expo (React Native, TypeScript)** for a new `apps/mobile` container, and add **Increment 6** (mobile app for Learner/Teacher core flows) to the delivery plan in `docs/plans/SkillSwap-PRD.md` §14 and the Blueprint §12. The mobile app reuses `packages/contracts` and calls the same public REST API as `apps/web` through the gateway; it shares no code with other apps (the `isolated-app-*` rule list in `.dependency-cruiser.cjs` gains `mobile` when the app is scaffolded). This record supersedes every "native mobile app out of scope" statement in `docs/intent.md`, BRD §3.1/§4.2, Blueprint §2, SRS §1.2/§3.5 and PRODUCT.md — those documents are updated in the same change. It also authorizes the direct edits to `ARCHITECTURE.md`, `README.md`, `AGENTS.md` and the C4 sources under `docs/diagrams/c4/` that sync the doc set with this decision and with the existing code, per the AGENTS.md rule "ADR first, then edit".

**Rationale.** Expo was chosen because it is strong on the priority drivers: Modifiability and Interoperability (same language and shared Zod contracts as the rest of the monorepo), Time-to-market and Deployability (EAS builds/OTA updates, one codebase for iOS/Android), Cost efficiency (one team, no per-platform hire). Compared with Flutter: higher weighted score (4.30 vs 3.65); Flutter's Dart stack would fork the codebase from the TypeScript monorepo and double the test tooling. Compared with Native: higher score (4.30 vs 3.15); per-platform code doubles cost for an MVP team, and Performance (the one driver where native wins) is not a limiting factor for a booking/chat UI.

**Consequences.**

- (+) One language, one contract package, one API — mobile, web and gateway stay in lockstep
- (+) Delivery plan gains a clear Increment 6 with its own exit criteria; increments 1–5 (web) are unchanged
- (+) ARCHITECTURE.md, C4 diagrams and README can be corrected against reality under an accepted decision instead of drifting
- (−) A third deployable increases the release matrix — mitigate with the shared contracts package and one EAS pipeline
- (−) React Native/Expo is a new runtime (Hermes, native modules) the team has not operated before — mitigate by keeping native modules minimal and leaning on Expo's managed workflow
- (−) Doc churn: scope statements across six documents change in one commit — mitigate by keeping requirement IDs stable (no new FRs; mobile enters as an increment, not a requirement)

**Verification.** Grep across `docs/`, `PRODUCT.md`, `README.md` finds no remaining claim that native mobile is out of MVP scope; PRD §14 and Blueprint §12 both list Increment 6 with matching scope/exit criteria; `ARCHITECTURE.md` and the C4 container view show the mobile client alongside web and are consistent with the code (`pnpm verify` green). When `apps/mobile` is scaffolded: `pnpm test:arch` must include and pass `isolated-app-mobile`.
