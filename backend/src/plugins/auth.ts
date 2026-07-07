import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    verifyJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: string | jwt.JwtPayload;
  }
}

export const authPlugin = fp(async (app: import('fastify').FastifyInstance): Promise<void> => {
  app.decorate('verifyJwt', async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      await reply.code(401).send({ message: 'Missing bearer token' });
      return;
    }

    const token = authorization.slice('Bearer '.length);
    try {
      request.user = jwt.verify(token, env.jwtSecret);
    } catch {
      await reply.code(401).send({ message: 'Invalid token' });
    }
  });
});