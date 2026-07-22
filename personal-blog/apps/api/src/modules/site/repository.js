import { validationError } from "../../core/errors.js";
import { getDatabase } from "../../db/client.js";
import { getDashboardSummary, listPosts, summarizePosts } from "../posts/repository.js";
import { getAllTags, nowIso } from "../posts/model.js";
import { defaultSiteSettings } from "./defaults.js";

function parseSettings(value) {
  try {
    return { ...defaultSiteSettings, ...JSON.parse(value || "{}") };
  } catch {
    return defaultSiteSettings;
  }
}

function trimText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function cleanList(value, fallback, maxItems = 12) {
  if (!Array.isArray(value)) return fallback;
  const items = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  return items.slice(0, maxItems);
}

export async function getSiteSettings() {
  const result = await getDatabase().execute("SELECT value, updated_at FROM site_settings WHERE key = 'site'");
  return {
    settings: parseSettings(result.rows[0]?.value),
    updatedAt: result.rows[0]?.updated_at || null,
  };
}

export async function updateSiteSettings(payload) {
  const current = (await getSiteSettings()).settings;
  const settings = {
    brand: {
      mark: trimText(payload.brand?.mark, current.brand.mark, 3),
      subtitle: trimText(payload.brand?.subtitle, current.brand.subtitle, 80),
      title: trimText(payload.brand?.title, current.brand.title, 80),
    },
    filters: cleanList(payload.filters, current.filters),
    hero: {
      description: trimText(payload.hero?.description, current.hero.description, 300),
      eyebrow: trimText(payload.hero?.eyebrow, current.hero.eyebrow, 100),
      title: trimText(payload.hero?.title, current.hero.title, 100),
    },
    navItems: cleanList(payload.navItems, current.navItems, 8),
    publicWritingState: trimText(payload.publicWritingState, current.publicWritingState, 240),
    subscription: {
      description: trimText(
        payload.subscription?.description,
        current.subscription.description,
        240,
      ),
      enabled:
        typeof payload.subscription?.enabled === "boolean"
          ? payload.subscription.enabled
          : current.subscription.enabled,
      title: trimText(payload.subscription?.title, current.subscription.title, 80),
    },
  };

  if (!settings.navItems.includes("总览")) {
    throw validationError("导航至少需要包含“总览”。", { fields: { navItems: "缺少总览入口。" } });
  }

  const timestamp = nowIso();
  await getDatabase().execute({
    sql: `
      INSERT INTO site_settings (key, value, updated_at) VALUES ('site', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
    args: [JSON.stringify(settings), timestamp],
  });

  return { settings, updatedAt: timestamp };
}

export async function getPublicSiteBundle() {
  const [{ settings }, published, projects, summary] = await Promise.all([
    getSiteSettings(),
    listPosts({ page: 1, pageSize: 50 }),
    listPosts({ nav: "作品集", page: 1, pageSize: 3 }),
    getDashboardSummary(),
  ]);

  const timeline = published.posts.slice(0, 3).map((post) => ({
    date: post.publishedAt || post.updatedAt,
    slug: post.slug,
    text: post.excerpt,
    title: post.title,
  }));

  return {
    projects: projects.posts.map((post) => ({
      description: post.excerpt,
      name: post.title,
      slug: post.slug,
    })),
    site: {
      ...settings,
      filterTags: ["全部", ...getAllTags(published.posts).slice(0, 10)],
      stats: [
        { label: "已发布文章", value: String(summary.published) },
        { label: "作品项目", value: String(projects.pagination.total) },
      ],
      writingState: settings.publicWritingState,
    },
    tags: getAllTags(published.posts),
    timeline,
  };
}

export async function getAdminDashboard() {
  const [stats, recent] = await Promise.all([
    getDashboardSummary(),
    listPosts({ includeDrafts: true, page: 1, pageSize: 5 }),
  ]);
  return { recentPosts: summarizePosts(recent.posts), stats };
}
