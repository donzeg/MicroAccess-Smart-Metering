import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import type {
  ProviderTariffObservation,
  TariffBootstrap,
  TariffRepository,
  TariffVersion,
  TariffVersionSource
} from '../types/tariff.js';

interface TariffRow {
  id: string;
  scope_key: string;
  tariff_band: string;
  retail_ngn_per_kwh: string;
  effective_from: Date;
  effective_to: Date | null;
  source: TariffVersionSource;
  evidence_reference: string;
  provider_customer_count: number;
  first_observed_at: Date;
  last_observed_at: Date;
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const fromRow = (row: TariffRow): TariffVersion => ({
  id: row.id,
  scopeKey: row.scope_key,
  tariffBand: row.tariff_band,
  retailNgnPerKwh: Number(row.retail_ngn_per_kwh),
  effectiveFrom: row.effective_from.toISOString(),
  effectiveTo: row.effective_to?.toISOString() ?? null,
  source: row.source,
  evidenceReference: row.evidence_reference,
  providerCustomerCount: row.provider_customer_count,
  firstObservedAt: row.first_observed_at.toISOString(),
  lastObservedAt: row.last_observed_at.toISOString()
});

const columns = `id, scope_key, tariff_band, retail_ngn_per_kwh, effective_from, effective_to,
  source, evidence_reference, provider_customer_count, first_observed_at, last_observed_at`;

export class PgTariffRepository implements TariffRepository {
  constructor(private readonly pool: Pool) {}

  private async current(queryable: Queryable, scopeKey: string, lock = false): Promise<TariffRow | null> {
    const result = await queryable.query<TariffRow>(
      `SELECT ${columns} FROM tariff_versions
        WHERE scope_key = $1 AND effective_to IS NULL
        ${lock ? 'FOR UPDATE' : ''}`,
      [scopeKey]
    );
    return result.rows[0] ?? null;
  }

  async ensureBootstrap(bootstrap: TariffBootstrap): Promise<TariffVersion> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tariff:${bootstrap.scopeKey}`]);
      const existing = await this.current(client, bootstrap.scopeKey, true);
      if (existing) {
        await client.query('COMMIT');
        return fromRow(existing);
      }
      const result = await client.query<TariffRow>(
        `INSERT INTO tariff_versions (
           id, scope_key, tariff_band, retail_ngn_per_kwh, effective_from, effective_to,
           source, evidence_reference, provider_customer_count, first_observed_at, last_observed_at,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,NULL,'msm_configuration','MSM_RETAIL_TARIFF_NGN_PER_KWH',0,$6,$6,$6,$6)
         RETURNING ${columns}`,
        [randomUUID(), bootstrap.scopeKey, bootstrap.tariffBand, bootstrap.retailNgnPerKwh,
          bootstrap.effectiveFrom, bootstrap.observedAt]
      );
      await client.query('COMMIT');
      return fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async observeProviderTariff(observation: ProviderTariffObservation): Promise<TariffVersion> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tariff:${observation.scopeKey}`]);
      const current = await this.current(client, observation.scopeKey, true);
      if (
        current &&
        Number(current.retail_ngn_per_kwh) === observation.retailNgnPerKwh &&
        current.tariff_band === observation.tariffBand
      ) {
        const updated = await client.query<TariffRow>(
          `UPDATE tariff_versions SET last_observed_at=$2, provider_customer_count=$3,
             evidence_reference='steama_customer_tariff_consensus', updated_at=$2
           WHERE id=$1 RETURNING ${columns}`,
          [current.id, observation.observedAt, observation.providerCustomerCount]
        );
        await client.query('COMMIT');
        return fromRow(updated.rows[0]);
      }
      if (current) {
        await client.query(
          'UPDATE tariff_versions SET effective_to=$2, updated_at=$2 WHERE id=$1',
          [current.id, observation.observedAt]
        );
      }
      const inserted = await client.query<TariffRow>(
        `INSERT INTO tariff_versions (
           id, scope_key, tariff_band, retail_ngn_per_kwh, effective_from, effective_to,
           source, evidence_reference, provider_customer_count, first_observed_at, last_observed_at,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,NULL,'steama_observation','steama_customer_tariff_consensus',$6,$5,$5,$5,$5)
         RETURNING ${columns}`,
        [randomUUID(), observation.scopeKey, observation.tariffBand, observation.retailNgnPerKwh,
          observation.observedAt, observation.providerCustomerCount]
      );
      await client.query('COMMIT');
      return fromRow(inserted.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrent(scopeKey: string): Promise<TariffVersion | null> {
    const row = await this.current(this.pool, scopeKey);
    return row ? fromRow(row) : null;
  }

  async listForRange(scopeKey: string, from: string, to: string): Promise<TariffVersion[]> {
    const result = await this.pool.query<TariffRow>(
      `SELECT ${columns} FROM tariff_versions
        WHERE scope_key=$1 AND effective_from < $3
          AND (effective_to IS NULL OR effective_to > $2)
        ORDER BY effective_from ASC`,
      [scopeKey, from, to]
    );
    return result.rows.map(fromRow);
  }
}
