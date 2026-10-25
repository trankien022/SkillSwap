# ADR-036: In-class chat scope, authorisation and contact-sharing enforcement

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-25
- **Closes:** OQ-009 (chat handling of detected contact info), FR-012 enforcement clause
- **Related:** ADR-020 (room access rule, reused), ADR-014 (per-module schema), ADR-013 (outbox)

**Context.** FR-012 is confirmed at its core — "in-class chat to booking participants only, outsiders
denied" — but its enforcement clause was excluded from the SRS pending OQ-009: *what should happen
when a message contains personal contact information?* SR-BR-008 (BR-055/056) requires that contact
sharing be prohibited per approved policy, and C-009 records the same. Without an answer there is no
policy for a message to violate, so shipping chat would be shipping a feature that enforces nothing.

The temptation to avoid is treating Jitsi's built-in chat as satisfying FR-012. It does not: it has
no participant authorisation of ours, no retention decision, and no place to enforce a rule. The
comment in `LiveClassroomContent.tsx` that names it is describing a third-party feature, not ours.

**What the W5 decision gate settled** (all closed by the named owners on 2026-10-25):

| # | Question | Decision | Owner |
|---|---|---|---|
| C1 | OQ-009 — what happens on detected contact info? | **Block.** Message rejected, nothing stored | Product Owner |
| C2 | Scope of "participants only" | **Same window as room access**; history stays readable after the class | Product Owner |
| C3 | Is BR-056's block the mitigation or the problem (RISK-009)? | Bypass risk **accepted and recorded** | Product Owner |
| C4 | Retention and deletion | **Keep, no deletion in MVP** | Product Owner + Security |
| C5 | Is chat in MVP at all (FR-012 is *Should*)? | **Yes, ship it** | Product Owner |
| C6 | Where do messages live? | `live-class` schema | Engineering |

**Decision.**

1. **A message containing personal contact information is rejected and never stored.** Not warned,
   not flagged, not logged with its body. `detectContactSharing` returning a match throws
   `ContactSharingNotAllowedError`, the transaction rolls back, and the sender sees a message saying
   contact sharing is not allowed. This is the one place the implementation departs from the BRD's
   own OQ-009 recommendation ("warn + log"), and the reason is structural rather than a preference:
   **warn-and-log requires a moderation surface to review what was logged**, and C-010 says the MVP
   has no moderation surface. Choosing warn+log would not have closed OQ-009; it would have created
   an unscoped follow-on requirement — an admin flagged-message read — that nobody has agreed to
   build. Block satisfies BR-056's "không cho phép" using a rule the MVP can actually enforce end to
   end.

   A consequence worth stating: because nothing is stored, **the `flagged` column does not exist**.
   The field appeared in earlier sketches of the contract, and it is removed deliberately. A column
   that is always `false` is worse than no column — it invites a future reader to believe a
   moderation path exists.

2. **The chat window is the room window, derived from the same rule, not re-derived.** Chat
   authorisation calls the predicates in `domain/room-access.ts` (`authorizeRoomAccess`): party,
   booking confirmed, and inside `[starts_at − openMinutes, starts_at + durationMinutes]`. A second
   window calculation is the classic way these two drift — one gets a bug fix and the other does not,
   and then chat is open while the room is shut, or the reverse, with no single place to correct it.

3. **History stays readable to both parties after the window closes; sending does not.** C2 draws the
   line at writes: the window governs *posting*, because posting is participation. Reading the
   transcript of a class you attended is a record of a past transaction, not participation in it.
   Both parties keep read access; there is no endpoint that lets anyone else read it.

4. **No policy switch for the enforcement mode.** OQ-009 is decided, so `detectContactSharing`
   returning a match *always* throws. A configurable `mode: 'block' | 'warn'` would create a
   dormant branch that no test exercises and no deployment uses, and the next reader would be unable
   to tell which mode production runs. If the policy ever changes, that is a new decision and a new
   ADR — not a flag.

5. **The detector is deliberately conservative, and its false negatives are accepted.** A pattern
   that blocks a legitimate lesson reference ("Bài 3, trang 45", "buổi 2 lúc 19h") costs a user a
   message they were entitled to send, and there is no unblock path in the MVP. A pattern that misses
   an obfuscated contact address costs us a policy breach that the accepted RISK-009 bypass already
   permits anyway. Given that asymmetry, the detector matches **explicit, unambiguous forms only**:
   Vietnamese mobile numbers in common separator styles (`0xxxxxxxxx`, `+84…`, spaced, dashed,
   dotted), email addresses, `http`/`https` URLs, and social handles prefixed with `@`. It does not
   attempt to defeat `0900 chín không…` spelled-out digits, spaced-out letters, or images — and it
   does not claim to. Overclaiming here would be the real failure, because it would let this ADR
   read as *we solved the bypass risk* when C3 records the opposite.

6. **Messages are kept with no deletion path in the MVP.** C4 chose keep over build-a-policy. A
   deletion feature without an agreed policy (what is deleted, who may ask, what is retained for the
   other party) is worse than none, because it would imply an erasure guarantee the product cannot
   honour. There is no edit endpoint either: FR-012 says nothing about editing, and inventing it
   would add a mutable-record problem the audit trail does not need.

**Accepted risk (C3, BRD RISK-009).** Blocking contact information in chat will push some
participants to exchange details elsewhere — the platform already knows both parties' identities for
the duration of the booking, and no amount of pattern matching changes that. The Product Owner
accepted this risk explicitly. This ADR records it as **accepted, not mitigated**, and the
conservative detector in decision 5 is chosen partly so we do not tell ourselves otherwise.

**Consequences.**

- (+) BR-056 has an enforcement mechanism the MVP can actually enforce end to end, with no moderation
  surface required.
- (+) A rejected message stores no row, so the retention decision (C4) never has to reason about
  content we told the user we would not keep.
- (+) Reusing `room-access.ts` keeps one definition of "inside the class" for both the door and chat.
- (−) Blocking is user-visible friction, with no appeal path. A legitimate message matching a pattern
  is simply refused; the copy must be clear enough that the user knows what to remove.
- (−) The RISK-009 bypass is unaddressed by design. This ADR must not be cited as a mitigation for
  it.
- (−) Messages are permanent with no erasure path, which is a known retention liability accepted
  under C4.

**Verification.** Domain: a table of true positives (each Vietnamese number format, an email, a URL,
a handle) and true negatives ("Bài 3, trang 45", a price, a duration) — the negatives are the point,
because a detector that only blocks is trivially "correct". Authorisation: window boundaries, a
non-party requester, and a cancelled class all denied, plus a check that the denial reason comes from
the shared room rule rather than a duplicate. End to end: a blocked send leaves **no row** in
`live_class.chat_messages` and does not echo the attempted body in the error, and the body is never
passed to the logger on either path.

**Related:** ADR-020 (room access; this ADR reuses its rule), ADR-014 (per-module schema and
per-module credentials), ADR-013 (outbox, if a `chat.message.posted` event is added later — no push
handler is registered in the MVP), ADR-034 §8 (the reason enforcement is not deferred further).
