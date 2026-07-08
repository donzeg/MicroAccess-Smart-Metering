import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';
import { HttpRateLimiterService } from '../services/httpRateLimiterService.js';

interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

const policies: Record<string, RateLimitPolicy> = {
  auth_login: { limit: env.authLoginLimitPerMinute, windowMs: 60_000 },
  purchases_initiate: { limit: env.purchaseInitiateLimitPerMinute, windowMs: 60_000 },
  callback: { limit: env.callbackLimitPerMinute, windowMs: 60_000 },
  management_ops: { limit: env.managementOpsLimitPerMinute, windowMs: 60_000 },
  reads: { limit: env.readsLimitPerMinute, windowMs: 60_000 }
};

declare module 'fastify' {
  interface FastifyInstance {
    rateLimitGuard: (policyName: keyof typeof policies) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const rateLimitPlugin = fp(async (app: import('fastify').FastifyInstance): Promise<void> => {
  const limiter = new HttpRateLimiterService();

  app.decorate('rateLimitGuard', (policyName: keyof typeof policies) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const policy = policies[policyName];
      const identity = request.user?.sub ?? request.ip ?? 'anonymous';
      const key = `${policyName}:${identity}`;

      const result = limiter.consume(key, policy.limit, policy.windowMs);
      if (!result.allowed) {
        await reply
          .code(429)
          .header('Retry-After', String(result.retryAfterSeconds))
          .send({ message: 'Too many requests', policy: policyName, retryAfterSeconds: result.retryAfterSeconds });
      }
    };
  });
});
