import type { FastifyInstance } from 'fastify';

export const registerHealthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/health', async () => ({ status: 'ok', service: 'msm-backend' }));

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
};