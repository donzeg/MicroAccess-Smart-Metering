import type { SteamaFloorKey, SteamaFloorMappingEvidence } from './steamaOperations.js';

export type FloorTenancySource = 'provider_snapshot' | 'management_record';

export interface FloorPositionObservation {
  providerCustomerId: string;
  siteKey: string;
  floorKey: SteamaFloorKey;
  floorLevel: number | null;
  positionLabel: string;
  providerPositionName: string;
  mappingEvidence: SteamaFloorMappingEvidence;
  providerTenantName: string;
  observedAt: string;
}

export interface FloorTenancyRecord {
  id: string;
  providerCustomerId: string;
  tenantName: string;
  source: FloorTenancySource;
  effectiveFrom: string;
  effectiveTo: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  evidenceReference: string;
  createdBy: string;
}

export interface FloorPositionTenancyTimeline {
  providerCustomerId: string;
  siteKey: string;
  floorKey: SteamaFloorKey;
  floorLevel: number | null;
  positionLabel: string;
  providerPositionName: string;
  mappingEvidence: SteamaFloorMappingEvidence;
  providerTenantName: string;
  providerTenantObservedAt: string;
  currentTenantName: string | null;
  currentTenantSource: FloorTenancySource | null;
  providerDrift: boolean;
  historyTrackedFrom: string | null;
  tenancies: FloorTenancyRecord[];
}

export interface RecordFloorTenancyInput {
  providerCustomerId: string;
  tenantName: string;
  effectiveFrom: string;
  evidenceReference: string;
  actorReference: string;
}

export class FloorPositionNotFoundError extends Error {
  constructor() {
    super('floor_position_not_found');
    this.name = 'FloorPositionNotFoundError';
  }
}

export class FloorTenancyConflictError extends Error {
  constructor() {
    super('floor_tenancy_effective_date_conflict');
    this.name = 'FloorTenancyConflictError';
  }
}
