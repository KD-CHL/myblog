import { readFileSync } from "node:fs";
import path from "node:path";
import { apiRoot } from "../../config.js";
import { getAllTags, makeSlug, parseTags } from "../posts/model.js";
import { defaultSiteSettings } from "../site/defaults.js";

const seed = JSON.parse(readFileSync(path.join(apiRoot, "data/content.json"), "utf8"));

function dateToIso(value, index = 0) {
  const match = String(value || "").match(/^(\d{4})[.-](\d{2})[.-](\d{2})$/);
  if (!match) return new Date(Date.UTC(2026, 0, 1, 12, 0, index)).toISOString();
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, index)).toISOString();
}

const fallbackPosts = (seed.posts || [])
  .filter((item) => item.status !== "draft")
  .map((item, index) => {
    const timestamp = item.publishedAt || item.updatedAt || dateToIso(item.date, index);
    return {
      archivedAt: null,
      body: item.body || item.excerpt || item.title,
      category: item.category || "文章库",
      createdAt: item.createdAt || timestamp,
      date: item.date || "",
      excerpt: item.excerpt || item.title,
      featured: Boolean(item.featured),
      id: item.id,
      kind: item.kind || "ARTICLE",
      publicationStatus: "published",
      publishedAt: timestamp,
      readTime: item.readTime || "5 min",
      slug: makeSlug(item.slug || item.title, item.id),
      status: "published",
      tags: parseTags(item.tags),
      title: item.title,
      updatedAt: timestamp,
      version: 1,
    };
  });

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sortPosts(posts, sort) {
  return [...posts].sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title, "zh-CN");
    if (sort === "oldest") return left.publishedAt.localeCompare(right.publishedAt);
    if (sort === "shortest") {
      return Number.parseInt(left.readTime, 10) - Number.parseInt(right.readTime, 10);
    }
    return right.publishedAt.localeCompare(left.publishedAt);
  });
}

export function listFallbackPosts(options = {}) {
  const page = clampInteger(options.page, 1, 1, 100_000);
  const pageSize = clampInteger(options.pageSize, 12, 1, 50);
  const filter = String(options.filter || "全部").trim().toLowerCase();
  const nav = String(options.nav || "总览").trim();
  const query = String(options.query || "").trim().toLowerCase();

  const matched = fallbackPosts.filter((post) => {
    if (nav && !["总览", "归档"].includes(nav) && post.category !== nav) return false;
    if (
      filter &&
      filter !== "全部" &&
      !post.category.toLowerCase().includes(filter) &&
      !post.tags.some((tag) => tag.toLowerCase() === filter)
    ) return false;
    if (!query) return true;
    return [post.title, post.excerpt, post.category, post.body, ...post.tags]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const sorted = sortPosts(matched, options.sort);
  const total = sorted.length;

  return {
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    posts: sorted.slice((page - 1) * pageSize, page * pageSize),
  };
}

export function getFallbackPost(identifier) {
  return fallbackPosts.find((post) => post.id === identifier || post.slug === identifier) || null;
}

export function getFallbackTags() {
  return getAllTags(fallbackPosts);
}

export function getFallbackSiteBundle() {
  const settings = {
    ...defaultSiteSettings,
    brand: { ...defaultSiteSettings.brand, ...(seed.site?.brand || {}) },
    filters: (seed.site?.filters || defaultSiteSettings.filters).filter((item) => item !== "未读"),
    navItems: seed.site?.navItems || defaultSiteSettings.navItems,
  };
  const published = sortPosts(fallbackPosts, "latest");
  const projects = published.filter((post) => post.category === "作品集");
  const tags = getAllTags(published);

  return {
    projects: projects.slice(0, 3).map((post) => ({
      description: post.excerpt,
      name: post.title,
      slug: post.slug,
    })),
    site: {
      ...settings,
      filterTags: ["全部", ...tags.slice(0, 10)],
      readOnly: true,
      stats: [
        { label: "已发布文章", value: String(published.length) },
        { label: "作品项目", value: String(projects.length) },
      ],
      subscription: { ...settings.subscription, enabled: false },
      writingState: settings.publicWritingState,
    },
    tags,
    timeline: published.slice(0, 3).map((post) => ({
      date: post.publishedAt,
      slug: post.slug,
      text: post.excerpt,
      title: post.title,
    })),
  };
}
