import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { apiRoot, getConfig } from "../config.js";
import { hashToken } from "../core/security.js";
import { defaultSiteSettings } from "../modules/site/defaults.js";
import {
  createPostSnapshot,
  formatDisplayDate,
  makeSlug,
  nowIso,
  parseTags,
  rowToPost,
} from "../modules/posts/model.js";

async function tableColumns(connection, tableName) {
  const result = await connection.execute(`PRAGMA table_info(${tableName})`);
  return new Set(result.rows.map((row) => row.name));
}

async function addColumn(connection, tableName, columnName, definition) {
  const columns = await tableColumns(connection, tableName);
  if (!columns.has(columnName)) {
    await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

const migrations = [
  {
    name: "core-schema",
    version: 1,
    async up(connection) {
      await connection.executeMultiple(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          excerpt TEXT NOT NULL,
          category TEXT NOT NULL,
          tags TEXT NOT NULL,
          date TEXT NOT NULL,
          read_time TEXT NOT NULL,
          unread INTEGER NOT NULL DEFAULT 0,
          featured INTEGER NOT NULL DEFAULT 0,
          body TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          published_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          archived_at TEXT
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
          id TEXT PRIMARY KEY,
          email TEXT,
          topic TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          unsubscribe_token_hash TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          token_hash TEXT,
          user_agent TEXT,
          ip_hash TEXT,
          last_seen_at TEXT
        );

        CREATE TABLE IF NOT EXISTS site_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          request_id TEXT,
          actor TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_revisions (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          snapshot TEXT NOT NULL,
          actor TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          UNIQUE(post_id, version)
        );
      `);

      await addColumn(connection, "posts", "version", "INTEGER NOT NULL DEFAULT 1");
      await addColumn(connection, "posts", "archived_at", "TEXT");
      await addColumn(connection, "subscriptions", "updated_at", "TEXT");
      await addColumn(connection, "subscriptions", "status", "TEXT NOT NULL DEFAULT 'active'");
      await addColumn(connection, "subscriptions", "unsubscribe_token_hash", "TEXT");
      await addColumn(connection, "sessions", "token_hash", "TEXT");
      await addColumn(connection, "sessions", "user_agent", "TEXT");
      await addColumn(connection, "sessions", "ip_hash", "TEXT");
      await addColumn(connection, "sessions", "last_seen_at", "TEXT");
    },
  },
  {
    name: "harden-legacy-data",
    version: 2,
    async up(connection) {
      const sessions = await connection.execute(
        "SELECT id FROM sessions WHERE token_hash IS NULL OR token_hash = ''",
      );
      for (const session of sessions.rows) {
        await connection.execute({
          sql: "UPDATE sessions SET token_hash = ?, last_seen_at = COALESCE(last_seen_at, created_at) WHERE id = ?",
          args: [hashToken(session.id), session.id],
        });
      }

      await connection.execute(
        "UPDATE subscriptions SET status = 'inactive' WHERE email IS NULL OR trim(email) = ''",
      );
      await connection.execute(
        "UPDATE subscriptions SET updated_at = COALESCE(updated_at, created_at)",
      );

      const settings = await connection.execute("SELECT key FROM site_settings WHERE key = 'site'");
      if (!settings.rows.length) {
        const seed = JSON.parse(readFileSync(path.join(apiRoot, "data/content.json"), "utf8"));
        const site = {
          ...defaultSiteSettings,
          brand: { ...defaultSiteSettings.brand, ...(seed.site?.brand || {}) },
          filters: (seed.site?.filters || defaultSiteSettings.filters).filter((item) => item !== "未读"),
          navItems: seed.site?.navItems || defaultSiteSettings.navItems,
        };
        await connection.execute({
          sql: "INSERT INTO site_settings (key, value, updated_at) VALUES ('site', ?, ?)",
          args: [JSON.stringify(site), nowIso()],
        });
      }
    },
  },
  {
    name: "query-indexes",
    version: 3,
    async up(connection) {
      await connection.executeMultiple(`
        CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
        CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
        CREATE INDEX IF NOT EXISTS posts_updated_idx ON posts(updated_at);
        CREATE INDEX IF NOT EXISTS posts_archive_idx ON posts(archived_at);
        CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events(created_at);
        CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS revisions_post_idx ON post_revisions(post_id, version DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx
          ON sessions(token_hash) WHERE token_hash IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_topic_idx
          ON subscriptions(lower(email), topic) WHERE email IS NOT NULL AND trim(email) <> '';
      `);
    },
  },
  {
    name: "backfill-initial-revisions",
    version: 4,
    async up(connection) {
      const posts = await connection.execute("SELECT * FROM posts");
      for (const row of posts.rows) {
        const post = rowToPost(row);
        await connection.execute({
          sql: `
            INSERT OR IGNORE INTO post_revisions (id, post_id, version, snapshot, actor, created_at)
            VALUES (?, ?, ?, ?, 'migration', ?)
          `,
          args: [crypto.randomUUID(), post.id, post.version, createPostSnapshot(post), post.updatedAt],
        });
      }
    },
  },
  {
    name: "rotate-legacy-session-identifiers",
    version: 5,
    async up(connection) {
      const sessions = await connection.execute("SELECT id FROM sessions");
      for (const session of sessions.rows) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.id)) {
          continue;
        }
        await connection.execute({
          sql: "UPDATE sessions SET id = ? WHERE id = ?",
          args: [crypto.randomUUID(), session.id],
        });
      }
    },
  },
  {
    name: "clarify-subscription-copy",
    version: 6,
    async up(connection) {
      const result = await connection.execute(
        "SELECT value FROM site_settings WHERE key = 'site' LIMIT 1",
      );
      if (!result.rows[0]?.value) return;

      try {
        const settings = JSON.parse(result.rows[0].value);
        if (settings.subscription?.description !== "有新文章时收到一封简短通知，可随时退订。") {
          return;
        }
        settings.subscription.description = defaultSiteSettings.subscription.description;
        await connection.execute({
          sql: "UPDATE site_settings SET value = ?, updated_at = ? WHERE key = 'site'",
          args: [JSON.stringify(settings), nowIso()],
        });
      } catch {
        // Invalid legacy JSON is already handled by the settings repository fallback.
      }
    },
  },
];

export const latestMigrationVersion = migrations.at(-1)?.version || 0;

export async function ensureMigrationTable(database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export async function getPendingMigrations(database) {
  const result = await database.execute("SELECT version FROM schema_migrations ORDER BY version");
  const applied = new Set(result.rows.map((row) => Number(row.version)));
  return migrations.filter((migration) => !applied.has(migration.version));
}

export async function applyMigration(connection, migration) {
  const existing = await connection.execute({
    sql: "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
    args: [migration.version],
  });
  if (existing.rows.length) return false;

  await migration.up(connection);
  await connection.execute({
    sql: "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
    args: [migration.version, migration.name, nowIso()],
  });
  return true;
}

export async function seedPosts(database) {
  const countResult = await database.execute("SELECT COUNT(*) AS count FROM posts");
  if (Number(countResult.rows[0]?.count || 0) > 0) return;

  const seed = JSON.parse(readFileSync(path.join(apiRoot, "data/content.json"), "utf8"));
  const usedSlugs = new Set();

  for (const item of seed.posts || []) {
    const timestamp = nowIso();
    const id = item.id || crypto.randomUUID();
    const status = item.status === "draft" ? "draft" : "published";
    const baseSlug = makeSlug(item.slug || item.title, id);
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);

    await database.execute({
      sql: `
        INSERT INTO posts (
          id, slug, kind, title, excerpt, category, tags, date, read_time, unread, featured,
          body, status, created_at, updated_at, published_at, version, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, NULL)
      `,
      args: [
        id,
        slug,
        item.kind || "ARTICLE",
        item.title,
        item.excerpt || item.title,
        item.category || "文章库",
        JSON.stringify(parseTags(item.tags)),
        item.date || formatDisplayDate(),
        item.readTime || "5 min",
        item.featured ? 1 : 0,
        item.body || item.excerpt || item.title,
        status,
        item.createdAt || timestamp,
        item.updatedAt || timestamp,
        status === "published" ? item.publishedAt || timestamp : null,
      ],
    });
  }
}

export async function ensureSubscriptionTokens(database) {
  const rows = await database.execute(
    "SELECT id FROM subscriptions WHERE status = 'active' AND (unsubscribe_token_hash IS NULL OR unsubscribe_token_hash = '')",
  );
  for (const row of rows.rows) {
    await database.execute({
      sql: "UPDATE subscriptions SET status = 'inactive', updated_at = ? WHERE id = ?",
      args: [nowIso(), row.id],
    });
  }
}

export function databaseConfiguration() {
  return getConfig().database;
}
