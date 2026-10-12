export const VERIFICATION_GATEWAY = Symbol('VERIFICATION_GATEWAY');

export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  status: 'approved' | 'pending' | 'rejected' | string;
  details?: string;
  // Optional local preview URL (base64 or remote) for uploaded certificate images
  imageUrl?: string;
  // Optional link URL for online certificates
  linkUrl?: string;
};

export type StudentIdentity = {
  title?: string;
  issuer?: string;
  cohort?: string;
  school?: string;
  campus?: string;
  studentId?: string;
  email?: string;
  nextReauth?: string;
  monthsToNext?: number;
  statusLabel?: 'verified' | 'pending' | string;
  verifiedAt?: string;
};

export type AcademicMetrics = {
  score?: number;
  courseCompletion?: string;
  disputes?: string;
  peerRating?: string;
  verifications?: number;
};

export type VerificationData = {
  student: StudentIdentity;
  scannedCardImage?: string;
  metrics: AcademicMetrics;
  certificates: Certificate[];
};

/** Port the UI depends on. Implementations return the verification payload or throw on error. */
export interface VerificationGateway {
  loadVerification(): Promise<VerificationData>;
}
