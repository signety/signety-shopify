/**
 * Queue processor — drains the EventQueue table and sends events to Signety.
 *
 * Called periodically (e.g., via a cron endpoint or Remix loader on dashboard page).
 * Non-blocking: processes up to 50 items per cycle.
 * Stops on first API failure (Signety might be down).
 */
import db from "../db.server";
import { syncOrder } from "./signety-client.server";

const MAX_PER_CYCLE = 50;
const MAX_ATTEMPTS = 5;

/**
 * Process pending events in the queue.
 * @returns {{ processed: number, failed: number }}
 */
export async function processQueue() {
  const items = await db.eventQueue.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_CYCLE,
  });

  let processed = 0;
  let failed = 0;

  for (const item of items) {
    const config = await db.shopConfig.findUnique({
      where: { shop: item.shop },
    });

    if (!config?.signetyApiKey) {
      // No API key configured — skip but don't fail
      continue;
    }

    if (!config.syncEnabled) {
      // Sync paused — leave in queue
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(item.payload);
    } catch {
      await markFailed(item.id, "Invalid JSON payload");
      failed++;
      continue;
    }

    const result = await processItem(config, item.eventType, payload);

    if (result.success) {
      await db.eventQueue.update({
        where: { id: item.id },
        data: { status: "processed", processedAt: new Date() },
      });
      processed++;
    } else {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await markFailed(item.id, result.error);
        failed++;
      } else {
        await db.eventQueue.update({
          where: { id: item.id },
          data: { attempts, lastError: result.error },
        });
      }

      // Stop on server error (API might be down)
      if (!result.statusCode || result.statusCode >= 500) {
        break;
      }
    }
  }

  return { processed, failed };
}

async function processItem(config, eventType, payload) {
  try {
    switch (eventType) {
      case "order_sync":
        return await syncOrder(config.signetyApiKey, payload, config.signetyApiUrl);

      case "order_cancel":
        // Future: cancel endpoint
        return { success: true, data: null, error: null, statusCode: 200 };

      case "fulfillment_ship":
        // Future: create SHIP events for bound serials
        return { success: true, data: null, error: null, statusCode: 200 };

      case "fulfillment_update":
        // Future: create DELIVER events on successful delivery
        return { success: true, data: null, error: null, statusCode: 200 };

      default:
        return { success: false, data: null, error: `Unknown event: ${eventType}`, statusCode: null };
    }
  } catch (err) {
    return { success: false, data: null, error: err.message, statusCode: null };
  }
}

async function markFailed(id, error) {
  await db.eventQueue.update({
    where: { id },
    data: { status: "failed", lastError: error, processedAt: new Date() },
  });
}
