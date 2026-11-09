import en from '@/i18n/en.json';
import vi from '@/i18n/vi.json';
import { parseStartsAt, startsAtMessageKey } from './teaching-form';

describe('startsAtMessageKey', () => {
  it.each([
    ['en', en.Teaching],
    ['vi', vi.Teaching],
  ])('has a %s message for every start-time error', (_locale, teaching) => {
    for (const key of Object.values(startsAtMessageKey)) {
      const message = (teaching as Record<string, unknown>)[key.replace('Teaching.', '')];
      expect(message).toEqual(expect.any(String));
    }
  });
});

describe('parseStartsAt', () => {
  const now = Date.parse('2026-11-09T10:00:00.000Z');

  it.each([
    ['UTC with milliseconds', '2026-11-11T10:00:00.000Z'],
    ['UTC without milliseconds', '2026-11-11T10:00:00Z'],
    ['with an explicit offset', '2026-11-11T17:00:00+07:00'],
    ['the default shape the form pre-fills', new Date(now + 48 * 3600000).toISOString()],
  ])('accepts a valid future date (%s) and returns it unchanged', (_label, input) => {
    expect(parseStartsAt(input, now)).toEqual({ ok: true, value: input });
  });

  it('trims surrounding whitespace before returning the value', () => {
    expect(parseStartsAt('  2026-11-11T10:00:00Z  ', now)).toEqual({ ok: true, value: '2026-11-11T10:00:00Z' });
  });

  it.each(['', '   '])('rejects an empty date (%j)', (input) => {
    expect(parseStartsAt(input, now)).toEqual({ ok: false, error: 'empty' });
  });

  it.each([
    ['not a date', 'tomorrow evening'],
    ['date only', '2026-11-11'],
    ['no timezone', '2026-11-11T10:00:00'],
    ['impossible month', '2026-13-11T10:00:00Z'],
    ['impossible day', '2026-02-31T10:00:00Z'],
  ])('rejects an invalid date (%s)', (_label, input) => {
    expect(parseStartsAt(input, now)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a date in the past and one exactly at the current moment', () => {
    expect(parseStartsAt('2026-11-09T09:59:59Z', now)).toEqual({ ok: false, error: 'past' });
    expect(parseStartsAt('2026-11-09T10:00:00Z', now)).toEqual({ ok: false, error: 'past' });
  });

  it('judges the instant, not the offset text', () => {
    // 10:30+07:00 is 03:30Z, before `now`; 20:00+07:00 is 13:00Z, after it.
    expect(parseStartsAt('2026-11-09T10:30:00+07:00', now)).toEqual({ ok: false, error: 'past' });
    expect(parseStartsAt('2026-11-09T20:00:00+07:00', now)).toEqual({ ok: true, value: '2026-11-09T20:00:00+07:00' });
  });
});
