#!/usr/bin/env node
import { createHmac } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf('=');
  return separator > 0 ? [arg.slice(0, separator).replace(/^--/, ''), arg.slice(separator + 1)] : [arg.replace(/^--/, ''), ''];
}));
const amountVnd = Number(args.amountVnd);
const status = args.status ?? 'settled';
if (!args.providerRef || !Number.isSafeInteger(amountVnd) || amountVnd < 1 || !['settled', 'failed', 'reversed'].includes(status)) {
  console.error('Usage: node --env-file=.env scripts/mock-topup-callback.mjs --providerRef=REF --amountVnd=100000 [--status=settled|failed|reversed]');
  process.exitCode = 2;
} else {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('PAYMENT_WEBHOOK_SECRET is required in the local environment.');
    process.exitCode = 2;
  } else {
    const baseUrl = (process.env.GATEWAY_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    const body = JSON.stringify({ providerRef: args.providerRef, amountVnd, status });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    try {
      const response = await fetch(`${baseUrl}/api/wallet/top-ups/callback`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': signature }, body,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        console.error(`Mock callback failed with HTTP ${response.status}.`);
        if (result && typeof result.message === 'string') console.error(result.message);
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify(result));
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Could not reach Gateway.');
      process.exitCode = 1;
    }
  }
}
