/* --- Teacher "publish a class" types (FR-022) --- */

import type { SkillLevel } from '@skillswap/contracts';

/**
 * Coarse category key for the skill and its marketplace icon.
 * Re-uses the dashboard's set so the marketplace preview can
 * share the same SkillBadge without leaking CDNs.
 */
export type SkillCategory =
  | 'language'
  | 'code'
  | 'design'
  | 'math'
  | 'business'
  | 'science';

/**
 * A skill the teacher has already been verified on (BR-008 / BR-010).
 * Only these may be used to open a new class — pending or rejected skills do
 * not surface in the picker.
 *
 * Populated from `GET /profile-skills/me`. That view carries no verifier name
 * and no approval date, so neither is modelled here: the picker shows the
 * skill, its category and the approved level only.
 */
export interface VerifiedSkill {
  id: string;
  category: SkillCategory;
  /** Short display label, e.g. "IELTS Speaking 7.5+". */
  label: string;
  /** The level the verifier approved, e.g. "advanced"; null until approved. */
  approvedLevel: SkillLevel | null;
}

/**
 * The editable draft the teacher is composing. Every field has
 * a safe default so the page can render before any input is
 * touched. The form orchestrator (Phase 4) keeps the
 * authoritative copy and feeds it to the live preview.
 */
export interface ClassDraft {
  skillId: string;
  title: string; // <= 100 chars
  description: string; // free text, 4 rows on the textarea
  durationMinutes: 30 | 45 | 60 | 90; // BR-017 standard set
  startsOn: string; // yyyy-mm-dd (ISO date, UTC)
  startsAt: string; // HH:mm (24h)
  capacity: number; // 1..15 (AC-028)
  priceCredits: number; // integer, 10..1000 (BR-034)
}

/**
 * The result of a successful publish. This is what `POST /classes` returns that
 * the screen can use: the new class id and the instant the class starts.
 *
 * There is deliberately **no** `classroomCode`. The API does not issue one at
 * publish time — the video room is minted later, per booking, at
 * `POST /classes/bookings/:bookingId/room-access`. The screen previously
 * displayed a locally-fabricated code, which no part of the system recognised.
 */
export interface PublishResult {
  classId: string;
  publishedAt: string; // ISO
}

/** Mirrors the BR-034 split: 1000 bps (10%) to the platform, 90% to
 * the teacher. 1 credit = 1,000 VND. The page derives everything
 * else from these two constants. */
export const PLATFORM_FEE_BPS = 1000;
export const VND_PER_CREDIT = 1000;
export const MIN_PRICE_CREDITS = 10;
export const MAX_PRICE_CREDITS = 1000;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 15;
export const TITLE_MAX_CHARS = 100;
export const ALLOWED_DURATIONS: ClassDraft['durationMinutes'][] = [
  30,
  45,
  60,
  90,
];
