import crypto from "node:crypto";
import { conflict, notFound } from "../../core/errors.js";
import { getDatabase, inTransaction } from "../../db/client.js";
import {
  createPostSnapshot,
  getAllTags,
  normalizePostPayload,
  nowIso,
  rowToPost,
  summarizePost,
} from "./model.js";

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function getPostFromConnection(connection, identifier, { includeArchived = true, includeDrafts = true } = {}) {
  const where = ["(id = ? OR slug = ?)"];
  if (!includeDrafts) where.push("status = 'published'");
  if (!includeArchived) where.push("archived_at IS NULL");

  const result = await connection.execute({
    sql: `SELECT * FROM posts WHERE ${where.join(" AND ")} LIMIT 1`,
    args: [identifier, identifier],
  });
  return rowToPost(result.rows[0]);
}

async function uniqueSlug(connection, slug, currentId = "") {
  const base = slug;
  let candidate = base;
  let suffix = 2;

  while (suffix < 1000) {
    const result = await connection.execute({
      sql: "SELECT id FROM posts WHERE slug = ? LIMIT 1",
      args: [candidate],
    });
    if (!result.rows[0] || result.rows[0].id === currentId) return candidate;
    candidate = `${base}-${suffix++}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function insertRevision(connection, post, actor) {
  await connection.execute({
    sql: `
      INSERT OR IGNORE INTO post_revisions (id, post_id, version, snapshot, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [crypto.randomUUID(), post.id, post.version, createPostSnapshot(post), actor || null, nowIso()],
  });
}

function buildListQuery(options) {
  const page = clampInteger(options.page, 1, 1, 100_000);
  const pageSize = clampInteger(options.pageSize, 12, 1, 50);
  const where = [];
  const args = [];

  if (!options.includeDrafts) {
    where.push("status = 'published'", "archived_at IS NULL");
  } else if (options.status === "archived") {
    where.push("archived_at IS NOT NULL");
  } else {
    where.push("archived_at IS NULL");
    if (["draft", "published"].includes(options.status)) {
      where.push("status = ?");
      args.push(options.status);
    }
  }

  if (options.query?.trim()) {
    const query = `%${options.query.trim().toLowerCase()}%`;
    where.push("lower(title || ' ' || excerpt || ' ' || category || ' ' || tags || ' ' || body) LIKE ?");
    args.push(query);
  }

  if (options.nav && !["总览", "归档"].includes(options.nav)) {
    where.push("category = ?");
    args.push(options.nav);
  }

  if (options.filter && options.filter !== "全部") {
    const normalizedFilter = options.filter.trim().toLowerCase();
    where.push(
      "(lower(category) LIKE ? OR EXISTS (SELECT 1 FROM json_each(posts.tags) WHERE lower(value) = ?))",
    );
    args.push(`%${normalizedFilter}%`, normalizedFilter);
  }

  const orderBy =
    options.sort === "title"
      ? "title COLLATE NOCASE ASC"
      : options.sort === "oldest"
        ? "COALESCE(published_at, updated_at) ASC"
        : options.sort === "shortest"
          ? "CAST(read_time AS INTEGER) ASC, title ASC"
          : "COALESCE(published_at, updated_at) DESC, title ASC";

  return {
    args,
    orderBy,
    page,
    pageSize,
    where: where.length ? `WHERE ${where.join(" AND ")}` : "",
  };
}

export async function listPosts(options = {}) {
  const database = getDatabase();
  const query = buildListQuery(options);
  const countResult = await database.execute({
    sql: `SELECT COUNT(*) AS count FROM posts ${query.where}`,
    args: query.args,
  });
  const total = Number(countResult.rows[0]?.count || 0);
  const result = await database.execute({
    sql: `
      SELECT * FROM posts
      ${query.where}
      ORDER BY ${query.orderBy}
      LIMIT ? OFFSET ?
    `,
    args: [...query.args, query.pageSize, (query.page - 1) * query.pageSize],
  });

  return {
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    posts: result.rows.map(rowToPost),
  };
}

export async function getPost(identifier, options = {}) {
  return getPostFromConnection(getDatabase(), identifier, {
    includeArchived: Boolean(options.includeArchived),
    includeDrafts: Boolean(options.includeDrafts),
  });
}

export async function createPost(payload, { actor = "admin" } = {}) {
  const normalized = normalizePostPayload(payload);

  return inTransaction(async (connection) => {
    const timestamp = nowIso();
    const id = crypto.randomUUID();
    const slug = await uniqueSlug(connection, normalized.slug, id);
    const publishedAt = normalized.status === "published" ? timestamp : null;

    await connection.execute({
      sql: `
        INSERT INTO posts (
          id, slug, kind, title, excerpt, category, tags, date, read_time, unread, featured,
          body, status, created_at, updated_at, published_at, version, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, NULL)
      `,
      args: [
        id,
        slug,
        normalized.kind,
        normalized.title,
        normalized.excerpt,
        normalized.category,
        JSON.stringify(normalized.tags),
        normalized.date,
        normalized.readTime,
        normalized.featured ? 1 : 0,
        normalized.body,
        normalized.status,
        timestamp,
        timestamp,
        publishedAt,
      ],
    });

    const post = await getPostFromConnection(connection, id);
    await insertRevision(connection, post, actor);
    return post;
  });
}

export async function updatePost(id, payload, { actor = "admin" } = {}) {
  return inTransaction(async (connection) => {
    const existing = await getPostFromConnection(connection, id);
    if (!existing) throw notFound("文章不存在。", "POST_NOT_FOUND");

    const expectedVersion = Number(payload.version || existing.version);
    if (expectedVersion !== existing.version) {
      throw conflict("文章已在其他位置被修改，请刷新后再保存。", "POST_VERSION_CONFLICT", {
        currentVersion: existing.version,
      });
    }

    const normalized = normalizePostPayload(payload, existing);
    const timestamp = nowIso();
    const slug = await uniqueSlug(connection, normalized.slug, id);
    const publishedAt =
      normalized.status === "published" ? existing.publishedAt || timestamp : null;

    const result = await connection.execute({
      sql: `
        UPDATE posts SET
          slug = ?, kind = ?, title = ?, excerpt = ?, category = ?, tags = ?, date = ?,
          read_time = ?, featured = ?, body = ?, status = ?, updated_at = ?, published_at = ?,
          version = version + 1
        WHERE id = ? AND version = ?
      `,
      args: [
        slug,
        normalized.kind,
        normalized.title,
        normalized.excerpt,
        normalized.category,
        JSON.stringify(normalized.tags),
        normalized.date,
        normalized.readTime,
        normalized.featured ? 1 : 0,
        normalized.body,
        normalized.status,
        timestamp,
        publishedAt,
        id,
        expectedVersion,
      ],
    });

    if (!result.rowsAffected) {
      throw conflict("文章已在其他位置被修改，请刷新后再保存。", "POST_VERSION_CONFLICT");
    }

    const post = await getPostFromConnection(connection, id);
    await insertRevision(connection, post, actor);
    return post;
  });
}

async function setArchivedState(id, archived, { actor = "admin", version } = {}) {
  return inTransaction(async (connection) => {
    const existing = await getPostFromConnection(connection, id);
    if (!existing) throw notFound("文章不存在。", "POST_NOT_FOUND");
    if (archived === Boolean(existing.archivedAt)) return existing;
    if (version && Number(version) !== existing.version) {
      throw conflict("文章状态已变化，请刷新后重试。", "POST_VERSION_CONFLICT", {
        currentVersion: existing.version,
      });
    }

    await connection.execute({
      sql: "UPDATE posts SET archived_at = ?, updated_at = ?, version = version + 1 WHERE id = ?",
      args: [archived ? nowIso() : null, nowIso(), id],
    });
    const post = await getPostFromConnection(connection, id);
    await insertRevision(connection, post, actor);
    return post;
  });
}

export function archivePost(id, options) {
  return setArchivedState(id, true, options);
}

export function restorePost(id, options) {
  return setArchivedState(id, false, options);
}

export async function purgePost(id) {
  return inTransaction(async (connection) => {
    const existing = await getPostFromConnection(connection, id);
    if (!existing) throw notFound("文章不存在。", "POST_NOT_FOUND");
    if (!existing.archivedAt) {
      throw conflict("只有已归档文章可以永久删除。", "POST_NOT_ARCHIVED");
    }

    // Keep deletion deterministic even when a remote SQLite provider handles
    // foreign-key pragmas per connection.
    await connection.execute({
      sql: "DELETE FROM post_revisions WHERE post_id = ?",
      args: [existing.id],
    });
    const result = await connection.execute({
      sql: "DELETE FROM posts WHERE id = ?",
      args: [existing.id],
    });
    return result.rowsAffected > 0;
  });
}

export async function listPostRevisions(postId, { page = 1, pageSize = 20 } = {}) {
  const safePage = clampInteger(page, 1, 1, 100_000);
  const safePageSize = clampInteger(pageSize, 20, 1, 50);
  const database = getDatabase();
  const post = await getPost(postId, { includeArchived: true, includeDrafts: true });
  if (!post) throw notFound("文章不存在。", "POST_NOT_FOUND");

  const count = await database.execute({
    sql: "SELECT COUNT(*) AS count FROM post_revisions WHERE post_id = ?",
    args: [post.id],
  });
  const total = Number(count.rows[0]?.count || 0);
  const result = await database.execute({
    sql: `
      SELECT id, post_id, version, snapshot, actor, created_at
      FROM post_revisions
      WHERE post_id = ?
      ORDER BY version DESC
      LIMIT ? OFFSET ?
    `,
    args: [post.id, safePageSize, (safePage - 1) * safePageSize],
  });

  return {
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
    revisions: result.rows.map((row) => ({
      actor: row.actor || null,
      createdAt: row.created_at,
      id: row.id,
      postId: row.post_id,
      snapshot: JSON.parse(row.snapshot),
      version: Number(row.version),
    })),
  };
}

export async function restorePostRevision(postId, revisionVersion, { actor = "admin" } = {}) {
  const database = getDatabase();
  const current = await getPost(postId, { includeArchived: true, includeDrafts: true });
  if (!current) throw notFound("文章不存在。", "POST_NOT_FOUND");
  const result = await database.execute({
    sql: "SELECT snapshot FROM post_revisions WHERE post_id = ? AND version = ? LIMIT 1",
    args: [current.id, Number(revisionVersion)],
  });
  if (!result.rows[0]) throw notFound("修订版本不存在。", "REVISION_NOT_FOUND");
  const snapshot = JSON.parse(result.rows[0].snapshot);

  if (current.archivedAt) await restorePost(current.id, { actor, version: current.version });
  const latest = await getPost(current.id, { includeArchived: true, includeDrafts: true });
  return updatePost(
    current.id,
    {
      ...snapshot,
      status: snapshot.publicationStatus || "draft",
      version: latest.version,
    },
    { actor },
  );
}

export async function getPostTags({ includeDrafts = false } = {}) {
  const result = await listPosts({ includeDrafts, pageSize: 50 });
  return getAllTags(result.posts);
}

export async function getTagStats() {
  const result = await getDatabase().execute(`
    SELECT MIN(je.value) AS name, COUNT(DISTINCT posts.id) AS count
    FROM posts, json_each(posts.tags) AS je
    WHERE posts.status = 'published' AND posts.archived_at IS NULL
    GROUP BY lower(je.value)
    ORDER BY count DESC, MIN(je.value) ASC
  `);
  return result.rows.map((row) => ({ count: Number(row.count), name: row.name }));
}

export function summarizePosts(posts) {
  return posts.map(summarizePost);
}

export async function getDashboardSummary() {
  const database = getDatabase();
  const result = await database.execute(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN archived_at IS NULL AND status = 'published' THEN 1 ELSE 0 END) AS published,
      SUM(CASE WHEN archived_at IS NULL AND status = 'draft' THEN 1 ELSE 0 END) AS draft,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived
    FROM posts
  `);
  const row = result.rows[0] || {};
  return {
    archived: Number(row.archived || 0),
    draft: Number(row.draft || 0),
    published: Number(row.published || 0),
    total: Number(row.total || 0),
  };
}
