# Contextual content and action deduplication

## Audit and boundaries
Review the main learner/teacher pages and shared composition: explore, bookings, teaching, class detail, skills, verification, wallet, notifications, publishing; inspect admin/verifier entry points. Preserve confirmation recaps, current status, validation and role-specific actions. Cross-page repetition is acceptable when needed for a decision; unrelated dashboard summaries and repeated policy cards are not.

## Phase 1 — consolidate repeated content
- Bookings sidebar: keep available/held credits and wallet link. Remove derived total/conversion/progress ornament and duplicated escrow policy paragraphs. Keep learner rules in an accessible collapsed disclosure rather than another permanently expanded panel.
- Class detail: remove the extra escrow banner; retain policy at the booking action. Remove the extracted partial refund badge that repeats the full refund row. Keep date/duration recap by booking as intentional decision support.
- Verification: replace the unrelated skills summary/count card with a compact link to Skills, and remove its redundant profile-skills request.
- Teaching: remove the repeated identity line already in navbar and duplicate skills-management action in the intro (keep section action).
- Publishing: remove the repeated blanket verification/schedule banner (live eligibility checklist and schedule field retain requirements); remove repeated pledge panel in checklist (publish warning remains).

## Phase 2 — verification and report
Run pnpm verify, then browse changed pages plus unchanged core routes in VI/EN at phone/desktop widths, test disclosure and primary actions without submitting money or publishing. Record retained repetitions and scope limits. Commit code and validation separately.
