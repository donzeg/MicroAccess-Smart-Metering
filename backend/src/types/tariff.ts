export type TariffVersionSource = 'msm_configuration' | 'steama_observation';

export interface TariffVersion {
  id: string;
  scopeKey: string;
  tariffBand: string;
  retailNgnPerKwh: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: TariffVersionSource;
  evidenceReference: string;
  providerCustomerCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface TariffBootstrap {
  scopeKey: string;
  tariffBand: string;
  retailNgnPerKwh: number;
  effectiveFrom: string;
  observedAt: string;
}

export interface ProviderTariffObservation {
  scopeKey: string;
  tariffBand: string;
  retailNgnPerKwh: number;
  providerCustomerCount: number;
  observedAt: string;
}

export interface TariffRepository {
  ensureBootstrap: (bootstrap: TariffBootstrap) => Promise<TariffVersion>;
  observeProviderTariff: (observation: ProviderTariffObservation) => Promise<TariffVersion>;
  getCurrent: (scopeKey: string) => Promise<TariffVersion | null>;
  listForRange: (scopeKey: string, from: string, to: string) => Promise<TariffVersion[]>;
}

export interface ProviderTariffConsensus {
  retailNgnPerKwh: number | null;
  tariffBand: string | null;
  pricedCustomerCount: number;
  unpricedCustomerCount: number;
  mismatchedCustomerCount: number;
  consistent: boolean;
}
