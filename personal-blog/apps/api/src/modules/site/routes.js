import { getConfig } from "../../config.js";
import { recordAuditEvent, listAuditEvents } from "../audit/repository.js";
import { getPostTags, getTagStats } from "../posts/repository.js";
import { getFallbackSiteBundle, getFallbackTags, getFallbackTagStats } from "../public/fallback.js";
import { getAdminDashboard, getPublicSiteBundle, getSiteSettings, updateSiteSettings } from "./repository.js";
import { listSubscriptions } from "../subscriptions/repository.js";
import { createContentExport } from "../admin/export.js";

export function registerSiteRoutes(router) {
  router.add("GET", "/api/site", async () => ({
    body: getConfig().database.configured ? await getPublicSiteBundle() : getFallbackSiteBundle(),
  }));

  router.add("GET", "/api/tags", async () => {
    const configured = getConfig().database.configured;
    const [tags, stats] = configured
      ? await Promise.all([getPostTags(), getTagStats()])
      : [getFallbackTags(), getFallbackTagStats()];
    return { body: { stats, tags } };
  });

  router.add("GET", "/api/admin/dashboard", async () => {
    const [dashboard, subscriptions] = await Promise.all([
      getAdminDashboard(),
      listSubscriptions({ page: 1, pageSize: 1, status: "active" }),
    ]);
    return {
      body: {
        ...dashboard,
        stats: { ...dashboard.stats, subscribers: subscriptions.pagination.total },
      },
    };
  }, { auth: true });

  router.add("GET", "/api/admin/settings", async () => ({
    body: await getSiteSettings(),
  }), { auth: true });

  router.add("PUT", "/api/admin/settings", async (context) => {
    const result = await updateSiteSettings(context.body);
    await recordAuditEvent({
      action: "site.settings_updated",
      actor: context.user.username,
      entityType: "site",
      entityId: "site",
      requestId: context.requestId,
    });
    return { body: result };
  }, { auth: true, body: true, write: true });

  router.add("GET", "/api/admin/audit", async (context) => ({
    body: await listAuditEvents({
      action: context.url.searchParams.get("action") || "",
      page: context.url.searchParams.get("page") || 1,
      pageSize: context.url.searchParams.get("pageSize") || 30,
    }),
  }), { auth: true });

  router.add("GET", "/api/admin/subscriptions", async (context) => ({
    body: await listSubscriptions({
      page: context.url.searchParams.get("page") || 1,
      pageSize: context.url.searchParams.get("pageSize") || 30,
      status: context.url.searchParams.get("status") || "active",
    }),
  }), { auth: true });

  router.add("GET", "/api/admin/export", async (context) => {
    const data = await createContentExport();
    await recordAuditEvent({
      action: "content.exported",
      actor: context.user.username,
      entityType: "site",
      entityId: "site",
      requestId: context.requestId,
    });
    return { body: data };
  }, { auth: true });
}
