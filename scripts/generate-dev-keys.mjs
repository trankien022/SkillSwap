#!/usr/bin/env node
/**
 * Generate an RSA keypair used only for local development.
 * Output: .secrets/jwt-private.pem and .secrets/jwt-public.pem (git-ignored).
 */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const secretsDir = join(root, '.secrets');
mkdirSync(secretsDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privatePath = join(secretsDir, 'jwt-private.pem');
const publicPath = join(secretsDir, 'jwt-public.pem');
writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey, { mode: 0o644 });

console.log(`Wrote ${privatePath}`);
console.log(`Wrote ${publicPath}`);
