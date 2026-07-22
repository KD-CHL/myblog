export const SUBSCRIPTION_STORAGE_KEY = "knowledge-log-subscription";
export const EDITOR_DRAFT_PREFIX = "knowledge-log-editor-draft";

export function readStoredJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function consumeSessionMessage(key) {
  const message = window.sessionStorage.getItem(key) || "";
  window.sessionStorage.removeItem(key);
  return message;
}

export function splitTags(value) {
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function estimateReadTime(body) {
  const plainText = String(body || "").replace(/[`#>*_-]/g, " ");
  const chineseCharacters = plainText.match(/[\u3400-\u9fff]/g)?.length || 0;
  const latinWords = plainText.match(/[A-Za-z0-9]+/g)?.length || 0;
  const minutes = Math.max(1, Math.ceil(chineseCharacters / 350 + latinWords / 220));
  return `${minutes} min`;
}

export function formatDateTime(value, options = {}) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    dateStyle: options.dateOnly ? "medium" : "short",
    ...(options.dateOnly ? {} : { timeStyle: "short" }),
  });
}

export function actionLabel(action) {
  const labels = {
    "auth.login": "登录后台",
    "auth.login_failed": "登录失败",
    "auth.logout": "退出登录",
    "post.archived": "归档文章",
    "post.created": "创建草稿",
    "post.published": "发布文章",
    "post.purged": "永久删除文章",
    "post.restored": "恢复文章",
    "post.revision_restored": "恢复历史版本",
    "post.unpublished": "下架文章",
    "post.updated": "更新文章",
    "site.settings_updated": "更新站点设置",
    "content.exported": "导出内容备份",
    "subscription.created": "新增订阅",
    "subscription.unsubscribed": "取消订阅",
    "comment.created": "新增评论",
    "comment.hidden": "隐藏评论",
    "comment.approved": "恢复评论",
    "comment.deleted": "删除评论",
  };
  return labels[action] || action;
}
