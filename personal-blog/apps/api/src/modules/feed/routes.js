import { getConfig } from "../../config.js";
import { listFallbackPosts, getFallbackSiteBundle } from "../public/fallback.js";
import { listPosts } from "../posts/repository.js";
import { getSiteSettings } from "../site/repository.js";
import { defaultSiteSettings } from "../site/defaults.js";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822Date(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function buildRssXml(posts, { baseUrl, description, title }) {
  const items = posts
    .map((post) => {
      const link = `${baseUrl}/posts/${encodeURIComponent(post.slug)}`;
      const categories = (post.tags || [])
        .map((tag) => `      <category>${escapeXml(tag)}</category>`)
        .join("\n");
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${rfc822Date(post.publishedAt || post.updatedAt)}</pubDate>`,
        `      <description>${escapeXml(post.excerpt || "")}</description>`,
        categories,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(baseUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <atom:link href="${escapeXml(baseUrl)}/api/feed" rel="self" type="application/rss+xml"/>`,
    "    <language>zh-CN</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    "    <generator>Knowledge Log</generator>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}

function resolveBaseUrl(context) {
  const config = getConfig();
  if (config.publicUrl) return config.publicUrl.replace(/\/+$/, "");
  const host = context.request.headers.host || "localhost";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function registerFeedRoutes(router) {
  router.add("GET", "/api/feed", async (context) => {
    const config = getConfig();
    let posts;
    let brand;

    if (config.database.configured) {
      const [postsResult, settingsResult] = await Promise.all([listPosts({ pageSize: 20 }), getSiteSettings()]);
      posts = postsResult.posts;
      brand = settingsResult.settings.brand;
    } else {
      posts = listFallbackPosts({ pageSize: 20 }).posts;
      brand = getFallbackSiteBundle().site.brand;
    }

    const publishedPosts = posts.filter((post) => post.publicationStatus !== "draft");
    const xml = buildRssXml(publishedPosts, {
      baseUrl: resolveBaseUrl(context),
      description: brand.subtitle || defaultSiteSettings.brand.subtitle,
      title: brand.title || defaultSiteSettings.brand.title,
    });

    context.response.writeHead(200, {
      "Cache-Control": "public, max-age=600",
      "Content-Type": "application/rss+xml; charset=utf-8",
    });
    context.response.end(xml);
    return {};
  });
}
