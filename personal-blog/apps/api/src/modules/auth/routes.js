import { getConfig } from "../../config.js";
import { buildCookie, parseCookies } from "../../core/http.js";
import { loginRateLimiter } from "../../core/rate-limit.js";
import { recordAuditEvent } from "../audit/repository.js";
import { createSession, deleteSession, getSession, verifyAdminCredentials } from "./service.js";

export function registerAuthRoutes(router) {
  router.add(
    "POST",
    "/api/auth/login",
    async (context) => {
      const username = typeof context.body.username === "string" ? context.body.username.trim() : "";
      const password = typeof context.body.password === "string" ? context.body.password : "";
      const limiterKey = `${context.ip}:${username.toLowerCase()}`;
      loginRateLimiter.consume(limiterKey);

      try {
        const user = verifyAdminCredentials(username, password);
        const session = await createSession(user.username, {
          ip: context.ip,
          userAgent: context.request.headers["user-agent"] || "",
        });
        loginRateLimiter.reset(limiterKey);
        await recordAuditEvent({
          action: "auth.login",
          actor: user.username,
          entityType: "session",
          requestId: context.requestId,
        });

        return {
          body: { user },
          headers: {
            "Set-Cookie": buildCookie(getConfig().session.cookieName, session.token, {
              maxAge: Math.floor(getConfig().session.ttlMs / 1000),
              secure: getConfig().isProduction,
            }),
          },
        };
      } catch (error) {
        await recordAuditEvent({
          action: "auth.login_failed",
          entityType: "session",
          metadata: { username: username.slice(0, 80) },
          requestId: context.requestId,
        }).catch(() => undefined);
        throw error;
      }
    },
    { body: true },
  );

  router.add("POST", "/api/auth/logout", async (context) => {
    const token = parseCookies(context.request.headers.cookie || "")[getConfig().session.cookieName] || "";
    const session = getConfig().database.configured ? await getSession(token) : null;
    if (getConfig().database.configured) await deleteSession(token);
    if (session) {
      await recordAuditEvent({
        action: "auth.logout",
        actor: session.username,
        entityType: "session",
        entityId: session.id,
        requestId: context.requestId,
      });
    }

    return {
      body: { ok: true },
      headers: {
        "Set-Cookie": buildCookie(getConfig().session.cookieName, "", {
          maxAge: 0,
          secure: getConfig().isProduction,
        }),
      },
    };
  });

  router.add("GET", "/api/auth/me", async (context) => {
    if (!getConfig().database.configured) return { body: { user: null } };
    const token = parseCookies(context.request.headers.cookie || "")[getConfig().session.cookieName] || "";
    const session = await getSession(token);
    return { body: { user: session ? { username: session.username } : null } };
  });
}
