import { describe, expect, it } from 'vitest';
import CheckoutRedirectPage from './page';

/**
 * The bare `/classes/checkout` has no class to check out (the checkout is
 * always `/classes/:id/checkout`). It used to bounce to a hardcoded demo slug —
 * a class the learner never chose and one that need not exist — so it now
 * lands on the catalogue.
 */
describe('/classes/checkout (bare)', () => {
  it('redirects to the catalogue, not to a hardcoded demo class', async () => {
    const thrown = await CheckoutRedirectPage({
      params: Promise.resolve({ locale: 'vi' }),
    }).catch((error: unknown) => error);

    const digest = (thrown as { digest?: string }).digest ?? '';
    const target = digest.split(';')[2] ?? '';
    expect(target).toBe('/vi/classes');
    expect(digest).not.toContain('ielts-speaking-mock');
  });
});
