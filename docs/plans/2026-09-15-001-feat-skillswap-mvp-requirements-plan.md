---
title: SkillSwap MVP Requirements - Plan
type: feat
date: 2026-09-15
topic: skillswap-mvp-requirements
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# SkillSwap MVP Requirements - Plan

## Goal Capsule

- **Objective:** Chuyển ý tưởng SkillSwap thành bộ yêu cầu MVP có thể review, kiểm thử và quản lý trên GitHub Project.
- **Product authority:** `docs/intent.md` là nguồn nghiệp vụ chính; các quyết định chưa có trong tài liệu nguồn vẫn là câu hỏi mở.
- **Blueprint review status:** Draft.
- **Open blockers:** Chính sách giá lớp, phân loại kỹ năng, ngưỡng giảm hiển thị, hoàn tiền/hủy lớp và phạm vi trường ra mắt chưa được chốt.

---

## Product Contract

### Summary

SkillSwap là nền tảng web mobile-first giúp sinh viên đã được xác minh học kỹ năng từ những sinh viên có năng lực đã được thẩm định.
Người học thanh toán bằng credit nội bộ, giáo viên nhận credit sau giao dịch, và nền tảng giữ 10% phí dịch vụ.

### Problem Frame

Sinh viên muốn học kỹ năng thực tế nhưng thường không đủ ngân sách hoặc thời gian cho khóa học chính quy.
Sinh viên có kỹ năng và chứng chỉ lại thiếu một kênh đáng tin cậy để mở lớp, tiếp cận người học và nhận thu nhập.
Giải pháp cần tạo niềm tin bằng xác minh thủ công, giao dịch có thể truy vết và trải nghiệm học trực tuyến ngay trong nền tảng.

### Actors

| ID | Actor | Responsibility |
|---|---|---|
| A1 | Learner | Tìm kiếm, đặt và tham gia lớp; thanh toán bằng credit; đánh giá sau lớp. |
| A2 | Teacher | Nộp bằng chứng năng lực, mở lớp sau khi được duyệt, giảng dạy và rút credit. |
| A3 | Verifier | Được mời theo chuyên môn và xét duyệt năng lực/chứng chỉ của Teacher. |
| A4 | Administrator | Xét duyệt tư cách sinh viên, quản lý Verifier và vận hành nền tảng. |
| A5 | Payment gateway | Xử lý tiền thật cho nạp và rút tiền. |
| A6 | Jitsi | Cung cấp phòng học trực tuyến. |

### Key Decisions

- **Học trực tuyến trong MVP.** Governs R9, R11; phiên học ngoại tuyến không có cơ chế kiểm chứng phù hợp.
- **Xác minh bằng tài liệu thủ công.** Governs R2, R3, R4; MVP không tích hợp cơ sở dữ liệu của trường.
- **Thanh toán qua credit nội bộ.** Governs R7, R8, R10, R14; tỷ giá mặc định là 1 credit = 1.000 VND.
- **Verifier độc lập với Administrator.** Governs R4; đánh giá chuyên môn và quản trị hệ thống là hai trách nhiệm khác nhau.
- **Đánh giá thay cho hệ thống report riêng trong MVP.** Governs R13; ngưỡng giảm hiển thị vẫn cần được quyết định.

### Requirements

**Identity and verification**

| ID | Blueprint ID | Requirement | Priority | Source | Confirmation |
|---|---|---|---|---|---|
| R1 | FR-001 | Hệ thống phải cho phép sinh viên tạo và quản lý tài khoản để sử dụng vai trò Learner và đăng ký trở thành Teacher. | Must | `docs/intent.md` | Confirmed |
| R2 | FR-002 | Hệ thống phải cho phép sinh viên khai báo tên trường và tải ảnh thẻ sinh viên hoặc giấy xác nhận đang học để Administrator xét duyệt thủ công. | Must | `docs/intent.md` | Confirmed |
| R3 | FR-003 | Hệ thống phải cho phép ứng viên Teacher nộp kỹ năng, chứng chỉ hoặc bằng chứng năng lực để được thẩm định. | Must | `docs/intent.md` | Confirmed |
| R4 | FR-004 | Hệ thống chỉ cho phép Verifier được mời và phù hợp chuyên môn phê duyệt hoặc từ chối hồ sơ năng lực của Teacher. | Must | `docs/intent.md` | Confirmed |

**Class marketplace**

| ID | Blueprint ID | Requirement | Priority | Source | Confirmation |
|---|---|---|---|---|---|
| R5 | FR-005 | Hệ thống chỉ cho phép Teacher đã được xác minh tạo và công bố lớp học trực tuyến với kỹ năng, mô tả, lịch, thời lượng và giá. | Must | `docs/intent.md` | Confirmed; pricing model open |
| R6 | FR-006 | Hệ thống phải cho phép Learner duyệt và tìm kiếm các lớp đang mở theo thông tin lớp và hồ sơ Teacher. | Must | `docs/intent.md` | Confirmed; taxonomy open |
| R7 | FR-007 | Hệ thống phải cho phép Learner đặt lớp còn chỗ khi thời điểm bắt đầu cách hiện tại ít nhất 24 giờ và thời lượng từ 30 phút đến 3 giờ. | Must | `docs/intent.md` | Confirmed |

**Wallet and settlement**

| ID | Blueprint ID | Requirement | Priority | Source | Confirmation |
|---|---|---|---|---|---|
| R8 | FR-008 | Hệ thống phải cho phép người dùng nạp tiền qua payment gateway và quy đổi thành credit theo tỷ giá cấu hình, mặc định 1 credit = 1.000 VND. | Must | `docs/intent.md` | Confirmed |
| R9 | FR-009 | Khi Learner mua lớp, hệ thống phải ghi nợ ví Learner, ghi có 90% giá lớp cho Teacher và ghi nhận 10% phí nền tảng như một giao dịch thống nhất. | Must | `docs/intent.md` | Confirmed |
| R10 | FR-010 | Hệ thống phải cho phép người dùng xem số dư và lịch sử nạp, thanh toán lớp, nhận thu nhập, phí và rút tiền của ví mình. | Must | `docs/intent.md` | Confirmed |
| R11 | FR-011 | Hệ thống phải cung cấp quyền truy cập phòng Jitsi cho đúng Learner và Teacher của một booking hợp lệ trong thời gian lớp học. | Must | `docs/intent.md` | Confirmed |
| R12 | FR-012 | Hệ thống phải cung cấp chat trong nền tảng giữa các bên liên quan đến lớp để không cần trao đổi thông tin liên hệ cá nhân. | Must | `docs/intent.md` | Confirmed; enforcement open |
| R13 | FR-013 | Sau lớp học, hệ thống phải cho phép Learner gửi điểm đánh giá và bình luận, đồng thời dùng kết quả đánh giá để giảm hiển thị hồ sơ có chất lượng thấp. | Must | `docs/intent.md` | Confirmed; threshold open |
| R14 | FR-014 | Hệ thống phải cho phép Teacher yêu cầu quy đổi credit khả dụng thành tiền thật qua payment gateway. | Must | `docs/intent.md` | Confirmed; withdrawal workflow open |

**Business rules**

| ID | Rule | Governs |
|---|---|---|
| BR-001 | Tư cách sinh viên được Administrator xét duyệt thủ công từ tên trường và giấy tờ tải lên. | R2 |
| BR-002 | Chỉ Teacher có hồ sơ năng lực được Verifier phù hợp chuyên môn phê duyệt mới được mở lớp. | R3-R5 |
| BR-003 | Mỗi lớp kéo dài tối thiểu 30 phút và tối đa 3 giờ. | R5, R7 |
| BR-004 | Booking phải được tạo ít nhất 24 giờ trước giờ bắt đầu. | R7 |
| BR-005 | Tỷ giá mặc định cho nạp và rút là 1 credit = 1.000 VND. | R8, R14 |
| BR-006 | Phí nền tảng là 10% trên mỗi giao dịch mua lớp. | R9 |
| BR-007 | MVP chỉ hỗ trợ lớp học trực tuyến. | R5, R11 |
| BR-008 | Giao tiếp phục vụ lớp học diễn ra trong nền tảng; người dùng không được chia sẻ thông tin liên hệ cá nhân. | R12 |
| BR-009 | Hồ sơ có đánh giá thấp bị giảm hiển thị hoặc ẩn khỏi kết quả tìm kiếm theo một ngưỡng cần được phê duyệt. | R6, R13 |

### Key Flows

- F1. Student verification
  - **Trigger:** Người dùng muốn sử dụng nền tảng với tư cách sinh viên.
  - **Actors:** A1 hoặc A2, A4.
  - **Steps:** Người dùng nhập tên trường và tải giấy tờ; Administrator review; hệ thống ghi nhận kết quả và thông báo.
  - **Outcome:** Tài khoản được xác minh hoặc bị từ chối với lý do.
  - **Covered by:** R1, R2.
- F2. Teacher verification
  - **Trigger:** Sinh viên đã xác minh muốn mở lớp.
  - **Actors:** A2, A3, A4.
  - **Steps:** Ứng viên nộp kỹ năng/bằng chứng; hồ sơ được chuyển đến Verifier phù hợp; Verifier duyệt hoặc từ chối.
  - **Outcome:** Teacher được phép mở lớp chỉ cho kỹ năng đã được duyệt.
  - **Covered by:** R3, R4, R5.
- F3. Book and settle a class
  - **Trigger:** Learner chọn một lớp đang mở.
  - **Actors:** A1, A2, A5.
  - **Steps:** Hệ thống kiểm tra lịch và quy tắc booking; kiểm tra số dư; ghi nợ Learner; ghi có Teacher và phí nền tảng; xác nhận booking.
  - **Outcome:** Booking và toàn bộ bút toán có cùng kết quả thành công hoặc cùng thất bại.
  - **Covered by:** R7-R10.
- F4. Attend and review
  - **Trigger:** Booking hợp lệ đến thời gian diễn ra.
  - **Actors:** A1, A2, A6.
  - **Steps:** Hai bên truy cập phòng Jitsi và chat; sau lớp Learner gửi rating/comment.
  - **Outcome:** Việc tham gia và đánh giá được gắn với booking tương ứng.
  - **Covered by:** R11-R13.
- F5. Withdraw earnings
  - **Trigger:** Teacher muốn rút credit khả dụng.
  - **Actors:** A2, A5.
  - **Steps:** Teacher tạo yêu cầu; hệ thống kiểm tra điều kiện; payment gateway xử lý; ledger ghi kết quả.
  - **Outcome:** Số dư và lịch sử phản ánh đúng trạng thái rút tiền.
  - **Covered by:** R10, R14.

### Acceptance Examples

- AE1. Valid student verification submission
  - **Covers R2.**
  - **Given:** Người dùng đã nhập tên trường và chọn một tệp giấy tờ hợp lệ.
  - **When:** Người dùng gửi hồ sơ.
  - **Then:** Hồ sơ được lưu ở trạng thái chờ review và Administrator có thể xem hồ sơ.
- AE2. Unverified teacher cannot publish
  - **Covers R3-R5.**
  - **Given:** Hồ sơ kỹ năng của ứng viên chưa được phê duyệt.
  - **When:** Người dùng cố công bố lớp cho kỹ năng đó.
  - **Then:** Hệ thống từ chối và hướng dẫn hoàn tất xác minh.
- AE3. Booking inside the 24-hour boundary
  - **Covers R7.**
  - **Given:** Lớp bắt đầu sau dưới 24 giờ.
  - **When:** Learner cố đặt lớp.
  - **Then:** Hệ thống không tạo booking hoặc trừ credit và giải thích giới hạn đặt trước.
- AE4. Successful class purchase
  - **Covers R7-R10.**
  - **Given:** Booking hợp lệ có giá 100 credit và Learner đủ số dư.
  - **When:** Learner xác nhận mua.
  - **Then:** Learner bị trừ 100 credit, Teacher được cộng 90 credit, nền tảng ghi 10 credit phí và chỉ một booking được tạo.
- AE5. Failed settlement
  - **Covers R9.**
  - **Given:** Một phần xử lý giao dịch ví gặp lỗi.
  - **When:** Hệ thống không thể hoàn tất toàn bộ bút toán.
  - **Then:** Không số dư nào thay đổi một phần và booking không được xác nhận.
- AE6. Jitsi access authorization
  - **Covers R11.**
  - **Given:** Người dùng không thuộc booking hoặc truy cập ngoài thời gian cho phép.
  - **When:** Người dùng mở liên kết phòng học.
  - **Then:** Hệ thống từ chối truy cập.
- AE7. Post-class review
  - **Covers R13.**
  - **Given:** Lớp đã kết thúc và Learner thuộc booking.
  - **When:** Learner gửi rating và comment hợp lệ.
  - **Then:** Đánh giá được gắn với booking và cập nhật điểm hồ sơ Teacher.

### Data and Integration Scope

Các thực thể nghiệp vụ tối thiểu gồm User, StudentVerification, SkillEvidence, VerifierAssignment, Class, Booking, Wallet, LedgerTransaction, Message, Rating và WithdrawalRequest.
Dữ liệu giấy tờ xác minh và giao dịch tài chính phải có owner, lịch sử trạng thái, kiểm soát truy cập và audit trail.
Tích hợp ngoài gồm payment gateway cho nạp/rút tiền và Jitsi cho phòng học; lựa chọn gateway và hợp đồng API được quyết định ở giai đoạn thiết kế.

### Non-Functional Requirements

| ID | Requirement | Measurement | Priority |
|---|---|---|---|
| NFR-001 | Giao diện phải responsive và ưu tiên thao tác trên điện thoại. | Các luồng F1-F5 hoàn thành được ở viewport điện thoại phổ biến mà không cần cuộn ngang. | Must |
| NFR-002 | Sản phẩm phải hỗ trợ nội dung giao diện bằng tiếng Việt và tiếng Anh. | Người dùng đổi được ngôn ngữ và các màn hình thuộc MVP không trộn ngôn ngữ ngoài dữ liệu do người dùng nhập. | Should |
| NFR-003 | Ledger phải chống ghi nhận trùng và không cho phép giao dịch lớp tạo số dư âm hoặc bút toán một phần. | Kiểm thử retry/concurrency chứng minh một yêu cầu chỉ tạo một kết quả tài chính cân bằng. | Must |
| NFR-004 | Tài liệu sinh viên và chứng chỉ chỉ được truy cập bởi chủ thể và reviewer có thẩm quyền. | Kiểm thử phân quyền từ chối mọi vai trò không liên quan và audit được lượt review. | Must |
| NFR-005 | Thao tác nạp, thanh toán và rút tiền phải có trace ID và audit trail. | Có thể truy nguyên từ yêu cầu gateway đến thay đổi ledger mà không ghi lộ bí mật thanh toán. | Must |
| NFR-006 | Luồng chính phải có thông báo lỗi dễ hiểu và không làm mất dữ liệu đã nhập khi lỗi có thể phục hồi. | Kiểm thử các lỗi validation, gateway và Jitsi xác nhận trạng thái người dùng có thể tiếp tục. | Should |

### Scope Boundaries

**In scope for MVP**

- Web responsive mobile-first cho Learner, Teacher, Verifier và Administrator.
- Xác minh sinh viên và năng lực Teacher bằng quy trình thủ công.
- Marketplace lớp trực tuyến, booking, ví credit, Jitsi, chat và rating/comment.
- Nạp và rút tiền thông qua một payment gateway được chọn sau.

**Out of scope for MVP**

- Ứng dụng native iOS hoặc Android.
- AI matching hoặc recommendation engine.
- Automatic refund.
- Tích hợp cơ sở dữ liệu sinh viên của trường hoặc xác minh tự động bằng email trường.
- Ngôn ngữ ngoài tiếng Việt và tiếng Anh.
- Hệ thống report/moderation chuyên biệt, hàng đợi xử lý report hoặc khóa tài khoản tự động.
- Lớp học ngoại tuyến.

### Dependencies and Assumptions

- Người dùng có tài khoản ngân hàng hoặc ví điện tử phù hợp với payment gateway được chọn.
- Người dùng chấp nhận tải giấy tờ chứng minh tư cách sinh viên.
- Nhóm dự án tuyển được Verifier phù hợp chuyên môn trước khi mở Teacher onboarding.
- Người dùng có kết nối Internet đủ ổn định cho Jitsi.
- Payment gateway hỗ trợ cả nạp tiền và payout hoặc có phương án payout tương đương.
- Tỷ giá 1 credit = 1.000 VND là mặc định ban đầu và có thể được cấu hình sau quyết định nghiệp vụ.

### Outstanding Questions

**Resolve before implementation planning for affected requirements**

1. Danh mục kỹ năng dùng cấu trúc nào và tìm kiếm hoạt động ở cấp nào? Affects R3, R5, R6.
2. Teacher tự đặt giá hay nền tảng áp dụng khung giá? Affects R5, R7-R9.
3. Ngưỡng điểm và số lượng lớp tối thiểu nào làm hồ sơ bị giảm hiển thị hoặc ẩn? Affects R6, R13.
4. Chính sách hủy lớp, no-show, tranh chấp và hoàn tiền thủ công là gì? Affects R7, R9-R11, R13.
5. Điều kiện, giới hạn, phí và thời gian xử lý rút tiền là gì? Affects R10, R14.

**Deferred to product rollout planning**

1. Ra mắt toàn bộ trường cùng lúc hay thử nghiệm tại một số trường trước.
2. Mục tiêu định lượng về số Learner, Teacher, booking thành công và tỷ lệ lớp hoàn thành.
3. Mục tiêu performance, availability, retention và thời hạn lưu giấy tờ xác minh.

### Risks

| Risk | Impact | Likelihood | Mitigation direction |
|---|---|---|---|
| Gian lận nạp/rút và chargeback | Critical | Medium | Chọn gateway có risk controls; audit ledger; review thủ công giao dịch rủi ro. |
| Ledger ghi sai hoặc xử lý trùng | Critical | Medium | Atomic settlement, idempotency, reconciliation và test concurrency. |
| Giấy tờ sinh viên giả | High | Medium | Checklist review, audit reviewer và giới hạn dữ liệu truy cập. |
| Verifier thông đồng với Teacher | High | Medium | Tách vai trò, lưu bằng chứng quyết định và kiểm tra mẫu định kỳ. |
| Tranh chấp/no-show chưa có quy trình | High | High | Chốt chính sách trước khi triển khai booking/settlement. |
| Thiếu Teacher đã xác minh khi ra mắt | High | Medium | Tuyển và xác minh nguồn cung trước khi mở rộng Learner acquisition. |

### Traceability Matrix

| Business goal | Requirements | Flows | Acceptance examples |
|---|---|---|---|
| Xây dựng niềm tin giữa sinh viên | R1-R4, R13 | F1, F2, F4 | AE1, AE2, AE7 |
| Cho phép học kỹ năng trực tuyến | R5-R7, R11, R12 | F3, F4 | AE3, AE6 |
| Thanh toán và nhận thu nhập có thể truy vết | R8-R10, R14 | F3, F5 | AE4, AE5 |
| Vận hành MVP an toàn trên mobile | NFR-001-NFR-006 | F1-F5 | AE1-AE7 |

### Sources

- Product intent: `docs/intent.md`.
- BA Blueprint Agent operating model: `https://github.com/Pen1112003/WS_01_FU`.
- GitHub Project: `https://github.com/users/trankien022/projects/1`.
- Functional requirements: `https://github.com/trankien022/SkillSwap/issues/1` through `https://github.com/trankien022/SkillSwap/issues/14`.
- Open product decisions: `https://github.com/trankien022/SkillSwap/issues/15` through `https://github.com/trankien022/SkillSwap/issues/19`.
