import crypto from "node:crypto";
import { getConfig } from "../../config.js";
import { serviceUnavailable, unauthorized } from "../../core/errors.js";
import { hashNetworkAddress, hashToken, randomToken, safeCompare, verifyPassword } from "../../core/security.js";
import { getDatabase } from "../../db/client.js";
import { nowIso } from "../posts/model.js";

export function verifyAdminCredentials(username, password) {
  const { admin } = getConfig();
  if (!admin.configured) {
    throw serviceUnavailable("生产环境尚未完整配置管理员账号和会话密钥。", "AUTH_NOT_CONFIGURED");
  }

  const usernameMatches = safeCompare(String(username || "").trim(), admin.username);
  const passwordMatches = verifyPassword(password || "", {
    passwordHash: admin.passwordHash,
    plainPassword: admin.password,
  });

  if (!usernameMatches || !passwordMatches) throw unauthorized("账号或密码不正确。");
  return { username: admin.username };
}

export async function createSession(username, { ip = "", userAgent = "" } = {}) {
  const database = getDatabase();
  const { session } = getConfig();
  const token = randomToken();
  const timestamp = Date.now();
  const record = {
    createdAt: new Date(timestamp).toISOString(),
    expiresAt: new Date(timestamp + session.ttlMs).toISOString(),
    id: crypto.randomUUID(),
    ipHash: hashNetworkAddress(ip),
    lastSeenAt: new Date(timestamp).toISOString(),
    tokenHash: hashToken(token),
    userAgent: String(userAgent || "").slice(0, 300),
    username,
  };

  await database.execute({ sql: "DELETE FROM sessions WHERE expires_at <= ?", args: [nowIso()] });
  await database.execute({
    sql: `
      INSERT INTO sessions (
        id, username, created_at, expires_at, token_hash, user_agent, ip_hash, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      record.id,
      record.username,
      record.createdAt,
      record.expiresAt,
      record.tokenHash,
      record.userAgent,
      record.ipHash,
      record.lastSeenAt,
    ],
  });

  return { expiresAt: record.expiresAt, token, username };
}

export async function getSession(token) {
  if (!token) return null;
  const database = getDatabase();
  const result = await database.execute({
    sql: `
      SELECT id, username, created_at, expires_at, last_seen_at
      FROM sessions
      WHERE token_hash = ?
      LIMIT 1
    `,
    args: [hashToken(token)],
  });
  const row = result.rows[0];
  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await deleteSession(token);
    return null;
  }

  const lastSeen = new Date(row.last_seen_at || row.created_at).getTime();
  if (Date.now() - lastSeen > 5 * 60 * 1000) {
    await database.execute({
      sql: "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
      args: [nowIso(), row.id],
    });
  }

  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    username: row.username,
  };
}

export async function deleteSession(token) {
  if (!token) return false;
  const result = await getDatabase().execute({
    sql: "DELETE FROM sessions WHERE token_hash = ?",
    args: [hashToken(token)],
  });
  return result.rowsAffected > 0;
}

export async function requireSession(token) {
  const session = await getSession(token);
  if (!session) throw unauthorized();
  return { username: session.username };
}
