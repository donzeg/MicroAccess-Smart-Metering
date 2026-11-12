import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import type { FloorTenancyRepository } from './interfaces.js';
import {
  FloorPositionNotFoundError,
  FloorTenancyConflictError,
  type FloorPositionObservation,
  type FloorPositionTenancyTimeline,
  type FloorTenancyRecord,
  type RecordFloorTenancyInput
} from '../types/floorTenancy.js';
import type { SteamaFloorKey, SteamaFloorMappingEvidence } from '../types/steamaOperations.js';

interface PositionRow {
  id: string;
  provider_customer_id: string;
  site_key: string;
  floor_key: SteamaFloorKey;
  floor_level: number | null;
  position_label: string;
  provider_position_name: string;
  mapping_evidence: SteamaFloorMappingEvidence;
  provider_tenant_snapshot: string;
  provider_tenant_observed_at: Date;
}

interface TenancyRow {
  id: string;
  provider_customer_id: string;
  tenant_name: string;
  source: 'provider_snapshot' | 'management_record';
  effective_from: Date;
  effective_to: Date | null;
  first_observed_at: Date;
  last_observed_at: Date;
  evidence_reference: string;
  created_by: string;
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const tenancyFromRow = (row: TenancyRow): FloorTenancyRecord => ({
  id: row.id,
  providerCustomerId: row.provider_customer_id,
  tenantName: row.tenant_name,
  source: row.source,
  effectiveFrom: row.effective_from.toISOString(),
  effectiveTo: row.effective_to?.toISOString() ?? null,
  firstObservedAt: row.first_observed_at.toISOString(),
  lastObservedAt: row.last_observed_at.toISOString(),
  evidenceReference: row.evidence_reference,
  createdBy: row.created_by
});

export class PgFloorTenancyRepository implements FloorTenancyRepository {
  constructor(private readonly pool: Pool) {}

  private async timeline(queryable: Queryable, providerCustomerId: string): Promise<FloorPositionTenancyTimeline | null> {
    const positionResult = await queryable.query<PositionRow>(
      `SELECT id, provider_customer_id, site_key, floor_key, floor_level, position_label,
              provider_position_name, mapping_evidence, provider_tenant_snapshot, provider_tenant_observed_at
         FROM floor_positions
        WHERE provider_customer_id = $1`,
      [providerCustomerId]
    );
    const position = positionResult.rows[0];
    if (!position) return null;

    const tenancyResult = await queryable.query<TenancyRow>(
      `SELECT ft.id, fp.provider_customer_id, ft.tenant_name, ft.source, ft.effective_from, ft.effective_to,
              ft.first_observed_at, ft.last_observed_at, ft.evidence_reference, ft.created_by
         FROM floor_tenancies ft
         JOIN floor_positions fp ON fp.id = ft.floor_position_id
        WHERE ft.floor_position_id = $1
        ORDER BY ft.effective_from ASC`,
      [position.id]
    );
    const tenancies = tenancyResult.rows.map(tenancyFromRow);
    const current = tenancies.find((tenancy) => tenancy.effectiveTo === null) ?? null;
    return {
      providerCustomerId: position.provider_customer_id,
      siteKey: position.site_key,
      floorKey: position.floor_key,
      floorLevel: position.floor_level,
      positionLabel: position.position_label,
      providerPositionName: position.provider_position_name,
      mappingEvidence: position.mapping_evidence,
      providerTenantName: position.provider_tenant_snapshot,
      providerTenantObservedAt: position.provider_tenant_observed_at.toISOString(),
      currentTenantName: current?.tenantName ?? null,
      currentTenantSource: current?.source ?? null,
      providerDrift: Boolean(current && position.provider_tenant_snapshot && current.tenantName !== position.provider_tenant_snapshot),
      historyTrackedFrom: tenancies[0]?.effectiveFrom ?? null,
      tenancies
    };
  }

  async observeProviderPosition(observation: FloorPositionObservation): Promise<FloorPositionTenancyTimeline> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const now = observation.observedAt;
      const positionResult = await client.query<PositionRow>(
        `INSERT INTO floor_positions (
           id, provider_customer_id, site_key, floor_key, floor_level, position_label, provider_position_name,
           mapping_evidence, provider_tenant_snapshot, provider_tenant_observed_at,
           first_observed_at, last_observed_at, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$10,$10,$10)
         ON CONFLICT (provider_customer_id) DO UPDATE SET
           site_key = EXCLUDED.site_key,
           floor_key = EXCLUDED.floor_key,
           floor_level = EXCLUDED.floor_level,
           position_label = EXCLUDED.position_label,
           provider_position_name = EXCLUDED.provider_position_name,
           mapping_evidence = EXCLUDED.mapping_evidence,
           provider_tenant_snapshot = EXCLUDED.provider_tenant_snapshot,
           provider_tenant_observed_at = EXCLUDED.provider_tenant_observed_at,
           last_observed_at = EXCLUDED.last_observed_at,
           updated_at = EXCLUDED.updated_at
         RETURNING id, provider_customer_id, site_key, floor_key, floor_level, position_label,
                   provider_position_name, mapping_evidence, provider_tenant_snapshot, provider_tenant_observed_at`,
        [
          randomUUID(), observation.providerCustomerId, observation.siteKey, observation.floorKey,
          observation.floorLevel, observation.positionLabel, observation.providerPositionName,
          observation.mappingEvidence, observation.providerTenantName, now
        ]
      );
      const position = positionResult.rows[0];
      const currentResult = await client.query<TenancyRow>(
        `SELECT ft.id, fp.provider_customer_id, ft.tenant_name, ft.source, ft.effective_from, ft.effective_to,
                ft.first_observed_at, ft.last_observed_at, ft.evidence_reference, ft.created_by
           FROM floor_tenancies ft
           JOIN floor_positions fp ON fp.id = ft.floor_position_id
          WHERE ft.floor_position_id = $1 AND ft.effective_to IS NULL
          FOR UPDATE OF ft`,
        [position.id]
      );
      const current = currentResult.rows[0];
      if (observation.providerTenantName && !current) {
        await client.query(
          `INSERT INTO floor_tenancies (
             id, floor_position_id, tenant_name, source, effective_from, effective_to,
             first_observed_at, last_observed_at, evidence_reference, created_by, created_at, updated_at
           ) VALUES ($1,$2,$3,'provider_snapshot',$4,NULL,$4,$4,'steama_customer_snapshot','system:steama-observer',$4,$4)`,
          [randomUUID(), position.id, observation.providerTenantName, now]
        );
      } else if (
        observation.providerTenantName && current?.source === 'provider_snapshot' &&
        current.tenant_name !== observation.providerTenantName
      ) {
        await client.query(
          `UPDATE floor_tenancies
              SET effective_to = $2, last_observed_at = $2, updated_at = $2
            WHERE id = $1`,
          [current.id, now]
        );
        await client.query(
          `INSERT INTO floor_tenancies (
             id, floor_position_id, tenant_name, source, effective_from, effective_to,
             first_observed_at, last_observed_at, evidence_reference, created_by, created_at, updated_at
           ) VALUES ($1,$2,$3,'provider_snapshot',$4,NULL,$4,$4,'steama_customer_snapshot_change','system:steama-observer',$4,$4)`,
          [randomUUID(), position.id, observation.providerTenantName, now]
        );
      } else if (current?.tenant_name === observation.providerTenantName) {
        await client.query(
          'UPDATE floor_tenancies SET last_observed_at = $2, updated_at = $2 WHERE id = $1',
          [current.id, now]
        );
      }

      const result = await this.timeline(client, observation.providerCustomerId);
      await client.query('COMMIT');
      if (!result) throw new FloorPositionNotFoundError();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getTimeline(providerCustomerId: string): Promise<FloorPositionTenancyTimeline | null> {
    return this.timeline(this.pool, providerCustomerId);
  }

  async recordManagementTenancy(input: RecordFloorTenancyInput): Promise<FloorPositionTenancyTimeline> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const positionResult = await client.query<{ id: string }>(
        'SELECT id FROM floor_positions WHERE provider_customer_id = $1 FOR UPDATE',
        [input.providerCustomerId]
      );
      const position = positionResult.rows[0];
      if (!position) throw new FloorPositionNotFoundError();

      const tenancyResult = await client.query<{ id: string; effective_from: Date; source: 'provider_snapshot' | 'management_record' }>(
        `SELECT id, effective_from, source FROM floor_tenancies
          WHERE floor_position_id = $1 ORDER BY effective_from ASC FOR UPDATE`,
        [position.id]
      );
      const effectiveFrom = new Date(input.effectiveFrom);
      if (tenancyResult.rows.some(
        (row) => row.source === 'management_record' && row.effective_from.getTime() === effectiveFrom.getTime()
      )) {
        throw new FloorTenancyConflictError();
      }
      const nextManagement = tenancyResult.rows.find(
        (row) => row.source === 'management_record' && row.effective_from > effectiveFrom
      );
      await client.query(
        `DELETE FROM floor_tenancies
          WHERE floor_position_id = $1
            AND source = 'provider_snapshot'
            AND effective_from >= $2
            AND ($3::timestamptz IS NULL OR effective_from < $3::timestamptz)`,
        [position.id, input.effectiveFrom, nextManagement?.effective_from.toISOString() ?? null]
      );
      const remainingResult = await client.query<{ id: string; effective_from: Date }>(
        `SELECT id, effective_from FROM floor_tenancies
          WHERE floor_position_id = $1 ORDER BY effective_from ASC FOR UPDATE`,
        [position.id]
      );
      const previous = remainingResult.rows.filter((row) => row.effective_from < effectiveFrom).at(-1);
      if (previous) {
        await client.query(
          'UPDATE floor_tenancies SET effective_to = $2, updated_at = NOW() WHERE id = $1',
          [previous.id, input.effectiveFrom]
        );
      }

      const tenancyId = randomUUID();
      await client.query(
        `INSERT INTO floor_tenancies (
           id, floor_position_id, tenant_name, source, effective_from, effective_to,
           first_observed_at, last_observed_at, evidence_reference, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,'management_record',$4,$5,NOW(),NOW(),$6,$7,NOW(),NOW())`,
        [
          tenancyId, position.id, input.tenantName, input.effectiveFrom,
          nextManagement?.effective_from.toISOString() ?? null, input.evidenceReference, input.actorReference
        ]
      );
      await client.query(
        `INSERT INTO audit_events (
           id, tenant_id, actor_reference, action, entity_type, entity_id, result,
           correlation_id, safe_metadata, occurred_at
         ) VALUES ($1,NULL,$2,'floor_tenancy.record','floor_tenancy',$3,'succeeded',$4,$5::jsonb,NOW())`,
        [
          randomUUID(), input.actorReference, tenancyId, randomUUID(),
          JSON.stringify({ providerCustomerId: input.providerCustomerId, effectiveFrom: input.effectiveFrom })
        ]
      );
      const result = await this.timeline(client, input.providerCustomerId);
      await client.query('COMMIT');
      if (!result) throw new FloorPositionNotFoundError();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
