'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { callApi, unwrapEnvelope } from '../../lib/api-client';
import { TeacherLiveClassroomContent } from './TeacherLiveClassroomContent';

/**
 * FR-011 / ADR-040: loads the class header facts, then hands over to the classroom.
 *
 * Kept as a client wrapper because the class detail is an authenticated read (the teacher's
 * own class), and because the classroom itself is a client component driving the Jitsi iframe.
 * A completed or cancelled class answers 404 to a non-owner, so a stranger holding the URL
 * gets the same "not found" as they would from the roster.
 */

interface ClassHeader {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  teacherId: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; header: ClassHeader }
  | { kind: 'not_found' }
  | { kind: 'error' };

export function TeacherLiveClassroomPage({ classId }: { classId: string }) {
  const locale = useLocale();
  const t = useTranslations('TeacherLiveClassroom');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await callApi(`/classes/${encodeURIComponent(classId)}`, { method: 'GET' });
        if (res.status === 404) {
          if (!cancelled) setState({ kind: 'not_found' });
          return;
        }
        const detail = await unwrapEnvelope<ClassHeader>(res);
        if (cancelled) return;
        setState({
          kind: 'ready',
          header: {
            id: detail.id,
            title: detail.title,
            startsAt: detail.startsAt,
            durationMinutes: detail.durationMinutes,
            teacherId: detail.teacherId,
          },
        });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (state.kind === 'loading') {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {t('states.connecting')}
      </p>
    );
  }

  if (state.kind === 'not_found' || state.kind === 'error') {
    const key = state.kind === 'not_found' ? 'notFound' : 'unavailable';
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">{t(`states.${key}.title`)}</h2>
        <p className="mt-1 text-sm text-slate-600">{t(`states.${key}.body`)}</p>
        <Link
          href={`/${locale}/instructor`}
          className="mt-4 inline-block rounded-full bg-campus-emerald-deep px-4 py-2 text-sm font-bold text-white hover:bg-ink"
        >
          {t('nav.back')}
        </Link>
      </div>
    );
  }

  return (
    <TeacherLiveClassroomContent
      classId={state.header.id}
      classTitle={state.header.title}
      startsAt={state.header.startsAt}
      durationMinutes={state.header.durationMinutes}
    />
  );
}
