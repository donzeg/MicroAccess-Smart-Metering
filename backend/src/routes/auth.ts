import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';
import type { AuthRole } from '../types/auth.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(['management', 'customer']).default('management')
});

const signToken = (payload: { sub: string; role: AuthRole; customerId?: string }): string => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' });
};

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/api/v1/auth/login', { onRequest: [app.rateLimitGuard('auth_login')] }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid login payload', errors: parsed.error.flatten() });
    }

    if (parsed.data.role === 'management') {
      if (parsed.data.username !== env.appUser || parsed.data.password !== env.appPassword) {
        return reply.code(401).send({ message: 'Invalid credentials' });
      }

      const token = signToken({
        sub: parsed.data.username,
        role: 'management'
      });

      return { token, tokenType: 'Bearer' };
    }

    if (parsed.data.username !== env.customerUser || parsed.data.password !== env.customerPassword) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = signToken({
      sub: parsed.data.username,
      role: 'customer',
      customerId: env.customerId
    });

    return { token, tokenType: 'Bearer' };
  });
};