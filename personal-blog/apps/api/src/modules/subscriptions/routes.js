import { subscriptionRateLimiter } from "../../core/rate-limit.js";
import { recordAuditEvent } from "../audit/repository.js";
import { subscribe, unsubscribe } from "./repository.js";

function emailDomain(email) {
  return String(email || "").split("@")[1] || "";
}

export function registerSubscriptionRoutes(router) {
  router.add("POST", "/api/subscriptions", async (context) => {
    subscriptionRateLimiter.consume(context.ip);
    const result = await subscribe(context.body);
    await recordAuditEvent({
      action: "subscription.created",
      entityId: result.subscription.id,
      entityType: "subscription",
      metadata: {
        emailDomain: emailDomain(result.subscription.email),
        topic: result.subscription.topic,
      },
      requestId: context.requestId,
    });
    return { body: result, statusCode: 201 };
  }, { body: true });

  router.add("POST", "/api/subscriptions/:id/unsubscribe", async (context) => {
    subscriptionRateLimiter.consume(context.ip);
    await unsubscribe(context.params.id, context.body.token);
    await recordAuditEvent({
      action: "subscription.unsubscribed",
      entityId: context.params.id,
      entityType: "subscription",
      requestId: context.requestId,
    });
    return { body: { unsubscribed: context.params.id } };
  }, { body: true });

  router.add("DELETE", "/api/subscriptions/:id", async (context) => {
    subscriptionRateLimiter.consume(context.ip);
    await unsubscribe(context.params.id, context.url.searchParams.get("token") || "");
    return { body: { unsubscribed: context.params.id } };
  });
}
