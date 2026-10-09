export type Status = 'success' | 'loading' | 'error' | 'empty';

export interface SessionInfo {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  location?: string;
}

export interface TeacherInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  rating?: number;
}

export interface EscrowSettlement {
  totalCredits: number;
  teacherShare: number;
  platformFee: number;
  studentRefund?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  url?: string;
}

export interface SuggestionItem {
  id: string;
  title: string;
  description?: string;
}

export interface CompletionData {
  session: SessionInfo | null;
  teacher: TeacherInfo | null;
  escrow: EscrowSettlement | null;
  documents: DocumentItem[];
  suggestions: SuggestionItem[];
  rating?: number;
}
