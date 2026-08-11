import 'dotenv/config';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, pool } from './client.js';

/**
 * Tables that carry chama_id and therefore need RLS. Order matters only for
 * readability; FORCE makes RLS apply to the table owner too — without it,
 * Postgres silently bypasses RLS for the owner (the API user), which would
 * defeat the second layer of defence.
 */
const RLS_TABLES = [
  'chamas',
  'members',
  'constitutions',
  'constitution_acceptances',
  'invites',
  'kyc_documents',
  'audit_log',
];

async function main() {
  console.log('Applying drizzle migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Enabling + forcing row-level security…');
  for (const table of RLS_TABLES) {
    await pool.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
