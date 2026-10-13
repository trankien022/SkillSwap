import { startPushPreferenceSync } from './notification-preference-sync';

describe('push preference synchronization', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retries a failed update when connectivity returns without restarting', async () => {
    const attempt = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const sync = startPushPreferenceSync(attempt);
    await jest.advanceTimersByTimeAsync(1000);
    expect(attempt).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(attempt).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('stops retries when the account or language effect is replaced', async () => {
    const attempt = jest.fn().mockRejectedValue(new Error('offline'));
    const sync = startPushPreferenceSync(attempt);
    await jest.advanceTimersByTimeAsync(1000);
    sync.stop();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('refreshes after resume and prevents concurrent attempts', async () => {
    let finish!: () => void;
    const attempt = jest.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(undefined);
    const sync = startPushPreferenceSync(attempt);
    sync.refresh();
    expect(attempt).toHaveBeenCalledTimes(1);
    finish();
    await jest.advanceTimersByTimeAsync(0);
    sync.refresh();
    expect(attempt).toHaveBeenCalledTimes(2);
    sync.stop();
  });
});
