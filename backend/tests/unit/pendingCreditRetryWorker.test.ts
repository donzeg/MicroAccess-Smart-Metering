import { afterEach, describe, expect, it, vi } from 'vitest';

import { PendingCreditRetryWorker } from '../../src/workers/pendingCreditRetryWorker.js';

describe('PendingCreditRetryWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs retry cycles on schedule when enabled', async () => {
    vi.useFakeTimers();

    const retryPendingCredits = vi.fn().mockResolvedValue({ attempted: 1, credited: 1, failed: 0 });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const worker = new PendingCreditRetryWorker({
      enabled: true,
      intervalMs: 1000,
      batchLimit: 10,
      maxConsecutiveFailures: 3,
      backoffMultiplier: 2,
      maxIntervalMs: 8000,
      purchaseService: { retryPendingCredits },
      logger
    });

    worker.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(retryPendingCredits).toHaveBeenCalledTimes(1);

    worker.stop();
  });

  it('applies backoff when retry cycle fails', async () => {
    vi.useFakeTimers();

    const retryPendingCredits = vi
      .fn()
      .mockRejectedValueOnce(new Error('first_failure'))
      .mockResolvedValueOnce({ attempted: 0, credited: 0, failed: 0 });

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const worker = new PendingCreditRetryWorker({
      enabled: true,
      intervalMs: 1000,
      batchLimit: 10,
      maxConsecutiveFailures: 2,
      backoffMultiplier: 2,
      maxIntervalMs: 8000,
      purchaseService: { retryPendingCredits },
      logger
    });

    worker.start();

    await vi.advanceTimersByTimeAsync(1000);
    expect(retryPendingCredits).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(retryPendingCredits).toHaveBeenCalledTimes(2);

    expect(logger.warn).toHaveBeenCalled();

    worker.stop();
  });
});
