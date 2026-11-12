import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('Phase 1 read-only safety mode', () => {
  let app: FastifyInstance;
  let managementToken = '';
  const previousMode = process.env.MSM_OPERATION_MODE;
  const previousStorageMode = process.env.STORAGE_MODE;

  beforeAll(async () => {
    process.env.MSM_OPERATION_MODE = 'phase1_read_only';
    process.env.STORAGE_MODE = 'in_memory';
    vi.resetModules();

    const module = await import('../../src/app.js');
    app = module.buildApp();
    await app.ready();

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'change-me'
      }
    });
    expect(login.statusCode).toBe(200);
    managementToken = login.json().token as string;
  });

  afterAll(async () => {
    await app.close();

    if (previousMode === undefined) {
      delete process.env.MSM_OPERATION_MODE;
    } else {
      process.env.MSM_OPERATION_MODE = previousMode;
    }

    if (previousStorageMode === undefined) {
      delete process.env.STORAGE_MODE;
    } else {
      process.env.STORAGE_MODE = previousStorageMode;
    }
  });

  it('reports read-only capabilities without enabling provider mutations', async () => {
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      operationMode: 'phase1_read_only',
      providerMutationsEnabled: false
    });

    const capabilities = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/runtime-capabilities',
      headers: { Authorization: `Bearer ${managementToken}` }
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toMatchObject({
      operationMode: 'phase1_read_only',
      customerSelfServiceEnabled: false,
      providerCreditEnabled: false,
      providerDirectivesEnabled: false
    });
  });

  it('does not register legacy payment, provider-credit or manual-reading routes', async () => {
    const requests = [
      { method: 'POST' as const, url: '/api/v1/purchases/initiate', payload: { customerId: 'test', amount: 1 } },
      {
        method: 'POST' as const,
        url: '/api/v1/purchases/00000000-0000-4000-8000-000000000000/credit-provider',
        payload: {}
      },
      { method: 'POST' as const, url: '/api/v1/meters/test/readings', payload: { readingKwh: 1 } }
    ];

    for (const request of requests) {
      const response = await app.inject({
        ...request,
        headers: { Authorization: `Bearer ${managementToken}` }
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('keeps the live operations route explicit when provider credentials are not configured', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/steama/overview',
      headers: { Authorization: `Bearer ${managementToken}` }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: 'provider_not_configured',
      message: 'The SteamaCo read-only integration has not been configured.'
    });
  });

  it('keeps customer self-service disabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'customer',
        password: 'change-me-customer',
        role: 'customer'
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
