import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { PurchaseRecord, PurchaseState } from '../types/purchase.js';

const purchaseStateSchema = z.enum(['initiated', 'payment_confirmed_credit_pending', 'credited', 'failed', 'reconciled']);

const exportQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  states: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const parsed = value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (parsed.length === 0) {
        return undefined;
      }

      return parsed;
    })
    .pipe(z.array(purchaseStateSchema).optional()),
  fromCreatedAt: z.coerce.date().optional(),
  toCreatedAt: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  format: z.enum(['json', 'csv']).default('json')
});

interface TransactionExportRow {
  purchaseId: string;
  customerId: string;
  amount: number;
  state: PurchaseState;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
  lastTransitionAt: string | null;
}

interface ReconciliationExportRow {
  purchaseId: string;
  customerId: string;
  amount: number;
  state: PurchaseState;
  reconciliationStatus: 'reconciled' | 'pending_reconciliation' | 'not_applicable';
  lastTransitionAt: string | null;
  lastTransitionCorrelationId: string | null;
  lastTransitionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const toCsvValue = (value: string | number | null): string => {
  if (value === null) {
    return '';
  }

  const normalized = String(value);
  if (normalized.includes(',') || normalized.includes('"') || normalized.includes('\n')) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
};

const toCsv = <T extends object>(rows: T[]): string => {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]) as Array<keyof T>;
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => toCsvValue((row[header] as string | number | null | undefined) ?? null)).join(','));
  }

  return lines.join('\n');
};

const buildTransactionRow = (purchase: PurchaseRecord): TransactionExportRow => {
  const lastTransition = purchase.transitions[purchase.transitions.length - 1];

  return {
    purchaseId: purchase.id,
    customerId: purchase.customerId,
    amount: purchase.amount,
    state: purchase.state,
    providerReference: purchase.providerReference,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
    lastTransitionAt: lastTransition?.at ?? null
  };
};

const buildReconciliationRow = (purchase: PurchaseRecord): ReconciliationExportRow => {
  const lastTransition = purchase.transitions[purchase.transitions.length - 1];

  return {
    purchaseId: purchase.id,
    customerId: purchase.customerId,
    amount: purchase.amount,
    state: purchase.state,
    reconciliationStatus:
      purchase.state === 'reconciled'
        ? 'reconciled'
        : purchase.state === 'failed'
          ? 'pending_reconciliation'
          : 'not_applicable',
    lastTransitionAt: lastTransition?.at ?? null,
    lastTransitionCorrelationId: lastTransition?.correlationId ?? null,
    lastTransitionNote: lastTransition?.note ?? null,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt
  };
};

const buildStateCounts = (records: PurchaseRecord[]): Record<string, number> => {
  const stateCounts: Record<string, number> = {};
  for (const record of records) {
    stateCounts[record.state] = (stateCounts[record.state] ?? 0) + 1;
  }
  return stateCounts;
};

export const registerExportRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/ops/exports/transactions',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const query = exportQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.code(400).send({ message: 'Invalid export query parameters', errors: query.error.flatten() });
      }

      const purchases = await app.purchaseService.listPurchases({
        customerId: query.data.customerId,
        states: query.data.states,
        fromCreatedAt: query.data.fromCreatedAt?.toISOString(),
        toCreatedAt: query.data.toCreatedAt?.toISOString(),
        limit: query.data.limit,
        offset: query.data.offset
      });

      const rows = purchases.map(buildTransactionRow);
      const summary = {
        count: rows.length,
        totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
        stateCounts: buildStateCounts(purchases)
      };

      if (query.data.format === 'csv') {
        reply.header('content-type', 'text/csv; charset=utf-8');
        return reply.send(toCsv(rows));
      }

      return reply.send({
        filters: {
          customerId: query.data.customerId ?? null,
          states: query.data.states ?? null,
          fromCreatedAt: query.data.fromCreatedAt?.toISOString() ?? null,
          toCreatedAt: query.data.toCreatedAt?.toISOString() ?? null,
          limit: query.data.limit,
          offset: query.data.offset,
          format: query.data.format
        },
        summary,
        rows
      });
    }
  );

  app.get(
    '/api/v1/ops/exports/reconciliation',
    { onRequest: [app.verifyJwt, app.requireRoles(['management']), app.rateLimitGuard('reads')] },
    async (request, reply) => {
      const query = exportQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.code(400).send({ message: 'Invalid export query parameters', errors: query.error.flatten() });
      }

      const states = query.data.states ?? ['failed', 'reconciled'];
      const purchases = await app.purchaseService.listPurchases({
        customerId: query.data.customerId,
        states,
        fromCreatedAt: query.data.fromCreatedAt?.toISOString(),
        toCreatedAt: query.data.toCreatedAt?.toISOString(),
        limit: query.data.limit,
        offset: query.data.offset
      });

      const rows = purchases.map(buildReconciliationRow);
      const summary = {
        count: rows.length,
        reconciled: rows.filter((row) => row.reconciliationStatus === 'reconciled').length,
        pendingReconciliation: rows.filter((row) => row.reconciliationStatus === 'pending_reconciliation').length,
        stateCounts: buildStateCounts(purchases)
      };

      if (query.data.format === 'csv') {
        reply.header('content-type', 'text/csv; charset=utf-8');
        return reply.send(toCsv(rows));
      }

      return reply.send({
        filters: {
          customerId: query.data.customerId ?? null,
          states,
          fromCreatedAt: query.data.fromCreatedAt?.toISOString() ?? null,
          toCreatedAt: query.data.toCreatedAt?.toISOString() ?? null,
          limit: query.data.limit,
          offset: query.data.offset,
          format: query.data.format
        },
        summary,
        rows
      });
    }
  );
};
