import Fastify, { type FastifyInstance } from 'fastify';

import { authPlugin } from './plugins/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMappingRoutes } from './routes/mappings.js';
import { registerPurchaseRoutes } from './routes/purchases.js';
import { ProviderClient } from './services/providerClient.js';
import { PurchaseService } from './services/purchaseService.js';

declare module 'fastify' {
  interface FastifyInstance {
    purchaseService: PurchaseService;
  }
}

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  const providerClient = new ProviderClient();
  const purchaseService = new PurchaseService(providerClient);

  app.decorate('purchaseService', purchaseService);

  app.register(authPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerMappingRoutes);
  app.register(registerPurchaseRoutes);

  return app;
};