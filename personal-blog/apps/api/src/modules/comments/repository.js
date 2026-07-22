import crypto from "node:crypto";
import { notFound, validationError } from "../../core/errors.js";
import { getDatabase } from "../../db/client.js";
import { nowIso } from "../posts/model.js";
import { getPost } from "../posts/repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeCommentPayload(payload) {
  const fields = {};
  const authorName = String(payload.authorName || "").trim().slice(0, 40);
  if (!authorName) fields.authorName = "请填写昵称。";

  const rawEmail = String(payload.authorEmail || "").trim().toLowerCase();
  let authorEmail = null;
  if (rawEmail) {
    if (!EMAIL_PATTERN.test(rawEmail) || rawEmail.length > 254) {
      fields.authorEmail = "邮箱格式不正确。";
    } else {
      authorEmail = rawEmail;
    }
  }

  const content = String(payload.content || "").trim().slice(0, 1000);
  if (!content) fields.content = "请填写评论内容。";

  if (Object.keys(fields).length) {
    throw validationError("评论内容未通过校验。", { fields });
  }
  return { authorEmail, authorName, content };
}

function rowToPublicComment(row) {
  return {
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
  };
}

function rowToAdminComment(row) {
  return {
    authorEmail: row.author_email || null,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    postId: row.post_id,
    postSlug: row.post_slug || null,
    postTitle: row.post_title || null,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function createComment(postId, payload) {
  const post = await getPost(postId);
  const normalized = normalizeCommentPayload(payload);
  const database = getDatabase();
  const timestamp = nowIso();
  const record = {
    authorEmail: normalized.authorEmail,
    authorName: normalized.authorName,
    content: normalized.content,
    createdAt: timestamp,
    id: crypto.randomUUID(),
    postId: post.id,
    status: "approved",
    updatedAt: timestamp,
  };

  await database.execute({
    sql: `
      INSERT INTO comments (
        id, post_id, author_name, author_email, content, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'approved', ?, ?)
    `,
    args: [
      record.id,
      record.postId,
      record.authorName,
      record.authorEmail,
      record.content,
      record.createdAt,
      record.updatedAt,
    ],
  });

  return {
    comment: rowToPublicComment({
      author_name: record.authorName,
      content: record.content,
      created_at: record.createdAt,
      id: record.id,
    }),
    postTitle: post.title,
  };
}

export async function listPostComments(postId, { page = 1, pageSize = 20 } = {}) {
  const safePage = clampInteger(page, 1, 1, 10000);
  const safePageSize = clampInteger(pageSize, 20, 1, 50);
  const database = getDatabase();

  const count = await database.execute({
    sql: "SELECT COUNT(*) AS count FROM comments WHERE post_id = ? AND status = 'approved'",
    args: [postId],
  });
  const total = Number(count.rows[0]?.count || 0);

  const result = await database.execute({
    sql: `
      SELECT * FROM comments
      WHERE post_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [postId, safePageSize, (safePage - 1) * safePageSize],
  });

  return {
    comments: result.rows.map(rowToPublicComment),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

export async function listAdminComments({ page = 1, pageSize = 20, status = "all" } = {}) {
  const safePage = clampInteger(page, 1, 1, 10000);
  const safePageSize = clampInteger(pageSize, 20, 1, 100);
  const where = status === "all" ? "" : "WHERE c.status = ?";
  const args = status === "all" ? [] : [status];
  const database = getDatabase();

  const count = await database.execute({
    sql: `SELECT COUNT(*) AS count FROM comments c ${where}`,
    args,
  });
  const total = Number(count.rows[0]?.count || 0);

  const result = await database.execute({
    sql: `
      SELECT c.*, p.title AS post_title, p.slug AS post_slug
      FROM comments c
      LEFT JOIN posts p ON p.id = c.post_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, safePageSize, (safePage - 1) * safePageSize],
  });

  return {
    comments: result.rows.map(rowToAdminComment),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

export async function setCommentStatus(id, status) {
  const result = await getDatabase().execute({
    sql: "UPDATE comments SET status = ?, updated_at = ? WHERE id = ?",
    args: [status, nowIso(), id],
  });
  if (!result.rowsAffected) throw notFound("评论不存在。", "COMMENT_NOT_FOUND");
  return true;
}

export async function deleteComment(id) {
  const result = await getDatabase().execute({
    sql: "DELETE FROM comments WHERE id = ?",
    args: [id],
  });
  if (!result.rowsAffected) throw notFound("评论不存在。", "COMMENT_NOT_FOUND");
  return true;
}
