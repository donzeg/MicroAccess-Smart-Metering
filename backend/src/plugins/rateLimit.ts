import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';
import { HttpRateLimiterService } from '../services/httpRateLimiterService.js';

interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

type RateLimitPolicyName = keyof typeof policies;

interface RateLimitPolicyMetrics {
  allowed: number;
  blocked: number;
  lastBlockedAt: string | null;
}

type RateLimitMetricsSnapshot = Record<RateLimitPolicyName, RateLimitPolicyMetrics>;

const policies: Record<string, RateLimitPolicy> = {
  auth_login: { limit: env.authLoginLimitPerMinute, windowMs: 60_000 },
  purchases_initiate: { limit: env.purchaseInitiateLimitPerMinute, windowMs: 60_000 },
  callback: { limit: env.callbackLimitPerMinute, windowMs: 60_000 },
  management_ops: { limit: env.managementOpsLimitPerMinute, windowMs: 60_000 },
  reads: { limit: env.readsLimitPerMinute, windowMs: 60_000 }
};

declare module 'fastify' {
  interface FastifyInstance {
    rateLimitGuard: (policyName: RateLimitPolicyName) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rateLimitTelemetrySnapshot: () => RateLimitMetricsSnapshot;
  }
}

export const rateLimitPlugin = fp(async (app: import('fastify').FastifyInstance): Promise<void> => {
  const limiter = new HttpRateLimiterService();
  const metrics: RateLimitMetricsSnapshot = {
    auth_login: { allowed: 0, blocked: 0, lastBlockedAt: null },
    purchases_initiate: { allowed: 0, blocked: 0, lastBlockedAt: null },
    callback: { allowed: 0, blocked: 0, lastBlockedAt: null },
    management_ops: { allowed: 0, blocked: 0, lastBlockedAt: null },
    reads: { allowed: 0, blocked: 0, lastBlockedAt: null }
  };

  app.decorate('rateLimitTelemetrySnapshot', () => {
    return {
      auth_login: { ...metrics.auth_login },
      purchases_initiate: { ...metrics.purchases_initiate },
      callback: { ...metrics.callback },
      management_ops: { ...metrics.management_ops },
      reads: { ...metrics.reads }
    };
  });

  app.decorate('rateLimitGuard', (policyName: RateLimitPolicyName) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const policy = policies[policyName];
      const identity = request.user?.sub ?? request.ip ?? 'anonymous';
      const key = `${policyName}:${identity}`;

      const result = limiter.consume(key, policy.limit, policy.windowMs);
      if (!result.allowed) {
        metrics[policyName].blocked += 1;
        metrics[policyName].lastBlockedAt = new Date().toISOString();
        request.log.warn(
          {
            event: 'rate_limit_blocked',
            policy: policyName,
            identity,
            limit: policy.limit,
            windowMs: policy.windowMs,
            retryAfterSeconds: result.retryAfterSeconds
          },
          'Request blocked by rate limit policy'
        );
        await reply
          .code(429)
          .header('Retry-After', String(result.retryAfterSeconds))
          .send({ message: 'Too many requests', policy: policyName, retryAfterSeconds: result.retryAfterSeconds });
        return;
      }

      metrics[policyName].allowed += 1;
    };
  });
});
