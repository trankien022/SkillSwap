export const LEDGER_ENTRY_WRITER = Symbol('LEDGER_ENTRY_WRITER');

export interface CreditTeacherRequest {
  bookingId: string;
  teacherId: string;
  amountCredits: number;
}

export interface CreditTeacherResult {
  recorded: boolean;
  amountCredits: number;
}

export type LedgerEntryType = 'teacher_credit' | 'top_up' | 'reversal';

export interface AppendEntryRequest {
  type: LedgerEntryType;
  ownerId: string;
  direction: 'credit' | 'debit';
  amountCredits: number;
  /** Booking id (teacher credits) or top-up intent id (top-up/reversal). */
  referenceId: string;
  traceId: string;
}

export interface LedgerEntryWriter {
  creditTeacher(request: CreditTeacherRequest): Promise<CreditTeacherResult>;
  append(request: AppendEntryRequest): Promise<void>;
}
