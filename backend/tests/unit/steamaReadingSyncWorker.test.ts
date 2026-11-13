import { afterEach, describe, expect, it, vi } from 'vitest';

import { SteamaReadingSyncWorker } from '../../src/workers/steamaReadingSyncWorker.js';

describe('SteamaReadingSyncWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts an immediate archive cycle and repeats on the configured interval', async () => {
    vi.useFakeTimers();
    const synchronizeArchive = vi.fn().mockResolvedValue({
      readingsObserved: 4,
      readingsStored: 4,
      statusesObserved: 2,
      statusesStored: 2
    });
    const worker = new SteamaReadingSyncWorker({
      enabled: true,
      intervalMs: 1_000,
      maxIntervalMs: 8_000,
      service: { synchronizeArchive },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(synchronizeArchive).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(synchronizeArchive).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  it('backs off after a provider failure and retries', async () => {
    vi.useFakeTimers();
    const synchronizeArchive = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider_timeout'))
      .mockResolvedValueOnce({ readingsObserved: 0, readingsStored: 0, statusesObserved: 0, statusesStored: 0 });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new SteamaReadingSyncWorker({
      enabled: true,
      intervalMs: 1_000,
      maxIntervalMs: 8_000,
      service: { synchronizeArchive },
      logger
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(synchronizeArchive).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(synchronizeArchive).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
    worker.stop();
  });
});
