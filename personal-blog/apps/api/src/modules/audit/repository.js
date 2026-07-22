import crypto from "node:crypto";
import { getDatabase } from "../../db/client.js";
import { nowIso } from "../posts/model.js";

function parseMetadata(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function rowToAuditEvent(row) {
  return {
    action: row.action,
    actor: row.actor || null,
    createdAt: row.created_at,
    entityId: row.entity_id || null,
    entityType: row.entity_type,
    id: row.id,
    metadata: parseMetadata(row.metadata),
    requestId: row.request_id || null,
  };
}

export async function recordAuditEvent(event, connection = getDatabase()) {
  const auditEvent = {
    action: event.action,
    actor: event.actor || null,
    createdAt: nowIso(),
    entityId: event.entityId || null,
    entityType: event.entityType || "system",
    id: crypto.randomUUID(),
    metadata: JSON.stringify(event.metadata || {}),
    requestId: event.requestId || null,
  };

  await connection.execute({
    sql: `
      INSERT INTO audit_events (
        id, request_id, actor, action, entity_type, entity_id, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      auditEvent.id,
      auditEvent.requestId,
      auditEvent.actor,
      auditEvent.action,
      auditEvent.entityType,
      auditEvent.entityId,
      auditEvent.metadata,
      auditEvent.createdAt,
    ],
  });

  return { ...auditEvent, metadata: event.metadata || {} };
}

export async function listAuditEvents({ action = "", page = 1, pageSize = 30 } = {}) {
  const database = getDatabase();
  const where = action ? "WHERE action = ?" : "";
  const args = action ? [action] : [];
  const count = await database.execute({
    sql: `SELECT COUNT(*) AS count FROM audit_events ${where}`,
    args,
  });
  const total = Number(count.rows[0]?.count || 0);
  const result = await database.execute({
    sql: `
      SELECT * FROM audit_events
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, pageSize, (page - 1) * pageSize],
  });

  return {
    events: result.rows.map(rowToAuditEvent),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
