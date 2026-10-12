'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { HttpTeacherPublishGateway, TeacherPublishAuthError } from '../../lib/teacher/http-gateway';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';
import { PublishForm } from './PublishForm';

/**
 * Client data boundary for the publish workspace (FR-005 / FR-022).
 *
 * Resolves the teacher's verified skills from `GET /profile-skills/me` before
 * mounting the form. The endpoint is auth-gated, which is why this is a client
 * component rather than a server-rendered fetch:
 *
 *  - signed out -> a sign-in prompt, since publishing requires an identity;
 *  - signed in but no approved skill -> an explanatory empty state, because
 *    BR-008/BR-010 forbid opening a class on an unverified skill;
 *  - transport failure -> an error state with a retry.
 *
 * It never falls back to fixture skills: the picker only ever shows skills the
 * server reports as approved.
 */
export function PublishWorkspace() {
  const locale = useLocale();
  const t = useTranslations('Teacher.publish');

  const [skills, setSkills] = useState<VerifiedSkill[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let active = true;

    async function load() {
      const gateway = new HttpTeacherPublishGateway();
      if (!gateway.isAuthenticated()) {
        if (active) setStatus('signed-out');
        return;
      }

      setStatus('loading');
      try {
        const verified = await gateway.getVerifiedSkills();
        if (active) {
          setSkills(verified);
          setStatus('ready');
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof TeacherPublishAuthError) {
          setStatus('signed-out');
        } else {
          setErrorMessage(error instanceof Error ? error.message : t('loadError'));
          setStatus('error');
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  if (status === 'loading') {
    return (
      <Panel>
        <p className="text-sm font-medium text-slate-700">{t('loading')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('loadingBody')}</p>
      </Panel>
    );
  }

  if (status === 'signed-out') {
    return (
      <Panel>
        <h2 className="text-base font-bold text-slate-900">{t('signedOutTitle')}</h2>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">
          {t('signedOutBody')}
        </p>
        <Link
          href={`/${locale}/auth`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
        >
          {t('signIn')}
        </Link>
      </Panel>
    );
  }

  if (status === 'error') {
    return (
      <Panel>
        <h2 className="text-base font-bold text-slate-900">{t('loadError')}</h2>
        <p role="alert" className="mt-1 max-w-md text-sm leading-relaxed text-rose-700">
          {errorMessage}
        </p>
      </Panel>
    );
  }

  if (skills === null || skills.length === 0) {
    return (
      <Panel>
        <h2 className="text-base font-bold text-slate-900">{t('noSkillsTitle')}</h2>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">
          {t('noSkillsBody')}
        </p>
        <Link
          href={`/${locale}/verification`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
        >
          {t('goToVerification')}
        </Link>
      </Panel>
    );
  }

  return <PublishForm initialDraft={emptyDraft()} skills={skills} />;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
  );
}

/**
 * The starting draft. All editable fields begin empty/neutral so nothing is
 * prefilled with values the teacher did not choose. The credit price starts at
 * the platform's minimum rather than a demo value.
 */
function emptyDraft(): ClassDraft {
  return {
    skillId: '',
    title: '',
    description: '',
    durationMinutes: 60,
    startsOn: '',
    startsAt: '',
    capacity: 1,
    priceCredits: 100,
  };
}
