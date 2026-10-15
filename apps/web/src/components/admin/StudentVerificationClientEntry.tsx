'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StudentVerificationReview } from './StudentVerificationReview';

export function ClientEntry() {
  const t = useTranslations('Admin.StudentVerification');
  const [id, setId] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="workspace-panel workspace-form">
      <div className="mb-3">
        <label htmlFor="review-profile-id" className="mb-2 block font-semibold">
          {t('label.id')}
        </label>
        <input
          id="review-profile-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t('idPlaceholder')}
          className="w-full h-9 rounded border px-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
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
    </div>
  );
}
