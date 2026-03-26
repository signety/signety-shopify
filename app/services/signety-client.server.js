/**
 * Signety API client for the Shopify app (server-side only).
 *
 * All calls are non-blocking. If Signety API is down, events are queued
 * in the local Prisma database for retry.
 */

const DEFAULT_BASE_URL = "https://api.signety.co/api/v1/sdk";
const TIMEOUT_MS = 15000;

/**
 * Make a request to the Signety SDK API.
 * @param {string} apiKey - Enterprise API key
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. "/orders/sync")
 * @param {object} body - Request body (for POST/PUT)
 * @param {string} baseUrl - API base URL
 * @returns {Promise<{success: boolean, data: any, error: string|null, statusCode: number|null}>}
 */
export async function signetyRequest(apiKey, method, path, body = null, baseUrl = DEFAULT_BASE_URL) {
  try {
    const url = `${baseUrl}${path}`;
    const options = {
      method,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "signety-shopify/1.0.0",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      return { success: true, data: responseData, error: null, statusCode: response.status };
    }

    const error = responseData?.detail || `HTTP ${response.status}`;
    return { success: false, data: responseData, error, statusCode: response.status };

  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { success: false, data: null, error: "Request timed out", statusCode: null };
    }
    return { success: false, data: null, error: err.message, statusCode: null };
  }
}

/**
 * Sync an order to Signety.
 */
export async function syncOrder(apiKey, orderData, baseUrl) {
  return signetyRequest(apiKey, "POST", "/orders/sync", orderData, baseUrl);
}

/**
 * Get an order from Signety.
 */
export async function getOrder(apiKey, externalRef, system = "shopify", baseUrl) {
  return signetyRequest(apiKey, "GET", `/orders/${encodeURIComponent(externalRef)}?external_system=${system}`, null, baseUrl);
}
