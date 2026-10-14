'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from './navbar';
import type {
  VerifierQueuePage as VerifierQueuePageType,
  SkillEvidenceView,
  SkillLevel,
} from '@skillswap/contracts';
import { HttpVerificationGateway, VerifierAuthError } from '../lib/verification/http-gateway';

const gateway = new HttpVerificationGateway();

export function VerifierQueuePage() {
  const t = useTranslations('Verifier');

  const [page, setPage] = useState<VerifierQueuePageType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters / paging
  const [limit] = useState(20);
  const [cursor, setCursor] = useState<string | null>(null);
  const [level, setLevel] = useState<string | undefined>(undefined);
  const [type, setType] = useState<string | undefined>(undefined);
  const [q, setQ] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<string | undefined>(undefined);

  // Local mutation state
  const [mutating, setMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = await gateway.getVerifierQueue({ limit, cursor: cursor ?? undefined, level, type, q, sort });
      setPage(p);
    } catch (err) {
      if (err instanceof VerifierAuthError) {
        setError(t('errors.auth'));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [cursor, level, type, q, sort]);

  async function handleClaim(id: string) {
    setMutating(true);
    setMutateError(null);
    try {
      await gateway.claimEvidence(id);
      await load();
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : String(err));
    } finally {
      setMutating(false);
    }
  }

  async function handleDecide(id: string, decision: 'approve' | 'reject', approvedLevel?: SkillLevel, reason?: string) {
    setMutating(true);
    setMutateError(null);
    try {
      await gateway.decideEvidence(id, { decision, approvedLevel, reason });
      await load();
    } catch (err) {
      setMutateError(err instanceof Error ? err.message : String(err));
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="verification" me={null} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

        <section className="mb-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select
              value={level ?? ''}
              onChange={(e) => setLevel(e.target.value || undefined)}
              className="w-full h-9 rounded border px-2 text-sm"
            >
              <option value="">{t('filters.levelAll')}</option>
              <option value="beginner">{t('levels.beginner')}</option>
              <option value="intermediate">{t('levels.intermediate')}</option>
              <option value="advanced">{t('levels.advanced')}</option>
              <option value="expert">{t('levels.expert')}</option>
            </select>

            <select
              value={type ?? ''}
              onChange={(e) => setType(e.target.value || undefined)}
              className="w-full h-9 rounded border px-2 text-sm"
            >
              <option value="">{t('filters.typeAll')}</option>
              <option value="certificate">{t('evidence.certificate')}</option>
              <option value="verifier_assessment">{t('evidence.verifier_assessment')}</option>
            </select>

            <select
              value={sort ?? ''}
              onChange={(e) => setSort(e.target.value || undefined)}
              className="w-full h-9 rounded border px-2 text-sm"
            >
              <option value="">{t('filters.sortDefault')}</option>
              <option value="submittedAt">{t('filters.sortOldest')}</option>
              <option value="-submittedAt">{t('filters.sortNewest')}</option>
            </select>

            <input
              placeholder={t('filters.qPlaceholder')}
              value={q ?? ''}
              onChange={(e) => setQ(e.target.value || undefined)}
              className="w-full h-9 rounded border px-2 text-sm"
            />
          </div>
        </section>

        {error && <div className="mb-4 text-sm text-red-700">{error}</div>}
        {mutateError && <div className="mb-4 text-sm text-red-700">{mutateError}</div>}

        <section className="space-y-3">
          {loading && <p className="text-sm text-slate-600">{t('loading')}</p>}

          {!loading && (!page || page.items.length === 0) && (
            <p className="text-sm text-slate-600">{t('empty')}</p>
          )}

          {!loading && page && (
            <div className="space-y-2">
              {page.items.map((item) => (
                <VerifierRow
                  key={item.id}
                  item={item}
                  onClaim={() => handleClaim(item.id)}
                  onDecide={(decision, approvedLevel, reason) => handleDecide(item.id, decision, approvedLevel, reason)}
                  disabled={mutating}
                />
              ))}

              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">{t('pagination.total', { total: page.page.total })}</div>
                <div>
                  {page.page.nextCursor ? (
                    <button
                      onClick={() => setCursor(page.page.nextCursor)}
                      className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                      {t('pagination.next')}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">{t('pagination.end')}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function VerifierRow({
  item,
  onClaim,
  onDecide,
  disabled,
}: {
  item: SkillEvidenceView;
  onClaim: () => void;
  onDecide: (decision: 'approve' | 'reject', approvedLevel?: SkillLevel, reason?: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('Verifier');
  const [showDecision, setShowDecision] = useState(false);
  const [approvedLevel, setApprovedLevel] = useState<string>('');
  const [reason, setReason] = useState('');

  const canDecide = item.status === 'claimed';

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-900">{item.skillName || item.skillId}</div>
            <div className="text-xs text-slate-500">{item.category}</div>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {t('row.requestedLevel')}: {t(`levels.${item.requestedLevel}`)} • {t('row.evidenceType')}: {t(`evidence.${item.evidenceType}`)}
          </div>
          <div className="mt-1 text-sm text-slate-600">{t('row.owner')}: {item.ownerId || '—'}</div>
          <div className="mt-1 text-xs text-slate-400">{t('row.submittedAt')}: {item.submittedAt}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-semibold">{t(`status.${item.status}`)}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClaim}
              disabled={disabled || item.status !== 'pending'}
              className="rounded border px-2 py-1 text-xs"
            >
              {t('actions.claim')}
            </button>

            <button
              onClick={() => setShowDecision((s) => !s)}
              disabled={!canDecide || disabled}
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
            >
              {t('actions.decide')}
            </button>
          </div>
        </div>
      </div>

      {showDecision && (
        <div className="mt-3 border-t pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={approvedLevel} onChange={(e) => setApprovedLevel(e.target.value)} className="h-9 rounded border px-2 text-sm">
              <option value="">{t('decision.approvedLevelPlaceholder')}</option>
              <option value="beginner">{t('levels.beginner')}</option>
              <option value="intermediate">{t('levels.intermediate')}</option>
              <option value="advanced">{t('levels.advanced')}</option>
              <option value="expert">{t('levels.expert')}</option>
            </select>

            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('decision.reasonPlaceholder')} className="h-9 rounded border px-2 text-sm" />

            <div className="flex items-center gap-2">
              <button
                onClick={() => onDecide('approve', (approvedLevel as SkillLevel) || undefined, reason || undefined)}
                disabled={disabled}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
              >
                {t('actions.approve')}
              </button>

              <button
                onClick={() => onDecide('reject', undefined, reason || undefined)}
                disabled={disabled}
                className="rounded bg-red-600 px-3 py-1 text-xs text-white"
              >
                {t('actions.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
