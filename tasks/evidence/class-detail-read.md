# T07 class detail backend — 12 October 2026

- GET /api/classes/:id requires authentication and UUID validation, uses owned-schema class/skill/booking reads and public teacher name facade.
- Draft visible only to owning teacher. In-progress/completed/cancelled visible only to teacher or caller with historical booking; others 404. Response includes only caller booking summary, no peer IDs/email/evidence.
- canBook requires published state, available seats after active holds, at least 24h lead time, different teacher and no active caller booking. Rating fields remain provisional until T16.
- Contracts 16 tests, backend query/controller/persistence 27 tests passed. Typecheck/build/scoped lint and architecture gate passed (565 modules/1667 dependencies). Fixed one test fixture that incorrectly expected a learner to see a draft; privacy behavior preserved.
- Strict Gateway runtime probe passed public name/seat/canBook response, self-book refusal, draft stranger404/teacher200, terminal historical participant200/stranger404, duplicate owned booking refusal, no private fields, bad UUID400, absent class404 and missing credentials401. Removed disposable fixtures afterward.
- Logs /tmp/skillswap-mobile-detail-contract-tests.log, /tmp/skillswap-mobile-detail-api-tests-final.log, /tmp/skillswap-mobile-detail-api-typecheck.log, /tmp/skillswap-mobile-detail-api-build.log, /tmp/skillswap-mobile-detail-arch.log.
- Native detail/booking UI integration is pending, so T07 as a whole remains incomplete.
