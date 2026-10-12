# T11 nullable status transport correction

Observed through strict Gateway: a user without verification receives HTTP200 with an empty body from GET student-verifications/me, although the documented resource is StudentVerificationView|null. GatewayClient's JSON reader then yields undefined and the response contract correctly rejects it. Preserve validation rather than treating every malformed response as an empty resource.

Phase A: explicitly serialize null through the controller's structural HTTP response, without importing Express or changing user identity binding; add focused tests for null and existing resource. Build/typecheck/scoped lint and real Gateway probe. Commit this backend transport correction separately.
Phase B: validate the actual mobile adapter's upload/read flow against strict Gateway and real S3. PUT must preserve bytes and content type with credentials omitted; independently signed GET compares persisted bytes. Submit only after PUT success, then read pending resource. Commit adapter changes separately.
Phase C: native picker/form/status/resubmission UI and administrative decision integration; remaining T11 acceptance requires native device evidence and does not follow solely from HTTP unit tests.
