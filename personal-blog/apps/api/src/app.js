import crypto from "node:crypto";
import { getConfig } from "./config.js";
import { normalizeError, notFound } from "./core/errors.js";
import {
  applyResponseHeaders,
  assertTrustedMutation,
  getClientIp,
  parseCookies,
  readJsonBody,
  sendJson,
} from "./core/http.js";
import { logger } from "./core/logger.js";
import { writeRateLimiter } from "./core/rate-limit.js";
import { createRouter } from "./core/router.js";
import { getDatabaseHealth, initializeDatabase } from "./db/bootstrap.js";
import { requireSession } from "./modules/auth/service.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerCommentRoutes } from "./modules/comments/routes.js";
import { registerFeedRoutes } from "./modules/feed/routes.js";
import { registerPostRoutes } from "./modules/posts/routes.js";
import { registerSiteRoutes } from "./modules/site/routes.js";
import { registerSubscriptionRoutes } from "./modules/subscriptions/routes.js";

const router = createRouter();

router.add("GET", "/api/health", async () => {
  const config = getConfig();
  try {
    const databaseHealth = await getDatabaseHealth();
    return {
      body: {
        adminConfigured: config.admin.configured,
        database: {
          configured: config.database.configured,
          provider: config.database.provider,
          ...databaseHealth,
        },
        service: "personal-blog-api",
        status: config.admin.configured ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      },
      statusCode: config.admin.configured ? 200 : 503,
    };
  } catch (error) {
    return {
      body: {
        adminConfigured: config.admin.configured,
        database: {
          configured: config.database.configured,
          error: error.message,
          provider: config.database.provider,
        },
        service: "personal-blog-api",
        status: "unavailable",
        timestamp: new Date().toISOString(),
      },
      statusCode: 503,
    };
  }
});

registerAuthRoutes(router);
registerCommentRoutes(router);
registerFeedRoutes(router);
registerPostRoutes(router);
registerSiteRoutes(router);
registerSubscriptionRoutes(router);

function requestIdFrom(request) {
  const supplied = request.headers["x-request-id"];
  return typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

export async function handleRequest(request, response) {
  const config = getConfig();
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const ip = getClientIp(request);
  applyResponseHeaders(request, response, { allowedOrigins: config.allowedOrigins, requestId });

  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    assertTrustedMutation(request, config.allowedOrigins);
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const route = router.match(request.method, url.pathname);
    if (!route) throw notFound("接口不存在。", "ROUTE_NOT_FOUND");
    if (url.pathname !== "/api/health" && config.database.configured) {
      await initializeDatabase();
    }

    const context = {
      body: route.options.body ? await readJsonBody(request, config.maxBodyBytes) : {},
      ip,
      params: route.params,
      request,
      requestId,
      response,
      url,
      user: null,
    };

    context.requireAdmin = async () => {
      if (context.user) return context.user;
      const token = parseCookies(request.headers.cookie || "")[config.session.cookieName] || "";
      context.user = await requireSession(token);
      return context.user;
    };

    if (route.options.auth) await context.requireAdmin();
    if (route.options.write) writeRateLimiter.consume(`${ip}:${context.user?.username || "anonymous"}`);

    const result = (await route.handler(context)) || {};
    if (!response.writableEnded) {
      sendJson(response, result.statusCode || 200, result.body ?? { ok: true }, result.headers);
    }
    logger.info("http.request.completed", {
      durationMs: Math.round(performance.now() - startedAt),
      method: request.method,
      path: url.pathname,
      requestId,
      statusCode: result.statusCode || 200,
    });
  } catch (rawError) {
    const error = normalizeError(rawError);
    const headers = error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {};
    if (!response.writableEnded) {
      sendJson(
        response,
        error.statusCode,
        {
          error: {
            code: error.code || "INTERNAL_ERROR",
            ...(error.details ? { details: error.details } : {}),
            message: error.statusCode >= 500 && config.isProduction ? "服务暂时不可用，请稍后重试。" : error.message,
            requestId,
            statusCode: error.statusCode,
          },
        },
        headers,
      );
    }
    logger[error.statusCode >= 500 ? "error" : "warn"]("http.request.failed", {
      code: error.code,
      durationMs: Math.round(performance.now() - startedAt),
      message: error.message,
      method: request.method,
      path: request.url,
      requestId,
      statusCode: error.statusCode,
    });
  }
}
