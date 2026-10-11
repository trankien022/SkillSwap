# T06 class list backend — 12 October 2026

- Authenticated GET /api/classes supports marketplace and teacherId=me own teaching, keyword/skill/date/state filters, bounded portable keyset cursor and stable startsAt/id ordering.
- Marketplace exposes published/full classes at least 24h ahead; private state filters cannot disclose other teachers classes. Own-mode includes all existing states. Active teaching count is an exact aggregate across all caller active classes, independent of page/filter.
- Seat availability subtracts confirmed and unexpired pending holds; confirmed count remains separately available. Public teacher names use account-profile bulk facade; no cross-schema SQL/private email/evidence. Rating fields are provisional null/0 until T16 introduces ratings.
- Independent checks: contracts 17 tests, backend query/controller/persistence/facade 22 tests passed. Corrected import paths and enforced teacherId=me or UUID query validation after review.
- Strict Gateway runtime probe passed: teacher name lookup, pending+confirmed capacity, 24h visibility, two distinct keyset pages, outsider private-state denial, own filtered page with exact unfiltered count 4, empty learner own list, malformed query/cursor400 and missing credentials401. Seeded only disposable read fixtures; removed classes/bookings and logged out afterward.
- Full pnpm verify passed: gateway27 + contracts98 + web22 + API414 + mobile87 tests; architecture 554 modules/1633 dependencies, zero violations. Log /tmp/skillswap-mobile-phase1-read-verify-green.log.
- T06 mobile marketplace UI remains pending; this is backend slice evidence, not full T06 acceptance.
