'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { callApiOk, callApi, unwrapEnvelope } from '../../../lib/api-client';
import { capacityIsValid, priceIsValid } from '../../../lib/teacher/money';
import {
  readApiMessage,
  toTeacherClassItem,
  toUpdateClassInput,
  type ClassEditDraft,
  type TeacherClassItem,
} from '../../../lib/teacher/dashboard-view-model';
import { WorkspaceFooter } from '../../../components/ui/WorkspaceFooter';
import { SkillCategoryLabel } from '../../../components/ui/SkillCategoryLabel';
import { PageIntro } from '../../../components/ui/PageIntro';
import { Navbar } from '../../../components/navbar';
import type {
  ProfileSkillView,
  WalletBalanceView,
  MeResponse,
  ListClassesPageView,
} from '@skillswap/contracts';

/** The class lifecycle states that mean "this class is over". */
const COMPLETED_CLASS_STATES = new Set(['completed', 'cancelled']);

/**
 * The states from which `POST /classes/:id/start` is legal on the server
 * (`published|full -> in_progress`). The button is gated on this so the common
 * case does not rely on a 409 to be told the class cannot start yet.
 */
const STARTABLE_CLASS_STATES = new Set(['published', 'full']);

export default function InstructorDashboard() {
  const ui = useTranslations('Workspace.copy');

  const locale = useLocale();
  const tWorkspace = useTranslations('Workspace.teaching');
  const tLevels = useTranslations('Marketplace.card.levels');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [skills, setSkills] = useState<ProfileSkillView[]>([]);
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<'all' | 'upcoming' | 'open' | 'completed'>('all');
  /** The class whose inline edit panel is open, or null. */
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [skillsRes, balRes, meRes, classesRes] = await Promise.all([
          callApi('/profile-skills/me'),
          callApi('/wallet/balance'),
          callApi('/auth/me'),
          callApi('/classes?teacherId=me'),
        ]);

        if (!active) return;

        if (skillsRes.ok) {
          const data = await unwrapEnvelope<{ items: ProfileSkillView[] }>(skillsRes);
          if (Array.isArray(data.items)) setSkills(data.items);
        }

        if (balRes.ok) {
          setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
        }

        if (meRes.ok) {
          setMe(await unwrapEnvelope<MeResponse>(meRes));
        }

        if (classesRes.ok) {
          const page = await unwrapEnvelope<ListClassesPageView>(classesRes);
          if (page && Array.isArray(page.items)) {
            // Read straight from the server. There is deliberately no localStorage
            // cache: the list is server-owned, and a local copy is how this screen
            // and the publish screen came to disagree about which classes existed.
            setClasses(page.items.map(toTeacherClassItem));
          }
        } else if (classesRes.status === 401) {
          setLoadError(ui('yourSessionHasExpiredPleaseSign'));
        } else {
          setLoadError(ui('couldNotLoadYourTeachingClasses'));
        }
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : ui('couldNotLoadYourTeachingInformation'),
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /**
   * Re-reads the class list and wallet from the server and repaints from that
   * response. Used after every lifecycle command so the screen shows server
   * truth rather than an optimistically mutated local copy.
   */
  const refreshServerState = async () => {
    try {
      // Both reads run after a lifecycle command that moved money or changed a
      // class, so a failure must not leave the previous numbers on screen as if
      // nothing had happened.
      const [balRes, classesRes] = await Promise.all([
        callApiOk('/wallet/balance'),
        callApiOk('/classes?teacherId=me'),
      ]);
      setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));
      const page = await unwrapEnvelope<ListClassesPageView>(classesRes);
      if (Array.isArray(page?.items)) setClasses(page.items.map(toTeacherClassItem));
    } catch (e) {
      showToast(ui('theRequestWasSentButThe'));
      console.warn('Failed to refresh teacher server state:', e);
    }
  };
  /**
   * Starts a class. The server answers `{ started }`: `false` means the class was
   * already in progress, which is a truthful no-op rather than a new success, so
   * the two are reported differently instead of both claiming "đã bắt đầu".
   */
  const handleStartClass = async (classId: string) => {
    try {
      setIsProcessing(true);
      const res = await callApi(`/classes/${classId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiMessage(res, ui('couldNotStartTheClass')));
      const result = await unwrapEnvelope<{ started: boolean }>(res);
      showToast(result?.started ? ui('classStarted') : ui('thisClassWasAlreadyStarted'));
      await refreshServerState();
    } catch (e) {
      showToast(ui('errorundefined') + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Completes a class and releases the teacher's income. The server answers
   * `{ completed, basis }`: `completed: false` means nothing was settled (the
   * class was already completed, or it had not started), so the income message is
   * only shown when money actually moved — `basis` is the server's own reason.
   */
  const handleCompleteClass = async (classId: string) => {
    try {
      setIsProcessing(true);
      const res = await callApi(`/classes/${classId}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiMessage(res, ui('couldNotCompleteTheClass')));
      const result = await unwrapEnvelope<{ completed: boolean; basis: string | null }>(res);
      showToast(
        result?.completed
          ? ui('classCompletedEarningsHaveBeenReleased')
          : ui('thereIsNothingLeftToComplete'),
      );

      // Re-read the wallet and the class list, so the screen shows server truth
      // after the money moved.
      await refreshServerState();
    } catch (e) {
      showToast(ui('errorundefined') + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Saves an edit to price and capacity. Only changed fields are sent, so an
   * unrelated field is never overwritten with the same value. A `409` means the
   * class is locked by a confirmed booking; the panel closes without changing
   * anything and the server's own message is shown.
   */
  const handleSaveEdit = async (classId: string, draft: ClassEditDraft) => {
    const payload = toUpdateClassInput(draft);
    if (Object.keys(payload).length === 0) {
      setEditingClassId(null);
      return;
    }

    try {
      setIsProcessing(true);
      const res = await callApi(`/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readApiMessage(res, ui('couldNotSaveChanges')));
      showToast(ui('changesSaved'));
      setEditingClassId(null);
      await refreshServerState();
    } catch (e) {
      showToast(ui('errorundefined') + (e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const approvedSkills = skills.filter((s) => s.approvedLevel !== null);
  const upcomingCount = classes.filter((c) => !COMPLETED_CLASS_STATES.has(c.state)).length;
  const completedCount = classes.filter((c) => COMPLETED_CLASS_STATES.has(c.state)).length;

  const visibleClasses = classes.filter((c) => {
    if (classFilter === 'all') return true;
    if (classFilter === 'completed') return COMPLETED_CLASS_STATES.has(c.state);
    return !COMPLETED_CLASS_STATES.has(c.state);
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50 relative">
      <Navbar currentTab="instructor" balance={balance} me={me} />

      <main id="main-content" tabIndex={-1} className="workspace-page flex-1">
        <div className="w-full">
          <PageIntro
            title={tWorkspace('title')}
            description={tWorkspace('description')}
            art="design"
            artAlt={tWorkspace('artAlt')}
            actions={
              <>
                <a href={`/${locale}/teach/classes/new`} className="workspace-primary">
                  {tWorkspace('publish')} ↗
                </a>
                <a href={`/${locale}/skills`} className="workspace-link">
                  {tWorkspace('skills')}
                </a>
              </>
            }
          />
          {me && (
            <p className="mb-6 text-sm text-ink-soft">
              {me.displayName} ·{' '}
              {me.studentVerification?.status === 'approved'
                ? tWorkspace('verified')
                : tWorkspace('member')}
            </p>
          )}
          {/* 2. KPI summary. Each tile shows a value the server actually reports.
              The previous version also showed a completion rate, a 4.9/5 rating
              and a review count; those came from nowhere (the schema marks the
              rating fields as provisional) so they are omitted rather than
              made up. */}
          <div className="workspace-teaching-metrics">
            <MetricCard
              label={ui('availableEarnings')}
              icon="account_balance_wallet"
              value={balance ? balance.availableCredits.toLocaleString(locale) : '—'}
              unit="Credit"
              sub={
                balance
                  ? `≈ ${(balance.availableCredits * 1000).toLocaleString(locale)} VND`
                  : undefined
              }
              footer={
                <a
                  href={`/${locale}/wallet/withdrawal`}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  {ui('withdrawEarnings')}{' '}
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                    arrow_forward
                  </span>
                </a>
              }
            />

            <MetricCard
              label={ui('heldForClasses')}
              icon="lock_clock"
              value={balance ? balance.pendingCredits.toLocaleString(locale) : '—'}
              unit="Credit"
              sub={ui('earningsHeldUntilClassCompletion')}
              footer={
                <span className="text-sm text-slate-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{' '}
                  {ui('releasedAfterTheSessionIsCompleted')}
                </span>
              }
            />

            <MetricCard
              label={ui('openClasses')}
              icon="school"
              value={isLoading ? '—' : String(upcomingCount)}
              unit={tWorkspace('classUnit')}
              sub={ui('publishedClassesThatHaveNotEnded')}
            />

            <MetricCard
              label={ui('closedClasses')}
              icon="task_alt"
              value={isLoading ? '—' : String(completedCount)}
              unit={tWorkspace('classUnit')}
              sub={ui('completedOrCancelledClasses')}
            />
          </div>

          {/* 3. Approved skills — real list, or an honest empty state. The old
              demo fallback cards named a verifier ("Thầy Hùng") who is not in
              the system. */}
          <div className="mb-10">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="workspace-panel-title">{ui('approvedTeachingSkills')}</h2>
                <p className="text-sm text-slate-600">
                  {ui('skillsApprovedForPublishingNewClasses')}
                </p>
              </div>
              <a
                href={`/${locale}/skills`}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  add
                </span>{' '}
                {ui('addASkill')}
              </a>
            </div>

            {approvedSkills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {approvedSkills.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-md text-emerald-700 bg-emerald-50">
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[12px]"
                          >
                            verified
                          </span>
                          {ui('approved')}
                        </span>
                        <span className="text-sm font-medium text-slate-500 capitalize">
                          {s.approvedLevel ? tLevels(s.approvedLevel) : '—'}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1">{s.skillName}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                        {ui('category')}
                        <SkillCategoryLabel category={s.category} />
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        {ui('id')}
                        {s.skillId.slice(0, 8)}
                      </span>
                      <a
                        href={`/${locale}/teach/classes/new`}
                        className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        {ui('publishAClassundefined')}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-sm font-semibold text-slate-800">{ui('noApprovedSkillsYet')}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {ui('submitSkillEvidenceForExpertReview')}
                </p>
                <a
                  href={`/${locale}/skills`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
                >
                  {ui('submitSkillEvidence')}
                </a>
              </div>
            )}
          </div>

          {/* 4. Classes — the teacher's own list, straight from the server. The
              previous version appended three hardcoded demo cards with fake
              booking links. */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="workspace-panel-title">{ui('teachingScheduleAndClasses')}</h2>
                <p className="text-sm text-slate-600">{ui('classesYouHavePublished')}</p>
              </div>
              <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl text-sm font-semibold">
                <FilterButton
                  active={classFilter === 'all'}
                  onClick={() => setClassFilter('all')}
                  label={tWorkspace('allCount', { count: classes.length })}
                />
                <FilterButton
                  active={classFilter === 'upcoming'}
                  onClick={() => setClassFilter('upcoming')}
                  label={tWorkspace('openCount', { count: upcomingCount })}
                />
                <FilterButton
                  active={classFilter === 'completed'}
                  onClick={() => setClassFilter('completed')}
                  label={tWorkspace('closedCount', { count: completedCount })}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
                {ui('loadingClasses')}
              </div>
            ) : loadError !== null ? (
              <div
                role="alert"
                className="bg-white p-8 rounded-2xl border border-rose-200 text-center text-sm font-medium text-rose-700"
              >
                {loadError}
              </div>
            ) : visibleClasses.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-sm font-semibold text-slate-800">{ui('noClassesYet')}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {ui('yourPublishedClassesWillAppearHere')}
                </p>
                <a
                  href={`/${locale}/teach/classes/new`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
                >
                  {ui('publishYourFirstClass')}
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleClasses.map((item) => {
                  const isCompleted = COMPLETED_CLASS_STATES.has(item.state);
                  return (
                    <div
                      key={item.id}
                      className={`bg-white p-5 rounded-2xl border transition-colors ${
                        isCompleted
                          ? 'border-slate-200 opacity-90 hover:opacity-100'
                          : 'border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold ${
                                isCompleted
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isCompleted ? ui('ended') : ui('openForBooking')}
                            </span>
                            <span className="text-sm text-slate-600 font-medium">
                              {item.availableSeats} {ui('availableSeats')}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-base">{item.description}</h3>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1 text-slate-900 font-medium">
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px] text-emerald-600"
                              >
                                calendar_today
                              </span>{' '}
                              {new Date(item.startsAt).toLocaleDateString(locale)}{' '}
                              {new Date(item.startsAt).toLocaleTimeString(locale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              • {item.durationMinutes} {ui('mine5d92')}
                            </span>
                            <span className="flex items-center gap-1">
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px] text-slate-500"
                              >
                                group
                              </span>{' '}
                              {item.confirmedBookingsCount}/{item.capacity} {ui('learners')}
                            </span>
                            <span className="flex items-center gap-1 text-slate-900 font-semibold">
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px] text-emerald-600"
                              >
                                payments
                              </span>{' '}
                              {item.priceCredits} {ui('creditsPerLearner')}
                            </span>
                          </div>
                        </div>
                        <div className="flex max-w-full flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
                          <span className="text-sm text-slate-500 font-mono">
                            {item.id.slice(0, 8)}
                          </span>
                          {!isCompleted && (
                            <button
                              onClick={() =>
                                setEditingClassId(editingClassId === item.id ? null : item.id)
                              }
                              type="button"
                              className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                              disabled={isProcessing}
                            >
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px]"
                              >
                                edit
                              </span>{' '}
                              {ui('edit')}
                            </button>
                          )}
                          {STARTABLE_CLASS_STATES.has(item.state) && (
                            <button
                              onClick={() => handleStartClass(item.id)}
                              type="button"
                              className="px-4 py-2 rounded-full text-sm font-semibold bg-campus-emerald-deep hover:bg-ink text-white transition-colors flex items-center gap-1.5 disabled:opacity-60"
                              disabled={isProcessing}
                            >
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px]"
                              >
                                play_arrow
                              </span>{' '}
                              {ui('start')}
                            </button>
                          )}
                          {!isCompleted && (
                            <button
                              onClick={() => handleCompleteClass(item.id)}
                              type="button"
                              className="px-4 py-2 rounded-full text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 disabled:opacity-60"
                              disabled={isProcessing}
                            >
                              <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[16px]"
                              >
                                check_circle
                              </span>{' '}
                              {ui('complete')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline edit — price and capacity only. A 409 means the
                          class is locked by a confirmed booking; the panel stays
                          open and the server's own message is shown. */}
                      {editingClassId === item.id && (
                        <ClassEditPanel
                          item={item}
                          disabled={isProcessing}
                          onCancel={() => setEditingClassId(null)}
                          onSave={(draft) => handleSaveEdit(item.id, draft)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <WorkspaceFooter />
      {/* Toast */}
      <div
        role="status"
        className={`fixed bottom-6 right-6 max-w-[calc(100vw-3rem)] z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 transition-colors duration-300 ${
          toastMessage
            ? 'translate-y-0 opacity-100'
            : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-emerald-400">
          check_circle
        </span>
        <span className="text-sm font-medium">{toastMessage}</span>
      </div>
    </div>
  );
}

/* --- Small presentational helpers --- */

/**
 * The inline price/capacity editor for one class card.
 *
 * It edits a local copy and refuses to submit values the API would reject, using
 * the same validators the publish form uses so the two cannot disagree. Capacity
 * is additionally not allowed below the seats already confirmed, which the
 * server would reject anyway — catching it here avoids a round trip that can
 * only fail.
 */
function ClassEditPanel({
  item,
  disabled,
  onCancel,
  onSave,
}: {
  item: TeacherClassItem;
  disabled: boolean;
  onCancel: () => void;
  onSave: (draft: ClassEditDraft) => void;
}) {
  const ui = useTranslations('Workspace.copy');

  const [price, setPrice] = useState(String(item.priceCredits));
  const [capacity, setCapacity] = useState(String(item.capacity));

  const priceNumber = Number(price);
  const capacityNumber = Number(capacity);

  const priceOk = priceIsValid(priceNumber);
  const capacityOk =
    capacityIsValid(capacityNumber) && capacityNumber >= item.confirmedBookingsCount;

  const canSave = priceOk && capacityOk && !disabled;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">
            {ui('pricePerLearnerInCredits')}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={price}
            disabled={disabled}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:bg-slate-50"
          />
          {!priceOk && (
            <span className="text-sm text-rose-600">{ui('enterAWholeCreditAmountWithin')}</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">{ui('maximumCapacity')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={capacity}
            disabled={disabled}
            onChange={(e) => setCapacity(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none disabled:bg-slate-50"
          />
          {!capacityOk && (
            <span className="text-sm text-rose-600">
              {capacityIsValid(capacityNumber)
                ? ui('minimumConfirmedSeats', { count: item.confirmedBookingsCount })
                : ui('enterAWholeCapacityWithinThe')}
            </span>
          )}
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onSave({ priceCredits: priceNumber, capacity: capacityNumber })}
          disabled={!canSave}
          className="px-4 py-2 rounded-full text-sm font-semibold bg-campus-emerald-deep hover:bg-ink text-white transition-colors disabled:opacity-50"
        >
          {ui('saveChanges')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-4 py-2 rounded-full text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50"
        >
          {ui('cancel')}
        </button>
      </div>
    </div>
  );
}

/**
 * The editable subset of a class. Only price and capacity are exposed: they are
 * the fields a teacher changes in practice and the only two with local
 * validators already (`priceIsValid`, `capacityIsValid`). Schedule changes
 * interact with the 24 h booking lead time and are deferred.
 */
/**
 * Reads the API's own failure message from a non-2xx response, falling back to
 * a caller-supplied string when the body carries none. The uniform envelope
 * puts the human message on `message`.
 */
function MetricCard({
  label,
  icon,
  value,
  unit,
  sub,
  footer,
}: {
  label: string;
  icon: string;
  value: string;
  unit: string;
  sub?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-600 text-sm font-medium mb-2">
          <span>{label}</span>
          <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">
            {icon}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-2xl text-slate-900">{value}</span>
          <span className="text-sm font-semibold text-slate-600">{unit}</span>
        </div>
        {sub !== undefined && <span className="text-sm text-slate-500 font-normal">{sub}</span>}
      </div>
      {footer !== undefined && <div className="mt-4 pt-3 border-t border-slate-100">{footer}</div>}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}
