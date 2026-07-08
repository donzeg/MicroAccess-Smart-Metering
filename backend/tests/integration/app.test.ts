import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

describe('MSM backend integration', () => {
  const app = buildApp();
  let token = '';

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });

    token = loginResponse.json().token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns healthy status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('blocks unauthorized mapping requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/customers/1622913/meters' });
    expect(response.statusCode).toBe(401);
  });

  it('runs purchase lifecycle to credited state', async () => {
    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 5000 }
    });
    expect(initiated.statusCode).toBe(201);

    const purchaseId = initiated.json().id as string;

    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/purchases/${purchaseId}/payment-confirmed`,
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(confirmed.statusCode).toBe(200);

    const credited = await app.inject({
      method: 'POST',
      url: `/api/v1/purchases/${purchaseId}/credit-provider`,
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(credited.statusCode).toBe(200);
    expect(credited.json().state).toBe('credited');
  });

  it('processes callback, retries pending purchases, and exposes audit logs', async () => {
    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 2500 }
    });

    const purchaseId = initiated.json().id as string;

    const callback = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      payload: {
        purchaseId,
        status: 'confirmed'
      }
    });

    expect(callback.statusCode).toBe(200);
    expect(callback.json().state).toBe('payment_confirmed_credit_pending');

    const retry = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/retry-pending',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        limit: 20
      }
    });

    expect(retry.statusCode).toBe(200);
    expect(retry.json().attempted).toBeGreaterThanOrEqual(1);

    const auditLogs = await app.inject({
      method: 'GET',
      url: `/api/v1/purchases/${purchaseId}/audit-logs?limit=50`,
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(auditLogs.statusCode).toBe(200);
    const payload = auditLogs.json() as { logs: Array<{ action: string }> };
    expect(payload.logs.length).toBeGreaterThan(0);
    expect(payload.logs.some((entry) => entry.action === 'payment_callback_received')).toBe(true);
  });
});