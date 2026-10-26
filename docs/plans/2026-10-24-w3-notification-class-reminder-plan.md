---
title: W3 — "Class starting soon" notification (FR-016 gap)
type: plan
date: 2026-10-24
topic: w3-notification-class-reminder
status: Unblocked — gates closed 2026-10-25 (T-15min, both parties, Confirmed only)
owner: Group 4
---

# W3 — "Class starting soon" notification

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-016 (Should) · **ACs:** none specific; supports US-L1 · **Modules:** `live-class` (+ scheduler), `account-profile` (consumer, already built)
**Priority:** P1 — the only FR-016 trigger with no producer at all.
**New ADR required:** no.

---

## 0. What is actually wrong

FR-016 lists five triggers. Four are emitted:

| Trigger | Producer |
|---|---|
| verification outcome | `student.verification.*` → `account-profile.module.ts:92` |
| booking confirmed | `booking.confirmed` (settled only) → `:105` |
| booking cancelled | `booking.cancelled` → `:115` |
| wallet transaction completed | `wallet.transaction.completed` → `:122` |
| **class starting soon** | **nothing** |
| withdrawal outcome (W7) | declared, no producer — see W7 |

For "class starting soon" the platform has:

- copy in both languages: `account-profile/internal/application/notification-copy.ts:8`;
- a DB `CHECK` allowing `'class_starting_soon'`: `1791072000006-CreateNotificationStorage.ts:19`;
- the push worker, the inbox, the deep-link target and mobile UI — all working.

What is missing is **one emitter**. The `schedule` module is an empty shell (`domain/module-status.ts` only), so nothing watches `starts_at`.

Two secondary problems travel with it:

1. **Whom to notify.** `booking.confirmed` notifies both student and teacher; `booking.cancelled` notifies only the learner. A reminder must notify both parties of every confirmed booking, and must **not** notify for a Pending (unsettled) booking or a cancelled class.
2. **Multi-instance safety.** Two API instances running the same timer would emit the reminder twice. The push worker solved this with database leases (`push-delivery-store`); the reminder needs the same discipline, not a bare `setInterval`.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP.** "Class starting soon" sounds self-evident, which is exactly why it gets built wrong. It touches OQ-003 (resolved), BR-016 (commitment lock) and BR-019 (teacher overlap). Those rows must be closed first.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **What offset, and one reminder or two?** | FR-016 "class starting soon" (no number) vs. `DEFAULT_OPEN_MINUTES = 15` about *room access* | Product Owner | **CLOSED 2026-10-25 — one reminder at `starts_at − 15 min`**, so the reminder and a usable door coincide | Other readers: `CLASS_REMINDER_OFFSET_MINUTES` (default 15) |
| C2 | **Which states are reminder-eligible?** | OQ-003 resolved and BR-016 (commitment lock) vs. a Pending booking that settles 4 minutes before start | Product Owner | **CLOSED 2026-10-25 — Confirmed bookings of Published/Full classes only**; never `cancelled`/`completed` | Query filters `state = 'confirmed'` |
| C3 | **Does a reminder fired before a cancellation need retracting?** | FR-016 vs. OQ-003 refund + AC-022 | Product Owner | **CLOSED 2026-10-25 — accept the stale reminder** | The existing `booking.cancelled` notification supersedes it; no retraction feature |
| C4 | **Teacher reminders too?** | FR-016 does not name the recipient | Product Owner | **CLOSED 2026-10-25 — both parties** | The `booking.cancelled` learner-only asymmetry is recorded as a separate finding, not silently changed here |
| C5 | **Where does the collector live?** | ADR-014 (no cross-schema reads) vs. the empty `schedule` module | Engineering | Closed — `live-class` | `schedule` stays empty and is annotated as such |

**Already resolved — do not reopen:** OQ-003 (no learner cancellation; pending auto-expires), OQ-006 (completion rule). A reminder must not create a new cancellation path.

**Exit criteria:** C1–C4 answered; C5 recorded. Result is the first commit.

**Commit:** `docs(srs): pin the class reminder offset, recipients and eligibility (W3 phase 0)`

---

## Phase 0b — Confirm the shape

1. Read `tasks/todo.md` T20 ("Class-start reminder", unticked) and adopt its AC verbatim: *agreed offset; cancelled class không nhắc; retries/restart không gửi duplicate theo logical reminder*.
2. Reconcile T20's AC with C2/C3/C4 — if T20 already contradicts the PO answer, the SRS wins and T20 is amended in the same commit.


---

## Phase 1 — Domain: a class is reminder-eligible when…

Add to `live-class/internal/domain/class.ts` (pure, no framework):

```ts
export function isReminderDue(
  cls: { state: ClassState; startsAt: Date },
  now: Date,
  offsetMinutes: number,
): boolean
```

True when `state` is `published | full`, `starts_at - offsetMinutes <= now < starts_at`, and the class has not already reminded (the caller supplies that fact). Explicitly false for `cancelled`, `completed`, `in_progress`, `draft`.

**Tests:** every state × before/at/after window; a class cancelled 1 minute before the window emits nothing; timezone-independent (all UTC `Date`).

> **Guard:** if C2 is answered as "notify Confirmed bookings only", the participant query in Phase 3 must filter `state = 'confirmed'`; the domain rule stays state-agnostic so the decision lives in one place (the query), not two.

**Commit:** `feat(live-class): add class reminder eligibility rule`

---

## Phase 2 — Persistence: a logical reminder that can only fire once

A new table in the `live_class` schema: `class_reminders(class_id, kind, sent_at)`, unique on `(class_id, kind)`. Insert-then-emit inside one transaction, exactly like the outbox insert pattern already used in `sql-class-repository.ts`:

```sql
INSERT INTO live_class.class_reminders (class_id, kind) VALUES ($1, 'starting_soon')
ON CONFLICT (class_id, kind) DO NOTHING
RETURNING class_id
```

If the insert returns nothing, another instance already owns it — skip. If it returns the row, insert the outbox events in the same transaction. **This makes the lease unnecessary**: the unique index is the lease.

Migration: `17910720007xx-CreateClassReminders.ts` per the existing per-module data-source pattern; generated entities only.

**Tests:** concurrent double-insert yields one row and one outbox event; a replay after restart is a no-op.

**Commit:** `feat(live-class): record class reminders once per class`

---

## Phase 3 — Emit the event

`sql-class-repository.ts` / a new `findDueReminders(now, offsetMinutes)` query joining `classes` and confirmed `bookings`, then, per due class, in one transaction:

1. claim the reminder row (Phase 2 SQL);
2. insert one outbox row per participant — or one row carrying all participant ids. **Recommendation: one event per class** (`class.starting_soon` with `classId`, `startsAt`, `participants: [{accountId, role}]`) so the consumer fans out; this keeps the outbox small and lets the consumer dedup per person.

Contract in `packages/contracts` (ADR-013 rule: no invented schemas beyond confirmed ones — this event is the natural encoding of an FR-016 trigger and must be added there with a spec):

```ts
classStartingSoonSchema = z.object({
  classId: z.string().uuid(),
  startsAt: z.string().datetime(),
  participants: z.array(z.object({ accountId: z.string().uuid(), role: z.enum(['learner','teacher']) })),
})
```

**Tests:** contract round-trip; repository emits only for confirmed bookings of due classes; a cancelled class emits nothing.

**Commit:** `feat(contracts): add class.starting.soon event` , `feat(live-class): emit class starting soon from the schedule scan`

---

## Phase 4 — Sweeper (reuse the existing pattern, do not invent one)

`live-class/internal/adapter/in/scheduler/class-reminder.sweeper.ts`, modelled exactly on `class-completion.sweeper.ts`:

- `setInterval` (60 s), `unref()`, overlap-guarded, `onModuleDestroy` clears;
- registered in `live-class.module.ts` providers next to `PendingHoldSweeper` / `ClassCompletionSweeper`;
- logs counts, not contents.

**Tests:** overlap guard, timer cleanup, a thrown error does not kill the ticker.

**Commit:** `feat(live-class): schedule the class reminder sweep`

---

## Phase 5 — Consume

`account-profile.module.ts`: register a handler for `class.starting.soon` mirroring the `booking.confirmed` handler at `:105` — for each participant `recordInboxNotification({ eventId, accountId, type: 'class_starting_soon', targetType: 'class', targetId: classId })`. No new copy needed; no schema change needed.

Deep link: `targetType: 'class'` must already resolve in web and mobile (the S16/S2 routes). Verify and, if needed, extend the resolver.

**Tests:** fan-out to N participants; duplicate event id → one inbox row; cancelled class before delivery → the handler should still deliver (the reminder was true when sent) — document that choice.

**Commit:** `feat(account-profile): deliver class starting soon to the inbox`

---

## Phase 6 — Clients and docs

- Web `projects/{locale}/notifications` and mobile notifications screen: confirm the new type renders with the existing generic wallet/booking card, or add a case. Both languages, no mixing (NFR-002).
- `tasks/todo.md` T20 → ticked with evidence.
- `docs/api/notifications.md`: add the type.
- SRS FR-016 status: unchanged (confirmed) — but the "confirmed" claim now matches reality.

**What actually shipped.** Mobile needed no change: `app/(features)/notifications.tsx` renders
`Notifications.type_<type>` and `body_<type>`, and both `en.json` and `vi.json` already carried
`type_class_starting_soon` / `body_class_starting_soon` (the copy existed before the trigger did).
Web routes the type through the `booking` category, which is the correct bucket for a class
reminder, so it also rendered without a code change.

**A gap found and left open, deliberately.** The web inbox renders server-copied `title`/`body`
alongside hardcoded Vietnamese labels (`Lớp học`, `Giao dịch…`). The inbox row stores one copy for
all readers — the per-device locale applies to push (`notification-copy.ts`), not to the inbox — so
an English reader sees English text under Vietnamese chrome. That is a pre-existing NFR-002 defect
in the notifications page, not something this wave introduced, and fixing it means deciding whether
inbox copy is rendered client-side or stored per-locale. That decision is not W3's to make.

**Commit(s):** `feat(web): render class reminder notifications` , `feat(mobile): render class reminder notifications` , `docs(api): document class starting soon`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Reminder built with an invented offset** ("15 minutes feels right") | **High** — this is the failure mode this rewrite removes | C1 is a Product Owner decision, recorded in the SRS before Phase 1 |
| Reminder fires for a class whose booking is Pending and later expires | Low (if C2 answered) | Query joins only `confirmed` bookings |
| Reminder fires after a cancellation that commits in the same second | Low | Claim + scan inside one transaction, re-reading the class state |
| Offset too early for slow devices | Low | Offset = `jitsiOpenMinutes` (config), not a hard-coded 15 |
| `schedule` module remains empty and looks like dead code | Certain | C5 records that reminders live in `live-class`; delete or annotate `schedule` |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — offset and reminder count | **Product Owner** | **One reminder**, `starts_at − 15 min` |
| C2 — eligibility (Confirmed only, no cancelled) | **Product Owner** | **Confirmed bookings of Published/Full only** |
| C3 — stale reminder after cancellation | **Product Owner** | **Accepted**; no retraction feature |
| C4 — notify the Teacher too | **Product Owner** | **Both parties** |
| C5 — collector module | Engineering | `live-class` |

## Definition of done

- The offset, recipients and eligibility are PO decisions recorded in the SRS, not defaults.
- Exactly one reminder per confirmed participant, proven by a restart test.
- No reminder for cancelled classes or Pending bookings.
- Visible on both clients in both languages.
- T20 ticked with evidence; `pnpm verify` green.
