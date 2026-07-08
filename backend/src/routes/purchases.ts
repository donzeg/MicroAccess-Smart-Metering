import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const initiateSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive()
});

const idParamsSchema = z.object({
  purchaseId: z.string().uuid()
});

const paymentCallbackSchema = z.object({
  purchaseId: z.string().uuid(),
  status: z.enum(['confirmed', 'failed']),
  amount: z.number().positive().optional(),
  providerReference: z.string().min(1).optional()
});

const retryPendingSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20)
});

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const registerPurchaseRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    '/api/v1/purchases/initiate',
    {
      onRequest: [
        app.verifyJwt,
        app.requireRoles(['management', 'customer']),
        app.rateLimitGuard('purchases_initiate')
      ]
    },
    async (request, reply) => {
    const parsed = initiateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid initiate payload', errors: parsed.error.flatten() });
    }

    if (request.user?.role === 'customer' && request.user.customerId !== parsed.data.customerId) {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    const purchase = await app.purchaseService.initiate(parsed.data.customerId, parsed.data.amount, correlationId);
    return reply.code(201).send(purchase);
  }
  );

  app.post(
    '/api/v1/purchases/:purchaseId/payment-confirmed',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: 'Invalid purchase id' });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    try {
      const purchase = await app.purchaseService.markPaymentConfirmed(params.data.purchaseId, correlationId);
      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  }
  );

  app.post('/api/v1/payments/callback', { onRequest: [app.rateLimitGuard('callback')] }, async (request, reply) => {
    const parsed = paymentCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid callback payload', errors: parsed.error.flatten() });
    }

    const verification = app.callbackSecurityService.verify(request.headers as Record<string, unknown>, parsed.data);
    if (!verification.ok) {
      return reply.code(401).send({ message: 'Invalid callback authentication', reason: verification.reason });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();

    try {
      const purchase = await app.purchaseService.processPaymentCallback(parsed.data, correlationId);
      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  });

  app.post(
    '/api/v1/purchases/retry-pending',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
    const parsed = retryPendingSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid retry request payload', errors: parsed.error.flatten() });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    const result = await app.purchaseService.retryPendingCredits(parsed.data.limit, correlationId);
    return reply.send(result);
  }
  );

  app.post(
    '/api/v1/purchases/:purchaseId/credit-provider',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: 'Invalid purchase id' });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    try {
      const purchase = await app.purchaseService.creditViaProvider(params.data.purchaseId, correlationId);
      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  }
  );

  app.post(
    '/api/v1/purchases/:purchaseId/reconcile',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: 'Invalid purchase id' });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    try {
      const purchase = await app.purchaseService.reconcile(params.data.purchaseId, correlationId);
      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  }
  );

  app.post(
    '/api/v1/purchases/reconcile-failed',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('management_ops')] },
    async (request, reply) => {
    const parsed = retryPendingSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid reconcile request payload', errors: parsed.error.flatten() });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    const result = await app.purchaseService.reconcileFailedPurchases(parsed.data.limit, correlationId);
    return reply.send(result);
  }
  );

  app.get(
    '/api/v1/purchases/:purchaseId',
    {
      onRequest: [app.verifyJwt, app.requireRoles(['management', 'customer']), app.rateLimitGuard('reads')]
    },
    async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: 'Invalid purchase id' });
    }

    try {
      const purchase = await app.purchaseService.getById(params.data.purchaseId);

      if (request.user?.role === 'customer' && request.user.customerId !== purchase.customerId) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  }
  );

  app.get(
    '/api/v1/purchases/:purchaseId/audit-logs',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const query = auditLogQuerySchema.safeParse(request.query ?? {});
    if (!params.success || !query.success) {
      return reply.code(400).send({ message: 'Invalid request parameters' });
    }

    try {
      await app.purchaseService.getById(params.data.purchaseId);
      const logs = await app.purchaseService.getAuditLogs(params.data.purchaseId, query.data.limit);
      return reply.send({
        purchaseId: params.data.purchaseId,
        logs
      });
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  }
  );
};