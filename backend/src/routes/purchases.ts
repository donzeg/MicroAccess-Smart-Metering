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

export const registerPurchaseRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/api/v1/purchases/initiate', { onRequest: [app.verifyJwt] }, async (request, reply) => {
    const parsed = initiateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid initiate payload', errors: parsed.error.flatten() });
    }

    const correlationId = request.headers['x-correlation-id']?.toString() ?? randomUUID();
    const purchase = await app.purchaseService.initiate(parsed.data.customerId, parsed.data.amount, correlationId);
    return reply.code(201).send(purchase);
  });

  app.post('/api/v1/purchases/:purchaseId/payment-confirmed', { onRequest: [app.verifyJwt] }, async (request, reply) => {
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
  });

  app.post('/api/v1/purchases/:purchaseId/credit-provider', { onRequest: [app.verifyJwt] }, async (request, reply) => {
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
  });

  app.post('/api/v1/purchases/:purchaseId/reconcile', { onRequest: [app.verifyJwt] }, async (request, reply) => {
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
  });

  app.get('/api/v1/purchases/:purchaseId', { onRequest: [app.verifyJwt] }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ message: 'Invalid purchase id' });
    }

    try {
      const purchase = await app.purchaseService.getById(params.data.purchaseId);
      return reply.send(purchase);
    } catch {
      return reply.code(404).send({ message: 'Purchase not found' });
    }
  });
};