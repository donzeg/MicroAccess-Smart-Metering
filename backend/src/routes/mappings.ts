import type { FastifyInstance } from 'fastify';

export const registerMappingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/customers/:customerId/meters',
    { onRequest: [app.verifyJwt, app.requireRoles(['management', 'customer']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
    const customerId = (request.params as { customerId: string }).customerId;
    const user = request.user;

    if (user?.role === 'customer' && user.customerId !== customerId) {
      return reply.code(403).send({ message: 'Forbidden' });
    }

    const meters = await app.customerMeterRepository.findByCustomerId(customerId);

    if (meters.length === 0) {
      return reply.code(404).send({ message: 'No meter mappings found for customer' });
    }

    return {
      customerId,
      meters
    };
  }
  );
};