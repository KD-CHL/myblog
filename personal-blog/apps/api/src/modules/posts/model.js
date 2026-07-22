import crypto from "node:crypto";
import { validationError } from "../../core/errors.js";

export const POST_KINDS = ["ARTICLE", "NOTE", "PROJECT", "LIFE"];
export const POST_STATUSES = ["draft", "published"];

export function nowIso() {
  return new Date().toISOString();
}

export function formatDisplayDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function parseTags(value) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(source.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 12);
}

export function makeSlug(value, fallback = "") {
  const base = String(value || fallback)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return base || fallback || crypto.randomUUID();
}

export function estimateReadTime(body) {
  const plainText = String(body || "").replace(/[`#>*_-]/g, " ");
  const chineseCharacters = plainText.match(/[\u3400-\u9fff]/g)?.length || 0;
  const latinWords = plainText.match(/[A-Za-z0-9]+/g)?.length || 0;
  const minutes = Math.max(1, Math.ceil(chineseCharacters / 350 + latinWords / 220));
  return `${minutes} min`;
}

function stringField(payload, key, fallback = "") {
  return typeof payload[key] === "string" ? payload[key].trim() : fallback;
}

export function normalizePostPayload(payload, existingPost = null) {
  const title = stringField(payload, "title", existingPost?.title || "");
  const excerpt = stringField(payload, "excerpt", existingPost?.excerpt || "");
  const body = stringField(payload, "body", existingPost?.body || "");
  const category = stringField(payload, "category", existingPost?.category || "文章库") || "文章库";
  const requestedKind = stringField(payload, "kind", existingPost?.kind || "ARTICLE").toUpperCase();
  const kind = POST_KINDS.includes(requestedKind) ? requestedKind : "ARTICLE";
  const requestedStatus = stringField(
    payload,
    "status",
    existingPost?.publicationStatus || existingPost?.status || "draft",
  );
  const status = POST_STATUSES.includes(requestedStatus) ? requestedStatus : "draft";
  const tags = parseTags(payload.tags ?? existingPost?.tags ?? []);

  const fieldErrors = {};
  if (!title) fieldErrors.title = "文章标题不能为空。";
  else if (title.length > 160) fieldErrors.title = "文章标题不能超过 160 个字符。";
  if (!excerpt) fieldErrors.excerpt = "文章摘要不能为空。";
  else if (excerpt.length > 500) fieldErrors.excerpt = "文章摘要不能超过 500 个字符。";
  if (!body) fieldErrors.body = "文章正文不能为空。";
  else if (body.length > 200_000) fieldErrors.body = "文章正文不能超过 200,000 个字符。";
  if (category.length > 60) fieldErrors.category = "分类名称不能超过 60 个字符。";
  if (tags.some((tag) => tag.length > 30)) fieldErrors.tags = "单个标签不能超过 30 个字符。";

  if (Object.keys(fieldErrors).length) {
    throw validationError("文章内容未通过校验。", { fields: fieldErrors });
  }

  return {
    body,
    category,
    date: stringField(payload, "date", existingPost?.date || formatDisplayDate()),
    excerpt,
    featured: Boolean(payload.featured ?? existingPost?.featured ?? false),
    kind,
    readTime: stringField(payload, "readTime", existingPost?.readTime || "") || estimateReadTime(body),
    slug: makeSlug(stringField(payload, "slug") || title, existingPost?.id),
    status,
    tags,
    title,
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

export function rowToPost(row) {
  if (!row) return null;
  const publicationStatus = row.status;

  return {
    archivedAt: row.archived_at || null,
    body: row.body,
    category: row.category,
    createdAt: row.created_at,
    date: row.date,
    excerpt: row.excerpt,
    featured: Boolean(row.featured),
    id: row.id,
    kind: row.kind,
    publicationStatus,
    publishedAt: row.published_at || null,
    readTime: row.read_time,
    slug: row.slug,
    status: row.archived_at ? "archived" : publicationStatus,
    tags: parseJson(row.tags, []),
    title: row.title,
    updatedAt: row.updated_at,
    version: Number(row.version || 1),
  };
}

export function summarizePost(post) {
  const { body, ...summary } = post;
  return summary;
}

export function getAllTags(posts) {
  return [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function createPostSnapshot(post) {
  return JSON.stringify({
    body: post.body,
    category: post.category,
    excerpt: post.excerpt,
    featured: post.featured,
    kind: post.kind,
    publicationStatus: post.publicationStatus,
    readTime: post.readTime,
    slug: post.slug,
    tags: post.tags,
    title: post.title,
  });
}
