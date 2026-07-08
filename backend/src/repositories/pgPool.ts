import { Pool } from 'pg';

import { env } from '../config/env.js';

export const createPgPool = (): Pool => {
  return new Pool({
    connectionString: env.databaseUrl,
    max: 10
  });
};
