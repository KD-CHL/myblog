import { validationError } from "../../core/errors.js";
import { getConfig } from "../../config.js";
import { recordAuditEvent } from "../audit/repository.js";
import { getFallbackPost, listFallbackPosts } from "../public/fallback.js";
import {
  archivePost,
  createPost,
  getPost,
  listPostRevisions,
  listPosts,
  purgePost,
  restorePost,
  restorePostRevision,
  summarizePosts,
  updatePost,
} from "./repository.js";

function booleanParam(value) {
  return value === "true" || value === "1";
}

async function auditPost(context, action, post, metadata = {}) {
  await recordAuditEvent({
    action,
    actor: context.user?.username,
    entityId: post?.id || context.params.id,
    entityType: "post",
    metadata,
    requestId: context.requestId,
  });
}

export function registerPostRoutes(router) {
  router.add("GET", "/api/posts", async (context) => {
    const requestedStatus = context.url.searchParams.get("status") || "";
    const includeDrafts = booleanParam(context.url.searchParams.get("includeDrafts")) || Boolean(requestedStatus);
    if (includeDrafts) await context.requireAdmin();

    const options = {
      filter: context.url.searchParams.get("filter") || "全部",
      includeDrafts,
      nav: context.url.searchParams.get("nav") || "总览",
      page: context.url.searchParams.get("page") || 1,
      pageSize: context.url.searchParams.get("pageSize") || 12,
      query: context.url.searchParams.get("query") || "",
      sort: context.url.searchParams.get("sort") || "latest",
      status: requestedStatus,
    };
    const result = getConfig().database.configured
      ? await listPosts(options)
      : listFallbackPosts(options);

    return {
      body: {
        pagination: result.pagination,
        posts: summarizePosts(result.posts),
        total: result.pagination.total,
      },
    };
  });

  router.add("POST", "/api/posts", async (context) => {
    const post = await createPost(context.body, { actor: context.user.username });
    await auditPost(context, post.status === "published" ? "post.published" : "post.created", post);
    return { body: { post }, statusCode: 201 };
  }, { auth: true, body: true, write: true });

  router.add("POST", "/api/posts/:id/archive", async (context) => {
    const post = await archivePost(context.params.id, {
      actor: context.user.username,
      version: context.body.version,
    });
    await auditPost(context, "post.archived", post);
    return { body: { post } };
  }, { auth: true, body: true, write: true });

  router.add("POST", "/api/posts/:id/restore", async (context) => {
    const post = await restorePost(context.params.id, {
      actor: context.user.username,
      version: context.body.version,
    });
    await auditPost(context, "post.restored", post);
    return { body: { post } };
  }, { auth: true, body: true, write: true });

  router.add("POST", "/api/posts/:id/purge", async (context) => {
    const post = await getPost(context.params.id, { includeArchived: true, includeDrafts: true });
    if (!post || context.body.confirmTitle !== post.title) {
      throw validationError("请输入完整文章标题以确认永久删除。", {
        fields: { confirmTitle: "确认标题不匹配。" },
      });
    }
    await purgePost(post.id);
    await auditPost(context, "post.purged", post, { title: post.title });
    return { body: { deleted: post.id } };
  }, { auth: true, body: true, write: true });

  router.add("GET", "/api/posts/:id/revisions", async (context) => {
    const result = await listPostRevisions(context.params.id, {
      page: context.url.searchParams.get("page") || 1,
      pageSize: context.url.searchParams.get("pageSize") || 20,
    });
    return { body: result };
  }, { auth: true });

  router.add("POST", "/api/posts/:id/revisions/:version/restore", async (context) => {
    const post = await restorePostRevision(context.params.id, context.params.version, {
      actor: context.user.username,
    });
    await auditPost(context, "post.revision_restored", post, {
      restoredVersion: Number(context.params.version),
    });
    return { body: { post } };
  }, { auth: true, write: true });

  router.add("GET", "/api/posts/:identifier", async (context) => {
    const includeDrafts = booleanParam(context.url.searchParams.get("includeDrafts"));
    const includeArchived = booleanParam(context.url.searchParams.get("includeArchived"));
    if (includeDrafts || includeArchived) await context.requireAdmin();
    const post = getConfig().database.configured
      ? await getPost(context.params.identifier, { includeArchived, includeDrafts })
      : getFallbackPost(context.params.identifier);
    if (!post) {
      const error = new Error("文章不存在。");
      error.statusCode = 404;
      error.code = "POST_NOT_FOUND";
      throw error;
    }
    return { body: { post } };
  });

  router.add("PUT", "/api/posts/:id", async (context) => {
    const before = await getPost(context.params.id, { includeArchived: true, includeDrafts: true });
    const post = await updatePost(context.params.id, context.body, { actor: context.user.username });
    const action =
      before?.publicationStatus !== post.publicationStatus
        ? post.publicationStatus === "published"
          ? "post.published"
          : "post.unpublished"
        : "post.updated";
    await auditPost(context, action, post, { version: post.version });
    return { body: { post } };
  }, { auth: true, body: true, write: true });

  router.add("DELETE", "/api/posts/:id", async (context) => {
    const post = await archivePost(context.params.id, { actor: context.user.username });
    await auditPost(context, "post.archived", post);
    return { body: { archived: post.id, post } };
  }, { auth: true, write: true });
}
