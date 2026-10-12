import { NextIntlClientProvider } from 'next-intl';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../../messages/en.json';
import viMessages from '../../messages/vi.json';

const replaceMock = vi.fn();
let currentPath = '/classes';

vi.mock('../../i18n/routing', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => currentPath,
}));

// Import after the mock is registered.
const { LocaleSwitcher } = await import('./LocaleSwitcher');

afterEach(() => {
  cleanup();
  replaceMock.mockClear();
  currentPath = '/classes';
});

function renderSwitcher(locale: 'vi' | 'en' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'vi' ? viMessages : enMessages}
    >
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

/**
 * The provider's locale decides the labels inside the rendered buttons, so
 * we resolve button names from the same messages tree the provider uses.
 * This keeps the test honest about which locale the user actually sees.
 */
function label(locale: 'vi' | 'en') {
  return locale === 'vi'
    ? viMessages.Landing.footer
    : enMessages.Landing.footer;
}

describe('LocaleSwitcher', () => {
  it('marks English as active for the English locale', () => {
    renderSwitcher('en');

    const messages = label('en');
    const enButton = screen.getByRole('button', { name: messages.en });
    const viButton = screen.getByRole('button', { name: messages.vi });

    expect(enButton.getAttribute('aria-pressed')).toBe('true');
    expect(viButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks Vietnamese as active for the Vietnamese locale', () => {
    renderSwitcher('vi');

    const messages = label('vi');
    const enButton = screen.getByRole('button', { name: messages.en });
    const viButton = screen.getByRole('button', { name: messages.vi });

    expect(viButton.getAttribute('aria-pressed')).toBe('true');
    expect(enButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls router.replace with the other locale while keeping the path', () => {
    currentPath = '/classes/abc';
    renderSwitcher('en');

    const messages = label('en');
    fireEvent.click(screen.getByRole('button', { name: messages.vi }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const [path, opts] = replaceMock.mock.calls[0] ?? [];
    expect(path).toBe('/classes/abc');
    expect(opts).toEqual({ locale: 'vi' });
  });

  it('does not call router.replace when the active locale is clicked again', () => {
    renderSwitcher('vi');

    const messages = label('vi');
    fireEvent.click(screen.getByRole('button', { name: messages.vi }));

    expect(replaceMock).not.toHaveBeenCalled();
  });
});