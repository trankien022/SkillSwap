'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StudentVerificationReview } from './StudentVerificationReview';
import { StudentVerificationsQueue } from './StudentVerificationsQueue';

/**
 * FR-015 / W1: the queue is the primary surface, the id entry is the fallback.
 *
 * The order is deliberate. An administrator's normal job is to work the queue, so
 * the list comes first and the "open by id" control sits below it as a secondary
 * path for a deep link someone pasted in. The id entry is not removed: the review
 * route it opens still exists and is still linked from emails.
 */
export function ClientEntry({ initialStatus = '' }: { initialStatus?: string } = {}) {
  const t = useTranslations('Admin.StudentVerification');
  const [id, setId] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <StudentVerificationsQueue initialStatus={initialStatus} />

      <section className="workspace-panel workspace-form">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">{t('openByIdTitle')}</h2>
        <p className="mb-3 text-sm text-slate-600">{t('openByIdBody')}</p>
        <label htmlFor="review-verification-id" className="mb-2 block font-semibold">
          {t('label.id')}
        </label>
        <input
          id="review-verification-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t('idPlaceholder')}
          className="w-full h-9 rounded border px-2 text-sm"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShow(true)}
            disabled={!id.trim()}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {t('openCta')}
          </button>
        </div>

        {show && id.trim() && (
          <div className="mt-6">
            <StudentVerificationReview verificationId={id.trim()} />
          </div>
        )}
      </section>
    </div>
  );
}
