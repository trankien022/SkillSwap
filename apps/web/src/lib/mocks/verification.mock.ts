import type { VerificationData } from "../../types/verification";

/**
 * Success state
 */
export const verificationSuccess: VerificationData = {
  student: {
    title: "Định danh Sinh viên chính khóa",
    issuer: "Cổng liên thông EduID đại học",
    cohort: "Niên khóa 2021 - 2025",
    school: "ĐH Ngoại Thương (FTU)",
    campus: "Cơ sở II - TP. Hồ Chí Minh",
    studentId: "2112450098",
    email: "k21.ftu@ftu.edu.vn",
    nextReauth: "Tháng 09/2025",
    monthsToNext: 7,
    statusLabel: "verified",
    verifiedAt: "15/09/2024",
  },
  scannedCardImage:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAuUGzx7e44eIIu7FOr_DFtvBsnRCFeeXEj8ZAB9Gz9gtyezDYr6C-LIXXAjown6dbcxwBzPi59OoHRbmTOFd47TVrYkd74REHTYNm1xgSF8O1lgQkIJldB-DDm-AebpjgPBhBMSduMx-lugx4Q_GpMoMtq6lNq1OpMC27jqV1PwNGmzroZJ6QOppBahKzJB-qBjo8UoidPisSq_3e04zqSQ5DMgP7x6mdij6iYjO5-NMaVQMpZc5_B",
  metrics: {
    score: 98,
    courseCompletion: "99.4%",
    disputes: "0 vụ vi phạm",
    peerRating: "4.9 / 5.0 ★",
    verifications: 14,
  },
  certificates: [
    {
      id: "cert-1",
      title: "IELTS Speaking C1 (8.0)",
      issuer: "IDP Australia • Quyền mở lớp đã kích hoạt",
      status: "approved",
    },
    {
      id: "cert-2",
      title: "TOEIC 920 Business",
      issuer: "IIG Vietnam • Quyền mở lớp đã kích hoạt",
      status: "approved",
    },
    {
      id: "cert-3",
      title: "Dịch thuật Anh - Việt Tài chính",
      issuer: "Hội đồng Khoa FTU",
      status: "pending",
    },
  ],
};

/**
 * Loading state
 * Consumers should detect status === 'loading' and show skeletons/spinner
 */
export const verificationLoading = {
  status: "loading",
} as const;

/**
 * Error state
 */
export const verificationError = {
  status: "error",
  message: "Không thể kết nối đến service xác minh.",
} as const;

/**
 * Empty / not verified state
 */
export const verificationEmpty = {
  status: "empty",
} as const;