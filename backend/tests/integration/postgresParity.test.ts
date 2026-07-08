import { createHmac } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../src/utils/canonicalJson.js';

const callbackSecret = 'change-me-callback-secret';
const postgresUrl = process.env.TEST_POSTGRES_URL;
const describeWhenPostgres = postgresUrl ? describe : describe.skip;

const buildCallbackHeaders = (payload: unknown, callbackId: string): Record<string, string> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', callbackSecret)
    .update(`${timestamp}.${callbackId}.${canonicalStringify(payload)}`)
    .digest('hex');

  return {
    'x-callback-id': callbackId,
    'x-callback-timestamp': timestamp,
    'x-callback-signature': signature
  };
};

describeWhenPostgres('MSM postgres parity integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.STORAGE_MODE = 'postgres';
    process.env.DATABASE_URL = postgresUrl;
    process.env.RETRY_WORKER_ENABLED = 'false';
    process.env.STEAMA_ENABLED = 'false';

    vi.resetModules();
    const module = await import('../../src/app.js');
    app = module.buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs core purchase lifecycle and reconciliation flows against postgres storage', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    const token = loginResponse.json().token as string;

    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 3100 }
    });

    expect(initiated.statusCode).toBe(201);
    const purchaseId = initiated.json().id as string;

    const confirmedPayload = {
      purchaseId,
      status: 'confirmed' as const
    };
    const callbackConfirmed = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers: {
        ...buildCallbackHeaders(confirmedPayload, `${purchaseId}-confirmed`),
        'x-correlation-id': 'postgres-parity-callback-correlation'
      },
      payload: confirmedPayload
    });

    expect(callbackConfirmed.statusCode).toBe(200);
    expect(callbackConfirmed.json().state).toBe('payment_confirmed_credit_pending');

    const retryPending = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/retry-pending',
      headers: { Authorization: `Bearer ${token}` },
      payload: { limit: 20 }
    });

    expect(retryPending.statusCode).toBe(200);
    expect(retryPending.json()).toMatchObject({
      attempted: expect.any(Number),
      credited: expect.any(Number),
      failed: expect.any(Number),
      failureReasons: expect.any(Object)
    });

    const purchaseRead = await app.inject({
      method: 'GET',
      url: `/api/v1/purchases/${purchaseId}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(purchaseRead.statusCode).toBe(200);
    expect(purchaseRead.json().state).toBe('credited');

    const failedInitiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 3200 }
    });

    expect(failedInitiated.statusCode).toBe(201);
    const failedPurchaseId = failedInitiated.json().id as string;

    const failedPayload = {
      purchaseId: failedPurchaseId,
      status: 'failed' as const
    };
    const callbackFailed = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers: buildCallbackHeaders(failedPayload, `${failedPurchaseId}-failed`),
      payload: failedPayload
    });

    expect(callbackFailed.statusCode).toBe(200);
    expect(callbackFailed.json().state).toBe('failed');

    const reconcileBatch = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/reconcile-failed',
      headers: { Authorization: `Bearer ${token}` },
      payload: { limit: 20 }
    });

    expect(reconcileBatch.statusCode).toBe(200);
    expect(reconcileBatch.json().reconciled).toBeGreaterThanOrEqual(1);

    const filteredAuditLogs = await app.inject({
      method: 'GET',
      url:
        '/api/v1/purchases/audit-logs?purchaseId=' +
        purchaseId +
        '&action=payment_callback_received&correlationId=postgres-parity-callback-correlation&limit=10&offset=0',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(filteredAuditLogs.statusCode).toBe(200);
    expect(filteredAuditLogs.json()).toMatchObject({
      logs: [
        {
          purchaseId,
          action: 'payment_callback_received',
          correlationId: 'postgres-parity-callback-correlation'
        }
      ]
    });

    const metricsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/reconciliation-metrics',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json()).toMatchObject({
      pendingRetry: {
        attempted: expect.any(Number)
      },
      failedReconciliation: {
        reconciled: expect.any(Number)
      }
    });

    const transactionExport = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/exports/transactions?states=credited,reconciled&limit=20&offset=0&format=json',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(transactionExport.statusCode).toBe(200);
    expect(transactionExport.json()).toMatchObject({
      summary: {
        count: expect.any(Number),
        totalAmount: expect.any(Number)
      },
      rows: expect.any(Array)
    });

    const reconciliationExportCsv = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/exports/reconciliation?states=failed,reconciled&limit=20&offset=0&format=csv',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(reconciliationExportCsv.statusCode).toBe(200);
    expect(reconciliationExportCsv.headers['content-type']).toContain('text/csv');
    expect(reconciliationExportCsv.body).toContain('reconciliationStatus');

    const ingestedMeterReading = await app.inject({
      method: 'POST',
      url: '/api/v1/meters/meter-abuja-001/readings',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        readingKwh: 14.7,
        source: 'manual',
        recordedAt: '2026-07-08T10:00:00.000Z'
      }
    });

    expect(ingestedMeterReading.statusCode).toBe(201);

    const meterReadings = await app.inject({
      method: 'GET',
      url: '/api/v1/meters/meter-abuja-001/readings?limit=20',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(meterReadings.statusCode).toBe(200);
    expect(meterReadings.json()).toMatchObject({
      meterId: 'meter-abuja-001',
      rows: expect.any(Array)
    });

    const meterAggregates = await app.inject({
      method: 'GET',
      url:
        '/api/v1/meters/meter-abuja-001/readings/aggregates?bucket=day&fromRecordedAt=2026-07-08T00:00:00.000Z&toRecordedAt=2026-07-08T23:59:59.000Z',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(meterAggregates.statusCode).toBe(200);
    expect(meterAggregates.json()).toMatchObject({
      meterId: 'meter-abuja-001',
      bucket: 'day',
      rows: expect.any(Array)
    });
  });
});
