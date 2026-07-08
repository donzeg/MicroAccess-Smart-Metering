import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import type { AuthRole, AuthUser } from '../types/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    verifyJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRoles: (roles: AuthRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthUser;
  }
}

const isAuthRole = (value: unknown): value is AuthRole => value === 'management' || value === 'customer';

export const authPlugin = fp(async (app: import('fastify').FastifyInstance): Promise<void> => {
  app.decorate('verifyJwt', async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      await reply.code(401).send({ message: 'Missing bearer token' });
      return;
    }

    const token = authorization.slice('Bearer '.length);
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      if (typeof decoded === 'string' || typeof decoded !== 'object') {
        await reply.code(401).send({ message: 'Invalid token payload' });
        return;
      }

      const role = (decoded as jwt.JwtPayload).role;
      if (!isAuthRole(role)) {
        await reply.code(401).send({ message: 'Invalid token role' });
        return;
      }

      const sub = (decoded as jwt.JwtPayload).sub;
      if (typeof sub !== 'string' || sub.length === 0) {
        await reply.code(401).send({ message: 'Invalid token subject' });
        return;
      }

      const customerId = (decoded as jwt.JwtPayload).customerId;
      request.user = {
        sub,
        role,
        customerId: typeof customerId === 'string' ? customerId : undefined
      };
    } catch {
      await reply.code(401).send({ message: 'Invalid token' });
    }
  });

  app.decorate('requireRoles', (roles: AuthRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const role = request.user?.role;
      if (!role || !roles.includes(role)) {
        await reply.code(403).send({ message: 'Forbidden' });
      }
    };
  });
});