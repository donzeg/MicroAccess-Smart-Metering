import type { Pool } from 'pg';

import type { PurchaseListQuery, PurchaseRecord, PurchaseTransition } from '../types/purchase.js';
import type { PurchaseRepository } from './interfaces.js';

interface PurchaseRow {
  id: string;
  customer_id: string;
  amount: string;
  state: PurchaseRecord['state'];
  idempotency_key: string;
  provider_reference: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TransitionRow {
  state: PurchaseTransition['state'];
  occurred_at: Date;
  correlation_id: string;
  note: string;
}

export class PgPurchaseRepository implements PurchaseRepository {
  constructor(private readonly pool: Pool) {}

  async create(record: PurchaseRecord): Promise<void> {
    await this.persistRecord(record);
  }

  async update(record: PurchaseRecord): Promise<void> {
    await this.persistRecord(record);
  }

  async getById(purchaseId: string): Promise<PurchaseRecord | null> {
    const purchaseResult = await this.pool.query<PurchaseRow>(
      `
      SELECT id, customer_id, amount, state, idempotency_key, provider_reference, created_at, updated_at
      FROM purchases
      WHERE id = $1
      `,
      [purchaseId]
    );

    if (purchaseResult.rowCount === 0) {
      return null;
    }

    const row = purchaseResult.rows[0];
    const transitionsResult = await this.pool.query<TransitionRow>(
      `
      SELECT state, occurred_at, correlation_id, note
      FROM purchase_transitions
      WHERE purchase_id = $1
      ORDER BY occurred_at ASC
      `,
      [purchaseId]
    );

    return {
      id: row.id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      state: row.state,
      idempotencyKey: row.idempotency_key,
      providerReference: row.provider_reference,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      transitions: transitionsResult.rows.map((transition) => ({
        state: transition.state,
        at: transition.occurred_at.toISOString(),
        correlationId: transition.correlation_id,
        note: transition.note
      }))
    };
  }

  async listByState(state: PurchaseRecord['state'], limit: number): Promise<PurchaseRecord[]> {
    return this.list({ states: [state], limit, offset: 0 });
  }

  async list(query: PurchaseListQuery): Promise<PurchaseRecord[]> {
    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (query.customerId) {
      params.push(query.customerId);
      whereParts.push(`customer_id = $${params.length}`);
    }

    if (query.states && query.states.length > 0) {
      params.push(query.states);
      whereParts.push(`state = ANY($${params.length}::text[])`);
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

    const result = await this.pool.query<{ id: string }>(
      `
      SELECT id
      FROM purchases
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
      `,
      params
    );

    const records: PurchaseRecord[] = [];
    for (const row of result.rows) {
      const record = await this.getById(row.id);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  private async persistRecord(record: PurchaseRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO purchases (id, customer_id, amount, state, idempotency_key, provider_reference, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
        ON CONFLICT (id) DO UPDATE
        SET customer_id = EXCLUDED.customer_id,
            amount = EXCLUDED.amount,
            state = EXCLUDED.state,
            idempotency_key = EXCLUDED.idempotency_key,
            provider_reference = EXCLUDED.provider_reference,
            updated_at = EXCLUDED.updated_at
        `,
        [
          record.id,
          record.customerId,
          record.amount,
          record.state,
          record.idempotencyKey,
          record.providerReference,
          record.createdAt,
          record.updatedAt
        ]
      );

      await client.query('DELETE FROM purchase_transitions WHERE purchase_id = $1', [record.id]);

      for (const transition of record.transitions) {
        await client.query(
          `
          INSERT INTO purchase_transitions (purchase_id, state, occurred_at, correlation_id, note)
          VALUES ($1, $2, $3::timestamptz, $4, $5)
          `,
          [record.id, transition.state, transition.at, transition.correlationId, transition.note]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
