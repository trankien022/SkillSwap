# SkillSwap — Week 6 checkpoint diagrams

Ngày đối chiếu: 2026-10-11. Code được pull từ `origin/main`: `166ee3a` (FR-005 publish gate), sau `83cbefa` (account roles). Phạm vi: **code hiện tại**, theo lựa chọn của người dùng và checklist SWD392. Đây là đối chiếu source code, không phải bằng chứng hệ thống đã chạy end-to-end. Các bộ diagram cũ trùng lặp đã được loại bỏ; đây là bộ diagram checkpoint được duy trì.

PDF dùng tên **C0** cho system landscape/context và **C1** cho containers. Chúng tương ứng Context/Container trong C4; không đổi thành Component view.

## Read the diagrams in business language

Revised on 2026-10-12. All 14 UML diagrams and the descriptions in all six C4 views use plain English actions, decisions and outcomes. FR references identify the capability; canonical BR references identify its business rules. Read activities for decisions, sequences for interactions, and states for lifecycle changes.

Backend behavior remains the basis of these views. Notes distinguish current limitations from required behavior: demonstration booking/payment, confirmation before wallet payment, and incomplete lifecycle transitions. Technical API routes, tables and source links stay in the traceability section below. Architecture views retain technology labels where needed to explain their structure; database ERDs remain technical data models.

Start with [Join an online class](generated/activity-room.svg), [Publish a class](generated/activity-publish.svg), [Book and pay](generated/activity-booking.svg), or [Verify student status](generated/activity-student-verification.svg). Editable sources remain in `source/`; each diagram has regenerated SVG and PNG files.

## Bộ diagram để nộp

C4 có nguồn Structurizr DSL; sáu view được xuất bằng Structurizr sang C4-PlantUML, với bố cục và ký pháp đã chỉnh trong [C4 index](../c4/README.md). UML dùng PlantUML trực tiếp. Mỗi hình có SVG để phóng to và PNG để chèn báo cáo.

| Yêu cầu | Diagram / xem SVG | Nguồn sửa được |
|---|---|---|
| C0: actors, boundary, integrations | [System Context](../c4/generated/structurizr-SystemContext.svg) | [workspace.dsl](../c4/source/workspace.dsl), [PlantUML](../c4/source/structurizr-SystemContext.puml) |
| C1: responsibilities, technology, communications | [Containers](../c4/generated/structurizr-Containers.svg) | [workspace.dsl](../c4/source/workspace.dsl), [PlantUML](../c4/source/structurizr-Containers.puml) |
| Actor goals / use cases | [Use cases](generated/use-cases.svg) | [PlantUML](source/use-cases.puml) |
| Sequence: publish/edit gate | [Publish class](generated/sequence-publish.svg) | [PlantUML](source/sequence-publish.puml) |
| Activity: publish decisions | [Publish gate](generated/activity-publish.svg) | [PlantUML](source/activity-publish.puml) |
| Sequence: booking/payment | [Booking settlement](generated/sequence-booking.svg) | [PlantUML](source/sequence-booking.puml) |
| Sequence: file upload / review | [Student verification](generated/sequence-student-verification.svg) | [PlantUML](source/sequence-student-verification.puml) |
| Sequence: room access | [Jitsi room](generated/sequence-room.svg) | [PlantUML](source/sequence-room.puml) |
| Sequence: top-up / callback | [Mock top-up](generated/sequence-topup.svg) | [PlantUML](source/sequence-topup.puml) |
| Sequence: actual client booking behavior | [Web/mobile mock](generated/sequence-client-booking.svg) | [PlantUML](source/sequence-client-booking.puml) |
| Activity: booking decisions | [Booking](generated/activity-booking.svg) | [PlantUML](source/activity-booking.puml) |
| Activity: authorization | [Room access](generated/activity-room.svg) | [PlantUML](source/activity-room.puml) |
| Activity: manual verification | [Student verification](generated/activity-student-verification.svg) | [PlantUML](source/activity-student-verification.puml) |
| State: main entity | [Booking](generated/state-booking.svg) | [PlantUML](source/state-booking.puml) |
| State: class lifecycle | [Class](generated/state-class.svg) | [PlantUML](source/state-class.puml) |
| State: student approval | [StudentVerification](generated/state-student-verification.svg) | [PlantUML](source/state-student-verification.puml) |
| Additional architecture evidence | [Booking](../c4/generated/structurizr-BookingFlow.svg), [Room access](../c4/generated/structurizr-TeachingFlow.svg), [Verification](../c4/generated/structurizr-VerificationFlow.svg), [Development deployment](../c4/generated/structurizr-Deployment.svg) | [C4 sources](../c4/source/) |

## Architecture → Business Flow → API → Source Code → Data

Routes below use the actual `/api` prefix and current controller paths. `FR`/`API` IDs establish requirement traceability, not proof that the full requirement passes. Backend contexts: account-profile, student-verification, skill-verification, live-class, wallet-ledger, schedule and admin-operation. Schedule/admin status scaffolds are not completed reminder/dashboard features. Module schemas remain isolated; identifiers between modules are logical references, not cross-schema foreign keys.

| Architecture / FR | Business flow | Current API | Source evidence | Actual persistence |
|---|---|---|---|---|
| Gateway → Account Profile; FR-001/017 | Register/login/refresh, account identity | `/api/auth/*` | [auth.controller](../../../apps/api/src/modules/account-profile/internal/adapter/in/web/auth.controller.ts), [Gateway JWT/proxy](../../../apps/gateway/src/proxy/api-proxy.service.ts) | Own account_profile schema; [migrations](../../../apps/api/src/modules/account-profile/internal/adapter/out/persistence/migrations/) |
| Student Verification; FR-002/019 | Presigned document, submission, admin decision/revocation | POST `/api/student-verifications/documents`, POST `/api/student-verifications`, POST `/:id/decision`, POST `/:id/revocation`, GET `/me` | [controller](../../../apps/api/src/modules/student-verification/internal/adapter/in/web/student-verification.controller.ts), [submit](../../../apps/api/src/modules/student-verification/internal/application/submit-student-verification.use-case.ts), [decision](../../../apps/api/src/modules/student-verification/internal/application/decide-student-verification.use-case.ts), [storage adapter](../../../apps/api/src/modules/student-verification/internal/adapter/out/storage/s3-document-store.ts) | student_verification.student_verifications, verification_documents, outbox_messages; private MinIO object bytes |
| Skill Verification; FR-003/004/018 | Evidence, history, expertise queue, claim, decision | POST `/api/skill-evidence`, GET `/:id/history`, POST `/:id/claim`, POST `/:id/decision`, GET `/api/verifiers/me/queue` | [evidence controller](../../../apps/api/src/modules/skill-verification/internal/adapter/in/web/skill-evidence.controller.ts), [Verifier controller](../../../apps/api/src/modules/skill-verification/internal/adapter/in/web/verifier.controller.ts), [decision](../../../apps/api/src/modules/skill-verification/internal/application/decide-skill-evidence.use-case.ts) | Own skill_verification schema; [migrations](../../../apps/api/src/modules/skill-verification/internal/adapter/out/persistence/migrations/) |
| Live Class; FR-005/007 | Verified/approved-skill publish gate, class edits, seat guard, Pending hold | POST `/api/classes`, POST `/api/classes/:id/bookings` (API-004/005) | [controller](../../../apps/api/src/modules/live-class/internal/adapter/in/web/classes.controller.ts), [create](../../../apps/api/src/modules/live-class/internal/application/create-class.use-case.ts), [book](../../../apps/api/src/modules/live-class/internal/application/book-class.use-case.ts), [seat repository](../../../apps/api/src/modules/live-class/internal/adapter/out/persistence/sql-booking-repository.ts) | live_class.classes, class_skills, bookings, teacher_verified, teacher_skill_approval; own-schema publish rights and row-locked seat allocation |
| Live Class → shared relay → Wallet Ledger; FR-009 | Confirm before asynchronous wallet settlement | POST `/api/classes/bookings/:bookingId/confirm`; booking.confirmed event | [confirm](../../../apps/api/src/modules/live-class/internal/application/confirm-booking.use-case.ts), [outbox](../../../apps/api/src/shared/messaging/), [settlement](../../../apps/api/src/modules/wallet-ledger/internal/application/record-booking-confirmed.use-case.ts), [wallet repository](../../../apps/api/src/modules/wallet-ledger/internal/adapter/out/persistence/sql-wallet-repository.ts) | live_class.bookings + outbox_messages; separate wallet_ledger.wallets, ledger_entries, processed_events; no distributed transaction |
| Wallet Ledger; FR-008/010 | Mock checkout, callback, balance/history | POST `/api/wallet/top-ups`, POST `/api/wallet/top-ups/callback`, GET `/api/wallet/balance`, GET `/api/wallet/history` | [controller](../../../apps/api/src/modules/wallet-ledger/internal/adapter/in/web/wallet.controller.ts), [callback](../../../apps/api/src/modules/wallet-ledger/internal/application/handle-top-up-callback.use-case.ts), [mock adapter](../../../apps/api/src/modules/wallet-ledger/internal/adapter/out/payment/mock-payment-gateway.ts) | wallet_ledger.top_up_intents, wallets, ledger_entries |
| Live Class → self-hosted Jitsi; FR-011 | Party/state/window check; locally signed token | POST `/api/classes/bookings/:bookingId/room-access` (API-008) | [room use case](../../../apps/api/src/modules/live-class/internal/application/request-room-access.use-case.ts), [JWT issuer](../../../apps/api/src/modules/live-class/internal/adapter/out/jitsi/jitsi-room-token-issuer.ts) | live_class.bookings, classes, room_access_incidents; media handled by Jitsi Docker services |
| Live Class → Wallet Ledger; FR-007/020 | Cancel/no-show, start/complete, expiry and scheduled-end sweep | POST `/api/classes/:id/cancel`, `/start`, `/complete`; POST `/api/classes/bookings/:bookingId/no-show` | [class repository](../../../apps/api/src/modules/live-class/internal/adapter/out/persistence/sql-class-repository.ts), [completion](../../../apps/api/src/modules/live-class/internal/application/complete-class.use-case.ts), [refund](../../../apps/api/src/modules/wallet-ledger/internal/application/refund-cancelled-booking.use-case.ts), [release](../../../apps/api/src/modules/wallet-ledger/internal/application/release-completed-class.use-case.ts) | live_class class/booking state + outbox; wallet_ledger idempotent refund/release ledger |
| Web / Expo client; FR-007 UI slice | Local mock booking | No backend booking HTTP call | [web mock](../../../apps/web/src/lib/booking/mock-gateway.ts), [mobile mock](../../../apps/mobile/src/infrastructure/mock/mock-booking-gateway.ts), [web health HTTP](../../../apps/web/src/lib/status.ts) | Local in-memory fixtures; health UI alone calls Gateway/API |

Publish-rights implementation anchors: [policy](../../../apps/api/src/modules/live-class/internal/domain/publish-policy.ts), [projector](../../../apps/api/src/modules/live-class/internal/adapter/out/persistence/sql-teacher-trust-projector.ts), [consumer mapping](../../../apps/api/src/modules/live-class/internal/application/project-teacher-trust.use-case.ts), [module bindings](../../../apps/api/src/modules/live-class/live-class.module.ts), [migration](../../../apps/api/src/modules/live-class/internal/adapter/out/persistence/migrations/1791072000005-CreateTeacherTrustProjection.ts).

## Code consistency and checkpoint gaps

- Gateway currently proxies internal HTTP/JSON, not RPC. Backend modules are components of one NestJS process, not independently deployed services.
- PostgreSQL uses TypeORM with seven schemas and module credentials. Payment checkout is `MockPaymentGateway`; MinIO and Jitsi are self-hosted Docker services. No live payment or payout provider is asserted.
- Web has health/status HTTP requests; its booking flow and the Expo booking flow use local mocks. A web upload/review/room UI and mobile resource/push integration are not evidenced by those sources. Backend upload support does not establish a working Frontend → Backend → Storage demo.
- FR-005 is now enforced: `CreateClassUseCase` reads own-schema trust and requires a verified student plus approval for every class skill. The current command carries skill IDs only, so the effective required level is `beginner`; the domain supports higher levels but the endpoint does not currently supply them. `UpdateClassUseCase` re-checks this gate only when `skillIds` is supplied. `BookClassUseCase` still does not establish verified-student eligibility.
- Account roles are `user | verifier | admin` (ADR-030). Learner/Teacher describe capabilities of the same ordinary user account. Public registration accepts only `user`; privileged identities are provisioned out of band (ADR-029).
- New event-fed Live Class tables are actually named `teacher_verified` and `teacher_skill_approval`, keyed by `account_id` (and `skill_id`). ADR-024 prose uses `teacher_trust`/`teacher_id`; this checkpoint follows the shipped migration/projector names. Projection updates use `occurred_at` ordering, so publish rights are eventually consistent.
- `confirmAndEmit` commits Confirmed + outbox before wallet settlement and does not check the expiry timestamp. Consumer retries/DLQ do not demonstrate AC-005 compensation. No permanent class-lock column is asserted: edit currently checks the **current count** of Confirmed bookings outside the update transaction.
- Class domain transitions declare Completed terminal, but `CancelClassUseCase` rejects only an already Cancelled class and `markCancelled` updates every non-Cancelled state. The Class state diagram shows this current implementation discrepancy.
- `full`, `draft`, `completed` and `disputed` names are not sufficient proof of implemented transitions. Class create publishes directly; no automatic Published → Full writer was found. Booking Completed/Disputed are declared but no transition handler is claimed. Student verification allows revocation from Pending or Approved and has no expiry.
- Chat, ratings, payout, admin dashboard, push notifications, five integrated client resources and 20–30 mobile APIs are not presented as completed. Health/status scaffold routes must not be counted as meaningful business endpoints merely to satisfy the >30 requirement.

## Reproduce

1. Validate `../c4/source/workspace.dsl` with Structurizr. Export the six keys `SystemContext`, `Containers`, `Deployment`, `BookingFlow`, `TeachingFlow`, `VerificationFlow` using its C4-PlantUML exporter into `../c4/source/structurizr-<key>.puml`.
2. Render from repository root with PlantUML 1.2026.8 (bundled C4 includes, no Windows-only theme):

```sh
plantuml -tsvg -o ../generated docs/diagrams/c4/source/structurizr-*.puml
plantuml -tpng -o ../generated docs/diagrams/c4/source/structurizr-*.puml
plantuml -tsvg -o ../generated docs/diagrams/checkpoint/source/*.puml
plantuml -tpng -o ../generated docs/diagrams/checkpoint/source/*.puml
pnpm verify
```

The Windows `plantuml-skill/render.py` path specified in AGENTS.md does not exist on this Mac and no installed counterpart was found. The local PlantUML executable is used for rendering; source and generated destinations are preserved.
