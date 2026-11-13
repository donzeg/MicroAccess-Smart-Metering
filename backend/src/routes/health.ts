import type { FastifyInstance } from 'fastify';

import { env } from '../config/env.js';

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'msm-backend',
    operationMode: env.operationMode,
    providerMutationsEnabled: env.operationMode === 'legacy_prototype' && env.steamaEnabled
  }));

  app.get(
    '/api/v1/ops/rate-limit-metrics',
    { onRequest: [app.verifyJwt, app.requireRoles(['management'])] },
    async () => {
      return {
        generatedAt: new Date().toISOString(),
        policies: app.rateLimitTelemetrySnapshot()
      };
    }
  );

  app.get(
    '/api/v1/ops/runtime-capabilities',
    { onRequest: [app.verifyJwt, app.requireRoles(['management'])] },
    async () => ({
      operationMode: env.operationMode,
      storageMode: env.storageMode,
      customerSelfServiceEnabled: env.operationMode === 'legacy_prototype',
      providerReadOnlyIntegrationConfigured: env.operationMode === 'phase1_read_only' && env.steamaEnabled,
      localMeterArchiveEnabled:
        env.operationMode === 'phase1_read_only' && env.storageMode === 'postgres' && env.meterArchiveSyncEnabled,
      providerCreditEnabled: env.operationMode === 'legacy_prototype' && env.steamaEnabled,
      providerDirectivesEnabled: false
    })
  );

  if (env.operationMode === 'legacy_prototype') {
    app.get(
      '/api/v1/ops/reconciliation-metrics',
      { onRequest: [app.verifyJwt, app.requireRoles(['management'])] },
      async () => {
        return app.purchaseService.getReconciliationTelemetrySnapshot();
      }
    );
  }
};
