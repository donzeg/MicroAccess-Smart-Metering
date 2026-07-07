import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid login payload', errors: parsed.error.flatten() });
    }

    if (parsed.data.username !== env.appUser || parsed.data.password !== env.appPassword) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        sub: parsed.data.username,
        role: 'management'
      },
      env.jwtSecret,
      { expiresIn: '12h' }
    );

    return { token, tokenType: 'Bearer' };
  });
};