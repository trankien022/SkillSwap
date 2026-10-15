import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import viMessages from '../../messages/vi.json';
import type { ClassDraft } from '../../lib/teacher/types';
import { ClassFormatSection } from './ClassFormatSection';
import { ScheduleDurationSection } from './ScheduleDurationSection';
import { PublishToast } from './PublishToast';

afterEach(cleanup);
const draft: ClassDraft = {
  skillId: '',
  title: '',
  description: '',
  startsOn: '',
  startsAt: '',
  capacity: 1,
  durationMinutes: 60,
  priceCredits: 100,
};
function localized(children: React.ReactNode, locale: 'vi' | 'en' = 'en') {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === 'vi' ? viMessages : en}>
      {children}
    </NextIntlClientProvider>
  );
}
describe('teacher UI feedback', () => {
  it('does not certify a blank schedule and exposes the selected duration', () => {
    render(localized(<ScheduleDurationSection draft={draft} onChange={vi.fn()} />));
    expect(screen.queryByText(en.Teacher.publish.steps.leadTimeValid)).toBeNull();
    const selected = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('60');
  });
  it('announces the selected format and localizes capacity controls', () => {
    const onChange = vi.fn();
    render(
      localized(
        <ClassFormatSection draft={{ ...draft, capacity: 12 }} onChange={onChange} />,
        'vi',
      ),
    );
    expect(
      screen.getByRole('button', { name: viMessages.Teacher.publish.schedule.decrementCapacity }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: viMessages.Teacher.publish.schedule.incrementCapacity }),
    );
    expect(onChange).toHaveBeenCalledWith({ capacity: 13 });
    expect(
      screen
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1);
  });
  it('keeps closed toast text out of the accessibility tree', () => {
    const { rerender } = render(localized(<PublishToast open={false} onClose={vi.fn()} />));
    expect(screen.getByRole('status').textContent).toBe('');
    rerender(localized(<PublishToast open onClose={vi.fn()} />));
    expect(screen.getByRole('status').textContent).toContain(en.Teacher.publish.toast.title);
  });
});
