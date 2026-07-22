import crypto from "node:crypto";
import { notFound, validationError } from "../../core/errors.js";
import { hashToken, randomToken } from "../../core/security.js";
import { getDatabase } from "../../db/client.js";
import { nowIso } from "../posts/model.js";

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw validationError("请输入有效的邮箱地址。", { fields: { email: "邮箱格式不正确。" } });
  }
  return email;
}

function rowToSubscription(row) {
  return {
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    status: row.status,
    topic: row.topic,
    updatedAt: row.updated_at,
  };
}

export async function subscribe({ email: rawEmail, topic: rawTopic = "全部" }) {
  const database = getDatabase();
  const email = normalizeEmail(rawEmail);
  const topic = String(rawTopic || "全部").trim().slice(0, 60) || "全部";
  const token = randomToken();
  const tokenHash = hashToken(token);
  const timestamp = nowIso();
  const existing = await database.execute({
    sql: "SELECT * FROM subscriptions WHERE lower(email) = ? AND topic = ? LIMIT 1",
    args: [email, topic],
  });

  if (existing.rows[0]) {
    await database.execute({
      sql: `
        UPDATE subscriptions
        SET status = 'active', unsubscribe_token_hash = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [tokenHash, timestamp, existing.rows[0].id],
    });
    const refreshed = await database.execute({
      sql: "SELECT * FROM subscriptions WHERE id = ?",
      args: [existing.rows[0].id],
    });
    return { subscription: rowToSubscription(refreshed.rows[0]), unsubscribeToken: token };
  }

  const record = {
    createdAt: timestamp,
    email,
    id: crypto.randomUUID(),
    status: "active",
    topic,
    updatedAt: timestamp,
  };
  await database.execute({
    sql: `
      INSERT INTO subscriptions (
        id, email, topic, created_at, updated_at, status, unsubscribe_token_hash
      ) VALUES (?, ?, ?, ?, ?, 'active', ?)
    `,
    args: [record.id, record.email, record.topic, record.createdAt, record.updatedAt, tokenHash],
  });
  return { subscription: record, unsubscribeToken: token };
}

export async function unsubscribe(id, token) {
  if (!token) throw validationError("缺少退订凭证。");
  const result = await getDatabase().execute({
    sql: `
      UPDATE subscriptions
      SET status = 'inactive', updated_at = ?
      WHERE id = ? AND unsubscribe_token_hash = ? AND status = 'active'
    `,
    args: [nowIso(), id, hashToken(token)],
  });
  if (!result.rowsAffected) throw notFound("订阅记录不存在或已经退订。", "SUBSCRIPTION_NOT_FOUND");
  return true;
}

export async function listSubscriptions({ page = 1, pageSize = 30, status = "active" } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 30));
  const where = status === "all" ? "" : "WHERE status = ?";
  const args = status === "all" ? [] : [status];
  const database = getDatabase();
  const count = await database.execute({
    sql: `SELECT COUNT(*) AS count FROM subscriptions ${where}`,
    args,
  });
  const total = Number(count.rows[0]?.count || 0);
  const result = await database.execute({
    sql: `
      SELECT * FROM subscriptions
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, safePageSize, (safePage - 1) * safePageSize],
  });

  return {
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
    subscriptions: result.rows.map(rowToSubscription),
  };
}
