export class AppError extends Error {
  constructor(message, { code = "INTERNAL_ERROR", details, statusCode = 500 } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

export function badRequest(message, code = "BAD_REQUEST", details) {
  return new AppError(message, { code, details, statusCode: 400 });
}

export function unauthorized(message = "请先登录后台。") {
  return new AppError(message, { code: "UNAUTHORIZED", statusCode: 401 });
}

export function forbidden(message = "当前请求没有操作权限。", code = "FORBIDDEN") {
  return new AppError(message, { code, statusCode: 403 });
}

export function notFound(message, code = "NOT_FOUND") {
  return new AppError(message, { code, statusCode: 404 });
}

export function conflict(message, code = "CONFLICT", details) {
  return new AppError(message, { code, details, statusCode: 409 });
}

export function validationError(message, details) {
  return new AppError(message, { code: "VALIDATION_ERROR", details, statusCode: 422 });
}

export function tooManyRequests(message, retryAfterSeconds) {
  const error = new AppError(message, {
    code: "RATE_LIMITED",
    details: { retryAfterSeconds },
    statusCode: 429,
  });
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

export function serviceUnavailable(message, code = "SERVICE_UNAVAILABLE") {
  return new AppError(message, { code, statusCode: 503 });
}

export function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (Number.isInteger(error?.statusCode)) {
    return new AppError(error.message || "请求处理失败。", {
      code: error.code || "REQUEST_FAILED",
      details: error.details,
      statusCode: error.statusCode,
    });
  }

  if (String(error?.message || "").includes("UNIQUE constraint failed")) {
    return conflict("数据与现有记录冲突。", "UNIQUE_CONSTRAINT");
  }

  return new AppError(error?.message || "服务端发生未知错误。");
}
