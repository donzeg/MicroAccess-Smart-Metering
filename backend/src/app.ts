import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';
import { InMemoryPurchaseAuditLogRepository } from './repositories/inMemoryPurchaseAuditLogRepository.js';
import { InMemoryCustomerMeterRepository } from './repositories/inMemoryCustomerMeterRepository.js';
import { InMemoryPurchaseRepository } from './repositories/inMemoryPurchaseRepository.js';
import type { CustomerMeterRepository, PurchaseAuditLogRepository, PurchaseRepository } from './repositories/interfaces.js';
import { PgCustomerMeterRepository } from './repositories/pgCustomerMeterRepository.js';
import { PgPurchaseAuditLogRepository } from './repositories/pgPurchaseAuditLogRepository.js';
import { createPgPool, runPgMigrations } from './repositories/pgPool.js';
import { PgPurchaseRepository } from './repositories/pgPurchaseRepository.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMeterAnalyticsRoutes } from './routes/meterAnalytics.js';
import { registerMappingRoutes } from './routes/mappings.js';
import { registerMeterReadingRoutes } from './routes/meterReadings.js';
import { registerPurchaseRoutes } from './routes/purchases.js';
import { CallbackSecurityService } from './services/callbackSecurityService.js';
import { MeterReadingService } from './services/meterReadingService.js';
import { ProviderClient, SteamaProviderClient } from './services/providerClient.js';
import { PurchaseService } from './services/purchaseService.js';
import { PendingCreditRetryWorker } from './workers/pendingCreditRetryWorker.js';

declare module 'fastify' {
  interface FastifyInstance {
    purchaseService: PurchaseService;
    meterReadingService: MeterReadingService;
    customerMeterRepository: CustomerMeterRepository;
    callbackSecurityService: CallbackSecurityService;
  }
}

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  let pool: Pool | null = null;
  const usePostgres = env.storageMode === 'postgres' && env.databaseUrl.length > 0;

  if (usePostgres) {
    pool = createPgPool();
  }

  const purchaseRepository: PurchaseRepository = pool ? new PgPurchaseRepository(pool) : new InMemoryPurchaseRepository();
  const purchaseAuditLogRepository: PurchaseAuditLogRepository = pool
    ? new PgPurchaseAuditLogRepository(pool)
    : new InMemoryPurchaseAuditLogRepository();
  const customerMeterRepository: CustomerMeterRepository = pool
    ? new PgCustomerMeterRepository(pool)
    : new InMemoryCustomerMeterRepository();

  const useSteamaProvider = env.steamaEnabled && env.steamaUsername.length > 0 && env.steamaPassword.length > 0;
  const providerClient = useSteamaProvider
    ? new SteamaProviderClient({
        baseUrl: env.steamaBaseUrl,
        tokenPath: env.steamaTokenPath,
        username: env.steamaUsername,
        password: env.steamaPassword,
        timeoutMs: env.steamaTimeoutMs,
        requestsPerSecond: env.providerRateLimitRps
      })
    : new ProviderClient();

  app.log.info(
    { steamaEnabled: useSteamaProvider, storageMode: usePostgres ? 'postgres' : 'in_memory' },
    'Backend runtime mode selected'
  );
  const purchaseService = new PurchaseService(providerClient, purchaseRepository, purchaseAuditLogRepository);
  const meterReadingService = new MeterReadingService();
  const callbackSecurityService = new CallbackSecurityService({
    secret: env.callbackSecret,
    toleranceSeconds: env.callbackToleranceSeconds
  });
  const pendingCreditRetryWorker = new PendingCreditRetryWorker({
    enabled: env.retryWorkerEnabled,
    intervalMs: env.retryWorkerIntervalMs,
    batchLimit: env.retryWorkerBatchLimit,
    maxConsecutiveFailures: env.retryWorkerMaxConsecutiveFailures,
    backoffMultiplier: env.retryWorkerBackoffMultiplier,
    maxIntervalMs: env.retryWorkerMaxIntervalMs,
    purchaseService,
    logger: {
      info: (obj, msg) => app.log.info(obj, msg),
      warn: (obj, msg) => app.log.warn(obj, msg),
      error: (obj, msg) => app.log.error(obj, msg)
    }
  });

  app.decorate('purchaseService', purchaseService);
  app.decorate('meterReadingService', meterReadingService);
  app.decorate('customerMeterRepository', customerMeterRepository);
  app.decorate('callbackSecurityService', callbackSecurityService);

  app.addHook('onReady', async () => {
    if (pool) {
      await runPgMigrations(pool, {
        info: (obj, msg) => app.log.info(obj, msg)
      });
    }

    pendingCreditRetryWorker.start();
  });

  if (pool) {
    app.addHook('onClose', async () => {
      pendingCreditRetryWorker.stop();
      await pool?.end();
    });
  } else {
    app.addHook('onClose', async () => {
      pendingCreditRetryWorker.stop();
    });
  }

  app.register(authPlugin);
  app.register(rateLimitPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerMappingRoutes);
  app.register(registerMeterReadingRoutes);
  app.register(registerMeterAnalyticsRoutes);
  app.register(registerPurchaseRoutes);
  app.register(registerExportRoutes);

  return app;
};