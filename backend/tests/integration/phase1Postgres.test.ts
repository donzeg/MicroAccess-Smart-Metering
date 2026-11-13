import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const postgresUrl = process.env.TEST_POSTGRES_URL;
const describeWhenPostgres = postgresUrl ? describe : describe.skip;

describeWhenPostgres('Phase 1 PostgreSQL startup', () => {
  let app: FastifyInstance;
  let managementToken = '';
  const controlledEnvironment: Record<string, string> = {
    NODE_ENV: 'production',
    MSM_OPERATION_MODE: 'phase1_read_only',
    STORAGE_MODE: 'postgres',
    DATABASE_URL: postgresUrl ?? '',
    JWT_SECRET: 'phase1-jwt-secret-for-isolated-postgres-validation',
    APP_USER: 'phase1-operator',
    APP_PASSWORD: 'phase1-operator-password-for-validation',
    CALLBACK_SECRET: 'phase1-callback-secret-for-isolated-validation',
    STEAMA_ENABLED: 'false',
    RETRY_WORKER_ENABLED: 'false'
  };
  const originalEnvironment = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const [key, value] of Object.entries(controlledEnvironment)) {
      originalEnvironment.set(key, process.env[key]);
      process.env[key] = value;
    }

    vi.resetModules();
    const module = await import('../../src/app.js');
    app = module.buildApp();
    await app.ready();

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: controlledEnvironment.APP_USER,
        password: controlledEnvironment.APP_PASSWORD
      }
    });
    expect(login.statusCode).toBe(200);
    managementToken = login.json().token as string;
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('applies the Phase 1 foundation and floor tenancy history migrations', async () => {
    const pool = new Pool({ connectionString: postgresUrl });
    try {
      const result = await pool.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
      expect(result.rows.map((row) => row.id)).toEqual([
        '0002_phase1_read_only_foundation',
        '0003_floor_tenancy_history',
        '0004_meter_reading_archive',
        '0005_operational_snapshots'
      ]);
    } finally {
      await pool.end();
    }
  });

  it('starts in read-only mode with mutation routes absent', async () => {
    const capabilities = await app.inject({
      method: 'GET',
      url: '/api/v1/ops/runtime-capabilities',
      headers: { Authorization: `Bearer ${managementToken}` }
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toMatchObject({
      operationMode: 'phase1_read_only',
      storageMode: 'postgres',
      providerCreditEnabled: false,
      providerDirectivesEnabled: false
    });

    const purchase = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases/initiate',
      headers: { Authorization: `Bearer ${managementToken}` },
      payload: { customerId: 'test', amount: 1 }
    });
    expect(purchase.statusCode).toBe(404);
  });
});
