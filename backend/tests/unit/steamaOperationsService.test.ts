import { describe, expect, it, vi } from 'vitest';

import { InMemoryMeterArchiveRepository } from '../../src/repositories/inMemoryMeterArchiveRepository.js';
import { InMemoryTariffRepository } from '../../src/repositories/inMemoryTariffRepository.js';
import { SteamaOperationsService } from '../../src/services/steamaOperationsService.js';

describe('SteamaOperationsService', () => {
  it('normalizes live provider records without treating relay state as connectivity', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') {
        return Promise.resolve({
          count: 3,
          results: [
            {
              id: 1,
              reference: '0308000187515',
              meter_type: 100,
              meter_type_name: 'DS3100',
              offline_duration_status: 'Online',
              connection_is_on: false,
              latest_meter_reading: '31370.25',
              customer: 10,
              customer_name: 'Solar source',
              communication_method_name: 'GPRS',
              sim_card_network_provider_name: 'Jersey Telecom',
              critical_error_reported: false,
              lid_tamper_detection_reported: false
            },
            {
              id: 2,
              reference: '0179250930205',
              meter_type_name: 'DS3600',
              offline_duration_status: 'Offline (9 days)',
              connection_is_on: true
            },
            {
              id: 3,
              reference: '0179250930189',
              meter_type_name: 'DS3600',
              offline_duration_status: 'Never Online'
            }
          ]
        });
      }
      if (path === '/customers/') {
        return Promise.resolve({
          count: 2,
          results: [
            { id: 10, first_name: 'Solar', last_name: 'Source', meters_url: '/customers/10/meters/' },
            { id: 11, first_name: 'Unassigned', last_name: 'Account' }
          ]
        });
      }
      return Promise.resolve({ count: 1, results: [{ id: 20, name: 'Na-Aka Hub' }] });
    });

    const service = new SteamaOperationsService({ request }, 60_000);
    const overview = await service.getOverview();

    expect(overview.summary).toMatchObject({
      totalMeters: 3,
      onlineMeters: 1,
      neverOnlineMeters: 1,
      assignedMeters: 1,
      unassignedMeters: 2,
      totalCustomers: 2,
      customersWithoutMeter: 1,
      totalSites: 1
    });
    expect(overview.meters[0]).toMatchObject({
      operationalRole: 'solar_source',
      connectivity: 'online',
      relayOn: false,
      latestReadingKwh: 31370.25,
      model: 'DS3100',
      communicationMethod: 'GPRS',
      simProvider: 'Jersey Telecom',
      criticalError: false,
      lidTamper: false
    });
    expect(overview.customers[0].assignedMeterNumber).toBe('0308000187515');
    expect(overview.meters[1]).toMatchObject({
      connectivity: 'offline',
      freshnessBucket: 'eight_to_fourteen_days',
      relayOn: true
    });
    expect(overview.exceptions.map((item) => item.key)).toContain('never_online');
  });

  it('caches the overview and only refreshes when requested', async () => {
    const request = vi.fn().mockResolvedValue({ count: 0, results: [] });
    const service = new SteamaOperationsService({ request }, 60_000);

    await service.getOverview();
    const cached = await service.getOverview();
    await service.getOverview(true);

    expect(cached.dataSource.cached).toBe(true);
    expect(request).toHaveBeenCalledTimes(8);
  });

  it('supplements the meter register with the newest cumulative reading from the reading window', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') {
        return Promise.resolve({
          count: 2,
          results: [
            { id: 1, reference: '0308000187515', name: 'Solar meter', offline_duration_status: 'Online' },
            { id: 2, reference: 'MTR-NO-READING', name: 'Customer meter', offline_duration_status: 'Online' }
          ]
        });
      }
      if (path === '/customers/') return Promise.resolve({ count: 0, results: [] });
      if (path === '/sites/') return Promise.resolve({ count: 1, results: [{ id: 20 }] });
      if (path === '/sites/20/utilities/') return Promise.resolve({ count: 1, results: [{ id: 5 }] });
      if (path === '/sites/20/utilities/5/readings/') {
        return Promise.resolve({
          count: 3,
          results: [
            { timestamp: '2026-11-13T19:00:00Z', meter: 1, meter_reference: '0308000187515', reading: 31817, usage_amount: 27 },
            { timestamp: '2026-11-13T20:00:00Z', meter: 1, meter_reference: '0308000187515', reading: 31822, usage_amount: 5 },
            { timestamp: '2026-11-13T21:00:00Z', meter: 1, meter_reference: '0308000187515', reading: 31822, usage_amount: 0 }
          ]
        });
      }
      throw new Error(`unexpected_path:${path}`);
    });

    const overview = await new SteamaOperationsService({ request }, 60_000).getOverview();

    expect(overview.meters[0].latestReadingKwh).toBe(31822);
    expect(overview.meters[1].latestReadingKwh).toBeNull();
    expect(overview.warnings).not.toContain('meter_readings_unavailable');
  });

  it('keeps the meter register available when the optional reading window cannot be loaded', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') {
        return Promise.resolve({ count: 1, results: [{ id: 1, reference: 'MTR-001', offline_duration_status: 'Online' }] });
      }
      if (path === '/customers/') return Promise.resolve({ count: 0, results: [] });
      if (path === '/sites/') return Promise.reject(new Error('provider_sites_unavailable'));
      throw new Error(`unexpected_path:${path}`);
    });

    const overview = await new SteamaOperationsService({ request }, 60_000).getOverview();

    expect(overview.meters[0].latestReadingKwh).toBeNull();
    expect(overview.warnings).toContain('meter_readings_unavailable');
  });

  it('reconciles a customer-side meter assignment when the meter omits its customer', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') {
        return Promise.resolve({
          count: 1,
          results: [
            {
              id: 1,
              reference: '0179250930205',
              meter_type_name: 'DS3600',
              offline_duration_status: 'Online'
            }
          ]
        });
      }
      if (path === '/customers/') {
        return Promise.resolve({
          count: 1,
          results: [
            {
              id: 10,
              first_name: '5th Floor -01',
              last_name: 'Tenant Account',
              meter_number: '017925093 0205'
            }
          ]
        });
      }
      return Promise.resolve({ count: 1, results: [{ id: 20, name: 'Na-Aka Hub' }] });
    });

    const overview = await new SteamaOperationsService({ request }, 60_000).getOverview();

    expect(overview.meters[0]).toMatchObject({
      customerId: '10',
      customerName: '5th Floor -01 Tenant Account',
      assigned: true,
      operationalRole: 'customer_load',
      roleEvidence: 'assignment'
    });
    expect(overview.summary).toMatchObject({ assignedMeters: 1, unassignedMeters: 0 });
    expect(overview.exceptions.map((item) => item.key)).not.toContain('unassigned_meters');
  });

  it('builds dated meter history from the provider utility reading window', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/1/') {
        return Promise.resolve({ id: 1, reference: 'MTR-001', name: 'Grid source', meter_type_name: 'DS3100' });
      }
      if (path === '/sites/') return Promise.resolve({ results: [{ id: 20 }] });
      if (path === '/sites/20/utilities/') return Promise.resolve([{ id: 1 }]);
      if (path === '/sites/20/utilities/1/readings/') {
        return Promise.resolve([
          { timestamp: '2026-11-01T00:00:00Z', meter: 1, meter_reference: 'MTR-001', reading: 100, usage_amount: 0 },
          { timestamp: '2026-11-01T01:00:00Z', meter: 1, meter_reference: 'MTR-001', reading: 105, usage_amount: 5 }
        ]);
      }
      throw new Error(`unexpected_path:${path}`);
    });
    const history = await new SteamaOperationsService({ request }, 60_000).getMeterHistory('1');
    expect(history.coverage).toMatchObject({ readingCount: 2, from: '2026-11-01T00:00:00.000Z', to: '2026-11-01T01:00:00.000Z' });
    expect(history.summary).toMatchObject({ firstReadingKwh: 100, latestReadingKwh: 105, registerChangeKwh: 5, intervalUsageKwh: 5, anomalyCount: 0 });
  });

  it('serves retained meter history from the local archive without depending on provider retention', async () => {
    const archive = new InMemoryMeterArchiveRepository();
    await archive.upsertReadings([
      {
        source: 'utility_reading',
        intervalStart: '2026-05-01T09:00:00.000Z',
        timestamp: '2026-05-01T10:00:00.000Z',
        readingKwh: 1000,
        usageKwh: 12,
        anomalous: false,
        meterId: '1',
        meterNumber: 'MTR-001',
        customerId: null,
        customerName: null
      }
    ]);
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/1/') {
        return Promise.resolve({ id: 1, reference: 'MTR-001', name: 'Source meter', meter_type_name: 'DS3100' });
      }
      throw new Error(`unexpected_path:${path}`);
    });
    const service = new SteamaOperationsService({ request }, 60_000, {
      meterArchiveRepository: archive,
      meterArchiveSyncEnabled: true
    });

    const history = await service.getMeterHistory('1');

    expect(history.dataSource).toMatchObject({ mode: 'local_archive', scope: 'local_historical_archive' });
    expect(history.coverage).toMatchObject({ readingCount: 1, from: '2026-05-01T10:00:00.000Z' });
    expect(history.summary).toMatchObject({ firstReadingKwh: 1000, latestReadingKwh: 1000, intervalUsageKwh: 12 });
    expect(request).not.toHaveBeenCalled();
  });

  it('serves the last retained operational view without waiting for the provider', async () => {
    const archive = new InMemoryMeterArchiveRepository();
    const liveRequest = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') {
        return Promise.resolve({
          count: 1,
          results: [{ id: 1, reference: 'MTR-001', offline_duration_status: 'Online' }]
        });
      }
      return Promise.resolve({ count: 0, results: [] });
    });
    const liveService = new SteamaOperationsService({ request: liveRequest }, 60_000, {
      meterArchiveRepository: archive
    });
    await liveService.getOverview();

    const unavailableRequest = vi.fn().mockRejectedValue(new Error('provider_unavailable'));
    const restartedService = new SteamaOperationsService({ request: unavailableRequest }, 60_000, {
      meterArchiveRepository: archive
    });
    const retained = await restartedService.getOverview();

    expect(retained.summary.totalMeters).toBe(1);
    expect(retained.dataSource.cached).toBe(true);
    expect(unavailableRequest).not.toHaveBeenCalled();
  });

  it('coalesces concurrent overview requests into one provider refresh', async () => {
    const request = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { count: 0, results: [] };
    });
    const service = new SteamaOperationsService({ request }, 60_000);

    const [first, second, third] = await Promise.all([
      service.getOverview(),
      service.getOverview(),
      service.getOverview()
    ]);

    expect(first.summary.totalMeters).toBe(0);
    expect(second.summary.totalMeters).toBe(0);
    expect(third.summary.totalMeters).toBe(0);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('keeps monetary customer ledger data separate from energy balances', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/customers/10/') return Promise.resolve({ id: 10, first_name: 'Grid', last_name: 'Account', account_balance: -2000, energy_balance: 12 });
      if (path === '/customers/10/balances/') return Promise.resolve([{ timestamp: '2026-11-01T00:00:00Z', account_balance: -2000 }]);
      if (path === '/customers/10/transactions/') return Promise.resolve([
        { id: 1, timestamp: '2026-11-01T00:00:00Z', category: 'UCH', amount: -2500, account_balance: -2500 },
        { id: 2, timestamp: '2026-11-01T01:00:00Z', category: 'PAY', amount: 500, account_balance: -2000 }
      ]);
      if (path === '/customers/10/meters/') return Promise.resolve([{ id: 1, reference: 'MTR-001', name: 'Grid meter' }]);
      throw new Error(`unexpected_path:${path}`);
    });
    const customer = await new SteamaOperationsService({ request }, 60_000).getCustomer('10');
    expect(customer).toMatchObject({ accountBalance: -2000, energyBalanceKwh: 12, assignedMeterNumber: 'MTR-001' });
    expect(customer.transactionSummary).toMatchObject({ retrievedCount: 2, totalAmount: -2000, usageChargeAmount: -2500, paymentAmount: 500 });
    expect(customer.warnings.join(' ')).toContain('negative account balance');
  });

  it('derives a usable kWh balance from a positive Naira balance when the provider returns zero kWh', async () => {
    const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
      if (path === '/meters/') return Promise.resolve({ count: 0, results: [] });
      if (path === '/customers/') {
        return Promise.resolve({
          count: 1,
          results: [{
            id: 10,
            first_name: '5th Floor -01',
            last_name: 'MicroAccess Corporate Office',
            account_balance: 211025.37,
            energy_balance: 0,
            energy_price: 203,
            service_based_tariff: 'A'
          }]
        });
      }
      if (path === '/sites/') return Promise.resolve({ count: 0, results: [] });
      throw new Error(`unexpected_path:${path}`);
    });

    const overview = await new SteamaOperationsService(
      { request },
      60_000,
      {
        retailTariffNgnPerKwh: 203,
        tariffEffectiveFrom: '2025-12-31T23:00:00.000Z'
      }
    ).getOverview();

    expect(overview.customers[0]).toMatchObject({
      accountBalance: 211025.37,
      providerEnergyBalanceKwh: 0,
      energyBalanceKwh: 1039.53,
      energyBalanceSource: 'derived_from_monetary_balance',
      energyBalanceRateNgnPerKwh: 203,
      tariffMismatch: false
    });
  });

  it('values each interval with the tariff effective when that energy was consumed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T10:15:00Z'));

    try {
      const tariffRepository = new InMemoryTariffRepository();
      await tariffRepository.ensureBootstrap({
        scopeKey: 'na-aka-hub',
        tariffBand: 'A',
        retailNgnPerKwh: 203,
        effectiveFrom: '2026-11-12T00:00:00.000Z',
        observedAt: '2026-11-12T00:00:00.000Z'
      });
      await tariffRepository.observeProviderTariff({
        scopeKey: 'na-aka-hub',
        tariffBand: 'A',
        retailNgnPerKwh: 250,
        providerCustomerCount: 20,
        observedAt: '2026-11-12T09:00:00.000Z'
      });
      const request = vi.fn().mockImplementation(
        ({ path, query }: { path: string; query?: Record<string, unknown> }) => {
          if (path === '/meters/') {
            return Promise.resolve({
              count: 1,
              results: [{ id: 1, reference: 'SOLAR', name: 'Solar source', offline_duration_status: 'Online' }]
            });
          }
          if (path === '/customers/' || path === '/sites/') return Promise.resolve({ count: 0, results: [] });
          if (path === '/meters/1/directives/') {
            return Promise.resolve({
              count: 2,
              results: [
                { timestamp: '2026-11-12T09:00:00Z', data: JSON.stringify({ usage_amount: 10 }) },
                { timestamp: '2026-11-12T10:00:00Z', data: JSON.stringify({ usage_amount: 10 }) }
              ]
            });
          }
          if (path === '/transactions/' && (query?.category === 'UCH' || query?.category === 'PAY')) {
            return Promise.resolve({ count: 0, results: [] });
          }
          throw new Error(`unexpected_path:${path}`);
        }
      );
      const result = await new SteamaOperationsService(
        { request },
        60_000,
        { tariffRepository }
      ).getRevenueAnalysis('hourly');

      expect(result.summary).toMatchObject({
        totalKwh: 20,
        accruedEnergyRevenueNgn: 4530,
        solarAccruedRevenueNgn: 4530
      });
      expect(result.tariff).toMatchObject({
        retailNgnPerKwh: 250,
        versionsApplied: 2,
        status: 'provider_synchronized'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('totals each source independently while keeping pair comparisons time-matched', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T09:15:00Z'));

    try {
      const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path === '/meters/') {
          return Promise.resolve({
            count: 2,
            results: [
              {
                id: 1,
                reference: 'SOLAR-001',
                name: 'Solar meter',
                customer: 10,
                customer_name: 'Power room solar source',
                offline_duration_status: 'Online'
              },
              {
                id: 2,
                reference: 'GRID-001',
                name: 'Grid meter',
                customer: 11,
                customer_name: 'Power room grid source',
                offline_duration_status: 'Online'
              }
            ]
          });
        }
        if (path === '/customers/') return Promise.resolve({ count: 2, results: [] });
        if (path === '/sites/') return Promise.resolve({ count: 1, results: [] });
        if (path === '/meters/1/directives/') {
          return Promise.resolve({
            count: 2,
            results: [
              { timestamp: '2026-11-12T08:00:10Z', data: JSON.stringify({ usage_amount: 90 }) },
              { timestamp: '2026-11-12T07:00:10Z', data: JSON.stringify({ usage_amount: 50 }) }
            ]
          });
        }
        if (path === '/meters/2/directives/') {
          return Promise.resolve({
            count: 1,
            results: [
              { timestamp: '2026-11-12T08:00:20Z', data: JSON.stringify({ usage_amount: 10 }) }
            ]
          });
        }
        throw new Error(`unexpected_path:${path}`);
      });

      const result = await new SteamaOperationsService({ request }, 60_000).getEnergyMix('hourly');

      expect(result.summary).toMatchObject({
        solarKwh: 140,
        gridKwh: 10,
        totalKwh: 150,
        solarPercent: 93.3,
        gridPercent: 6.7,
        targetStatus: 'within_target',
        generatorConfigured: false,
        generatorKwh: 0,
        matchedIntervals: 1,
        expectedIntervals: 24
      });
      expect(result.summary.solarVsGrid).toMatchObject({
        configured: true,
        available: true,
        solarKwh: 90,
        companionKwh: 10,
        totalKwh: 100,
        solarPercent: 90,
        companionPercent: 10,
        matchedActiveIntervals: 1,
        companionActiveIntervals: 1,
        coveragePercent: 100,
        targetStatus: 'within_target'
      });
      expect(result.summary.solarVsGenerator).toMatchObject({
        configured: false,
        available: false,
        solarPercent: null,
        companionPercent: null,
        targetStatus: 'no_data'
      });
      expect(result.sourceTopology).toMatchObject({
        gridSourceIncludesGenerator: true,
        generatorSeparatelyMetered: false,
        sharedSupplyLabel: 'AEDC / generator supply'
      });
      expect(result.sourceMeters).toHaveLength(2);
      expect(result.buckets.find((bucket) => bucket.totalKwh === 100)).toMatchObject({
        solarKwh: 90,
        gridKwh: 10,
        matchedIntervals: 1
      });
      expect(result.summary.totalKwh).toBe(150);
    } finally {
      vi.useRealTimers();
    }
  });

  it('includes a configured generator and honours a custom Lagos date range', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T09:15:00Z'));

    try {
      const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path === '/meters/') {
          return Promise.resolve({
            count: 3,
            results: [
              { id: 1, reference: 'SOLAR', name: 'Solar source', offline_duration_status: 'Online' },
              { id: 2, reference: 'GRID', name: 'Grid source', offline_duration_status: 'Online' },
              { id: 3, reference: 'GEN', name: 'Generator source', offline_duration_status: 'Online' }
            ]
          });
        }
        if (path === '/customers/' || path === '/sites/') return Promise.resolve({ count: 0, results: [] });
        if (path.match(/^\/meters\/[123]\/directives\/$/)) {
          const usageByMeter = path.includes('/1/')
            ? [90, 60]
            : path.includes('/2/')
              ? [10, 0]
              : [0, 40];
          return Promise.resolve({
            count: 2,
            results: [
              { timestamp: '2026-11-10T08:00:00Z', data: JSON.stringify({ usage_amount: usageByMeter[0] }) },
              { timestamp: '2026-11-10T09:00:00Z', data: JSON.stringify({ usage_amount: usageByMeter[1] }) }
            ]
          });
        }
        throw new Error(`unexpected_path:${path}`);
      });

      const result = await new SteamaOperationsService({ request }, 60_000).getEnergyMix(
        'daily',
        false,
        { from: '2026-11-10', to: '2026-11-10' }
      );

      expect(result.range).toMatchObject({
        from: '2026-11-09T23:00:00.000Z',
        to: '2026-11-10T23:00:00.000Z',
        timezone: 'Africa/Lagos'
      });
      expect(result.buckets).toHaveLength(1);
      expect(result.summary).toMatchObject({
        solarKwh: 150,
        gridKwh: 10,
        generatorKwh: 40,
        totalKwh: 200,
        solarPercent: 75,
        gridPercent: 5,
        generatorPercent: 20,
        generatorConfigured: true,
        generatorActiveIntervals: 1,
        estimatedGeneratorRuntimeHours: 1,
        matchedIntervals: 2,
        expectedIntervals: 24
      });
      expect(result.summary.solarVsGrid).toMatchObject({
        available: true,
        solarKwh: 90,
        companionKwh: 10,
        solarPercent: 90,
        companionPercent: 10,
        matchedActiveIntervals: 1,
        targetStatus: 'within_target'
      });
      expect(result.summary.solarVsGenerator).toMatchObject({
        configured: true,
        available: true,
        solarKwh: 60,
        companionKwh: 40,
        solarPercent: 60,
        companionPercent: 40,
        matchedActiveIntervals: 1,
        targetStatus: 'below_target'
      });
      expect(result.sourceTopology).toMatchObject({
        gridSourceIncludesGenerator: false,
        generatorSeparatelyMetered: true,
        sharedSupplyLabel: 'AEDC grid',
        externalAedcReconciliation: 'ready_for_md_meter_comparison'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('allocates only customer-load usage charges and excludes source-account debits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T09:15:00Z'));

    try {
      const request = vi.fn().mockImplementation(
        ({ path, query }: { path: string; query?: Record<string, unknown> }) => {
          if (path === '/meters/') {
            return Promise.resolve({
              count: 3,
              results: [
                { id: 1, reference: 'SOLAR', name: 'Solar source', customer: 10, offline_duration_status: 'Online' },
                { id: 2, reference: 'GRID', name: 'Grid source', customer: 20, offline_duration_status: 'Online' },
                { id: 3, reference: 'LOAD', name: 'Customer load', customer: 30, offline_duration_status: 'Online' }
              ]
            });
          }
          if (path === '/customers/') {
            return Promise.resolve({
              count: 3,
              results: [
                { id: 10, first_name: 'Power Room', last_name: 'Solar meter' },
                { id: 20, first_name: 'Power Room', last_name: 'Grid meter' },
                { id: 30, first_name: 'Ground Floor - 01', last_name: 'Tenant' }
              ]
            });
          }
          if (path === '/sites/') return Promise.resolve({ count: 0, results: [] });
          if (path === '/meters/1/directives/') {
            return Promise.resolve({
              count: 1,
              results: [{ timestamp: '2026-11-12T08:00:10Z', data: JSON.stringify({ usage_amount: 90 }) }]
            });
          }
          if (path === '/meters/2/directives/') {
            return Promise.resolve({
              count: 1,
              results: [{ timestamp: '2026-11-12T08:00:20Z', data: JSON.stringify({ usage_amount: 10 }) }]
            });
          }
          if (path === '/transactions/' && query?.category === 'UCH') {
            return Promise.resolve({
              count: 2,
              results: [
                { id: 10, timestamp: '2026-11-12T08:03:00Z', category: 'UCH', amount: -20300, customer_id: 30 },
                { id: 11, timestamp: '2026-11-12T08:04:00Z', category: 'UCH', amount: -500, customer_id: 10 }
              ]
            });
          }
          if (path === '/transactions/' && query?.category === 'PAY') {
            return Promise.resolve({ count: 0, results: [] });
          }
          throw new Error(`unexpected_path:${path}`);
        }
      );

      const result = await new SteamaOperationsService(
        { request },
        60_000,
        { retailTariffNgnPerKwh: 203 }
      ).getRevenueAnalysis('hourly');

      expect(result.summary).toMatchObject({
        customerUsageChargeNgn: 20300,
        usageChargeTransactions: 1,
        recordedPaymentNgn: null,
        paymentTransactions: 0,
        collectionsAvailable: false,
        energyValueNgn: 20300,
        accruedEnergyRevenueNgn: 20300,
        solarAccruedRevenueNgn: 18270,
        sharedSupplyAccruedRevenueNgn: 2030,
        generatorAccruedRevenueNgn: 0,
        solarAttributedChargeNgn: 18270,
        gridAttributedChargeNgn: 2030,
        generatorAttributedChargeNgn: 0,
        solarEnergyValueNgn: 18270,
        gridEnergyValueNgn: 2030
      });
      expect(result.sourceTopology).toEqual({
        gridSourceIncludesGenerator: true,
        generatorSeparatelyMetered: false,
        sharedSupplyLabel: 'AEDC / generator supply',
        state: 'shared_aedc_generator_meter',
        externalAedcReconciliation: 'unavailable_while_shared'
      });
      expect(result.summary).toMatchObject({
        sourceAccountChargeNgn: 500,
        sourceAccountTransactions: 1,
        solarSourceAccountChargeNgn: 500,
        excludedUsageChargeNgn: 500,
        unclassifiedUsageChargeNgn: 0
      });
      expect(result.warnings.join(' ')).toContain('actual cash collections are unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses cumulative source registers for YTD energy and Band A revenue when interval history is incomplete', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T23:32:00Z'));

    try {
      const archive = new InMemoryMeterArchiveRepository();
      await archive.upsertReadings([
        {
          source: 'utility_reading',
          intervalStart: '2026-11-06T09:00:00.000Z',
          timestamp: '2026-11-06T10:00:00.000Z',
          readingKwh: 30_000,
          usageKwh: 1_000,
          anomalous: false,
          meterId: '1',
          meterNumber: '0308000187515',
          customerId: '10',
          customerName: 'Power room solar source'
        },
        {
          source: 'utility_reading',
          intervalStart: '2026-11-14T21:00:00.000Z',
          timestamp: '2026-11-14T22:00:00.000Z',
          readingKwh: 31_881,
          usageKwh: 1_881,
          anomalous: false,
          meterId: '1',
          meterNumber: '0308000187515',
          customerId: '10',
          customerName: 'Power room solar source'
        },
        {
          source: 'utility_reading',
          intervalStart: '2026-11-06T09:00:00.000Z',
          timestamp: '2026-11-06T10:00:00.000Z',
          readingKwh: 17_000,
          usageKwh: 500,
          anomalous: false,
          meterId: '2',
          meterNumber: '0308000187523',
          customerId: '11',
          customerName: 'Power room grid source'
        },
        {
          source: 'utility_reading',
          intervalStart: '2026-11-14T21:00:00.000Z',
          timestamp: '2026-11-14T22:00:00.000Z',
          readingKwh: 17_969,
          usageKwh: 969,
          anomalous: false,
          meterId: '2',
          meterNumber: '0308000187523',
          customerId: '11',
          customerName: 'Power room grid source'
        }
      ]);
      const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path === '/meters/') {
          return Promise.resolve({
            count: 2,
            results: [
              {
                id: 1,
                reference: '0308000187515',
                name: 'Solar meter',
                customer: 10,
                customer_name: 'Power room solar source',
                latest_meter_reading: 31_881,
                latest_meter_reading_timestamp: '2026-11-14T22:00:00.000Z',
                offline_duration_status: 'Online'
              },
              {
                id: 2,
                reference: '0308000187523',
                name: 'GRID meter',
                customer: 11,
                customer_name: 'Power room grid source',
                latest_meter_reading: 17_969,
                latest_meter_reading_timestamp: '2026-11-14T22:00:00.000Z',
                offline_duration_status: 'Online'
              }
            ]
          });
        }
        if (path === '/customers/' || path === '/sites/' || path === '/transactions/') {
          return Promise.resolve({ count: 0, results: [] });
        }
        throw new Error(`unexpected_path:${path}`);
      });
      const service = new SteamaOperationsService(
        { request },
        60_000,
        {
          retailTariffNgnPerKwh: 203,
          meterArchiveRepository: archive,
          meterRegisterBaselines: [
            { meterNumber: '0308000187515', readingKwh: 0, effectiveAt: '2025-12-31T23:00:00.000Z' },
            { meterNumber: '0308000187523', readingKwh: 0, effectiveAt: '2025-12-31T23:00:00.000Z' }
          ]
        }
      );
      const customRange = { from: '2026-01-01', to: '2026-11-14' };
      const energy = await service.getEnergyMix('monthly', false, customRange);
      const revenue = await service.getRevenueAnalysis('monthly', false, customRange);

      expect(energy.summary).toMatchObject({
        solarKwh: 31_881,
        gridKwh: 17_969,
        totalKwh: 49_850,
        registerRecoveredKwh: 45_500,
        registerRecoveryEvents: 2
      });
      expect(revenue.summary).toMatchObject({
        solarKwh: 31_881,
        gridKwh: 17_969,
        totalKwh: 49_850,
        accruedEnergyRevenueNgn: 10_119_550,
        solarAccruedRevenueNgn: 6_471_843,
        sharedSupplyAccruedRevenueNgn: 3_647_707
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('classifies Na-Aka Hub positions and totals only assigned customer-meter interval usage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T09:15:00Z'));

    try {
      const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path === '/meters/') {
          return Promise.resolve({
            count: 3,
            results: [
              { id: 1, reference: 'LOAD-1', meter_type_name: 'DS3600', customer: 10, customer_name: 'F07 Na-aka Hub', offline_duration_status: 'Online' },
              { id: 2, reference: 'LOAD-2', meter_type_name: 'DS3100', customer: 11, customer_name: '3rd Floor - 01 - 04 BOI', offline_duration_status: 'Offline (2 days)' },
              { id: 3, reference: 'SOLAR', meter_type_name: 'DS3100', customer: 12, customer_name: 'Power Room Solar meter', offline_duration_status: 'Online' }
            ]
          });
        }
        if (path === '/customers/') {
          return Promise.resolve({
            count: 4,
            results: [
              { id: 10, first_name: 'F07', last_name: 'Na-aka Hub' },
              { id: 11, first_name: '3rd Floor - 01 - 04', last_name: 'BOI' },
              { id: 12, first_name: 'Power Room', last_name: 'Solar meter' },
              { id: 13, first_name: 'G01', last_name: 'Na-aka Hub' }
            ]
          });
        }
        if (path === '/sites/') return Promise.resolve({ count: 1, results: [{ id: 20, name: 'Na-Aka Hub' }] });
        if (path === '/meters/1/directives/') {
          return Promise.resolve({ count: 1, results: [{ timestamp: '2026-11-12T08:00:00Z', data: JSON.stringify({ usage_amount: 3 }) }] });
        }
        if (path === '/meters/2/directives/') {
          return Promise.resolve({ count: 1, results: [{ timestamp: '2026-11-12T08:00:00Z', data: JSON.stringify({ usage_amount: 10 }) }] });
        }
        throw new Error(`unexpected_path:${path}`);
      });

      const result = await new SteamaOperationsService(
        { request },
        60_000,
        { retailTariffNgnPerKwh: 203 }
      ).getFloorAnalysis('hourly');

      expect(result.summary).toMatchObject({
        totalPositions: 3,
        classifiedPositions: 3,
        unclassifiedPositions: 0,
        meteredPositions: 2,
        reportingPositions: 2,
        totalMeters: 2,
        totalUsageKwh: 13,
        estimatedValueNgn: 2639,
        observedIntervals: 2,
        expectedIntervals: 48
      });
      expect(result.floors.find((floor) => floor.key === 'first-floor')).toMatchObject({
        positionCount: 1,
        usageKwh: 3
      });
      expect(result.floors.find((floor) => floor.key === 'third-floor')).toMatchObject({
        positionCount: 1,
        usageKwh: 10
      });
      expect(result.positions.find((position) => position.customerId === '10')).toMatchObject({
        floorKey: 'first-floor',
        mappingEvidence: 'legacy_code',
        occupancyStatus: 'estate_placeholder'
      });
      expect(result.positions.some((position) => position.tenantName === 'Solar meter')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the shared 2026 commissioning epoch to include a customer meter cumulative register', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T08:15:00Z'));

    try {
      const archive = new InMemoryMeterArchiveRepository();
      await archive.upsertReadings([{
        source: 'utility_reading',
        intervalStart: '2026-11-08T07:00:00.000Z',
        timestamp: '2026-11-08T08:01:00.000Z',
        readingKwh: 1_745.95,
        usageKwh: 44.66,
        anomalous: false,
        meterId: '258980',
        meterNumber: '0179250930429',
        customerId: '1638023',
        customerName: '5th Floor -01 MicroAccess Corporate Office'
      }]);
      const request = vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path === '/meters/') {
          return Promise.resolve({
            count: 1,
            results: [{
              id: 258980,
              reference: '0179250930429',
              meter_type_name: 'DS3600',
              customer: 1638023,
              customer_name: '5th Floor -01 MicroAccess Corporate Office',
              latest_meter_reading: 1_745.95,
              latest_meter_reading_timestamp: '2026-11-08T08:01:00.000Z',
              offline_duration_status: 'Offline (6 days)'
            }]
          });
        }
        if (path === '/customers/') {
          return Promise.resolve({
            count: 1,
            results: [{
              id: 1638023,
              first_name: '5th Floor -01',
              last_name: 'MicroAccess Corporate Office',
              energy_price: 203,
              service_based_tariff: 'A'
            }]
          });
        }
        if (path === '/sites/') return Promise.resolve({ count: 1, results: [{ id: 20, name: 'Na-Aka Hub' }] });
        throw new Error(`unexpected_path:${path}`);
      });

      const result = await new SteamaOperationsService(
        { request },
        60_000,
        {
          retailTariffNgnPerKwh: 203,
          tariffEffectiveFrom: '2025-12-31T23:00:00.000Z',
          commissioningEpochAt: '2025-12-31T23:00:00.000Z',
          meterArchiveRepository: archive
        }
      ).getFloorAnalysis('monthly');

      expect(result.summary).toMatchObject({
        totalUsageKwh: 1_745.95,
        registerRecoveredKwh: 1_701.29,
        estimatedValueNgn: 354_427.85
      });
      expect(result.floors.find((floor) => floor.key === 'fifth-floor')).toMatchObject({
        usageKwh: 1_745.95,
        registerRecoveredKwh: 1_701.29
      });
      expect(result.positions.find((position) => position.customerId === '1638023')).toMatchObject({
        usageKwh: 1_745.95,
        registerRecoveredKwh: 1_701.29,
        observedIntervals: 1
      });
      expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/meters/258980/directives/' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
