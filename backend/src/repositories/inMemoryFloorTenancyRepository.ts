import { randomUUID } from 'node:crypto';

import type { FloorTenancyRepository } from './interfaces.js';
import {
  FloorPositionNotFoundError,
  FloorTenancyConflictError,
  type FloorPositionObservation,
  type FloorPositionTenancyTimeline,
  type FloorTenancyRecord,
  type RecordFloorTenancyInput
} from '../types/floorTenancy.js';

const cloneTimeline = (timeline: FloorPositionTenancyTimeline): FloorPositionTenancyTimeline => ({
  ...timeline,
  tenancies: timeline.tenancies.map((tenancy) => ({ ...tenancy }))
});

const currentTenancy = (timeline: FloorPositionTenancyTimeline): FloorTenancyRecord | null =>
  timeline.tenancies.find((tenancy) => tenancy.effectiveTo === null) ?? null;

const refreshDerivedState = (timeline: FloorPositionTenancyTimeline): void => {
  timeline.tenancies.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
  const current = currentTenancy(timeline);
  timeline.currentTenantName = current?.tenantName ?? null;
  timeline.currentTenantSource = current?.source ?? null;
  timeline.providerDrift = Boolean(
    current && timeline.providerTenantName && current.tenantName !== timeline.providerTenantName
  );
  timeline.historyTrackedFrom = timeline.tenancies[0]?.effectiveFrom ?? null;
};

export class InMemoryFloorTenancyRepository implements FloorTenancyRepository {
  private readonly timelines = new Map<string, FloorPositionTenancyTimeline>();

  async observeProviderPosition(observation: FloorPositionObservation): Promise<FloorPositionTenancyTimeline> {
    const existing = this.timelines.get(observation.providerCustomerId);
    const timeline: FloorPositionTenancyTimeline = existing ?? {
      providerCustomerId: observation.providerCustomerId,
      siteKey: observation.siteKey,
      floorKey: observation.floorKey,
      floorLevel: observation.floorLevel,
      positionLabel: observation.positionLabel,
      providerPositionName: observation.providerPositionName,
      mappingEvidence: observation.mappingEvidence,
      providerTenantName: observation.providerTenantName,
      providerTenantObservedAt: observation.observedAt,
      currentTenantName: null,
      currentTenantSource: null,
      providerDrift: false,
      historyTrackedFrom: null,
      tenancies: []
    };

    timeline.siteKey = observation.siteKey;
    timeline.floorKey = observation.floorKey;
    timeline.floorLevel = observation.floorLevel;
    timeline.positionLabel = observation.positionLabel;
    timeline.providerPositionName = observation.providerPositionName;
    timeline.mappingEvidence = observation.mappingEvidence;
    timeline.providerTenantName = observation.providerTenantName;
    timeline.providerTenantObservedAt = observation.observedAt;

    const current = currentTenancy(timeline);
    if (observation.providerTenantName) {
      if (!current) {
        timeline.tenancies.push({
          id: randomUUID(),
          providerCustomerId: observation.providerCustomerId,
          tenantName: observation.providerTenantName,
          source: 'provider_snapshot',
          effectiveFrom: observation.observedAt,
          effectiveTo: null,
          firstObservedAt: observation.observedAt,
          lastObservedAt: observation.observedAt,
          evidenceReference: 'steama_customer_snapshot',
          createdBy: 'system:steama-observer'
        });
      } else if (current.source === 'provider_snapshot' && current.tenantName !== observation.providerTenantName) {
        current.effectiveTo = observation.observedAt;
        current.lastObservedAt = observation.observedAt;
        timeline.tenancies.push({
          id: randomUUID(),
          providerCustomerId: observation.providerCustomerId,
          tenantName: observation.providerTenantName,
          source: 'provider_snapshot',
          effectiveFrom: observation.observedAt,
          effectiveTo: null,
          firstObservedAt: observation.observedAt,
          lastObservedAt: observation.observedAt,
          evidenceReference: 'steama_customer_snapshot_change',
          createdBy: 'system:steama-observer'
        });
      } else if (current.tenantName === observation.providerTenantName) {
        current.lastObservedAt = observation.observedAt;
      }
    }

    refreshDerivedState(timeline);
    this.timelines.set(observation.providerCustomerId, timeline);
    return cloneTimeline(timeline);
  }

  async getTimeline(providerCustomerId: string): Promise<FloorPositionTenancyTimeline | null> {
    const timeline = this.timelines.get(providerCustomerId);
    return timeline ? cloneTimeline(timeline) : null;
  }

  async recordManagementTenancy(input: RecordFloorTenancyInput): Promise<FloorPositionTenancyTimeline> {
    const timeline = this.timelines.get(input.providerCustomerId);
    if (!timeline) throw new FloorPositionNotFoundError();
    if (timeline.tenancies.some(
      (tenancy) => tenancy.source === 'management_record' && tenancy.effectiveFrom === input.effectiveFrom
    )) {
      throw new FloorTenancyConflictError();
    }

    const nextManagement = timeline.tenancies
      .filter((tenancy) => tenancy.source === 'management_record' && tenancy.effectiveFrom > input.effectiveFrom)
      .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0];
    timeline.tenancies = timeline.tenancies.filter((tenancy) =>
      tenancy.source !== 'provider_snapshot' ||
      tenancy.effectiveFrom < input.effectiveFrom ||
      (nextManagement ? tenancy.effectiveFrom >= nextManagement.effectiveFrom : false)
    );
    const ordered = [...timeline.tenancies].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
    const previous = ordered.filter((tenancy) => tenancy.effectiveFrom < input.effectiveFrom).at(-1);
    if (previous) previous.effectiveTo = input.effectiveFrom;

    timeline.tenancies.push({
      id: randomUUID(),
      providerCustomerId: input.providerCustomerId,
      tenantName: input.tenantName,
      source: 'management_record',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: nextManagement?.effectiveFrom ?? null,
      firstObservedAt: new Date().toISOString(),
      lastObservedAt: new Date().toISOString(),
      evidenceReference: input.evidenceReference,
      createdBy: input.actorReference
    });
    refreshDerivedState(timeline);
    return cloneTimeline(timeline);
  }
}
