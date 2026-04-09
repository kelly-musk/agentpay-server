import express from "express";
import { NETWORK_IDS, registerStellarOxideGatewayRoutes } from "../index.js";

const app = express();

registerStellarOxideGatewayRoutes(app, {
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
    provider: {
      id: "search_provider",
      name: "Search Provider",
      description: "Provider of paid search APIs for agent workflows",
      websiteUrl: "https://example.com/search",
      supportUrl: "https://example.com/search/support",
      supportEmail: "search-support@example.com",
    },
    service: {
      id: "search_service",
      name: "Paid Search Service",
      description: "Pay-per-query search API for agents and developers",
      version: "1.0.0",
      category: "search-api",
      tags: ["search", "retrieval", "web"],
      audience: ["agents", "developers"],
      documentationUrl: "https://example.com/search/docs",
    },
  },
  routes: [
    {
      id: "search",
      method: "POST",
      path: "/search",
      description: "Paid search API for agent workflows",
      priceUsd: "0.05",
      category: "search-api",
      billingUnit: "query",
      audience: ["agents", "developers"],
      tags: ["search", "retrieval", "web"],
      useCases: ["research agents", "web grounding", "workflow enrichment"],
      examples: [
        {
          query: "latest x402 Stellar news",
        },
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          topK: { type: "integer", minimum: 1, maximum: 20 },
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
              query: { type: "string" },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    snippet: { type: "string" },
                  },
                  required: ["title", "url", "snippet"],
                },
              },
            },
            required: ["query", "sources"],
          },
        },
        required: ["success", "endpoint", "payment", "result"],
        additionalProperties: true,
      },
      pricing: ({ query }) => {
        if (query.length > 120) {
          return "0.09";
        }

        if (query.length > 40) {
          return "0.07";
        }

        return "0.05";
      },
      handler: async (config, query, context = {}) => {
        const topK = Number.parseInt(String(context.req?.body?.topK || 3), 10);

        return {
          query,
          sources: Array.from({ length: Math.max(1, Math.min(topK, 5)) }, (_, index) => ({
            title: `Search result ${index + 1} for "${query}"`,
            url: `https://example.com/search/${index + 1}?q=${encodeURIComponent(query)}`,
            snippet: `This is example search result ${index + 1} served by Stellar Oxide Gateway.`,
          })),
          source: "paid-search-template",
          network: config.network,
        };
      },
    },
  ],
  storage: {
    intents: {
      type: "sqlite",
      filename: "./stellar-oxide-gateway-intents.db",
    },
    usage: {
      type: "sqlite",
      filename: "./stellar-oxide-gateway-usage.db",
    },
  },
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Paid search Stellar Oxide Gateway provider running on http://localhost:${process.env.PORT || 3000}`);
});
