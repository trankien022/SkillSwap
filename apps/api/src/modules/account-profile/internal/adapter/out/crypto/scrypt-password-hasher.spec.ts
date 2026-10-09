import { ScryptPasswordHasher } from './scrypt-password-hasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hasher.hash('secret-password');
    expect(hash.algorithm).toBe('scrypt');
    expect(hash.hash).not.toContain('secret-password');
    await expect(hasher.verify('secret-password', hash)).resolves.toBe(true);
    await expect(hasher.verify('wrong-password', hash)).resolves.toBe(false);
  });

  it('salts each hash so equal passwords differ', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
