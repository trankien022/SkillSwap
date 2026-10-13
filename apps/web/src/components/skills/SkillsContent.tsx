'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  HttpSkillsGateway,
  SkillsAuthError,
} from '../../lib/skills/http-gateway';
import type {
  ProfileSkillView,
  SkillCatalogueItemView,
  SkillEvidenceHistoryView,
  SkillLevel,
} from '@skillswap/contracts';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

/**
 * Skills + evidence screen (S10, FR-003 / FR-018) — the Web twin of the mobile
 * `(features)/skills.tsx`.
 *
 * This route previously did not exist on Web, so a learner verified on mobile
 * had nowhere in the browser to see their approved skills or submit evidence.
 *
 * Everything shown comes from the API. The form submits through the real
 * `POST /skill-evidence`, the approved list from `GET /profile-skills/me`, the
 * history from `GET /skill-evidence/:id/history`. A failed submit renders the
 * API's own message; nothing is reported as saved that the server rejected.
 */
export function SkillsContent() {
  const t = useTranslations('Skills');
  const locale = useLocale();

  const [status, setStatus] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [catalogue, setCatalogue] = useState<SkillCatalogueItemView[]>([]);
  const [mine, setMine] = useState<ProfileSkillView[]>([]);

  const [selected, setSelected] = useState<string>('');
  const [level, setLevel] = useState<SkillLevel>('beginner');
  const [description, setDescription] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; skillName: string } | null>(null);

  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<SkillEvidenceHistoryView | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const gateway = new HttpSkillsGateway();
    if (!gateway.isAuthenticated()) {
      setStatus('signed-out');
      return;
    }

    setStatus('loading');
    try {
      const [catalogueItems, profileItems] = await Promise.all([
        gateway.getCatalogue(),
        gateway.getMyProfileSkills(),
      ]);
      setCatalogue(catalogueItems);
      setMine(profileItems);
      setStatus('ready');
    } catch (error) {
      if (error instanceof SkillsAuthError) {
        setStatus('signed-out');
      } else {
        setErrorMessage(error instanceof Error ? error.message : t('loadError'));
        setStatus('error');
      }
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const approved = mine.filter((item) => item.approvedLevel !== null);
  const pending = mine.filter((item) => item.approvedLevel === null);

  const canSubmit =
    selected !== '' && description.trim().length > 0 && description.length <= 1000 && !busy;

  const submit = async () => {
    if (!canSubmit) return;

    setBusy(true);
    setSubmitError(null);
    setSubmitted(null);

    const skillName = catalogue.find((item) => item.id === selected)?.name ?? selected;

    try {
      // `evidenceType` is required by the contract. The catalogue offers no
      // document upload, so the only honest option is `verifier_assessment`
      // (the submitted description is what a verifier reads).
      const result = await new HttpSkillsGateway().submitEvidence({
        skillId: selected,
        requestedLevel: level,
        evidenceType: 'verifier_assessment',
        description: description.trim(),
      });
      setSubmitted({ id: result.id, skillName });
      setDescription('');
      setHistory(null);
      setHistoryFor(null);
      await load();
    } catch (error) {
      // Any rejection is surfaced with the API's own message. The previous
      // mobile screen swallowed the reason into a generic banner; the Web
      // screen shows the message so the learner can act on it.
      setSubmitError(error instanceof Error ? error.message : t('submitError'));
    } finally {
      setBusy(false);
    }
  };

  const showHistory = async (evidenceId: string) => {
    setHistoryError(null);
    setHistory(null);
    setHistoryFor(evidenceId);
    try {
      setHistory(await new HttpSkillsGateway().getEvidenceHistory(evidenceId));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : t('historyError'));
    }
  };

  if (status === 'loading') {
    return <Panel>
      <p className="text-sm font-medium text-slate-700">{t('loading')}</p>
    </Panel>;
  }

  if (status === 'signed-out') {
    return (
      <Panel>
        <h1 className="text-lg font-bold text-slate-900">{t('signedOutTitle')}</h1>
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
        <h1 className="text-lg font-bold text-slate-900">{t('loadError')}</h1>
        <p role="alert" className="mt-1 max-w-md text-sm leading-relaxed text-rose-700">
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
        >
          {t('retry')}
        </button>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Approved skills — the real `GET /profile-skills/me` result. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{t('approved')}</h2>
        <p className="mt-1 text-xs text-slate-600">{t('approvedBody')}</p>

        {approved.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            {t('noneApproved')}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {approved.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.skillName}</p>
                  <p className="text-xs text-slate-600">{item.category}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {t(`level_${item.approvedLevel}`)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('pending')}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {pending.map((item) => (
                <li
                  key={item.id}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {item.skillName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 2. Submit evidence — real POST /skill-evidence. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{t('submitTitle')}</h2>
        <p className="mt-1 text-xs text-slate-600">{t('submitBody')}</p>

        <fieldset className="mt-4" disabled={busy}>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('chooseSkill')}
          </legend>
          {catalogue.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">{t('noCatalogue')}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {catalogue.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSelected(skill.id)}
                  aria-pressed={selected === skill.id}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    selected === skill.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-semibold">{skill.name}</span>
                  <span className="block text-[11px] text-slate-500">{skill.category}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('requestedLevel')}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevel(item)}
                  aria-pressed={level === item}
                  className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    level === item
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t(`level_${item}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="evidence-description" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('description')}
            </label>
            <textarea
              id="evidence-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t('description')}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('descriptionHint')}</p>
          </div>
        </fieldset>

        {submitError !== null && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            {submitError}
          </p>
        )}

        {submitted !== null && (
          <p role="status" aria-live="polite" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            {t('submitted', { skill: submitted.skillName })}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? t('submitting') : t('submit')}
        </button>

        {submitted !== null && (
          <button
            type="button"
            onClick={() => void showHistory(submitted.id)}
            className="mt-3 block text-xs font-semibold text-emerald-700 hover:underline"
          >
            {t('history')}
          </button>
        )}

        {historyFor !== null && historyError !== null && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-700">
            {historyError}
          </p>
        )}

        {historyFor !== null && history !== null && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('historyTitle')}
            </h3>
            {history.versions.length === 0 ? (
              <p className="mt-1 text-xs text-slate-600">{t('noHistory')}</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {history.versions.map((version, index) => (
                  <li key={index} className="text-xs text-slate-700">
                    {t(`level_${version.requestedLevel}`)} · {t(`state_${version.currentStatus}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}
