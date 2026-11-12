import type { SteamaReadOnlyRequest } from './steamaReadOnlyClient.js';
import type {
  CountSeriesItem,
  EnergyMixPeriod,
  MeterConnectivity,
  MeterFreshnessBucket,
  MeterOperationalRole,
  SteamaCustomerDetail,
  SteamaCustomerSummary,
  SteamaCustomerTransaction,
  SteamaEnergyMix,
  SteamaEnergyMixBucket,
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
  SteamaRevenueBucket
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
}

interface DirectiveReading {
  timestamp: string;
  intervalStart: string;
  usageKwh: number;
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
    floors: floorKeys.map((floorKey) => ({ floorKey, usageKwh: 0 }))
  }));
};

const normalizeCustomerTransaction = (record: JsonObject) => ({
  providerId: stringValue(firstValue(record, ['id', 'pk', 'provider_id'])),
  timestamp: isoDateValue(firstValue(record, ['timestamp', 'created_at', 'created'])) ?? '',
  category: stringValue(firstValue(record, ['category', 'type'])) || 'Unknown',
  amount: numberValue(firstValue(record, ['amount'])) ?? 0,
  accountBalance: numberValue(firstValue(record, ['account_balance', 'balance'])),
  meterNumber: stringValue(firstValue(record, ['meter_number', 'meter_reference'])),
  reference: stringValue(firstValue(record, ['reference']))
});

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
  private readonly retailTariffNgnPerKwh: number;
  private readonly tariffEffectiveFrom: string | null;

  constructor(
    private readonly client: SteamaReadOnlyRequester,
    private readonly cacheTtlMs = 60_000,
    options: SteamaOperationsOptions = {}
  ) {
    this.retailTariffNgnPerKwh = options.retailTariffNgnPerKwh ?? 203;
    this.tariffEffectiveFrom = options.tariffEffectiveFrom ?? null;
  }

  async getOverview(forceRefresh = false): Promise<SteamaOperationsOverview> {
    if (!forceRefresh && this.cachedOverview && this.cachedOverview.expiresAt > Date.now()) {
      return {
        ...this.cachedOverview.value,
        dataSource: { ...this.cachedOverview.value.dataSource, cached: true }
      };
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
    const meters = meterCollection.records.map((record) => normalizeMeter(record, now));
    const meterNumbersByCustomer = new Map<string, string[]>();
    for (const meter of meters) {
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
    const [meter, readingWindow] = await Promise.all([
      this.getMeter(providerId),
      this.getReadingWindow(forceRefresh)
    ]);
    const readings = readingWindow
      .filter((reading) => reading.meterId === providerId || reading.meterNumber === meter.meterNumber)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const first = readings[0] ?? null;
    const latest = readings.at(-1) ?? null;
    const usageValues = readings.map((reading) => reading.usageKwh).filter((value): value is number => value !== null);
    const negativeValues = readings.some(
      (reading) => (reading.readingKwh !== null && reading.readingKwh < 0) || (reading.usageKwh !== null && reading.usageKwh < 0)
    );
    const warnings = [
      'The provider reading endpoint exposes a recent window; it is not yet a certified complete historical archive.'
    ];
    if (readings.length === 0) warnings.push('No reading was returned for this meter in the current provider window.');
    if (negativeValues) warnings.push('Negative meter data is present and must be reviewed before interpretation.');

    return {
      dataSource: {
        provider: 'SteamaCo',
        mode: 'live_read_only',
        retrievedAt: new Date().toISOString(),
        scope: 'provider_recent_window'
      },
      meter: { providerId, meterNumber: meter.meterNumber, name: meter.name },
      coverage: {
        from: first?.timestamp ?? null,
        to: latest?.timestamp ?? null,
        readingCount: readings.length
      },
      summary: {
        firstReadingKwh: first?.readingKwh ?? null,
        latestReadingKwh: latest?.readingKwh ?? null,
        registerChangeKwh:
          first?.readingKwh !== null && first?.readingKwh !== undefined && latest?.readingKwh !== null && latest?.readingKwh !== undefined
            ? latest.readingKwh - first.readingKwh
            : null,
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
        readings: await this.getDirectiveMeterReadings(meter.providerId, rangeStartMs, rangeEndMs)
      }))
    );

    const roleIntervals = {
      solar_source: new Map<string, number>(),
      grid_source: new Map<string, number>(),
      generator_source: new Map<string, number>()
    };
    const sourceSummaries: SteamaEnergyMixSourceMeter[] = [];

    for (const history of histories) {
      const meterIntervals = new Map<string, DirectiveReading>();
      for (const reading of history.readings) {
        meterIntervals.set(reading.intervalStart, reading);
      }
      for (const [intervalStart, reading] of meterIntervals) {
        const roleMap = roleIntervals[history.meter.operationalRole];
        roleMap.set(intervalStart, (roleMap.get(intervalStart) ?? 0) + reading.usageKwh);
      }

      const ordered = Array.from(meterIntervals.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      sourceSummaries.push({
        providerId: history.meter.providerId,
        meterNumber: history.meter.meterNumber,
        name: history.meter.name,
        role: history.meter.operationalRole,
        observedIntervals: meterIntervals.size,
        firstReadingAt: ordered[0]?.timestamp ?? null,
        latestReadingAt: ordered.at(-1)?.timestamp ?? null
      });
    }

    const buckets = createEnergyBuckets(period, rangeStartMs, rangeEndMs);
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const generatorConfigured = sourceMeters.some((meter) => meter.operationalRole === 'generator_source');
    const requiredRoleMaps = [roleIntervals.solar_source, roleIntervals.grid_source];
    if (generatorConfigured) requiredRoleMaps.push(roleIntervals.generator_source);
    const matchedIntervalKeys = Array.from(roleIntervals.solar_source.keys()).filter((key) =>
      requiredRoleMaps.every((roleMap) => roleMap.has(key))
    );

    let solarKwh = 0;
    let gridKwh = 0;
    let generatorKwh = 0;
    let generatorActiveIntervals = 0;
    for (const intervalKey of matchedIntervalKeys) {
      const intervalMs = new Date(intervalKey).getTime();
      if (intervalMs < rangeStartMs || intervalMs >= rangeEndMs) continue;
      const solar = roleIntervals.solar_source.get(intervalKey) ?? 0;
      const grid = roleIntervals.grid_source.get(intervalKey) ?? 0;
      const generator = roleIntervals.generator_source.get(intervalKey) ?? 0;
      solarKwh += solar;
      gridKwh += grid;
      generatorKwh += generator;
      if (generatorConfigured && generator > 0) generatorActiveIntervals += 1;
      const bucketKey = new Date(startOfEnergyBucket(intervalMs, period)).toISOString();
      const bucket = bucketsByKey.get(bucketKey);
      if (!bucket) continue;
      bucket.solarKwh += solar;
      bucket.gridKwh += grid;
      bucket.generatorKwh += generator;
      bucket.matchedIntervals += 1;
    }

    for (const bucket of buckets) {
      bucket.solarKwh = roundEnergy(bucket.solarKwh);
      bucket.gridKwh = roundEnergy(bucket.gridKwh);
      bucket.generatorKwh = roundEnergy(bucket.generatorKwh);
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
    const expectedIntervals = Math.max(0, Math.round((rangeEndMs - rangeStartMs) / HOUR_MS));
    const matchedIntervals = matchedIntervalKeys.filter((key) => {
      const timestamp = new Date(key).getTime();
      return timestamp >= rangeStartMs && timestamp < rangeEndMs;
    }).length;
    const targetStatus = totalKwh === 0
      ? 'no_data'
      : solarPercent < SOLAR_TARGET_MINIMUM
        ? 'below_target'
        : solarPercent > SOLAR_TARGET_MAXIMUM
          ? 'above_target'
          : 'within_target';
    const warnings = [
      'Contribution percentages use matched hourly intervals only, so a missing reading from a configured source cannot distort the comparison.',
      'SteamaCo currently exposes a limited raw-message history; longer periods show only the data still available from the provider.'
    ];
    if (!sourceMeters.some((meter) => meter.operationalRole === 'solar_source')) {
      warnings.push('No solar source meter is currently classified.');
    }
    if (!sourceMeters.some((meter) => meter.operationalRole === 'grid_source')) {
      warnings.push('No grid source meter is currently classified.');
    }
    if (!generatorConfigured) {
      warnings.push('Generator contribution is not included because no generator source meter is currently classified.');
    }

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
      summary: {
        solarKwh,
        gridKwh,
        generatorKwh,
        totalKwh,
        solarPercent,
        gridPercent,
        generatorPercent,
        generatorConfigured,
        generatorActiveIntervals: generatorConfigured ? generatorActiveIntervals : null,
        estimatedGeneratorRuntimeHours: generatorConfigured ? generatorActiveIntervals : null,
        targetStatus,
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
    return result;
  }

  async getRevenueAnalysis(
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
    const [usageChargesResult, paymentsResult] = await Promise.allSettled([
      this.getProviderTransactions('UCH', rangeStartMs),
      this.getProviderTransactions('PAY', rangeStartMs)
    ]);
    if (usageChargesResult.status === 'rejected') throw usageChargesResult.reason;

    const usageCharges = usageChargesResult.value;
    const payments = paymentsResult.status === 'fulfilled' ? paymentsResult.value : [];
    const collectionsAvailable = paymentsResult.status === 'fulfilled' && payments.length > 0;
    const buckets: SteamaRevenueBucket[] = energyMix.buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      from: bucket.from,
      to: bucket.to,
      solarKwh: bucket.solarKwh,
      gridKwh: bucket.gridKwh,
      generatorKwh: bucket.generatorKwh,
      totalKwh: bucket.totalKwh,
      coveragePercent: bucket.coveragePercent,
      customerUsageChargeNgn: 0,
      usageChargeTransactions: 0,
      recordedPaymentNgn: collectionsAvailable ? 0 : null,
      paymentTransactions: 0,
      solarAttributedChargeNgn: 0,
      gridAttributedChargeNgn: 0,
      generatorAttributedChargeNgn: 0,
      energyValueNgn: 0
    }));
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    for (const transaction of usageCharges) {
      const timestampMs = new Date(transaction.timestamp).getTime();
      const intervalStartMs = floorHour(timestampMs) - HOUR_MS;
      if (intervalStartMs < rangeStartMs || intervalStartMs >= rangeEndMs) continue;
      const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(intervalStartMs, period)).toISOString());
      if (!bucket) continue;
      bucket.customerUsageChargeNgn += -transaction.amount;
      bucket.usageChargeTransactions += 1;
    }

    for (const transaction of payments) {
      const timestampMs = new Date(transaction.timestamp).getTime();
      if (timestampMs < rangeStartMs || timestampMs >= rangeEndMs) continue;
      const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(timestampMs, period)).toISOString());
      if (!bucket) continue;
      bucket.recordedPaymentNgn = (bucket.recordedPaymentNgn ?? 0) + transaction.amount;
      bucket.paymentTransactions += 1;
    }

    for (const bucket of buckets) {
      bucket.customerUsageChargeNgn = roundMoney(Math.max(0, bucket.customerUsageChargeNgn));
      if (bucket.recordedPaymentNgn !== null) {
        bucket.recordedPaymentNgn = roundMoney(Math.max(0, bucket.recordedPaymentNgn));
      }
      bucket.energyValueNgn = roundMoney(bucket.totalKwh * this.retailTariffNgnPerKwh);
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
    const warnings = [
      'Customer charges are provider-posted UCH ledger entries. Manual account-balance top-ups are not treated as cash receipts.',
      'Solar, grid and generator charge allocations are management estimates based on matched source-meter energy for each reporting bucket.',
      'The grid-attributed amount is not a certified AEDC payable. Settlement still requires the AEDC invoice or tariff, losses, demand charges and taxes.',
      `The configured retail rate of NGN ${this.retailTariffNgnPerKwh.toFixed(2)} per kWh is provisional until management confirms it.`,
      ...energyMix.warnings
    ];
    if (!collectionsAvailable) {
      warnings.unshift('No PAY transaction was returned by SteamaCo for this period, so actual cash collections are unavailable.');
    }
    if (paymentsResult.status === 'rejected') {
      warnings.unshift('The provider payment ledger could not be retrieved; collections remain unavailable.');
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
      summary: {
        customerUsageChargeNgn,
        usageChargeTransactions: buckets.reduce((sum, bucket) => sum + bucket.usageChargeTransactions, 0),
        recordedPaymentNgn,
        paymentTransactions: buckets.reduce((sum, bucket) => sum + bucket.paymentTransactions, 0),
        collectionsAvailable,
        energyValueNgn: roundMoney(energyMix.summary.totalKwh * this.retailTariffNgnPerKwh),
        solarAttributedChargeNgn,
        gridAttributedChargeNgn,
        generatorAttributedChargeNgn,
        solarEnergyValueNgn: roundMoney(energyMix.summary.solarKwh * this.retailTariffNgnPerKwh),
        gridEnergyValueNgn: roundMoney(energyMix.summary.gridKwh * this.retailTariffNgnPerKwh),
        generatorEnergyValueNgn: roundMoney(energyMix.summary.generatorKwh * this.retailTariffNgnPerKwh),
        solarKwh: energyMix.summary.solarKwh,
        gridKwh: energyMix.summary.gridKwh,
        generatorKwh: energyMix.summary.generatorKwh,
        totalKwh: energyMix.summary.totalKwh,
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
    return result;
  }

  async getFloorAnalysis(
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

    const meterRequests = positionInputs.flatMap(({ customer, customerMeters }) =>
      customerMeters.map((meter) => ({ customerId: customer.providerId, meter }))
    );
    const historyResults = await Promise.allSettled(
      meterRequests.map(async ({ meter }) => ({
        meterId: meter.providerId,
        readings: await this.getDirectiveMeterReadings(meter.providerId, range.start, range.end)
      }))
    );
    const historiesByMeter = new Map<string, DirectiveReading[]>();
    let unavailableMeterCount = 0;
    historyResults.forEach((result, index) => {
      const meterId = meterRequests[index]?.meter.providerId;
      if (!meterId) return;
      if (result.status === 'fulfilled') historiesByMeter.set(meterId, result.value.readings);
      else unavailableMeterCount += 1;
    });

    const expectedHours = Math.max(0, Math.round((range.end - range.start) / HOUR_MS));
    const buckets = createFloorUsageBuckets(period, range.start, range.end);
    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const positions: SteamaFloorPositionUsage[] = [];

    for (const { customer, customerMeters, identity } of positionInputs) {
      const uniqueReadings: Array<DirectiveReading & { meterId: string }> = [];
      for (const meter of customerMeters) {
        const meterIntervals = new Map<string, DirectiveReading>();
        for (const reading of historiesByMeter.get(meter.providerId) ?? []) {
          meterIntervals.set(reading.intervalStart, reading);
        }
        for (const reading of meterIntervals.values()) {
          uniqueReadings.push({ ...reading, meterId: meter.providerId });
          const intervalMs = new Date(reading.intervalStart).getTime();
          const bucket = bucketsByKey.get(new Date(startOfEnergyBucket(intervalMs, period)).toISOString());
          const floorValue = bucket?.floors.find((entry) => entry.floorKey === identity.floorKey);
          if (bucket && floorValue) {
            floorValue.usageKwh += reading.usageKwh;
            bucket.totalKwh += reading.usageKwh;
          }
        }
      }

      uniqueReadings.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      const usageKwh = roundEnergy(uniqueReadings.reduce((sum, reading) => sum + reading.usageKwh, 0));
      const expectedIntervals = expectedHours * customerMeters.length;
      const tenantName = customer.lastName || 'No tenant recorded';
      positions.push({
        customerId: customer.providerId,
        providerPositionName: customer.firstName || customer.displayName,
        positionLabel: identity.positionLabel,
        tenantName,
        occupancyStatus: !customer.lastName
          ? 'not_recorded'
          : isEstatePlaceholder(customer.lastName)
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
        estimatedValueNgn: roundMoney(usageKwh * this.retailTariffNgnPerKwh),
        observedIntervals: uniqueReadings.length,
        expectedIntervals,
        coveragePercent: expectedIntervals > 0
          ? roundPercent((uniqueReadings.length / expectedIntervals) * 100)
          : 0,
        firstReadingAt: uniqueReadings[0]?.timestamp ?? null,
        latestReadingAt: uniqueReadings.at(-1)?.timestamp ?? null
      });
    }

    for (const bucket of buckets) {
      bucket.totalKwh = roundEnergy(bucket.totalKwh);
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
    const warnings = [
      'Floor consumption is calculated from interval usage on meters currently assigned to customer position accounts; cumulative register values are not summed.',
      'The first name is treated as the permanent floor or unit position and the last name as the current tenant snapshot.',
      'Legacy position codes are interpreted using the observed Na-Aka Hub convention: G codes are Ground Floor, F0 codes are First Floor, and F2–F5 identify Floors 2–5.',
      'SteamaCo currently exposes a limited raw-message history, so longer periods include only the readings still available from the provider.',
      'Estimated Naira values use the provisional MSM retail rate and are not cash collections.'
    ];
    if (positions.some((position) => position.floorKey === 'unclassified')) {
      warnings.push('Some customer positions could not be classified from their current names and remain in the Unclassified group.');
    }
    if (unavailableMeterCount > 0) {
      warnings.push(`${unavailableMeterCount} assigned meter reading request(s) were unavailable during this refresh.`);
    }
    if (positions.some((position) => position.meterCount === 0)) {
      warnings.push('Positions without an assigned meter remain visible but contribute no energy until a provider assignment exists.');
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
    return result;
  }

  async getCustomer(providerId: string): Promise<SteamaCustomerDetail> {
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

    return {
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
  }

  private async getReadingWindow(forceRefresh: boolean): Promise<SteamaMeterReadingPoint[]> {
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
        const payload = await this.client.request<unknown>({
          path: `/sites/${siteId}/utilities/${utilityId}/readings/`,
          query: { page_size: 1000 }
        });
        for (const record of asCollection(payload).records) {
          const reading = normalizeReading(record);
          if (reading) readings.push(reading);
        }
      }
    }

    this.cachedReadingWindow = { value: readings, expiresAt: now + this.cacheTtlMs };
    return readings;
  }

  private async getDirectiveMeterReadings(
    providerId: string,
    rangeStartMs: number,
    rangeEndMs: number
  ): Promise<DirectiveReading[]> {
    const records: JsonObject[] = [];
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

    return records.flatMap((record): DirectiveReading[] => {
      const timestamp = isoDateValue(firstValue(record, ['timestamp', 'message_timestamp', 'created_at']));
      if (!timestamp) return [];
      const data = parseDirectiveData(firstValue(record, ['data', 'payload', 'message_data']));
      const usageKwh = numberValue(firstValue(data, ['usage_amount', 'usage', 'usage_kwh']));
      if (usageKwh === null || usageKwh < 0) return [];
      const intervalStartMs = floorHour(new Date(timestamp).getTime()) - HOUR_MS;
      if (intervalStartMs < rangeStartMs || intervalStartMs >= rangeEndMs) return [];
      return [{ timestamp, intervalStart: new Date(intervalStartMs).toISOString(), usageKwh }];
    });
  }

  private async getProviderTransactions(category: 'UCH' | 'PAY', rangeStartMs: number): Promise<SteamaCustomerTransaction[]> {
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
}
