import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const manifestPath = fileURLToPath(new URL('../.secrets/checkpoint-demo.json', import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const base = process.env.CHECKPOINT_GATEWAY_URL || 'http://localhost:4000';
async function request(path, token, body) {
  const response = await fetch(`${base}/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const envelope = await response.json();
  if (!response.ok || envelope.success === false)
    throw new Error(`${path}: ${response.status} ${envelope.message}`);
  return envelope.data ?? envelope;
}
const login = await request('/auth/login', null, {
  email: manifest.accounts.learner.email,
  password: manifest.password,
});
const token = login.accessToken;
if (!token) throw new Error('Login returned no access token');
manifest.bookings ??= {};
for (const name of ['push1', 'push2']) {
  const fixture = manifest.classes.find((item) => item.name === name);
  let page = await request('/classes/bookings/me?limit=50', token);
  let booking = page.items.find((item) => item.classId === fixture.id);
  if (!booking) {
    const result = await request(`/classes/${fixture.id}/bookings`, token, {
      idempotencyKey: `checkpoint-20261013-${name}`,
    });
    booking = result.booking;
  }
  if (booking.state === 'pending') {
    await request(`/classes/bookings/${booking.bookingId}/confirm`, token, {});
    const deadline = Date.now() + 30000;
    do {
      await delay(1000);
      page = await request('/classes/bookings/me?limit=50', token);
      booking = page.items.find((item) => item.classId === fixture.id);
    } while (booking?.state === 'pending' && Date.now() < deadline);
  }
  if (booking?.state !== 'confirmed')
    throw new Error(`${name} is ${booking?.state}; reconcile before retrying`);
  manifest.bookings[name] = booking.bookingId;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`${name}: confirmed booking ${booking.bookingId}`);
}
const balance = await request('/wallet/balance', token);
console.log(
  `Learner wallet: available=${balance.availableCredits}, pending=${balance.pendingCredits}`,
);
