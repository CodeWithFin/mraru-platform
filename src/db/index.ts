import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// In-Memory Storage fallback for dev environment without active Neon Postgres credentials
class InMemoryDB {
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

export const inMemoryDb = new InMemoryDB();

export function getDb() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
  }
  return null;
}

export { schema };
