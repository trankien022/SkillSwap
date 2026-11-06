---
title: FR-017 on web — surface the verification status and rejection reason to the learner
status: Phases 0–1 done (2026-10-30) — stale SRS statements corrected, web shows status + rejection reason, browser-verified in both locales
date: 2026-10-30
owner: Product Owner (requirement) · Engineering (implementation)
related:
  - docs/plans/SkillSwap-SRS.md (FR-017, US-T3, §2.3 honest gaps, Appendix A)
  - docs/plans/2026-10-24-fr-completion-master-plan.md (§2 "confirmed and working")
---

# FR-017 on web — account status and rejection reason

## Why this plan exists

An audit of every FR against the code (2026-10-30, after W1–W9 merged) found exactly one
requirement that is neither implemented nor explicitly amended: **FR-017 (Must)** — *"show
the Learner their account status and any rejection reason on the main screen."*

| | Status shown | Rejection reason shown | Where |
|---|---|---|---|
| Mobile | ✅ | ✅ (`dashboard-view.tsx` reason box) | dashboard (its main screen) |
| Web | ⚠️ only as a pill on `/verification` | ❌ **never rendered** | — |

The gap is not in the API: the contract (`studentVerificationSchema.reason`,
`meResponseSchema.studentVerification.reason`) carries the reason end-to-end, the admin
reject flow stores it (AC-012), and the learner endpoint returns it. The web client
simply never renders it — no component reads `reason`, no i18n key exists for it. The
master plan §2 listed FR-017 as "confirmed and working", so nothing scheduled this fix.

**"Main screen" on web:** web has no signed-in dashboard route; the learner's account
surface is the **verification workspace** (`/{locale}/verification`, the navbar's
account tab) — the same screen that already hosts the resubmit path (required by SRS
§2.3/US-T3). Putting account state on the public marketing home (`/{locale}`) would be a
design change beyond FR-017's text, so the reason lands on the verification screen and
the SRS row records that placement.

## Phase 0 — say what is true (docs only)

The same audit found four SRS statements older than the code. The rule "the SRS must
never describe a state older than the code" makes fixing them part of this work:

1. **§2.3 blockquote** claims *"In-class chat (FR-013, US-M4) remains unimplemented"* —
   wrong ID (chat is FR-012/US-L2) and out of date (shipped W5, 2026-10-26). Correct it
   and add FR-017's web gap to the honest-gaps list, so the gap is recorded *before* the
   code lands rather than discovered by the next audit.
2. **Appendix C.4** claims *"Lifecycle ACs AC-022–AC-027 are documented but not
   implemented"* — AC-022/024/026/027 now exist (`CancelClassUseCase`, no-show refund,
   `ExpirePendingBookingsUseCase`, `RefundCancelledBookingUseCase`). AC-023/025 remain
   absent **by OQ-003's decision**, which is specified behaviour, not a gap.
3. **FR-019's status column** says the cascade/validity policy is "open (OQ-008)", but
   the OQ-008 row records those clauses as resolved 2026-10-10 (ADR-023/ADR-025: no
   expiry in MVP, revocation-only cascade — and the code matches: no `expiresAt` on
   approvals, `RevokeStudentVerificationUseCase` cascades).
4. **Appendix A's blocking list** still names OQ-008 as blocking Increment 2 and
   storage/lifecycle design, contradicting the OQ-008 row above.

Commit: `docs(srs): correct four statements older than the code` (+ this plan file).

## Phase 1 — render what the API already says (web)

- `VerificationContent.tsx`: when the verification view carries a non-null `reason`,
  render it in the profile panel under the status pill — label + reason text, `role="status"`
  so a screen reader announces it; no reason box when `reason` is null (approved or
  pending decisions legitimately have none).
- i18n: `Workspace.verification.reasonLabel` in **both** locales; the reason text itself
  is the administrator's words and is never translated.
- Tests (`VerificationContent.test.tsx`):
  - a rejected verification **with** a reason renders that reason (and the rejected pill);
  - an approved verification (reason null) renders **no** reason box — a stray box would
    imply a reason exists when the reviewer gave none.
- SRS FR-017 row updated to implemented, naming where on each client.

Commit: `feat(web): show the learner their verification status and rejection reason`.

## Phase 2 — verify in the browser

Login as a demo learner whose verification was rejected **with a reason** (seeded
directly, since the demo seed has no rejected verification), then at 360 px in both
locales: the reason text is visible, the status pill reads "Update your evidence"
(en) / its Vietnamese equivalent, and there is no horizontal scroll. Evidence recorded
in the final status line of this plan.

## Out of scope

- Moving account state onto the public home page (design change, needs a product call).
- Any change to `OQ-008`'s recorded resolutions — Phase 0 only makes two stale references
  agree with the row that already exists.
- `withdrawal_outcome` notifications and FR-014: out of the MVP, documented elsewhere.
