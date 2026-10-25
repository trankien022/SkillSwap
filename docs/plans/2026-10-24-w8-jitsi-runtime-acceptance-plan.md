---
title: W8 — Jitsi runtime acceptance (FR-011)
type: plan
date: 2026-10-24
topic: w8-jitsi-runtime-acceptance
status: Proposed
owner: Group 4
---

# W8 — Jitsi runtime acceptance

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-011 (Must) · **ACs:** AC-006 · **DEP:** DEP-002 (Open) · **Modules:** `live-class` (adapter `out/jitsi`)
**Priority:** P1 — the code exists and is tested, but the **runtime was never accepted**.

---

## 0. What is actually wrong

`tasks/todo.md:15` says it plainly: **"Jitsi không nghiệm thu"** (Jitsi not accepted). The SRS dependency table still lists DEP-002 as **Open**.

What *is* done:

- `domain/room-access.ts` — party + confirmed booking + window, pure and unit-tested;
- `adapter/out/jitsi/jitsi-room-token-issuer.ts` — JWT issuance with `exp`, tested;
- `POST /classes/bookings/:bookingId/room-access` — backend;
- web `LiveClassroomContent.tsx` + `jitsi-external-api.ts`, mobile `room-access-gateway.ts`.

What is **not** done: proof that two real participants can join the same room through our token, from our clients, inside the window — with an outsider denied. Until then FR-011 is "code complete, unverified", and AC-006 is untested in reality.

This is deliberately a **thin plan**: it is mostly evidence, not construction. Its value is converting an open dependency into a closed one so the SRS stops hedging.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP (gate closed 2026-10-25).** C1 and C2 are decided; C3/C4 remain engineering calls recorded below, and C5 fixes the acceptance bar.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **DEP-002 — self-hosted or hosted?** | SRS §1.2 ("self-hosted or hosted") vs. ADR-020 (chose self-hosted) vs. hosted JWT auth requiring a paid plan | Engineering + Product Owner | **CLOSED 2026-10-25 — self-hosted** | ADR-020 amendment; the Jitsi **webhook** chosen in W1 C3b is only possible self-hosted, which settles it |
| **C2** | **"No grandfather" vs. the commitment lock** | OQ-008 resolved: room access re-checked per request, "no grandfather exception in MVP" — so an **admin revocation** can deny a Learner a class they already **paid for**. BR-045 only refunds when the *Teacher cancels*; BR-046 gives the learner no cancellation right; BR-016 locks the class at the first Confirmed booking so a reschedule is not possible | **Product Owner** | **CLOSED 2026-10-25 — grandfather existing confirmed bookings** | OQ-008 is **amended**: a booking confirmed **before** revocation stays joinable to its end; **new** bookings on a revoked Teacher are refused. Honours BR-016, needs no refund. **This is code, not just evidence** — Phase 2 item 3 becomes an implementation step |
| C3 | **Does the room stay open after completion?** | ADR-021 (completion) vs. `room-access.ts` `window_closed`/`JOINABLE_BOOKING_STATES = ['confirmed']`. **C3 of W1 (2026-10-25) removed the `teacher_ended` basis entirely**, so the only early close is C3b's empty-room rule | Engineering | No — engineering call | Decide and test: once a class is Completed the booking stops being joinable, and with no teacher-initiated end the room can only close at the scheduled end or via the W1 **Phase 1b** idle rule. Recorded so the acceptance run asserts it rather than discovering it live |
| C4 | **Is a certificate trust step acceptable on phones?** | NFR-001/NFR-006 (usable on mobile) vs. self-hosted TLS | Engineering | No | Runbook must cover installing the CA; if it cannot, C1 flips to hosted |
| C5 | **What evidence counts as "accepted"?** | `tasks/todo.md` rubric vs. an agent claiming success | Engineering + Product Owner | **Agreed 2026-10-25 — two humans, two devices, recording** | An agent cannot self-certify this phase. This is the acceptance bar, not a gate |

**Already resolved — do not reopen:** ADR-020 (per-request re-authorisation, short-lived JWT), OQ-008's room-access clause *as a mechanism* (C2 changed its consequence, not its implementation).

**Exit criteria (met 2026-10-25):** C1 and C2 decided and recorded; C3/C4 recorded; C5 agreed as the acceptance bar.

**Commit:** `docs(adr): close DEP-002 and settle revocation-vs-commitment for room access (W8 phase 0)`


---

## Phase 1 — Reproducible environment (after C1)

1. `docs/runbooks/jitsi-local-demo.md`: bring-up, secrets, ports (`8443`), certificate trust on a phone, and the exact env block (`JITSI_APP_ID` / `JITSI_APP_SECRET` / `JITSI_DOMAIN` / `JITSI_TOKEN_TTL_SECONDS` / `JITSI_OPEN_MINUTES`, read at `shared/config/api-config.ts:128-132`).
2. `pnpm` script or documented command to start the stack (do not overload `db:demo`).
3. A smoke check: `GET https://<domain>/config.js` returns and its `tokenAuthUrl`/anonymous settings match the ADR.

**Commit:** `docs(runbook): bring up Jitsi for the demo`

---

## Phase 2 — Backend evidence (after C1, C2)

1. Re-run the room-access suite and capture the denial matrix: outsider, wrong booking, cancelled class, before window, after window, unconfirmed booking (AC-006).
2. Decode a real issued token and show `aud`, `iss`, `sub`, `room`, `exp`, `context.user.moderator` — with the **secret redacted** in the evidence file.
3. **Revocation case, per C2 (implementation step, not evidence):** a booking confirmed before a Teacher's revocation must stay joinable; a booking attempted after it must be refused. Add the test first (`room-access` returns granted for the grandfathered booking, `learner_not_verified`-style refusal for a new one), then the predicate.

**Evidence file:** `tasks/evidence/jitsi-runtime.md` (pattern exists: `tasks/evidence/jitsi-runtime.md` is already listed in the repo map).

**Commit:** `test(live-class): record room access denial matrix`

---

## Phase 3 — Two-device acceptance (the part that needs humans)

On real hardware, with the runbook:

1. Teacher joins from the web client; Learner joins from mobile — same room, mic and camera both directions.
2. Learner tries the room **outside** the window → denied with an actionable message (NFR-006), not a blank screen.
3. A third account tries the room → denied.
4. Teacher ends the class (`POST /classes/:id/complete`) → the room remains usable for the current session or closes per ADR-020; record which.
5. Screenshot/recording per step; store under `tasks/evidence/`.

**Note:** this phase cannot be done by an agent alone — it needs two people and two devices. It must be scheduled, not assumed.

---

## Phase 4 — Honest degradation (NFR-006)

Currently a Jitsi failure surfaces as a bare error. Improve:

- distinguing "server unreachable", "token rejected", and "window closed"; each with its own copy in vi/en;
- a retry affordance that re-requests a token (the window may have opened since);
- never show a raw stack or token in the UI or console.

**Tests:** component tests for the three states; assert no token in rendered output.

**Commit:** `fix(web): distinguish Jitsi failure modes`

---

## Phase 5 — Close the loop

- DEP-002 → **Resolved** in the SRS dependency table.
- `tasks/todo.md` "Jitsi không nghiệm thu" → updated with the evidence link.
- FR-011 status stays `Confirmed` but the SRS may now say "runtime accepted 2026-xx-xx".
- `docs/diagrams/checkpoint/source/sequence-room.puml` re-rendered if the flow changed.

**Commit:** `docs(srs): record Jitsi runtime acceptance`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **\"No grandfather\" is accepted by default and a paying Learner loses a paid class with no refund path** | **High** — the code already does this and nobody decided it | C2 is a Product Owner decision recorded before Phase 2 evidence is called acceptance |
| **A developer \"fixes\" the revocation rule as a bug** while C2 is open | Medium | Phase 0 forbids changing access rules; C3's observations are recorded, not patched |
| No second device/person at acceptance time | High | Schedule Phase 3 explicitly; Phases 0–2 still close DEP-002 partially |
| Certificate trust blocks mobile access to a self-hosted Jitsi | Medium | Runbook covers installing the CA on the phone |
| Hosted Jitsi requires a paid plan | Medium | C1 decided in Phase 0; do not half-build both |
| Jitsi upgrade changes `config.js` overrides | Low | Smoke check in Phase 1 catches it |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — self-hosted vs hosted (DEP-002) | Engineering + Product Owner | **Self-hosted** |
| C2 — deny a paid Learner on teacher revocation, or grandfather existing bookings | **Product Owner** | **Grandfather** existing confirmed bookings; block new ones |
| C3 — room closed after completion | Engineering | Yes — recorded |
| C4 — phone certificate trust | Engineering | Runbook must cover it, else C1 flips to hosted |
| C5 — what counts as accepted evidence | Engineering + Product Owner | Two humans, two devices, recording |

## Definition of done

- C1 and C2 answered in an ADR/amendment **before** any acceptance claim.
- Deployment chosen and documented; DEP-002 resolved.
- Denial matrix recorded; two-device join recorded by two humans.
- Failure states are distinguishable and localised.
- SRS no longer hedges on FR-011.
