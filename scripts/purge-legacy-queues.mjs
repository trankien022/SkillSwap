#!/usr/bin/env node
/**
 * Delete the legacy per-event-type consumer queues from a CloudAMQP instance.
 *
 * Why this exists: before ADR-013 Amendment B the consumer declared one queue (plus `.retry`
 * and `.dlq`) per registered handler — 117 durable queues across five modules. The free shared
 * plan refuses anything over 100, so declarations started failing. The code now declares 15
 * module queues, but **code changes do not remove queues that already exist**, so the old ones
 * have to be purged once or the limit stays exhausted.
 *
 * Safety:
 *   - Dry run is the default. `--apply` is required to delete anything.
 *   - Only queues named `<module>.<something>` or `<module>.<something>.retry|.dlq` are touched,
 *     where `<module>` is one of the five consumer modules. The module queues themselves
 *     (`wallet-ledger`, `wallet-ledger.retry`, `wallet-ledger.dlq`) are never deleted.
 *   - A queue holding messages is reported and skipped unless `--force-drain` is given, because
 *     a message in a queue is work that was never done.
 *
 * Usage:
 *   node scripts/purge-legacy-queues.mjs                 # dry run against RABBITMQ_URL
 *   node scripts/purge-legacy-queues.mjs --apply         # delete, skipping non-empty queues
 *   node scripts/purge-legacy-queues.mjs --apply --force-drain
 *
 * Credentials come from RABBITMQ_URL in `.env` (the same variable the API reads). The management
 * API is reached on the same host over HTTPS, which is where CloudAMQP serves it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_QUEUES = [
  'account-profile',
  'admin-operation',
  'live-class',
  'schedule',
  'skill-verification',
  'student-verification',
  'wallet-ledger',
];

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function readRabbitUrl() {
  if (process.env.RABBITMQ_URL) {
    return process.env.RABBITMQ_URL;
  }
  const env = readFileSync(join(root, '.env'), 'utf8');
  const match = env.match(/^\s*RABBITMQ_URL\s*=\s*(.+)$/m);
  if (!match) {
    throw new Error('RABBITMQ_URL not set and not found in .env');
  }
  return match[1].trim().replace(/^["']|["']$/g, '');
}

/** True for the module queues introduced by ADR-013 Amendment B — never deleted. */
function isModuleQueue(name) {
  return MODULE_QUEUES.some(
    (module) => name === module || name === `${module}.retry` || name === `${module}.dlq`,
  );
}

/** True for a legacy queue: a module name, a dot, and a per-event suffix. */
function isLegacyQueue(name) {
  if (isModuleQueue(name)) {
    return false;
  }
  return MODULE_QUEUES.some(
    (module) =>
      name.startsWith(`${module}.`) ||
      name.startsWith(`${module}-`),
  );
}

function managementClient(rabbitUrl) {
  const parsed = new URL(
    rabbitUrl.replace(/^amqps:/, 'https:').replace(/^amqp:/, 'http:'),
  );
  const base = `${parsed.protocol}//${parsed.hostname}`;
  const vhost = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || '/';
  const auth = Buffer.from(
    `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`,
  ).toString('base64');

  async function request(path, init = {}) {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Basic ${auth}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
    }
    return res;
  }

  return {
    async listQueues() {
      const res = await request('/api/queues');
      const queues = await res.json();
      return queues.map((queue) => ({
        name: queue.name,
        messages: Number(queue.messages ?? 0),
      }));
    },
    async deleteQueue(name) {
      const encoded = encodeURIComponent(vhost);
      const queue = encodeURIComponent(name);
      await request(`/api/queues/${encoded}/${queue}`, { method: 'DELETE' });
    },
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const forceDrain = process.argv.includes('--force-drain');

  const client = managementClient(readRabbitUrl());
  const queues = await client.listQueues();
  const legacy = queues.filter((queue) => isLegacyQueue(queue.name));
  const moduleQueues = queues.filter((queue) => isModuleQueue(queue.name));

  console.log(`total queues:  ${queues.length}`);
  console.log(`module queues: ${moduleQueues.length} (kept)`);
  console.log(`legacy queues: ${legacy.length}`);
  console.log('');

  if (legacy.length === 0) {
    console.log('nothing to do — no legacy queues found.');
    return;
  }

  const withMessages = legacy.filter((queue) => queue.messages > 0);
  if (withMessages.length > 0) {
    console.log(`${withMessages.length} legacy queue(s) hold messages:`);
    for (const queue of withMessages) {
      console.log(`  ${queue.name} — ${queue.messages} message(s)`);
    }
    console.log('These are work that was never done. Inspect them before deleting.');
    console.log('');
  }

  if (!apply) {
    console.log('dry run — would delete:');
    for (const queue of legacy) {
      console.log(`  ${queue.name}`);
    }
    console.log('');
    console.log('re-run with --apply to delete them.');
    return;
  }

  let deleted = 0;
  let skipped = 0;
  for (const queue of legacy) {
    if (queue.messages > 0 && !forceDrain) {
      console.log(`  skipped ${queue.name} (holds ${queue.messages} message(s))`);
      skipped += 1;
      continue;
    }
    await client.deleteQueue(queue.name);
    deleted += 1;
    console.log(`  deleted ${queue.name}`);
  }

  console.log('');
  console.log(`deleted ${deleted}, skipped ${skipped}.`);
  if (skipped > 0) {
    console.log('re-run with --force-drain to delete the skipped queues anyway.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
