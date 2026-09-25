---
title: SkillSwap MVP Product Requirements Document
type: prd
date: 2026-09-25
topic: skillswap-mvp-product-requirements
status: Ready for Review
owner: Group 4
version: 1.1
---

# SkillSwap MVP Product Requirements Document

**Status:** Ready for Review

**Version:** 1.1

**Owner:** Group 4

**Last updated:** 2026-09-25

**Related document:** SkillSwap-BRD.md

## 1. Product Vision

SkillSwap là marketplace học kỹ năng trực tuyến peer-to-peer dành cho sinh viên, nơi mọi Teacher đều đã được xác minh danh tính và năng lực, mọi giao dịch đều được thanh toán bằng credit có audit trail đầy đủ, và mọi lớp học diễn ra trong một môi trường an toàn qua Jitsi và chat nội bộ có kiểm soát.

**Nguyên tắc thiết kế sản phẩm:**

- Trust by verification — không có tính năng nào bỏ qua bước xác minh bắt buộc.
- Atomic financial integrity — không có trạng thái tài chính thành công một phần.
- Progressive disclosure — MVP ưu tiên luồng chính rõ ràng, các trường hợp biên được xử lý bằng thông báo lỗi hành động được, không phải màn hình chết.
- Mobile-first — mọi màn hình phải dùng được tốt trên viewport 360–390px trước khi tối ưu desktop.

## 2. Personas

### 2.1 Learner — Minh, sinh viên năm 2

Mục tiêu: học tiếng Anh giao tiếp hoặc kỹ năng lập trình cơ bản với chi phí thấp hơn trung tâm. Nỗi đau: không biết Teacher có thực sự giỏi không, sợ mất tiền mà không học được gì, ngại lịch học cố định. Hành vi chính: tìm kiếm theo kỹ năng, xem hồ sơ/rating Teacher, đặt lớp lẻ, tham gia lớp qua điện thoại.

### 2.2 Teacher — Lan, sinh viên năm 4 ngành Thiết kế

Mục tiêu: kiếm thêm thu nhập từ kỹ năng đã có, xây dựng uy tín để dạy nhiều hơn. Nỗi đau: không có kênh nào để chứng minh năng lực, sợ bị quỵt tiền, muốn rút tiền nhanh và minh bạch. Hành vi chính: nộp portfolio để xác minh, công bố lớp theo lịch rảnh, theo dõi ví, rút tiền định kỳ.

### 2.3 Verifier — Thầy Hùng, giảng viên thỉnh giảng

Mục tiêu: đánh giá đúng năng lực chuyên môn trong lĩnh vực mình phụ trách, tốn ít thời gian nhất có thể. Nỗi đau: không có checklist chuẩn hóa, hồ sơ thiếu thông tin phải hỏi lại nhiều lần. Hành vi chính: nhận hồ sơ theo hàng đợi, xem bằng chứng, duyệt hoặc từ chối kèm lý do có cấu trúc.

### 2.4 Administrator — Chị Trang, vận hành nền tảng

Mục tiêu: giữ nền tảng an toàn, xử lý ngoại lệ nhanh, không để hồ sơ tồn đọng. Nỗi đau: khối lượng công việc tăng nhanh khi nền tảng scale, thiếu công cụ lọc/ưu tiên hồ sơ. Hành vi chính: duyệt xác minh sinh viên, quản lý Verifier, xử lý tranh chấp và khóa tài khoản.

## 3. User Journeys

### 3.1 Minh tìm và đặt lớp học tiếng Anh đầu tiên

Minh tạo tài khoản, nhập tên trường và tải thẻ sinh viên, rồi chờ duyệt với trạng thái hiển thị rõ ràng. Trong lúc chờ, Minh vẫn có thể duyệt và tìm kiếm lớp, nhưng nút đặt lớp bị khóa kèm giải thích. Sau khi tài khoản Active, Minh tìm kiếm theo kỹ năng, lọc theo giá và rating, xem hồ sơ Teacher gồm bằng chứng năng lực đã duyệt, số lớp đã dạy và rating trung bình. Minh nạp credit qua gateway; số dư cập nhật sau khi webhook xác nhận. Minh chọn một lớp, hệ thống kiểm tra điều kiện 24 giờ, sức chứa và số dư rồi xác nhận booking tức thì. Minh nhận thông báo nhắc trước giờ học, mở phòng Jitsi qua nút trong app, và sau lớp được mời đánh giá.

### 3.2 Lan đăng ký dạy và nhận thu nhập đầu tiên

Lan đã có tài khoản Learner Active, chọn trở thành Teacher, chọn kỹ năng từ danh mục, tải portfolio và mô tả kinh nghiệm. Hồ sơ vào hàng đợi Verifier đúng chuyên môn và Lan nhận thông báo khi có kết quả. Sau khi được duyệt, Lan công bố lớp đầu tiên với lịch, thời lượng, giá và sức chứa. Có Learner đặt lớp, Lan dạy, lớp hoàn thành. Ví của Lan ghi nhận phần thu nhập ở trạng thái đang chờ xử lý, sau đó chuyển sang khả dụng theo chính sách đã duyệt. Lan yêu cầu rút tiền, xác thực bổ sung, và nhận tiền qua gateway.

### 3.3 Thầy Hùng duyệt hồ sơ Verifier

Thầy Hùng nhận thông báo có hồ sơ mới trong chuyên môn của mình, mở hàng đợi được sắp theo thời gian nộp, xem portfolio và mô tả kinh nghiệm, rồi chọn duyệt hoặc từ chối kèm lý do rõ ràng để Teacher có thể tự sửa và nộp lại.

## 4. Feature List

| Tính năng | Ưu tiên | Yêu cầu liên quan |
|---|---|---|
| Đăng ký/đăng nhập tài khoản hợp nhất Learner/Teacher | Must | FR-001 |
| Nộp và duyệt xác minh sinh viên | Must | FR-002 |
| Re-verification và hết hiệu lực xác minh sinh viên | Must | FR-019 |
| Nộp và duyệt bằng chứng năng lực Teacher | Must | FR-003, FR-004, FR-018 |
| Công bố lớp học | Must | FR-005 |
| Tìm kiếm/duyệt lớp | Must | FR-006 |
| Đặt lớp với kiểm tra điều kiện | Must | FR-007 |
| Nạp tiền qua gateway | Must | FR-008 |
| Ghi nợ/phân bổ ledger khi mua lớp | Must | FR-009 |
| Xem số dư và lịch sử ví | Must | FR-010 |
| Truy cập phòng Jitsi theo booking | Must | FR-011 |
| Chat nội bộ theo lớp | Should | FR-012 |
| Rating/comment sau lớp | Must | FR-013 |
| Yêu cầu rút tiền | Must | FR-014 |
| Quản lý Verifier | Must | FR-004 |
| Bảng điều khiển Admin cho ngoại lệ | Must | FR-015 |
| Thông báo cho các sự kiện trạng thái | Should | FR-016 |
| Theo dõi lifecycle phiên học và xác nhận hoàn tất | Must | FR-020 |

## 5. Functional Requirements

| ID | Type | Requirement | Priority | Source | Status |
|---|---|---|---|---|---|
| FR-001 | Functional | Hệ thống phải cho phép sinh viên tạo, đăng nhập và quản lý một tài khoản dùng cho Learner và đăng ký Teacher. | Must | `docs/intent.md` | Confirmed |
| FR-002 | Functional | Hệ thống phải cho phép sinh viên khai báo tên trường và tải giấy tờ để Administrator phê duyệt hoặc từ chối kèm lý do. | Must | `docs/intent.md` | Confirmed; retention open |
| FR-003 | Functional | Hệ thống phải cho phép ứng viên Teacher nộp kỹ năng, chứng chỉ hoặc bằng chứng năng lực, với cơ chế nộp lại sau khi bị từ chối. | Must | `docs/intent.md` | Confirmed core; taxonomy open |
| FR-004 | Functional | Hệ thống phải cho phép Administrator mời, gán chuyên môn, đình chỉ hoặc thu hồi Verifier; chỉ Verifier phù hợp mới được duyệt hồ sơ Teacher. | Must | `docs/intent.md` | Confirmed |
| FR-005 | Functional | Chỉ Teacher đã được xác minh được tạo và công bố lớp trực tuyến với kỹ năng còn hiệu lực (chưa bị thu hồi/hết hạn), mô tả, lịch không trùng lịch, thời lượng 30–180 phút, giá và quy tắc sức chứa đã được duyệt. | Must | `docs/intent.md` | Confirmed; price/capacity open |
| FR-006 | Functional | Learner phải có thể duyệt và tìm kiếm lớp đang mở theo thông tin lớp và hồ sơ Teacher. | Must | `docs/intent.md` | Confirmed; taxonomy open |
| FR-007 | Functional | Learner chỉ có thể đặt lớp còn khả năng nhận booking, bắt đầu sau ít nhất 24 giờ và kéo dài từ 30 phút đến 3 giờ. | Must | `docs/intent.md` | Confirmed; capacity/refund open |
| FR-008 | Functional | Người dùng phải có thể nạp tiền qua gateway theo tỷ giá áp dụng, với xử lý callback đúng một lần. | Must | `docs/intent.md` | Confirmed core; gateway open |
| FR-009 | Functional | Khi Learner mua lớp, hệ thống phải ghi nợ toàn bộ giá lớp và phân bổ 90% cho Teacher, 10% phí nền tảng, bằng bút toán nguyên tử. | Must | `docs/intent.md` | Confirmed split; release timing open |
| FR-010 | Functional | Chủ ví phải xem được số dư và lịch sử nạp, thanh toán, thu nhập, phí và withdrawal. | Must | `docs/intent.md` | Confirmed core |
| FR-011 | Functional | Learner và Teacher của booking phải có thể truy cập đúng phòng Jitsi trong cửa sổ thời gian cho phép. | Must | `docs/intent.md` | Confirmed core |
| FR-012 | Functional | Các bên thuộc lớp phải có chat nội bộ; người ngoài không được truy cập và chia sẻ liên hệ tuân theo chính sách đã duyệt. | Should | `docs/intent.md` | Confirmed; enforcement open |
| FR-013 | Functional | Sau lớp, Learner phải có thể rating/comment một lần cho mỗi booking hợp lệ. | Must | `docs/intent.md` | Confirmed core; threshold open |
| FR-014 | Functional | Teacher phải có thể yêu cầu rút thu nhập qua gateway với idempotency và ledger đầy đủ. | Must | `docs/intent.md` | Confirmed core; policy/gateway open |
| FR-015 | Functional | Administrator phải có bảng điều khiển tổng hợp gồm hàng đợi xác minh sinh viên, hàng đợi Verifier theo domain, danh sách tranh chấp/khóa tài khoản và log audit có thể lọc theo actor, thời gian và loại hành động. | Must | `docs/intent.md` | Confirmed |
| FR-016 | Functional | Hệ thống phải gửi thông báo khi hồ sơ xác minh có kết quả, booking được xác nhận/hủy, lớp sắp bắt đầu, giao dịch ví hoàn tất và withdrawal có kết quả. | Should | `docs/intent.md` | Confirmed |
| FR-017 | Functional | Learner phải thấy rõ trạng thái tài khoản của mình và lý do nếu bị từ chối, ngay trên màn hình chính. | Must | `docs/intent.md` | Confirmed |
| FR-018 | Functional | Teacher phải xem được lịch sử quyết định cho từng phiên bản bằng chứng năng lực đã nộp, không chỉ trạng thái mới nhất; bằng chứng đã submit bị khóa chỉnh sửa, thay đổi phải tạo phiên bản mới có audit trail. | Must | `docs/intent.md`, BRD BR-014 | Confirmed |
| FR-019 | Functional | Hệ thống phải hỗ trợ re-verification và tự động hạ quyền truy cập khi trạng thái xác minh sinh viên hết hiệu lực hoặc bị thu hồi, bao gồm cascade tới các quyền được cấp theo trạng thái VERIFIED. | Must | BRD BR-006 | Confirmed; policy open (OQ-008) |
| FR-020 | Functional | Hệ thống phải quản lý trạng thái phiên học (Scheduled → In progress → Completed/Cancelled) và chỉ coi session là Completed khi thỏa quy tắc hoàn tất; trạng thái COMPLETED là cơ sở cho settlement, rating và các nghiệp vụ sau lớp. | Must | BRD BR-042–BR-043 | Confirmed core; completion rule open (OQ-006) |

### Business rules

Toàn văn 70 quy tắc nghiệp vụ (BR-001–BR-070) được quản lý tập trung tại BRD §7; bảng dưới đây là ánh xạ truy vết sang yêu cầu chức năng.

| ID | Quy tắc (tóm tắt) | Governs |
|---|---|---|
| BR-001 | Hoàn tất xác minh sinh viên trước các chức năng yêu cầu VERIFIED trên marketplace. | FR-002, FR-017 |
| BR-002 | Yêu cầu xác minh gồm tên trường và ảnh thẻ sinh viên/giấy xác nhận đang theo học. | FR-002 |
| BR-003 | Admin xem xét thủ công; không dùng cơ sở dữ liệu trường hoặc email domain. | FR-002, FR-015 |
| BR-004 | Trạng thái UNVERIFIED/PENDING/VERIFIED/REJECTED; quyền truy cập theo trạng thái. | FR-002, FR-017 |
| BR-005 | Lưu tài liệu, trường, submitted_at, status, reviewer, reviewed_at, lý do từ chối. | FR-002, FR-015 |
| BR-006 | Quy tắc re-verification/hết hiệu lực trạng thái sinh viên. | FR-019 |
| BR-007 | Chỉ sinh viên VERIFIED mới trở thành Teacher và nộp xác minh kỹ năng. | FR-003 |
| BR-008 | Chỉ publish lớp cho skill đã được Verifier chấp thuận. | FR-005 |
| BR-009 | Xác minh Teacher quản lý theo từng skill, không phải trạng thái chung. | FR-003, FR-005 |
| BR-010 | Skill verification có NOT_SUBMITTED/PENDING/VERIFIED/REJECTED (+REVOKED/EXPIRED). | FR-003, FR-005 |
| BR-011 | Verifier là nhóm riêng, được mời, có chuyên môn; không đồng nhất với Admin. | FR-004 |
| BR-012 | Verifier không được tự xác minh yêu cầu của chính mình. | FR-004, NFR-009 |
| BR-013 | Teacher không được tự chọn Verifier. | FR-004 |
| BR-014 | Bằng chứng đã submit bị khóa chỉnh sửa; thay đổi tạo phiên bản mới có audit trail. | FR-018 |
| BR-015 | Chỉ publish class khi Teacher VERIFIED và skill VERIFIED tương ứng. | FR-005 |
| BR-016 | Class có tối thiểu tiêu đề, skill, mô tả, giá, thời lượng, lịch, Teacher, online, sức chứa. | FR-005 |
| BR-017 | Session tối thiểu 30 phút, tối đa 180 phút. | FR-005, FR-007 |
| BR-018 | MVP chỉ tổ chức class online. | FR-005, FR-011 |
| BR-019 | Không publish session trùng lịch vượt khả năng tham gia của Teacher. | FR-005 |
| BR-020 | Không mở lớp mới cho skill đã REVOKED/EXPIRED. | FR-005 |
| BR-021 | Đặt lớp trước giờ bắt đầu ít nhất 24 giờ. | FR-007 |
| BR-022 | Chỉ xác nhận booking khi available balance đủ trả toàn bộ giá lớp. | FR-007, FR-009 |
| BR-023 | Wallet balance không được âm. | FR-009, NFR-003 |
| BR-024 | Một Learner chỉ có một booking hợp lệ cho cùng session. | FR-007 |
| BR-025 | Đạt maximum capacity thì ngừng nhận booking và phản ánh FULL. | FR-005, FR-007 |
| BR-026 | Tạo booking và ghi payment phải nguyên tử, không có thành công một phần. | FR-009, AC-005 |
| BR-027 | Credit nội bộ; tỷ giá 1 credit = 1.000 VND, có khả năng cấu hình. | FR-008, FR-010, FR-014 |
| BR-028 | Nạp tiền thật qua gateway; không thanh toán trực tiếp cho Teacher. | FR-008 |
| BR-029 | Mọi biến động số dư ghi vào ledger và transaction history. | FR-010 |
| BR-030 | Ledger là nguồn kiểm toán số dư; không cập nhật balance không đi kèm bút toán. | FR-009, FR-010 |
| BR-031 | Transaction COMPLETED không sửa/xóa; điều chỉnh bằng reversal/adjustment mới. | FR-010, NFR-003, NFR-005 |
| BR-032 | Callback gateway chỉ cộng credit một lần; top-up idempotent. | FR-008, EVT-001 |
| BR-033 | Ngăn double charge/double credit/mất credit khi retry, timeout, callback trùng. | FR-008, NFR-003 |
| BR-034 | Platform thu 10% commission mỗi class transaction. | FR-009 |
| BR-035 | Commission tính trên giá trị transaction của class. | FR-009 |
| BR-036 | Teacher nhận phần còn lại sau commission. | FR-009, FR-014 |
| BR-037 | Product định nghĩa quy tắc làm tròn commission, áp dụng nhất quán. | FR-009, OQ-012 |
| BR-038 | Thu nhập class chưa hoàn tất ở trạng thái pending/held, không withdraw được. | FR-009, FR-014, OQ-006 |
| BR-039 | Online session dùng Jitsi theo Intent MVP. | FR-011 |
| BR-040 | Chỉ Teacher và Learner có booking hợp lệ truy cập room/session. | FR-011 |
| BR-041 | Thông tin video room không công khai; truy cập theo booking/session. | FR-011, NFR-009 |
| BR-042 | Session có lifecycle SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED (hoặc tương đương). | FR-020 |
| BR-043 | Quy tắc xác định session COMPLETED làm cơ sở settlement, rating, nghiệp vụ sau lớp. | FR-020, FR-013 |
| BR-044 | Phải có refund/cancellation policy định nghĩa trước khi launch. | FR-007, OQ-003 |
| BR-045 | Xác định xử lý khi Teacher hủy lớp trước giờ học. | FR-007, OQ-003 |
| BR-046 | Xác định xử lý khi Learner hủy booking, gồm mốc thời gian và mức hoàn. | FR-007, OQ-003 |
| BR-047 | Xác định xử lý Teacher no-show và Learner no-show. | FR-007, OQ-003 |
| BR-048 | Refund/adjustment thủ công thực hiện qua ledger transaction có audit trail. | FR-010, NFR-003 |
| BR-049 | Chỉ Learner có booking hợp lệ và session COMPLETED được rating Teacher. | FR-013, FR-020 |
| BR-050 | Mỗi Learner một review hoạt động cho mỗi booking. | FR-013 |
| BR-051 | Không review trước khi session COMPLETED. | FR-013, FR-020 |
| BR-052 | Rating aggregate chỉ tính từ review hợp lệ gắn booking/session hợp lệ. | FR-006, FR-013 |
| BR-053 | Threshold và minimum review count phải định nghĩa trước khi giảm visibility. | FR-006, OQ-004 |
| BR-054 | MVP không có report/moderation workflow; rating là cơ chế trust chính. | FR-013 |
| BR-055 | Trao đổi giữa Learner và Teacher diễn ra trong messaging của platform. | FR-012 |
| BR-056 | Hạn chế/cảnh báo chia sẻ số điện thoại, email, mạng xã hội. | FR-012, OQ-009 |
| BR-057 | Quyền chat gắn với quan hệ nghiệp vụ hợp lệ (class/booking). | FR-012 |
| BR-058 | Teacher chỉ rút từ available balance; pending/held không rút được. | FR-014 |
| BR-059 | Số tiền withdrawal không vượt quá available balance. | FR-014 |
| BR-060 | Withdrawal có lifecycle REQUESTED/PROCESSING/COMPLETED/FAILED (hoặc tương đương). | FR-014 |
| BR-061 | Withdrawal COMPLETED không sửa/xóa; điều chỉnh bằng transaction mới. | FR-014, NFR-003 |
| BR-062 | Product định nghĩa min/max, phí, processing time, failed payout trước launch. | FR-014, OQ-005 |
| BR-063 | Một tài khoản có thể vừa Learner vừa Teacher; không bắt buộc tách account. | FR-001 |
| BR-064 | Admin lo student verification; Verifier lo skill/certificate, không mặc định có quyền Admin. | FR-004, FR-015 |
| BR-065 | Tạo class giới hạn Teacher có skill hợp lệ; verify skill chỉ dành cho Verifier. | FR-004, FR-005 |
| BR-066 | Hành động tài chính/verification/chuyển trạng thái quan trọng lưu actor, timestamp, audit. | FR-015, NFR-005 |
| BR-067 | MVP chỉ hỗ trợ tiếng Việt và tiếng Anh. | NFR-002 |
| BR-068 | Teacher không được tự đặt hoặc tự đánh giá lớp của chính mình. | FR-007, FR-013 |
| BR-069 | Credit không được quy đổi ngược thành tiền mặt ngoài luồng withdrawal chính thức. | FR-014, NFR-003 |
| BR-070 | Một tài khoản chỉ có một hồ sơ xác minh sinh viên hiệu lực tại một thời điểm. | FR-002 |

## 6. Detailed Screen Requirements

### 6.1 Xác thực và tài khoản

Đăng ký bằng email và mật khẩu hoặc OAuth. Một tài khoản có thể mang cả hai vai trò Learner và Teacher, với chế độ xem rõ ràng để chuyển đổi giữa hai vai trò. Khôi phục mật khẩu qua email theo luồng chuẩn.

### 6.2 Xác minh sinh viên

Form gồm tên trường (autocomplete), mã số sinh viên tùy chọn, và tải file ảnh/PDF tối đa 10MB. Trạng thái hiển thị rõ ràng: Pending, Active, Rejected kèm lý do và nút nộp lại. Hàng đợi Admin sắp xếp theo thời gian nộp, có bộ lọc theo trường và xem trước file trong khung an toàn.

### 6.3 Xác minh năng lực Teacher

Chọn kỹ năng từ taxonomy, tải nhiều file bằng chứng và mô tả kinh nghiệm. Hàng đợi Verifier lọc theo domain được gán, hiển thị đầy đủ bằng chứng, với lý do bắt buộc khi từ chối.

### 6.4 Công bố lớp

Form gồm kỹ năng đã được duyệt, tiêu đề, mô tả, ngày giờ, thời lượng, giá và sức chứa. Validation áp dụng cả ở client và server cho thời lượng, giá và trùng lịch. Trạng thái lớp gồm Draft, Published, Full, Closed và Cancelled.

### 6.5 Tìm kiếm và duyệt lớp

Bộ lọc theo kỹ năng, khoảng giá, khoảng thời gian và rating tối thiểu. Sắp xếp theo mức độ liên quan, giá, rating hoặc thời gian diễn ra. Thẻ lớp hiển thị Teacher, kỹ năng, giá, thời lượng, số chỗ còn lại và rating.

### 6.6 Đặt lớp và ví

Màn hình xác nhận đặt lớp hiển thị giá, số dư hiện tại, số dư sau giao dịch và chính sách hủy. Lỗi số dư không đủ dẫn thẳng vào luồng nạp tiền mà không mất lựa chọn lớp đang đặt. Trang ví hiển thị số dư khả dụng, số dư đang chờ và lịch sử giao dịch có thể lọc theo loại và khoảng thời gian.

### 6.7 Phòng học và chat

Nút vào lớp chỉ hoạt động trong cửa sổ thời gian cho phép. Chat dạng văn bản, lưu lịch sử trong phạm vi booking, cảnh báo khi phát hiện mẫu số điện thoại hoặc email theo chính sách đã duyệt.

### 6.8 Đánh giá

Modal xuất hiện sau khi rời phòng Jitsi cho booking đã hoàn thành, cho phép chọn điểm và bình luận, không cho gửi lần hai.

### 6.9 Rút tiền

Màn hình ví Teacher có nút rút tiền, nhập số tiền không vượt quá số dư khả dụng, chọn phương thức nhận và xác thực bổ sung. Trạng thái Pending, Processing, Completed hoặc Failed; khi Failed, số dư được hoàn lại ngay và hiển thị lý do.

### 6.10 Bảng điều khiển Administrator

Bốn khu vực chính: hàng đợi xác minh sinh viên, hàng đợi Verifier theo domain, danh sách tranh chấp và ngoại lệ, và log audit có thể tìm kiếm theo actor, loại hành động và khoảng thời gian.

## 7. Non-Functional Requirements

| ID | Category | Target | Measurement | Priority | Owner |
|---|---|---|---|---|---|
| NFR-001 | Responsive UX | Không cuộn ngang ở 360px, 390px và desktop; touch target đủ lớn. | Browser tests ở các viewport chính. | Must | Engineering/QA |
| NFR-002 | Localization | Hỗ trợ tiếng Việt và tiếng Anh không trộn ngôn ngữ trên cùng màn hình. | Locale coverage review toàn bộ route MVP. | Should | Product/QA |
| NFR-003 | Financial integrity | Retry hoặc yêu cầu đồng thời tạo một kết quả tài chính cân bằng duy nhất và không tạo số dư âm. | Idempotency, concurrency và reconciliation tests. | Must | Engineering/QA |
| NFR-004 | Privacy | Chỉ chủ sở hữu và reviewer được ủy quyền mới truy cập được tài liệu xác minh. | Role/ownership matrix tests và audit review. | Must | Security/QA |
| NFR-005 | Auditability | Top-up, booking settlement và payout có trace ID xuyên suốt, không lộ secret trong log. | Trace một giao dịch mẫu qua gateway, API và ledger. | Must | Engineering/Operations |
| NFR-006 | Recoverability | Lỗi validation/gateway/Jitsi giữ được input có thể khôi phục và hiển thị lỗi hành động được. | Negative-path tests cho form, gateway và Jitsi. | Should | Product/QA |
| NFR-007 | Accessibility | Luồng chính đạt WCAG 2.2 AA, hỗ trợ điều hướng bàn phím, focus rõ ràng và nhãn cho screen reader. | Automated checks và manual keyboard/screen-reader review. | Must | Product/QA |
| NFR-008 | Upload security | File xác minh vượt qua allowlist định dạng/nội dung/kích thước, quét malware và preview cách ly. | Bộ test file độc hại/không khớp định dạng. | Must | Security/QA |
| NFR-009 | Application security | Server-side authorization bảo vệ mọi hành động đặc quyền; Administrator/Verifier dùng MFA. | Authorization matrix, session và MFA tests. | Must | Security/QA |
| NFR-010 | Content security | Nội dung chat/rating được xử lý như untrusted và render không có markup thực thi được. | Stored-XSS tests và kiểm tra Content Security Policy. | Must | Security/QA |
| NFR-011 | Performance | Trang tìm kiếm trả kết quả nhanh với quy mô dữ liệu ở mức MVP. | Load test cơ bản. | Should | Engineering |
| NFR-012 | Availability | Mức uptime phù hợp cho giai đoạn pilot. | Theo dõi uptime monitoring. | Should | Engineering/Operations |

## 8. Information Architecture

Các màn hình chính của MVP gồm: đăng ký/đăng nhập, trang chủ Learner với tìm kiếm, chi tiết lớp, xác nhận đặt lớp, hồ sơ xác minh sinh viên, đăng ký Teacher, bảng điều khiển Teacher, công bố/chỉnh sửa lớp, ví, phòng học kèm chat, modal đánh giá, hồ sơ công khai Teacher, bảng điều khiển Verifier, bảng điều khiển Administrator, và trung tâm thông báo.

## 9. Data Model

| Entity | Key fields | Relationships | Lifecycle | Classification | Owner |
|---|---|---|---|---|---|
| User | id, roles, school_name, verification_status | Has verification, wallet, classes/bookings | Pending → Active → Suspended | PII | User/Admin |
| StudentVerification | id, user_id, document_ref, status, reviewer_id, reason, expires_at | Belongs to User | Draft → Pending → Approved/Rejected/Expired | Sensitive identity document | Administrator |
| SkillEvidence | id, teacher_id, skill_id, document_ref, version, status | Belongs to Teacher and Skill | Draft → Pending → Approved/Rejected/Superseded; Approved → Revoked/Expired | Sensitive credential | Teacher/Verifier |
| VerifierAssignment | id, verifier_id, domain, status, assigned_by | Links Verifier to review domain | Invited → Active → Suspended/Revoked | Internal access-control data | Administrator |
| Class | id, teacher_id, skill_id, schedule, duration, price, capacity, status | Has Bookings | Draft → Published → Full/Closed/Cancelled | Public marketplace data | Teacher |
| Session | id, class_id, start_at, end_at, status | One per schedule slot of Class; referenced by Booking and Rating | Scheduled → In progress → Completed/Cancelled | Private schedule data | Teacher/Platform |
| Booking | id, class_id, learner_id, status, settlement_id | Links Class, Learner and ledger | Pending → Confirmed → Completed/Cancelled/Disputed | Private transaction data | Learner/Teacher |
| Wallet | id, user_id, available_balance, pending_balance | Has ledger entries | Active → Restricted/Closed | Financial | User/Platform |
| LedgerTransaction | id, wallet_id, type, amount, rate, status, trace_id, idempotency_key | Links top-up, booking or withdrawal | Pending → Posted/Reversed/Failed | Sensitive financial | Platform |
| Message | id, class_id, sender_id, body, created_at | Belongs to class conversation | Active → Retained/Deleted | Private communication | Participants/Platform |
| Rating | id, booking_id, learner_id, score, comment | One policy-valid rating per Booking | Published → Hidden/Updated by policy | Public content + private provenance | Learner/Platform |
| WithdrawalRequest | id, teacher_id, amount, destination_ref, status, trace_id | Produces ledger entries | Pending → Processing → Completed/Failed/Reversed | Sensitive financial | Teacher/Platform |

Access is server-authorized by role and ownership. Sensitive files are encrypted in transit and at rest, stored outside executable paths, and never written to application logs.

## 10. API and Integration Contract

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

### API-005 request/response example

```json
{
  "idempotency_key": "b8f1c2...",
  "learner_id": "usr_123",
  "class_id": "cls_456"
}
```

```json
{
  "booking_id": "bkg_789",
  "status": "confirmed",
  "class_id": "cls_456",
  "ledger_transaction_id": "ldg_001",
  "wallet_balance_after": 100
}
```

### EVT-001 request example

```json
{
  "provider_event_id": "evt_gw_0001",
  "transaction_reference": "top_up_555",
  "occurred_at": "2026-09-22T10:15:00+07:00",
  "status": "succeeded",
  "signature": "..."
}
```

**Integration rules:** Gateway webhook signatures, timestamps and replay protection are mandatory. Mỗi provider event ID chỉ được áp dụng một lần. Trạng thái chỉ chuyển theo ma trận đơn điệu do contract gateway định nghĩa; callback hợp lệ nhưng cũ hơn trạng thái đã xử lý được acknowledge và bỏ qua. `Completed → Reversed` chỉ được chấp nhận từ một reversal event mới, hợp lệ; reconciliation là nguồn phục hồi khi thứ tự hoặc trạng thái không thống nhất. All commands with financial effect require an idempotency key and trace ID. Provider secrets are stored outside source control, separated by environment and rotatable. Jitsi access uses short-lived authorization rather than a discoverable public room link.

## 11. Use Cases and User Stories

### UC-001: Verify a student

Actor: Student, Administrator. Trigger: người dùng yêu cầu xác minh tư cách sinh viên. Main flow: nộp tên trường và giấy tờ, hồ sơ Pending, Administrator review, Approved. Alternate flow: tệp không hợp lệ bị từ chối, hồ sơ Reject phải có lý do, người dùng sửa và nộp lại. Postconditions: trạng thái, reviewer, thời gian và lý do được audit.

### UC-002: Verify a Teacher skill

Actor: Teacher candidate, Verifier, Administrator. Trigger: sinh viên đã xác minh muốn dạy một kỹ năng. Main flow: nộp bằng chứng, phân công Verifier, review, kỹ năng Approved. Alternate flow: thiếu dữ liệu, sai chuyên môn hoặc Reject; Teacher xem lý do và nộp phiên bản mới. Postconditions: chỉ kỹ năng Approved được dùng để công bố lớp.

### UC-003: Book and pay for a class

Actor: Learner, Teacher, Wallet. Trigger: Learner chọn lớp đang mở. Main flow: kiểm tra điều kiện, giữ chỗ, ghi booking và ledger nguyên tử, xác nhận. Alternate flow: không đủ số dư, hết chỗ, booking trùng hoặc settlement lỗi thì không tạo trạng thái thành công một phần. Postconditions: booking và bút toán có cùng kết quả.

### UC-004: Attend and review

Actor: Learner, Teacher, Jitsi. Trigger: booking hợp lệ đến thời gian diễn ra. Main flow: mở phòng, học/chat, kết thúc, Learner gửi rating/comment. Alternate flow: người ngoài hoặc truy cập sai thời gian bị từ chối. Postconditions: tham gia, sự cố và review gắn với booking.

### UC-005: Withdraw earnings

Actor: Teacher, Payment gateway. Trigger: Teacher yêu cầu rút số dư khả dụng. Main flow: step-up authentication, tạo withdrawal, gateway payout, callback, ledger Completed. Alternate flow: timeout/failure giữ số dư nhất quán; callback lặp không payout hai lần. Postconditions: trạng thái payout và trace ID hiển thị trong lịch sử ví.

### User stories

| ID | Story | Priority | Dependency |
|---|---|---|---|
| US-001 | As a student, I want to submit enrollment evidence, so that I can use a trusted student marketplace. | Must | FR-001–FR-002 |
| US-002 | As a Teacher candidate, I want my skill evidence reviewed, so that I can teach approved skills. | Must | FR-002–FR-004 |
| US-003 | As a Learner, I want to find and book a valid class, so that I can learn within my schedule and budget. | Must | FR-005–FR-009 |
| US-004 | As a participant, I want secure class access and internal chat, so that I can attend without sharing personal contact details. | Must | FR-007, FR-011, FR-012 |
| US-005 | As a Learner, I want to review a completed class, so that future Learners can assess quality. | Must | FR-011, FR-013 |
| US-006 | As a Teacher, I want to withdraw available earnings, so that teaching produces real income. | Must | FR-009, FR-010, FR-014 |

## 12. Acceptance Criteria

- **AC-001 / FR-002:** Given tên trường và một tệp hợp lệ, when người dùng gửi hồ sơ, then hồ sơ ở trạng thái Pending và Administrator có thể review.
- **AC-002 / FR-003–FR-005:** Given kỹ năng chưa được duyệt, when Teacher cố công bố lớp, then hệ thống từ chối và hướng dẫn hoàn tất xác minh.
- **AC-003 / FR-007:** Given lớp bắt đầu sau dưới 24 giờ, when Learner đặt, then hệ thống không tạo booking hoặc trừ credit.
- **AC-004 / FR-009:** Given lớp giá 100 credit và Learner đủ số dư, when mua, then ledger ghi nợ 100, phân bổ 90 cho Teacher theo trạng thái settlement, ghi 10 phí và chỉ tạo một booking.
- **AC-005 / FR-009:** Given một bước settlement lỗi, when transaction kết thúc, then không có booking hoặc số dư ở trạng thái thành công một phần.
- **AC-006 / FR-011:** Given người dùng không thuộc booking hoặc truy cập ngoài thời gian cho phép, when mở phòng, then hệ thống từ chối.
- **AC-007 / FR-013:** Given lớp đã kết thúc và Learner thuộc booking, when gửi rating/comment hợp lệ, then review được gắn với booking và không bị tạo trùng trái chính sách.
- **AC-008 / FR-014:** Given callback payout hợp lệ được gửi lại, when hệ thống xử lý, then withdrawal chỉ hoàn tất một lần.
- **AC-009 / EVT-001:** Given một callback hợp lệ nhưng cũ hơn trạng thái gateway đã xử lý, when callback đến muộn, then hệ thống acknowledge nhưng không hạ trạng thái.
- **AC-010 / FR-007:** Given lớp chỉ còn một chỗ, when hai Learner đặt gần như đồng thời, then chỉ một booking được xác nhận và người còn lại nhận lỗi hết chỗ mà không bị trừ credit.
- **AC-011 / FR-020:** Given một session đã tới giờ diễn ra, when các bên tham gia và buổi học kết thúc thỏa điều kiện hoàn tất, then session chuyển sang Completed và cho phép rating cùng giải ngân thu nhập; nếu bị hủy thì không phát sinh settlement và Learner được xử lý theo chính sách hủy.
- **AC-012 / FR-019:** Given một hồ sơ xác minh sinh viên đã hết hiệu lực hoặc bị thu hồi, when hệ thống xử lý sự kiện, then các quyền yêu cầu VERIFIED bị hạ ngay và người dùng thấy trạng thái kèm hướng dẫn re-verification.

```gherkin
Feature: Đặt lớp học

  Scenario: Đặt lớp thành công khi đủ điều kiện
    Given Learner đã Active và có số dư 150 credit
    And lớp giá 100 credit bắt đầu sau 48 giờ, còn 1 chỗ
    When Learner xác nhận đặt lớp
    Then booking chuyển trạng thái "confirmed"
    And số dư Learner giảm còn 50 credit
    And ví Teacher ghi nhận 90 credit ở "pending_balance"
    And tài khoản phí nền tảng ghi nhận 10 credit

  Scenario: Từ chối đặt lớp khi dưới 24 giờ
    Given lớp bắt đầu sau 10 giờ
    When Learner cố gắng đặt lớp
    Then hệ thống từ chối và không tạo booking
    And không có credit nào bị trừ

  Scenario: Webhook payout gửi lại
    Given một withdrawal đã Completed với provider_event_id "evt_001"
    When gateway gửi lại cùng "evt_001"
    Then hệ thống ghi nhận acknowledge nhưng không thực hiện payout lần hai
```

## 13. Security, Privacy and Compliance

Authentication và authorization dùng server-side role/ownership check cho mọi endpoint. Administrator và Verifier yêu cầu MFA; payout và thay đổi thông tin nhận tiền yêu cầu step-up authentication. Student ID, chứng chỉ, đích payout và lịch sử tài chính là dữ liệu nhạy cảm, được mã hóa in transit/at rest và loại khỏi log. File tải lên được kiểm tra extension, MIME và file signature, giới hạn kích thước, quét malware, lưu ngoài executable path và preview cách ly. Webhook thanh toán được xác thực chữ ký, timestamp và replay nonce, dùng idempotency key, và secret được tách theo môi trường và có thể rotate. Nội dung chat/rating không tin cậy được encode theo ngữ cảnh và tuân thủ Content Security Policy. Jitsi cấp quyền ngắn hạn chỉ cho các bên trong booking trong cửa sổ thời gian cho phép. Hành động đặc quyền, quyết định xác minh, thay đổi vai trò, chuyển trạng thái tài chính và thay đổi đích payout được ghi audit với actor, thời gian và trace ID.

## 14. Delivery Plan and Dependencies

| Increment | Scope | Dependency | Exit criteria | Risk |
|---|---|---|---|---|
| 1 | Kiến trúc nền, xác thực tài khoản, khung bảng điều khiển Admin. | Product Owner, Engineering, Finance/Security | Quyết định cần cho Increment 2 được phê duyệt. | High |
| 2 | Xác minh sinh viên, thông báo trạng thái. | Increment 1 | UC-001 pass toàn bộ acceptance criteria. | High |
| 3 | Đăng ký/xác minh Teacher, quản lý Verifier, công bố lớp. | Increment 2 | UC-002 pass; chỉ kỹ năng Approved công bố được lớp. | High |
| 4 | Tìm kiếm, đặt lớp, ví, gateway, ledger, rút tiền. | Increment 3 | UC-003, UC-005 pass; test concurrency và idempotency. | Critical |
| 5 | Jitsi, chat, rating, hoàn thiện mobile/accessibility. | Increment 4 | UC-004 pass; các NFR liên quan pass. | High |

## 15. Traceability Matrix

| Business goal | Requirement | Use case/story | API/data/NFR | Test evidence |
|---|---|---|---|---|
| Trusted student identity | FR-001–FR-002, FR-015–FR-017, FR-019 | UC-001, US-001 | API-001, User, StudentVerification, NFR-004/NFR-008/NFR-009 | Pending implementation |
| Trusted Teacher capability | FR-003–FR-005, FR-018 | UC-002, US-002 | API-002–API-004, SkillEvidence, VerifierAssignment, NFR-004/NFR-009 | Pending implementation |
| Discover and book online learning | FR-005–FR-007 | UC-003, US-003 | API-004–API-005, Class, Booking, NFR-001/NFR-006/NFR-007 | Pending implementation |
| Traceable wallet settlement | FR-008–FR-010, FR-014, FR-020 | UC-003, UC-005, US-003/US-006 | API-005–API-007, EVT-001, Wallet/Ledger/Withdrawal/Session, NFR-003/NFR-005/NFR-009 | Pending implementation |
| Secure class participation | FR-011–FR-013, FR-016, FR-020 | UC-004, US-004/US-005 | API-008–API-010, Message/Rating/Session, NFR-006/NFR-007/NFR-010 | Pending implementation |
