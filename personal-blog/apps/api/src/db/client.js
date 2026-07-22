import { copyFileSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { getConfig } from "../config.js";
import { serviceUnavailable } from "../core/errors.js";
import { logger } from "../core/logger.js";

let client;

export function getDatabase() {
  if (client) return client;

  const { database } = getConfig();
  if (!database.configured || !database.url) {
    throw serviceUnavailable(
      "Vercel 环境尚未连接 Turso 数据库。",
      "DATABASE_NOT_CONFIGURED",
    );
  }

  client = createClient({
    url: database.url,
    authToken: database.authToken || undefined,
  });
  return client;
}

export function backupLocalDatabase() {
  const { database } = getConfig();
  if (!database.localFile || !existsSync(database.localFile)) return "";

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `${database.localFile}.backup-${timestamp}`;
  copyFileSync(database.localFile, backupFile);
  logger.info("database.backup.created", { backupFile });
  return backupFile;
}

export function closeDatabase() {
  if (!client) return;
  client.close();
  client = undefined;
}

export function resetDatabaseForTests() {
  closeDatabase();
}

export async function inTransaction(callback) {
  const transaction = await getDatabase().transaction("write");
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  } finally {
    transaction.close();
  }
}
