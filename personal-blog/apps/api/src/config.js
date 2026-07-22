import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
export const apiRoot = path.resolve(path.dirname(currentFile), "..");
export const repoRoot = path.resolve(apiRoot, "../..");
export const dataDir = path.join(apiRoot, "data");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env"));
mkdirSync(dataDir, { recursive: true });

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getConfig() {
  const isVercel = process.env.VERCEL === "1";
  const isProduction = isVercel || process.env.NODE_ENV === "production";
  const localDatabaseFile = path.resolve(process.env.BLOG_DB_FILE || path.join(dataDir, "blog.sqlite"));
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim() || "";
  const adminPassword = process.env.ADMIN_PASSWORD || (!isProduction ? "admin123456" : "");
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || "";
  const sessionSecret =
    process.env.SESSION_SECRET || (!isProduction ? "local-development-session-secret-change-me" : "");
  const configuredOrigins = parseList(process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN);
  const localOrigins = isProduction
    ? []
    : ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4174"];

  return {
    admin: {
      configured: Boolean(
        (process.env.ADMIN_USERNAME || !isProduction) &&
          (adminPassword || adminPasswordHash) &&
          sessionSecret.length >= 32,
      ),
      password: adminPassword,
      passwordHash: adminPasswordHash,
      username: process.env.ADMIN_USERNAME || (!isProduction ? "admin" : ""),
    },
    allowedOrigins: [...new Set([...configuredOrigins, ...localOrigins])],
    database: {
      authToken: process.env.TURSO_AUTH_TOKEN || "",
      configured: Boolean(tursoUrl || !isVercel),
      localFile: tursoUrl ? "" : localDatabaseFile,
      provider: tursoUrl ? "turso" : isVercel ? "unconfigured" : "sqlite",
      url: tursoUrl || (isVercel ? "" : `file:${localDatabaseFile}`),
    },
    hostname: process.env.HOST || "127.0.0.1",
    isProduction,
    isVercel,
    logLevel: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
    maxBodyBytes: parsePositiveInteger(process.env.MAX_BODY_BYTES, 1024 * 1024),
    port: parsePositiveInteger(process.env.PORT, 4174),
    session: {
      cookieName: "blog_session",
      secret: sessionSecret,
      ttlMs: 1000 * 60 * 60 * 24 * 7,
    },
  };
}
