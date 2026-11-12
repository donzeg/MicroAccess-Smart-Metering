import { describe, expect, it, vi } from 'vitest';

import { InMemoryFloorTenancyRepository } from '../../src/repositories/inMemoryFloorTenancyRepository.js';

describe('InMemoryFloorTenancyRepository', () => {
  it('lets an effective-dated management record replace a provisional provider snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    try {
      const repository = new InMemoryFloorTenancyRepository();
      await repository.observeProviderPosition({
        providerCustomerId: '100',
        siteKey: 'na-aka-hub',
        floorKey: 'fifth-floor',
        floorLevel: 5,
        positionLabel: 'Fifth Floor · Unit 01',
        providerPositionName: '5th Floor -01',
        mappingEvidence: 'structured_name',
        providerTenantName: 'MicroAccess Corporate Office',
        observedAt: '2026-11-12T09:00:00.000Z'
      });

      const timeline = await repository.recordManagementTenancy({
        providerCustomerId: '100',
        tenantName: 'MicroAccess Corporate Office',
        effectiveFrom: '2026-05-01T00:00:00.000Z',
        evidenceReference: 'signed_lease_2026',
        actorReference: 'sadiq.yusuf'
      });

      expect(timeline.currentTenantName).toBe('MicroAccess Corporate Office');
      expect(timeline.currentTenantSource).toBe('management_record');
      expect(timeline.historyTrackedFrom).toBe('2026-05-01T00:00:00.000Z');
      expect(timeline.tenancies).toHaveLength(1);
      expect(timeline.tenancies[0]).toMatchObject({
        source: 'management_record',
        evidenceReference: 'signed_lease_2026',
        effectiveTo: null
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flags provider drift without overwriting a management-approved current tenant', async () => {
    const repository = new InMemoryFloorTenancyRepository();
    const observation = {
      providerCustomerId: '100',
      siteKey: 'na-aka-hub',
      floorKey: 'fifth-floor' as const,
      floorLevel: 5,
      positionLabel: 'Fifth Floor · Unit 01',
      providerPositionName: '5th Floor -01',
      mappingEvidence: 'structured_name' as const,
      providerTenantName: 'Original Tenant',
      observedAt: '2026-11-12T09:00:00.000Z'
    };
    await repository.observeProviderPosition(observation);
    await repository.recordManagementTenancy({
      providerCustomerId: '100',
      tenantName: 'Approved Tenant',
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      evidenceReference: 'management_confirmation',
      actorReference: 'operator'
    });

    const timeline = await repository.observeProviderPosition({
      ...observation,
      providerTenantName: 'Different Provider Name',
      observedAt: '2026-11-13T09:00:00.000Z'
    });

    expect(timeline.currentTenantName).toBe('Approved Tenant');
    expect(timeline.currentTenantSource).toBe('management_record');
    expect(timeline.providerTenantName).toBe('Different Provider Name');
    expect(timeline.providerDrift).toBe(true);
    expect(timeline.tenancies).toHaveLength(1);
  });
});
