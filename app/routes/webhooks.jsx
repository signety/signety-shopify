/**
 * Shopify webhook handler — receives order and fulfillment events.
 *
 * CRIT-6 FIX: Returns 500 on queue DB failure (NOT 200).
 * Shopify retries non-2xx responses for 48 hours.
 * Only returns 200 when event is successfully queued.
 *
 * This endpoint NEVER affects the merchant's store — webhook responses
 * don't impact storefront, checkout, or order processing.
 */
import { json } from "@remix-run/node";
import db from "../db.server";

export const action = async ({ request }) => {
  const topic = request.headers.get("x-shopify-topic");
  const shop = request.headers.get("x-shopify-shop-domain");

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Map Shopify webhook topic to our event type
  const eventTypeMap = {
    "orders/paid": "order_sync",
    "orders/cancelled": "order_cancel",
    "fulfillments/create": "fulfillment_ship",
    "fulfillments/update": "fulfillment_update",
    // Compliance webhooks — acknowledge immediately
    "customers/data_request": null,
    "customers/redact": null,
    "shop/redact": null,
  };

  const eventType = eventTypeMap[topic];

  // Compliance webhooks — just acknowledge
  if (eventType === null) {
    return json({ status: "acknowledged" }, { status: 200 });
  }

  if (!eventType) {
    console.warn(`Unknown webhook topic: ${topic}`);
    return json({ status: "ignored" }, { status: 200 });
  }

  // CRIT-6: Queue the event — return 500 if queue write fails
  // so Shopify retries. Only return 200 on successful queue write.
  try {
    await db.eventQueue.create({
      data: {
        shop: shop || "unknown",
        eventType,
        payload: JSON.stringify(payload),
        status: "pending",
      },
    });

    return json({ status: "queued" }, { status: 200 });

  } catch (err) {
    console.error("Failed to queue webhook event:", err);
    // CRIT-6: Return 500 so Shopify retries (up to 48 hours)
    return json({ status: "queue_failed" }, { status: 500 });
  }
};
