'use client';

import { useTranslations } from 'next-intl';
import {
  MAX_PRICE_CREDITS,
  MIN_PRICE_CREDITS,
  VND_PER_CREDIT,
  type ClassDraft,
} from '../../lib/teacher/types';
import {
  computeNetCredits,
  computePlatformFee,
  computeVndEstimate,
} from '../../lib/teacher/money';

interface Props {
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Pricing & revenue settlement card (BR-034, BR-036).
 *
 * Live recompute: tuition / 10% fee / 90% net / VND estimate
 * follow the credits input as the teacher types. The input is
 * clamped to the 10..1000 integer band. The policy callout at
 * the bottom explains the escrow behaviour in plain language.
 */
export function PricingRevenueCard({ draft, onChange }: Props) {
  const t = useTranslations('Teacher.publish.pricing');
  const tSteps = useTranslations('Teacher.publish.steps');
  const fee = computePlatformFee(draft.priceCredits);
  const net = computeNetCredits(draft.priceCredits);
  const vnd = computeVndEstimate(net);
  return (
    <section className="workspace-panel flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-campus-emerald-deep text-sm font-bold text-white shadow-xs">
            5
          </span>
          <h2 className="text-base font-bold text-slate-900">{tSteps('step5Title')}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-600">
          {t('rate')}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="credits-input"
          className="text-sm font-semibold text-slate-800"
        >
          {t('inputLabel')}
        </label>
        <div className="relative flex items-center">
          <input
            id="credits-input"
            type="number"
            min={MIN_PRICE_CREDITS}
            max={MAX_PRICE_CREDITS}
            step={1}
            value={draft.priceCredits}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(next)) {
                onChange({ priceCredits: MIN_PRICE_CREDITS });
                return;
              }
              const clamped = Math.max(
                MIN_PRICE_CREDITS,
                Math.min(MAX_PRICE_CREDITS, next),
              );
              onChange({ priceCredits: clamped });
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 pr-20 text-xl font-bold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
          />
          <span className="absolute right-4 text-sm font-bold text-slate-400 r">
            {t('inputUnit')}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">{t('tuition')}</span>
          <span className="text-sm font-bold text-slate-900">
            {draft.priceCredits} credits
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
            {t('fee')}
            <HelpOutlineIcon className="h-3.5 w-3.5 text-slate-400" />
          </span>
          <span className="text-sm font-bold text-rose-600">
            −{fee} credits
          </span>
        </div>
        <div className="my-0.5 h-px bg-slate-200" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-emerald-800">
              {t('net')}
            </span>
            <span className="text-sm text-slate-500">{t('netHint')}</span>
          </div>
          <div className="text-right">
            <span className="block text-lg font-extrabold text-emerald-700">
              +{net} credits
            </span>
            <span className="block text-sm font-medium text-slate-500">
              {t('vnd', {
                vnd: vnd.toLocaleString('vi-VN'),
              })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-slate-600">
        <PolicyIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <p className="text-sm leading-relaxed text-slate-600">{t('policy')}</p>
      </div>
      {/* VND_PER_CREDIT is intentionally kept as a constant so the
          rate stays auditable from the pricing module. */}
      <span className="hidden">{VND_PER_CREDIT}</span>
    </section>
  );
}

function HelpOutlineIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function PolicyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}