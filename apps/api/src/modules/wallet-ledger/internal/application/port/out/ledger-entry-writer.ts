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

export interface LedgerEntryWriter {
  creditTeacher(request: CreditTeacherRequest): Promise<CreditTeacherResult>;
}
