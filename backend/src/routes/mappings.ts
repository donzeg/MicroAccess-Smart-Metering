import type { FastifyInstance } from 'fastify';

export const registerMappingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/v1/customers/:customerId/meters', { onRequest: [app.verifyJwt] }, async (request, reply) => {
    const customerId = (request.params as { customerId: string }).customerId;
    const meters = await app.customerMeterRepository.findByCustomerId(customerId);

    if (meters.length === 0) {
      return reply.code(404).send({ message: 'No meter mappings found for customer' });
    }

    return {
      customerId,
      meters
    };
  });
};