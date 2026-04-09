import express from "express";
import { NETWORK_IDS, registerAgentPayRoutes } from "../index.js";

const app = express();

registerAgentPayRoutes(app, {
  config: {
    port: Number.parseInt(process.env.PORT || "3000", 10),
    gatewayUrl: process.env.GATEWAY_URL || "http://localhost:3000",
    rustServiceUrl: "",
    facilitatorUrl:
      process.env.FACILITATOR_URL || "https://facilitator.stellar-x402.org",
    network: process.env.X402_NETWORK || NETWORK_IDS.STELLAR_TESTNET,
    walletAddress: process.env.WALLET_ADDRESS,
    asset: {
      address: process.env.X402_ASSET || "native",
      symbol: process.env.X402_ASSET === "native" ? "XLM" : "USDC",
      decimals: Number.parseInt(process.env.X402_ASSET_DECIMALS || "7", 10),
      displayName:
        process.env.X402_ASSET === "native"
          ? "Stellar Lumens"
          : (process.env.X402_ASSET_NAME || "Stellar Token"),
    },
  },
  routes: [
    {
      id: "scrape",
      method: "POST",
      path: "/scrape",
      description: "Paid web scraping and extraction API",
      priceUsd: "0.06",
      category: "web-scraping",
      billingUnit: "request",
      audience: ["agents", "developers"],
      tags: ["scraping", "extraction", "web", "automation"],
      useCases: ["lead generation", "competitive research", "web monitoring"],
      examples: [
        {
          url: "https://example.com",
          format: "markdown",
        },
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          url: { type: "string" },
          format: { type: "string", enum: ["text", "markdown", "json"] },
        },
        required: ["query"],
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          endpoint: { type: "string" },
          payment: { type: "object" },
          result: {
            type: "object",
            properties: {
              url: { type: "string" },
              format: { type: "string" },
              content: { type: "string" },
              extractedLinks: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["url", "format", "content", "extractedLinks"],
          },
        },
        required: ["success", "endpoint", "payment", "result"],
        additionalProperties: true,
      },
      pricing: ({ req, query }) => {
        if (req.body?.format === "json") {
          return "0.08";
        }

        return query.length > 50 ? "0.07" : "0.06";
      },
      handler: async (config, query, context = {}) => {
        const url = String(context.req?.body?.url || "https://example.com");
        const format = String(context.req?.body?.format || "markdown");

        return {
          url,
          format,
          content: `Example ${format} extraction for query "${query}" from ${url}.`,
          extractedLinks: [
            `${url}/about`,
            `${url}/pricing`,
          ],
          source: "paid-scraper-template",
          network: config.network,
        };
      },
    },
  ],
  storage: {
    intents: {
      type: "sqlite",
      filename: "./agentpay-intents.db",
    },
    usage: {
      type: "sqlite",
      filename: "./agentpay-usage.db",
    },
  },
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Paid scraper AgentPay provider running on http://localhost:${process.env.PORT || 3000}`);
});
