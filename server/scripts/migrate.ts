import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db';

/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 * Pass --fresh to drop all SOPly tables first (development only).
 */

const fresh = process.argv.includes('--fresh');

const DROP_SQL = `
  DROP TABLE IF EXISTS
    version_change_log,
    approvals,
    password_reset_tokens,
    sop_versions,
    sops,
    users,
    departments
  CASCADE;
  DROP FUNCTION IF EXISTS fill_version_title_cache() CASCADE;
  DROP FUNCTION IF EXISTS sync_sop_title_cache() CASCADE;
  DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
`;

async function main(): Promise<void> {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'schema.sql');
  const schemaSql = await readFile(schemaPath, 'utf8');

  if (fresh) {
    console.log('Dropping existing tables (--fresh)...');
    await pool.query(DROP_SQL);
  }

  console.log('Applying schema...');
  await pool.query(schemaSql);
  console.log('Schema applied successfully.');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await pool.end();
  process.exit(1);
});
