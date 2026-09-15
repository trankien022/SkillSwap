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
- **Recommended direction:** MVP web mobile-first, xác minh thủ công, lớp trực tuyến qua Jitsi, chat nội bộ và thanh toán bằng credit.
- **Product authority:** `docs/intent.md` là nguồn nghiệp vụ chính. Nội dung suy ra để hoàn thiện đặc tả được ghi là `Proposed`; nội dung chưa đủ căn cứ được ghi là `Open Question`.

## 2. Scope

### In scope

- Web responsive mobile-first cho Learner, Teacher, Verifier và Administrator.
- Xác minh sinh viên và năng lực Teacher bằng quy trình thủ công.
- Marketplace lớp trực tuyến, booking, ví credit, Jitsi, chat và rating/comment.
- Nạp và rút tiền thông qua một payment gateway được chọn ở bước thiết kế.
- Audit trail cho xác minh, booking và giao dịch tài chính.

### Out of scope

- Ứng dụng native iOS hoặc Android.
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
| OQ-003 | Chính sách hủy, no-show, tranh chấp, hoàn tiền thủ công và workflow Administrator thực thi các quyết định này. | Product Owner + Administrator | FR-007, FR-009–FR-011, FR-013 | Before implementation planning |
| OQ-004 | Ngưỡng rating, số đánh giá tối thiểu và cách khôi phục hiển thị. | Product Owner | FR-006, FR-013 | Before implementation planning |
| OQ-005 | Điều kiện, giới hạn, phí và thời gian xử lý withdrawal. | Product Owner + Finance | FR-010, FR-014 | Before implementation planning |
| OQ-006 | Khi nào khoản 90% của Teacher chuyển từ pending sang available; cách xử lý chargeback và reversal. | Product Owner + Finance | FR-008, FR-009, FR-014 | Before implementation planning |
| OQ-007 | Lớp là một-một, lớp nhóm hay cả hai; sức chứa, quy tắc giữ/nhả chỗ và kết quả khi nhiều Learner đồng thời đặt chỗ cuối. | Product Owner | FR-005, FR-007 | Before implementation planning |
| OQ-008 | Thời hạn hiệu lực xác minh sinh viên, thời hạn lưu/xóa giấy tờ, và quy tắc cascade hoặc grandfather khi Student/Verifier hết hiệu lực hoặc bị thu hồi đối với SkillEvidence, lớp đã công bố, booking, quyền vào phòng, thu nhập pending và payout. | Product Owner + Security | FR-002–FR-005, FR-007, FR-011, FR-014, NFR-004 | Before storage and lifecycle design |
| OQ-009 | Chat cảnh báo, chặn hay chỉ ghi nhận khi phát hiện thông tin liên hệ cá nhân. | Product Owner | FR-012 | Before implementation planning |
| OQ-010 | Giá trị mục tiêu cho bốn success metrics và phạm vi trường pilot. | Product Owner | Product rollout | Before pilot planning |
| OQ-011 | Payment gateway nào đáp ứng top-up, payout, webhook, reconciliation và reversal. | Engineering + Finance | FR-008, FR-014 | Before integration design |

## 5. Process Analysis

| Step | Current state | Future state | Actor/system | Rule or exception |
|---|---|---|---|---|
| 1 | Sinh viên khó chứng minh danh tính trong marketplace ngang hàng. | Người dùng nộp tên trường và giấy tờ; Administrator duyệt thủ công. | Student, Administrator | Từ chối phải có lý do; hiệu lực xác minh theo OQ-008. |
| 2 | Năng lực người dạy chưa có bên chuyên môn xác nhận. | Teacher nộp bằng chứng; Verifier phù hợp chuyên môn review. | Teacher, Verifier | Administrator không thay thế quyết định chuyên môn. |
| 3 | Lớp học và giá chưa có kênh chuẩn hóa. | Teacher đã xác minh công bố lớp cho kỹ năng được duyệt. | Teacher | Giá theo OQ-002; sức chứa theo OQ-007. |
| 4 | Booking và thanh toán dễ đứt traceability. | Hệ thống kiểm tra điều kiện, ghi booking và ledger nguyên tử. | Learner, Wallet | Không đủ số dư, hết chỗ hoặc dưới 24 giờ thì không trừ credit. |
| 5 | Thu nhập và tranh chấp chưa có quy trình chung. | Tiền Teacher được theo dõi theo trạng thái pending/available và payout. | Wallet, Teacher, Administrator | Release, refund, chargeback theo OQ-003/OQ-006. |
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
| FR-014 | Functional | Teacher phải có thể yêu cầu rút thu nhập qua gateway; khái niệm số dư available phụ thuộc OQ-005/OQ-006, còn idempotency và ledger là thiết kế đề xuất. | Must | `docs/intent.md` + Proposed | Confirmed core; payout controls Proposed; policy/gateway open |

### Business rules

| ID | Rule | Governs |
|---|---|---|
| BR-001 | Administrator xét duyệt thủ công tư cách sinh viên từ tên trường và giấy tờ tải lên. | FR-002 |
| BR-002 | Chỉ Teacher có kỹ năng được Verifier phù hợp chuyên môn duyệt mới được mở lớp cho kỹ năng đó. | FR-003–FR-005 |
| BR-003 | Mỗi lớp kéo dài tối thiểu 30 phút và tối đa 3 giờ. | FR-005, FR-007 |
| BR-004 | Booking phải được tạo ít nhất 24 giờ trước giờ bắt đầu. | FR-007 |
| BR-005 | Tỷ giá khởi điểm là 1 credit = 1.000 VND; giao dịch lưu tỷ giá đã áp dụng để audit. | FR-008, FR-010, FR-014 |
| BR-006 | Phí nền tảng là 10% giá lớp; 90% còn lại được phân bổ cho Teacher theo trạng thái settlement. | FR-009, FR-014 |
| BR-007 | MVP chỉ hỗ trợ lớp học trực tuyến. | FR-005, FR-011 |
| BR-008 | Giao tiếp phục vụ lớp học diễn ra trong nền tảng; cách thực thi cấm chia sẻ liên hệ theo OQ-009. | FR-012 |
| BR-009 | Hồ sơ chất lượng thấp bị giảm hiển thị theo ngưỡng được phê duyệt. | FR-006, FR-013 |

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
- **AC-009 / EVT-001:** Given một callback hợp lệ nhưng cũ hơn trạng thái gateway đã xử lý, when callback đến muộn, then hệ thống acknowledge nhưng không hạ trạng thái; `Completed → Reversed` chỉ xảy ra với sự kiện reversal mới, hợp lệ và được reconciliation xác nhận.
- **AC-010 / OQ-007:** Sau khi OQ-007 được duyệt, acceptance suite phải bao gồm hai yêu cầu đồng thời cho chỗ cuối và việc tự động nhả capacity hold hết hạn.
- **AC-011 / OQ-008:** Sau khi OQ-008 được duyệt, acceptance suite phải kiểm tra cả hai hướng quyết định cascade và grandfather đối với lớp, booking, room access, thu nhập pending và payout.

## 8. Data Model

| Entity | Key fields | Relationships | Lifecycle | Classification | Owner |
|---|---|---|---|---|---|
| User | id, roles, school_name, verification_status | Has verification, wallet, classes/bookings | Pending → Active → Suspended | PII | User/Admin |
| StudentVerification | id, user_id, document_ref, status, reviewer_id, reason, expires_at | Belongs to User | Draft → Pending → Approved/Rejected/Expired | Sensitive identity document | Administrator |
| SkillEvidence | id, teacher_id, skill_id, document_ref, version, status | Belongs to Teacher and Skill | Draft → Pending → Approved/Rejected/Superseded | Sensitive credential | Teacher/Verifier |
| VerifierAssignment | id, verifier_id, domain, status, assigned_by | Links Verifier to review domain | Invited → Active → Suspended/Revoked | Internal access-control data | Administrator |
| Class | id, teacher_id, skill_id, schedule, duration, price, capacity, status | Has Bookings | Draft → Published → Full/Closed/Cancelled | Public marketplace data | Teacher |
| Booking | id, class_id, learner_id, status, settlement_id | Links Class, Learner and ledger | Pending → Confirmed → Completed/Cancelled/Disputed | Private transaction data | Learner/Teacher |
| Wallet | id, user_id, available_balance, pending_balance | Has ledger entries | Active → Restricted/Closed | Financial | User/Platform |
| LedgerTransaction | id, wallet_id, type, amount, rate, status, trace_id, idempotency_key | Links top-up, booking or withdrawal | Pending → Posted/Reversed/Failed | Sensitive financial | Platform |
| Message | id, class_id, sender_id, body, created_at | Belongs to class conversation | Active → Retained/Deleted | Private communication | Participants/Platform |
| Rating | id, booking_id, learner_id, score, comment | One policy-valid rating per Booking | Published → Hidden/Updated by policy | Public content + private provenance | Learner/Platform |
| WithdrawalRequest | id, teacher_id, amount, destination_ref, status, trace_id | Produces ledger entries | Pending → Processing → Completed/Failed/Reversed | Sensitive financial | Teacher/Platform |

**Data rules:** Access is server-authorized by role and ownership. Sensitive files are encrypted in transit and at rest, stored outside executable paths, and never written to application logs. Exact retention/deletion periods require OQ-008 approval.

## 9. API and Integration Contract

These contracts are `Proposed` until Engineering approves the design and OQ-011 selects a gateway.

| API/Event ID | Method/path | Purpose | Auth | Request/response | Errors |
|---|---|---|---|---|---|
| API-001 | POST `/api/student-verifications` | Submit student evidence | Authenticated student | school, document → verification ID/status | validation, unsupported file, duplicate pending request |
| API-002 | POST `/api/skill-evidence` | Submit Teacher evidence | Verified student | skill, document → evidence ID/status | validation, taxonomy unavailable |
| API-003 | POST `/api/verifications/{id}/decision` | Approve/reject assigned evidence | Administrator or assigned Verifier by verification type | decision, reason → updated status | forbidden, stale version, invalid transition |
| API-004 | POST `/api/classes` | Create/publish a class | Teacher approved for skill | class details → class/status | forbidden, invalid duration/price/capacity |
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

| Increment | Scope | Dependency | Exit criteria | Risk |
|---|---|---|---|---|
| 1 | Resolve architecture/security choices and only the OQs required by the next increment; track remaining OQs by their own `Required by` gate. | Product Owner, Engineering, Finance/Security | Decisions needed for Increment 2 are approved and affected Issues meet Definition of Ready. | High |
| 2 | Identity, student verification and Verifier lifecycle. | OQ-001, OQ-008 | Acceptance criteria and authorization/upload tests pass. | High |
| 3 | Teacher evidence and class publishing. | Increment 2, OQ-001/OQ-002/OQ-007 | Verified Teacher can publish only approved skills. | High |
| 4 | Booking, wallet, gateway and settlement. | OQ-002/OQ-003/OQ-005/OQ-006/OQ-011 | Atomic ledger, webhook, chargeback and reconciliation evidence pass. | Critical |
| 5 | Jitsi, chat, rating and mobile/accessibility completion. | Confirmed booking lifecycle, OQ-004/OQ-009 | Secure access, content safety and end-to-end flow evidence pass. | High |

## 13. Traceability Matrix

| Business goal | Requirement | Use case/story | API/data/NFR | Test evidence |
|---|---|---|---|---|
| Trusted student identity | FR-001–FR-002 | UC-001, US-001 | API-001, User, StudentVerification, NFR-004/NFR-008/NFR-009 | Pending implementation |
| Trusted Teacher capability | FR-003–FR-005 | UC-002, US-002 | API-002–API-004, SkillEvidence, VerifierAssignment, NFR-004/NFR-009 | Pending implementation |
| Discover and book online learning | FR-005–FR-007 | UC-003, US-003 | API-004–API-005, Class, Booking, NFR-001/NFR-006/NFR-007 | Pending implementation |
| Traceable wallet settlement | FR-008–FR-010, FR-014 | UC-003, UC-005, US-003/US-006 | API-005–API-007, EVT-001, Wallet/Ledger/Withdrawal, NFR-003/NFR-005/NFR-009 | Pending implementation |
| Secure class participation | FR-011–FR-013 | UC-004, US-004/US-005 | API-008–API-010, Message/Rating, NFR-006/NFR-007/NFR-010 | Pending implementation |

## 14. Risks and Decisions

| ID | Risk/decision | Impact | Likelihood | Owner | Mitigation/status |
|---|---|---|---|---|---|
| RISK-001 | Gian lận top-up, payout hoặc chargeback. | Critical | Medium | Finance/Security | Gateway controls, pending funds, reversal, reconciliation; OQ-006/OQ-011 open. |
| RISK-002 | Ledger ghi sai hoặc xử lý trùng. | Critical | Medium | Engineering | Atomic entries, idempotency and concurrency tests. |
| RISK-003 | Giấy tờ giả hoặc tệp tải lên độc hại. | High | Medium | Administrator/Security | Review checklist, upload scanning and audit. |
| RISK-004 | Verifier thông đồng hoặc vượt phạm vi chuyên môn. | High | Medium | Administrator | Separation of duty, assignment scope and periodic audit. |
| RISK-005 | Tranh chấp/no-show không có quy trình. | High | High | Product Owner/Administrator | Resolve OQ-003 before booking implementation. |
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
- **Unresolved questions:** OQ-001–OQ-011.

## GitHub Delivery Mapping

- GitHub Project: https://github.com/users/trankien022/projects/1
- Functional Issues: https://github.com/trankien022/SkillSwap/issues/1 through https://github.com/trankien022/SkillSwap/issues/14
- Decision Spikes: https://github.com/trankien022/SkillSwap/issues/15 through https://github.com/trankien022/SkillSwap/issues/19 and https://github.com/trankien022/SkillSwap/issues/22 through https://github.com/trankien022/SkillSwap/issues/27.
- Governance alignment Issue: https://github.com/trankien022/SkillSwap/issues/21
- Original blueprint PR: https://github.com/trankien022/SkillSwap/pull/20

Only confirmed functional requirements are eligible for implementation. Proposed contracts require Engineering review, and open business decisions must remain explicit until an authorized owner approves them.
