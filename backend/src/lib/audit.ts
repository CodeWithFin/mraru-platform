import type { Tx } from '../db/client.js';
import { auditLog } from '../db/schema.js';

export interface AuditEntry {
  chamaId: string;
  actorMemberId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * Append an immutable audit entry. Called inside the same transaction as the
 * mutation it describes, so the log can never drift from the change itself.
 */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    chamaId: entry.chamaId,
    actorMemberId: entry.actorMemberId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    beforeState: entry.beforeState !== undefined ? JSON.parse(JSON.stringify(entry.beforeState)) : null,
    afterState: entry.afterState !== undefined ? JSON.parse(JSON.stringify(entry.afterState)) : null,
  });
}
