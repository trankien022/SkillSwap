#!/usr/bin/env node
/**
 * Generate RSA keypairs used only for local development.
 * Output: .secrets/jwt-private.pem, .secrets/jwt-public.pem (access tokens, ADR-016)
 *         .secrets/jaas-private.pem (JaaS room tokens, ADR-039)
 *
 * The JaaS key is a **placeholder**: JaaS only accepts tokens signed by the private key
 * belonging to an API key created in its console, so a locally generated one lets the API
 * boot and every offline test pass, but a real call needs the downloaded PEM to replace it.
 * Generating it anyway is deliberate — refusing to boot without a JaaS account would make
 * `pnpm dev` require an account just to open the app.
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

const jaasPath = join(secretsDir, 'jaas-private.pem');
writeFileSync(jaasPath, privateKey, { mode: 0o600 });

console.log(`Wrote ${privatePath}`);
console.log(`Wrote ${publicPath}`);
console.log(`Wrote ${jaasPath} (placeholder — replace with the 8x8 API key PEM)`);
