import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

import { env } from '../config/env.js';

interface MigrationLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
}

const SCHEMA_MIGRATION_ID = '0001_schema_postgres_ddl';
const SCHEMA_SQL_PATH = fileURLToPath(new URL('../../db/schema.postgres.ddl', import.meta.url));

export const createPgPool = (): Pool => {
  return new Pool({
    connectionString: env.databaseUrl,
    max: 10
  });
};

export const runPgMigrations = async (pool: Pool, logger?: MigrationLogger): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const schemaSql = await readFile(SCHEMA_SQL_PATH, 'utf8');
  const checksum = createHash('sha256').update(schemaSql).digest('hex');

  const existing = await pool.query<{ id: string; checksum: string }>(
    'SELECT id, checksum FROM schema_migrations WHERE id = $1',
    [SCHEMA_MIGRATION_ID]
  );

  if (existing.rowCount === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [SCHEMA_MIGRATION_ID, checksum]);
      await client.query('COMMIT');
      logger?.info(
        {
          migrationId: SCHEMA_MIGRATION_ID,
          checksum
        },
        'Applied PostgreSQL schema migration.'
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return;
  }

  if (existing.rows[0].checksum !== checksum) {
    throw new Error(
      `schema_migration_checksum_mismatch:${SCHEMA_MIGRATION_ID}:expected=${existing.rows[0].checksum}:actual=${checksum}`
    );
  }

  logger?.info(
    {
      migrationId: SCHEMA_MIGRATION_ID,
      checksum
    },
    'PostgreSQL schema migration already applied.'
  );
};
