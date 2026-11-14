import type { ArchivedRegisterReading, ArchivedUsageInterval } from '../types/meterArchive.js';

const HOUR_MS = 3_600_000;
const EPSILON_KWH = 0.005;

export interface MeterRegisterBaseline {
  providerId?: string;
  meterNumber?: string;
  readingKwh: number;
  effectiveAt: string;
}

export interface ReconciledUsageInterval extends ArchivedUsageInterval {
  recordedUsageKwh: number;
  registerRecoveredKwh: number;
}

export interface RegisterRecoveryEvent {
  timestamp: string;
  intervalStart: string;
  registerDeltaKwh: number;
  recordedUsageKwh: number;
  recoveredKwh: number;
}

export interface RegisterUsageRecovery {
  intervals: ReconciledUsageInterval[];
  recordedUsageKwh: number;
  registerRecoveredKwh: number;
  recoveryEvents: RegisterRecoveryEvent[];
  ignoredRegisterDrops: number;
  ignoredAnomalousReadings: number;
  intervalExcessEvents: number;
}

interface RegisterAnchor {
  timestamp: string;
  readingKwh: number;
}

const floorHour = (timestampMs: number): number => Math.floor(timestampMs / HOUR_MS) * HOUR_MS;
const roundEnergy = (value: number): number => Number(value.toFixed(2));

/**
 * Reconciles interval usage with the cumulative register without double counting.
 * A higher register is authoritative. Any part of that movement not already
 * represented by interval usage is posted as recovered usage when the higher
 * register arrives. Register regressions are ignored until an explicit reset
 * baseline is configured, preventing a malformed low value from creating a
 * false large increase later.
 */
export const recoverUsageFromRegister = ({
  intervals,
  registerReadings,
  baseline,
  rangeStartMs,
  rangeEndMs
}: {
  intervals: ArchivedUsageInterval[];
  registerReadings: ArchivedRegisterReading[];
  baseline?: MeterRegisterBaseline;
  rangeStartMs: number;
  rangeEndMs: number;
}): RegisterUsageRecovery => {
  const byInterval = new Map<string, ReconciledUsageInterval>();
  for (const interval of intervals) {
    const intervalMs = new Date(interval.intervalStart).getTime();
    if (
      !Number.isFinite(intervalMs) ||
      intervalMs < rangeStartMs ||
      intervalMs >= rangeEndMs ||
      !Number.isFinite(interval.usageKwh) ||
      interval.usageKwh < 0
    ) continue;
    const current = byInterval.get(interval.intervalStart);
    const recordedUsageKwh = roundEnergy((current?.recordedUsageKwh ?? 0) + interval.usageKwh);
    byInterval.set(interval.intervalStart, {
      timestamp: current?.timestamp && current.timestamp > interval.timestamp ? current.timestamp : interval.timestamp,
      intervalStart: interval.intervalStart,
      usageKwh: recordedUsageKwh,
      recordedUsageKwh,
      registerRecoveredKwh: 0
    });
  }

  const candidates = registerReadings
    .map((reading) => ({ ...reading, timestampMs: new Date(reading.timestamp).getTime() }))
    .filter((reading) => Number.isFinite(reading.timestampMs) && reading.timestampMs < rangeEndMs)
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const baselineMs = baseline ? new Date(baseline.effectiveAt).getTime() : Number.NaN;
  if (
    baseline &&
    Number.isFinite(baselineMs) &&
    baselineMs >= rangeStartMs &&
    baselineMs < rangeEndMs &&
    Number.isFinite(baseline.readingKwh) &&
    baseline.readingKwh >= 0
  ) {
    candidates.push({
      timestamp: new Date(baselineMs).toISOString(),
      readingKwh: baseline.readingKwh,
      anomalous: false,
      timestampMs: baselineMs
    });
    candidates.sort((left, right) => left.timestampMs - right.timestampMs);
  }

  let anchor: RegisterAnchor | null = null;
  let ignoredRegisterDrops = 0;
  let ignoredAnomalousReadings = 0;
  let intervalExcessEvents = 0;
  const recoveryEvents: RegisterRecoveryEvent[] = [];

  for (const reading of candidates) {
    if (reading.anomalous || !Number.isFinite(reading.readingKwh) || reading.readingKwh < 0) {
      ignoredAnomalousReadings += 1;
      continue;
    }
    if (!anchor) {
      anchor = { timestamp: reading.timestamp, readingKwh: reading.readingKwh };
      continue;
    }
    if (reading.readingKwh + EPSILON_KWH < anchor.readingKwh) {
      ignoredRegisterDrops += 1;
      continue;
    }
    if (Math.abs(reading.readingKwh - anchor.readingKwh) <= EPSILON_KWH) {
      anchor = { timestamp: reading.timestamp, readingKwh: Math.max(anchor.readingKwh, reading.readingKwh) };
      continue;
    }

    const anchorMs = new Date(anchor.timestamp).getTime();
    const readingMs = reading.timestampMs;
    const segmentStartMs = Math.max(rangeStartMs, floorHour(anchorMs));
    const segmentEndMs = Math.min(rangeEndMs, floorHour(readingMs));
    const recordedUsageKwh = Array.from(byInterval.values())
      .filter((interval) => {
        const intervalMs = new Date(interval.intervalStart).getTime();
        return intervalMs >= segmentStartMs && intervalMs < segmentEndMs;
      })
      .reduce((sum, interval) => sum + interval.recordedUsageKwh, 0);
    const registerDeltaKwh = reading.readingKwh - anchor.readingKwh;
    const recoveredKwh = roundEnergy(Math.max(0, registerDeltaKwh - recordedUsageKwh));
    if (recordedUsageKwh > registerDeltaKwh + EPSILON_KWH) intervalExcessEvents += 1;

    const recoveryIntervalMs = floorHour(readingMs) - HOUR_MS;
    if (recoveredKwh > 0 && recoveryIntervalMs >= rangeStartMs && recoveryIntervalMs < rangeEndMs) {
      const intervalStart = new Date(recoveryIntervalMs).toISOString();
      const current = byInterval.get(intervalStart);
      byInterval.set(intervalStart, {
        timestamp: reading.timestamp,
        intervalStart,
        recordedUsageKwh: current?.recordedUsageKwh ?? 0,
        registerRecoveredKwh: roundEnergy((current?.registerRecoveredKwh ?? 0) + recoveredKwh),
        usageKwh: roundEnergy((current?.usageKwh ?? 0) + recoveredKwh)
      });
      recoveryEvents.push({
        timestamp: reading.timestamp,
        intervalStart,
        registerDeltaKwh: roundEnergy(registerDeltaKwh),
        recordedUsageKwh: roundEnergy(recordedUsageKwh),
        recoveredKwh
      });
    }
    anchor = { timestamp: reading.timestamp, readingKwh: reading.readingKwh };
  }

  const reconciledIntervals = Array.from(byInterval.values()).sort((left, right) =>
    left.intervalStart.localeCompare(right.intervalStart)
  );
  return {
    intervals: reconciledIntervals,
    recordedUsageKwh: roundEnergy(reconciledIntervals.reduce((sum, interval) => sum + interval.recordedUsageKwh, 0)),
    registerRecoveredKwh: roundEnergy(
      reconciledIntervals.reduce((sum, interval) => sum + interval.registerRecoveredKwh, 0)
    ),
    recoveryEvents,
    ignoredRegisterDrops,
    ignoredAnomalousReadings,
    intervalExcessEvents
  };
};
