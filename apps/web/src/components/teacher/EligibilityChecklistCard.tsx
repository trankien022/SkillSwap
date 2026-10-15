'use client';

import { useTranslations } from 'next-intl';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  skills: VerifiedSkill[];
}

/** Hours of lead time the backend requires before a class may start (SR-BR-004). */
const MIN_LEAD_TIME_HOURS = 24;

/**
 * Eligibility checklist (BR-008 / BR-010 / SR-BR-004).
 *
 * This card used to render three checkmarks, a green status word per row and an
 * unconditional "Eligible" badge — with no inputs at all. It therefore told a
 * teacher whose draft was not eligible the same thing it told an eligible one,
 * which is a fabricated live status rather than a report of the draft.
 *
 * It now derives every row from the draft and the approved-skills list, and the
 * header badge reads "Eligible" only when all three rows really pass.
 */
export function EligibilityChecklistCard({ draft, skills }: Props) {
  const t = useTranslations('Teacher.publish.checklist');

  const skill = skills.find((s) => s.id === draft.skillId);
  const skillApproved = skill !== undefined;

  const startsAt = parseStartsAt(draft.startsOn, draft.startsAt);
  const leadTimeOk =
    startsAt !== null &&
    startsAt.getTime() - Date.now() >= MIN_LEAD_TIME_HOURS * 60 * 60 * 1000;

  // The 90/10 split is a fixed platform constant, not per-draft state, so this
  // row is always true while that rule stands (BR-013, fee 1000 bps).
  const payoutOk = true;

  const allOk = skillApproved && leadTimeOk && payoutOk;

  const rows: { label: string; ok: boolean; status: string }[] = [
    { label: t('item1'), ok: skillApproved, status: skillApproved ? t('ok') : t('notMet') },
    { label: t('item2'), ok: leadTimeOk, status: leadTimeOk ? t('ok') : t('notMet') },
    { label: t('item3'), ok: payoutOk, status: t('ok') },
  ];

  return (
    <section className="workspace-panel flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-base font-bold text-slate-900">{t('title')}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-bold border ${
            allOk
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {allOk ? t('badge') : t('badgeIncomplete')}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  row.ok ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {row.ok ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span className="font-medium text-slate-800">{row.label}</span>
            </div>
            <span className={`font-semibold ${row.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
              {row.status}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-slate-600 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
          <span className="material-symbols-outlined text-[15px] text-emerald-700">verified</span>
          <span>{t('pledgeTitle')}</span>
        </div>
        <p className="leading-relaxed">
          {t('pledgeDesc')}
        </p>
      </div>
    </section>
  );
}

/**
 * Parses the draft's on/at fields into a real `Date`.
 *
 * The shape is validated first — `new Date('T:00')` does not throw on V8, it
 * silently resolves to 2000-01-01 — so an incomplete draft yields `null` rather
 * than a date in the past that would read as a lead-time failure for the wrong
 * reason.
 */
function parseStartsAt(startsOn: string, startsAt: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return null;
  if (!/^\d{2}:\d{2}$/.test(startsAt)) return null;

  const parsed = new Date(`${startsOn}T${startsAt}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
