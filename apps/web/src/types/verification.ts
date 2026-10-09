export type VerificationData = {
  student: StudentIdentity;
  scannedCardImage?: string;
  metrics: AcademicMetrics;
  certificates: Certificate[];
};

export type StudentIdentity = {
  title: string;
  issuer: string;
  cohort: string;
  school: string;
  campus?: string;
  studentId: string;
  email: string;
  nextReauth: string;
  monthsToNext: number;
  statusLabel: "verified" | "pending" | string;
  verifiedAt: string;
};

export type AcademicMetrics = {
  score: number; // 0 - 100
  courseCompletion: string; // e.g. "99.4%"
  disputes: string; // e.g. "0 vụ vi phạm"
  peerRating: string; // e.g. "4.9 / 5.0 ★"
  verifications: number; // how many verifications contributed
};

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  status: "approved" | "pending" | "rejected";
  details?: string;
};