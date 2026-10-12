# T10 mobile booking HTTP adapter — 12 October 2026

- Canonical protected GET bookings/me preserves exact upcoming count and room/rating flags; serializes false explicitly and cursor/filter values safely; no owner override parameters.
- Focused tests against actual GatewayClient verify authentication, single GET401 refresh/retry, response validation and exact count beyond page size. Included in39 adapter tests; scoped lint zero. Removed unnecessary type/method aliases after review.
- Actual source executed against strict Gateway successfully read caller history with upcoming=false and bounded page. Backend ownership/count/pagination evidence remains tasks/evidence/my-bookings-read.md.
- Calendar/dashboard UI and device acceptance remain pending.
