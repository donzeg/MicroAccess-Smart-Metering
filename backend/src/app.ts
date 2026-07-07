import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMappingRoutes } from './routes/mappings.js';
import { registerPurchaseRoutes } from './routes/purchases.js';
import { ProviderClient, SteamaProviderClient } from './services/providerClient.js';
import { PurchaseService } from './services/purchaseService.js';

declare module 'fastify' {
  interface FastifyInstance {
    purchaseService: PurchaseService;
  }
}

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

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

  app.log.info({ steamaEnabled: useSteamaProvider }, 'Provider mode selected');
  const purchaseService = new PurchaseService(providerClient);

  app.decorate('purchaseService', purchaseService);

  app.register(authPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerMappingRoutes);
  app.register(registerPurchaseRoutes);

  return app;
};