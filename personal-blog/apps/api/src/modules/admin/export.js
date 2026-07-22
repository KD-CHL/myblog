import { getDatabase } from "../../db/client.js";
import { rowToPost } from "../posts/model.js";
import { getSiteSettings } from "../site/repository.js";

export async function createContentExport() {
  const database = getDatabase();
  const [posts, subscriptions, migration, site] = await Promise.all([
    database.execute("SELECT * FROM posts ORDER BY created_at ASC"),
    database.execute(`
      SELECT id, email, topic, status, created_at, updated_at
      FROM subscriptions
      ORDER BY created_at ASC
    `),
    database.execute("SELECT MAX(version) AS version FROM schema_migrations"),
    getSiteSettings(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "personal-blog-export",
    formatVersion: 1,
    posts: posts.rows.map(rowToPost),
    schemaVersion: Number(migration.rows[0]?.version || 0),
    settings: site.settings,
    subscriptions: subscriptions.rows.map((row) => ({
      createdAt: row.created_at,
      email: row.email,
      id: row.id,
      status: row.status,
      topic: row.topic,
      updatedAt: row.updated_at,
    })),
  };
}
