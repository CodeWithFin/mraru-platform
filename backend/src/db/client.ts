import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export type Db = NodePgDatabase<typeof schema>;
export const db: Db = drizzle(pool, { schema });

/** Transaction handle type, inferred from drizzle's transaction signature. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside a transaction whose RLS session claim (`app.chama_id`) is
 * pinned to `chamaId`. Every row returned/written is therefore constrained by
 * Postgres RLS to that tenant — the second line of defence behind app-level
 * filtering. For an unauthenticated or system-level transaction call
 * {@link withPublicLookup} or set claims yourself via `tx.execute`.
 */
export async function withTenant<T>(chamaId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.chama_id', ${chamaId}, true)`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a transaction with the public-lookup flag set, used by the
 * join-by-code / invite flows *before* the caller is a member. Callers must
 * set `app.chama_id` themselves (via {@link setTenantOnTx}) before inserting
 * rows once the target chama has been resolved.
 */
export async function withPublicLookup<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.public_lookup', 'true', true)`);
    return fn(tx);
  });
}

/** Pin the tenant claim for the remainder of the current transaction. */
export async function setTenantOnTx(tx: Tx, chamaId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.chama_id', ${chamaId}, true)`);
}

/** Bare transaction without any RLS claims (OTP, refresh tokens, etc.). */
export async function tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/**
 * Run `fn` inside a transaction with the global-lookup flag set. Used for
 * tenant-wide uniqueness checks (chama slug, join code) that must read across
 * all tenants — app.global_lookup is only ever set here.
 */
export async function withGlobalLookup<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.global_lookup', 'true', true)`);
    return fn(tx);
  });
}

export { pool };
