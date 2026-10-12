/** Retries idempotent device preference updates; never retries business commands. */
export function startPushPreferenceSync(attempt: () => Promise<unknown>): { refresh(): void; stop(): void } {
  let closed = false;
  let running = false;
  let delay = 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (closed || running) return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    running = true;
    try {
      await attempt();
      delay = 1000;
    } catch {
      if (!closed) {
        timer = setTimeout(() => void run(), delay);
        delay = Math.min(delay * 2, 30_000);
      }
    } finally {
      running = false;
    }
  };
  void run();
  return {
    refresh() { delay = 1000; void run(); },
    stop() { closed = true; if (timer) clearTimeout(timer); },
  };
}
