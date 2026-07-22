const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(payload, statusCode) {
    super(payload?.error?.message || `API request failed: ${statusCode}`);
    this.name = "ApiError";
    this.code = payload?.error?.code || "REQUEST_FAILED";
    this.details = payload?.error?.details;
    this.requestId = payload?.error?.requestId;
    this.statusCode = statusCode;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload, response.status);
  return payload;
}

function withQuery(path, values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      params.set(key, String(value));
    }
  }
  return params.size ? `${path}?${params}` : path;
}

export function fetchCurrentUser() {
  return request("/auth/me");
}

export function loginAdmin({ username, password }) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin() {
  return request("/auth/logout", { method: "POST" });
}

export function fetchSite() {
  return request("/site");
}

export function fetchPosts(options = {}) {
  return request(withQuery("/posts", options));
}

export function fetchPost(identifier, { includeArchived = false, includeDrafts = false } = {}) {
  return request(
    withQuery(`/posts/${encodeURIComponent(identifier)}`, {
      includeArchived: includeArchived || undefined,
      includeDrafts: includeDrafts || undefined,
    }),
  );
}

export function createPost(post) {
  return request("/posts", { method: "POST", body: JSON.stringify(post) });
}

export function updatePost(id, post) {
  return request(`/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(post),
  });
}

export function archivePost(id, version) {
  return request(`/posts/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function restorePost(id, version) {
  return request(`/posts/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function purgePost(id, confirmTitle) {
  return request(`/posts/${encodeURIComponent(id)}/purge`, {
    method: "POST",
    body: JSON.stringify({ confirmTitle }),
  });
}

export function fetchPostRevisions(id, options = {}) {
  return request(withQuery(`/posts/${encodeURIComponent(id)}/revisions`, options));
}

export function restorePostRevision(id, version) {
  return request(`/posts/${encodeURIComponent(id)}/revisions/${encodeURIComponent(version)}/restore`, {
    method: "POST",
  });
}

export function createSubscription({ email, topic = "全部" }) {
  return request("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ email, topic }),
  });
}

export function unsubscribe(id, token) {
  return request(`/subscriptions/${encodeURIComponent(id)}/unsubscribe`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function fetchAdminDashboard() {
  return request("/admin/dashboard");
}

export function fetchAdminSettings() {
  return request("/admin/settings");
}

export function updateAdminSettings(settings) {
  return request("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function fetchAuditEvents(options = {}) {
  return request(withQuery("/admin/audit", options));
}

export function fetchSubscriptions(options = {}) {
  return request(withQuery("/admin/subscriptions", options));
}

export function fetchContentExport() {
  return request("/admin/export");
}
