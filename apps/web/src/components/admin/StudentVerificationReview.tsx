'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HttpVerificationGateway, AdminAuthError } from '../../lib/verification/http-gateway';

const gateway = new HttpVerificationGateway();

export function StudentVerificationReview({ verificationId }: { verificationId: string }) {
  const t = useTranslations('Admin.StudentVerification');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [approvedMajor, setApprovedMajor] = useState('');

  async function handleDecide() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        decision,
        reason: reason || undefined,
        approvedMajor: approvedMajor || undefined,
      };
      await gateway.decideStudentVerification(verificationId, payload);
      setSuccess(t('messages.decided'));
    } catch (err) {
      if (err instanceof AdminAuthError) {
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

  async function handleRevoke() {
    // confirmation required
    const ok = window.confirm(t('revokeConfirm'));
    if (!ok) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await gateway.revokeStudentVerification(verificationId, { reason: reason || 'Revoked by admin' });
      setSuccess(t('messages.revoked'));
    } catch (err) {
      if (err instanceof AdminAuthError) {
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold mb-4">{t('title')}</h1>

      <p className="text-sm text-slate-600 mb-4">{t('notice')}</p>

      <div className="mb-4">
        <div className="text-xs text-slate-500">{t('label.id')}</div>
        <div className="text-sm font-mono">{verificationId}</div>
      </div>

      {error && <div className="mb-4 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-700">{success}</div>}

      <div className="space-y-3">
        <fieldset>
          <legend className="text-sm font-semibold mb-2">{t('label.decision')}</legend>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" name="decision" value="approve" checked={decision === 'approve'} onChange={() => setDecision('approve')} />
              <span className="text-sm">{t('actions.approve')}</span>
            </label>

            <label className="flex items-center gap-2">
              <input type="radio" name="decision" value="reject" checked={decision === 'reject'} onChange={() => setDecision('reject')} />
              <span className="text-sm">{t('actions.reject')}</span>
            </label>
          </div>
        </fieldset>

        <div>
          <div className="text-xs text-slate-500">{t('label.approvedMajor')}</div>
          <input value={approvedMajor} onChange={(e) => setApprovedMajor(e.target.value)} placeholder={t('placeholders.approvedMajor')} className="w-full h-9 rounded border px-2 text-sm" />
        </div>

        <div>
          <div className="text-xs text-slate-500">{t('label.reason')}</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('placeholders.reason')} className="w-full rounded border px-2 py-2 text-sm" />
        </div>

        <div className="flex gap-2">
          <button onClick={handleDecide} disabled={loading} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">{t('actions.submitDecision')}</button>

          <button onClick={handleRevoke} disabled={loading} className="rounded bg-red-600 px-3 py-1 text-xs text-white">{t('actions.revoke')}</button>
        </div>

        <div className="text-xs text-slate-500">{t('note')}</div>
      </div>
    </div>
  );
}
