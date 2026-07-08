import type { Pool } from 'pg';

import type { PurchaseAuditLog } from '../types/purchase.js';
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
    const result = await this.pool.query<PurchaseAuditLogRow>(
      `
      SELECT id, purchase_id, action, message, correlation_id, created_at, metadata
      FROM purchase_audit_logs
      WHERE purchase_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [purchaseId, limit]
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
