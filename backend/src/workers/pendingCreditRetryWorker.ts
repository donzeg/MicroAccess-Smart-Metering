import { randomUUID } from 'node:crypto';

import type { RetryPendingResult } from '../services/purchaseService.js';

interface RetryService {
  retryPendingCredits: (limit: number, correlationId: string) => Promise<RetryPendingResult>;
}

interface WorkerLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

export interface PendingCreditRetryWorkerOptions {
  enabled: boolean;
  intervalMs: number;
  batchLimit: number;
  maxConsecutiveFailures: number;
  backoffMultiplier: number;
  maxIntervalMs: number;
  purchaseService: RetryService;
  logger: WorkerLogger;
}

export class PendingCreditRetryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private currentDelayMs: number;

  constructor(private readonly options: PendingCreditRetryWorkerOptions) {
    this.currentDelayMs = options.intervalMs;
  }

  start(): void {
    if (!this.options.enabled) {
      this.options.logger.info({ enabled: false }, 'Pending credit retry worker is disabled.');
      return;
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.consecutiveFailures = 0;
    this.currentDelayMs = this.options.intervalMs;

    this.options.logger.info(
      {
        intervalMs: this.options.intervalMs,
        batchLimit: this.options.batchLimit,
        maxConsecutiveFailures: this.options.maxConsecutiveFailures,
        backoffMultiplier: this.options.backoffMultiplier,
        maxIntervalMs: this.options.maxIntervalMs
      },
      'Pending credit retry worker started.'
    );

    this.schedule(this.currentDelayMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.options.logger.info({}, 'Pending credit retry worker stopped.');
  }

  isRunning(): boolean {
    return this.running;
  }

  private schedule(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    const correlationId = `retry-worker-${randomUUID()}`;

    try {
      const result = await this.options.purchaseService.retryPendingCredits(this.options.batchLimit, correlationId);

      this.consecutiveFailures = 0;
      this.currentDelayMs = this.options.intervalMs;

      this.options.logger.info(
        {
          correlationId,
          attempted: result.attempted,
          credited: result.credited,
          failed: result.failed,
          nextRunInMs: this.currentDelayMs
        },
        'Pending credit retry cycle completed.'
      );
    } catch (error) {
      this.consecutiveFailures += 1;

      const computedDelay = Math.round(
        this.options.intervalMs * Math.pow(this.options.backoffMultiplier, this.consecutiveFailures)
      );
      this.currentDelayMs = Math.min(this.options.maxIntervalMs, computedDelay);

      const payload = {
        correlationId,
        consecutiveFailures: this.consecutiveFailures,
        maxConsecutiveFailures: this.options.maxConsecutiveFailures,
        nextRunInMs: this.currentDelayMs,
        error: error instanceof Error ? error.message : 'unknown_error'
      };

      if (this.consecutiveFailures >= this.options.maxConsecutiveFailures) {
        this.options.logger.error(payload, 'Retry worker reached failure threshold and switched to max backoff cadence.');
      } else {
        this.options.logger.warn(payload, 'Pending credit retry cycle failed; applying backoff.');
      }
    }

    this.schedule(this.currentDelayMs);
  }
}
