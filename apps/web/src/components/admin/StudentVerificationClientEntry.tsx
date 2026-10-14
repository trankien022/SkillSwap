'use client';

import { useState } from 'react';
import { StudentVerificationReview } from './StudentVerificationReview';

export function ClientEntry() {
  const [id, setId] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div>
      <div className="mb-3">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Verification id" className="w-full h-9 rounded border px-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShow(true)} disabled={!id.trim()} className="rounded bg-slate-900 px-3 py-1 text-xs text-white">Open</button>
      </div>

      {show && id.trim() && (
        <div className="mt-6">
          <StudentVerificationReview verificationId={id.trim()} />
        </div>
      )}
    </div>
  );
}
