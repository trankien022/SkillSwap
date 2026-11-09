import { localeFromAcceptLanguage } from './accept-language';

/**
 * `Accept-Language` is how an HTTP caller says which language to answer in, so the
 * parser decides which copy an inbox row is rendered from. These tests pin the two
 * mistakes that matter: honouring an unsupported language, and ignoring the caller's
 * ordering.
 */

describe('localeFromAcceptLanguage', () => {
  it('returns undefined when there is no header', () => {
    expect(localeFromAcceptLanguage(undefined)).toBeUndefined();
  });

  it('reads a plain tag', () => {
    expect(localeFromAcceptLanguage('en')).toBe('en');
    expect(localeFromAcceptLanguage('vi')).toBe('vi');
  });

  it('ignores the region and matches on the primary subtag', () => {
    expect(localeFromAcceptLanguage('en-GB,en;q=0.9')).toBe('en');
    expect(localeFromAcceptLanguage('vi-VN')).toBe('vi');
  });

  it('is case insensitive, as the header is defined to be', () => {
    expect(localeFromAcceptLanguage('EN-US')).toBe('en');
  });

  it('picks the highest quality, not the first tag listed', () => {
    // A browser sends the most specific first, but quality is what decides.
    expect(localeFromAcceptLanguage('fr;q=1.0,vi;q=0.9,en;q=0.1')).toBe('vi');
  });

  it('breaks a quality tie by the order the caller wrote', () => {
    expect(localeFromAcceptLanguage('vi,en')).toBe('vi');
    expect(localeFromAcceptLanguage('en,vi')).toBe('en');
  });

  it('skips languages the product does not carry', () => {
    // Falling back deliberately beats answering in French with English copy.
    expect(localeFromAcceptLanguage('fr-FR,de;q=0.8')).toBeUndefined();
    expect(localeFromAcceptLanguage('fr-FR,en;q=0.5')).toBe('en');
  });

  it('honours q=0 as an explicit rejection', () => {
    expect(localeFromAcceptLanguage('vi;q=0,en;q=0.5')).toBe('en');
    expect(localeFromAcceptLanguage('vi;q=0')).toBeUndefined();
  });

  it('ignores a wildcard rather than picking an arbitrary language', () => {
    expect(localeFromAcceptLanguage('*')).toBeUndefined();
    expect(localeFromAcceptLanguage('*;q=0.5,vi;q=0.9')).toBe('vi');
  });

  it('tolerates an empty or malformed header', () => {
    expect(localeFromAcceptLanguage('')).toBeUndefined();
    expect(localeFromAcceptLanguage(',,,')).toBeUndefined();
    expect(localeFromAcceptLanguage('en;q=not-a-number')).toBe('en');
  });
});
