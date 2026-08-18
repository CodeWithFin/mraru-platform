import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { eq, type Table } from "drizzle-orm";
import * as schema from "./schema";

export type TableName =
  | "chamas"
  | "members"
  | "otpVerifications"
  | "constitutions"
  | "constitutionAcceptances"
  | "invites"
  | "auditLog"
  | "webhookEvents";

const TABLES: Record<TableName, Table> = {
  chamas: schema.chamas,
  members: schema.members,
  otpVerifications: schema.otpVerifications,
  constitutions: schema.constitutions,
  constitutionAcceptances: schema.constitutionAcceptances,
  invites: schema.invites,
  auditLog: schema.auditLog,
  webhookEvents: schema.webhookEvents,
};

// Only the `members` table carries an `updated_at` column (see schema.ts) —
// other tables are append-only or have no mutable timestamp.
const TABLES_WITH_UPDATED_AT: Partial<Record<TableName, true>> = {
  members: true,
};

export interface Store {
  select(tableName: TableName, filterFn?: (row: any) => boolean): Promise<any[]>;
  findOne(tableName: TableName, filterFn: (row: any) => boolean): Promise<any | null>;
  insert(tableName: TableName, row: any): Promise<any>;
  update(
    tableName: TableName,
    filterFn: (row: any) => boolean,
    updates: any
  ): Promise<any | null>;
  getAllData(): Promise<Record<string, any[]>> | Record<string, any[]>;
}

// Dev-only fallback for running without a DATABASE_URL. Data does not survive
// a process restart, so onboarding resumability (spec 6.8) does not hold here —
// this path must never be used in production.
class MemoryStore implements Store {
  private tables: Record<string, any[]> = {
    chamas: [],
    members: [],
    otpVerifications: [],
    constitutions: [],
    constitutionAcceptances: [],
    invites: [],
    auditLog: [],
    webhookEvents: [],
  };

  async select(tableName: string, filterFn?: (row: any) => boolean) {
    const list = this.tables[tableName] || [];
    return filterFn ? list.filter(filterFn) : [...list];
  }

  async findOne(tableName: string, filterFn: (row: any) => boolean) {
    const list = this.tables[tableName] || [];
    return list.find(filterFn) || null;
  }

  async insert(tableName: string, row: any) {
    if (!this.tables[tableName]) this.tables[tableName] = [];
    const record = { ...row, createdAt: row.createdAt || new Date() };
    this.tables[tableName].push(record);
    return record;
  }

  async update(tableName: string, filterFn: (row: any) => boolean, updates: any) {
    const list = this.tables[tableName] || [];
    const index = list.findIndex(filterFn);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updatedAt: new Date() };
      return list[index];
    }
    return null;
  }

  getAllData() {
    return this.tables;
  }
}

// Real persistence: every write lands in Neon Postgres via Drizzle so onboarding
// state survives serverless cold starts and multiple instances (spec Part 4 + 6.8).
class PostgresStore implements Store {
  constructor(private db: NeonDatabase<typeof schema>) {}

  async select(tableName: TableName, filterFn?: (row: any) => boolean) {
    const rows = await this.db.select().from(TABLES[tableName] as any);
    return filterFn ? rows.filter(filterFn) : rows;
  }

  async findOne(tableName: TableName, filterFn: (row: any) => boolean) {
    const rows = await this.select(tableName);
    return rows.find(filterFn) ?? null;
  }

  async insert(tableName: TableName, row: any) {
    const table = TABLES[tableName] as any;
    const record = { ...row, createdAt: row.createdAt || new Date() };
    const result = (await this.db.insert(table).values(record).returning()) as any[];
    return result[0];
  }

  async update(tableName: TableName, filterFn: (row: any) => boolean, updates: any) {
    const table = TABLES[tableName] as any;
    const match = await this.findOne(tableName, filterFn);
    if (!match) return null;

    const setValues = TABLES_WITH_UPDATED_AT[tableName]
      ? { ...updates, updatedAt: new Date() }
      : updates;

    const result = (await this.db
      .update(table)
      .set(setValues)
      .where(eq((table as any).id, match.id))
      .returning()) as any[];
    return result[0];
  }

  async getAllData() {
    const out: Record<string, any[]> = {};
    for (const name of Object.keys(TABLES) as TableName[]) {
      out[name] = await this.select(name);
    }
    return out;
  }
}

let cachedDb: NeonDatabase<typeof schema> | null = null;

export function getDb(): NeonDatabase<typeof schema> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedDb) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    cachedDb = drizzle(pool, { schema });
  }
  return cachedDb;
}

const db = getDb();
if (!db) {
  console.warn(
    "[db] DATABASE_URL not set — using an in-process memory store. State will not persist across restarts; do not use in production."
  );
}

export const store: Store = db ? new PostgresStore(db) : new MemoryStore();

export { schema };
