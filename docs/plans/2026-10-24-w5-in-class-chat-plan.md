---
title: W5 — In-class chat (FR-012)
type: plan
date: 2026-10-24
topic: w5-in-class-chat
status: Phase 0 done — ADR-036 written 2026-10-26; Phases 1+ await the D4 detector table
owner: Group 4
---

# W5 — In-class chat

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-012 (Should) · **BRs:** SR-BR-008 (BR-055/056) · **ACs:** none written · **UC:** UC-004
**Modules:** new work inside `live-class` · **Clients:** web live page, mobile live screen
**Priority:** P2 — **unblocked 2026-10-25.** Chat ships; contact sharing is blocked.

> **Status: ready to start.** FR-012's confirmed core is "in-class chat to booking participants only". Its enforcement clause — what to do when a message contains personal contact information — was explicitly excluded from the SRS pending OQ-009, and the Product Owner has now answered **block**. The SRS row still says "OQ-009 unresolved", so **the first commit is that SRS/ADR amendment**; only then does code begin. Shipping chat that enforced nothing would be the exact artefact ADR-034 §8 warns against.

---

## 0. Current state

| Layer | Reality |
|---|---|
| Backend | **Nothing.** No `Message` entity, no controller, no contract, no table. `Message` appears only in the SRS data dictionary (Appendix B) and the FR table. |
| Web | No chat UI. The live classroom shows Jitsi's own toolbar, whose built-in chat is a **Jitsi feature, not ours** — it does not persist, is not authorised by us, and disappears with the room. `LiveClassroomContent.tsx:624` even names it in a comment. |
| Mobile | No chat. |
| Authorisation | Room access is already solved and reusable: `request-room-access.use-case.ts` + `domain/room-access.ts` (party + confirmed booking + window). Chat must reuse that rule, not re-derive it. |

The distraction to avoid: **"Jitsi already has chat, so FR-012 is met."** It is not. SRS §3.1.4 says communication stays in-platform, SR-BR-008 says contact sharing is prohibited *per approved policy*, and a Jitsi chat has no participant authorisation of ours, no retention decision, and no enforcement hook.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP (gate now closed — 2026-10-25).** Every row below is decided: chat ships, contact sharing is blocked, retention is keep. The ADR recording these answers must still land before Phase 1.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| **C1** | **OQ-009 — what happens on detected contact info?** | SR-BR-008 / BR-056 vs. C-009 ("enforcement mechanism deferred") | **Product Owner** | **CLOSED 2026-10-25 — BLOCK.** Message rejected, nothing stored | Satisfies BR-056's "không cho phép" without building the moderation queue C-010 rules out. **Deviates from the BRD's own "warn + log" recommendation — recorded, not silent** |
| C2 | **Scope of "participants only"** | BR-040/BR-057 vs. OQ-003 (no learner cancellation; pending expires) | Product Owner | **CLOSED 2026-10-25 — same window as room access**; history stays readable to both parties after the class ends | Reuse `room-access.ts` predicates, never duplicate them |
| C3 | **BR-056 vs. RISK-009 — is blocking the mitigation or the problem?** | BR-056 vs. BRD RISK-009 ("users bypass chat to trade off-platform") | **Product Owner** | **CLOSED 2026-10-25 — bypass risk accepted and recorded** in the ADR | The ADR states the risk rather than pretending a regex solves it |
| C4 | **Retention and deletion** | SRS Appendix B vs. OQ-008 precedent vs. RISK-007 | Product Owner + Security | **CLOSED 2026-10-25 — keep, no deletion in MVP** | Recorded in the ADR; a deletion feature without a policy is worse than none |
| C5 | **Is chat in MVP scope at all?** | FR-012 is **Should** | **Product Owner** | **CLOSED 2026-10-25 — YES, ship it** | The wave proceeds in full |
| C6 | **Where do the messages live?** | ADR-014 (per-module schema) | Engineering | Closed — `live-class` schema | Chat is scoped to a booking of a class |

**Already resolved — do not reopen:** ADR-020 (room access rule, reusable), OQ-003 (no learner cancellation).

**Exit criteria:** C1, C3, C4, C5 answered; C2 decided; C6 recorded. If C5 = "omit", this wave ends here with an SRS note and **no code**.

**Commit:** `docs(adr): decide in-class chat scope and enforcement`

### OQ-009 option table — **decided: Block**

| Option | Runtime behaviour | Data | Effort | BR-056 satisfied? |
|---|---|---|---|---|
| **Block ✅ chosen 2026-10-25** | Message rejected, learner sees "contact sharing is not allowed" | Nothing stored | +1 domain rule, +copy | Yes — "không cho phép" |
| ~~Warn + log~~ | Message sent with a visible warning; flagged for review | Message + `flagged` | +detector, +flag, **+admin read** | Partially — "cảnh báo" |
| ~~Log only~~ | Message sent silently flagged | Message + `flagged` | +detector, +flag | No — BR-056 says *restrict or warn*, silent logging is neither |

**Why Block and not the BRD's own recommendation:** BRD OQ-009 recommended *"Cảnh báo và ghi log"* (warn + log). But warn+log **creates a follow-on requirement** — an admin flagged-message read — and C-010 says the MVP has no moderation surface. The PO chose Block, which satisfies BR-056 without an unscoped moderation queue. The deviation is deliberate and recorded in ADR-036's sibling decision note, not silently dropped. The `flagged` field therefore **does not exist** in the contract (Phase 1's suggested `flagged?` is removed).


---

## Phase 1 — Contract (gates closed)

`packages/contracts/src/chat.ts`:

```
chatMessageSchema        { id, classId, senderId, senderRole: 'learner'|'teacher', body, createdAt }
postMessageSchema        { body: 1..1000 chars, trimmed, no markup }
chatPageSchema           { items, page: { limit, nextCursor, total } }   // NFR-014
```

No `flagged` field: contact-sharing messages are **blocked**, so a stored-and-flagged message never exists.

Validation: length, trimmed, reject control characters, **never log the body** (NFR-004/008). A rejected send must not leak the attempted body into the error message. Add a spec for the envelope (NFR-013) and the page metadata.

**Commit:** `feat(contracts): add in-class chat messages`

---

## Phase 2 — Domain (after C2)

`live-class/internal/domain/chat.ts` (pure):

- `assertChatOpen({ booking, classView, now, openMinutes })` → reuses `room-access.ts` predicates rather than duplicating them; a chat window that drifts from the door window is a bug generator.
- `assertSenderIsParty`.
- `detectContactSharing(body)` → returns `{ kind: 'phone'|'email'|'url'|'handle' } | null`. Phone patterns must cover Vietnamese formats (`0xxxxxxxxx`, `+84…`, spaced/dashed variants); email and social handles. Keep it **conservative and tested** — a false positive that blocks a lesson reference is worse than a miss.
- `assertBookingRelationship({ booking, classView, now })` → BR-057: a chat right exists only while the business relationship is valid (C2).
- No policy switch: OQ-009 (C1) is decided as **block**, so the rule is unconditional — `detectContactSharing` returning non-null **throws** `ContactSharingNotAllowedError` and nothing is persisted. A configurable mode here would be a dormant branch nobody tests.

**Tests:** window boundaries, party check, cancelled-class denial (BR-040/BR-057), detector table (true positives, true negatives including "Bài 3, trang 45"), and that a blocked message writes **no row** and returns a non-leaking error.

**Commit:** `feat(live-class): add chat authorisation and contact-sharing rules`

---

## Phase 3 — Persistence

`live_class.chat_messages` (per-module migration, generated entities):

```
id uuid pk, class_id uuid, booking_id uuid, sender_id uuid,
sender_role text check in ('learner','teacher'),
body text (length-checked), flagged boolean not null default false,
created_at timestamptz
```

Index on `(class_id, created_at desc, id)` for keyset pagination. No cross-schema FK (ADR-014). Append-only — there is no edit or delete endpoint (FR-012 says nothing about editing; do not invent it).

**Commit:** `feat(live-class): persist class chat messages`

---

## Phase 4 — Application + REST

- `post-class-message.use-case.ts`: authorise (Phase 2) → policy (Phase 2) → persist → optionally emit `chat.message.posted` for a future push (do **not** register a push handler in MVP — messaging must not become a notification firehose).
- `get-class-messages.use-case.ts`: owner-scoped, keyset paginated, capped at 100 (NFR-014).
- Controller routes under the existing `classes` controller tree, following RESTful conventions:
  - `POST /classes/bookings/:bookingId/messages`
  - `GET  /classes/bookings/:bookingId/messages?limit&cursor`
  - Both `Roles('user')` + party check inside the use case (never trust the URL).
- Error codes: `CHAT_WINDOW_CLOSED`, `CHAT_NOT_A_PARTY`, `CHAT_CONTACT_SHARING_BLOCKED`.

**Tests:** controller 403/404/409 matrix, pagination, no body in logs (assert the logger was not called with the body), outsider denied.

**Commit(s):** `feat(live-class): post and read in-class chat messages`

---

## Phase 5 — Web client

- `apps/web/src/components/classroom/ChatPanel.tsx`: input + list, disabled outside the window, visible but read-only for a Teacher.
- Polling hook with cleanup on unmount; no horizontal scroll at 360 px (C-006); `aria-live="polite"` on new messages (NFR-007); keyboard submit.
- Warning/blocked copy in `vi` and `en`, never mixed (NFR-002).
- The Jitsi-embedded chat stays available; add one line of copy telling users the in-platform chat is the recorded one.

**Commit:** `feat(web): in-class chat panel`

---

## Phase 6 — Mobile client

- Chat section on the existing live screen (`bookings/[id]/live`), same polling port behind `src/infrastructure/http/`, same copy, 360 px safe, keyboard-avoiding input.

**Commit:** `feat(mobile): in-class chat panel`

---

## Phase 7 — Close the loop

- SRS FR-012 status: `Confirmed; enforcement open (OQ-009)` → `Implemented (OQ-009 resolved: blocked, ADR-036)`.
- SRS Appendix B `Message` row: match the real table name and columns; no `flagged` column exists.
- `docs/api/` entry for the two routes; `docs/diagrams/checkpoint/source/sequence-room.puml` gains the chat exchange, then re-render.
- UC-004 main flow updated to name the endpoints, including the blocked-contact-sharing alternate flow.

**Commit:** `docs(srs): record in-class chat implementation`

---

## Explicitly out of scope

- Real-time sockets (revisit only with a performance requirement).
- Attachments/images.
- Editing or deleting messages.
- Message search.
- **A moderation queue or flagged-message review** — C-010 rules it out and Block means nothing is stored to review.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Chat is built while OQ-009 is still open**, with a "reasonable default" detector | Low — **decided 2026-10-25** | The decision is Block; the detector is written against a stated policy, not a guess |
| **Blocking pushes users off-platform** (BRD RISK-009) | **High** — this is the real cost of the choice | C3: the PO accepted it; the ADR records the accepted risk rather than pretending the detector solves it |
| Detector blocks legitimate lesson content | Medium | Conservative patterns + a negative-test table in the spec |
| ~~warn+log creates an admin review queue nobody scoped~~ | — | **Moot** — Block chosen, nothing is stored |
| Polling load on a class with 20 learners | Low | 3 s interval, keyset cursor, single query per poll |
| Chat becomes a retention liability without a deletion policy | Medium | Decided: keep, no deletion in MVP |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — OQ-009 enforcement mode | **Product Owner** | **Block** |
| C2 — chat window and cancellation behaviour | Product Owner | **Same window as room access** |
| C3 — accept or address the off-platform bypass risk | **Product Owner** | **Accepted and recorded** |
| C4 — retention | Product Owner + Security | **Keep, no deletion in MVP** |
| C5 — is chat in MVP at all (FR-012 is *Should*)? | **Product Owner** | **Yes, ship it** |
| C6 — owning module | Engineering | `live-class` |

## Definition of done

- C5 answered (**yes, ship it**).
- OQ-009 answered in an ADR **before** Phase 1 (ADR-036 records Block + the accepted bypass risk).
- Outsiders provably denied; window and cancelled-class rules provably enforced.
- A contact-sharing message is rejected **and stores no row**.
- Body never appears in logs (test), including on rejection.
- Both clients, both languages, no horizontal scroll.
