import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';
import { SkillSelectSection } from './SkillSelectSection';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';

/**
 * The skill picker (BR-008 / BR-010).
 *
 * Reported defect: on first load the checklist said "Subject verified: Not met"
 * until the teacher re-picked the subject. A native <select> whose `value` matches
 * no option shows the *first* option regardless, so the field displayed a verified
 * skill while the draft still held `skillId: ''`. The visible choice and the state
 * disagreed, and the teacher had no way to tell.
 *
 * The invariant these tests pin: what the control displays must be derived from the
 * draft, so an unpicked draft cannot look picked.
 */

const skills: VerifiedSkill[] = [
  { id: 'skill-1', category: 'code', label: 'Graph algorithms', approvedLevel: 'advanced' },
  { id: 'skill-2', category: 'language', label: 'IELTS speaking', approvedLevel: 'intermediate' },
];

function draft(overrides: Partial<ClassDraft> = {}): ClassDraft {
  return {
    skillId: '',
    title: '',
    description: '',
    durationMinutes: 60,
    startsOn: '',
    startsAt: '',
    capacity: 1,
    priceCredits: 100,
    ...overrides,
  };
}

function renderPicker(d: ClassDraft, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SkillSelectSection skills={skills} draft={d} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return screen.getByLabelText(/step|subject|skill/i) as HTMLSelectElement;
}

afterEach(() => {
  cleanup();
});

describe('SkillSelectSection', () => {
  it('shows the placeholder — not a real skill — while no subject is picked', () => {
    const select = renderPicker(draft());

    expect(select.value).toBe('');
    expect(select.selectedOptions[0]?.textContent).toContain('Select a verified skill');
  });

  it('offers the placeholder as a selectable option once a skill is picked', () => {
    // Keeping the empty option means the teacher can undo a choice without
    // reloading the page, and the list has one stable shape either way.
    const select = renderPicker(draft({ skillId: 'skill-1' }));

    expect(select.value).toBe('skill-1');
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'skill-1', 'skill-2']);
  });

  it('reports the picked skill to the draft', () => {
    const onChange = vi.fn();
    const select = renderPicker(draft(), onChange);

    fireEvent.change(select, { target: { value: 'skill-2' } });

    expect(onChange).toHaveBeenCalledWith({ skillId: 'skill-2' });
  });

  it('still renders the placeholder when the teacher has no verified skills', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SkillSelectSection skills={[]} draft={draft()} onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );

    const select = screen.getByLabelText(/step|subject|skill/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['']);
  });
});
