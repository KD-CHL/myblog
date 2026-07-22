import { badRequest, forbidden } from "./errors.js";

export function parseCookies(cookieHeader = "") {
  const cookies = {};

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rawKey, ...valueParts] = trimmed.split("=");

    try {
      cookies[decodeURIComponent(rawKey)] = decodeURIComponent(valueParts.join("="));
    } catch {
      // Ignore malformed cookie pairs instead of failing the whole request.
    }
  }

  return cookies;
}

export function buildCookie(name, value, { maxAge, secure = false } = {}) {
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function readJsonBody(request, maxBodyBytes) {
  const contentType = request.headers["content-type"] || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw badRequest("请求体必须使用 application/json。", "UNSUPPORTED_CONTENT_TYPE");
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = badRequest("请求内容过大。", "PAYLOAD_TOO_LARGE");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("请求体必须是合法 JSON。", "INVALID_JSON");
  }
}

export function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return request.socket?.remoteAddress || "unknown";
}

function requestOrigin(request) {
  const protocol = request.headers["x-forwarded-proto"] || (request.socket?.encrypted ? "https" : "http");
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  return host ? `${protocol}://${host}` : "";
}

export function resolveCorsOrigin(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) return "";
  const sameOrigin = origin === requestOrigin(request);
  if (sameOrigin || allowedOrigins.includes(origin)) return origin;

  try {
    const { hostname, port, protocol } = new URL(origin);
    if (port && allowedOrigins.includes(`${protocol}//${hostname}:*`)) return origin;
  } catch {
    return "";
  }
  return "";
}

export function assertTrustedMutation(request, allowedOrigins) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;

  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") {
    throw forbidden("已拒绝跨站写入请求。", "CROSS_SITE_REQUEST");
  }

  const origin = request.headers.origin;
  if (origin && !resolveCorsOrigin(request, allowedOrigins)) {
    throw forbidden("请求来源不在允许列表中。", "ORIGIN_NOT_ALLOWED");
  }
}

export function applyResponseHeaders(request, response, { allowedOrigins, requestId }) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin) {
    response.setHeader("Access-Control-Allow-Origin", corsOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Request-Id");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Request-Id", requestId);
}

export function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}
