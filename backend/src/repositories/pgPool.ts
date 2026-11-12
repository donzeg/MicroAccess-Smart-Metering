import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

import { env } from '../config/env.js';

interface MigrationLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
}

interface MigrationDefinition {
  id: string;
  fileName: string;
  legacyPrototypeOnly?: boolean;
}

const MIGRATIONS: MigrationDefinition[] = [
  {
    id: '0001_schema_postgres_ddl',
    fileName: 'schema.postgres.ddl',
    legacyPrototypeOnly: true
  },
  {
    id: '0002_phase1_read_only_foundation',
    fileName: 'phase1_read_only.postgres.ddl'
  }
];

export const createPgPool = (): Pool => {
  return new Pool({
    connectionString: env.databaseUrl,
    max: 10
  });
};

const readMigration = async (fileName: string): Promise<string> => {
  try {
    return await readFile(path.resolve(process.cwd(), 'db', fileName), 'utf8');
  } catch {
    return readFile(path.resolve(process.cwd(), 'backend', 'db', fileName), 'utf8');
  }
};

const applyMigration = async (
  pool: Pool,
  migration: MigrationDefinition,
  logger?: MigrationLogger
): Promise<void> => {
  const schemaSql = await readMigration(migration.fileName);
  const checksum = createHash('sha256').update(schemaSql).digest('hex');

  const existing = await pool.query<{ id: string; checksum: string }>(
    'SELECT id, checksum FROM schema_migrations WHERE id = $1',
    [migration.id]
  );

  if (existing.rowCount === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [migration.id, checksum]);
      await client.query('COMMIT');
      logger?.info({ migrationId: migration.id, checksum }, 'Applied PostgreSQL schema migration.');
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
      `schema_migration_checksum_mismatch:${migration.id}:expected=${existing.rows[0].checksum}:actual=${checksum}`
    );
  }

  logger?.info({ migrationId: migration.id, checksum }, 'PostgreSQL schema migration already applied.');
};

export const runPgMigrations = async (
  pool: Pool,
  logger?: MigrationLogger,
  options: { includeLegacyPrototype?: boolean } = {}
): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const selectedMigrations = MIGRATIONS.filter(
    (migration) => !migration.legacyPrototypeOnly || options.includeLegacyPrototype === true
  );

  for (const migration of selectedMigrations) {
    await applyMigration(pool, migration, logger);
  }
};
