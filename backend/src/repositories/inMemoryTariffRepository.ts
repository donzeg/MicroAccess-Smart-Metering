import { randomUUID } from 'node:crypto';

import type {
  ProviderTariffObservation,
  TariffBootstrap,
  TariffRepository,
  TariffVersion
} from '../types/tariff.js';

const clone = (version: TariffVersion): TariffVersion => ({ ...version });

export class InMemoryTariffRepository implements TariffRepository {
  private readonly versionsByScope = new Map<string, TariffVersion[]>();

  async ensureBootstrap(bootstrap: TariffBootstrap): Promise<TariffVersion> {
    const existing = this.versionsByScope.get(bootstrap.scopeKey) ?? [];
    const current = existing.find((version) => version.effectiveTo === null);
    if (current) return clone(current);
    const version: TariffVersion = {
      id: randomUUID(),
      scopeKey: bootstrap.scopeKey,
      tariffBand: bootstrap.tariffBand,
      retailNgnPerKwh: bootstrap.retailNgnPerKwh,
      effectiveFrom: bootstrap.effectiveFrom,
      effectiveTo: null,
      source: 'msm_configuration',
      evidenceReference: 'MSM_RETAIL_TARIFF_NGN_PER_KWH',
      providerCustomerCount: 0,
      firstObservedAt: bootstrap.observedAt,
      lastObservedAt: bootstrap.observedAt
    };
    this.versionsByScope.set(bootstrap.scopeKey, [version]);
    return clone(version);
  }

  async observeProviderTariff(observation: ProviderTariffObservation): Promise<TariffVersion> {
    const versions = this.versionsByScope.get(observation.scopeKey) ?? [];
    const current = versions.find((version) => version.effectiveTo === null);
    if (
      current &&
      current.retailNgnPerKwh === observation.retailNgnPerKwh &&
      current.tariffBand === observation.tariffBand
    ) {
      current.lastObservedAt = observation.observedAt;
      current.providerCustomerCount = observation.providerCustomerCount;
      current.evidenceReference = 'steama_customer_tariff_consensus';
      return clone(current);
    }
    if (current) current.effectiveTo = observation.observedAt;
    const version: TariffVersion = {
      id: randomUUID(),
      scopeKey: observation.scopeKey,
      tariffBand: observation.tariffBand,
      retailNgnPerKwh: observation.retailNgnPerKwh,
      effectiveFrom: observation.observedAt,
      effectiveTo: null,
      source: 'steama_observation',
      evidenceReference: 'steama_customer_tariff_consensus',
      providerCustomerCount: observation.providerCustomerCount,
      firstObservedAt: observation.observedAt,
      lastObservedAt: observation.observedAt
    };
    versions.push(version);
    versions.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
    this.versionsByScope.set(observation.scopeKey, versions);
    return clone(version);
  }

  async getCurrent(scopeKey: string): Promise<TariffVersion | null> {
    const current = (this.versionsByScope.get(scopeKey) ?? []).find((version) => version.effectiveTo === null);
    return current ? clone(current) : null;
  }

  async listForRange(scopeKey: string, from: string, to: string): Promise<TariffVersion[]> {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return (this.versionsByScope.get(scopeKey) ?? [])
      .filter((version) => {
        const starts = new Date(version.effectiveFrom).getTime();
        const ends = version.effectiveTo ? new Date(version.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
        return starts < toMs && ends > fromMs;
      })
      .map(clone);
  }
}
