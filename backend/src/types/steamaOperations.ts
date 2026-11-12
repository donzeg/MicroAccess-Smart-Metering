export type MeterConnectivity = 'online' | 'offline' | 'never_online' | 'unknown';

export type MeterFreshnessBucket =
  | 'online'
  | 'under_24_hours'
  | 'one_to_three_days'
  | 'four_to_seven_days'
  | 'eight_to_fourteen_days'
  | 'over_fourteen_days'
  | 'never_online'
  | 'unknown';

export type MeterOperationalRole =
  | 'grid_source'
  | 'solar_source'
  | 'generator_source'
  | 'distribution_or_bulk'
  | 'customer_load'
  | 'unknown';

export type EnergyMixPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type EnergyMixTargetStatus = 'within_target' | 'below_target' | 'above_target' | 'no_data';

export interface SteamaMeterSummary {
  providerId: string;
  meterNumber: string;
  name: string;
  model: string;
  manufacturer: string;
  siteName: string;
  customerId: string | null;
  customerName: string | null;
  assigned: boolean;
  operationalRole: MeterOperationalRole;
  roleEvidence: 'provider_label' | 'model_rule' | 'assignment' | 'unclassified';
  connectivity: MeterConnectivity;
  connectivityLabel: string;
  freshnessBucket: MeterFreshnessBucket;
  lastReadingAt: string | null;
  latestReadingKwh: number | null;
  relayOn: boolean | null;
  communicationMethod: string;
  signalStrength: number | null;
  simProvider: string;
  simIccid: string;
  phase: string;
  criticalError: boolean | null;
  lidTamper: boolean | null;
}

export interface SteamaCustomerSummary {
  providerId: string;
  displayName: string;
  accountNumber: string;
  siteName: string;
  assignedMeterNumber: string | null;
  accountBalance: number | null;
  energyBalanceKwh: number | null;
  energyPrice: number | null;
  tariffBand: string;
  controlType: string;
}

export interface SteamaMeterReadingPoint {
  timestamp: string;
  readingKwh: number | null;
  usageKwh: number | null;
  anomalous: boolean;
  meterId: string;
  meterNumber: string;
  customerId: string | null;
  customerName: string | null;
}

export interface SteamaMeterHistory {
  dataSource: {
    provider: 'SteamaCo';
    mode: 'live_read_only';
    retrievedAt: string;
    scope: 'provider_recent_window';
  };
  meter: {
    providerId: string;
    meterNumber: string;
    name: string;
  };
  coverage: {
    from: string | null;
    to: string | null;
    readingCount: number;
  };
  summary: {
    firstReadingKwh: number | null;
    latestReadingKwh: number | null;
    registerChangeKwh: number | null;
    intervalUsageKwh: number | null;
    anomalyCount: number;
  };
  readings: SteamaMeterReadingPoint[];
  warnings: string[];
}

export interface SteamaEnergyMixBucket {
  key: string;
  label: string;
  from: string;
  to: string;
  solarKwh: number;
  gridKwh: number;
  generatorKwh: number;
  totalKwh: number;
  solarPercent: number;
  gridPercent: number;
  generatorPercent: number;
  matchedIntervals: number;
  expectedIntervals: number;
  coveragePercent: number;
}

export interface SteamaEnergyMixSourceMeter {
  providerId: string;
  meterNumber: string;
  name: string;
  role: 'solar_source' | 'grid_source' | 'generator_source';
  observedIntervals: number;
  firstReadingAt: string | null;
  latestReadingAt: string | null;
}

export interface SteamaEnergyMix {
  dataSource: {
    provider: 'SteamaCo';
    mode: 'live_read_only';
    retrievedAt: string;
    scope: 'provider_meter_directives';
    cached: boolean;
  };
  period: EnergyMixPeriod;
  range: {
    from: string;
    to: string;
    timezone: 'Africa/Lagos';
  };
  target: {
    solarMinimumPercent: number;
    solarMaximumPercent: number;
  };
  summary: {
    solarKwh: number;
    gridKwh: number;
    generatorKwh: number;
    totalKwh: number;
    solarPercent: number;
    gridPercent: number;
    generatorPercent: number;
    generatorConfigured: boolean;
    generatorActiveIntervals: number | null;
    estimatedGeneratorRuntimeHours: number | null;
    targetStatus: EnergyMixTargetStatus;
    matchedIntervals: number;
    expectedIntervals: number;
    coveragePercent: number;
  };
  sourceMeters: SteamaEnergyMixSourceMeter[];
  buckets: SteamaEnergyMixBucket[];
  warnings: string[];
}

export interface SteamaRevenueBucket {
  key: string;
  label: string;
  from: string;
  to: string;
  solarKwh: number;
  gridKwh: number;
  generatorKwh: number;
  totalKwh: number;
  coveragePercent: number;
  customerUsageChargeNgn: number;
  usageChargeTransactions: number;
  recordedPaymentNgn: number | null;
  paymentTransactions: number;
  solarAttributedChargeNgn: number;
  gridAttributedChargeNgn: number;
  generatorAttributedChargeNgn: number;
  energyValueNgn: number;
}

export interface SteamaRevenueAnalysis {
  dataSource: {
    provider: 'SteamaCo';
    mode: 'live_read_only';
    retrievedAt: string;
    scope: 'provider_usage_charge_ledger_and_meter_directives';
    cached: boolean;
  };
  period: EnergyMixPeriod;
  range: {
    from: string;
    to: string;
    timezone: 'Africa/Lagos';
  };
  tariff: {
    retailNgnPerKwh: number;
    currency: 'NGN';
    status: 'provisional';
    effectiveFrom: string | null;
    source: 'MSM controlled configuration';
  };
  summary: {
    customerUsageChargeNgn: number;
    usageChargeTransactions: number;
    recordedPaymentNgn: number | null;
    paymentTransactions: number;
    collectionsAvailable: boolean;
    energyValueNgn: number;
    solarAttributedChargeNgn: number;
    gridAttributedChargeNgn: number;
    generatorAttributedChargeNgn: number;
    solarEnergyValueNgn: number;
    gridEnergyValueNgn: number;
    generatorEnergyValueNgn: number;
    solarKwh: number;
    gridKwh: number;
    generatorKwh: number;
    totalKwh: number;
    solarPercent: number;
    gridPercent: number;
    generatorPercent: number;
    matchedIntervals: number;
    expectedIntervals: number;
    coveragePercent: number;
  };
  buckets: SteamaRevenueBucket[];
  warnings: string[];
}

export interface SteamaCustomerBalancePoint {
  timestamp: string;
  accountBalance: number;
}

export interface SteamaCustomerTransaction {
  providerId: string;
  timestamp: string;
  category: string;
  amount: number;
  accountBalance: number | null;
  meterNumber: string;
  reference: string;
}

export interface SteamaCustomerDetail extends SteamaCustomerSummary {
  meters: Array<{
    providerId: string;
    meterNumber: string;
    name: string;
  }>;
  balances: SteamaCustomerBalancePoint[];
  transactions: SteamaCustomerTransaction[];
  transactionSummary: {
    retrievedCount: number;
    totalAmount: number;
    usageChargeAmount: number;
    paymentAmount: number;
    from: string | null;
    to: string | null;
  };
  warnings: string[];
}

export interface CountSeriesItem {
  key: string;
  label: string;
  count: number;
}

export interface SteamaOperationsException {
  key: string;
  label: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  action: string;
}

export interface SteamaOperationsOverview {
  dataSource: {
    provider: 'SteamaCo';
    mode: 'live_read_only';
    retrievedAt: string;
    cached: boolean;
  };
  summary: {
    totalMeters: number;
    onlineMeters: number;
    neverOnlineMeters: number;
    assignedMeters: number;
    unassignedMeters: number;
    sourceMeters: number;
    customerLoadMeters: number;
    unclassifiedMeters: number;
    totalCustomers: number;
    customersWithoutMeter: number;
    totalSites: number;
  };
  freshnessDistribution: CountSeriesItem[];
  assignmentDistribution: CountSeriesItem[];
  roleDistribution: CountSeriesItem[];
  modelDistribution: CountSeriesItem[];
  exceptions: SteamaOperationsException[];
  meters: SteamaMeterSummary[];
  customers: SteamaCustomerSummary[];
  warnings: string[];
}
