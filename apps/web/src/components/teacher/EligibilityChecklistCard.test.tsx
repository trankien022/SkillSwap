import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';
import { EligibilityChecklistCard } from './EligibilityChecklistCard';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';

/**
 * Tests for the eligibility checklist (BR-008 / BR-010 / SR-BR-004).
 *
 * The card previously rendered three ticks, three "valid" words and an
 * unconditional green "Eligible" badge with no inputs, so it reported success
 * for a draft that could not be published. These tests pin the property that
 * mattered: the card must reflect the draft, not assert a fixed verdict.
 */

function draft(overrides: Partial<ClassDraft> = {}): ClassDraft {
  return {
    skillId: 'skill-1',
    title: 'Graph algorithms',
    description: 'Bring a laptop.',
    durationMinutes: 60,
    startsOn: '2027-01-01',
    startsAt: '20:00',
    capacity: 1,
    priceCredits: 100,
    ...overrides,
  };
}

const skills: VerifiedSkill[] = [
  { id: 'skill-1', category: 'code', label: 'Graph algorithms', approvedLevel: 'advanced' },
];

function renderCard(d: ClassDraft, list: VerifiedSkill[] = skills) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EligibilityChecklistCard draft={d} skills={list} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('EligibilityChecklistCard', () => {
  it('reads Eligible only when every row really passes', () => {
    renderCard(draft());
    expect(screen.getByText('Eligible', { selector: 'span' })).toBeDefined();
    expect(screen.queryByText('Not yet eligible', { selector: 'span' })).toBeNull();
  });

  it('shows Not yet eligible when no approved skill is chosen', () => {
    renderCard(draft({ skillId: '' }));
    // The skill row is the only one that can fail on this input.
    expect(screen.getByText('Not yet eligible', { selector: 'span' })).toBeDefined();
    expect(screen.queryByText('Eligible', { selector: 'span' })).toBeNull();
    expect(screen.getAllByText('Not met').length).toBeGreaterThan(0);
  });

  it('shows Not yet eligible when the start time is under 24 hours away', () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const startsOn = soon.toISOString().slice(0, 10);
    const startsAt = soon.toISOString().slice(11, 16);

    renderCard(draft({ startsOn, startsAt }));

    expect(screen.getByText('Not yet eligible', { selector: 'span' })).toBeDefined();
    expect(screen.getAllByText('Not met').length).toBeGreaterThan(0);
  });

  it('treats an unparseable date as not met rather than as pass', () => {
    // `new Date('T:00')` does not throw on V8 — it resolves to 2000-01-01, which
    // would look like a lead-time *failure* for the wrong reason. The card must
    // report the row as unmet because the draft is incomplete, not because it
    // computed a date in the past.
    renderCard(draft({ startsOn: '', startsAt: '' }));
    expect(screen.getByText('Not yet eligible', { selector: 'span' })).toBeDefined();
    expect(screen.getAllByText('Not met').length).toBeGreaterThan(0);
  });
});
