import type { Pool } from 'pg';

import type { PurchaseAuditLog, PurchaseAuditLogQuery } from '../types/purchase.js';
import type { PurchaseAuditLogRepository } from './interfaces.js';

interface PurchaseAuditLogRow {
  id: string;
  purchase_id: string;
  action: string;
  message: string;
  correlation_id: string;
  created_at: Date;
  metadata: Record<string, unknown>;
}

export class PgPurchaseAuditLogRepository implements PurchaseAuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async append(entry: PurchaseAuditLog): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO purchase_audit_logs (id, purchase_id, action, message, correlation_id, created_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb)
      `,
      [entry.id, entry.purchaseId, entry.action, entry.message, entry.correlationId, entry.createdAt, JSON.stringify(entry.metadata)]
    );
  }

  async listByPurchaseId(purchaseId: string, limit: number): Promise<PurchaseAuditLog[]> {
    return this.list({ purchaseId, limit, offset: 0 });
  }

  async list(query: PurchaseAuditLogQuery): Promise<PurchaseAuditLog[]> {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (query.purchaseId) {
      params.push(query.purchaseId);
      whereParts.push(`purchase_id = $${params.length}`);
    }

    if (query.action) {
      params.push(query.action);
      whereParts.push(`action = $${params.length}`);
    }

    if (query.correlationId) {
      params.push(query.correlationId);
      whereParts.push(`correlation_id = $${params.length}`);
    }

    if (query.fromCreatedAt) {
      params.push(query.fromCreatedAt);
      whereParts.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (query.toCreatedAt) {
      params.push(query.toCreatedAt);
      whereParts.push(`created_at <= $${params.length}::timestamptz`);
    }

    params.push(query.limit);
    const limitParam = `$${params.length}`;
    params.push(query.offset);
    const offsetParam = `$${params.length}`;

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const result = await this.pool.query<PurchaseAuditLogRow>(
      `
      SELECT id, purchase_id, action, message, correlation_id, created_at, metadata
      FROM purchase_audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
      `,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      purchaseId: row.purchase_id,
      action: row.action,
      message: row.message,
      correlationId: row.correlation_id,
      createdAt: row.created_at.toISOString(),
      metadata: row.metadata ?? {}
    }));
  }
}
