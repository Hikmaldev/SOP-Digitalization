import pg from 'pg';
import { config } from './config';

const { Pool } = pg;

/**
 * A single pooled connection to Neon, shared by the whole API. Neon speaks
 * the standard Postgres wire protocol, so node-postgres works as-is with the
 * pooled connection string (see Neon docs: use a pool, not the serverless
 * driver, for long-running servers).
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export type Row = pg.QueryResultRow;

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run `fn` inside a single transaction. Used for every multi-step write —
 * most importantly the approval/publish sequence, which must be atomic
 * (design doc §6: no half-approved state can ever exist).
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
