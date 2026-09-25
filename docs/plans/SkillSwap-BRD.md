---
title: SkillSwap MVP Business Requirements Document
type: brd
date: 2026-09-25
topic: skillswap-mvp-business-requirements
status: Ready for Review
owner: Group 4
version: 1.1
---

# SkillSwap MVP Business Requirements Document

**Status:** Ready for Review

**Version:** 1.1

**Owner:** Group 4

**Last updated:** 2026-09-25

**Approval decision:** Pending Product Owner, Finance and Security review

## 1. Document Purpose

Tài liệu này mô tả lý do kinh doanh, mục tiêu, phạm vi, quy tắc nghiệp vụ và rủi ro của SkillSwap ở mức đủ chi tiết để Product Owner, Sponsor và các bên liên quan phê duyệt đầu tư trước khi Engineering bắt đầu thiết kế giải pháp.

## 2. Business Background

### 2.1 Bối cảnh thị trường

Sinh viên Việt Nam có nhu cầu học các kỹ năng thực hành (ngoại ngữ, lập trình, thiết kế, âm nhạc, kỹ năng mềm) nhưng ngân sách hạn chế và không tin tưởng các nền tảng dạy-kèm không rõ danh tính người dạy. Sinh viên có năng lực muốn kiếm thu nhập bằng cách dạy lại kỹ năng của mình nhưng thiếu kênh phân phối, hệ thống thanh toán và cơ chế xây dựng uy tín. Các nền tảng hiện có (gia sư truyền thống, nhóm Facebook, các sàn freelance) không giải quyết được ba vấn đề cốt lõi: xác thực danh tính sinh viên hai chiều, xác minh năng lực chuyên môn bởi bên thứ ba đáng tin, và thanh toán có audit trail rõ ràng bằng đơn vị tiền tệ nội bộ.

### 2.2 Vấn đề kinh doanh

Sinh viên muốn học kỹ năng thực tế với chi phí phù hợp nhưng thiếu một kênh đáng tin cậy để tìm, đánh giá và thanh toán cho người dạy là sinh viên có năng lực. Nếu không giải quyết: Learner không tìm được Teacher đáng tin nên không dùng nền tảng, khiến nền tảng không có thanh khoản hai chiều; Teacher không có kênh chuẩn hóa để định giá và nhận thu nhập minh bạch nên rời bỏ nền tảng; thiếu audit trail tài chính tạo rủi ro tranh chấp, gian lận và mất niềm tin của các bên liên quan.

### 2.3 Cơ hội kinh doanh

Thị trường ngách "peer-to-peer, được xác minh, trong cộng đồng sinh viên" chưa có người dẫn đầu rõ ràng tại Việt Nam. Mô hình phí nền tảng 10%/giao dịch tạo dòng doanh thu trực tiếp ngay từ giao dịch đầu tiên, không phụ thuộc quảng cáo. Cơ chế ví credit nội bộ giảm phí xử lý thanh toán so với thanh toán trực tiếp mỗi lớp, đồng thời tạo hiệu ứng giữ chân người dùng hợp lý.

## 3. Business Objectives

| ID | Mục tiêu kinh doanh | Mô tả | Liên kết success metric |
|---|---|---|---|
| BO-001 | Xây dựng nguồn cung Teacher đáng tin | Có đủ Teacher đã xác minh để đảm bảo Learner luôn tìm được lớp phù hợp trong các danh mục kỹ năng ưu tiên. | Số Teacher đã xác minh |
| BO-002 | Chuyển đổi tìm kiếm thành giao dịch | Tối đa hóa tỷ lệ Learner tìm kiếm dẫn đến đặt lớp thành công. | Tỷ lệ tìm kiếm dẫn đến booking |
| BO-003 | Đảm bảo trải nghiệm học hoàn chỉnh | Phần lớn lớp đã đặt phải diễn ra và kết thúc thành công. | Tỷ lệ lớp hoàn thành |
| BO-004 | Đảm bảo toàn vẹn tài chính | Ledger credit phải chính xác, có thể truy vết, không có giao dịch treo. | Tỷ lệ giao dịch ledger thành công |
| BO-005 | Tạo nguồn doanh thu bền vững | Phí nền tảng 10%/giao dịch phải đủ để trang trải chi phí vận hành và xác minh thủ công. | Doanh thu phí trên mỗi Teacher hoạt động |

Giá trị mục tiêu cụ thể cho từng success metric là quyết định OQ-010, chưa được Product Owner phê duyệt.

### 3.1 Non-goals

MVP chủ đích không theo đuổi tăng trưởng đa quốc gia hay đa ngôn ngữ ngoài Việt/Anh, không theo đuổi tự động hóa matching bằng AI trước khi kiểm chứng mô hình thủ công, và không theo đuổi ứng dụng di động native trước khi xác nhận nhu cầu qua web mobile-first.

## 4. Scope

### 4.1 In scope

| Nhóm | Nội dung |
|---|---|
| Nền tảng | Web responsive, mobile-first, hỗ trợ các trình duyệt hiện hành trên di động và desktop. |
| Vai trò người dùng | Learner, Teacher, Verifier, Administrator. |
| Xác minh | Xác minh sinh viên thủ công (tên trường và giấy tờ); xác minh năng lực Teacher thủ công theo từng kỹ năng, bởi Verifier đúng chuyên môn. |
| Marketplace | Tạo/công bố lớp, tìm kiếm/duyệt lớp, đặt lớp theo sức chứa. |
| Tài chính | Ví credit nội bộ, nạp tiền qua gateway, trừ tiền khi booking, phân bổ 90/10, rút tiền cho Teacher. |
| Học trực tuyến | Phòng học Jitsi được cấp quyền theo booking, có giới hạn thời gian truy cập. |
| Giao tiếp | Chat nội bộ giới hạn trong phạm vi lớp/booking. |
| Đánh giá | Rating/comment sau khi lớp kết thúc, một lần cho mỗi booking hợp lệ. |
| Vận hành | Audit trail cho xác minh, booking và giao dịch tài chính; công cụ Admin để duyệt/từ chối/xử lý ngoại lệ. |

### 4.2 Out of scope

| Hạng mục | Lý do loại trừ |
|---|---|
| Ứng dụng native iOS/Android | Web responsive đủ để kiểm chứng mô hình kinh doanh ở giai đoạn MVP. |
| AI matching/recommendation | Cần dữ liệu hành vi người dùng thực tế trước khi đầu tư mô hình. |
| Automatic refund | Cần chính sách hủy/tranh chấp được duyệt trước; hoàn tiền tự động không kiểm soát có thể bị lạm dụng. |
| Tích hợp dữ liệu sinh viên của trường | Không có thỏa thuận API với các trường ở giai đoạn MVP. |
| Report/moderation chuyên biệt | Khối lượng người dùng MVP nhỏ; Admin xử lý thủ công qua kênh hỗ trợ. |
| Lớp học ngoại tuyến | Vấn đề an toàn cá nhân và logistics vượt phạm vi kiểm chứng mô hình số. |
| Ngôn ngữ ngoài Việt/Anh | Thị trường mục tiêu ban đầu là sinh viên Việt Nam. |

### 4.3 Ranh giới hệ thống

SkillSwap không xử lý tiền mặt trực tiếp; mọi dòng tiền đi qua Payment Gateway đã chọn. SkillSwap không lưu trữ media cuộc gọi Jitsi, chỉ cấp token truy cập có thời hạn.

## 5. Stakeholders and RACI

| ID | Vai trò | Trách nhiệm chi tiết |
|---|---|---|
| ST-001 | Learner | Tìm kiếm, đặt, thanh toán bằng credit, tham gia lớp, chat, đánh giá sau lớp, quản lý ví cá nhân. |
| ST-002 | Teacher | Đăng ký dạy kỹ năng, nộp bằng chứng năng lực, công bố lớp, quản lý lịch, dạy, nhận thu nhập, rút tiền. |
| ST-003 | Verifier | Nhận hồ sơ được phân công đúng chuyên môn, đánh giá bằng chứng, phê duyệt/từ chối kèm lý do có cấu trúc. |
| ST-004 | Administrator | Duyệt xác minh sinh viên, quản lý vòng đời Verifier, xử lý ngoại lệ, giám sát vận hành. |
| ST-005 | Group 4 Product Owner | Sở hữu phạm vi, ưu tiên và các quyết định sản phẩm. | 
| ST-006 | Engineering/QA | Thiết kế kiến trúc, hiện thực hóa requirement, viết test, cung cấp bằng chứng Delivery Ready. |
| ST-007 | Finance | Xác nhận chính sách rút tiền, thời điểm chuyển thu nhập từ pending sang available, tuân thủ nghĩa vụ tài chính/KYC. |
| ST-008 | Security | Xác nhận chính sách lưu trữ/xóa giấy tờ, rà soát kiểm soát bảo mật trước go-live. |
| SYS-001 | Payment gateway | Xử lý top-up, payout và callback giao dịch. |
| SYS-002 | Jitsi | Cung cấp phòng học trực tuyến có kiểm soát truy cập. |

### RACI cho các quyết định lớn

| Quyết định | Product Owner | Engineering | Finance | Security | Administrator |
|---|---|---|---|---|---|
| Phê duyệt Open Questions | A/R | C | C | C | C |
| Chọn payment gateway | A | R | R | C | I |
| Chính sách retention giấy tờ | A | C | I | R | C |
| Chính sách hủy/tranh chấp | A | C | I | I | R |
| Go/No-go từng Increment | A | R | C | C | I |

(R = Responsible, A = Accountable, C = Consulted, I = Informed)

## 6. Business Process Model

### 6.1 Xác minh sinh viên (BP-001)

Sinh viên đăng ký tài khoản, chọn xác minh Learner, nhập tên trường và tải giấy tờ (thẻ sinh viên hoặc giấy xác nhận nhập học). Hồ sơ chuyển trạng thái Pending và vào hàng đợi Admin. Admin xem giấy tờ, đối chiếu thông tin, chọn Approve hoặc Reject kèm lý do theo danh sách chuẩn hóa (ảnh mờ, thông tin không khớp, giấy tờ hết hạn, nghi ngờ giả mạo). Nếu Approved, trạng thái chuyển Active với thời hạn hiệu lực theo chính sách retention. Nếu Rejected, sinh viên nhận lý do và có thể sửa, nộp lại. Toàn bộ thao tác ghi audit log gồm actor, thời gian và trạng thái trước/sau.

### 6.2 Xác minh năng lực Teacher (BP-002)

Sinh viên đã Active chọn đăng ký dạy, chọn kỹ năng từ danh mục, nộp bằng chứng gồm chứng chỉ, portfolio, mô tả kinh nghiệm. Hệ thống phân công Verifier có chuyên môn phù hợp. Verifier đánh giá theo checklist chuẩn hóa, quyết định Approve hoặc Reject kèm lý do. Nếu Approved, kỹ năng ở trạng thái Approved và Teacher được phép công bố lớp cho kỹ năng đó. Nếu Reject, Teacher có thể nộp phiên bản mới; bản cũ chuyển Superseded.

### 6.3 Đặt và thanh toán lớp (BP-003)

Learner tìm hoặc duyệt lớp đang Published và còn chỗ, chọn khung giờ. Hệ thống kiểm tra lớp bắt đầu sau ít nhất 24 giờ, còn sức chứa và Learner đủ số dư credit. Nếu đạt điều kiện, hệ thống giữ chỗ và ghi booking cùng ledger entry trong một transaction nguyên tử: ghi nợ Learner toàn bộ giá lớp, ghi có 90% vào số dư đang chờ của Teacher, ghi 10% vào tài khoản phí nền tảng. Booking chuyển Confirmed và cả hai bên nhận xác nhận. Nếu bất kỳ bước nào lỗi, toàn bộ rollback, không có trạng thái thành công một phần.

### 6.4 Tham gia lớp và đánh giá (BP-004)

Tới thời điểm lớp diễn ra, các bên trong booking nhận quyền truy cập phòng Jitsi qua token có thời hạn ngắn. Lớp diễn ra cùng chat nội bộ song song. Sau khi lớp kết thúc, booking chuyển Completed và Learner được mời đánh giá điểm và bình luận, giới hạn một lần mỗi booking. Rating ảnh hưởng đến điểm hiển thị hồ sơ Teacher theo ngưỡng đã duyệt.

### 6.5 Rút tiền (BP-005)

Teacher yêu cầu rút một phần hoặc toàn bộ số dư khả dụng. Hệ thống yêu cầu xác thực bổ sung. Tạo yêu cầu rút tiền trạng thái Pending và gọi payout API của gateway. Gateway phản hồi bất đồng bộ qua webhook; hệ thống xác thực chữ ký, chống replay và áp dụng đúng một lần theo idempotency key. Thành công chuyển Completed và giảm số dư khả dụng; thất bại chuyển Failed, số dư được hoàn nguyên và Teacher nhận thông báo lý do.

## 7. Business Rules

| ID | Business Group | Quy tắc |
|---|---|---|
| BR-001 | Identity & Student Verification | Người dùng phải hoàn tất xác minh sinh viên trước khi sử dụng các chức năng yêu cầu trạng thái sinh viên đã xác minh trên marketplace. |
| BR-002 | Identity & Student Verification | Yêu cầu xác minh sinh viên phải bao gồm tên trường và ảnh thẻ sinh viên hoặc giấy xác nhận đang theo học. |
| BR-003 | Identity & Student Verification | Xác minh sinh viên trong MVP phải được Admin xem xét thủ công; hệ thống không dựa vào cơ sở dữ liệu trường hoặc email domain của trường. |
| BR-004 | Identity & Student Verification | Student verification phải có các trạng thái tối thiểu: UNVERIFIED, PENDING, VERIFIED và REJECTED; quyền truy cập phải được xác định theo trạng thái hiện tại. |
| BR-005 | Identity & Student Verification | Mỗi yêu cầu xác minh phải lưu tài liệu đã gửi, trường học, thời điểm gửi, trạng thái, người review, thời điểm review và lý do từ chối nếu có. |
| BR-006 | Identity & Student Verification | Hệ thống phải có quy tắc re-verification hoặc hết hiệu lực của trạng thái sinh viên để tránh giữ VERIFIED vô thời hạn khi người dùng không còn là sinh viên. |
| BR-007 | Teacher & Skill Verification | Chỉ sinh viên đã được xác minh mới có thể trở thành Teacher và gửi yêu cầu xác minh kỹ năng/chứng chỉ. |
| BR-008 | Teacher & Skill Verification | Teacher chỉ được tạo hoặc publish lớp cho những skill đã được Verifier chấp thuận. |
| BR-009 | Teacher & Skill Verification | Xác minh Teacher phải được quản lý theo từng skill, không phải một trạng thái xác minh chung cho toàn bộ năng lực của Teacher. |
| BR-010 | Teacher & Skill Verification | Skill verification phải có các trạng thái tối thiểu: NOT_SUBMITTED, PENDING, VERIFIED, REJECTED và REVOKED/EXPIRED nếu hệ thống hỗ trợ thu hồi hoặc hết hạn. |
| BR-011 | Teacher & Skill Verification | Verifier phải là nhóm người dùng riêng, được mời vào hệ thống và có chuyên môn phù hợp; Verifier không đồng nhất với Admin. |
| BR-012 | Teacher & Skill Verification | Verifier không được tự xác minh yêu cầu skill/certificate của chính mình. |
| BR-013 | Teacher & Skill Verification | Teacher không được tự chọn Verifier cho yêu cầu của mình; hệ thống hoặc quy trình vận hành phải phân công Verifier để giảm xung đột lợi ích. |
| BR-014 | Teacher & Skill Verification | Sau khi yêu cầu verification đã được submit, evidence/certificate của yêu cầu đó không được chỉnh sửa; thay đổi phải tạo yêu cầu mới hoặc phiên bản mới có audit trail. |
| BR-015 | Class Management | Chỉ Teacher có student status VERIFIED và skill status VERIFIED tương ứng mới được publish class. |
| BR-016 | Class Management | Mỗi class phải có tối thiểu: tiêu đề, skill, mô tả, giá, thời lượng, lịch học/availability, Teacher, hình thức online và sức chứa tối đa nếu là lớp nhiều người. |
| BR-017 | Class Management | Thời lượng mỗi session phải tối thiểu 30 phút và tối đa 180 phút. |
| BR-018 | Class Management | Tất cả class trong MVP phải được tổ chức online; session offline không được hỗ trợ. |
| BR-019 | Class Management | Teacher không được tạo hoặc publish các session có thời gian trùng nhau vượt quá khả năng tham gia của chính Teacher. |
| BR-020 | Class Management | Teacher không được mở lớp mới cho skill đã bị REVOKED hoặc EXPIRED. |
| BR-021 | Booking | Learner phải đặt lớp ít nhất 24 giờ trước thời điểm session bắt đầu. |
| BR-022 | Booking | Learner chỉ được xác nhận booking khi available wallet balance đủ để thanh toán toàn bộ giá lớp. |
| BR-023 | Booking | Wallet balance của Learner không được âm do thao tác booking hoặc bất kỳ transaction nào. |
| BR-024 | Booking | Một Learner không được tạo nhiều booking hợp lệ cho cùng một class/session. |
| BR-025 | Booking | Khi class đạt maximum capacity, hệ thống phải ngừng nhận booking mới và phản ánh trạng thái FULL hoặc tương đương. |
| BR-026 | Booking | Việc tạo booking và ghi nhận payment phải có tính nguyên tử: không được tồn tại booking thành công khi payment thất bại hoặc payment thành công nhưng booking không được tạo. |
| BR-027 | Wallet & Ledger | Wallet sử dụng credit nội bộ; tỷ giá mặc định là 1 credit = 1.000 VND cho top-up và withdrawal, nhưng tỷ giá phải có khả năng cấu hình nếu Product thay đổi policy. |
| BR-028 | Wallet & Ledger | Learner nạp tiền thật thông qua payment gateway để nhận credit; không thanh toán trực tiếp cho Teacher ngoài hệ thống. |
| BR-029 | Wallet & Ledger | Mọi biến động số dư phải được ghi nhận trong credit/wallet ledger và transaction history. |
| BR-030 | Wallet & Ledger | Ledger phải là nguồn dữ liệu kiểm toán cho số dư; không được chỉ cập nhật một trường balance mà không tạo transaction tương ứng. |
| BR-031 | Wallet & Ledger | Transaction tài chính đã COMPLETED không được sửa hoặc xóa; điều chỉnh phải được thực hiện bằng transaction reversal/adjustment mới có liên kết tới transaction gốc. |
| BR-032 | Wallet & Ledger | Mỗi callback hoặc payment transaction từ payment gateway chỉ được cộng credit một lần; việc xử lý top-up phải idempotent. |
| BR-033 | Wallet & Ledger | Hệ thống phải ngăn double charge, double credit và mất credit khi retry, timeout hoặc nhận callback trùng lặp từ payment gateway. |
| BR-034 | Commission & Settlement | Platform thu 10% commission trên mỗi class transaction. |
| BR-035 | Commission & Settlement | Commission phải được tính trên giá trị transaction của class, không dựa trên tổng số dư wallet của Learner hoặc Teacher. |
| BR-036 | Commission & Settlement | Teacher nhận phần doanh thu còn lại sau khi trừ platform commission theo policy hiện hành. |
| BR-037 | Commission & Settlement | Product phải định nghĩa quy tắc làm tròn commission khi kết quả tính phí không phải số credit nguyên; quy tắc này phải được áp dụng nhất quán cho mọi transaction. |
| BR-038 | Commission & Settlement | Thu nhập từ class chưa hoàn tất nên ở trạng thái pending/held và không được withdraw cho đến khi đạt điều kiện settlement được Product định nghĩa. |
| BR-039 | Session & Video | Online session sử dụng Jitsi integration theo Intent của MVP. |
| BR-040 | Session & Video | Chỉ Teacher và Learner có booking hợp lệ mới được truy cập room/session tương ứng. |
| BR-041 | Session & Video | Thông tin truy cập video room không được công khai; hệ thống phải hạn chế truy cập theo booking/session. |
| BR-042 | Session & Video | Session phải có lifecycle rõ ràng tối thiểu gồm SCHEDULED, IN_PROGRESS, COMPLETED và CANCELLED hoặc các trạng thái tương đương. |
| BR-043 | Session & Video | Hệ thống phải có quy tắc xác định khi nào session được xem là COMPLETED để làm cơ sở settlement, rating và các nghiệp vụ sau lớp. |
| BR-044 | Cancellation & Refund | MVP có thể không có automatic refund, nhưng phải có refund/cancellation policy được định nghĩa trước khi launch. |
| BR-045 | Cancellation & Refund | Policy phải xác định cách xử lý khi Teacher hủy lớp trước giờ học. |
| BR-046 | Cancellation & Refund | Policy phải xác định cách xử lý khi Learner hủy booking, bao gồm mốc thời gian và mức hoàn credit nếu có. |
| BR-047 | Cancellation & Refund | Policy phải xác định cách xử lý Teacher no-show và Learner no-show. |
| BR-048 | Cancellation & Refund | Mọi refund hoặc adjustment thủ công phải được thực hiện qua ledger bằng transaction có audit trail; không chỉnh sửa trực tiếp số dư. |
| BR-049 | Rating & Trust | Chỉ Learner có booking hợp lệ và session đã COMPLETED mới được tạo rating/review cho Teacher của session đó. |
| BR-050 | Rating & Trust | Mỗi Learner chỉ được có một review hoạt động cho mỗi booking, trừ khi Product cho phép chỉnh sửa review hiện có. |
| BR-051 | Rating & Trust | Learner không được review trước khi session đạt trạng thái COMPLETED. |
| BR-052 | Rating & Trust | Rating aggregate của Teacher chỉ được tính từ các review hợp lệ gắn với booking/session hợp lệ. |
| BR-053 | Rating & Trust | Nếu rating được dùng để giảm visibility hoặc ẩn profile khỏi search, Product phải định nghĩa rating threshold và minimum review count trước khi áp dụng rule này. |
| BR-054 | Rating & Trust | MVP không có dedicated report/moderation workflow hoặc automatic account lock; rating và comment là cơ chế trust chính theo Intent. |
| BR-055 | Messaging & Communication | Trao đổi giữa Learner và Teacher phải diễn ra trong messaging system của platform theo constraint của MVP. |
| BR-056 | Messaging & Communication | Platform không cho phép hoặc phải có cơ chế hạn chế/cảnh báo việc chia sẻ thông tin liên hệ cá nhân như số điện thoại, email hoặc tài khoản mạng xã hội. |
| BR-057 | Messaging & Communication | Quyền chat phải gắn với một quan hệ nghiệp vụ hợp lệ, chẳng hạn Learner-Teacher liên quan tới class hoặc booking phù hợp. |
| BR-058 | Withdrawal | Teacher chỉ được yêu cầu withdrawal từ available balance; pending/held balance không được withdraw. |
| BR-059 | Withdrawal | Số tiền withdrawal không được vượt quá available balance tại thời điểm request được xác nhận. |
| BR-060 | Withdrawal | Withdrawal phải có lifecycle tối thiểu gồm REQUESTED, PROCESSING, COMPLETED và FAILED hoặc các trạng thái tương đương. |
| BR-061 | Withdrawal | Withdrawal đã COMPLETED không được sửa/xóa; mọi điều chỉnh phải được thực hiện bằng transaction mới có audit trail. |
| BR-062 | Withdrawal | Trước khi launch, Product phải định nghĩa minimum withdrawal, maximum withdrawal nếu có, withdrawal fee nếu có, processing time và failed payout handling. |
| BR-063 | Roles & Permissions | Learner và Teacher không nhất thiết là hai account tách biệt; một verified student có thể vừa học ở class này vừa dạy một skill đã được verify ở class khác. |
| BR-064 | Roles & Permissions | Admin chịu trách nhiệm student verification và các chức năng quản trị được cấp; Verifier chịu trách nhiệm skill/certificate verification và không mặc định có quyền Admin. |
| BR-065 | Roles & Permissions | Quyền tạo class phải giới hạn cho Teacher có skill verification hợp lệ; quyền verify skill chỉ dành cho Verifier được phân quyền. |
| BR-066 | Roles & Permissions | Các hành động tài chính, verification và thay đổi trạng thái quan trọng phải lưu actor, timestamp và dữ liệu cần thiết cho audit. |
| BR-067 | Localization & Client | MVP chỉ hỗ trợ tiếng Việt và tiếng Anh. |
| BR-068 | Roles & Permissions | Một Teacher không được tự đặt hoặc tự đánh giá lớp của chính mình. |
| BR-069 | Wallet & Ledger | Credit không được quy đổi ngược thành tiền mặt ngoài luồng rút tiền chính thức của Teacher. |
| BR-070 | Identity & Student Verification | Một tài khoản chỉ có một hồ sơ xác minh sinh viên hiệu lực tại một thời điểm. |

**Ghi chú:** BR-068–BR-070 được bổ sung từ bộ quy tắc cũ ngoài danh sách gốc BR-001–BR-067, giữ nguyên ngữ nghĩa; OQ-012 (làm tròn commission) áp dụng cho BR-037.

## 8. Assumptions, Constraints and Dependencies

| ID | Type | Statement | Owner | Status |
|---|---|---|---|---|
| A-001 | Assumption | Người dùng có tài khoản ngân hàng hoặc ví điện tử phù hợp với gateway được chọn. | Product Owner | Unconfirmed |
| A-002 | Assumption | Người dùng chấp nhận tải giấy tờ chứng minh tư cách sinh viên. | Product Owner | Unconfirmed |
| A-003 | Assumption | Có đủ Verifier phù hợp chuyên môn trước khi mở Teacher onboarding. | Administrator | Unconfirmed |
| A-004 | Assumption | Kết nối Internet của người dùng đủ ổn định cho Jitsi. | Product Owner | Unconfirmed |
| A-005 | Assumption | Số lượng Teacher đăng ký ban đầu đủ đa dạng để bao phủ ít nhất 5–10 danh mục kỹ năng phổ biến. | Product Owner | Unconfirmed |
| A-006 | Assumption | Verifier duy trì SLA duyệt hồ sơ trong khoảng 48–72 giờ. | Administrator | Unconfirmed |
| C-001 | Constraint | MVP không tích hợp dữ liệu sinh viên của trường; xác minh hoàn toàn thủ công. | Product Owner | Confirmed |
| C-002 | Constraint | MVP chỉ hỗ trợ lớp trực tuyến. | Product Owner | Confirmed |
| C-003 | Constraint | Mỗi lớp kéo dài từ 30 phút đến 3 giờ và phải được đặt trước ít nhất 24 giờ. | Product Owner | Confirmed |
| C-004 | Constraint | Tỷ giá khởi điểm là 1 credit = 1.000 VND; mọi thay đổi phải được phê duyệt và version hóa trước khi áp dụng. | Product Owner | Confirmed default; change policy open |
| C-005 | Constraint | Phí nền tảng là 10% trên mỗi giao dịch mua lớp. | Product Owner | Confirmed |

| ID | Dependency | Trạng thái |
|---|---|---|
| DEP-001 | Lựa chọn Payment Gateway hỗ trợ top-up và payout tại Việt Nam. | Open |
| DEP-002 | Jitsi self-hosted hoặc Jitsi as a Service với secure domain/JWT. | Open |
| DEP-003 | Nguồn nhân lực Verifier ban đầu. | Open |

## 9. Financial Model

| Tham số | Giá trị MVP | Ghi chú |
|---|---|---|
| Tỷ giá quy đổi | 1 credit = 1.000 VND | Cố định ở MVP; thay đổi phải version hóa và công bố trước. |
| Phí nền tảng | 10% mỗi giao dịch mua lớp | Ghi nhận ngay tại thời điểm booking thành công. |
| Phân bổ Teacher | 90% giá lớp vào số dư đang chờ | Chuyển sang số dư khả dụng theo chính sách đã duyệt. |
| Giới hạn nạp tiền | Chưa xác định | Phụ thuộc giới hạn gateway và chính sách chống rửa tiền cơ bản. |
| Giới hạn rút tiền | Chưa xác định | Có thể áp dụng ngưỡng tối thiểu/tối đa mỗi lần rút; xem BR-062 và OQ-005. |
| Quy tắc làm tròn commission | Chưa xác định | BR-037: Product phải định nghĩa quy tắc làm tròn khi 10% không phải số credit nguyên, áp dụng nhất quán cho mọi transaction. |

Rủi ro tài chính chính là chargeback hoặc reversal sau khi đã phân bổ 90% cho Teacher.

## 10. Risks and Decisions

| ID | Risk/decision | Impact | Likelihood | Owner | Mitigation/status |
|---|---|---|---|---|---|
| RISK-001 | Gian lận top-up, payout hoặc chargeback. | Critical | Medium | Finance/Security | Gateway controls, pending funds, reversal, reconciliation. |
| RISK-002 | Ledger ghi sai hoặc xử lý trùng. | Critical | Medium | Engineering | Atomic entries, idempotency and concurrency tests. |
| RISK-003 | Giấy tờ giả hoặc tệp tải lên độc hại. | High | Medium | Administrator/Security | Review checklist, upload scanning and audit. |
| RISK-004 | Verifier thông đồng hoặc vượt phạm vi chuyên môn. | High | Medium | Administrator | Separation of duty, assignment scope and periodic audit. |
| RISK-005 | Tranh chấp/no-show không có quy trình. | High | High | Product Owner/Administrator | Resolve trước khi triển khai Increment 4. |
| RISK-006 | Thiếu Teacher đã xác minh khi pilot. | High | Medium | Product Owner | Recruit and verify supply before learner expansion. |
| RISK-007 | Rò rỉ giấy tờ, chat hoặc dữ liệu tài chính. | Critical | Medium | Security | Encryption, least privilege, retention decision and security tests. |
| RISK-008 | Chi phí Verifier/Admin vượt ngân sách khi khối lượng hồ sơ tăng nhanh. | Medium | Medium | Product Owner/Finance | Theo dõi SLA duyệt hồ sơ; cân nhắc tự động hóa một phần ở giai đoạn sau. |
| RISK-009 | Người dùng lách chat để giao dịch ngoài nền tảng, né phí nền tảng. | Medium | High | Product Owner | Chính sách chat kết hợp ưu đãi giữ chân thay vì chỉ chặn. |
| DEC-001 | MVP chỉ hỗ trợ lớp trực tuyến qua Jitsi. | — | — | Product Owner | Confirmed. |
| DEC-002 | Xác minh sinh viên và năng lực Teacher là thủ công. | — | — | Product Owner | Confirmed. |
| DEC-003 | Thanh toán dùng credit, tỷ giá khởi điểm 1 credit = 1.000 VND và phí 10%. | — | — | Product Owner | Confirmed. |

## 11. Open Questions requiring approval

| ID | Decision required | Owner | Affects | Required by | Phương án khả dĩ | Khuyến nghị |
|---|---|---|---|---|---|---|
| OQ-001 | Cấu trúc taxonomy kỹ năng và cấp tìm kiếm. | Product Owner | FR-003, FR-005, FR-006 | Trước implementation planning | Danh mục cố định; free-text/tag; kết hợp cả hai. | Kết hợp danh mục cố định với tag phụ. |
| OQ-002 | Teacher tự đặt giá, dùng khung giá hay mô hình kết hợp. | Product Owner | FR-005, FR-007–FR-009 | Trước implementation planning | Tự đặt giá; khung giá theo cấp độ; kết hợp có sàn/trần. | Kết hợp có sàn/trần. |
| OQ-003 | Chính sách hủy, no-show, tranh chấp, hoàn tiền thủ công và workflow Administrator thực thi. | Product Owner + Administrator | FR-007, FR-009–FR-011, FR-013 | Trước implementation planning | Hoàn toàn thủ công; quy tắc tự động cơ bản kèm escalation. | Kết hợp quy tắc tự động cơ bản với escalation thủ công cho ca phức tạp. |
| OQ-004 | Ngưỡng rating, số đánh giá tối thiểu và cách khôi phục hiển thị. | Product Owner | FR-006, FR-013 | Trước implementation planning | Ẩn dưới ngưỡng; hiển thị kèm cảnh báo dữ liệu chưa đủ. | Hiển thị kèm cảnh báo. |
| OQ-005 | Điều kiện, giới hạn, phí và thời gian xử lý withdrawal. | Product Owner + Finance | FR-010, FR-014 | Trước implementation planning | Không giới hạn; ngưỡng tối thiểu và phí cố định; ngưỡng theo cấp Teacher. | Ngưỡng tối thiểu và phí cố định. |
| OQ-006 | Quy tắc xác định session COMPLETED (BR-043) và khi nào khoản 90% của Teacher chuyển từ pending sang available; xử lý chargeback và reversal. | Product Owner + Finance | FR-008, FR-009, FR-014, FR-020 | Trước implementation planning | Ngay sau Completed; sau X ngày không tranh chấp; chu kỳ cố định. | Sau X ngày không tranh chấp. |
| OQ-007 | Lớp là một-một, lớp nhóm hay cả hai; sức chứa và quy tắc giữ/nhả chỗ. | Product Owner | FR-005, FR-007 | Trước implementation planning | Chỉ 1-1; chỉ nhóm; cả hai do Teacher chọn. | Cả hai, Teacher chọn khi công bố lớp. |
| OQ-008 | Thời hạn hiệu lực xác minh, thời hạn lưu/xóa giấy tờ, quy tắc cascade khi hết hiệu lực hoặc bị thu hồi. | Product Owner + Security | FR-002–FR-005, FR-007, FR-011, FR-014, NFR-004 | Trước storage and lifecycle design | Giữ vĩnh viễn; giữ N tháng rồi xóa; ẩn danh hóa thay vì xóa cứng. | Giữ N tháng rồi xóa hoặc ẩn danh hóa. |
| OQ-009 | Chat cảnh báo, chặn hay chỉ ghi nhận khi phát hiện thông tin liên hệ cá nhân. | Product Owner | FR-012 | Trước implementation planning | Chặn cứng; cảnh báo và ghi log; chỉ ghi log. | Cảnh báo và ghi log. |
| OQ-010 | Giá trị mục tiêu cho bốn success metrics và phạm vi trường pilot. | Product Owner | Product rollout | Trước pilot planning | Pilot một trường; pilot 2–3 trường cùng khu vực. | Pilot nội bộ một trường trước. |
| OQ-011 | Payment gateway nào đáp ứng top-up, payout, webhook, reconciliation và reversal. | Engineering + Finance | FR-008, FR-014 | Trước integration design | So sánh các gateway nội địa hỗ trợ VND. | Cần bảng so sánh chi phí/khả năng payout trước khi chọn. |
| OQ-012 | Quy tắc làm tròn commission khi kết quả tính phí không phải số credit nguyên (BR-037), và làm tròn ở đâu trong pipeline tính phí. | Product Owner + Finance | FR-009, FR-014 | Trước implementation planning | Làm tròn xuống (floor) mỗi bút toán; làm tròn tròn nửa (round half-up); làm tròn ở khâu sinh bút toán thay vì ở ledger. | Làm tròn floor tại thời điểm sinh bút toán, ghi số làm tròn vào ledger để audit. |

## 12. Compliance and Legal Considerations

Giấy tờ xác minh sinh viên và chứng chỉ Teacher là dữ liệu định danh nhạy cảm, cần tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành khi xử lý, lưu trữ và xóa. Nếu SkillSwap không tự xin giấy phép trung gian thanh toán, toàn bộ dòng tiền phải đi qua gateway đã được cấp phép; SkillSwap chỉ vận hành ví credit nội bộ, không giữ tiền mặt hộ người dùng ngoài phạm vi gateway cho phép. MVP chưa xử lý khấu trừ thuế thu nhập của Teacher; điều khoản sử dụng cần nêu rõ Teacher tự chịu trách nhiệm kê khai thu nhập. Chính sách với người dùng chưa đủ 18 tuổi cần được làm rõ trong điều khoản dịch vụ.

## 13. Quality Review

- **Gate 1 — Context Ready:** Passed. Problem, desired outcome, actors, scope, assumptions, constraints and open questions are explicit.
- **Gate 2 — Requirement Ready:** Passed for confirmed core behavior; affected items remain open where an Open Question blocks implementation.
- **Gate 3 — Solution Ready:** In progress; financial, security and gateway decisions remain open.
- **Gate 4 — Delivery Ready:** In progress; stakeholder approval pending.
- **Reviewers:** Product Owner, Engineering, QA, Security/Finance as applicable.
- **Approval decision:** Pending.
- **Unresolved questions:** OQ-001–OQ-011.

## GitHub Delivery Mapping

- GitHub Project: https://github.com/users/trankien022/projects/1
- Functional Issues: https://github.com/trankien022/SkillSwap/issues/1 through https://github.com/trankien022/SkillSwap/issues/14
- Decision Spikes: https://github.com/trankien022/SkillSwap/issues/15 through https://github.com/trankien022/SkillSwap/issues/19 and https://github.com/trankien022/SkillSwap/issues/22 through https://github.com/trankien022/SkillSwap/issues/27.
- Governance alignment Issue: https://github.com/trankien022/SkillSwap/issues/21
- Related PRD: SkillSwap-PRD.md
