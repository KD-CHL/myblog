import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("personal blog API complete workflow", async (suite) => {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "personal-blog-test-"));
  process.env.BLOG_DB_FILE = path.join(tempDirectory, "test.sqlite");
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD = "test-password-123456";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  process.env.LOG_LEVEL = "error";
  process.env.NODE_ENV = "test";

  const [{ handleRequest }, { closeDatabase }, { resetDatabaseBootstrapForTests }] = await Promise.all([
    import("./app.js"),
    import("./db/client.js"),
    import("./db/bootstrap.js"),
  ]);
  const server = http.createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  let createdPost;
  let subscription;

  async function request(pathname, { body, headers, method = "GET", useCookie = false } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(useCookie && cookie ? { Cookie: cookie } : {}),
        ...(headers || {}),
      },
      method,
    });
    const payload = await response.json();
    return { payload, response };
  }

  suite.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    rmSync(tempDirectory, { force: true, recursive: true });
  });

  await suite.test("health reports current migrations", async () => {
    const { payload, response } = await request("/api/health");
    assert.equal(response.status, 200);
    assert.equal(payload.database.provider, "sqlite");
    assert.equal(payload.database.migrationCurrent, true);
    assert.equal(payload.database.migrationVersion, 6);
  });

  await suite.test("rejects unauthenticated and cross-site writes", async () => {
    const unauthenticated = await request("/api/posts", {
      body: { title: "nope" },
      method: "POST",
    });
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(unauthenticated.payload.error.code, "UNAUTHORIZED");

    const crossSite = await request("/api/auth/login", {
      body: { password: "x", username: "x" },
      headers: { Origin: "https://evil.example" },
      method: "POST",
    });
    assert.equal(crossSite.response.status, 403);
    assert.equal(crossSite.payload.error.code, "ORIGIN_NOT_ALLOWED");
  });

  await suite.test("logs in with an HttpOnly session cookie", async () => {
    const failed = await request("/api/auth/login", {
      body: { password: "wrong", username: "test-admin" },
      method: "POST",
    });
    assert.equal(failed.response.status, 401);

    const login = await request("/api/auth/login", {
      body: { password: "test-password-123456", username: "test-admin" },
      method: "POST",
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.user.username, "test-admin");
    const setCookie = login.response.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    cookie = setCookie.split(";")[0];

    const me = await request("/api/auth/me", { useCookie: true });
    assert.equal(me.payload.user.username, "test-admin");
  });

  await suite.test("creates a private draft", async () => {
    const created = await request("/api/posts", {
      body: {
        body: "# API test\n\nDraft body.",
        category: "技术笔记",
        excerpt: "Draft visibility check.",
        kind: "NOTE",
        status: "draft",
        tags: ["API", "测试"],
        title: "Temporary API workflow post",
      },
      method: "POST",
      useCookie: true,
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.post.status, "draft");
    assert.equal(created.payload.post.version, 1);
    createdPost = created.payload.post;

    const publicDetail = await request(`/api/posts/${encodeURIComponent(createdPost.slug)}`);
    assert.equal(publicDetail.response.status, 404);

    const publicList = await request("/api/posts?pageSize=50");
    assert.equal(publicList.payload.posts.some((post) => post.id === createdPost.id), false);
  });

  await suite.test("publishes with optimistic concurrency", async () => {
    const published = await request(`/api/posts/${createdPost.id}`, {
      body: { status: "published", version: createdPost.version },
      method: "PUT",
      useCookie: true,
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.payload.post.status, "published");
    assert.equal(published.payload.post.version, 2);
    assert.ok(published.payload.post.publishedAt);
    createdPost = published.payload.post;

    const stale = await request(`/api/posts/${createdPost.id}`, {
      body: { status: "draft", version: 1 },
      method: "PUT",
      useCookie: true,
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.payload.error.code, "POST_VERSION_CONFLICT");

    const publicDetail = await request(`/api/posts/${encodeURIComponent(createdPost.slug)}`);
    assert.equal(publicDetail.response.status, 200);
  });

  await suite.test("archives, restores, and records revisions", async () => {
    const archived = await request(`/api/posts/${createdPost.id}/archive`, {
      body: { version: createdPost.version },
      method: "POST",
      useCookie: true,
    });
    assert.equal(archived.payload.post.status, "archived");
    createdPost = archived.payload.post;

    const hidden = await request(`/api/posts/${encodeURIComponent(createdPost.slug)}`);
    assert.equal(hidden.response.status, 404);

    const restored = await request(`/api/posts/${createdPost.id}/restore`, {
      body: { version: createdPost.version },
      method: "POST",
      useCookie: true,
    });
    assert.equal(restored.payload.post.status, "published");
    createdPost = restored.payload.post;

    const revisions = await request(`/api/posts/${createdPost.id}/revisions`, { useCookie: true });
    assert.ok(revisions.payload.revisions.length >= 3);
  });

  await suite.test("updates public site settings without leaking draft counts", async () => {
    const current = await request("/api/admin/settings", { useCookie: true });
    const updated = await request("/api/admin/settings", {
      body: {
        ...current.payload.settings,
        hero: { ...current.payload.settings.hero, title: "Test Knowledge Log" },
      },
      method: "PUT",
      useCookie: true,
    });
    assert.equal(updated.payload.settings.hero.title, "Test Knowledge Log");

    const site = await request("/api/site");
    assert.equal(site.payload.site.hero.title, "Test Knowledge Log");
    assert.equal(site.payload.site.stats.some((stat) => stat.label.includes("草稿")), false);
    assert.equal("draftCount" in site.payload.site, false);
  });

  await suite.test("requires email and protects unsubscribe with a token", async () => {
    const invalid = await request("/api/subscriptions", {
      body: { email: "", topic: "全部" },
      method: "POST",
    });
    assert.equal(invalid.response.status, 422);

    const created = await request("/api/subscriptions", {
      body: { email: "reader@example.com", topic: "前端" },
      method: "POST",
    });
    assert.equal(created.response.status, 201);
    assert.ok(created.payload.unsubscribeToken);
    subscription = created.payload;

    const wrongToken = await request(`/api/subscriptions/${subscription.subscription.id}/unsubscribe`, {
      body: { token: "wrong" },
      method: "POST",
    });
    assert.equal(wrongToken.response.status, 404);

    const removed = await request(`/api/subscriptions/${subscription.subscription.id}/unsubscribe`, {
      body: { token: subscription.unsubscribeToken },
      method: "POST",
    });
    assert.equal(removed.response.status, 200);
  });

  await suite.test("exposes audit events only to the admin", async () => {
    const publicAudit = await request("/api/admin/audit");
    assert.equal(publicAudit.response.status, 401);
    const backup = await request("/api/admin/export", { useCookie: true });
    assert.equal(backup.response.status, 200);
    assert.equal(backup.payload.format, "personal-blog-export");
    assert.equal(JSON.stringify(backup.payload).includes("unsubscribe_token_hash"), false);
    const adminAudit = await request("/api/admin/audit?pageSize=50", { useCookie: true });
    assert.equal(adminAudit.response.status, 200);
    assert.ok(adminAudit.payload.events.some((event) => event.action === "post.published"));
    assert.ok(adminAudit.payload.events.every((event) => event.requestId));
  });

  await suite.test("purges only after archive and invalidates the session on logout", async () => {
    const archived = await request(`/api/posts/${createdPost.id}/archive`, {
      body: { version: createdPost.version },
      method: "POST",
      useCookie: true,
    });
    createdPost = archived.payload.post;

    const purged = await request(`/api/posts/${createdPost.id}/purge`, {
      body: { confirmTitle: createdPost.title },
      method: "POST",
      useCookie: true,
    });
    assert.equal(purged.payload.deleted, createdPost.id);

    const logout = await request("/api/auth/logout", { method: "POST", useCookie: true });
    assert.equal(logout.response.status, 200);
    const denied = await request("/api/admin/dashboard", { useCookie: true });
    assert.equal(denied.response.status, 401);
  });

  await suite.test("serves public seed content when Vercel storage is not configured", async () => {
    const previousVercel = process.env.VERCEL;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousTursoUrl = process.env.TURSO_DATABASE_URL;
    const previousTursoToken = process.env.TURSO_AUTH_TOKEN;

    closeDatabase();
    resetDatabaseBootstrapForTests();
    process.env.VERCEL = "1";
    process.env.NODE_ENV = "production";
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    try {
      const health = await request("/api/health");
      assert.equal(health.response.status, 503);
      assert.equal(health.payload.database.provider, "unconfigured");

      const me = await request("/api/auth/me");
      assert.equal(me.response.status, 200);
      assert.equal(me.payload.user, null);

      const site = await request("/api/site");
      assert.equal(site.response.status, 200);
      assert.equal(site.payload.site.readOnly, true);
      assert.equal(site.payload.site.subscription.enabled, false);

      const posts = await request("/api/posts?pageSize=50");
      assert.equal(posts.response.status, 200);
      assert.equal(posts.payload.posts.length, 5);
      const detail = await request(`/api/posts/${encodeURIComponent(posts.payload.posts[0].slug)}`);
      assert.equal(detail.response.status, 200);

      const rejectedWrite = await request("/api/subscriptions", {
        body: { email: "fallback@example.com", topic: "全部" },
        method: "POST",
      });
      assert.equal(rejectedWrite.response.status, 503);
      assert.equal(rejectedWrite.payload.error.code, "DATABASE_NOT_CONFIGURED");
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
      process.env.NODE_ENV = previousNodeEnv;
      if (previousTursoUrl === undefined) delete process.env.TURSO_DATABASE_URL;
      else process.env.TURSO_DATABASE_URL = previousTursoUrl;
      if (previousTursoToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
      else process.env.TURSO_AUTH_TOKEN = previousTursoToken;
      resetDatabaseBootstrapForTests();
    }
  });
});
