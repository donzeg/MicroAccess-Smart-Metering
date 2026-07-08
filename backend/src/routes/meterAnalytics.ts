import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  fromRecordedAt: z.coerce.date().optional(),
  toRecordedAt: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(10)
});

const resolveMeterIds = async (app: FastifyInstance, customerId?: string): Promise<string[] | undefined> => {
  if (!customerId) {
    return undefined;
  }

  const mappings = await app.customerMeterRepository.findByCustomerId(customerId);
  return mappings.map((entry) => entry.meterId);
};

export const registerMeterAnalyticsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/ops/meters/analytics/summary',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const query = analyticsQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.code(400).send({ message: 'Invalid analytics query parameters', errors: query.error.flatten() });
      }

      const meterIds = await resolveMeterIds(app, query.data.customerId);
      const summary = app.meterReadingService.getAnalyticsSummary({
        meterIds,
        fromRecordedAt: query.data.fromRecordedAt?.toISOString(),
        toRecordedAt: query.data.toRecordedAt?.toISOString()
      });

      return reply.send({
        filters: {
          customerId: query.data.customerId ?? null,
          fromRecordedAt: query.data.fromRecordedAt?.toISOString() ?? null,
          toRecordedAt: query.data.toRecordedAt?.toISOString() ?? null
        },
        summary
      });
    }
  );

  app.get(
    '/api/v1/ops/meters/analytics/top-consumers',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const query = analyticsQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.code(400).send({ message: 'Invalid analytics query parameters', errors: query.error.flatten() });
      }

      const meterIds = await resolveMeterIds(app, query.data.customerId);
      const rows = app.meterReadingService.getTopConsumers(
        {
          meterIds,
          fromRecordedAt: query.data.fromRecordedAt?.toISOString(),
          toRecordedAt: query.data.toRecordedAt?.toISOString()
        },
        query.data.limit
      );

      return reply.send({
        filters: {
          customerId: query.data.customerId ?? null,
          fromRecordedAt: query.data.fromRecordedAt?.toISOString() ?? null,
          toRecordedAt: query.data.toRecordedAt?.toISOString() ?? null,
          limit: query.data.limit
        },
        rows
      });
    }
  );
};
