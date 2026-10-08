import type { ClassView } from '@/domain/booking/booking';

/**
 * Demo class fixture (mock only — no backend). Shape mirrors the backend
 * `ClassView` (API-004 response / classSchema) exactly.
 */
export const DEMO_CLASS_ID = 'demo-class-1';

export function demoClass(): ClassView {
  const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  return {
    id: DEMO_CLASS_ID,
    teacherId: 'teacher-demo',
    state: 'published',
    startsAt,
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 2,
  };
}
