import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { SteamaReadOnlyError } from '../services/steamaReadOnlyClient.js';
import { FloorPositionNotFoundError, FloorTenancyConflictError } from '../types/floorTenancy.js';

const overviewQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional().default('false')
});

const meterParamsSchema = z.object({
  providerId: z.string().regex(/^\d+$/).max(32)
});

const historyQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional().default('false')
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const energyMixQuerySchema = z.object({
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional().default('daily'),
  refresh: z.enum(['true', 'false']).optional().default('false'),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional()
});

const tenancyParamsSchema = z.object({
  providerCustomerId: z.string().regex(/^\d+$/).max(32)
});

const tenancyBodySchema = z.object({
  providerCustomerId: z.string().regex(/^\d+$/).max(32),
  tenantName: z.string().trim().min(1).max(160),
  effectiveFrom: z.string().refine((value) => {
    const timestamp = new Date(value).getTime();
    return !Number.isNaN(timestamp) && timestamp <= Date.now();
  }),
  evidenceReference: z.string().trim().min(1).max(240).default('management_confirmed')
});

const validDateOnly = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validEnergyRange = (period: string, from?: string, to?: string): boolean => {
  if (!from && !to) return true;
  if (!from || !to || !validDateOnly(from) || !validDateOnly(to)) return false;
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime();
  const inclusiveDays = Math.round((toMs - fromMs) / 86_400_000) + 1;
  if (inclusiveDays < 1 || inclusiveDays > 366) return false;
  return period !== 'hourly' || inclusiveDays <= 31;
};

const sendProviderError = (error: unknown, reply: FastifyReply): FastifyReply => {
  if (error instanceof SteamaReadOnlyError) {
    const statusCode = error.status === 401 || error.status === 403 ? 502 : error.status === 404 ? 404 : 503;
    return reply.code(statusCode).send({
      code: error.code,
      message: 'SteamaCo data is temporarily unavailable.',
      providerStatus: error.status
    });
  }

  return reply.code(503).send({
    code: 'provider_data_unavailable',
    message: 'SteamaCo data is temporarily unavailable.'
  });
};

export const registerSteamaOperationsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/ops/steama/archive-status',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (_request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }
      return app.steamaOperationsService.getArchiveStatus();
    }
  );

  app.get(
    '/api/v1/ops/steama/overview',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }

      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ code: 'invalid_query', message: 'Invalid overview query.' });
      }

      try {
        return await app.steamaOperationsService.getOverview(parsed.data.refresh === 'true');
      } catch (error) {
        request.log.error({ errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' }, 'Steama overview failed');
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/energy-mix',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }

      const parsed = energyMixQuerySchema.safeParse(request.query);
      if (
        !parsed.success ||
        !validEnergyRange(
          parsed.success ? parsed.data.period : '',
          parsed.success ? parsed.data.from : undefined,
          parsed.success ? parsed.data.to : undefined
        )
      ) {
        return reply.code(400).send({ code: 'invalid_query', message: 'Invalid energy mix query.' });
      }

      try {
        return await app.steamaOperationsService.getEnergyMix(
          parsed.data.period,
          parsed.data.refresh === 'true',
          parsed.data.from && parsed.data.to ? { from: parsed.data.from, to: parsed.data.to } : undefined
        );
      } catch (error) {
        request.log.error(
          { errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' },
          'Steama energy mix failed'
        );
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/revenue-costs',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }

      const parsed = energyMixQuerySchema.safeParse(request.query);
      if (
        !parsed.success ||
        !validEnergyRange(
          parsed.success ? parsed.data.period : '',
          parsed.success ? parsed.data.from : undefined,
          parsed.success ? parsed.data.to : undefined
        )
      ) {
        return reply.code(400).send({ code: 'invalid_query', message: 'Invalid revenue and energy cost query.' });
      }

      try {
        return await app.steamaOperationsService.getRevenueAnalysis(
          parsed.data.period,
          parsed.data.refresh === 'true',
          parsed.data.from && parsed.data.to ? { from: parsed.data.from, to: parsed.data.to } : undefined
        );
      } catch (error) {
        request.log.error(
          { errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' },
          'Steama revenue and energy cost analysis failed'
        );
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/floors',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }

      const parsed = energyMixQuerySchema.safeParse(request.query);
      if (
        !parsed.success ||
        !validEnergyRange(
          parsed.success ? parsed.data.period : '',
          parsed.success ? parsed.data.from : undefined,
          parsed.success ? parsed.data.to : undefined
        )
      ) {
        return reply.code(400).send({ code: 'invalid_query', message: 'Invalid floor analysis query.' });
      }

      try {
        return await app.steamaOperationsService.getFloorAnalysis(
          parsed.data.period,
          parsed.data.refresh === 'true',
          parsed.data.from && parsed.data.to ? { from: parsed.data.from, to: parsed.data.to } : undefined
        );
      } catch (error) {
        request.log.error(
          { errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' },
          'Steama floor analysis failed'
        );
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/floor-tenancies/:providerCustomerId',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({ code: 'provider_not_configured', message: 'Floor operations are not configured.' });
      }
      const parsed = tenancyParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ code: 'invalid_position_id', message: 'Invalid floor position identifier.' });
      }
      const timeline = await app.steamaOperationsService.getFloorTenancyTimeline(parsed.data.providerCustomerId);
      if (!timeline) {
        return reply.code(404).send({ code: 'floor_position_not_found', message: 'The floor position has not been observed yet.' });
      }
      return timeline;
    }
  );

  app.post(
    '/api/v1/ops/floor-tenancies',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({ code: 'provider_not_configured', message: 'Floor operations are not configured.' });
      }
      const parsed = tenancyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ code: 'invalid_tenancy', message: 'The tenant name and effective date are required.' });
      }
      try {
        const timeline = await app.steamaOperationsService.recordFloorTenancy({
          ...parsed.data,
          effectiveFrom: new Date(parsed.data.effectiveFrom).toISOString(),
          actorReference: request.user?.sub ?? 'unknown-management-user'
        });
        return reply.code(201).send(timeline);
      } catch (error) {
        if (error instanceof FloorPositionNotFoundError) {
          return reply.code(404).send({ code: 'floor_position_not_found', message: 'Refresh floor operations before recording this tenant.' });
        }
        if (error instanceof FloorTenancyConflictError) {
          return reply.code(409).send({ code: 'tenancy_date_conflict', message: 'A tenant record already starts at that exact date and time.' });
        }
        request.log.error({ errorCode: 'floor_tenancy_record_failed' }, 'Floor tenancy record failed');
        return reply.code(500).send({ code: 'floor_tenancy_record_failed', message: 'The tenant record could not be saved.' });
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/meters/:providerId',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({
          code: 'provider_not_configured',
          message: 'The SteamaCo read-only integration has not been configured.'
        });
      }

      const parsed = meterParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ code: 'invalid_meter_id', message: 'Invalid SteamaCo meter identifier.' });
      }

      try {
        return await app.steamaOperationsService.getMeter(parsed.data.providerId);
      } catch (error) {
        request.log.error({ errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' }, 'Steama meter lookup failed');
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/meters/:providerId/history',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({ code: 'provider_not_configured', message: 'The SteamaCo read-only integration has not been configured.' });
      }
      const params = meterParamsSchema.safeParse(request.params);
      const query = historyQuerySchema.safeParse(request.query);
      if (!params.success || !query.success) {
        return reply.code(400).send({ code: 'invalid_history_request', message: 'Invalid meter history request.' });
      }
      try {
        return await app.steamaOperationsService.getMeterHistory(params.data.providerId, query.data.refresh === 'true');
      } catch (error) {
        request.log.error({ errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' }, 'Steama meter history failed');
        return sendProviderError(error, reply);
      }
    }
  );

  app.get(
    '/api/v1/ops/steama/customers/:providerId',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      if (!app.steamaOperationsService) {
        return reply.code(503).send({ code: 'provider_not_configured', message: 'The SteamaCo read-only integration has not been configured.' });
      }
      const parsed = meterParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ code: 'invalid_customer_id', message: 'Invalid SteamaCo customer identifier.' });
      }
      try {
        return await app.steamaOperationsService.getCustomer(parsed.data.providerId);
      } catch (error) {
        request.log.error({ errorCode: error instanceof SteamaReadOnlyError ? error.code : 'unknown' }, 'Steama customer lookup failed');
        return sendProviderError(error, reply);
      }
    }
  );
};
