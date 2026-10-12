'use client';

import { MiniCalendar } from './MiniCalendar';
import { WalletLedgerWidget } from './WalletLedgerWidget';
import { LearnerCharter } from './LearnerCharter';
import type { CalendarDay, CharterEntry, WalletSnapshot } from '../../lib/dashboard/types';

/**
 * Right sidebar (4/12) for the learner dashboard page.
 *
 * Hosts the calendar, the wallet widget and the learner charter. Client
 * component: every prop is part of the live snapshot `DashboardShell` fetches,
 * so the column is rendered inside the shell rather than on the server.
 */
export function RightSidebar({
  month,
  year,
  days,
  wallet,
  charter,
  isAuthed,
}: {
  month: number;
  year: number;
  days: CalendarDay[];
  wallet: WalletSnapshot | null;
  charter: CharterEntry[];
  isAuthed: boolean;
}) {
  return (
    <aside className="flex flex-col gap-6">
      <MiniCalendar month={month} year={year} days={days} />
      <WalletLedgerWidget wallet={wallet} isAuthed={isAuthed} />
      <LearnerCharter entries={charter} />
    </aside>
  );
}
