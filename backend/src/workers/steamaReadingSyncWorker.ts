import type { MeterArchiveSyncCounts } from '../types/meterArchive.js';

interface ArchiveSyncService {
  synchronizeArchive: () => Promise<MeterArchiveSyncCounts>;
}

interface WorkerLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

export interface SteamaReadingSyncWorkerOptions {
  enabled: boolean;
  intervalMs: number;
  maxIntervalMs: number;
  service: ArchiveSyncService;
  logger: WorkerLogger;
}

export class SteamaReadingSyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private cycleInProgress = false;
  private consecutiveFailures = 0;

  constructor(private readonly options: SteamaReadingSyncWorkerOptions) {}

  start(): void {
    if (!this.options.enabled) {
      this.options.logger.info({ enabled: false }, 'SteamaCo reading archive sync is disabled.');
      return;
    }
    if (this.running) return;
    this.running = true;
    this.options.logger.info(
      { intervalMs: this.options.intervalMs, maxIntervalMs: this.options.maxIntervalMs },
      'SteamaCo reading archive sync started.'
    );
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.options.logger.info({}, 'SteamaCo reading archive sync stopped.');
  }

  isRunning(): boolean {
    return this.running;
  }

  private schedule(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.cycleInProgress) return;
    this.cycleInProgress = true;
    let nextDelay = this.options.intervalMs;
    try {
      const counts = await this.options.service.synchronizeArchive();
      this.consecutiveFailures = 0;
      this.options.logger.info({ ...counts, nextRunInMs: nextDelay }, 'SteamaCo reading archive sync completed.');
    } catch (error) {
      this.consecutiveFailures += 1;
      nextDelay = Math.min(
        this.options.maxIntervalMs,
        this.options.intervalMs * Math.pow(2, this.consecutiveFailures)
      );
      const details = {
        consecutiveFailures: this.consecutiveFailures,
        nextRunInMs: nextDelay,
        errorCode: error instanceof Error ? error.message.split(':')[0] : 'unknown_error'
      };
      if (nextDelay >= this.options.maxIntervalMs) {
        this.options.logger.error(details, 'SteamaCo reading archive sync is at maximum backoff.');
      } else {
        this.options.logger.warn(details, 'SteamaCo reading archive sync failed; a retry is scheduled.');
      }
    } finally {
      this.cycleInProgress = false;
      this.schedule(nextDelay);
    }
  }
}
