import { describe, expect, it } from 'vitest';
import {
  minutesUntil,
  TEACHER_OPEN_MINUTES,
  teacherJoinability,
} from './teacher-joinability';

const STARTS = '2026-11-10T10:00:00.000Z';
const DURATION = 60;

function at(offsetMinutes: number): Date {
  return new Date(new Date(STARTS).getTime() + offsetMinutes * 60_000);
}

function item(overrides: Partial<{ startsAt: string; durationMinutes: number; state: string }> = {}) {
  return { startsAt: STARTS, durationMinutes: DURATION, state: 'published', ...overrides };
}

/**
 * These cases mirror `authorizeTeacherRoomAccess`'s own spec. If the server's window or
 * joinable states change and this file does not, the button starts lying — enabled and then
 * refused, or hidden when the room is actually open.
 */
describe('teacherJoinability (FR-011 / ADR-040)', () => {
  it('opens exactly 15 minutes before the start', () => {
    expect(teacherJoinability(item(), at(-TEACHER_OPEN_MINUTES - 1)).state).toBe('too_early');
    expect(teacherJoinability(item(), at(-TEACHER_OPEN_MINUTES)).state).toBe('open');
  });

  it('stays open until the scheduled end, then closes', () => {
    expect(teacherJoinability(item(), at(DURATION)).state).toBe('open');
    expect(teacherJoinability(item(), at(DURATION + 1)).state).toBe('closed');
  });

  it('exposes the window bounds it judged against', () => {
    const result = teacherJoinability(item(), at(0));
    expect(result.opensAt.toISOString()).toBe('2026-11-10T09:45:00.000Z');
    expect(result.closesAt.toISOString()).toBe('2026-11-10T11:00:00.000Z');
  });

  it('allows exactly the three joinable class states', () => {
    for (const state of ['published', 'full', 'in_progress']) {
      expect(teacherJoinability(item({ state }), at(0)).state).toBe('open');
    }
    for (const state of ['draft', 'completed', 'cancelled']) {
      expect(teacherJoinability(item({ state }), at(0)).state).toBe('not_joinable');
    }
  });

  it('reports not_joinable even inside the window, so the clock cannot override the state', () => {
    expect(teacherJoinability(item({ state: 'cancelled' }), at(0)).state).toBe('not_joinable');
  });

  it('counts whole minutes until an instant, never below zero', () => {
    const target = at(12);
    expect(minutesUntil(target, at(0))).toBe(12);
    expect(minutesUntil(target, at(12))).toBe(0);
    expect(minutesUntil(target, at(30))).toBe(0);
  });
});
