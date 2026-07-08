import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const meterParamsSchema = z.object({
  meterId: z.string().min(1)
});

const ingestSchema = z.object({
  readingKwh: z.number().positive(),
  source: z.enum(['manual', 'sync', 'provider']).default('manual'),
  recordedAt: z.coerce.date().optional()
});

const listQuerySchema = z.object({
  fromRecordedAt: z.coerce.date().optional(),
  toRecordedAt: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).max(10000).default(0)
});

const aggregateQuerySchema = z.object({
  bucket: z.enum(['hour', 'day']).default('day'),
  fromRecordedAt: z.coerce.date().optional(),
  toRecordedAt: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).max(10000).default(0)
});

const customerCanAccessMeter = async (app: FastifyInstance, customerId: string, meterId: string): Promise<boolean> => {
  const mappedMeters = await app.customerMeterRepository.findByCustomerId(customerId);
  return mappedMeters.some((meter) => meter.meterId === meterId);
};

export const registerMeterReadingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    '/api/v1/meters/:meterId/readings',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
      const params = meterParamsSchema.safeParse(request.params);
      const payload = ingestSchema.safeParse(request.body);
      if (!params.success || !payload.success) {
        return reply.code(400).send({ message: 'Invalid ingest payload', errors: payload.success ? null : payload.error.flatten() });
      }

      const ingested = app.meterReadingService.ingest({
        meterId: params.data.meterId,
        readingKwh: payload.data.readingKwh,
        source: payload.data.source,
        recordedAt: payload.data.recordedAt?.toISOString() ?? new Date().toISOString()
      });

      return reply.code(201).send(ingested);
    }
  );

  app.get(
    '/api/v1/meters/:meterId/readings',
    { onRequest: [app.verifyJwt, app.requireRoles(['management', 'customer']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const params = meterParamsSchema.safeParse(request.params);
      const query = listQuerySchema.safeParse(request.query ?? {});
      if (!params.success || !query.success) {
        return reply.code(400).send({ message: 'Invalid read request parameters' });
      }

      if (request.user?.role === 'customer') {
        const customerId = request.user.customerId;
        if (!customerId) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        const canAccess = await customerCanAccessMeter(app, customerId, params.data.meterId);
        if (!canAccess) {
          return reply.code(403).send({ message: 'Forbidden' });
        }
      }

      const rows = app.meterReadingService.list({
        meterId: params.data.meterId,
        fromRecordedAt: query.data.fromRecordedAt?.toISOString(),
        toRecordedAt: query.data.toRecordedAt?.toISOString(),
        limit: query.data.limit,
        offset: query.data.offset
      });

      return reply.send({
        meterId: params.data.meterId,
        count: rows.length,
        rows
      });
    }
  );

  app.get(
    '/api/v1/meters/:meterId/readings/aggregates',
    { onRequest: [app.verifyJwt, app.requireRoles(['management', 'customer']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const params = meterParamsSchema.safeParse(request.params);
      const query = aggregateQuerySchema.safeParse(request.query ?? {});
      if (!params.success || !query.success) {
        return reply.code(400).send({ message: 'Invalid aggregate request parameters' });
      }

      if (request.user?.role === 'customer') {
        const customerId = request.user.customerId;
        if (!customerId) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        const canAccess = await customerCanAccessMeter(app, customerId, params.data.meterId);
        if (!canAccess) {
          return reply.code(403).send({ message: 'Forbidden' });
        }
      }

      const rows = app.meterReadingService.aggregate({
        meterId: params.data.meterId,
        bucket: query.data.bucket,
        fromRecordedAt: query.data.fromRecordedAt?.toISOString(),
        toRecordedAt: query.data.toRecordedAt?.toISOString(),
        limit: query.data.limit,
        offset: query.data.offset
      });

      return reply.send({
        meterId: params.data.meterId,
        bucket: query.data.bucket,
        count: rows.length,
        rows
      });
    }
  );
};
