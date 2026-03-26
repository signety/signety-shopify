/**
 * Settings page — API key, SKU mapping, sync toggle.
 * Uses Shopify Polaris components for native look.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  Banner,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { useState } from "react";
import db from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const config = await db.shopConfig.findUnique({ where: { shop } }).catch(() => null);

  return json({
    shop,
    hasKey: !!config?.signetyApiKey,
    apiUrl: config?.signetyApiUrl || "https://api.signety.co/api/v1/sdk",
    syncEnabled: config?.syncEnabled ?? true,
  });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const shop = formData.get("shop");
  const apiKey = formData.get("apiKey");
  const apiUrl = formData.get("apiUrl") || "https://api.signety.co/api/v1/sdk";
  const syncEnabled = formData.get("syncEnabled") === "true";

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 400 });
  }

  const data = {
    signetyApiUrl: apiUrl,
    syncEnabled,
  };

  // Only update API key if a new one is provided
  if (apiKey && apiKey.startsWith("sk_live_")) {
    data.signetyApiKey = apiKey;
  }

  await db.shopConfig.upsert({
    where: { shop },
    update: data,
    create: { shop, signetyApiKey: apiKey || "", ...data },
  });

  return json({ success: true });
};

export default function Settings() {
  const { shop, hasKey, apiUrl, syncEnabled } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [apiKey, setApiKey] = useState("");
  const [url, setUrl] = useState(apiUrl);
  const [sync, setSync] = useState(syncEnabled);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("shop", shop);
    formData.append("apiKey", apiKey);
    formData.append("apiUrl", url);
    formData.append("syncEnabled", String(sync));
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Signety Settings" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.AnnotatedSection
          title="API Connection"
          description="Connect to your Signety enterprise account. Get your API key from the Signety dashboard."
        >
          <Card>
            <FormLayout>
              {hasKey && (
                <Banner tone="success">
                  <p>API key configured. Enter a new key below to replace it.</p>
                </Banner>
              )}
              <TextField
                label="API Key"
                value={apiKey}
                onChange={setApiKey}
                placeholder="sk_live_..."
                autoComplete="off"
                helpText="Your Signety API key. Generated at: Enterprise Dashboard > API Keys."
              />
              <TextField
                label="API URL"
                value={url}
                onChange={setUrl}
                helpText="Default: https://api.signety.co/api/v1/sdk"
              />
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Order Sync"
          description="Control how orders are synced to Signety."
        >
          <Card>
            <FormLayout>
              <Checkbox
                label="Enable automatic order sync"
                checked={sync}
                onChange={setSync}
                helpText="When enabled, orders sync to Signety automatically on payment. Uncheck to pause."
              />
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.Section>
          <BlockStack inlineAlign="end">
            <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              Save Settings
            </Button>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
