# Kế hoạch: Sẵn sàng bảo vệ MidTerm (Week 6)

> Trạng thái: **Kế hoạch đã chốt, chưa thực thi.**
> Ngày lập: 2026-10-12 · Baseline commit: `7354c31` (`main`, `pnpm verify` xanh — 1 warning dependency-cruiser có sẵn).
> Phạm vi: 3 mục tiêu người dùng yêu cầu — (1) tài liệu PDF định hướng cho thành viên nhóm, (2) Web phản chiếu Mobile, (3) đồng bộ doc + diagram.

---

## 0. Đánh giá hiện trạng (số liệu đã kiểm chứng)

### 0.1 Backend — ✅ vượt chỉ tiêu

| Chỉ tiêu checkpoint | Thực tế | Kết luận |
|---|---|---|
| > 30 meaningful API | 53 route handler − 14 scaffold (`/status`, `/status/advance` × 7 module) − 1 health = **38** | ✅ đạt |
| Modular monolith, hexagonal | 7 module, dependency-cruiser 779 module / 2226 dep, 0 error | ✅ đạt |
| Outbox + idempotent consumer (ADR-013) | `apps/api/src/shared/messaging` | ✅ đạt |
| TypeORM 7 schema, per-module credential (ADR-014) | `docker/postgres` + migrations | ✅ đạt |
| Test | 104 suite / 551 test PASS | ✅ đạt |

### 0.2 Frontend — ❌ lệch nhiều so với Mobile

Web có **8 trang dùng API thật/nửa thật** và **6 màn dùng mock hoàn toàn**:

| Màn web | Cơ chế dữ liệu hiện tại | File neo |
|---|---|---|
| `/{locale}/classes` (Marketplace) | ❌ `MockMarketplaceGateway` | `apps/web/src/app/[locale]/classes/page.tsx:6,25` |
| `/{locale}/classes/[id]` (Class detail) | ❌ `MockClassDetailGateway` | `apps/web/src/components/marketplace/ClassDetailContent.tsx:2` |
| Booking panel | ❌ `MockBookingGateway` | `apps/web/src/components/booking/booking-panel.tsx:6,57` |
| `/{locale}/bookings` (Dashboard) | ❌ `MockLearnerDashboardGateway` | `apps/web/src/app/[locale]/bookings/page.tsx:7` |
| `/{locale}/teach/classes/new` (Publish) | ❌ `MockTeacherPublishGateway` | `apps/web/src/app/[locale]/teach/classes/new/page.tsx:7` |
| `/{locale}/notifications` | ❌ hardcode trong component (913 dòng, 7 item giả) | `apps/web/src/app/[locale]/notifications/page.tsx:37` |
| `/{locale}/wallet/withdrawal` | ⚠️ đọc thật (`/wallet/balance`, `/auth/me`) nhưng nút rút tiền **không gọi API** | `apps/web/src/app/[locale]/wallet/withdrawal/page.tsx:16-27,295` |
| `/{locale}/bookings/review`, `/{locale}/bookings/[id]/review` | ❌ chưa nối API rating | — |

Nguyên nhân gốc: `packages/contracts` **đã có sẵn schema mobile** (`mobile-classes`, `mobile-class-detail`, `mobile-catalogue`, `mobile-my-bookings`, `mobile-ratings`, `mobile-notifications`) nhưng Web không dùng. Mobile đã có 13 gateway HTTP thật ở `apps/mobile/src/infrastructure/http/`.

→ **Hệ quả trình bày:** nếu demo Web + Mobile cạnh nhau, 6 màn sẽ lệch nhau rõ rệt (mock VNĐ tĩnh vs dữ liệu DB thật). Đây là rủi ro điểm lớn nhất ở mục Frontend 15% + Integration 10%.

### 0.3 Docs & Diagram — ❌ lệch so với code

| Tài liệu | Nói gì | Sự thật trong code |
|---|---|---|
| `docs/api/index.md` | 45 endpoint (8 dòng/module) | 53 handler; thiếu notification, notification-devices ×2, class-list, class-detail, my-bookings, ratings, skills |
| `docs/diagrams/checkpoint/README.md:45,53,60` | "Web + Expo dùng local mock; 20–30 mobile API **không** hoàn thành" | Mobile đã gọi HTTP thật (commit `963a8fe`); README lỗi thời |
| `docs/adr/ADR-015-mobile-client-expo.md` | Mobile mock-only | Sai — mobile có 13 gateway HTTP |
| `docs/plans/SkillSwap-SRS.md` §C.4 | Ghi chú "mock-only" cũ | Lỗi thời |
| `SkillSwap-SRS.md` | **Không có User Story**, không có screen list chuẩn | Người dùng đã nêu |
| `docs/diagrams/checkpoint/source/sequence-client-booking.puml` | Vẽ client gọi mock | Không còn đúng với mobile |
| Diagram state | `state-class.puml` ghi "Completed terminal" | `CancelClassUseCase`/`markCancelled` đi ngược — README:58-59 đã thừa nhận |

Đây chính là nhóm **"uncounted requirements"** trong PDF checkpoint: *"documents/diagrams must sync with implementation"*.

### 0.4 Rủi ro người dùng đã chỉ ra

- "requirement state that every member need to know what we are doing" — hiện **không có tài liệu nhập môn**; `ARCHITECTURE.md` rất dài và không đọc nổi cho người mới trong 15 phút.
- "srs do not have user story" — SRS chỉ có FR/BR/NFR/UC khô, không có góc nhìn người dùng.

---

## 1. Mục tiêu & tiêu chí hoàn thành

| # | Mục tiêu | Tiêu chí đạt (đo được) |
|---|---|---|
| G1 | Tài liệu PDF định hướng nhóm | 1 PDF ≤ 10 trang, đọc hết trong ≤ 15 phút, có: kiến trúc, lý do tổ chức filesystem, business rule chính, luồng demo |
| G2 | Web phản chiếu Mobile | **0** mock gateway còn sót trong luồng demo; mỗi màn web gọi cùng endpoint mà mobile gọi; bảng đối chiếu 17 màn khớp 1-1 |
| G3 | Đồng bộ doc + diagram | `docs/api/index.md` khớp 100% handler; ADR-015 + checkpoint README + SRS §C.4 hết câu "mock-only"; có User Story; diagram render lại |
| G4 | Gate xanh | `pnpm verify` PASS, không warning mới |

---

## 2. Phân kỳ (Phase) và commit

Quy ước commit (theo `githooks/commit-msg`): `type(scope): subject ≤72` + body giải thích "why".

---

### Phase 0 — Chốt baseline & tài liệu đối chiếu (0.5 ngày)

**Việc làm**
1. Tạo `docs/plans/2026-10-12-screen-parity-matrix.md` — bảng 17 màn, cột: `Màn | Web route | Mobile route | Endpoint(s) | Trạng thái Web | Trạng thái Mobile | Hành động`.
2. Chốt danh sách 17 màn (nguồn: SRS §3.1.1 + PRD §6.1–6.10):

| # | Màn | Web | Mobile |
|---|---|---|---|
| S1 | Landing / Home | `/{locale}` | `app/index.tsx` |
| S2 | Dashboard học viên | `/{locale}/bookings` | `(tabs)/schedule.tsx` |
| S3 | Marketplace | `/{locale}/classes` | `(tabs)/explore.tsx` |
| S4 | Chi tiết lớp | `/{locale}/classes/[id]` | `classes/[id].tsx` |
| S5 | Đăng nhập | `/{locale}/login` | `(auth)/login.tsx` |
| S6 | Đăng ký | `/{locale}/register` | `(auth)/register.tsx` |
| S7 | Ví | `/{locale}/wallet` | `(tabs)/wallet.tsx` |
| S8 | Nạp tiền / checkout | `/{locale}/classes/[id]/checkout`, `/classes/checkout` | trong `wallet.tsx` |
| S9 | Xác minh sinh viên | `/{locale}/verification` | `(features)/verification.tsx` |
| S10 | Kỹ năng / evidence | — (web thiếu) | `(features)/skills.tsx` |
| S11 | Rút tiền | `/{locale}/wallet/withdrawal` | `(tabs)/wallet.tsx` (tab rút) |
| S12 | Lớp của tôi / teaching | `/{locale}/instructor` | `(features)/teaching.tsx` |
| S13 | Đánh giá sau lớp | `/{locale}/bookings/[id]/review` | trong `schedule.tsx` |
| S14 | Phòng học Jitsi | `/{locale}/bookings/[id]/live` | trong `schedule.tsx` |
| S15 | Hồ sơ cá nhân | (dùng Navbar) | `(tabs)/profile.tsx` |
| S16 | Trạng thái hệ thống | `/{locale}/status` | — (không cần) |
| S17 | Thông báo | `/{locale}/notifications` | `(features)/notifications.tsx` |

**Commit:** `docs(plan): add screen parity matrix for web and mobile`

**Rủi ro:** 17 màn là **suy ra** từ docs (docs không có screen list) → cần ghi rõ giả định này trong matrix, để lúc bảo vệ giải thích được.

---

### Phase 1 — Web ↔ Mobile parity (trọng tâm, 3–4 ngày)

Chia nhỏ theo màn để mỗi commit là 1 đơn vị đánh giá được. Thứ tự theo mức rủi ro khi demo.

#### 1A. Marketplace + Class detail (S3, S4) — ưu tiên cao nhất

**Việc làm**
1. Tạo `apps/web/src/lib/marketplace/http-gateway.ts` implement **cùng interface** `MarketplaceGateway` như `MockMarketplaceGateway` (`search(query)` trả `MarketplacePage`).
   - Gọi `GET /api/classes` với `keyword`, `skillId`, `startDate/endDate`, `limit`, `cursor`; parse bằng `listClassesPageSchema` từ `@skillswap/contracts`.
   - Dùng `callApi()` + `unwrapEnvelope()` từ `apps/web/src/lib/api-client.ts` (đã có refresh-token + retry 401).
   - **Tái dùng logic mobile:** `apps/mobile/src/infrastructure/http/class-read-gateway.ts` — copy shape, đổi transport sang `callApi`.
2. Tạo `apps/web/src/lib/marketplace/http-class-detail.ts` gọi `GET /api/classes/:id`; parse `mobile-class-detail` schema.
3. Đổi `classes/page.tsx:25` và `MarketplaceClient.tsx:22` sang gateway mới; giữ `MockMarketplaceGateway` **chỉ cho test** (đổi import trong `.test.tsx`).
4. `ClassDetailContent.tsx` nhận gateway qua prop (giống `booking-panel.tsx` dùng `injected`), mặc định là HTTP.
5. Map field: `ClassListItemView.priceCredits` → VNĐ (`×1000`) tại tầng UI, không đổi sang float (BR-027).

**Commit:** `feat(web): fetch marketplace and class detail from live api`

**Kiểm thử:** cập nhật `apps/web/src/lib/marketplace/*.test.ts` (vitest) chạy trên HTTP gateway với `fetch` stub; giữ test mock song song để so hành vi filter/sort **giống hệt** (đây là bằng chứng parity).

#### 1B. Booking (S8) — rủi ro tiền

**Việc làm**
1. Tạo `apps/web/src/lib/booking/http-gateway.ts` implement `BookingGateway` (xem `apps/web/src/lib/booking/mock-gateway.ts` để lấy interface).
2. Gọi `POST /api/classes/:id/bookings` với header idempotency — **tái dùng `apps/web/src/lib/booking/idempotency.ts` đang có**.
3. Giữ nguyên `BookClassService` (`apps/web/src/lib/booking/service.ts`) — chỉ thay adapter, để không phá test hiện có.
4. Nút "Rút tiền" ở `wallet/withdrawal/page.tsx:295`: nối `POST` yêu cầu rút (nếu backend chưa có endpoint → **KHÔNG tạo endpoint mới**; thay bằng trạng thái "chưa khả dụng" trung thực, hoặc đưa vào backlog có ghi chú).

**Commit:** `feat(web): book classes through the live api`

**Lưu ý:** nếu phase này phát hiện backend thiếu endpoint cho rút tiền → tạo ADR nhỏ + không tự ý thêm schema cross-module.

#### 1C. Dashboard (S2) — độ phức tạp cao nhất

**Việc làm**
1. Tạo `apps/web/src/lib/dashboard/http-gateway.ts` implement `DashboardGateway` (interface ở `dashboard/types.ts`).
2. Ghép từ các endpoint thật đã có: `GET /api/classes/my-bookings` (booking + trạng thái), `GET /api/wallet/balance` (metric escrow), `GET /api/notifications` (đếm chờ), `GET /api/ratings` (đếm review chờ).
3. Các field **không có API** (`autoReleaseCountdownSeconds`, `CalendarDay[]`, `CharterEntry[]`): tính ở client từ `startsAt`/state — **đánh dấu `// derived` trong code**; không giả vờ có API.
4. Nếu backend muốn gộp 1 round-trip: ghi ADR trước, không tự thêm endpoint.

**Commit:** `feat(web): derive learner dashboard from live booking and wallet apis`

#### 1D. Notifications (S17)

**Việc làm**
1. Xoá mảng hardcode `notifications/page.tsx:37-195`; thay bằng `GET /api/notifications` (parse `mobile-notifications` schema).
2. "Đánh dấu đã đọc" → gọi endpoint mark-read tương ứng của mobile (đối chiếu `apps/mobile/src/infrastructure/http/notification-gateway.ts`).
3. Bỏ các khối trang trí sai sự thật: "WebSocket Gateway: Live", "Đồng bộ hóa 0.04s với RMIT Hub", "PRD §6.8 Realtime Event Stream" nếu không có bằng chứng — **thay bằng nhãn trung thực** ("Cập nhật khi tải trang").

**Commit:** `feat(web): render notification center from live api`

#### 1E. Review/Rating + Publish (S13, S12)

1. `bookings/[id]/review/page.tsx` → `POST /api/ratings` (schema `mobile-ratings`).
2. `teach/classes/new/page.tsx` → thay `MockTeacherPublishGateway` bằng `POST /api/classes` + `GET /api/skills` (giống `apps/mobile/app/(features)/teaching.tsx:27-42`).

**Commit:** `feat(web): publish classes and submit ratings via live api`

#### 1F. Dọn dẹp

1. Xoá hoặc di chuyển mock chỉ dùng cho demo vào `lib/**/__fixtures__/`; giữ mock nào còn dùng cho test.
2. `apps/web/src/lib/messages-parity.test.ts` phải xanh (vn/en không lẫn).
3. Bổ sung test parity: cùng query → HTTP gateway và mock gateway trả cùng tập item.

**Commit:** `refactor(web): confine mock gateways to tests and fixtures`

**Rủi ro chính Phase 1**
- Backend thiếu endpoint cho một số field dashboard → giải pháp: derived ở client + ghi chú, **không bịa endpoint**.
- Web đang vi/en lẫn trong `notifications/page.tsx` (hardcode tiếng Việt) → phải đưa vào next-intl ở 1D.
- `pnpm verify` chạy chậm (test api ~70s) → chạy `pnpm --filter @skillswap/web test` khi lặp nhanh.

---

### Phase 2 — Tài liệu PDF định hướng nhóm (1 ngày, có thể song song Phase 1)

**Sản phẩm:** `docs/handbook/SkillSwap-Team-Handbook.pdf` (~8–10 trang) sinh từ Markdown.

**Cấu trúc bắt buộc (giữ ngắn, mỗi mục 1 trang)**

| Trang | Nội dung | Nguồn |
|---|---|---|
| 1 | SkillSwap là gì, 3 câu; ai dùng (learner/teacher/verifier/admin) | `PRODUCT.md`, `ADR-030` |
| 2 | Sơ đồ container C1 (1 hình, không chữ nhỏ) | `docs/diagrams/c4/generated/structurizr-Containers.svg` |
| 3 | **Vì sao filesystem như vậy**: gateway/api/web/mobile/contracts, `ARCHITECTURE.md` là hợp đồng cứng, ADR ghi quyết định, đổi thì thêm ADR | `ARCHITECTURE.md`, `docs/adr/` |
| 4 | Hexagonal trong 1 hình: `domain / application / adapter / internal` + luật dependency-cruiser | `apps/api/src/modules/*` |
| 5 | **Business rule cốt lõi**: 1 credit = 1.000 VND (BR-027); phí 1000 bps chia 90/10; escrow giữ tiền đến khi hoàn tất (FR-009) | `AGENTS.md`, SRS |
| 6 | **Main flow 1**: publish lớp — verified student + skill approved (FR-005) | `docs/diagrams/checkpoint/generated/activity-publish.svg` |
| 7 | **Main flow 2**: đặt lớp → escrow → confirm → settlement (FR-007/009) | `sequence-booking.svg` + `state-booking.svg` |
| 8 | **Main flow 3**: xác minh sinh viên & evidence (FR-002/003) | `sequence-student-verification.svg` |
| 9 | 7 schema, mỗi module 1 schema + credential riêng; không join chéo schema | `ADR-014` |
| 10 | Checklist demo 15 phút + tài khoản seed | `docs/diagrams/checkpoint/README.md` |

**Việc làm**
1. Viết Markdown trong `docs/handbook/README.md` (nguồn duy nhất, dễ sửa).
2. Sinh PDF bằng script **tái lập được**: `scripts/gen-handbook.mjs` (Markdown → PDF, nhúng SVG đã render sẵn).
3. Thêm script `pnpm docs:handbook`.
4. **Quy tắc tự kiểm:** PDF không được chứa câu nào không truy được về 1 file nguồn; mỗi hình ghi rõ đường dẫn nguồn.

**Bàn giao:** người dùng nhận PDF tại `docs/handbook/SkillSwap-Team-Handbook.pdf` (và bản Markdown cùng thư mục để sửa tiếp).

**Commit:** `docs(handbook): add concise onboarding handbook for the team`

**Rủi ro:** PDF dễ phình → chốt cứng "mỗi mục 1 trang", hình dùng SVG hiện có thay vì vẽ mới.

---

### Phase 3 — Đồng bộ Docs (1 ngày)

#### 3A. Sinh lại API docs

1. Chạy `pnpm docs:api` → cập nhật `docs/api/index.md` (45 → đúng số handler) và các file module.
2. Kiểm tra tay: mỗi route trong `*.controller.ts` xuất hiện đúng 1 lần trong docs; không còn nhóm "endpoints: 2" sai cho notification/ratings/classes-phụ.
3. Nếu `gen-api-docs.cjs` bỏ sót module → sửa script (không sửa tay docs, vì file ghi "do not edit by hand").
4. Thêm `docs/api/notifications.md`, `docs/api/ratings.md` nếu thiếu.

**Commit:** `docs(api): regenerate api reference from the live openapi document`

#### 3B. Sửa các câu đã lỗi thời (chính xác từng dòng)

| File | Dòng | Sửa |
|---|---|---|
| `docs/adr/ADR-015-mobile-client-expo.md` | phần mô tả "mock-only" | Thêm mục **Update** ghi: mobile chuyển sang HTTP gateway thật từ `963a8fe`; liệt kê 13 gateway |
| `docs/diagrams/checkpoint/README.md` | 45, 53, 60 | Viết lại: Web mock hay thật theo Phase 1; mobile gọi HTTP thật; nêu rõ số endpoint meaningful |
| `docs/plans/SkillSwap-SRS.md` §C.4 | ghi chú mock-only | Cập nhật trạng thái tích hợp mới |
| `docs/diagrams/checkpoint/source/sequence-client-booking.puml` | vẽ client-mock | Vẽ lại: Mobile → Gateway → API thật; Web theo trạng thái sau Phase 1 |

**Nguyên tắc:** ADR **append-mostly** — thêm mục "Update" ở cuối, không viết lại lịch sử.

**Commit:** `docs(adr): record the mobile http integration as delivered`

#### 3C. Bổ sung User Story vào SRS

1. Thêm mục **§3.1.2 User Stories** — mỗi FR Confirmed có 1 user story dạng:
   *"Là **học viên**, tôi muốn **xem lớp theo kỹ năng**, để **chọn lớp phù hợp**."* + AC liên kết ID sẵn có.
2. **Không đổi số ID** (`FR`/`BR`/`NFR`) — chỉ tham chiếu.
3. Thêm mục **§3.1.3 Screen inventory** = bảng 17 màn ở Phase 0, để lần sau không phải suy diễn.

**Commit:** `docs(srs): add user stories and screen inventory`

---

### Phase 4 — Đồng bộ Diagram (1 ngày)

**Việc làm**
1. Sửa `docs/diagrams/c4/source/workspace.dsl` + 6 file `structurizr-*.puml` nếu mô tả client sai (đặc biệt container "Web App" / "Mobile App" và quan hệ tới Gateway).
2. Sửa `state-class.puml` để khớp sự thật code (`README.md:58-59`): `markCancelled` hiện chuyển mọi trạng thái ≠ Cancelled, Completed chưa terminal trong thực thi.
3. Sửa `sequence-client-booking.puml` theo 3B.
4. Render lại vào `docs/diagrams/c4/generated` + `docs/diagrams/checkpoint/generated`; **xuất cả SVG và PNG**.
5. Kiểm tra mọi mention ORM đúng là "TypeORM" (không "TypeORM/Prisma"), trừ câu lịch sử trong `ARCHITECTURE.md`/`ADR-014`.
6. Ghi ngày + commit hash vào đầu `docs/diagrams/checkpoint/README.md` (thay `166ee3a` bằng hash mới).

**Commit:** `docs(diagrams): re-render c4 and uml views against current code`

**Rủi ro:** render cần PlantUML 1.2026.8 — `AGENTS.md` trỏ `plantuml-skill/render.py` trên máy này **không tồn tại** (README:75). Phải xác nhận binary PlantUML trước khi bắt đầu; nếu không có thì cài hoặc dùng PlantUML server.

---

### Phase 5 — Kiểm tra tổng & diễn tập (0.5 ngày)

1. `pnpm verify` PASS, 0 warning mới.
2. `pnpm db:demo` → chạy end-to-end: login → marketplace (dữ liệu DB thật) → đặt lớp → escrow → dashboard.
3. Diễn tập theo đúng "7-step prep process" trong PDF checkpoint; bấm giờ ≤ 15 phút.
4. Chuẩn bị sẵn câu trả lời cho 3 điểm yếu **đã biết** (trung thực, không giấu):
   - Gateway proxy HTTP/JSON, không phải RPC; các module là component trong 1 NestJS process.
   - `BookClassUseCase` chưa kiểm tra điều kiện verified-student.
   - `confirmAndEmit` chưa kiểm tra timestamp hết hạn; chưa có cột khóa lớp vĩnh viễn.

**Commit:** `chore: align demo script with parity-ready clients`

---

## 3. Thứ tự & phụ thuộc

```
Phase 0 (matrix)
   ├─────────────► Phase 1A → 1B → 1C → 1D → 1E → 1F   (Web parity)
   ├─────────────► Phase 2 (Handbook PDF)               (song song được)
   └──► Phase 3 (Docs) ──► Phase 4 (Diagrams) ──► Phase 5 (Verify + diễn tập)
```

- Phase 3/4 phải chạy **sau** Phase 1, nếu không tài liệu sẽ lại lỗi thời ngay.
- Phase 2 độc lập → giao cho thành viên chưa đụng code, đúng tinh thần "every member knows what we are doing".

**Ước lượng tổng:** ~7–8 ngày công; tối thiểu để không mất điểm: **Phase 0 + 1A + 1D + 3A + 3B** (~3 ngày).

---

## 4. Truy vết chỉ tiêu checkpoint

| Tiêu chí | Trọng số | Trước | Sau kế hoạch |
|---|---|---|---|
| C4 diagrams | 15% | 6 view, mô tả client sai | Phase 4 sửa + render lại |
| UML | 15% | 14 file; state-class lệch code | Phase 4 |
| Backend | 25% | 38 endpoint ✅ | giữ nguyên, không rủi ro |
| Frontend | 15% | 8/17 màn thật | 17/17 (Phase 1) |
| Mobile | 20% | 12/17 màn thật ✅ | giữ nguyên |
| Integration | 10% | lệch web/mobile | Phase 1 + Phase 5 |
| **Uncounted: docs sync** | — | ❌ sai nhiều chỗ | Phase 2/3/4 |
| **Uncounted: thành viên hiểu dự án** | — | ❌ không có | Phase 2 |

---

## 5. Rủi ro & đối sách

| Rủi ro | Mức | Đối sách |
|---|---|---|
| Web thiếu endpoint cho field dashboard | Cao | Derive ở client + ghi chú `// derived`; ADR nếu cần endpoint mới |
| Trộn vn/en khi sửa notifications | Trung | Đưa vào next-intl ngay ở 1D; `messages-parity.test.ts` là chốt |
| PlantUML không có trên máy | Trung | Xác nhận trước Phase 4; fallback PlantUML server |
| PDF handbook quá dài | Trung | Giới hạn cứng 10 trang, mục nào quá thì cắt chữ giữ hình |
| Sửa ADR làm mất lịch sử | Cao | Chỉ thêm mục "Update", không xoá câu cũ |
| verify chậm làm giảm số lần chạy | Thấp | Lặp nhanh bằng test theo từng app |

---

## 6. Việc KHÔNG làm (chống phình phạm vi)

- Không thêm endpoint mới trừ khi có ADR.
- Không đổi `ARCHITECTURE.md`.
- Không đổi mô hình tiền (integer VND), không dùng float.
- Không đổi cấu trúc module/hexagonal.
- Không xây tính năng mới (chat, payout thật, push notification) — chỉ đồng bộ những gì đã có.
- Không viết lại ADR cũ.
