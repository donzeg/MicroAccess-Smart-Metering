import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { canonicalStringify } from '../../src/utils/canonicalJson.js';

const callbackSecret = 'change-me-callback-secret';

const buildCallbackHeaders = (payload: unknown, callbackId: string = randomUUID()): Record<string, string> => {
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

describe('MSM backend integration', () => {
  const app = buildApp();
  let token = '';
  let customerToken = '';

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

    const customerLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'customer',
        password: 'change-me-customer',
        role: 'customer'
      }
    });

    customerToken = customerLoginResponse.json().token as string;
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
      headers: buildCallbackHeaders({
        purchaseId,
        status: 'confirmed'
      }),
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

  it('reconciles failed purchases in batch via management endpoint', async () => {
    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 2600 }
    });

    expect(initiated.statusCode).toBe(201);
    const purchaseId = initiated.json().id as string;

    const callbackPayload = {
      purchaseId,
      status: 'failed' as const
    };
    const failedCallback = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers: buildCallbackHeaders(callbackPayload),
      payload: callbackPayload
    });

    expect(failedCallback.statusCode).toBe(200);
    expect(failedCallback.json().state).toBe('failed');

    const reconcileBatch = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/reconcile-failed',
      headers: { Authorization: `Bearer ${token}` },
      payload: { limit: 20 }
    });

    expect(reconcileBatch.statusCode).toBe(200);
    expect(reconcileBatch.json()).toMatchObject({
      attempted: expect.any(Number),
      reconciled: expect.any(Number),
      stillFailed: expect.any(Number)
    });
    expect(reconcileBatch.json().reconciled).toBeGreaterThanOrEqual(1);

    const purchase = await app.inject({
      method: 'GET',
      url: `/api/v1/purchases/${purchaseId}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(purchase.statusCode).toBe(200);
    expect(purchase.json().state).toBe('reconciled');

    const metricsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/reconciliation-metrics',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.json()).toMatchObject({
      generatedAt: expect.any(String),
      pendingRetry: {
        cycles: expect.any(Number),
        attempted: expect.any(Number),
        credited: expect.any(Number),
        failed: expect.any(Number),
        failureReasons: expect.any(Object)
      },
      failedReconciliation: {
        cycles: expect.any(Number),
        attempted: expect.any(Number),
        reconciled: expect.any(Number),
        stillFailed: expect.any(Number),
        stillFailedReasons: expect.any(Object)
      }
    });
    expect(metricsResponse.json().failedReconciliation.reconciled).toBeGreaterThanOrEqual(1);

    const customerMetricsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/reconciliation-metrics',
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    expect(customerMetricsResponse.statusCode).toBe(403);
  });

  it('prevents customer from initiating purchase for another customer id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { customerId: '1622914', amount: 1200 }
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows customer to initiate own purchase and blocks management-only endpoints', async () => {
    const ownPurchase = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { customerId: '1622913', amount: 1200 }
    });
    expect(ownPurchase.statusCode).toBe(201);

    const retryPending = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/retry-pending',
      headers: { Authorization: `Bearer ${customerToken}` },
      payload: { limit: 5 }
    });

    expect(retryPending.statusCode).toBe(403);
  });

  it('prevents customer from reading another customer mapping', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/customers/1622914/meters',
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects callback with invalid signature', async () => {
    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 1800 }
    });
    const purchaseId = initiated.json().id as string;

    const headers = buildCallbackHeaders({
      purchaseId,
      status: 'confirmed'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers: {
        ...headers,
        'x-callback-signature': 'invalid'
      },
      payload: {
        purchaseId,
        status: 'confirmed'
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects replayed callback id', async () => {
    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 2200 }
    });
    const purchaseId = initiated.json().id as string;

    const payload = {
      purchaseId,
      status: 'confirmed' as const
    };
    const headers = buildCallbackHeaders(payload, 'callback-replay-id');

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers,
      payload
    });
    expect(first.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/callback',
      headers,
      payload
    });

    expect(replay.statusCode).toBe(401);
  });

  it('exposes rate-limit metrics to management only', async () => {
    const managementResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/rate-limit-metrics',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(managementResponse.statusCode).toBe(200);
    const metricsPayload = managementResponse.json() as {
      policies: Record<string, { allowed: number; blocked: number; lastBlockedAt: string | null }>;
    };
    const expectedPolicies = ['auth_login', 'purchases_initiate', 'callback', 'management_ops', 'reads'];

    for (const policy of expectedPolicies) {
      const metrics = metricsPayload.policies[policy];
      expect(typeof metrics?.allowed).toBe('number');
      expect(typeof metrics?.blocked).toBe('number');
      expect(metrics.lastBlockedAt === null || typeof metrics.lastBlockedAt === 'string').toBe(true);
    }

    const customerResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/rate-limit-metrics',
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    expect(customerResponse.statusCode).toBe(403);
  });
});

describe('MSM backend rate limiting integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 when auth login limit is exceeded', async () => {
    let throttledResponse = null as Awaited<ReturnType<typeof app.inject>> | null;

    for (let index = 0; index < 60; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: `wrong-${index}`,
          password: 'bad-password'
        }
      });

      if (response.statusCode === 429) {
        throttledResponse = response;
        break;
      }
    }

    expect(throttledResponse).not.toBeNull();
    expect(throttledResponse?.statusCode).toBe(429);
    expect(throttledResponse?.headers['retry-after']).toBeDefined();
    expect(throttledResponse?.json()).toMatchObject({
      message: 'Too many requests',
      policy: 'auth_login'
    });
  });
});

describe('MSM purchase initiation rate limiting integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 when purchase initiation limit is exceeded', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });

    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;

    let throttledResponse = null as Awaited<ReturnType<typeof app.inject>> | null;

    for (let index = 0; index < 70; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/purchases/initiate',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          customerId: '1622913',
          amount: 500 + index
        }
      });

      if (response.statusCode === 429) {
        throttledResponse = response;
        break;
      }
    }

    expect(throttledResponse).not.toBeNull();
    expect(throttledResponse?.statusCode).toBe(429);
    expect(throttledResponse?.json()).toMatchObject({
      message: 'Too many requests',
      policy: 'purchases_initiate'
    });
  });
});

describe('MSM management operations rate limiting integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 when management operation limit is exceeded', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });

    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;

    let throttledResponse = null as Awaited<ReturnType<typeof app.inject>> | null;

    for (let index = 0; index < 140; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/purchases/retry-pending',
        headers: { Authorization: `Bearer ${token}` },
        payload: { limit: 1 }
      });

      if (response.statusCode === 429) {
        throttledResponse = response;
        break;
      }
    }

    expect(throttledResponse).not.toBeNull();
    expect(throttledResponse?.statusCode).toBe(429);
    expect(throttledResponse?.json()).toMatchObject({
      message: 'Too many requests',
      policy: 'management_ops'
    });
  });
});

describe('MSM callback rate limiting integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 with retry-after and increments callback blocked telemetry', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });

    expect(login.statusCode).toBe(200);
    const token = login.json().token as string;

    const initiated = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { customerId: '1622913', amount: 3000 }
    });
    expect(initiated.statusCode).toBe(201);
    const purchaseId = initiated.json().id as string;

    let throttledResponse = null as Awaited<ReturnType<typeof app.inject>> | null;

    for (let index = 0; index < 140; index += 1) {
      const callbackPayload = {
        purchaseId,
        status: 'confirmed' as const
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/callback',
        headers: buildCallbackHeaders(callbackPayload, `callback-burst-${index}`),
        payload: callbackPayload
      });

      if (response.statusCode === 429) {
        throttledResponse = response;
        break;
      }
    }

    expect(throttledResponse).not.toBeNull();
    expect(throttledResponse?.statusCode).toBe(429);
    expect(Number(throttledResponse?.headers['retry-after'] ?? '0')).toBeGreaterThan(0);
    expect(throttledResponse?.json()).toMatchObject({
      message: 'Too many requests',
      policy: 'callback'
    });

    const metricsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/rate-limit-metrics',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(metricsResponse.statusCode).toBe(200);
    const metricsPayload = metricsResponse.json() as {
      policies: {
        callback: {
          allowed: number;
          blocked: number;
          lastBlockedAt: string | null;
        };
      };
    };
    expect(metricsPayload.policies.callback.blocked).toBeGreaterThanOrEqual(1);
    expect(
      metricsPayload.policies.callback.lastBlockedAt === null ||
        typeof metricsPayload.policies.callback.lastBlockedAt === 'string'
    ).toBe(true);
  });
});