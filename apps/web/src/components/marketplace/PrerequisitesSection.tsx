'use client';

import { useTranslations } from 'next-intl';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Prerequisites section (FR-006 detail).
 *
 * Three icon cards (devices / focus area / conduct). Copy is shared
 * across all classes — no class-specific PR language is fabricated.
 */
export function PrerequisitesSection({ item }: { item: ClassDetailView }) {
  const t = useTranslations('ClassDetail.prerequisites');

  return (
    <section className="workspace-panel">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink">
          <ChecklistIcon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {item.prerequisites.map((req, idx) => (
          <article
            key={idx}
            className="flex flex-col gap-2 rounded-xl border border-border bg-mist p-4"
          >
            <PrereqIcon icon={req.icon} />
            <span className="text-base font-semibold text-ink">{req.title}</span>
            <p className="text-sm text-ink-soft">{req.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrereqIcon({ icon }: { icon: ClassDetailView['prerequisites'][number]['icon'] }) {
  const className = 'h-6 w-6 text-campus-emerald';
  switch (icon) {
    case 'devices':
      return <HeadsetMicIcon className={className} />;
    case 'topic':
      return <QuizIcon className={className} />;
    case 'conduct':
      return <GavelIcon className={className} />;
    case 'language':
      return <LanguageIcon className={className} />;
    case 'book':
      return <BookIcon className={className} />;
  }
}

function ChecklistIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function HeadsetMicIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1v-6H3z" />
    </svg>
  );
}

function QuizIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}

function GavelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 4l6 6-4 4-6-6z" />
      <line x1="3" y1="21" x2="13" y2="11" />
      <line x1="9" y1="7" x2="17" y2="15" />
    </svg>
  );
}

function LanguageIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="4" y1="5" x2="14" y2="5" />
      <path d="M4 5l-2 7" />
      <line x1="2" y1="12" x2="12" y2="12" />
      <path d="M14 21l4-10 4 10" />
      <line x1="15.5" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function BookIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}
