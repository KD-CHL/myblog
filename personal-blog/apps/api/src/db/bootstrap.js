import { backupLocalDatabase, getDatabase, inTransaction } from "./client.js";
import {
  applyMigration,
  ensureMigrationTable,
  ensureSubscriptionTokens,
  getPendingMigrations,
  latestMigrationVersion,
  seedPosts,
} from "./migrations.js";
import { logger } from "../core/logger.js";

let initializationPromise;

async function createMigrationBackup(database) {
  await database.execute("PRAGMA wal_checkpoint(FULL)").catch(() => undefined);
  return backupLocalDatabase();
}

async function initialize() {
  const database = getDatabase();
  const existingMigrationTable = await database.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  );

  if (!existingMigrationTable.rows.length) await createMigrationBackup(database);
  await ensureMigrationTable(database);
  const pending = await getPendingMigrations(database);
  if (pending.length && existingMigrationTable.rows.length) await createMigrationBackup(database);

  for (const migration of pending) {
    const applied = await inTransaction((connection) => applyMigration(connection, migration));
    if (applied) {
      logger.info("database.migration.applied", {
        name: migration.name,
        version: migration.version,
      });
    }
  }

  await seedPosts(database);
  await ensureSubscriptionTokens(database);
  return database;
}

export function initializeDatabase() {
  if (!initializationPromise) initializationPromise = initialize();
  return initializationPromise;
}

export async function getDatabaseHealth() {
  const database = await initializeDatabase();
  const migration = await database.execute("SELECT MAX(version) AS version FROM schema_migrations");
  await database.execute("SELECT 1 AS ok");
  return {
    migrationVersion: Number(migration.rows[0]?.version || 0),
    migrationCurrent: Number(migration.rows[0]?.version || 0) === latestMigrationVersion,
  };
}

export function resetDatabaseBootstrapForTests() {
  initializationPromise = undefined;
}
