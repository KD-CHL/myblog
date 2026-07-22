import { getConfig } from "../../config.js";
import { commentRateLimiter } from "../../core/rate-limit.js";
import { recordAuditEvent } from "../audit/repository.js";
import {
  createComment,
  deleteComment,
  listAdminComments,
  listPostComments,
  setCommentStatus,
} from "./repository.js";

export function registerCommentRoutes(router) {
  router.add("GET", "/api/posts/:id/comments", async (context) => {
    if (!getConfig().database.configured) {
      return {
        body: {
          comments: [],
          commentsEnabled: false,
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        },
      };
    }
    const result = await listPostComments(context.params.id, {
      page: context.url.searchParams.get("page"),
      pageSize: context.url.searchParams.get("pageSize"),
    });
    return { body: { ...result, commentsEnabled: true } };
  });

  router.add(
    "POST",
    "/api/posts/:id/comments",
    async (context) => {
      commentRateLimiter.consume(context.ip);
      const { comment, postTitle } = await createComment(context.params.id, context.body);
      await recordAuditEvent({
        action: "comment.created",
        entityId: comment.id,
        entityType: "comment",
        metadata: { authorName: comment.authorName, postTitle },
        requestId: context.requestId,
      });
      return { body: { comment }, statusCode: 201 };
    },
    { body: true },
  );

  router.add(
    "GET",
    "/api/admin/comments",
    async (context) => {
      const result = await listAdminComments({
        page: context.url.searchParams.get("page"),
        pageSize: context.url.searchParams.get("pageSize"),
        status: context.url.searchParams.get("status") || "all",
      });
      return { body: result };
    },
    { auth: true },
  );

  router.add(
    "POST",
    "/api/admin/comments/:id/hide",
    async (context) => {
      await setCommentStatus(context.params.id, "hidden");
      await recordAuditEvent({
        action: "comment.hidden",
        actor: context.user?.username,
        entityId: context.params.id,
        entityType: "comment",
        requestId: context.requestId,
      });
      return { body: { ok: true } };
    },
    { auth: true, write: true },
  );

  router.add(
    "POST",
    "/api/admin/comments/:id/approve",
    async (context) => {
      await setCommentStatus(context.params.id, "approved");
      await recordAuditEvent({
        action: "comment.approved",
        actor: context.user?.username,
        entityId: context.params.id,
        entityType: "comment",
        requestId: context.requestId,
      });
      return { body: { ok: true } };
    },
    { auth: true, write: true },
  );

  router.add(
    "DELETE",
    "/api/admin/comments/:id",
    async (context) => {
      await deleteComment(context.params.id);
      await recordAuditEvent({
        action: "comment.deleted",
        actor: context.user?.username,
        entityId: context.params.id,
        entityType: "comment",
        requestId: context.requestId,
      });
      return { body: { ok: true } };
    },
    { auth: true, write: true },
  );
}
