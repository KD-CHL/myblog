import crypto from "node:crypto";
import { getConfig } from "../config.js";

export function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashToken(token) {
  return crypto.createHmac("sha256", getConfig().session.secret).update(String(token)).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, { passwordHash, plainPassword }) {
  if (passwordHash) {
    const [algorithm, salt, expected] = passwordHash.split("$");
    if (algorithm !== "scrypt" || !salt || !expected) return false;
    const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
    return safeCompare(actual, expected);
  }

  return safeCompare(password, plainPassword);
}

export function hashNetworkAddress(value) {
  if (!value) return "";
  return crypto
    .createHmac("sha256", getConfig().session.secret)
    .update(String(value))
    .digest("hex")
    .slice(0, 24);
}
