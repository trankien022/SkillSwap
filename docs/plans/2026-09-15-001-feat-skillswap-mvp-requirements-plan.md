---
title: SkillSwap MVP Software Development Blueprint
type: feat
date: 2026-09-15
topic: skillswap-mvp-requirements
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
status: Ready for Review
owner: Group 4
version: 0.2
---

# SkillSwap MVP Software Development Blueprint

**Status:** Ready for Review

**Version:** 0.2

**Owner:** Group 4

**Last updated:** 2026-09-15

**Approval decision:** Pending Product Owner and Engineering/QA review

## 1. Executive Summary

- **Business problem:** Sinh viên muốn học kỹ năng thực tế với chi phí phù hợp nhưng thiếu một kênh đáng tin cậy để tìm, đánh giá và thanh toán cho người dạy là sinh viên có năng lực.
- **Desired outcome:** Sinh viên đã được xác minh có thể tìm, đặt và tham gia lớp trực tuyến; Teacher đã được thẩm định có thể mở lớp và nhận thu nhập qua ledger credit có thể truy vết.
- **Proposed success metrics:** Số Teacher đã xác minh, tỷ lệ tìm kiếm dẫn đến booking, tỷ lệ lớp hoàn thành và tỷ lệ giao dịch ledger thành công. Giá trị mục tiêu phải được Product Owner phê duyệt trong OQ-010 trước khi pilot.
- **Recommended direction:** MVP web mobile-first và ứng dụng mobile Expo/React Native (ADR-015), xác minh thủ công, lớp trực tuyến qua Jitsi, chat nội bộ và thanh toán bằng credit.
- **Product authority:** `docs/intent.md` là nguồn nghiệp vụ chính. Nội dung suy ra để hoàn thiện đặc tả được ghi là `Proposed`; nội dung chưa đủ căn cứ được ghi là `Open Question`.

## 2. Scope

### In scope

- Web responsive mobile-first cho Learner, Teacher, Verifier và Administrator.
- Ứng dụng mobile Expo/React Native (iOS/Android) cho Learner và Teacher — Increment 6 (ADR-015).
- Xác minh sinh viên và năng lực Teacher bằng quy trình thủ công.
- Marketplace lớp trực tuyến, booking, ví credit, Jitsi, chat và rating/comment.
- Nạp và rút tiền thông qua một payment gateway được chọn ở bước thiết kế.
- Audit trail cho xác minh, booking và giao dịch tài chính.

### Out of scope

- Ứng dụng desktop/tablet native.
- AI matching hoặc recommendation engine.
- Automatic refund.
- Tích hợp cơ sở dữ liệu sinh viên của trường hoặc xác minh tự động bằng email trường.
- Ngôn ngữ ngoài tiếng Việt và tiếng Anh.
- Hệ thống report/moderation chuyên biệt, hàng đợi report hoặc khóa tài khoản tự động.
- Lớp học ngoại tuyến.

## 3. Stakeholders and Users

| ID | Role | Responsibility | Decision/approval |
|---|---|---|---|
| ST-001 | Learner | Tìm kiếm, đặt, thanh toán, tham gia và đánh giá lớp. | Xác nhận trải nghiệm học và lỗi nghiệp vụ. |
| ST-002 | Teacher | Nộp bằng chứng năng lực, mở lớp, giảng dạy và rút thu nhập. | Xác nhận quy trình lớp và payout. |
| ST-003 | Verifier | Thẩm định năng lực/chứng chỉ theo chuyên môn được giao. | Phê duyệt hoặc từ chối hồ sơ chuyên môn. |
| ST-004 | Administrator | Duyệt tư cách sinh viên, quản lý Verifier và vận hành nền tảng. | Phê duyệt vận hành và xử lý ngoại lệ thủ công. |
| ST-005 | Group 4 Product Owner | Sở hữu phạm vi, ưu tiên và các quyết định sản phẩm. | Phê duyệt Blueprint và Open Questions. |
| ST-006 | Engineering/QA | Thiết kế, triển khai và cung cấp bằng chứng kiểm thử. | Xác nhận Solution Ready và Delivery Ready. |
| SYS-001 | Payment gateway | Xử lý top-up, payout và callback giao dịch. | Hợp đồng tích hợp phải được xác nhận trước triển khai. |
| SYS-002 | Jitsi | Cung cấp phòng học trực tuyến có kiểm soát truy cập. | Cơ chế secure domain/JWT phải được xác nhận ở thiết kế. |

## 4. Assumptions, Constraints and Open Questions

### Assumptions and constraints

| ID | Type | Statement | Owner | Status |
|---|---|---|---|---|
| A-001 | Assumption | Người dùng có tài khoản ngân hàng hoặc ví điện tử phù hợp với gateway được chọn. | Product Owner | Unconfirmed |
| A-002 | Assumption | Người dùng chấp nhận tải giấy tờ chứng minh tư cách sinh viên. | Product Owner | Unconfirmed |
| A-003 | Assumption | Có đủ Verifier phù hợp chuyên môn trước khi mở Teacher onboarding. | Administrator | Unconfirmed |
| A-004 | Assumption | Kết nối Internet của người dùng đủ ổn định cho Jitsi. | Product Owner | Unconfirmed |
| C-001 | Constraint | MVP không tích hợp dữ liệu sinh viên của trường; xác minh hoàn toàn thủ công. | Product Owner | Confirmed |
| C-002 | Constraint | MVP chỉ hỗ trợ lớp trực tuyến. | Product Owner | Confirmed |
| C-003 | Constraint | Mỗi lớp kéo dài từ 30 phút đến 3 giờ và phải được đặt trước ít nhất 24 giờ. | Product Owner | Confirmed |
| C-004 | Constraint | Tỷ giá khởi điểm là 1 credit = 1.000 VND; mọi thay đổi phải được phê duyệt và version hóa trước khi áp dụng. | Product Owner | Confirmed default; change policy open |
| C-005 | Constraint | Phí nền tảng là 10% trên mỗi giao dịch mua lớp. | Product Owner | Confirmed |

### Open Questions requiring approval

| ID | Decision required | Owner | Affects | Required by |
|---|---|---|---|---|
| OQ-001 | Cấu trúc taxonomy kỹ năng và cấp tìm kiếm. | Product Owner | FR-003, FR-005, FR-006 | Before implementation planning |
| OQ-002 | Teacher tự đặt giá, dùng khung giá hay mô hình kết hợp. | Product Owner | FR-005, FR-007–FR-009 | Before implementation planning |
| OQ-003 | Chính sách hủy, no-show, tranh chấp, hoàn tiền thủ công và workflow Administrator thực thi các quyết định này. | Product Owner + Administrator | FR-007, FR-009–FR-011, FR-013 | **Resolved (2026-10-08)** — xem AC-022–AC-027: hoàn tiền chỉ bằng credit ví nội bộ; không có chính sách hủy booking; Teacher no-show = không tham gia 15 phút đầu → hoàn credit, chưa phạt; Learner no-show không tự động; Pending giữ chỗ, hết hạn ~15 phút → auto-cancel; Confirmed→Cancelled hoàn credit. |
| OQ-004 | Ngưỡng rating, số đánh giá tối thiểu và cách khôi phục hiển thị. | Product Owner | FR-006, FR-013 | Before implementation planning |
| OQ-005 | Điều kiện, giới hạn, phí và thời gian xử lý withdrawal. | Product Owner + Finance | FR-010, FR-014 | **Resolved một phần (2026-10-09, phạm vi FR-008)** — chỉ tài khoản active được nạp tiền; tài khoản suspended bị từ chối (ADR-017). Giới hạn/phí/SLA rút tiền còn mở cho FR-014. |
| OQ-006 | Khi nào khoản 90% của từng booking chuyển từ pending sang available một lần; cách xử lý chargeback/reversal và nguồn bù sau payout. | Product Owner + Finance | FR-008, FR-009, FR-014 | **Resolved (2026-10-10)** — chargeback/reversal ghi bút toán đảo kèm trace id (ADR-017); thu nhập Teacher giữ ở `pending_credits` khi settle, release **khi lớp hoàn tất** (ADR-018). Hoàn tất = Teacher đã dạy lớp: auto-complete tại `starts_at + duration` với basis `scheduled_end` (hoặc `teacher_ended`), **trừ khi** Teacher no-show (FR-007) khiến lớp bị Cancelled — Learner no-show không ảnh hưởng (ADR-021). |
| OQ-007 | Lớp là một-một, lớp nhóm hay cả hai; sức chứa, quy tắc giữ/nhả chỗ và kết quả khi nhiều Learner đồng thời đặt chỗ cuối. | Product Owner | FR-005, FR-007 | **Resolved (2026-10-08)** — xem AC-028–AC-030: Teacher tự nhập sức chứa số nguyên ≥ 1 (1 = 1-1, >1 = nhóm), từ chối 0/âm; Pending và Confirmed đều giữ chỗ; lớp Full khi đạt sức chứa; chỗ chỉ nhả khi booking Cancelled (MVP: Pending hết hạn ~15 phút); tranh chỗ cuối bảo vệ bằng khóa dòng/duy nhất. |
| OQ-008 | Thời hạn hiệu lực xác minh sinh viên, thời hạn lưu/xóa giấy tờ, và quy tắc cascade hoặc grandfather khi Student/Verifier hết hiệu lực hoặc bị thu hồi đối với SkillEvidence, lớp đã công bố, booking, quyền vào phòng, thu nhập pending và payout. | Product Owner + Security | FR-002–FR-005, FR-007, FR-011, FR-014, NFR-004 | **Điều khoản room-access đã xử lý (2026-10-10)** — quyền vào phòng được kiểm tra lại mỗi request (đúng bên + booking confirmed + cửa sổ thời gian) với JWT ngắn hạn, nên lớp bị hủy/đổi lịch hoặc trạng thái người dùng thay đổi sẽ cascade ngay; MVP không có grandfather (ADR-020). **Điều khoản storage/validity do developer quyết (2026-10-10, phạm vi FR-002, ADR-023)** — (1) **không hết hạn**: xác minh đã duyệt không hết hạn trong MVP; (2) **chặn (block)**: nộp mới bị từ chối khi đang có xác minh `pending`/`approved` (SR-BR-011), không supersede; (3) **giữ (keep)**: bản ghi xác minh được lưu, không xóa trong MVP; (4) **upload**: giấy tờ được tải lên và lưu bằng **object storage S3 kèm metadata trong Postgres**, kiểm tra loại/kích thước, không bao giờ ghi log (NFR-004/008). **Điều khoản cascade/expiry** còn mở cho FR-019. |
| OQ-009 | Chat cảnh báo, chặn hay chỉ ghi nhận khi phát hiện thông tin liên hệ cá nhân. | Product Owner | FR-012 | Before implementation planning |
| OQ-010 | Giá trị mục tiêu cho bốn success metrics và phạm vi trường pilot. | Product Owner | Product rollout | Before pilot planning |
| OQ-011 | Payment gateway nào đáp ứng top-up, payout, webhook, reconciliation và reversal. | Engineering + Finance | FR-008, FR-014 | **Resolved (2026-10-09, phạm vi MVP)** — tích hợp mock gateway sau port `PaymentGateway`, webhook ký HMAC-SHA256, `top_up_intents` idempotent và status đơn điệu; chọn vendor thật để sau (ADR-017). Payout (FR-014) còn mở. |
| OQ-012 | Quy tắc và độ chính xác làm tròn commission; tính phí một lần, thu nhập Teacher bằng giá trừ phí. | Product Owner + Finance | FR-009, FR-014 | **Resolved (2026-10-09)** — `fee = floor(price × feeBps / 10000)`, `teacher = price − fee` (phần dư về Teacher); bất biến `teacher + fee == price` giữ nguyên với số nguyên (ADR-018). |

## 5. Process Analysis

| Step | Current state | Future state | Actor/system | Rule or exception |
|---|---|---|---|---|
| 1 | Sinh viên khó chứng minh danh tính trong marketplace ngang hàng. | Người dùng nộp tên trường và giấy tờ; Administrator duyệt thủ công. | Student, Administrator | Từ chối phải có lý do; hiệu lực xác minh theo OQ-008. |
| 2 | Năng lực người dạy chưa có bên chuyên môn xác nhận. | Teacher nộp bằng chứng; Verifier phù hợp chuyên môn review. | Teacher, Verifier | Administrator không thay thế quyết định chuyên môn. |
| 3 | Lớp học và giá chưa có kênh chuẩn hóa. | Teacher đã xác minh công bố lớp cho kỹ năng được duyệt. | Teacher | Giá theo OQ-002; sức chứa đã resolved (OQ-007; AC-028–AC-030). |
| 4 | Booking và thanh toán dễ đứt traceability. | Hệ thống kiểm tra điều kiện, ghi booking và ledger nguyên tử. | Learner, Wallet | Không đủ số dư, hết chỗ hoặc dưới 24 giờ thì không trừ credit. |
| 5 | Thu nhập và tranh chấp chưa có quy trình chung. | Tiền Teacher được theo dõi theo trạng thái pending/available và payout. | Wallet, Teacher, Administrator | Release, chargeback theo OQ-006; chính sách hủy/hoàn tiền đã resolved (OQ-003; AC-022–AC-027). |
| 6 | Việc học và phản hồi diễn ra rời rạc. | Người tham gia vào phòng Jitsi, chat nội bộ và rating sau lớp. | Learner, Teacher, Jitsi | Chỉ thành viên booking hợp lệ được truy cập. |

## 6. Requirements

### Functional requirements

| ID | Type | Requirement | Priority | Source | Status |
|---|---|---|---|---|---|
| FR-001 | Functional | Hệ thống phải cho phép sinh viên tạo, đăng nhập và quản lý một tài khoản dùng cho Learner và đăng ký Teacher. | Must | `docs/intent.md` | Confirmed |
| FR-002 | Functional | Hệ thống phải cho phép sinh viên khai báo tên trường và tải giấy tờ để Administrator phê duyệt hoặc từ chối kèm lý do. | Must | `docs/intent.md` | Confirmed; retention open |
| FR-003 | Functional | Hệ thống phải cho phép ứng viên Teacher nộp kỹ năng, chứng chỉ hoặc bằng chứng năng lực; cơ chế nộp lại sau khi bị từ chối là đề xuất chờ duyệt. | Must | `docs/intent.md` + Proposed | Confirmed core; resubmission Proposed; taxonomy open |
| FR-004 | Functional | Hệ thống phải cho phép Administrator mời, gán chuyên môn, đình chỉ hoặc thu hồi Verifier; chỉ Verifier phù hợp mới được duyệt hồ sơ Teacher. | Must | `docs/intent.md` | Confirmed responsibility; lifecycle proposed |
| FR-005 | Functional | Chỉ Teacher đã được xác minh được tạo và công bố lớp trực tuyến với kỹ năng, mô tả, lịch, thời lượng, giá và quy tắc sức chứa đã được duyệt. | Must | `docs/intent.md` | Confirmed; price/capacity open |
| FR-006 | Functional | Learner phải có thể duyệt và tìm kiếm lớp đang mở theo thông tin lớp và hồ sơ Teacher. | Must | `docs/intent.md` | Confirmed; taxonomy open |
| FR-007 | Functional | Learner chỉ có thể đặt lớp còn khả năng nhận booking, bắt đầu sau ít nhất 24 giờ và kéo dài từ 30 phút đến 3 giờ. | Must | `docs/intent.md` | Confirmed; capacity/refund open |
| FR-008 | Functional | Người dùng phải có thể nạp tiền qua gateway theo tỷ giá áp dụng cho giao dịch; xử lý callback đúng một lần là kiểm soát kỹ thuật đề xuất chờ Engineering duyệt. | Must | `docs/intent.md` + Proposed | Confirmed core; idempotent callback Proposed; gateway open |
| FR-009 | Functional | Khi Learner mua lớp, hệ thống phải ghi nợ toàn bộ giá lớp và phân bổ 90% cho Teacher, 10% phí nền tảng; bút toán nguyên tử là thiết kế đề xuất và trạng thái khoản Teacher theo OQ-006. | Must | `docs/intent.md` + Proposed | Confirmed split; atomicity Proposed; release timing open |
| FR-010 | Functional | Chủ ví phải xem được số dư và lịch sử nạp, thanh toán, thu nhập, phí và withdrawal; hiển thị reversal là đề xuất phụ thuộc contract gateway. | Must | `docs/intent.md` + Proposed | Confirmed core; reversal history Proposed |
| FR-011 | Functional | Learner và Teacher của booking phải có thể truy cập đúng phòng Jitsi; giới hạn quyền theo booking và cửa sổ thời gian là kiểm soát đề xuất chờ Engineering duyệt. | Must | `docs/intent.md` + Proposed | Confirmed core; access controls Proposed |
| FR-012 | Functional | Các bên thuộc lớp phải có chat nội bộ; người ngoài không được truy cập và hành vi chia sẻ liên hệ tuân theo OQ-009. | Should | `docs/intent.md` | Confirmed; enforcement open |
| FR-013 | Functional | Sau lớp, Learner phải có thể rating/comment; điều kiện booking hợp lệ, giới hạn một lần và ảnh hưởng hiển thị là đề xuất/chính sách chờ OQ-004. | Must | `docs/intent.md` + Proposed | Confirmed core; eligibility/uniqueness Proposed; threshold open |
| FR-014 | Functional | Teacher phải có thể yêu cầu rút thu nhập qua gateway; giữ credit trong ledger cùng request trước payout, timeout giữ tiền đến khi đối soát; giới hạn/phí/release/reversal vẫn theo OQ-005/OQ-006, contract gateway theo OQ-011. | Must | `docs/intent.md` + Proposed | Confirmed core; payout controls Proposed; policy/gateway open |
| FR-015 | Functional | Administrator phải có bảng điều khiển tổng hợp gồm hàng đợi xác minh sinh viên, hàng đợi Verifier theo domain, danh sách tranh chấp/khóa tài khoản và log audit có thể lọc theo actor, thời gian và loại hành động. | Must | `docs/intent.md` | Confirmed |
| FR-016 | Functional | Hệ thống phải gửi thông báo khi hồ sơ xác minh có kết quả, booking được xác nhận/hủy, lớp sắp bắt đầu, giao dịch ví hoàn tất và withdrawal có kết quả. | Should | `docs/intent.md` | Confirmed |
| FR-017 | Functional | Learner phải thấy rõ trạng thái tài khoản của mình và lý do nếu bị từ chối, ngay trên màn hình chính. | Must | `docs/intent.md` | Confirmed |
| FR-018 | Functional | Teacher phải xem được lịch sử quyết định cho từng phiên bản bằng chứng năng lực đã nộp, không chỉ trạng thái mới nhất; bằng chứng đã submit bị khóa chỉnh sửa, thay đổi phải tạo phiên bản mới có audit trail. | Must | `docs/intent.md`, BRD BR-014 | Confirmed |
| FR-019 | Functional | Hệ thống phải hỗ trợ re-verification và tự động hạ quyền truy cập khi trạng thái xác minh sinh viên hết hiệu lực hoặc bị thu hồi, bao gồm cascade tới các quyền được cấp theo trạng thái VERIFIED. | Must | BRD BR-006 | Confirmed; policy open (OQ-008) |
| FR-020 | Functional | Mỗi Class trong MVP là một buổi học có lịch; hệ thống quản lý Published/Full → In progress → Completed/Cancelled, lưu thời điểm/căn cứ hoàn tất và chỉ mở rating/giải ngân khi đáp ứng điều kiện tương ứng. | Must | BRD BR-042–BR-043 | Confirmed core; completion/release rule open (OQ-006) |

### Business rules

Bảng ngắn gọn theo SRS (namespace `SR-BR-*`). Quy tắc nghiệp vụ chuẩn (BR-001–BR-070) xem BRD §7; cột cuối ánh xạ về ID chuẩn.

| ID | Quy tắc | Governs | Quy tắc BRD chuẩn |
|---|---|---|---|
| SR-BR-001 | Administrator xét duyệt thủ công tư cách sinh viên từ tên trường và giấy tờ tải lên. | FR-002 | BR-002, BR-003, BR-005 |
| SR-BR-002 | Chỉ Teacher có kỹ năng được Verifier phù hợp chuyên môn duyệt mới được mở lớp cho kỹ năng đó. | FR-003–FR-005 | BR-008, BR-011, BR-015 |
| SR-BR-003 | Mỗi lớp kéo dài tối thiểu 30 phút và tối đa 3 giờ. | FR-005, FR-007 | BR-016, BR-017 |
| SR-BR-004 | Booking phải được tạo ít nhất 24 giờ trước giờ bắt đầu. | FR-007 | BR-021 |
| SR-BR-005 | Tỷ giá khởi điểm là 1 credit = 1.000 VND; giao dịch lưu tỷ giá đã áp dụng để audit. | FR-008, FR-010, FR-014 | BR-027 |
| SR-BR-006 | Phí nền tảng là 10% giá lớp; 90% còn lại được phân bổ cho Teacher theo trạng thái settlement. | FR-009, FR-014 | BR-034, BR-035, BR-036 |
| SR-BR-007 | MVP chỉ hỗ trợ lớp học trực tuyến. | FR-005, FR-011 | BR-018 |
| SR-BR-008 | Giao tiếp phục vụ lớp học diễn ra trong nền tảng; cách thực thi cấm chia sẻ liên hệ theo OQ-009. | FR-012 | BR-055, BR-056 |
| SR-BR-009 | Hồ sơ chất lượng thấp bị giảm hiển thị theo ngưỡng được phê duyệt. | FR-006, FR-013 | BR-053, BR-054 |
| SR-BR-010 | Teacher không được tự đặt hoặc tự đánh giá lớp của mình. | FR-007, FR-013 | BR-068 |
| SR-BR-011 | Một tài khoản chỉ có tối đa một xác minh sinh viên hiệu lực tại một thời điểm. | FR-002 | BR-070 |
| SR-BR-012 | Credit không được chuyển thành tiền mặt ngoài quy trình rút tiền chính thức của Teacher. | FR-014 | BR-069 |

## 7. Use Cases and User Stories

### UC-001: Verify a student

- **Actor:** Student, Administrator.
- **Trigger:** Người dùng yêu cầu xác minh tư cách sinh viên.
- **Preconditions:** Người dùng có tài khoản và giấy tờ phù hợp.
- **Main flow:** Nộp tên trường và giấy tờ → hồ sơ Pending → Administrator review → Approved.
- **Alternate/error flows:** Tệp không hợp lệ bị từ chối; hồ sơ bị Reject phải có lý do; người dùng được sửa và nộp lại.
- **Postconditions:** Trạng thái, reviewer, thời gian và lý do được audit.

### UC-002: Verify a Teacher skill

- **Actor:** Teacher candidate, Verifier, Administrator.
- **Trigger:** Sinh viên đã xác minh muốn dạy một kỹ năng.
- **Preconditions:** Student verification còn hiệu lực; Verifier phù hợp đã được kích hoạt.
- **Main flow:** Teacher nộp bằng chứng → phân công Verifier → review → kỹ năng Approved.
- **Alternate/error flows:** Thiếu dữ liệu, sai chuyên môn hoặc Reject; Teacher xem lý do và nộp phiên bản mới.
- **Postconditions:** Chỉ kỹ năng Approved được dùng để công bố lớp.

### UC-003: Book and pay for a class

- **Actor:** Learner, Teacher, Wallet.
- **Trigger:** Learner chọn lớp đang mở.
- **Preconditions:** Lớp hợp lệ, còn khả năng nhận booking, bắt đầu sau ít nhất 24 giờ và Learner đủ credit.
- **Main flow:** Kiểm tra điều kiện → giữ chỗ → ghi booking và ledger nguyên tử → xác nhận.
- **Alternate/error flows:** Không đủ số dư, hết chỗ, booking trùng hoặc settlement lỗi thì không tạo trạng thái thành công một phần.
- **Postconditions:** Booking và bút toán có cùng kết quả; khoản Teacher có trạng thái settlement truy vết được.

### UC-004: Attend and review

- **Actor:** Learner, Teacher, Jitsi.
- **Trigger:** Booking hợp lệ đến thời gian diễn ra.
- **Preconditions:** Người dùng thuộc booking và phiên truy cập còn hiệu lực.
- **Main flow:** Mở phòng → học/chat → kết thúc → Learner gửi rating/comment.
- **Alternate/error flows:** Người ngoài, truy cập sai thời gian hoặc Jitsi lỗi bị từ chối/báo lỗi có thể xử lý.
- **Postconditions:** Tham gia, sự cố và review gắn với booking.

### UC-005: Withdraw earnings

- **Actor:** Teacher, Payment gateway.
- **Trigger:** Teacher yêu cầu rút số dư available.
- **Preconditions:** Teacher đã xác thực, đủ số dư và đáp ứng chính sách OQ-005.
- **Main flow:** Step-up authentication → tạo withdrawal → gateway payout → callback → ledger Completed.
- **Alternate/error flows:** Timeout/failure giữ số dư nhất quán; callback lặp không payout hai lần.
- **Postconditions:** Trạng thái payout và trace ID hiển thị trong lịch sử ví.

### User stories

| ID | Story | Priority | Dependency |
|---|---|---|---|
| US-001 | As a student, I want to submit enrollment evidence, so that I can use a trusted student marketplace. | Must | FR-001–FR-002 |
| US-002 | As a Teacher candidate, I want my skill evidence reviewed, so that I can teach approved skills. | Must | FR-002–FR-004 |
| US-003 | As a Learner, I want to find and book a valid class, so that I can learn within my schedule and budget. | Must | FR-005–FR-009 |
| US-004 | As a participant, I want secure class access and internal chat, so that I can attend without sharing personal contact details. | Must | FR-007, FR-011, FR-012 |
| US-005 | As a Learner, I want to review a completed class, so that future Learners can assess quality. | Must | FR-011, FR-013 |
| US-006 | As a Teacher, I want to withdraw available earnings, so that teaching produces real income. | Must | FR-009, FR-010, FR-014 |

### Acceptance criteria

- **AC-001 / FR-002:** Given tên trường và một tệp hợp lệ, when người dùng gửi hồ sơ, then hồ sơ ở trạng thái Pending và Administrator có thể review.
- **AC-002 / FR-003–FR-005:** Given kỹ năng chưa được duyệt, when Teacher cố công bố lớp, then hệ thống từ chối và hướng dẫn hoàn tất xác minh.
- **AC-003 / FR-007:** Given lớp bắt đầu sau dưới 24 giờ, when Learner đặt, then hệ thống không tạo booking hoặc trừ credit.
- **AC-004 / FR-009:** Given lớp giá 100 credit và Learner đủ số dư, when mua, then ledger ghi nợ 100, phân bổ 90 cho Teacher theo trạng thái settlement, ghi 10 phí và chỉ tạo một booking.
- **AC-005 / FR-009:** Given một bước settlement lỗi, when transaction kết thúc, then không có booking hoặc số dư ở trạng thái thành công một phần.
- **AC-006 / FR-011:** Given người dùng không thuộc booking hoặc truy cập ngoài thời gian cho phép, when mở phòng, then hệ thống từ chối.
- **AC-007 / FR-013:** Given lớp đã kết thúc và Learner thuộc booking, when gửi rating/comment hợp lệ, then review được gắn với booking và không bị tạo trùng trái chính sách.
- **AC-008 / FR-014:** Given callback payout hợp lệ được gửi lại, when hệ thống xử lý, then withdrawal chỉ hoàn tất một lần.
- **AC-009 / EVT-001:** Given một callback hợp lệ nhưng cũ hơn trạng thái gateway đã xử lý, when callback đến muộn, then hệ thống acknowledge nhưng không hạ trạng thái.
- **AC-010 / FR-007:** Given lớp còn đúng một chỗ, when hai Learner đặt gần như đồng thời, then đúng một booking được xác nhận; booking còn lại nhận lỗi lớp đầy và không bị trừ credit.
- **AC-011 / FR-020:** Given một Class đã tới giờ diễn ra, when buổi học thỏa quy tắc hoàn tất đã được duyệt, then Class chuyển Completed với thời gian/căn cứ audit và cho phép rating; release chỉ thực hiện khi đạt điều kiện OQ-006, hủy lớp xử lý booking/ledger theo OQ-003.
- **AC-012 / FR-019:** Given một hồ sơ xác minh sinh viên đã hết hiệu lực hoặc bị thu hồi, when hệ thống xử lý sự kiện, then các quyền yêu cầu VERIFIED bị hạ ngay và người dùng thấy trạng thái kèm hướng dẫn re-verification.
- **AC-013 / FR-014:** Given available 100 credit, when request rút 80 được xác nhận, then available còn 20 và payout_hold là 80; request rút thêm 80 bị từ chối mà không phát sinh hold hoặc payout mới.
- **AC-014 / FR-014:** Given payout 80 đang chờ và gateway timeout, then hold vẫn là 80; callback/đối soát thành công đến sau chỉ post payout một lần, không vừa payout vừa nhả tiền.
- **AC-015 / FR-009:** Given hai booking A/B tạo pending 90 mỗi booking và A đã release, when retry release A bằng key khác, then không release thêm; pending của B vẫn 90, available từ A vẫn 90.
- **AC-016 / FR-003–FR-005:** Given evidence mid còn hiệu lực và yêu cầu mới xin senior, then pending/rejected replacement vẫn giữ quyền mid; nếu Verifier duyệt bản mới ở mid, cache level và quyền đều mid, bản cũ Superseded cùng transaction/audit.
- **AC-017 / FR-005, FR-007:** Given booking Confirmed đầu tiên, when sửa Teacher/nội dung/kỹ năng/lịch/thời lượng hoặc hủy hết booking rồi sửa, then cam kết vẫn bị khóa; sửa lớp đồng thời với booking không bán nội dung ngoài cam kết.
- **AC-018 / FR-004:** Given chỉ có vai trò Administrator, hoặc Verifier suspended/sai chuyên môn/tự duyệt, when quyết định skill evidence, then bị từ chối; chỉ Verifier active đúng chuyên môn và khác chủ hồ sơ được quyết định.
- **AC-019 / FR-009, FR-010:** Given policy hoàn toàn bộ đã được duyệt và booking đã release nhưng Teacher còn đủ available, when hoàn tiền, then đảo release và booking nguyên tử, không tạo pending âm; sau payout/thiếu nguồn bù không tự post refund trái OQ-003/OQ-006.
- **AC-020 / OQ-007:** Sau khi OQ-007 được duyệt, acceptance suite phải bao gồm hai yêu cầu đồng thời cho chỗ cuối và việc tự động nhả capacity hold hết hạn.
- **AC-021 / OQ-008:** Sau khi OQ-008 được duyệt, acceptance suite phải kiểm tra cả hai hướng quyết định cascade và grandfather đối với lớp, booking, room access, thu nhập pending và payout.
- **AC-022 / FR-007, OQ-003:** Given một lớp Published/Full, when Teacher hủy lớp trước giờ học, then mọi Learner bị ảnh hưởng được hoàn credit vào ví nội bộ (không hoàn tiền thật).
- **AC-023 / FR-007, OQ-003:** Given một booking, when Learner muốn hủy, then MVP không cung cấp hủy booking (không có chính sách hủy booking).
- **AC-024 / FR-007, OQ-003:** Given Teacher không tham gia trong 15 phút đầu kể từ giờ bắt đầu, when xử lý no-show, then Learner được hoàn credit và chưa áp dụng hình phạt (hành vi dạy sai lệch do rating xử lý).
- **AC-025 / FR-007, OQ-003:** Given Learner không tham gia, when lớp kết thúc, then MVP không áp dụng quy tắc phạt/hoàn tự động cho Learner no-show.
- **AC-026 / FR-007, OQ-003:** Given một Pending booking, when tạo, then booking giữ chỗ (tính vào capacity) và hết hạn sau ~15 phút thì tự động chuyển Cancelled và nhả chỗ.
- **AC-027 / FR-007, OQ-003:** Given một booking Confirmed, when chuyển Cancelled, then Learner được hoàn credit vào ví nội bộ.
- **AC-028 / FR-005, OQ-007:** Given Teacher công bố lớp, when nhập sức chứa, then sức chứa là số nguyên ≥ 1 (1 = lớp 1-1, >1 = lớp nhóm) và bị từ chối nếu bằng 0 hoặc âm.
- **AC-029 / FR-007, OQ-007:** Given một lớp còn chỗ, when Learner đặt, then booking ở trạng thái Pending và giữ một chỗ; số chỗ còn lại = sức chứa − (Pending + Confirmed).
- **AC-030 / FR-005, FR-007, OQ-007:** Given lớp đã đủ sức chứa, when có booking mới, then lớp chuyển Full và hệ thống từ chối booking mới; chỗ chỉ được nhả khi booking Cancelled.

## 8. Data Model

| Entity | Key fields | Relationships | Lifecycle | Classification | Owner |
|---|---|---|---|---|---|
| User | id, email, roles, status | Has exactly one Profile, at most one user Wallet and role grants | Pending → Active → Suspended | PII | User/Administrator |
| UserRole | user_id, role, status, assigned_by, assigned_at | One grant per User/role; role suspension is independent of account suspension | Active → Suspended/Revoked; reactivation audited | Internal authorization | Administrator |
| Profile | id, user_id, display_name, bio, school_id, major_id | Belongs to User; has ProfileSkills and StudentVerifications | Created with User; school/major change requires re-verification | PII | User/Administrator |
| School / Major / SchoolMajor | id/code/name; school_id + major_id | Managed school and major catalogs; SchoolMajor lists valid pairs | Active → Inactive | Reference data | Administrator |
| Skill / ProfileSkill | id, name; profile_id, skill_id, level, verifier_expertise_status | Profile ↔ Skill is many-to-many; level caches effective approval (NULL until approved); active Verifier role plus authorized expertise required | Skill Active/Inactive; valid SkillEvidence.approved_level governs teaching; pending upgrades preserve old approval | Public competency + internal authorization | User/Verifier/Administrator |
| StudentVerification | id, profile_id, school_id, major_id, document_ref, status, reviewer_id, reason, expires_at | Belongs to Profile; immutable submission snapshots; resubmission creates a new row | Draft → Pending → Approved/Rejected; Approved → Superseded/Revoked/Expired | Sensitive identity document | Administrator |
| SkillEvidence | id, profile_skill_id, evidence_type, document_ref/description, version, requested_level, approved_level, status, reviewer_id, decided_at | Belongs to ProfileSkill; certificate or Verifier recognition; reviewer updates status with audit, no assignment entity | Draft → Pending → Approved/Rejected; Approved → Superseded/Revoked/Expired | Sensitive credential | Teacher/Verifier |
| Class | id, teacher_id, starts_at, duration_minutes, price_credits, capacity, status, commitments_locked_at, completed_at/completed_by | One scheduled online session per Class; has Bookings/ClassSkills; Teacher/content/schedule/skills freeze at first confirmed Booking | Draft → Published/Full → In progress → Completed; cancellation by policy | Public marketplace data | Teacher |
| ClassSkill | class_id, skill_id, target_level | Class ↔ Skill is many-to-many; Teacher approved level must cover target level | Managed with Class | Public marketplace data | Teacher |
| Booking | id, class_id, learner_id, status, price_credits, idempotency_key | Links Class/Learner/ledger; price snapshot; at most one valid booking per Learner/Class and one full release operation | Pending → Confirmed → Completed/Cancelled/Disputed | Private transaction data | Learner/Teacher |
| Wallet | id, owner_user_id, kind; available/pending/payout_hold derived from posted postings | At most one wallet per User; system wallets have no owner; payout_hold is reserved and not spendable | Active → Restricted/Closed | Financial | User/Platform |
| LedgerTransaction | id, kind, booking_id, withdrawal_request_id, initiated_by_user_id, amount_vnd, gateway_credits, rate, provider/reference, reverses_transaction_id, status, trace_id, idempotency_key | Groups balanced kind-specific postings; unique booking/release operations; withdrawal request has hold/payout/hold-release/reversal transactions; original has 0..1 full reversal, linked only for kind reversal | Pending → Posted/Failed; Posted → Reversed with compensating transaction; posted financial fields immutable | Sensitive financial | Platform |
| LedgerPosting | id, transaction_id, wallet_id, user_id, class_id, bucket, amount_credits | Links transaction/wallet owner/Class; buckets available/pending/payout_hold; system user and non-class transfer Class are NULL | Immutable once posted, including no late inserts; corrections compensate actual transfer chain | Sensitive financial | Platform |
| Message | id, class_id, sender_id, body, created_at | Belongs to class conversation | Active → Retained/Deleted | Private communication | Participants/Platform |
| Rating | id, booking_id, learner_id, score, comment | One policy-valid rating per Booking | Published → Hidden/Updated by policy | Public content + private provenance | Learner/Platform |
| WithdrawalRequest | id, teacher_id, amount_credits, exchange_rate_vnd, destination_ref, status, trace_id | Has many LedgerTransactions through withdrawal_request_id; hold commits before payout; amount/rate/destination frozen | Pending → Processing → Completed/Failed; timeout retains hold until reconciliation; authorized payout reversal → Reversed | Sensitive financial | Teacher/Platform |
| AuditEvent | id, actor_id, action, target_type/id, old_state_json, new_state_json, occurred_at, trace_id, metadata_json | Commits with state change; whitelisted decision snapshots preserve full evidence/role/completion/financial history | Append-only | Internal audit; no document content or payout destinations | Platform |

ERD chi tiết và các ràng buộc triển khai: [data model](../diagrams/data/README.md). Một Class là một buổi học có lịch/phòng riêng, không có bảng Session. Hai cách xác minh là kiểm tra chứng chỉ hoặc Verifier công nhận năng lực; chỉ Verifier đang active và đúng chuyên môn được quyết định. Không có bảng phân công Verifier hoặc bảng TopUp. Evidence Approved còn hiệu lực quyết định level được phép dạy; pending/rejected replacement giữ quyền cũ còn hiệu lực. Quyết định lưu trên SkillEvidence, lịch sử trước/sau lưu trong audit. Chỉ publish khi Teacher còn xác minh sinh viên hiệu lực và được duyệt đủ level cho **tất cả** skill của lớp; khóa cam kết tại booking Confirmed đầu tiên. Payout giữ credit trước khi gọi gateway; timeout chưa phải thất bại. Thời điểm release, hoàn tiền/nguồn bù sau payout và làm tròn vẫn theo OQ-003/OQ-006/OQ-012.

**Data rules:** Access is server-authorized by role and ownership. Sensitive files are encrypted in transit and at rest, stored outside executable paths, and never written to application logs. Exact retention/deletion periods require OQ-008 approval.

## 9. API and Integration Contract

These contracts are `Proposed` until Engineering approves the design and OQ-011 selects a gateway.

| API/Event ID | Method/path | Purpose | Auth | Request/response | Errors |
|---|---|---|---|---|---|
| API-001 | POST `/api/student-verifications` | Submit student evidence | Authenticated student | profile, school_id, major_id, document → verification ID/status | validation, unsupported file, duplicate pending request |
| API-002 | POST `/api/skill-evidence` | Submit Teacher evidence | Verified student | profile_skill_id, requested_level, evidence_type, document/assessment → evidence ID/status | validation, taxonomy unavailable |
| API-003 | POST `/api/verifications/{id}/decision` | Approve/reject eligible evidence | Administrator for student verification; active domain-matched Verifier for skill evidence | decision, approved_level (skill approval), reason → updated status | forbidden, stale version, invalid transition |
| API-004 | POST `/api/classes` | Create/publish a class | Teacher approved for every class skill and target level | class details → class/status | forbidden, invalid duration/price/capacity |
| API-005 | POST `/api/classes/{id}/bookings` | Book and settle a class | Verified Learner | booking request/idempotency key → booking/ledger status | insufficient balance, booking window, full, conflict |
| API-006 | POST `/api/wallet/top-ups` | Start top-up | Authenticated user | amount → gateway reference | gateway unavailable, limit exceeded |
| EVT-001 | POST `/api/webhooks/payment` | Receive top-up/payout status | Verified gateway signature | provider event ID, transaction reference, sequence/version or occurred-at, status → accepted/ignored duplicate/stale | invalid signature, replay, stale transition, unknown reference |
| API-007 | POST `/api/withdrawals` | Request payout | Teacher with available balance and step-up auth | amount, destination reference → withdrawal status | insufficient balance, policy limit, verification required |
| API-008 | POST `/api/bookings/{id}/room-token` | Obtain time-bound Jitsi access | Booking participant | booking → room/token expiry | forbidden, outside access window, provider unavailable |
| API-009 | POST `/api/bookings/{id}/messages` | Send internal message | Booking participant | text → message | forbidden, invalid/unsafe content, rate limited |
| API-010 | POST `/api/bookings/{id}/ratings` | Submit post-class review | Eligible Learner | score/comment → rating | class incomplete, duplicate, invalid content |

**Integration rules:** Gateway webhook signatures, timestamps and replay protection are mandatory. Mỗi provider event ID chỉ được áp dụng một lần. Trạng thái chỉ chuyển theo ma trận đơn điệu do contract gateway định nghĩa; callback hợp lệ nhưng cũ hơn trạng thái đã xử lý được acknowledge và bỏ qua. `Completed → Reversed` chỉ được chấp nhận từ một reversal event mới, hợp lệ; reconciliation là nguồn phục hồi khi thứ tự hoặc trạng thái không thống nhất. All commands with financial effect require an idempotency key and trace ID. Provider secrets are stored outside source control, separated by environment and rotatable. Jitsi access uses short-lived authorization rather than a discoverable public room link.

## 10. Non-Functional Requirements

| ID | Category | Target | Measurement | Priority | Owner |
|---|---|---|---|---|---|
| NFR-001 | Responsive UX | UC-001–UC-005 work at common mobile viewports without horizontal scrolling. | Browser tests at 360 px, 390 px and desktop width. | Must | Engineering/QA |
| NFR-002 | Localization | MVP screens support Vietnamese and English without mixed UI language. | Locale coverage review for all MVP routes. | Should | Product/QA |
| NFR-003 | Financial integrity | A retry or concurrent request creates one balanced financial result and no negative balance. | Idempotency, concurrency and reconciliation tests. | Must | Engineering/QA |
| NFR-004 | Privacy | Only owner and authorized reviewer can access verification documents. | Role/ownership matrix tests and audit review. | Must | Security/QA |
| NFR-005 | Auditability | Top-up, booking settlement and payout have an end-to-end trace ID without secrets in logs. | Trace a sample transaction across gateway, API and ledger. | Must | Engineering/Operations |
| NFR-006 | Recoverability | Validation/provider failures preserve recoverable input and show an actionable error. | Negative-path tests for form, gateway and Jitsi failures. | Should | Product/QA |
| NFR-007 | Accessibility | Core flows meet WCAG 2.2 AA, support keyboard navigation, visible focus and screen-reader labels/status. | Automated checks plus manual keyboard/screen-reader review. | Must | Product/QA |
| NFR-008 | Upload security | Verification files pass type/content/size allowlists, malware scanning and isolated preview. | Malicious/mismatched upload test corpus. | Must | Security/QA |
| NFR-009 | Application security | Server-side authorization protects every privileged action; Administrator/Verifier use MFA. | Authorization matrix, session and MFA tests. | Must | Security/QA |
| NFR-010 | Content security | Chat/rating content is treated as untrusted and rendered without executable markup. | Stored-XSS tests and Content Security Policy verification. | Must | Security/QA |

## 11. Security, Privacy and Compliance

- **Authentication and authorization:** Server-side role and ownership checks apply to every endpoint. Administrator and Verifier require MFA; payout and destination changes require step-up authentication.
- **Sensitive data:** Student IDs, enrollment confirmations, certificates, payout destinations and financial history are sensitive. Encrypt them in transit/at rest and exclude their contents from logs.
- **Upload safety:** Validate extension, MIME and file signature; limit size; scan malware; store outside executable paths; use isolated preview.
- **Payment boundary:** Verify webhook signature, timestamp and replay nonce; use idempotency keys; separate and rotate secrets by environment; reconcile gateway state with ledger.
- **Content safety:** Encode untrusted chat/rating output by context, sanitize any allowed formatting and enforce Content Security Policy.
- **Jitsi boundary:** Issue short-lived room authorization only to booking participants within the access window.
- **Audit:** Record privileged login, verification decision, role change, financial state transition and payout-destination change with actor, time and trace ID.
- **Retention/deletion:** Periods and deletion workflow are blocked on OQ-008; implementation must not default to indefinite storage.
- **Compliance:** Finance/Security must review payment, KYC and personal-data obligations after gateway and pilot jurisdiction are confirmed.

## 12. Delivery Plan and Dependencies

Mirror của PRD §14; cột Dependency được mở rộng với các OQ gating increment tương ứng (đối chiếu SRS §3.7).

| Increment | Scope | Dependency | Exit criteria | Risk |
|---|---|---|---|---|
| 1 | Kiến trúc nền, xác thực tài khoản, khung bảng điều khiển Admin. | Product Owner, Engineering, Finance/Security | Quyết định cần cho Increment 2 được phê duyệt. | High |
| 2 | Xác minh sinh viên, thông báo trạng thái. | Increment 1, OQ-008 | UC-001 pass toàn bộ acceptance criteria. | High |
| 3 | Đăng ký/xác minh Teacher, quản lý Verifier, công bố lớp. | Increment 2, OQ-001/OQ-002 (OQ-007 resolved) | UC-002 pass; chỉ kỹ năng Approved công bố được lớp. | High |
| 4 | Tìm kiếm, đặt lớp, ví, gateway, ledger, rút tiền. | Increment 3, OQ-002/OQ-005/OQ-006/OQ-011/OQ-012 (OQ-003 resolved) | UC-003, UC-005 pass; test concurrency và idempotency. | Critical |
| 5 | Jitsi, chat, rating, hoàn thiện mobile-web/accessibility. | Increment 4, OQ-004/OQ-009 | UC-004 pass; các NFR liên quan pass. | High |
| 6 | Ứng dụng mobile Expo/React Native (iOS/Android) cho Learner và Teacher. | Increment 5 | Gói cài đặt iOS/Android chạy được; UC-001–UC-005 pass trên app. | Medium |

Ghi chú: OQ-008 có required-by là gate thiết kế storage/lifecycle (BRD §11) và được bổ sung vào Dependency của Increment 2; OQ-010 gate pilot planning sau Increment 6 nên không thuộc Increments 1–6. Increment 6 không có OQ mới, kế thừa các gate của Increment 5. Các OQ còn lại giữ nguyên gate `Required by` của BRD §11.

## 13. Traceability Matrix

| Business goal | Requirement | Use case/story | API/data/NFR | Test evidence |
|---|---|---|---|---|
| Trusted student identity | FR-001, FR-002, FR-017, FR-019 | UC-001, UC-006–UC-008, US-001 | API-001, User, StudentVerification, NFR-004/NFR-008/NFR-009 | FR-001 local accounts + RS256 sessions implemented (ADR-016); FR-002 student verification (submit + admin decision + owner read) with S3 document upload implemented (ADR-023; no expiry, block duplicates); FR-017/FR-019 pending |
| Trusted Teacher capability | FR-003–FR-005, FR-018 | UC-002, UC-009, UC-010, US-002 | API-002–API-004, ProfileSkill, SkillEvidence, NFR-004/NFR-009 | Pending implementation |
| Discover and book online learning | FR-005–FR-007 | UC-003, UC-011, US-003 | API-004–API-005, Class, Booking, NFR-001/NFR-006/NFR-007 | FR-005 publish, FR-007 booking + lifecycle (expiry/refunds/edit-lock, ADR-019) implemented (live-class); FR-006 search pending |
| Traceable wallet settlement | FR-008–FR-010, FR-014, FR-020 | UC-003, UC-005, UC-012, UC-013, US-003/US-006 | API-005–API-007, EVT-001, Wallet/Ledger/Withdrawal, NFR-003/NFR-005/NFR-009 | FR-008 top-up (ADR-017), FR-009 settlement + 90/10 split (ADR-018), FR-020 completion + release (ADR-021) and FR-010 balance/history reads (ADR-022) implemented; FR-014 withdrawals pending |
| Secure class participation | FR-011–FR-013, FR-016 | UC-004, US-004/US-005 | API-008–API-010, Message/Rating, NFR-006/NFR-007/NFR-010 | FR-011 Jitsi room access implemented (self-hosted + JWT, ADR-020); FR-012/FR-013/FR-016 pending |
| Platform operations | FR-015 | UC-014 | Audit log, NFR-005 | Pending implementation |

## 14. Risks and Decisions

| ID | Risk/decision | Impact | Likelihood | Owner | Mitigation/status |
|---|---|---|---|---|---|
| RISK-001 | Gian lận top-up, payout hoặc chargeback. | Critical | Medium | Finance/Security | Gateway controls, pending funds, reversal, reconciliation; OQ-006/OQ-011 open. |
| RISK-002 | Ledger ghi sai hoặc xử lý trùng. | Critical | Medium | Engineering | Atomic entries, idempotency and concurrency tests. |
| RISK-003 | Giấy tờ giả hoặc tệp tải lên độc hại. | High | Medium | Administrator/Security | Review checklist, upload scanning and audit. |
| RISK-004 | Verifier thông đồng hoặc vượt phạm vi chuyên môn. | High | Medium | Administrator | Separation of duty, assignment scope and periodic audit. |
| RISK-005 | Tranh chấp/no-show không có quy trình. | High | High | Product Owner/Administrator | OQ-003 resolved (2026-10-08): refund = credit ví nội bộ, no booking cancellation, Teacher no-show 15 phút; xem AC-022–AC-027. |
| RISK-006 | Thiếu Teacher đã xác minh khi pilot. | High | Medium | Product Owner | Recruit and verify supply before learner expansion. |
| RISK-007 | Rò rỉ giấy tờ, chat hoặc dữ liệu tài chính. | Critical | Medium | Security | Encryption, least privilege, retention decision and security tests. |
| DEC-001 | MVP chỉ hỗ trợ lớp trực tuyến qua Jitsi. | — | — | Product Owner | Confirmed; governs FR-005/FR-011. |
| DEC-002 | Xác minh sinh viên và năng lực Teacher là thủ công. | — | — | Product Owner | Confirmed; governs FR-002–FR-004. |
| DEC-003 | Thanh toán dùng credit, tỷ giá khởi điểm 1 credit = 1.000 VND và phí 10%. | — | — | Product Owner | Confirmed; governs FR-008–FR-010/FR-014. |

## 15. Quality Review

- **Gate 1 — Context Ready:** Passed. Problem, desired outcome, actors, scope, assumptions, constraints and open questions are explicit.
- **Gate 2 — Requirement Ready:** Passed for confirmed core behavior; affected Issues remain Draft/Backlog where an OQ blocks implementation.
- **Gate 3 — Solution Ready:** In progress. Data, API, security and NFR contracts are proposed; gateway and policy decisions remain open.
- **Gate 4 — Delivery Ready:** In progress. Traceability exists; risk owners are assigned; stakeholder approval and implementation evidence are pending.
- **Gate 5 — GitHub Delivery Complete:** Not started for product features. No feature is `Done` until its code PR is merged and test/review evidence is recorded.
- **Reviewers:** Product Owner, Engineering, QA, Security/Finance as applicable.
- **Approval decision:** Pending.
- **Unresolved questions:** OQ-001–OQ-012.

## GitHub Delivery Mapping

- GitHub Project: https://github.com/users/trankien022/projects/1
- Functional Issues: https://github.com/trankien022/SkillSwap/issues/1 through https://github.com/trankien022/SkillSwap/issues/14
- Note: GitHub issues are not yet filed for FR-015–FR-020 (planned increment for platform-operations scope); no feature work for those FRs starts until issues exist.
- Decision Spikes: https://github.com/trankien022/SkillSwap/issues/15 through https://github.com/trankien022/SkillSwap/issues/19 and https://github.com/trankien022/SkillSwap/issues/22 through https://github.com/trankien022/SkillSwap/issues/27.
- Governance alignment Issue: https://github.com/trankien022/SkillSwap/issues/21
- Original blueprint PR: https://github.com/trankien022/SkillSwap/pull/20

Only confirmed functional requirements are eligible for implementation. Proposed contracts require Engineering review, and open business decisions must remain explicit until an authorized owner approves them.
