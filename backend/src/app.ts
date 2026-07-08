import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { InMemoryPurchaseAuditLogRepository } from './repositories/inMemoryPurchaseAuditLogRepository.js';
import { InMemoryCustomerMeterRepository } from './repositories/inMemoryCustomerMeterRepository.js';
import { InMemoryPurchaseRepository } from './repositories/inMemoryPurchaseRepository.js';
import type { CustomerMeterRepository, PurchaseAuditLogRepository, PurchaseRepository } from './repositories/interfaces.js';
import { PgCustomerMeterRepository } from './repositories/pgCustomerMeterRepository.js';
import { PgPurchaseAuditLogRepository } from './repositories/pgPurchaseAuditLogRepository.js';
import { createPgPool } from './repositories/pgPool.js';
import { PgPurchaseRepository } from './repositories/pgPurchaseRepository.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMappingRoutes } from './routes/mappings.js';
import { registerPurchaseRoutes } from './routes/purchases.js';
import { ProviderClient, SteamaProviderClient } from './services/providerClient.js';
import { PurchaseService } from './services/purchaseService.js';

declare module 'fastify' {
  interface FastifyInstance {
    purchaseService: PurchaseService;
    customerMeterRepository: CustomerMeterRepository;
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
        timeoutMs: env.steamaTimeoutMs
      })
    : new ProviderClient();

  app.log.info(
    { steamaEnabled: useSteamaProvider, storageMode: usePostgres ? 'postgres' : 'in_memory' },
    'Backend runtime mode selected'
  );
  const purchaseService = new PurchaseService(providerClient, purchaseRepository, purchaseAuditLogRepository);

  app.decorate('purchaseService', purchaseService);
  app.decorate('customerMeterRepository', customerMeterRepository);

  if (pool) {
    app.addHook('onClose', async () => {
      await pool?.end();
    });
  }

  app.register(authPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerMappingRoutes);
  app.register(registerPurchaseRoutes);

  return app;
};