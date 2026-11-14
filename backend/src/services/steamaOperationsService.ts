import { randomUUID } from 'node:crypto';

import type { SteamaReadOnlyRequest } from './steamaReadOnlyClient.js';
import { InMemoryFloorTenancyRepository } from '../repositories/inMemoryFloorTenancyRepository.js';
import type { FloorTenancyRepository } from '../repositories/interfaces.js';
import type { MeterArchiveRepository } from '../repositories/meterArchiveRepository.js';
import {
  recoverUsageFromRegister,
  type MeterRegisterBaseline,
  type ReconciledUsageInterval,
  type RegisterUsageRecovery
} from './registerUsageRecovery.js';
import type {
  MeterArchiveReadingInput,
  MeterArchiveSyncCounts,
  MeterArchiveSyncStatus
} from '../types/meterArchive.js';
import type {
  FloorPositionTenancyTimeline,
  RecordFloorTenancyInput
} from '../types/floorTenancy.js';
import type {
  CountSeriesItem,
  EnergyMixPeriod,
  EnergyMixTargetStatus,
  MeterConnectivity,
  MeterFreshnessBucket,
  MeterOperationalRole,
  SteamaCustomerDetail,
  SteamaCustomerSummary,
  SteamaCustomerTransaction,
  SteamaEnergyMix,
  SteamaEnergyMixBucket,
  SteamaEnergyMixPairComparison,
  SteamaEnergyMixSourceMeter,
  SteamaFloorAnalysis,
  SteamaFloorKey,
  SteamaFloorMappingEvidence,
  SteamaFloorPositionUsage,
  SteamaFloorUsageBucket,
  SteamaFloorUsageSummary,
  SteamaMeterHistory,
  SteamaMeterReadingPoint,
  SteamaMeterSummary,
  SteamaOperationsException,
  SteamaOperationsOverview,
  SteamaRevenueAnalysis,
  SteamaRevenueBucket,
  SteamaSourceTopology
} from '../types/steamaOperations.js';

export interface SteamaReadOnlyRequester {
  request<T>(request: SteamaReadOnlyRequest): Promise<T>;
}

interface PaginatedPayload {
  count?: unknown;
  results?: unknown;
}

interface CachedOverview {
  value: SteamaOperationsOverview;
  expiresAt: number;
}

interface CachedReadingWindow {
  value: SteamaMeterReadingPoint[];
  expiresAt: number;
}

interface CachedEnergyMix {
  value: SteamaEnergyMix;
  expiresAt: number;
}

interface CachedRevenueAnalysis {
  value: SteamaRevenueAnalysis;
  expiresAt: number;
}

interface CachedFloorAnalysis {
  value: SteamaFloorAnalysis;
  expiresAt: number;
}

export interface SteamaOperationsOptions {
  retailTariffNgnPerKwh?: number;
  tariffEffectiveFrom?: string | null;
  gridSourceIncludesGenerator?: boolean;
  floorTenancyRepository?: FloorTenancyRepository;
  meterArchiveRepository?: MeterArchiveRepository;
  meterArchiveSyncEnabled?: boolean;
  meterArchiveInitialBackfillDays?: number;
  meterRegisterBaselines?: MeterRegisterBaseline[];
}

interface DirectiveReading {
  timestamp: string;
  intervalStart: string;
  usageKwh: number;
}

interface AuthoritativeDirectiveReading extends DirectiveReading {
  recordedUsageKwh: number;
  registerRecoveredKwh: number;
}

interface AuthoritativeMeterUsage extends Omit<RegisterUsageRecovery, 'intervals'> {
  readings: AuthoritativeDirectiveReading[];
  recordedIntervalKeys: Set<string>;
}

export interface EnergyMixDateRange {
  from: string;
  to: string;
}

type JsonObject = Record<string, unknown>;

const HOUR_MS = 3_600_000;
const LAGOS_UTC_OFFSET_MS = HOUR_MS;
const SOLAR_TARGET_MINIMUM = 90;
const SOLAR_TARGET_MAXIMUM = 95;
const DIRECTIVE_PAGE_SIZE = 250;
const ENERGY_MIX_CACHE_TTL_MS = 10 * 60_000;

const energyMixTargetStatus = (solarPercent: number | null): EnergyMixTargetStatus => {
  if (solarPercent === null) return 'no_data';
  if (solarPercent < SOLAR_TARGET_MINIMUM) return 'below_target';
  if (solarPercent > SOLAR_TARGET_MAXIMUM) return 'above_target';
  return 'within_target';
};

const buildPairComparison = (
  solarIntervals: Map<string, number>,
  companionIntervals: Map<string, number>,
  configured: boolean,
  rangeStartMs: number,
  rangeEndMs: number
): SteamaEnergyMixPairComparison => {
  if (!configured) {
    return {
      configured: false,
      available: false,
      solarKwh: 0,
      companionKwh: 0,
      totalKwh: 0,
      solarPercent: null,
      companionPercent: null,
      matchedActiveIntervals: 0,
      companionActiveIntervals: 0,
      coveragePercent: 0,
      targetStatus: 'no_data'
    };
  }

  const inRange = (key: string): boolean => {
    const timestamp = new Date(key).getTime();
    return timestamp >= rangeStartMs && timestamp < rangeEndMs;
  };
  const activeKeys = Array.from(companionIntervals.entries())
    .filter(([key, value]) => inRange(key) && value > 0)
    .map(([key]) => key);
  const matchedActiveKeys = activeKeys.filter((key) => solarIntervals.has(key));
  let solarKwh = 0;
  let companionKwh = 0;
  for (const key of matchedActiveKeys) {
    solarKwh += solarIntervals.get(key) ?? 0;
    companionKwh += companionIntervals.get(key) ?? 0;
  }
  solarKwh = roundEnergy(solarKwh);
  companionKwh = roundEnergy(companionKwh);
  const totalKwh = roundEnergy(solarKwh + companionKwh);
  const solarPercent = totalKwh > 0 ? roundPercent((solarKwh / totalKwh) * 100) : null;
  const companionPercent = totalKwh > 0 ? roundPercent((companionKwh / totalKwh) * 100) : null;

  return {
    configured: true,
    available: totalKwh > 0,
    solarKwh,
    companionKwh,
    totalKwh,
    solarPercent,
    companionPercent,
    matchedActiveIntervals: matchedActiveKeys.length,
    companionActiveIntervals: activeKeys.length,
    coveragePercent: activeKeys.length > 0
      ? roundPercent((matchedActiveKeys.length / activeKeys.length) * 100)
      : 0,
    targetStatus: energyMixTargetStatus(solarPercent)
  };
};

const FRESHNESS_LABELS: Record<MeterFreshnessBucket, string> = {
  online: 'Online now',
  under_24_hours: 'Seen within 24 hours',
  one_to_three_days: 'Offline 1–3 days',
  four_to_seven_days: 'Offline 4–7 days',
  eight_to_fourteen_days: 'Offline 8–14 days',
  over_fourteen_days: 'Offline over 14 days',
  never_online: 'Never online',
  unknown: 'Freshness unknown'
};

const ROLE_LABELS: Record<MeterOperationalRole, string> = {
  grid_source: 'Grid source',
  solar_source: 'Solar source',
  generator_source: 'Generator source',
  distribution_or_bulk: 'Distribution / bulk',
  customer_load: 'Customer load',
  unknown: 'Unclassified'
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const firstValue = (record: JsonObject, keys: string[]): unknown => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const stringValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const numberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const booleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'on', 'online', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', 'off', 'offline', '0'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const labelValue = (value: unknown): string => {
  if (isObject(value)) {
    return stringValue(firstValue(value, ['name', 'display_name', 'label', 'reference', 'number', 'id']));
  }
  return stringValue(value);
};

const providerIdValue = (value: unknown): string | null => {
  if (isObject(value)) {
    const id = stringValue(firstValue(value, ['id', 'pk', 'provider_id']));
    return id || null;
  }

  const text = stringValue(value);
  if (!text) {
    return null;
  }
  if (/^https?:\/\//i.test(text) || text.startsWith('/')) {
    const match = text.match(/\/(\d+)\/?$/);
    return match?.[1] ?? null;
  }
  return text;
};

const asCollection = (payload: unknown): { count: number; records: JsonObject[] } => {
  if (Array.isArray(payload)) {
    const records = payload.filter(isObject);
    return { count: records.length, records };
  }

  if (!isObject(payload)) {
    return { count: 0, records: [] };
  }

  const paginated = payload as PaginatedPayload;
  const records = Array.isArray(paginated.results) ? paginated.results.filter(isObject) : [];
  const count = numberValue(paginated.count) ?? records.length;
  return { count, records };
};

const isoDateValue = (value: unknown): string | null => {
  const text = stringValue(value);
  if (!text) {
    return null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const freshnessFromDurationText = (text: string): MeterFreshnessBucket | null => {
  const normalized = text.toLowerCase();
  if (normalized.includes('never')) {
    return 'never_online';
  }
  if (normalized.includes('online') && !normalized.includes('offline')) {
    return 'online';
  }

  const dayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*day/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (days <= 3) return 'one_to_three_days';
    if (days <= 7) return 'four_to_seven_days';
    if (days <= 14) return 'eight_to_fourteen_days';
    return 'over_fourteen_days';
  }

  if (/\b(hour|hours|minute|minutes)\b/.test(normalized)) {
    return 'under_24_hours';
  }
  return null;
};

const classifyFreshness = (
  connectivity: MeterConnectivity,
  lastReadingAt: string | null,
  statusText: string,
  nowMs: number
): MeterFreshnessBucket => {
  if (connectivity === 'online') return 'online';
  if (connectivity === 'never_online') return 'never_online';

  if (lastReadingAt) {
    const hours = Math.max(0, (nowMs - new Date(lastReadingAt).getTime()) / 3_600_000);
    if (hours < 24) return 'under_24_hours';
    if (hours <= 72) return 'one_to_three_days';
    if (hours <= 168) return 'four_to_seven_days';
    if (hours <= 336) return 'eight_to_fourteen_days';
    return 'over_fourteen_days';
  }

  return freshnessFromDurationText(statusText) ?? 'unknown';
};

const classifyConnectivity = (record: JsonObject, statusText: string): MeterConnectivity => {
  const explicit = booleanValue(
    firstValue(record, ['is_online', 'online', 'communication_is_online', 'communications_online', 'currently_online'])
  );
  if (explicit === true) return 'online';

  const normalized = statusText.toLowerCase();
  if (normalized.includes('never')) return 'never_online';
  if (normalized.includes('online') && !normalized.includes('offline')) return 'online';
  if (explicit === false || normalized.includes('offline')) return 'offline';
  return 'unknown';
};

const classifyRole = (
  record: JsonObject,
  assigned: boolean,
  model: string
): Pick<SteamaMeterSummary, 'operationalRole' | 'roleEvidence'> => {
  const searchable = [
    stringValue(firstValue(record, ['name', 'reference', 'description', 'label'])),
    stringValue(firstValue(record, ['customer_name', 'assigned_customer_name'])),
    labelValue(firstValue(record, ['tags', 'meter_role', 'role']))
  ]
    .join(' ')
    .toLowerCase();

  if (searchable.includes('solar')) return { operationalRole: 'solar_source', roleEvidence: 'provider_label' };
  if (searchable.includes('grid')) return { operationalRole: 'grid_source', roleEvidence: 'provider_label' };
  if (searchable.includes('generator') || searchable.includes('genset')) {
    return { operationalRole: 'generator_source', roleEvidence: 'provider_label' };
  }
  if (searchable.includes('bulk') || searchable.includes('distribution')) {
    return { operationalRole: 'distribution_or_bulk', roleEvidence: 'provider_label' };
  }
  if (model.toUpperCase() === 'DS3100') {
    return { operationalRole: 'distribution_or_bulk', roleEvidence: 'model_rule' };
  }
  if (assigned) return { operationalRole: 'customer_load', roleEvidence: 'assignment' };
  return { operationalRole: 'unknown', roleEvidence: 'unclassified' };
};

const normalizeMeter = (record: JsonObject, nowMs: number): SteamaMeterSummary => {
  const providerId = stringValue(firstValue(record, ['id', 'pk', 'provider_id']));
  const meterNumber = stringValue(firstValue(record, ['reference', 'meter_number', 'number', 'serial_number', 'name']));
  const name = stringValue(firstValue(record, ['name', 'display_name', 'label'])) || meterNumber || `Meter ${providerId}`;
  const model = labelValue(firstValue(record, ['meter_type_name', 'model', 'meter_model', 'meter_type', 'type']));
  const customerRaw = firstValue(record, ['customer', 'assigned_customer', 'customer_id', 'customer_url']);
  const customerId = providerIdValue(customerRaw);
  const customerName =
    labelValue(firstValue(record, ['customer_name', 'assigned_customer_name'])) ||
    (isObject(customerRaw) ? labelValue(customerRaw) : '') ||
    null;
  const assigned = Boolean(customerId || customerName);
  const statusText = stringValue(
    firstValue(record, [
      'offline_duration_status',
      'offline_duration',
      'online_status',
      'communication_status',
      'connection_status',
      'status'
    ])
  );
  const connectivity = classifyConnectivity(record, statusText);
  const lastReadingAt = isoDateValue(
    firstValue(record, [
      'latest_meter_reading_timestamp',
      'last_meter_reading_timestamp',
      'latest_reading_timestamp',
      'last_reading_at',
      'last_seen_at'
    ])
  );
  const role = classifyRole(record, assigned, model);

  return {
    providerId,
    meterNumber,
    name,
    model: model || 'Not provided',
    manufacturer: labelValue(firstValue(record, ['manufacturer', 'manufacturer_name', 'oem'])) || 'Not provided',
    siteName: labelValue(firstValue(record, ['site_name', 'site'])) || 'Not provided',
    customerId,
    customerName,
    assigned,
    ...role,
    connectivity,
    connectivityLabel:
      statusText ||
      (connectivity === 'online'
        ? 'Online'
        : connectivity === 'never_online'
          ? 'Never online'
          : connectivity === 'offline'
            ? 'Offline'
            : 'Unknown'),
    freshnessBucket: classifyFreshness(connectivity, lastReadingAt, statusText, nowMs),
    lastReadingAt,
    latestReadingKwh: numberValue(
      firstValue(record, ['latest_meter_reading', 'last_meter_reading', 'latest_reading', 'meter_reading'])
    ),
    relayOn: booleanValue(firstValue(record, ['connection_is_on', 'relay_is_on', 'relay_on'])),
    communicationMethod:
      labelValue(
        firstValue(record, [
          'communication_method_name',
          'communication_method',
          'communications_method',
          'comms_type'
        ])
      ) || 'Not provided',
    signalStrength: numberValue(firstValue(record, ['latest_signal_rssi', 'signal_strength', 'signal', 'gsm_signal'])),
    simProvider:
      labelValue(
        firstValue(record, ['sim_card_network_provider_name', 'sim_card_provider', 'sim_provider'])
      ) || 'Not provided',
    simIccid: stringValue(firstValue(record, ['sim_card_iccid', 'sim_iccid', 'iccid'])),
    phase: stringValue(firstValue(record, ['phase', 'meter_phase'])) || 'Not provided',
    criticalError: booleanValue(
      firstValue(record, ['critical_error_reported', 'critical_error', 'has_critical_error'])
    ),
    lidTamper: booleanValue(
      firstValue(record, ['lid_tamper_detection_reported', 'lid_tamper', 'tamper_detected', 'is_tampered'])
    )
  };
};

const normalizeCustomer = (
  record: JsonObject,
  meterNumbersByCustomer: ReadonlyMap<string, string[]>
): SteamaCustomerSummary => {
  const firstName = stringValue(firstValue(record, ['first_name', 'firstname']));
  const lastName = stringValue(firstValue(record, ['last_name', 'lastname']));
  const providerId = stringValue(firstValue(record, ['id', 'pk', 'provider_id']));
  const displayName =
    stringValue(firstValue(record, ['name', 'display_name', 'full_name'])) ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    `Customer ${providerId}`;

  const meterRaw = firstValue(record, ['meter', 'assigned_meter', 'meter_number', 'meter_reference']);
  const observedMeterNumbers = meterNumbersByCustomer.get(providerId) ?? [];
  return {
    providerId,
    firstName,
    lastName,
    displayName,
    accountNumber: stringValue(firstValue(record, ['account_number', 'index_number', 'integration_id'])),
    siteName: labelValue(firstValue(record, ['site_name', 'site'])) || 'Not provided',
    assignedMeterNumber: observedMeterNumbers.join(', ') || labelValue(meterRaw) || null,
    accountBalance: numberValue(firstValue(record, ['account_balance', 'balance'])),
    energyBalanceKwh: numberValue(firstValue(record, ['energy_balance', 'energy_balance_kwh'])),
    energyPrice: numberValue(firstValue(record, ['energy_price', 'unit_price'])),
    tariffBand: stringValue(firstValue(record, ['service_based_tariff', 'tariff_band'])) || 'Not configured',
    controlType: stringValue(firstValue(record, ['control_type'])) || 'Not provided'
  };
};

const canonicalMeterNumber = (value: string): string => value.replace(/\s+/g, '').toLowerCase();

const assignedMeterNumbers = (customer: SteamaCustomerSummary): string[] =>
  (customer.assignedMeterNumber ?? '')
    .split(/[,;|]+/)
    .map((value) => value.trim())
    .filter(Boolean);

/**
 * SteamaCo does not always expose an assignment in both directions. A customer
 * record can identify its meter while the corresponding meter record omits its
 * customer. Reconcile those two read-only views without overriding an explicit
 * assignment returned on the meter itself.
 */
const reconcileMeterAssignments = (
  meters: SteamaMeterSummary[],
  customers: SteamaCustomerSummary[]
): SteamaMeterSummary[] => {
  const customerByMeterNumber = new Map<string, SteamaCustomerSummary | null>();

  for (const customer of customers) {
    for (const meterNumber of assignedMeterNumbers(customer)) {
      const key = canonicalMeterNumber(meterNumber);
      if (!key) continue;

      const current = customerByMeterNumber.get(key);
      customerByMeterNumber.set(key, current && current.providerId !== customer.providerId ? null : customer);
    }
  }

  return meters.map((meter) => {
    if (meter.assigned) return meter;

    const customer = customerByMeterNumber.get(canonicalMeterNumber(meter.meterNumber));
    if (!customer) return meter;

    return {
      ...meter,
      customerId: customer.providerId,
      customerName: customer.displayName,
      assigned: true,
      operationalRole: meter.operationalRole === 'unknown' ? 'customer_load' : meter.operationalRole,
      roleEvidence: meter.operationalRole === 'unknown' ? 'assignment' : meter.roleEvidence
    };
  });
};

const normalizeReading = (record: JsonObject): SteamaMeterReadingPoint | null => {
  const timestamp = isoDateValue(firstValue(record, ['timestamp', 'recorded_at', 'datetime']));
  if (!timestamp) return null;

  const meterRaw = firstValue(record, ['meter', 'meter_id', 'meter_url']);
  const customerRaw = firstValue(record, ['customer', 'customer_id', 'customer_url']);
  return {
    timestamp,
    readingKwh: numberValue(firstValue(record, ['reading', 'meter_reading'])),
    usageKwh: numberValue(firstValue(record, ['usage_amount', 'usage'])),
    anomalous: booleanValue(firstValue(record, ['is_anomalous', 'anomalous'])) === true,
    meterId: providerIdValue(meterRaw) ?? '',
    meterNumber: stringValue(firstValue(record, ['meter_reference', 'meter_number'])),
    customerId: providerIdValue(customerRaw),
    customerName: stringValue(firstValue(record, ['customer_name'])) || null
  };
};

const enrichMetersWithLatestReadings = (
  meters: SteamaMeterSummary[],
  readings: SteamaMeterReadingPoint[]
): SteamaMeterSummary[] => {
  const latestByProviderId = new Map<string, SteamaMeterReadingPoint>();
  const latestByMeterNumber = new Map<string, SteamaMeterReadingPoint>();

  const retainLatest = (
    map: Map<string, SteamaMeterReadingPoint>,
    key: string,
    reading: SteamaMeterReadingPoint
  ): void => {
    if (!key || reading.readingKwh === null) return;
    const current = map.get(key);
    if (!current || reading.timestamp > current.timestamp) map.set(key, reading);
  };

  for (const reading of readings) {
    retainLatest(latestByProviderId, reading.meterId, reading);
    retainLatest(latestByMeterNumber, canonicalMeterNumber(reading.meterNumber), reading);
  }

  return meters.map((meter) => {
    if (meter.latestReadingKwh !== null) return meter;
    const reading =
      latestByProviderId.get(meter.providerId) ??
      latestByMeterNumber.get(canonicalMeterNumber(meter.meterNumber));
    return reading?.readingKwh === null || reading?.readingKwh === undefined
      ? meter
      : { ...meter, latestReadingKwh: reading.readingKwh };
  });
};

const parseDirectiveData = (value: unknown): JsonObject => {
  if (isObject(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const floorHour = (timestampMs: number): number => Math.floor(timestampMs / HOUR_MS) * HOUR_MS;

const startOfEnergyBucket = (timestampMs: number, period: EnergyMixPeriod): number => {
  if (period === 'hourly') return floorHour(timestampMs);

  const local = new Date(timestampMs + LAGOS_UTC_OFFSET_MS);
  if (period === 'daily') {
    return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LAGOS_UTC_OFFSET_MS;
  }
  if (period === 'weekly') {
    const day = local.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - LAGOS_UTC_OFFSET_MS;
  }
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - LAGOS_UTC_OFFSET_MS;
};

const nextEnergyBucket = (bucketStartMs: number, period: EnergyMixPeriod): number => {
  if (period === 'hourly') return bucketStartMs + HOUR_MS;
  const local = new Date(bucketStartMs + LAGOS_UTC_OFFSET_MS);
  if (period === 'daily') local.setUTCDate(local.getUTCDate() + 1);
  if (period === 'weekly') local.setUTCDate(local.getUTCDate() + 7);
  if (period === 'monthly') local.setUTCMonth(local.getUTCMonth() + 1);
  return local.getTime() - LAGOS_UTC_OFFSET_MS;
};

const energyMixRangeStart = (rangeEndMs: number, period: EnergyMixPeriod): number => {
  if (period === 'hourly') return rangeEndMs - 24 * HOUR_MS;

  const currentBucketStart = startOfEnergyBucket(rangeEndMs - 1, period);
  if (period === 'daily') return currentBucketStart - 29 * 24 * HOUR_MS;
  if (period === 'weekly') return currentBucketStart - 11 * 7 * 24 * HOUR_MS;

  const local = new Date(currentBucketStart + LAGOS_UTC_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 11, 1) - LAGOS_UTC_OFFSET_MS;
};

const lagosDateStart = (value: string): number => new Date(`${value}T00:00:00+01:00`).getTime();

const resolveEnergyMixRange = (
  nowMs: number,
  period: EnergyMixPeriod,
  customRange?: EnergyMixDateRange
): { start: number; end: number } => {
  const currentHourEnd = floorHour(nowMs);
  if (!customRange) {
    return { start: energyMixRangeStart(currentHourEnd, period), end: currentHourEnd };
  }

  const requestedStart = lagosDateStart(customRange.from);
  const requestedEnd = lagosDateStart(customRange.to) + 24 * HOUR_MS;
  return { start: requestedStart, end: Math.min(requestedEnd, currentHourEnd) };
};

const roundEnergy = (value: number): number => Number(value.toFixed(2));
const roundPercent = (value: number): number => Number(value.toFixed(1));
const roundMoney = (value: number): number => Number(value.toFixed(2));

const energyBucketLabel = (bucketStartMs: number, period: EnergyMixPeriod): string => {
  const local = new Date(bucketStartMs + LAGOS_UTC_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  if (period === 'hourly') return `${year}-${month}-${day} ${String(local.getUTCHours()).padStart(2, '0')}:00`;
  if (period === 'weekly') return `Week of ${year}-${month}-${day}`;
  if (period === 'monthly') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
};

const createEnergyBuckets = (
  period: EnergyMixPeriod,
  rangeStartMs: number,
  rangeEndMs: number
): SteamaEnergyMixBucket[] => {
  const buckets: SteamaEnergyMixBucket[] = [];
  let cursor = startOfEnergyBucket(rangeStartMs, period);
  while (cursor < rangeEndMs) {
    const next = nextEnergyBucket(cursor, period);
    const effectiveFrom = Math.max(cursor, rangeStartMs);
    const effectiveTo = Math.min(next, rangeEndMs);
    buckets.push({
      key: new Date(cursor).toISOString(),
      label: energyBucketLabel(cursor, period),
      from: new Date(effectiveFrom).toISOString(),
      to: new Date(effectiveTo).toISOString(),
      solarKwh: 0,
      gridKwh: 0,
      generatorKwh: 0,
      totalKwh: 0,
      registerRecoveredKwh: 0,
      solarPercent: 0,
      gridPercent: 0,
      generatorPercent: 0,
      matchedIntervals: 0,
      expectedIntervals: Math.max(0, Math.round((effectiveTo - effectiveFrom) / HOUR_MS)),
      coveragePercent: 0
    });
    cursor = next;
  }
  return buckets;
};

interface FloorDefinition {
  key: Exclude<SteamaFloorKey, 'unclassified'>;
  label: string;
  level: number;
}

const FLOOR_DEFINITIONS: FloorDefinition[] = [
  { key: 'ground-floor', label: 'Ground Floor', level: 0 },
  { key: 'first-floor', label: 'First Floor', level: 1 },
  { key: 'second-floor', label: 'Second Floor', level: 2 },
  { key: 'third-floor', label: 'Third Floor', level: 3 },
  { key: 'fourth-floor', label: 'Fourth Floor', level: 4 },
  { key: 'fifth-floor', label: 'Fifth Floor', level: 5 }
];

const floorDefinitionForLevel = (level: number): FloorDefinition | null =>
  FLOOR_DEFINITIONS.find((floor) => floor.level === level) ?? null;

const cleanPositionSuffix = (value: string): string =>
  value.replace(/^\s*[-–—]\s*/, '').replace(/\s*[-–—]\s*/g, '–').trim();

const positionLabel = (floor: FloorDefinition, suffix: string, fallback: string): string => {
  const cleaned = cleanPositionSuffix(suffix);
  if (!cleaned) return `${floor.label} · ${fallback}`;
  const prefix = cleaned.includes('–') ? 'Units' : 'Unit';
  return `${floor.label} · ${prefix} ${cleaned}`;
};

const classifyFloorPosition = (
  firstName: string,
  displayName: string
): {
  floorKey: SteamaFloorKey;
  floorLabel: string;
  floorLevel: number | null;
  positionLabel: string;
  mappingEvidence: SteamaFloorMappingEvidence;
} => {
  const source = (firstName || displayName).trim().replace(/\s+/g, ' ');
  const groundMatch = source.match(/^(?:g|grd|ground)\s*floor\b(.*)$/i);
  if (groundMatch) {
    const floor = FLOOR_DEFINITIONS[0];
    return {
      floorKey: floor.key,
      floorLabel: floor.label,
      floorLevel: floor.level,
      positionLabel: positionLabel(floor, groundMatch[1], source),
      mappingEvidence: 'structured_name'
    };
  }

  const ordinalMatch = source.match(
    /^(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth)\s+floor\b(.*)$/i
  );
  if (ordinalMatch) {
    const ordinal = ordinalMatch[1].toLowerCase();
    const level = ordinal === '1st' || ordinal === 'first'
      ? 1
      : ordinal === '2nd' || ordinal === 'second'
        ? 2
        : ordinal === '3rd' || ordinal === 'third'
          ? 3
          : ordinal === '4th' || ordinal === 'fourth'
            ? 4
            : 5;
    const floor = floorDefinitionForLevel(level)!;
    return {
      floorKey: floor.key,
      floorLabel: floor.label,
      floorLevel: floor.level,
      positionLabel: positionLabel(floor, ordinalMatch[2], source),
      mappingEvidence: 'structured_name'
    };
  }

  const groundCode = source.match(/^G\s*[- ]?0?(\d{1,2})$/i);
  if (groundCode) {
    const floor = FLOOR_DEFINITIONS[0];
    return {
      floorKey: floor.key,
      floorLabel: floor.label,
      floorLevel: floor.level,
      positionLabel: `${floor.label} · Position ${source.toUpperCase().replace(/\s+/g, '')}`,
      mappingEvidence: 'legacy_code'
    };
  }

  const firstFloorCode = source.match(/^F\s*0(\d{1,2})$/i);
  if (firstFloorCode) {
    const floor = FLOOR_DEFINITIONS[1];
    return {
      floorKey: floor.key,
      floorLabel: floor.label,
      floorLevel: floor.level,
      positionLabel: `${floor.label} · Position ${source.toUpperCase().replace(/\s+/g, '')}`,
      mappingEvidence: 'legacy_code'
    };
  }

  const floorCode = source.match(/^F\s*([1-5])(\d{1,2})$/i);
  if (floorCode) {
    const floor = floorDefinitionForLevel(Number(floorCode[1]))!;
    return {
      floorKey: floor.key,
      floorLabel: floor.label,
      floorLevel: floor.level,
      positionLabel: `${floor.label} · Position ${source.toUpperCase().replace(/\s+/g, '')}`,
      mappingEvidence: 'legacy_code'
    };
  }

  return {
    floorKey: 'unclassified',
    floorLabel: 'Unclassified',
    floorLevel: null,
    positionLabel: source || 'Position not named',
    mappingEvidence: 'unclassified'
  };
};

const isEstatePlaceholder = (value: string): boolean =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '') === 'naakahub';

const createFloorUsageBuckets = (
  period: EnergyMixPeriod,
  rangeStartMs: number,
  rangeEndMs: number
): SteamaFloorUsageBucket[] => {
  const floorKeys: SteamaFloorKey[] = [
    ...FLOOR_DEFINITIONS.map((floor) => floor.key),
    'unclassified'
  ];
  return createEnergyBuckets(period, rangeStartMs, rangeEndMs).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    from: bucket.from,
    to: bucket.to,
    totalKwh: 0,
    registerRecoveredKwh: 0,
    floors: floorKeys.map((floorKey) => ({ floorKey, usageKwh: 0 }))
  }));
};

const normalizeCustomerTransaction = (record: JsonObject): SteamaCustomerTransaction => {
  const customer = firstValue(record, ['customer_id', 'customer', 'customer_provider_id']);
  return {
    providerId: stringValue(firstValue(record, ['id', 'pk', 'provider_id'])),
    timestamp: isoDateValue(firstValue(record, ['timestamp', 'created_at', 'created'])) ?? '',
    category: (stringValue(firstValue(record, ['category', 'type'])) || 'Unknown').toUpperCase(),
    amount: numberValue(firstValue(record, ['amount'])) ?? 0,
    accountBalance: numberValue(firstValue(record, ['account_balance', 'balance'])),
    customerId: providerIdValue(customer) ?? '',
    meterNumber: stringValue(firstValue(record, ['meter_number', 'meter_reference'])),
    reference: stringValue(firstValue(record, ['reference']))
  };
};

const countBy = <T>(records: T[], key: (record: T) => string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = key(record);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

const countSeries = (counts: Map<string, number>, labels: Record<string, string>): CountSeriesItem[] =>
  Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

const buildExceptions = (meters: SteamaMeterSummary[], customers: SteamaCustomerSummary[]): SteamaOperationsException[] => {
  const neverOnline = meters.filter((meter) => meter.freshnessBucket === 'never_online').length;
  const stale = meters.filter((meter) =>
    ['eight_to_fourteen_days', 'over_fourteen_days'].includes(meter.freshnessBucket)
  ).length;
  const unassigned = meters.filter((meter) => !meter.assigned).length;
  const customerWithoutMeter = customers.filter((customer) => !customer.assignedMeterNumber).length;
  const unclassified = meters.filter((meter) => meter.operationalRole === 'unknown').length;
  const safety = meters.filter((meter) => meter.criticalError === true || meter.lidTamper === true).length;

  const exceptions: SteamaOperationsException[] = [
    {
      key: 'never_online',
      label: 'Meters never online',
      severity: 'critical',
      count: neverOnline,
      action: 'Verify installation, SIM, firmware identity and provider mapping.'
    },
    {
      key: 'safety',
      label: 'Safety or tamper indicators',
      severity: 'critical',
      count: safety,
      action: 'Inspect the device and retain field evidence before clearing the exception.'
    },
    {
      key: 'unassigned_meters',
      label: 'Meters without an observed customer assignment',
      severity: 'high',
      count: unassigned,
      action: 'Assign to a service account or classify as source, spare or non-billable.'
    },
    {
      key: 'stale_telemetry',
      label: 'Meters stale for at least eight days',
      severity: 'high',
      count: stale,
      action: 'Diagnose power, network coverage, SIM state and device communication.'
    },
    {
      key: 'customers_without_meter',
      label: 'Customers without an observed meter',
      severity: 'high',
      count: customerWithoutMeter,
      action: 'Confirm the customer lifecycle and approve the correct meter assignment.'
    },
    {
      key: 'unclassified_role',
      label: 'Meters with no operational role',
      severity: 'medium',
      count: unclassified,
      action: 'Classify each meter as source, bulk, customer load, spare or retired.'
    }
  ];

  return exceptions.filter((exception) => exception.count > 0);
};

export class SteamaOperationsService {
  private cachedOverview: CachedOverview | null = null;
  private cachedReadingWindow: CachedReadingWindow | null = null;
  private readonly cachedEnergyMix = new Map<string, CachedEnergyMix>();
  private readonly cachedRevenueAnalysis = new Map<string, CachedRevenueAnalysis>();
  private readonly cachedFloorAnalysis = new Map<string, CachedFloorAnalysis>();
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();
  private readonly retailTariffNgnPerKwh: number;
  private readonly tariffEffectiveFrom: string | null;
  private readonly gridSourceIncludesGenerator: boolean;
  private readonly floorTenancyRepository: FloorTenancyRepository;
  private readonly meterArchiveRepository: MeterArchiveRepository | null;
  private readonly meterArchiveSyncEnabled: boolean;
  private readonly meterArchiveInitialBackfillDays: number;
  private readonly meterRegisterBaselines: MeterRegisterBaseline[];

  constructor(
    private readonly client: SteamaReadOnlyRequester,
    private readonly cacheTtlMs = 60_000,
    options: SteamaOperationsOptions = {}
  ) {
    this.retailTariffNgnPerKwh = options.retailTariffNgnPerKwh ?? 203;
    this.tariffEffectiveFrom = options.tariffEffectiveFrom ?? null;
    this.gridSourceIncludesGenerator = options.gridSourceIncludesGenerator ?? true;
    this.floorTenancyRepository = options.floorTenancyRepository ?? new InMemoryFloorTenancyRepository();
    this.meterArchiveRepository = options.meterArchiveRepository ?? null;
    this.meterArchiveSyncEnabled = options.meterArchiveSyncEnabled ?? false;
    this.meterArchiveInitialBackfillDays = options.meterArchiveInitialBackfillDays ?? 3650;
    this.meterRegisterBaselines = options.meterRegisterBaselines ?? [];
  }

  private registerBaselineFor(
    meter: Pick<SteamaMeterSummary, 'providerId' | 'meterNumber'>
  ): MeterRegisterBaseline | undefined {
    const meterNumber = canonicalMeterNumber(meter.meterNumber);
    return this.meterRegisterBaselines.find((baseline) =>
      (baseline.providerId && baseline.providerId === meter.providerId) ||
      (baseline.meterNumber && canonicalMeterNumber(baseline.meterNumber) === meterNumber)
    );
  }

  private sourceTopology(generatorConfigured: boolean): SteamaSourceTopology {
    const gridSourceIncludesGenerator = this.gridSourceIncludesGenerator && !generatorConfigured;
    return {
      gridSourceIncludesGenerator,
      generatorSeparatelyMetered: generatorConfigured,
      sharedSupplyLabel: gridSourceIncludesGenerator ? 'AEDC / generator supply' : 'AEDC grid',
      state: generatorConfigured
        ? 'separate_aedc_and_generator_meters'
        : gridSourceIncludesGenerator
          ? 'shared_aedc_generator_meter'
          : 'aedc_only',
      externalAedcReconciliation: gridSourceIncludesGenerator
        ? 'unavailable_while_shared'
        : 'ready_for_md_meter_comparison'
    };
  }

  async synchronizeArchive(): Promise<MeterArchiveSyncCounts> {
    if (!this.meterArchiveRepository) {
      throw new Error('meter_archive_not_configured');
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    await this.meterArchiveRepository.beginSync(runId, startedAt);
    try {
      const [readings, metersPayload] = await Promise.all([
        this.getReadingWindow(true, false),
        this.client.request<unknown>({ path: '/meters/', query: { page_size: 500 } })
      ]);
      const archiveReadings = this.toArchiveReadings(readings, 'utility_reading');
      const observedAt = new Date().toISOString();
      const meters = asCollection(metersPayload).records.map((record) => normalizeMeter(record, Date.now()));
      const statuses = meters.map((meter) => ({
        observedAt,
        providerMeterId: meter.providerId,
        meterNumber: meter.meterNumber,
        meterName: meter.name,
        model: meter.model,
        customerId: meter.customerId,
        customerName: meter.customerName,
        connectivity: meter.connectivity,
        connectivityLabel: meter.connectivityLabel,
        lastReadingAt: meter.lastReadingAt,
        relayOn: meter.relayOn
      }));
      const [utilityReadingsStored, statusesStored] = await Promise.all([
        this.meterArchiveRepository.upsertReadings(archiveReadings),
        this.meterArchiveRepository.recordStatuses(statuses)
      ]);
      let directiveReadingsObserved = 0;
      const syncEndMs = Date.now();
      for (const meter of meters) {
        const latestUsageAt = await this.meterArchiveRepository.latestUsageRecordedAt(meter.providerId);
        const initialStartMs = syncEndMs - this.meterArchiveInitialBackfillDays * 24 * HOUR_MS;
        const latestStartMs = latestUsageAt
          ? new Date(latestUsageAt).getTime() - 2 * HOUR_MS
          : initialStartMs;
        const directiveReadings = await this.getDirectiveMeterReadings(
          meter,
          Math.max(initialStartMs, latestStartMs),
          syncEndMs,
          true,
          false
        );
        directiveReadingsObserved += directiveReadings.length;
      }
      const initialStartMs = syncEndMs - this.meterArchiveInitialBackfillDays * 24 * HOUR_MS;
      let transactionsObserved = 0;
      let transactionsStored = 0;
      for (const category of ['UCH', 'PAY'] as const) {
        const latestTransactionAt = await this.meterArchiveRepository.latestTransactionAt(category);
        const syncCursor = await this.meterArchiveRepository.getTransactionSyncCursor(category);
        const resumeAt = latestTransactionAt ?? syncCursor;
        const transactionStartMs = resumeAt
          ? Math.max(initialStartMs, new Date(resumeAt).getTime() - 2 * HOUR_MS)
          : initialStartMs;
        const transactions = await this.fetchProviderTransactionsFromProvider(category, transactionStartMs);
        transactionsObserved += transactions.length;
        transactionsStored += await this.meterArchiveRepository.upsertTransactions(
          transactions.map((transaction) => ({ ...transaction, category }))
        );
        await this.meterArchiveRepository.saveTransactionSyncCursor(category, new Date(syncEndMs).toISOString());
      }
      const counts: MeterArchiveSyncCounts = {
        readingsObserved: archiveReadings.length + directiveReadingsObserved,
        readingsStored: utilityReadingsStored + directiveReadingsObserved,
        statusesObserved: statuses.length,
        statusesStored,
        transactionsObserved,
        transactionsStored
      };
      await this.meterArchiveRepository.completeSync(runId, new Date().toISOString(), counts);
      return counts;
    } catch (error) {
      const safeErrorCode = error instanceof Error ? error.message.split(':')[0] : 'unknown_error';
      await this.meterArchiveRepository.failSync(runId, new Date().toISOString(), safeErrorCode);
      throw error;
    }
  }

  getArchiveStatus(): Promise<MeterArchiveSyncStatus> {
    if (!this.meterArchiveRepository) {
      return Promise.resolve({
        enabled: false,
        state: 'not_started',
        lastStartedAt: null,
        lastCompletedAt: null,
        lastSuccessfulAt: null,
        lastErrorCode: null,
        lastCounts: {
          readingsObserved: 0,
          readingsStored: 0,
          statusesObserved: 0,
          statusesStored: 0,
          transactionsObserved: 0,
          transactionsStored: 0
        },
        totalArchivedReadings: 0,
        earliestReadingAt: null,
        latestReadingAt: null,
        totalArchivedTransactions: 0,
        earliestTransactionAt: null,
        latestTransactionAt: null
      });
    }
    return this.meterArchiveRepository.getSyncStatus(this.meterArchiveSyncEnabled);
  }

  getFloorTenancyTimeline(providerCustomerId: string): Promise<FloorPositionTenancyTimeline | null> {
    return this.floorTenancyRepository.getTimeline(providerCustomerId);
  }

  async recordFloorTenancy(input: RecordFloorTenancyInput): Promise<FloorPositionTenancyTimeline> {
    const timeline = await this.floorTenancyRepository.recordManagementTenancy(input);
    this.cachedFloorAnalysis.clear();
    return timeline;
  }

  async getOverview(forceRefresh = false): Promise<SteamaOperationsOverview> {
    if (!forceRefresh && this.cachedOverview && this.cachedOverview.expiresAt > Date.now()) {
      return this.asCached(this.cachedOverview.value);
    }

    if (!forceRefresh) {
      const retained = await this.getRetainedSnapshot<SteamaOperationsOverview>('overview');
      if (retained) {
        this.cachedOverview = {
          value: retained.value,
          expiresAt: new Date(retained.retrievedAt).getTime() + this.cacheTtlMs
        };
        if (this.snapshotIsStale(retained.retrievedAt, this.cacheTtlMs)) {
          this.refreshInBackground('overview', () => this.buildOverview(true));
        }
        return this.asCached(retained.value);
      }
    }

    return this.runSingleFlight('overview', () => this.buildOverview(forceRefresh));
  }

  private async buildOverview(forceRefresh = false): Promise<SteamaOperationsOverview> {
    if (!forceRefresh && this.cachedOverview && this.cachedOverview.expiresAt > Date.now()) {
      return this.asCached(this.cachedOverview.value);
    }

    const [metersResult, customersResult, sitesResult] = await Promise.allSettled([
      this.client.request<unknown>({ path: '/meters/', query: { page_size: 500 } }),
      this.client.request<unknown>({ path: '/customers/', query: { page_size: 500 } }),
      this.client.request<unknown>({ path: '/sites/', query: { page_size: 100 } })
    ]);

    if (metersResult.status === 'rejected') {
      throw metersResult.reason;
    }

    const warnings: string[] = [];
    if (customersResult.status === 'rejected') warnings.push('customers_unavailable');
    if (sitesResult.status === 'rejected') warnings.push('sites_unavailable');

    const now = Date.now();
    const meterCollection = asCollection(metersResult.value);
    const customerCollection =
      customersResult.status === 'fulfilled' ? asCollection(customersResult.value) : { count: 0, records: [] };
    const siteCollection = sitesResult.status === 'fulfilled' ? asCollection(sitesResult.value) : { count: 0, records: [] };
    const providerMeters = meterCollection.records.map((record) => normalizeMeter(record, now));
    const meterNumbersByCustomer = new Map<string, string[]>();
    for (const meter of providerMeters) {
      if (!meter.customerId) continue;
      const meterNumbers = meterNumbersByCustomer.get(meter.customerId) ?? [];
      if (meter.meterNumber && !meterNumbers.includes(meter.meterNumber)) {
        meterNumbers.push(meter.meterNumber);
      }
      meterNumbersByCustomer.set(meter.customerId, meterNumbers);
    }
    const customers = customerCollection.records.map((record) =>
      normalizeCustomer(record, meterNumbersByCustomer)
    );
    let meters = reconcileMeterAssignments(providerMeters, customers);
    try {
      const readingWindow = await this.getReadingWindow(forceRefresh);
      meters = enrichMetersWithLatestReadings(meters, readingWindow);
    } catch {
      warnings.push('meter_readings_unavailable');
    }
    const freshnessCounts = countBy(meters, (meter) => meter.freshnessBucket);
    const roleCounts = countBy(meters, (meter) => meter.operationalRole);
    const modelCounts = countBy(meters, (meter) => meter.model || 'Not provided');
    const assignedMeters = meters.filter((meter) => meter.assigned).length;
    const sourceRoles: MeterOperationalRole[] = [
      'grid_source',
      'solar_source',
      'generator_source',
      'distribution_or_bulk'
    ];
    const retrievedAt = new Date(now).toISOString();

    const overview: SteamaOperationsOverview = {
      dataSource: {
        provider: 'SteamaCo',
        mode: 'live_read_only',
        retrievedAt,
        cached: false
      },
      summary: {
        totalMeters: meterCollection.count,
        onlineMeters: meters.filter((meter) => meter.connectivity === 'online').length,
        neverOnlineMeters: meters.filter((meter) => meter.freshnessBucket === 'never_online').length,
        assignedMeters,
        unassignedMeters: Math.max(0, meterCollection.count - assignedMeters),
        sourceMeters: meters.filter((meter) => sourceRoles.includes(meter.operationalRole)).length,
        customerLoadMeters: meters.filter((meter) => meter.operationalRole === 'customer_load').length,
        unclassifiedMeters: meters.filter((meter) => meter.operationalRole === 'unknown').length,
        totalCustomers: customerCollection.count,
        customersWithoutMeter: customers.filter((customer) => !customer.assignedMeterNumber).length,
        totalSites: siteCollection.count
      },
      freshnessDistribution: countSeries(freshnessCounts, FRESHNESS_LABELS),
      assignmentDistribution: [
        { key: 'assigned', label: 'Assigned', count: assignedMeters },
        { key: 'unassigned', label: 'Unassigned', count: Math.max(0, meterCollection.count - assignedMeters) }
      ],
      roleDistribution: countSeries(roleCounts, ROLE_LABELS),
      modelDistribution: countSeries(modelCounts, {}),
      exceptions: buildExceptions(meters, customers),
      meters,
      customers,
      warnings
    };

    this.cachedOverview = { value: overview, expiresAt: now + this.cacheTtlMs };
    await this.retainSnapshot('overview', overview, retrievedAt);
    return overview;
  }

  async getMeter(providerId: string): Promise<SteamaMeterSummary> {
    const payload = await this.client.request<unknown>({ path: `/meters/${providerId}/` });
    if (!isObject(payload)) {
      throw new Error('provider_meter_invalid_response');
    }
    return normalizeMeter(payload, Date.now());
  }

  async getMeterHistory(providerId: string, forceRefresh = false): Promise<SteamaMeterHistory> {
    let meter: { providerId: string; meterNumber: string; name: string };
    const archivedIdentity = !forceRefresh
      ? await this.meterArchiveRepository?.findMeterIdentity(providerId)
      : null;
    if (archivedIdentity) {
      meter = archivedIdentity;
    } else {
      try {
        meter = await this.getMeter(providerId);
      } catch (error) {
        const fallbackIdentity = await this.meterArchiveRepository?.findMeterIdentity(providerId);
        if (!fallbackIdentity) throw error;
        meter = fallbackIdentity;
      }
    }

    let readings: SteamaMeterReadingPoint[] = [];
    const warnings: string[] = [];
    if (this.meterArchiveRepository) {
      if (forceRefresh) {
        try {
          await this.getReadingWindow(true);
        } catch {
          warnings.push('The provider refresh failed; the locally retained archive is being shown.');
        }
      }
      readings = await this.meterArchiveRepository.listMeterReadings(providerId, meter.meterNumber);
      if (readings.length === 0) {
        const providerWindow = await this.getReadingWindow(false);
        readings = await this.meterArchiveRepository.listMeterReadings(providerId, meter.meterNumber);
        if (readings.length === 0) {
          readings = providerWindow.filter(
            (reading) => reading.meterId === providerId || reading.meterNumber === meter.meterNumber
          );
        }
      }
      warnings.push('History is served from the local MSM archive and is retained beyond the provider recent window.');
    } else {
      const readingWindow = await this.getReadingWindow(forceRefresh);
      readings = readingWindow.filter(
        (reading) => reading.meterId === providerId || reading.meterNumber === meter.meterNumber
      );
      warnings.push('The provider reading endpoint exposes a recent window; a permanent local archive is not configured.');
    }
    readings.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const first = readings[0] ?? null;
    const latest = readings.at(-1) ?? null;
    const usageValues = readings.map((reading) => reading.usageKwh).filter((value): value is number => value !== null);
    const baseline = this.registerBaselineFor(meter);
    const registerValues = readings
      .filter(
        (reading): reading is SteamaMeterReadingPoint & { readingKwh: number } =>
          reading.readingKwh !== null &&
          Number.isFinite(reading.readingKwh) &&
          reading.readingKwh >= 0 &&
          !reading.anomalous
      )
      .map((reading) => ({ timestamp: reading.timestamp, readingKwh: reading.readingKwh }));
    if (baseline && registerValues.length > 0 && baseline.effectiveAt <= registerValues[0].timestamp) {
      registerValues.unshift({ timestamp: baseline.effectiveAt, readingKwh: baseline.readingKwh });
    }
    let registerAnchor = registerValues[0] ?? null;
    let registerChangeKwh = 0;
    let ignoredRegisterDrops = 0;
    for (const reading of registerValues.slice(1)) {
      if (!registerAnchor) break;
      if (reading.readingKwh < registerAnchor.readingKwh - 0.005) {
        ignoredRegisterDrops += 1;
        continue;
      }
      if (reading.readingKwh > registerAnchor.readingKwh) {
        registerChangeKwh += reading.readingKwh - registerAnchor.readingKwh;
      }
      registerAnchor = reading;
    }
    const negativeValues = readings.some(
      (reading) => (reading.readingKwh !== null && reading.readingKwh < 0) || (reading.usageKwh !== null && reading.usageKwh < 0)
    );
    if (readings.length === 0) warnings.push('No reading was returned for this meter in the current provider window.');
    if (negativeValues) warnings.push('Negative meter data is present and must be reviewed before interpretation.');
    if (ignoredRegisterDrops > 0) {
      warnings.push(`${ignoredRegisterDrops} lower cumulative-register reading(s) were ignored pending reset or data-quality review.`);
    }

    return {
      dataSource: {
        provider: 'SteamaCo',
        mode: this.meterArchiveRepository ? 'local_archive' : 'live_read_only',
        retrievedAt: new Date().toISOString(),
        scope: this.meterArchiveRepository ? 'local_historical_archive' : 'provider_recent_window'
      },
      meter: { providerId, meterNumber: meter.meterNumber, name: meter.name },
      coverage: {
        from: first?.timestamp ?? null,
        to: latest?.timestamp ?? null,
        readingCount: readings.length
      },
      summary: {
        firstReadingKwh: registerValues[0]?.readingKwh ?? first?.readingKwh ?? null,
        latestReadingKwh: registerAnchor?.readingKwh ?? latest?.readingKwh ?? null,
        registerChangeKwh: registerValues.length > 1 ? roundEnergy(registerChangeKwh) : null,
        intervalUsageKwh: usageValues.length > 0 ? usageValues.reduce((sum, value) => sum + value, 0) : null,
        anomalyCount: readings.filter((reading) => reading.anomalous).length
      },
      readings,
      warnings
    };
  }

  async getEnergyMix(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaEnergyMix> {
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedEnergyMix.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return this.asCached(cached.value);
    }

    const snapshotKey = `energy-mix-v3:${cacheKey}`;
    if (!forceRefresh) {
      const retained = await this.getRetainedSnapshot<SteamaEnergyMix>(snapshotKey);
      if (retained && retained.value.summary.solarVsGrid && retained.value.summary.solarVsGenerator) {
        if (this.snapshotIsStale(retained.retrievedAt, Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS))) {
          this.refreshInBackground(snapshotKey, () => this.buildEnergyMix(period, true, customRange));
        }
        return this.asCached(retained.value);
      }
    }

    return this.runSingleFlight(snapshotKey, () => this.buildEnergyMix(period, forceRefresh, customRange));
  }

  private async buildEnergyMix(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaEnergyMix> {
    const now = Date.now();
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedEnergyMix.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return { ...cached.value, dataSource: { ...cached.value.dataSource, cached: true } };
    }

    const range = resolveEnergyMixRange(now, period, customRange);
    const rangeStartMs = range.start;
    const rangeEndMs = range.end;
    if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) {
      throw new Error('invalid_energy_mix_range');
    }
    const overview = await this.getOverview(forceRefresh);
    const sourceMeters = overview.meters.filter(
      (meter): meter is SteamaMeterSummary & {
        operationalRole: 'solar_source' | 'grid_source' | 'generator_source';
      } =>
        meter.operationalRole === 'solar_source' ||
        meter.operationalRole === 'grid_source' ||
        meter.operationalRole === 'generator_source'
    );

    const histories = await Promise.all(
      sourceMeters.map(async (meter) => ({
        meter,
        usage: await this.getAuthoritativeMeterUsage(meter, rangeStartMs, rangeEndMs, forceRefresh)
      }))
    );

    const roleIntervals = {
      solar_source: new Map<string, number>(),
      grid_source: new Map<string, number>(),
      generator_source: new Map<string, number>()
    };
    const comparisonRoleIntervals = {
      solar_source: new Map<string, number>(),
      grid_source: new Map<string, number>(),
      generator_source: new Map<string, number>()
    };
    const roleRecoveredIntervals = {
      solar_source: new Map<string, number>(),
      grid_source: new Map<string, number>(),
      generator_source: new Map<string, number>()
    };
    const sourceSummaries: SteamaEnergyMixSourceMeter[] = [];

    for (const history of histories) {
      const meterIntervals = new Map<string, AuthoritativeDirectiveReading>();
      for (const reading of history.usage.readings) {
        meterIntervals.set(reading.intervalStart, reading);
      }
      for (const [intervalStart, reading] of meterIntervals) {
        const roleMap = roleIntervals[history.meter.operationalRole];
        roleMap.set(intervalStart, (roleMap.get(intervalStart) ?? 0) + reading.usageKwh);
        const recoveredMap = roleRecoveredIntervals[history.meter.operationalRole];
        recoveredMap.set(
          intervalStart,
          (recoveredMap.get(intervalStart) ?? 0) + reading.registerRecoveredKwh
        );
        if (history.usage.recordedIntervalKeys.has(intervalStart)) {
          const comparisonMap = comparisonRoleIntervals[history.meter.operationalRole];
          comparisonMap.set(
            intervalStart,
            (comparisonMap.get(intervalStart) ?? 0) + reading.recordedUsageKwh
          );
        }
      }

      const ordered = Array.from(meterIntervals.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      sourceSummaries.push({
        providerId: history.meter.providerId,
        meterNumber: history.meter.meterNumber,
        name: history.meter.name,
        role: history.meter.operationalRole,
        observedIntervals: history.usage.recordedIntervalKeys.size,
        recordedUsageKwh: history.usage.recordedUsageKwh,
        registerRecoveredKwh: history.usage.registerRecoveredKwh,
        registerRecoveryEvents: history.usage.recoveryEvents.length,
        ignoredRegisterDrops: history.usage.ignoredRegisterDrops,
        firstReadingAt: ordered[0]?.timestamp ?? null,
        latestReadingAt: ordered.at(-1)?.timestamp ?? null
      });
    }

    const buckets = createEnergyBuckets(period, rangeStartMs, rangeEndMs);
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const solarConfigured = sourceMeters.some((meter) => meter.operationalRole === 'solar_source');
    const gridConfigured = sourceMeters.some((meter) => meter.operationalRole === 'grid_source');
    const generatorConfigured = sourceMeters.some((meter) => meter.operationalRole === 'generator_source');
    const requiredRoleMaps = [comparisonRoleIntervals.solar_source, comparisonRoleIntervals.grid_source];
    if (generatorConfigured) requiredRoleMaps.push(comparisonRoleIntervals.generator_source);
    const matchedIntervalKeys = Array.from(comparisonRoleIntervals.solar_source.keys()).filter((key) =>
      requiredRoleMaps.every((roleMap) => roleMap.has(key))
    );

    const addRoleToBuckets = (
      intervals: Map<string, number>,
      recoveredIntervals: Map<string, number>,
      role: 'solar_source' | 'grid_source' | 'generator_source'
    ): number => {
      let total = 0;
      for (const [intervalKey, usageKwh] of intervals) {
        const intervalMs = new Date(intervalKey).getTime();
        if (intervalMs < rangeStartMs || intervalMs >= rangeEndMs) continue;
        total += usageKwh;
        const bucketKey = new Date(startOfEnergyBucket(intervalMs, period)).toISOString();
        const bucket = bucketsByKey.get(bucketKey);
        if (!bucket) continue;
        if (role === 'solar_source') bucket.solarKwh += usageKwh;
        if (role === 'grid_source') bucket.gridKwh += usageKwh;
        if (role === 'generator_source') bucket.generatorKwh += usageKwh;
        bucket.registerRecoveredKwh += recoveredIntervals.get(intervalKey) ?? 0;
      }
      return roundEnergy(total);
    };
    let solarKwh = addRoleToBuckets(roleIntervals.solar_source, roleRecoveredIntervals.solar_source, 'solar_source');
    let gridKwh = addRoleToBuckets(roleIntervals.grid_source, roleRecoveredIntervals.grid_source, 'grid_source');
    let generatorKwh = addRoleToBuckets(
      roleIntervals.generator_source,
      roleRecoveredIntervals.generator_source,
      'generator_source'
    );
    for (const intervalKey of matchedIntervalKeys) {
      const intervalMs = new Date(intervalKey).getTime();
      if (intervalMs < rangeStartMs || intervalMs >= rangeEndMs) continue;
      const bucketKey = new Date(startOfEnergyBucket(intervalMs, period)).toISOString();
      const bucket = bucketsByKey.get(bucketKey);
      if (bucket) bucket.matchedIntervals += 1;
    }
    const generatorActiveIntervals = Array.from(comparisonRoleIntervals.generator_source.entries()).filter(
      ([key, usageKwh]) => {
        const intervalMs = new Date(key).getTime();
        return intervalMs >= rangeStartMs && intervalMs < rangeEndMs && usageKwh > 0;
      }
    ).length;

    for (const bucket of buckets) {
      bucket.solarKwh = roundEnergy(bucket.solarKwh);
      bucket.gridKwh = roundEnergy(bucket.gridKwh);
      bucket.generatorKwh = roundEnergy(bucket.generatorKwh);
      bucket.registerRecoveredKwh = roundEnergy(bucket.registerRecoveredKwh);
      bucket.totalKwh = roundEnergy(bucket.solarKwh + bucket.gridKwh + bucket.generatorKwh);
      bucket.solarPercent = bucket.totalKwh > 0 ? roundPercent((bucket.solarKwh / bucket.totalKwh) * 100) : 0;
      bucket.gridPercent = bucket.totalKwh > 0 ? roundPercent((bucket.gridKwh / bucket.totalKwh) * 100) : 0;
      bucket.generatorPercent = bucket.totalKwh > 0
        ? roundPercent((bucket.generatorKwh / bucket.totalKwh) * 100)
        : 0;
      bucket.coveragePercent = bucket.expectedIntervals > 0
        ? roundPercent((bucket.matchedIntervals / bucket.expectedIntervals) * 100)
        : 0;
    }

    solarKwh = roundEnergy(solarKwh);
    gridKwh = roundEnergy(gridKwh);
    generatorKwh = roundEnergy(generatorKwh);
    const totalKwh = roundEnergy(solarKwh + gridKwh + generatorKwh);
    const solarPercent = totalKwh > 0 ? roundPercent((solarKwh / totalKwh) * 100) : 0;
    const gridPercent = totalKwh > 0 ? roundPercent((gridKwh / totalKwh) * 100) : 0;
    const generatorPercent = totalKwh > 0 ? roundPercent((generatorKwh / totalKwh) * 100) : 0;
    const solarVsGrid = buildPairComparison(
      comparisonRoleIntervals.solar_source,
      comparisonRoleIntervals.grid_source,
      solarConfigured && gridConfigured,
      rangeStartMs,
      rangeEndMs
    );
    const solarVsGenerator = buildPairComparison(
      comparisonRoleIntervals.solar_source,
      comparisonRoleIntervals.generator_source,
      solarConfigured && generatorConfigured,
      rangeStartMs,
      rangeEndMs
    );
    const expectedIntervals = Math.max(0, Math.round((rangeEndMs - rangeStartMs) / HOUR_MS));
    const matchedIntervals = matchedIntervalKeys.filter((key) => {
      const timestamp = new Date(key).getTime();
      return timestamp >= rangeStartMs && timestamp < rangeEndMs;
    }).length;
    const registerRecoveredKwh = roundEnergy(
      sourceSummaries.reduce((sum, source) => sum + source.registerRecoveredKwh, 0)
    );
    const registerRecoveryEvents = sourceSummaries.reduce(
      (sum, source) => sum + source.registerRecoveryEvents,
      0
    );
    const ignoredRegisterDrops = sourceSummaries.reduce(
      (sum, source) => sum + source.ignoredRegisterDrops,
      0
    );
    const intervalExcessEvents = histories.reduce(
      (sum, history) => sum + history.usage.intervalExcessEvents,
      0
    );
    const targetStatus = energyMixTargetStatus(totalKwh > 0 ? solarPercent : null);
    const warnings = [
      'Overall energy totals use recorded interval consumption plus cumulative-register movement recovered after connectivity gaps.',
      'Pairwise solar-complement percentages use only genuinely time-matched interval readings; recovered register jumps are excluded because their original hourly timing is unknown.'
    ];
    if (registerRecoveredKwh > 0) {
      warnings.push(
        `${registerRecoveredKwh.toFixed(2)} kWh was recovered from ${registerRecoveryEvents} cumulative-register movement event(s) and posted when each higher reading arrived.`
      );
    }
    if (ignoredRegisterDrops > 0) {
      warnings.push(
        `${ignoredRegisterDrops} lower cumulative-register reading(s) were ignored to prevent malformed or reset values from creating false energy increases.`
      );
    }
    if (intervalExcessEvents > 0) {
      warnings.push(
        `${intervalExcessEvents} register segment(s) contained more interval usage than register movement; recorded intervals were retained and no negative recovery was applied.`
      );
    }
    if (!sourceMeters.some((meter) => meter.operationalRole === 'solar_source')) {
      warnings.push('No solar source meter is currently classified.');
    }
    if (!sourceMeters.some((meter) => meter.operationalRole === 'grid_source')) {
      warnings.push('No grid source meter is currently classified.');
    }
    if (!generatorConfigured) {
      warnings.push(this.gridSourceIncludesGenerator
        ? 'Generator energy is currently included in the shared AEDC/generator supply meter and cannot be separated until a dedicated generator meter is installed.'
        : 'No dedicated generator source meter is currently classified.');
    }

    const sourceTopology = this.sourceTopology(generatorConfigured);

    const result: SteamaEnergyMix = {
      dataSource: {
        provider: 'SteamaCo',
        mode: 'live_read_only',
        retrievedAt: new Date(now).toISOString(),
        scope: 'provider_meter_directives',
        cached: false
      },
      period,
      range: {
        from: new Date(rangeStartMs).toISOString(),
        to: new Date(rangeEndMs).toISOString(),
        timezone: 'Africa/Lagos'
      },
      target: {
        solarMinimumPercent: SOLAR_TARGET_MINIMUM,
        solarMaximumPercent: SOLAR_TARGET_MAXIMUM
      },
      sourceTopology,
      summary: {
        solarKwh,
        gridKwh,
        generatorKwh,
        totalKwh,
        registerRecoveredKwh,
        registerRecoveryEvents,
        ignoredRegisterDrops,
        solarPercent,
        gridPercent,
        generatorPercent,
        generatorConfigured,
        generatorActiveIntervals: generatorConfigured ? generatorActiveIntervals : null,
        estimatedGeneratorRuntimeHours: generatorConfigured ? generatorActiveIntervals : null,
        targetStatus,
        solarVsGrid,
        solarVsGenerator,
        matchedIntervals,
        expectedIntervals,
        coveragePercent: expectedIntervals > 0 ? roundPercent((matchedIntervals / expectedIntervals) * 100) : 0
      },
      sourceMeters: sourceSummaries,
      buckets,
      warnings
    };

    this.cachedEnergyMix.set(cacheKey, {
      value: result,
      expiresAt: now + Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS)
    });
    await this.retainSnapshot(`energy-mix-v3:${cacheKey}`, result, result.dataSource.retrievedAt);
    return result;
  }

  async getRevenueAnalysis(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaRevenueAnalysis> {
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedRevenueAnalysis.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return this.asCached(cached.value);
    }

    const snapshotKey = `revenue-v4:${cacheKey}`;
    if (!forceRefresh) {
      const retained = await this.getRetainedSnapshot<SteamaRevenueAnalysis>(snapshotKey);
      if (retained) {
        if (this.snapshotIsStale(retained.retrievedAt, Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS))) {
          this.refreshInBackground(snapshotKey, () => this.buildRevenueAnalysis(period, true, customRange));
        }
        return this.asCached(retained.value);
      }
    }

    return this.runSingleFlight(snapshotKey, () => this.buildRevenueAnalysis(period, forceRefresh, customRange));
  }

  private async buildRevenueAnalysis(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaRevenueAnalysis> {
    const now = Date.now();
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedRevenueAnalysis.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return { ...cached.value, dataSource: { ...cached.value.dataSource, cached: true } };
    }

    const energyMix = await this.getEnergyMix(period, forceRefresh, customRange);
    const rangeStartMs = new Date(energyMix.range.from).getTime();
    const rangeEndMs = new Date(energyMix.range.to).getTime();
    const [usageChargesResult, paymentsResult, overviewResult] = await Promise.allSettled([
      this.getProviderTransactions('UCH', rangeStartMs),
      this.getProviderTransactions('PAY', rangeStartMs),
      this.getOverview(false)
    ]);
    if (usageChargesResult.status === 'rejected') throw usageChargesResult.reason;
    if (overviewResult.status === 'rejected') throw overviewResult.reason;

    const usageCharges = usageChargesResult.value;
    const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value : [];
    const overview = overviewResult.value;
    const roleByMeterNumber = new Map(
      overview.meters.map((meter) => [canonicalMeterNumber(meter.meterNumber), meter.operationalRole])
    );
    const roleByCustomerId = new Map<string, MeterOperationalRole>();
    for (const meter of overview.meters) {
      if (meter.customerId) roleByCustomerId.set(meter.customerId, meter.operationalRole);
    }
    for (const customer of overview.customers) {
      const roles = assignedMeterNumbers(customer)
        .map((meterNumber) => roleByMeterNumber.get(canonicalMeterNumber(meterNumber)))
        .filter((role): role is MeterOperationalRole => Boolean(role));
      if (roles.length === 1) roleByCustomerId.set(customer.providerId, roles[0]);
    }
    const transactionRole = (transaction: SteamaCustomerTransaction): MeterOperationalRole =>
      roleByCustomerId.get(transaction.customerId) ??
      roleByMeterNumber.get(canonicalMeterNumber(transaction.meterNumber)) ??
      'unknown';
    const buckets: SteamaRevenueBucket[] = energyMix.buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      from: bucket.from,
      to: bucket.to,
      solarKwh: bucket.solarKwh,
      gridKwh: bucket.gridKwh,
      generatorKwh: bucket.generatorKwh,
      totalKwh: bucket.totalKwh,
      registerRecoveredKwh: bucket.registerRecoveredKwh,
      coveragePercent: bucket.coveragePercent,
      customerUsageChargeNgn: 0,
      usageChargeTransactions: 0,
      sourceAccountChargeNgn: 0,
      sourceAccountTransactions: 0,
      solarSourceAccountChargeNgn: 0,
      gridSourceAccountChargeNgn: 0,
      generatorSourceAccountChargeNgn: 0,
      unclassifiedUsageChargeNgn: 0,
      unclassifiedUsageChargeTransactions: 0,
      recordedPaymentNgn: null,
      paymentTransactions: 0,
      solarAttributedChargeNgn: 0,
      gridAttributedChargeNgn: 0,
      generatorAttributedChargeNgn: 0,
      energyValueNgn: 0,
      accruedEnergyRevenueNgn: 0,
      solarAccruedRevenueNgn: 0,
      sharedSupplyAccruedRevenueNgn: 0,
      generatorAccruedRevenueNgn: 0
    }));
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    let latestCustomerUsageChargeAt: string | null = null;
    let latestSourceAccountChargeAt: string | null = null;

    for (const transaction of usageCharges) {
      const timestampMs = new Date(transaction.timestamp).getTime();
      const intervalStartMs = floorHour(timestampMs) - HOUR_MS;
      if (intervalStartMs < rangeStartMs || intervalStartMs >= rangeEndMs) continue;
      const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(intervalStartMs, period)).toISOString());
      if (!bucket) continue;
      const role = transactionRole(transaction);
      if (role === 'customer_load') {
        bucket.customerUsageChargeNgn += -transaction.amount;
        bucket.usageChargeTransactions += 1;
        if (!latestCustomerUsageChargeAt || transaction.timestamp > latestCustomerUsageChargeAt) {
          latestCustomerUsageChargeAt = transaction.timestamp;
        }
      } else if (role === 'solar_source' || role === 'grid_source' || role === 'generator_source') {
        const amount = -transaction.amount;
        bucket.sourceAccountChargeNgn += amount;
        bucket.sourceAccountTransactions += 1;
        if (role === 'solar_source') bucket.solarSourceAccountChargeNgn += amount;
        if (role === 'grid_source') bucket.gridSourceAccountChargeNgn += amount;
        if (role === 'generator_source') bucket.generatorSourceAccountChargeNgn += amount;
        if (!latestSourceAccountChargeAt || transaction.timestamp > latestSourceAccountChargeAt) {
          latestSourceAccountChargeAt = transaction.timestamp;
        }
      } else {
        bucket.unclassifiedUsageChargeNgn += -transaction.amount;
        bucket.unclassifiedUsageChargeTransactions += 1;
      }
    }

    for (const transaction of payments) {
      const timestampMs = new Date(transaction.timestamp).getTime();
      if (timestampMs < rangeStartMs || timestampMs >= rangeEndMs) continue;
      const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(timestampMs, period)).toISOString());
      if (!bucket) continue;
      if (transactionRole(transaction) !== 'customer_load') continue;
      bucket.recordedPaymentNgn = (bucket.recordedPaymentNgn ?? 0) + transaction.amount;
      bucket.paymentTransactions += 1;
    }

    for (const bucket of buckets) {
      bucket.customerUsageChargeNgn = roundMoney(Math.max(0, bucket.customerUsageChargeNgn));
      bucket.sourceAccountChargeNgn = roundMoney(Math.max(0, bucket.sourceAccountChargeNgn));
      bucket.solarSourceAccountChargeNgn = roundMoney(Math.max(0, bucket.solarSourceAccountChargeNgn));
      bucket.gridSourceAccountChargeNgn = roundMoney(Math.max(0, bucket.gridSourceAccountChargeNgn));
      bucket.generatorSourceAccountChargeNgn = roundMoney(Math.max(0, bucket.generatorSourceAccountChargeNgn));
      bucket.unclassifiedUsageChargeNgn = roundMoney(Math.max(0, bucket.unclassifiedUsageChargeNgn));
      if (bucket.recordedPaymentNgn !== null) {
        bucket.recordedPaymentNgn = roundMoney(Math.max(0, bucket.recordedPaymentNgn));
      }
      bucket.energyValueNgn = roundMoney(bucket.totalKwh * this.retailTariffNgnPerKwh);
      bucket.accruedEnergyRevenueNgn = bucket.energyValueNgn;
      bucket.solarAccruedRevenueNgn = roundMoney(bucket.solarKwh * this.retailTariffNgnPerKwh);
      bucket.sharedSupplyAccruedRevenueNgn = roundMoney(bucket.gridKwh * this.retailTariffNgnPerKwh);
      bucket.generatorAccruedRevenueNgn = roundMoney(bucket.generatorKwh * this.retailTariffNgnPerKwh);
      if (bucket.totalKwh > 0) {
        bucket.solarAttributedChargeNgn = roundMoney(
          bucket.customerUsageChargeNgn * (bucket.solarKwh / bucket.totalKwh)
        );
        bucket.gridAttributedChargeNgn = roundMoney(
          bucket.customerUsageChargeNgn * (bucket.gridKwh / bucket.totalKwh)
        );
        bucket.generatorAttributedChargeNgn = roundMoney(
          Math.max(0, bucket.customerUsageChargeNgn - bucket.solarAttributedChargeNgn - bucket.gridAttributedChargeNgn)
        );
      }
    }

    const customerUsageChargeNgn = roundMoney(
      buckets.reduce((sum, bucket) => sum + bucket.customerUsageChargeNgn, 0)
    );
    const sourceAccountChargeNgn = roundMoney(buckets.reduce((sum, bucket) => sum + bucket.sourceAccountChargeNgn, 0));
    const solarSourceAccountChargeNgn = roundMoney(buckets.reduce((sum, bucket) => sum + bucket.solarSourceAccountChargeNgn, 0));
    const gridSourceAccountChargeNgn = roundMoney(buckets.reduce((sum, bucket) => sum + bucket.gridSourceAccountChargeNgn, 0));
    const generatorSourceAccountChargeNgn = roundMoney(buckets.reduce((sum, bucket) => sum + bucket.generatorSourceAccountChargeNgn, 0));
    const unclassifiedUsageChargeNgn = roundMoney(buckets.reduce((sum, bucket) => sum + bucket.unclassifiedUsageChargeNgn, 0));
    const customerPaymentTransactions = buckets.reduce((sum, bucket) => sum + bucket.paymentTransactions, 0);
    const collectionsAvailable = customerPaymentTransactions > 0;
    const recordedPaymentNgn = collectionsAvailable
      ? roundMoney(buckets.reduce((sum, bucket) => sum + (bucket.recordedPaymentNgn ?? 0), 0))
      : null;
    const solarAttributedChargeNgn = roundMoney(
      buckets.reduce((sum, bucket) => sum + bucket.solarAttributedChargeNgn, 0)
    );
    const gridAttributedChargeNgn = roundMoney(
      buckets.reduce((sum, bucket) => sum + bucket.gridAttributedChargeNgn, 0)
    );
    const generatorAttributedChargeNgn = roundMoney(
      buckets.reduce((sum, bucket) => sum + bucket.generatorAttributedChargeNgn, 0)
    );
    const allocatedCustomerChargeNgn = roundMoney(
      solarAttributedChargeNgn + gridAttributedChargeNgn + generatorAttributedChargeNgn
    );
    const unallocatedCustomerChargeNgn = roundMoney(Math.max(0, customerUsageChargeNgn - allocatedCustomerChargeNgn));
    const chargeAllocationCoveragePercent = customerUsageChargeNgn > 0
      ? roundPercent((allocatedCustomerChargeNgn / customerUsageChargeNgn) * 100)
      : null;
    const warnings = [
      'Accrued energy revenue is measured consumption multiplied by the configured Band A retail tariff; it does not depend on when customers purchase credit or make payment.',
      energyMix.sourceTopology.gridSourceIncludesGenerator
        ? 'The current conventional-supply meter combines AEDC grid and generator energy. Its revenue value is shown as a shared supply until a dedicated generator meter is installed.'
        : 'AEDC grid and generator energy are reported separately when both dedicated source meters are configured.',
      'Customer UCH and PAY entries are retained as separate ledger and collections evidence; they do not drive accrued energy revenue.',
      'Actual AEDC, generator and solar operating costs are not configured. Energy revenue is an operational valuation, not a supplier payable or profit figure.',
      `The configured Band A retail rate is NGN ${this.retailTariffNgnPerKwh.toFixed(2)} per kWh. Historical effective-date treatment remains provisional until an effective date is configured.`,
      ...energyMix.warnings
    ];
    if (!collectionsAvailable) {
      warnings.unshift('No customer-load PAY transaction was returned for this period, so actual cash collections are unavailable.');
    }
    if (paymentsResult.status === 'rejected') {
      warnings.unshift('The provider payment ledger could not be retrieved; collections remain unavailable.');
    }
    if (sourceAccountChargeNgn > 0) {
      warnings.unshift(`${sourceAccountChargeNgn.toFixed(2)} NGN of source-account UCH debits was retained and excluded from customer revenue.`);
    }
    if (unclassifiedUsageChargeNgn > 0) {
      warnings.unshift(`${unclassifiedUsageChargeNgn.toFixed(2)} NGN of UCH entries could not be mapped to a meter role and was excluded pending classification.`);
    }

    const result: SteamaRevenueAnalysis = {
      dataSource: {
        provider: 'SteamaCo',
        mode: 'live_read_only',
        retrievedAt: new Date(now).toISOString(),
        scope: 'provider_usage_charge_ledger_and_meter_directives',
        cached: false
      },
      period,
      range: energyMix.range,
      tariff: {
        retailNgnPerKwh: this.retailTariffNgnPerKwh,
        currency: 'NGN',
        status: 'provisional',
        effectiveFrom: this.tariffEffectiveFrom,
        source: 'MSM controlled configuration'
      },
      sourceTopology: energyMix.sourceTopology,
      costs: {
        status: 'not_configured',
        aedcSupplierPayableNgn: null,
        generatorFuelCostNgn: null,
        solarOperatingCostNgn: null
      },
      summary: {
        customerUsageChargeNgn,
        usageChargeTransactions: buckets.reduce((sum, bucket) => sum + bucket.usageChargeTransactions, 0),
        sourceAccountChargeNgn,
        sourceAccountTransactions: buckets.reduce((sum, bucket) => sum + bucket.sourceAccountTransactions, 0),
        solarSourceAccountChargeNgn,
        gridSourceAccountChargeNgn,
        generatorSourceAccountChargeNgn,
        unclassifiedUsageChargeNgn,
        unclassifiedUsageChargeTransactions: buckets.reduce(
          (sum, bucket) => sum + bucket.unclassifiedUsageChargeTransactions,
          0
        ),
        excludedUsageChargeNgn: roundMoney(sourceAccountChargeNgn + unclassifiedUsageChargeNgn),
        latestCustomerUsageChargeAt,
        latestSourceAccountChargeAt,
        recordedPaymentNgn,
        paymentTransactions: customerPaymentTransactions,
        collectionsAvailable,
        energyValueNgn: roundMoney(energyMix.summary.totalKwh * this.retailTariffNgnPerKwh),
        accruedEnergyRevenueNgn: roundMoney(energyMix.summary.totalKwh * this.retailTariffNgnPerKwh),
        solarAccruedRevenueNgn: roundMoney(energyMix.summary.solarKwh * this.retailTariffNgnPerKwh),
        sharedSupplyAccruedRevenueNgn: roundMoney(energyMix.summary.gridKwh * this.retailTariffNgnPerKwh),
        generatorAccruedRevenueNgn: roundMoney(energyMix.summary.generatorKwh * this.retailTariffNgnPerKwh),
        solarAttributedChargeNgn,
        gridAttributedChargeNgn,
        generatorAttributedChargeNgn,
        unallocatedCustomerChargeNgn,
        chargeAllocationCoveragePercent,
        solarEnergyValueNgn: roundMoney(energyMix.summary.solarKwh * this.retailTariffNgnPerKwh),
        gridEnergyValueNgn: roundMoney(energyMix.summary.gridKwh * this.retailTariffNgnPerKwh),
        generatorEnergyValueNgn: roundMoney(energyMix.summary.generatorKwh * this.retailTariffNgnPerKwh),
        solarKwh: energyMix.summary.solarKwh,
        gridKwh: energyMix.summary.gridKwh,
        generatorKwh: energyMix.summary.generatorKwh,
        totalKwh: energyMix.summary.totalKwh,
        registerRecoveredKwh: energyMix.summary.registerRecoveredKwh,
        registerRecoveryEvents: energyMix.summary.registerRecoveryEvents,
        ignoredRegisterDrops: energyMix.summary.ignoredRegisterDrops,
        solarPercent: energyMix.summary.solarPercent,
        gridPercent: energyMix.summary.gridPercent,
        generatorPercent: energyMix.summary.generatorPercent,
        matchedIntervals: energyMix.summary.matchedIntervals,
        expectedIntervals: energyMix.summary.expectedIntervals,
        coveragePercent: energyMix.summary.coveragePercent
      },
      buckets,
      warnings: Array.from(new Set(warnings))
    };

    this.cachedRevenueAnalysis.set(cacheKey, {
      value: result,
      expiresAt: now + Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS)
    });
    await this.retainSnapshot(`revenue-v4:${cacheKey}`, result, result.dataSource.retrievedAt);
    return result;
  }

  async getFloorAnalysis(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaFloorAnalysis> {
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedFloorAnalysis.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return this.asCached(cached.value);
    }

    const snapshotKey = `floors-v2:${cacheKey}`;
    if (!forceRefresh) {
      const retained = await this.getRetainedSnapshot<SteamaFloorAnalysis>(snapshotKey);
      if (retained) {
        if (this.snapshotIsStale(retained.retrievedAt, Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS))) {
          this.refreshInBackground(snapshotKey, () => this.buildFloorAnalysis(period, true, customRange));
        }
        return this.asCached(retained.value);
      }
    }

    return this.runSingleFlight(snapshotKey, () => this.buildFloorAnalysis(period, forceRefresh, customRange));
  }

  private async buildFloorAnalysis(
    period: EnergyMixPeriod,
    forceRefresh = false,
    customRange?: EnergyMixDateRange
  ): Promise<SteamaFloorAnalysis> {
    const now = Date.now();
    const cacheKey = `${period}:${customRange?.from ?? 'preset'}:${customRange?.to ?? 'preset'}`;
    const cached = this.cachedFloorAnalysis.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      return { ...cached.value, dataSource: { ...cached.value.dataSource, cached: true } };
    }

    const range = resolveEnergyMixRange(now, period, customRange);
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
      throw new Error('invalid_floor_analysis_range');
    }

    const overview = await this.getOverview(forceRefresh);
    const metersByCustomer = new Map<string, SteamaMeterSummary[]>();
    for (const meter of overview.meters) {
      if (!meter.customerId) continue;
      const customerMeters = metersByCustomer.get(meter.customerId) ?? [];
      customerMeters.push(meter);
      metersByCustomer.set(meter.customerId, customerMeters);
    }

    const positionInputs = overview.customers.flatMap((customer) => {
      const customerMeters = metersByCustomer.get(customer.providerId) ?? [];
      const sourceAccount = /^power\s*room$/i.test(customer.firstName) || customerMeters.some((meter) =>
        ['solar_source', 'grid_source', 'generator_source'].includes(meter.operationalRole)
      );
      if (sourceAccount) return [];
      return [{ customer, customerMeters, identity: classifyFloorPosition(customer.firstName, customer.displayName) }];
    });

    const observedAt = new Date(now).toISOString();
    const tenancyTimelines = await Promise.all(
      positionInputs.map(({ customer, identity }) =>
        this.floorTenancyRepository.observeProviderPosition({
          providerCustomerId: customer.providerId,
          siteKey: 'na-aka-hub',
          floorKey: identity.floorKey,
          floorLevel: identity.floorLevel,
          positionLabel: identity.positionLabel,
          providerPositionName: customer.firstName || customer.displayName,
          mappingEvidence: identity.mappingEvidence,
          providerTenantName: customer.lastName,
          observedAt
        })
      )
    );
    const tenancyTimelineByCustomer = new Map(
      tenancyTimelines.map((timeline) => [timeline.providerCustomerId, timeline])
    );

    const meterRequests = positionInputs.flatMap(({ customer, customerMeters }) =>
      customerMeters.map((meter) => ({ customerId: customer.providerId, meter }))
    );
    const historyResults = await Promise.allSettled(
      meterRequests.map(async ({ meter }) => ({
        meterId: meter.providerId,
        usage: await this.getAuthoritativeMeterUsage(meter, range.start, range.end, forceRefresh)
      }))
    );
    const historiesByMeter = new Map<string, AuthoritativeMeterUsage>();
    let unavailableMeterCount = 0;
    historyResults.forEach((result, index) => {
      const meterId = meterRequests[index]?.meter.providerId;
      if (!meterId) return;
      if (result.status === 'fulfilled') historiesByMeter.set(meterId, result.value.usage);
      else unavailableMeterCount += 1;
    });

    const expectedHours = Math.max(0, Math.round((range.end - range.start) / HOUR_MS));
    const buckets = createFloorUsageBuckets(period, range.start, range.end);
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const positions: SteamaFloorPositionUsage[] = [];

    for (const { customer, customerMeters, identity } of positionInputs) {
      const uniqueReadings: Array<
        AuthoritativeDirectiveReading & { meterId: string; recordedInterval: boolean }
      > = [];
      let observedIntervalCount = 0;
      for (const meter of customerMeters) {
        const meterUsage = historiesByMeter.get(meter.providerId);
        const meterIntervals = new Map<string, AuthoritativeDirectiveReading>();
        for (const reading of meterUsage?.readings ?? []) {
          meterIntervals.set(reading.intervalStart, reading);
        }
        observedIntervalCount += meterUsage?.recordedIntervalKeys.size ?? 0;
        for (const reading of meterIntervals.values()) {
          uniqueReadings.push({
            ...reading,
            meterId: meter.providerId,
            recordedInterval: meterUsage?.recordedIntervalKeys.has(reading.intervalStart) ?? false
          });
          const intervalMs = new Date(reading.intervalStart).getTime();
          const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(intervalMs, period)).toISOString());
          const floorValue = bucket?.floors.find((entry) => entry.floorKey === identity.floorKey);
          if (bucket && floorValue) {
            floorValue.usageKwh += reading.usageKwh;
            bucket.totalKwh += reading.usageKwh;
            bucket.registerRecoveredKwh += reading.registerRecoveredKwh;
          }
        }
      }

      uniqueReadings.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      const usageKwh = roundEnergy(uniqueReadings.reduce((sum, reading) => sum + reading.usageKwh, 0));
      const registerRecoveredKwh = roundEnergy(
        uniqueReadings.reduce((sum, reading) => sum + reading.registerRecoveredKwh, 0)
      );
      const expectedIntervals = expectedHours * customerMeters.length;
      const tenancyTimeline = tenancyTimelineByCustomer.get(customer.providerId);
      const attributionByKey = new Map<string, {
        tenantName: string;
        source: 'provider_snapshot' | 'management_record' | 'unattributed';
        effectiveFrom: string | null;
        effectiveTo: string | null;
        usageKwh: number;
        observedIntervals: number;
      }>();
      const addAttribution = (
        key: string,
        details: {
          tenantName: string;
          source: 'provider_snapshot' | 'management_record' | 'unattributed';
          effectiveFrom: string | null;
          effectiveTo: string | null;
        },
        usage: number,
        observed: boolean
      ): void => {
        const item = attributionByKey.get(key) ?? {
          ...details,
          usageKwh: 0,
          observedIntervals: 0
        };
        item.usageKwh += usage;
        if (observed) item.observedIntervals += 1;
        attributionByKey.set(key, item);
      };
      for (const reading of uniqueReadings) {
        const intervalMs = new Date(reading.intervalStart).getTime();
        const tenancy = tenancyTimeline?.tenancies.find((entry) => {
          const fromMs = new Date(entry.effectiveFrom).getTime();
          const toMs = entry.effectiveTo ? new Date(entry.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
          return intervalMs >= fromMs && intervalMs < toMs;
        });
        if (reading.recordedInterval) {
          addAttribution(
            tenancy?.id ?? 'unattributed',
            {
              tenantName: tenancy?.tenantName ?? 'Historical tenant not recorded',
              source: tenancy?.source ?? 'unattributed',
              effectiveFrom: tenancy?.effectiveFrom ?? null,
              effectiveTo: tenancy?.effectiveTo ?? null
            },
            reading.recordedUsageKwh,
            true
          );
        }
        if (reading.registerRecoveredKwh > 0) {
          addAttribution(
            'register-recovery-unattributed',
            {
              tenantName: 'Connectivity-gap energy (original hour unknown)',
              source: 'unattributed',
              effectiveFrom: null,
              effectiveTo: null
            },
            reading.registerRecoveredKwh,
            false
          );
        }
      }
      const tenantUsage = Array.from(attributionByKey.values()).map((item) => ({
        ...item,
        usageKwh: roundEnergy(item.usageKwh),
        estimatedValueNgn: roundMoney(item.usageKwh * this.retailTariffNgnPerKwh)
      }));
      const attributedUsageKwh = roundEnergy(
        tenantUsage.filter((item) => item.source !== 'unattributed').reduce((sum, item) => sum + item.usageKwh, 0)
      );
      const unattributedUsageKwh = roundEnergy(Math.max(0, usageKwh - attributedUsageKwh));
      const attributedIntervals = tenantUsage
        .filter((item) => item.source !== 'unattributed')
        .reduce((sum, item) => sum + item.observedIntervals, 0);
      const tenantName = tenancyTimeline?.currentTenantName || customer.lastName || 'No tenant recorded';
      positions.push({
        customerId: customer.providerId,
        providerPositionName: customer.firstName || customer.displayName,
        positionLabel: identity.positionLabel,
        tenantName,
        providerTenantName: customer.lastName,
        tenantRecordSource: tenancyTimeline?.currentTenantSource ?? null,
        providerTenantDrift: tenancyTimeline?.providerDrift ?? false,
        historyTrackedFrom: tenancyTimeline?.historyTrackedFrom ?? null,
        tenancyHistory: tenancyTimeline?.tenancies ?? [],
        tenantUsage,
        attributedUsageKwh,
        unattributedUsageKwh,
        tenantAttributionCoveragePercent: observedIntervalCount > 0
          ? roundPercent((attributedIntervals / observedIntervalCount) * 100)
          : 0,
        occupancyStatus: tenantName === 'No tenant recorded'
          ? 'not_recorded'
          : isEstatePlaceholder(tenantName)
            ? 'estate_placeholder'
            : 'named_tenant',
        floorKey: identity.floorKey,
        floorLabel: identity.floorLabel,
        floorLevel: identity.floorLevel,
        mappingEvidence: identity.mappingEvidence,
        meterIds: customerMeters.map((meter) => meter.providerId),
        meterNumbers: customerMeters.map((meter) => meter.meterNumber).filter(Boolean),
        meterCount: customerMeters.length,
        onlineMeterCount: customerMeters.filter((meter) => meter.connectivity === 'online').length,
        usageKwh,
        registerRecoveredKwh,
        estimatedValueNgn: roundMoney(usageKwh * this.retailTariffNgnPerKwh),
        observedIntervals: observedIntervalCount,
        expectedIntervals,
        coveragePercent: expectedIntervals > 0
          ? roundPercent((observedIntervalCount / expectedIntervals) * 100)
          : 0,
        firstReadingAt: uniqueReadings[0]?.timestamp ?? null,
        latestReadingAt: uniqueReadings.at(-1)?.timestamp ?? null
      });
    }

    for (const bucket of buckets) {
      bucket.totalKwh = roundEnergy(bucket.totalKwh);
      bucket.registerRecoveredKwh = roundEnergy(bucket.registerRecoveredKwh);
      for (const floor of bucket.floors) floor.usageKwh = roundEnergy(floor.usageKwh);
    }

    positions.sort((left, right) =>
      (left.floorLevel ?? 99) - (right.floorLevel ?? 99) || left.positionLabel.localeCompare(right.positionLabel)
    );
    const totalUsageKwh = roundEnergy(positions.reduce((sum, position) => sum + position.usageKwh, 0));
    const unclassifiedUsageKwh = roundEnergy(
      positions.filter((position) => position.floorKey === 'unclassified').reduce((sum, position) => sum + position.usageKwh, 0)
    );
    const createFloorSummary = (
      key: SteamaFloorKey,
      label: string,
      level: number | null
    ): SteamaFloorUsageSummary => {
      const floorPositions = positions.filter((position) => position.floorKey === key);
      const usageKwh = roundEnergy(floorPositions.reduce((sum, position) => sum + position.usageKwh, 0));
      const registerRecoveredKwh = roundEnergy(
        floorPositions.reduce((sum, position) => sum + position.registerRecoveredKwh, 0)
      );
      const attributedUsageKwh = roundEnergy(
        floorPositions.reduce((sum, position) => sum + position.attributedUsageKwh, 0)
      );
      const unattributedUsageKwh = roundEnergy(Math.max(0, usageKwh - attributedUsageKwh));
      const observedIntervals = floorPositions.reduce((sum, position) => sum + position.observedIntervals, 0);
      const expectedIntervals = floorPositions.reduce((sum, position) => sum + position.expectedIntervals, 0);
      return {
        key,
        label,
        level,
        positionCount: floorPositions.length,
        meteredPositionCount: floorPositions.filter((position) => position.meterCount > 0).length,
        reportingPositionCount: floorPositions.filter((position) => position.observedIntervals > 0).length,
        meterCount: floorPositions.reduce((sum, position) => sum + position.meterCount, 0),
        onlineMeterCount: floorPositions.reduce((sum, position) => sum + position.onlineMeterCount, 0),
        usageKwh,
        registerRecoveredKwh,
        attributedUsageKwh,
        unattributedUsageKwh,
        tenantAttributionCoveragePercent: usageKwh > 0
          ? roundPercent((attributedUsageKwh / usageKwh) * 100)
          : 0,
        sharePercent: totalUsageKwh > 0 ? roundPercent((usageKwh / totalUsageKwh) * 100) : 0,
        estimatedValueNgn: roundMoney(usageKwh * this.retailTariffNgnPerKwh),
        observedIntervals,
        expectedIntervals,
        coveragePercent: expectedIntervals > 0 ? roundPercent((observedIntervals / expectedIntervals) * 100) : 0
      };
    };
    const floors: SteamaFloorUsageSummary[] = FLOOR_DEFINITIONS.map((floor) =>
      createFloorSummary(floor.key, floor.label, floor.level)
    );
    if (positions.some((position) => position.floorKey === 'unclassified')) {
      floors.push(createFloorSummary('unclassified', 'Unclassified', null));
    }

    const observedIntervals = positions.reduce((sum, position) => sum + position.observedIntervals, 0);
    const expectedIntervals = positions.reduce((sum, position) => sum + position.expectedIntervals, 0);
    const attributedUsageKwh = roundEnergy(positions.reduce((sum, position) => sum + position.attributedUsageKwh, 0));
    const unattributedUsageKwh = roundEnergy(Math.max(0, totalUsageKwh - attributedUsageKwh));
    const registerRecoveredKwh = roundEnergy(
      positions.reduce((sum, position) => sum + position.registerRecoveredKwh, 0)
    );
    const registerRecoveryEvents = Array.from(historiesByMeter.values()).reduce(
      (sum, history) => sum + history.recoveryEvents.length,
      0
    );
    const warnings = [
      'Floor consumption uses recorded intervals plus cumulative-register movement recovered after connectivity gaps; recovered energy is kept unattributed when its original hour is unknown.',
      'The first name is treated as the permanent floor or unit position and the last name as the current tenant snapshot.',
      'Tenant history begins when MSM first observes a position or when management records an earlier effective date; earlier usage remains explicitly unattributed.',
      'Legacy position codes are interpreted using the observed Na-Aka Hub convention: G codes are Ground Floor, F0 codes are First Floor, and F2–F5 identify Floors 2–5.',
      'SteamaCo exposes limited timestamped interval history; cumulative-register recovery preserves total energy but cannot reconstruct the original missing hours.',
      'Estimated Naira values use the provisional MSM retail rate and are not cash collections.'
    ];
    if (registerRecoveredKwh > 0) {
      warnings.unshift(
        `${registerRecoveredKwh.toFixed(2)} kWh was recovered from ${registerRecoveryEvents} customer-meter register movement event(s).`
      );
    }
    if (positions.some((position) => position.floorKey === 'unclassified')) {
      warnings.push('Some customer positions could not be classified from their current names and remain in the Unclassified group.');
    }
    if (unavailableMeterCount > 0) {
      warnings.push(`${unavailableMeterCount} assigned meter reading request(s) were unavailable during this refresh.`);
    }
    if (positions.some((position) => position.meterCount === 0)) {
      warnings.push('Positions without an assigned meter remain visible but contribute no energy until a provider assignment exists.');
    }
    if (positions.some((position) => position.providerTenantDrift)) {
      warnings.push('A SteamaCo tenant-name change differs from an approved MSM tenancy record and requires management review.');
    }

    const result: SteamaFloorAnalysis = {
      dataSource: {
        provider: 'SteamaCo',
        mode: 'live_read_only',
        retrievedAt: new Date(now).toISOString(),
        scope: 'provider_customer_meter_directives',
        cached: false
      },
      site: { name: 'Na-Aka Hub', structure: 'Ground floor plus Floors 1–5' },
      period,
      range: {
        from: new Date(range.start).toISOString(),
        to: new Date(range.end).toISOString(),
        timezone: 'Africa/Lagos'
      },
      tariff: {
        retailNgnPerKwh: this.retailTariffNgnPerKwh,
        currency: 'NGN',
        status: 'provisional'
      },
      summary: {
        totalPositions: positions.length,
        classifiedPositions: positions.filter((position) => position.floorKey !== 'unclassified').length,
        unclassifiedPositions: positions.filter((position) => position.floorKey === 'unclassified').length,
        meteredPositions: positions.filter((position) => position.meterCount > 0).length,
        reportingPositions: positions.filter((position) => position.observedIntervals > 0).length,
        totalMeters: positions.reduce((sum, position) => sum + position.meterCount, 0),
        onlineMeters: positions.reduce((sum, position) => sum + position.onlineMeterCount, 0),
        totalUsageKwh,
        registerRecoveredKwh,
        registerRecoveryEvents,
        attributedUsageKwh,
        unattributedUsageKwh,
        tenantAttributionCoveragePercent: totalUsageKwh > 0
          ? roundPercent((attributedUsageKwh / totalUsageKwh) * 100)
          : 0,
        classifiedUsageKwh: roundEnergy(totalUsageKwh - unclassifiedUsageKwh),
        unclassifiedUsageKwh,
        estimatedValueNgn: roundMoney(totalUsageKwh * this.retailTariffNgnPerKwh),
        observedIntervals,
        expectedIntervals,
        coveragePercent: expectedIntervals > 0 ? roundPercent((observedIntervals / expectedIntervals) * 100) : 0
      },
      floors,
      positions,
      buckets,
      warnings: Array.from(new Set(warnings))
    };

    this.cachedFloorAnalysis.set(cacheKey, {
      value: result,
      expiresAt: now + Math.max(this.cacheTtlMs, ENERGY_MIX_CACHE_TTL_MS)
    });
    await this.retainSnapshot(`floors-v2:${cacheKey}`, result, result.dataSource.retrievedAt);
    return result;
  }

  async getCustomer(providerId: string): Promise<SteamaCustomerDetail> {
    const snapshotKey = `customer:${providerId}`;
    const retained = await this.getRetainedSnapshot<SteamaCustomerDetail>(snapshotKey);
    if (retained) {
      if (this.snapshotIsStale(retained.retrievedAt, this.cacheTtlMs)) {
        this.refreshInBackground(snapshotKey, () => this.buildCustomer(providerId));
      }
      return retained.value;
    }
    return this.runSingleFlight(snapshotKey, () => this.buildCustomer(providerId));
  }

  private async buildCustomer(providerId: string): Promise<SteamaCustomerDetail> {
    const [customerPayload, balancesPayload, transactionsPayload, metersPayload] = await Promise.all([
      this.client.request<unknown>({ path: `/customers/${providerId}/` }),
      this.client.request<unknown>({ path: `/customers/${providerId}/balances/`, query: { page_size: 500 } }),
      this.client.request<unknown>({ path: `/customers/${providerId}/transactions/`, query: { page_size: 500 } }),
      this.client.request<unknown>({ path: `/customers/${providerId}/meters/`, query: { page_size: 100 } })
    ]);
    if (!isObject(customerPayload)) throw new Error('provider_customer_invalid_response');

    const meterRecords = asCollection(metersPayload).records;
    const meterNumbers = meterRecords
      .map((record) => stringValue(firstValue(record, ['reference', 'meter_number', 'number'])))
      .filter(Boolean);
    const summary = normalizeCustomer(customerPayload, new Map([[providerId, meterNumbers]]));
    const balances = asCollection(balancesPayload).records
      .map((record) => ({
        timestamp: isoDateValue(firstValue(record, ['timestamp', 'created_at', 'created'])) ?? '',
        accountBalance: numberValue(firstValue(record, ['account_balance', 'balance']))
      }))
      .filter((point): point is { timestamp: string; accountBalance: number } => Boolean(point.timestamp) && point.accountBalance !== null)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const transactions = asCollection(transactionsPayload).records
      .map(normalizeCustomerTransaction)
      .filter((transaction) => Boolean(transaction.timestamp))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const chronological = [...transactions].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const usageCharges = transactions.filter((transaction) => transaction.category.toUpperCase() === 'UCH');
    const payments = transactions.filter((transaction) => transaction.category.toUpperCase() === 'PAY');

    const result: SteamaCustomerDetail = {
      ...summary,
      meters: meterRecords.map((record) => ({
        providerId: stringValue(firstValue(record, ['id', 'pk', 'provider_id'])),
        meterNumber: stringValue(firstValue(record, ['reference', 'meter_number', 'number'])),
        name: stringValue(firstValue(record, ['name', 'display_name', 'label'])) || stringValue(firstValue(record, ['reference']))
      })),
      balances,
      transactions,
      transactionSummary: {
        retrievedCount: transactions.length,
        totalAmount: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
        usageChargeAmount: usageCharges.reduce((sum, transaction) => sum + transaction.amount, 0),
        paymentAmount: payments.reduce((sum, transaction) => sum + transaction.amount, 0),
        from: chronological[0]?.timestamp ?? null,
        to: chronological.at(-1)?.timestamp ?? null
      },
      warnings: [
        'The provider returns at most the requested transaction page; totals shown here describe only the retrieved window.',
        ...(summary.accountBalance !== null && summary.accountBalance < 0
          ? ['A negative account balance means provider-posted charges currently exceed credited payments on this account.']
          : [])
      ]
    };
    await this.retainSnapshot(`customer:${providerId}`, result, new Date().toISOString());
    return result;
  }

  private async getReadingWindow(forceRefresh: boolean, persist = true): Promise<SteamaMeterReadingPoint[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedReadingWindow && this.cachedReadingWindow.expiresAt > now) {
      return this.cachedReadingWindow.value;
    }

    const sites = asCollection(await this.client.request<unknown>({ path: '/sites/', query: { page_size: 100 } })).records;
    const readings: SteamaMeterReadingPoint[] = [];
    for (const site of sites) {
      const siteId = providerIdValue(firstValue(site, ['id', 'url']));
      if (!siteId) continue;
      const utilities = asCollection(
        await this.client.request<unknown>({ path: `/sites/${siteId}/utilities/`, query: { page_size: 100 } })
      ).records;
      for (const utility of utilities) {
        const utilityId = providerIdValue(firstValue(utility, ['id', 'url']));
        if (!utilityId) continue;
        const records = await this.getPagedRecords(`/sites/${siteId}/utilities/${utilityId}/readings/`, 1000);
        for (const record of records) {
          const reading = normalizeReading(record);
          if (reading) readings.push(reading);
        }
      }
    }

    if (persist && this.meterArchiveRepository) {
      await this.meterArchiveRepository.upsertReadings(this.toArchiveReadings(readings, 'utility_reading'));
    }

    this.cachedReadingWindow = { value: readings, expiresAt: now + this.cacheTtlMs };
    return readings;
  }

  private async getDirectiveMeterReadings(
    meter: Pick<SteamaMeterSummary, 'providerId' | 'meterNumber' | 'customerId' | 'customerName'>,
    rangeStartMs: number,
    rangeEndMs: number,
    forceRefresh: boolean,
    allowArchivedFallback = true
  ): Promise<DirectiveReading[]> {
    const providerId = meter.providerId;
    const from = new Date(rangeStartMs).toISOString();
    const to = new Date(rangeEndMs).toISOString();
    const archived = this.meterArchiveRepository
      ? await this.meterArchiveRepository.listUsageIntervals(providerId, from, to)
      : [];
    if (archived.length > 0 && !forceRefresh) return archived;

    const records: JsonObject[] = [];
    let providerReadings: DirectiveReading[];
    try {
      let page = 1;
      let pageCount = 1;
      do {
        const payload = await this.client.request<unknown>({
          path: `/meters/${providerId}/directives/`,
          query: {
            nature: 'MR',
            created_after: new Date(rangeStartMs).toISOString(),
            created_before: new Date(rangeEndMs + 10 * 60_000).toISOString(),
            sort_by: '-timestamp',
            page_size: DIRECTIVE_PAGE_SIZE,
            page
          }
        });
        const collection = asCollection(payload);
        records.push(...collection.records);
        pageCount = Math.max(1, Math.ceil(collection.count / DIRECTIVE_PAGE_SIZE));
        page += 1;
      } while (page <= pageCount && page <= 100);

      providerReadings = records.flatMap((record): DirectiveReading[] => {
        const timestamp = isoDateValue(firstValue(record, ['timestamp', 'message_timestamp', 'created_at']));
        if (!timestamp) return [];
        const data = parseDirectiveData(firstValue(record, ['data', 'payload', 'message_data']));
        const usageKwh = numberValue(firstValue(data, ['usage_amount', 'usage', 'usage_kwh']));
        if (usageKwh === null || usageKwh < 0) return [];
        const intervalStartMs = floorHour(new Date(timestamp).getTime()) - HOUR_MS;
        if (intervalStartMs < rangeStartMs || intervalStartMs >= rangeEndMs) return [];
        return [{ timestamp, intervalStart: new Date(intervalStartMs).toISOString(), usageKwh }];
      });
    } catch (error) {
      if (allowArchivedFallback && archived.length > 0) return archived;
      throw error;
    }

    if (this.meterArchiveRepository && providerReadings.length > 0) {
      await this.meterArchiveRepository.upsertReadings(
        providerReadings.map((reading) => ({
          timestamp: reading.timestamp,
          intervalStart: reading.intervalStart,
          readingKwh: null,
          usageKwh: reading.usageKwh,
          anomalous: false,
          meterId: providerId,
          meterNumber: meter.meterNumber,
          customerId: meter.customerId,
          customerName: meter.customerName,
          source: 'meter_directive' as const
        }))
      );
      return this.meterArchiveRepository.listUsageIntervals(providerId, from, to);
    }
    return providerReadings;
  }

  private async getAuthoritativeMeterUsage(
    meter: Pick<
      SteamaMeterSummary,
      'providerId' | 'meterNumber' | 'customerId' | 'customerName' | 'latestReadingKwh' | 'lastReadingAt'
    >,
    rangeStartMs: number,
    rangeEndMs: number,
    forceRefresh: boolean
  ): Promise<AuthoritativeMeterUsage> {
    const recordedReadings = await this.getDirectiveMeterReadings(
      meter,
      rangeStartMs,
      rangeEndMs,
      forceRefresh
    );
    if (!this.meterArchiveRepository) {
      return {
        readings: recordedReadings.map((reading) => ({
          ...reading,
          recordedUsageKwh: reading.usageKwh,
          registerRecoveredKwh: 0
        })),
        recordedUsageKwh: roundEnergy(recordedReadings.reduce((sum, reading) => sum + reading.usageKwh, 0)),
        registerRecoveredKwh: 0,
        recoveryEvents: [],
        ignoredRegisterDrops: 0,
        ignoredAnomalousReadings: 0,
        intervalExcessEvents: 0,
        recordedIntervalKeys: new Set(recordedReadings.map((reading) => reading.intervalStart))
      };
    }

    const from = new Date(rangeStartMs).toISOString();
    const to = new Date(rangeEndMs).toISOString();
    const archivedRegisterReadings = await this.meterArchiveRepository.listRegisterReadings(
      meter.providerId,
      from,
      to
    );
    const registerByTimestamp = new Map(
      archivedRegisterReadings.map((reading) => [reading.timestamp, reading])
    );
    if (
      meter.latestReadingKwh !== null &&
      meter.lastReadingAt &&
      Number.isFinite(new Date(meter.lastReadingAt).getTime()) &&
      new Date(meter.lastReadingAt).getTime() < rangeEndMs
    ) {
      registerByTimestamp.set(meter.lastReadingAt, {
        timestamp: meter.lastReadingAt,
        readingKwh: meter.latestReadingKwh,
        anomalous: false
      });
    }

    const recovery = recoverUsageFromRegister({
      intervals: recordedReadings,
      registerReadings: Array.from(registerByTimestamp.values()),
      baseline: this.registerBaselineFor(meter),
      rangeStartMs,
      rangeEndMs
    });
    return {
      ...recovery,
      recordedIntervalKeys: new Set(recordedReadings.map((reading) => reading.intervalStart)),
      readings: recovery.intervals.map((reading: ReconciledUsageInterval) => ({
        timestamp: reading.timestamp,
        intervalStart: reading.intervalStart,
        usageKwh: reading.usageKwh,
        recordedUsageKwh: reading.recordedUsageKwh,
        registerRecoveredKwh: reading.registerRecoveredKwh
      }))
    };
  }

  private toArchiveReadings(
    readings: SteamaMeterReadingPoint[],
    source: MeterArchiveReadingInput['source']
  ): MeterArchiveReadingInput[] {
    return readings.flatMap((reading) => {
      if (!reading.meterId || (reading.readingKwh === null && reading.usageKwh === null)) return [];
      const intervalStart = reading.usageKwh === null
        ? null
        : new Date(floorHour(new Date(reading.timestamp).getTime()) - HOUR_MS).toISOString();
      return [{ ...reading, source, intervalStart }];
    });
  }

  private async getPagedRecords(path: string, pageSize: number): Promise<JsonObject[]> {
    const records: JsonObject[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const payload = await this.client.request<unknown>({ path, query: { page_size: pageSize, page } });
      const collection = asCollection(payload);
      records.push(...collection.records);
      pageCount = Math.max(1, Math.ceil(collection.count / pageSize));
      page += 1;
    } while (page <= pageCount && page <= 100);
    return records;
  }

  private async getProviderTransactions(category: 'UCH' | 'PAY', rangeStartMs: number): Promise<SteamaCustomerTransaction[]> {
    const requestKey = `transactions:${category}:${rangeStartMs}`;
    return this.runSingleFlight(requestKey, async () => {
      const rangeStart = new Date(rangeStartMs).toISOString();
      const rangeEnd = new Date(Date.now() + HOUR_MS).toISOString();
      const archived = this.meterArchiveRepository
        ? await this.meterArchiveRepository.listTransactions(category, rangeStart, rangeEnd)
        : [];
      let providerTransactions: SteamaCustomerTransaction[] = [];
      try {
        providerTransactions = await this.fetchProviderTransactionsFromProvider(category, rangeStartMs);
      } catch (error) {
        if (archived.length > 0) return archived;
        throw error;
      }
      if (!this.meterArchiveRepository) return providerTransactions;
      await this.meterArchiveRepository.upsertTransactions(
        providerTransactions.map((transaction) => ({ ...transaction, category }))
      );
      const merged = new Map<string, SteamaCustomerTransaction>();
      for (const transaction of [...archived, ...providerTransactions]) {
        const key = transaction.providerId || `${category}:${transaction.timestamp}:${transaction.customerId}:${transaction.amount}:${transaction.reference}`;
        merged.set(key, transaction);
      }
      return Array.from(merged.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    });
  }

  private async fetchProviderTransactionsFromProvider(category: 'UCH' | 'PAY', rangeStartMs: number): Promise<SteamaCustomerTransaction[]> {
    const records: JsonObject[] = [];
    let page = 1;
    let pageCount = 1;

    do {
      const payload = await this.client.request<unknown>({
        path: '/transactions/',
        query: {
          category,
          created_after: new Date(rangeStartMs).toISOString(),
          page_size: DIRECTIVE_PAGE_SIZE,
          page
        }
      });
      const collection = asCollection(payload);
      records.push(...collection.records);
      pageCount = Math.max(1, Math.ceil(collection.count / DIRECTIVE_PAGE_SIZE));
      page += 1;
    } while (page <= pageCount && page <= 100);

    return records
      .map(normalizeCustomerTransaction)
      .filter((transaction) => transaction.category.toUpperCase() === category && Boolean(transaction.timestamp));
  }

  private asCached<T extends { dataSource: { cached: boolean } }>(value: T): T {
    return {
      ...value,
      dataSource: { ...value.dataSource, cached: true }
    };
  }

  private snapshotIsStale(retrievedAt: string, ttlMs: number): boolean {
    const retrievedAtMs = new Date(retrievedAt).getTime();
    return !Number.isFinite(retrievedAtMs) || retrievedAtMs + ttlMs <= Date.now();
  }

  private async getRetainedSnapshot<T>(
    key: string
  ): Promise<{ value: T; retrievedAt: string } | null> {
    if (!this.meterArchiveRepository) return null;
    try {
      return await this.meterArchiveRepository.getOperationalSnapshot<T>(key);
    } catch {
      return null;
    }
  }

  private async retainSnapshot<T>(key: string, value: T, retrievedAt: string): Promise<void> {
    if (!this.meterArchiveRepository) return;
    try {
      await this.meterArchiveRepository.saveOperationalSnapshot(key, value, retrievedAt);
    } catch {
      // A snapshot write must never make the live read-only page fail.
    }
  }

  private runSingleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const current = this.inFlightRequests.get(key) as Promise<T> | undefined;
    if (current) return current;

    const request = operation();
    this.inFlightRequests.set(key, request);
    void request.then(
      () => {
        if (this.inFlightRequests.get(key) === request) this.inFlightRequests.delete(key);
      },
      () => {
        if (this.inFlightRequests.get(key) === request) this.inFlightRequests.delete(key);
      }
    );
    return request;
  }

  private refreshInBackground<T>(key: string, operation: () => Promise<T>): void {
    void this.runSingleFlight(key, operation).catch(() => undefined);
  }
}
