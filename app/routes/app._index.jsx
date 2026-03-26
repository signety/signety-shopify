/**
 * Main app page — Signety Supply Chain dashboard in Shopify admin.
 * Shows connection status, queue stats, and links to settings.
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Banner,
  Button,
} from "@shopify/polaris";
import db from "../db.server";

export const loader = async ({ request }) => {
  // Get queue stats
  const pending = await db.eventQueue.count({ where: { status: "pending" } });
  const processed = await db.eventQueue.count({ where: { status: "processed" } });
  const failed = await db.eventQueue.count({ where: { status: "failed" } });

  // Check if configured
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const config = await db.shopConfig.findUnique({ where: { shop } }).catch(() => null);
  const isConfigured = !!config?.signetyApiKey;

  return json({
    isConfigured,
    queue: { pending, processed, failed },
    syncEnabled: config?.syncEnabled ?? true,
  });
};

export default function Index() {
  const { isConfigured, queue, syncEnabled } = useLoaderData();

  return (
    <Page title="Signety Supply Chain">
      <Layout>
        {!isConfigured && (
          <Layout.Section>
            <Banner
              title="Setup required"
              action={{ content: "Configure", url: "/app/settings" }}
              tone="warning"
            >
              <p>Enter your Signety API key to start syncing orders.</p>
            </Banner>
          </Layout.Section>
        )}

        {!syncEnabled && (
          <Layout.Section>
            <Banner title="Sync paused" tone="info">
              <p>Order sync is paused. Orders will queue locally until re-enabled.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Connection Status</Text>
              <InlineStack gap="200" align="start">
                {isConfigured ? (
                  <Badge tone="success">Connected</Badge>
                ) : (
                  <Badge tone="critical">Not configured</Badge>
                )}
                {syncEnabled ? (
                  <Badge tone="info">Sync active</Badge>
                ) : (
                  <Badge tone="attention">Sync paused</Badge>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Queue Status</Text>
              <Text>Pending: {queue.pending}</Text>
              <Text>Processed: {queue.processed}</Text>
              {queue.failed > 0 && (
                <Text tone="critical">Failed: {queue.failed}</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Quick Actions</Text>
              <Button url="/app/settings">Settings</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
