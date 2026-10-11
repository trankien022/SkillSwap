# T10 learner booking reads — 12 October 2026

- Authenticated GET /api/classes/bookings/me binds ownership to currentUserId. State and explicit upcoming=true/false filters, bounded portable keyset cursor ordered by class startsAt/bookingId, exact totalUpcomingCount independent of page/filter.
- Reads only live_class tables; public teacher name enrichment uses the account-profile facade. Room access uses configured inclusive window and excludes terminal classes. Rating eligibility requires confirmed booking and actual completed class; hasRated remains provisional false until T16.
- Independent contract18 + backend28 focused tests passed; API build/typecheck, scoped lint and architecture checks passed (578 modules/1715 dependencies, including current marketplace slice).
- Fixed transformed-query pipe generic typing and removed unused test import after review. No coercion of string false to boolean true.
- Strict Gateway probe passed with disposable persisted bookings: caller isolation, two keyset pages, exact unfiltered upcoming count2 even filtered one-item page, false complement/history, public teacher name, completed rating eligibility, no email exposure, invalid400 and absent credentials401. Deleted seeded classes/bookings afterward.
- T10 calendar/dashboard mobile wiring and device acceptance remain pending.
