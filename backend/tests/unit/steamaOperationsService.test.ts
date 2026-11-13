import { describe, expect, it, vi } from 'vitest';

import { InMemoryMeterArchiveRepository } from '../../src/repositories/inMemoryMeterArchiveRepository.js';
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
    expect(request).toHaveBeenCalledTimes(1);
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

  it('compares solar and grid only across matched hourly usage intervals', async () => {
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
        solarKwh: 90,
        gridKwh: 10,
        totalKwh: 100,
        solarPercent: 90,
        gridPercent: 10,
        targetStatus: 'within_target',
        generatorConfigured: false,
        generatorKwh: 0,
        matchedIntervals: 1,
        expectedIntervals: 24
      });
      expect(result.sourceMeters).toHaveLength(2);
      expect(result.buckets.find((bucket) => bucket.totalKwh === 100)).toMatchObject({
        solarKwh: 90,
        gridKwh: 10,
        matchedIntervals: 1
      });
      expect(result.summary.totalKwh).not.toBe(150);
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
          const usage = path.includes('/1/') ? 90 : 5;
          return Promise.resolve({
            count: 1,
            results: [{ timestamp: '2026-11-10T08:00:00Z', data: JSON.stringify({ usage_amount: usage }) }]
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
        solarKwh: 90,
        gridKwh: 5,
        generatorKwh: 5,
        totalKwh: 100,
        solarPercent: 90,
        gridPercent: 5,
        generatorPercent: 5,
        generatorConfigured: true,
        generatorActiveIntervals: 1,
        estimatedGeneratorRuntimeHours: 1,
        matchedIntervals: 1,
        expectedIntervals: 24
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('allocates provider usage charges by matched source energy without inventing cash collections', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T09:15:00Z'));

    try {
      const request = vi.fn().mockImplementation(
        ({ path, query }: { path: string; query?: Record<string, unknown> }) => {
          if (path === '/meters/') {
            return Promise.resolve({
              count: 2,
              results: [
                { id: 1, reference: 'SOLAR', name: 'Solar source', offline_duration_status: 'Online' },
                { id: 2, reference: 'GRID', name: 'Grid source', offline_duration_status: 'Online' }
              ]
            });
          }
          if (path === '/customers/' || path === '/sites/') return Promise.resolve({ count: 0, results: [] });
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
              count: 1,
              results: [{ id: 10, timestamp: '2026-11-12T08:03:00Z', category: 'UCH', amount: -20300 }]
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
        solarAttributedChargeNgn: 18270,
        gridAttributedChargeNgn: 2030,
        generatorAttributedChargeNgn: 0,
        solarEnergyValueNgn: 18270,
        gridEnergyValueNgn: 2030
      });
      expect(result.warnings.join(' ')).toContain('actual cash collections are unavailable');
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
});
