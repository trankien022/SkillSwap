/** Provider-visible copy uses the receiving installation's selected language. */
export function notificationCopy(type: string, locale: 'vi' | 'en'): { title: string; body: string } | undefined {
  const copy: Record<string, readonly [string, string, string, string]> = {
    booking_cancelled: ['Lớp học đã hủy', 'Giáo viên đã hủy lớp bạn đặt. Mở lịch học và ví để kiểm tra trạng thái.', 'Class canceled', 'A teacher canceled a class you booked. Open your schedule and wallet to review the status.'],
    booking_confirmed: ['Đặt lớp thành công', 'Lớp bạn đặt đã được xác nhận. Mở lịch học để xem chi tiết.', 'Booking confirmed', 'Your class booking is confirmed. Open your schedule to view the details.'],
    verification_outcome: ['Cập nhật xác minh', 'Trạng thái xác minh đã thay đổi. Mở SkillSwap để xem kết quả.', 'Verification updated', 'Your verification status changed. Open SkillSwap to review the result.'],
    wallet_transaction: ['Cập nhật ví', 'Một giao dịch ví đã hoàn tất. Mở ví để xem số dư và lịch sử.', 'Wallet updated', 'A wallet transaction completed. Open your wallet to review the balance and history.'],
    class_starting_soon: ['Lớp học sắp bắt đầu', 'Lớp của bạn sắp bắt đầu. Mở lịch học để xem chi tiết.', 'Class starting soon', 'Your class is starting soon. Open your schedule to review the class.'],
    withdrawal_outcome: ['Cập nhật rút tiền', 'Trạng thái rút tiền đã thay đổi. Mở ví để xem kết quả.', 'Withdrawal updated', 'Your withdrawal status changed. Open your wallet to review the result.'],
  };
  const item = copy[type];
  if (!item) return undefined;
  return { title: item[locale === 'vi' ? 0 : 2], body: item[locale === 'vi' ? 1 : 3] };
}
