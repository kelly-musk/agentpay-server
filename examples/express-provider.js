import express from "express";
import { NETWORK_IDS, registerStellarOxideGatewayRoutes } from "../index.js";

const app = express();

registerStellarOxideGatewayRoutes(app, {
  config: {
    port: Number.parseInt(process.env.PORT || "3000", 10),
    gatewayUrl: process.env.GATEWAY_URL || "http://localhost:3000",
    rustServiceUrl: process.env.RUST_SERVICE_URL || "",
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
      id: "example_provider",
      name: "Example Provider",
      description: "Example Stellar Oxide Gateway provider for paid API integrations",
      websiteUrl: "https://example.com",
      supportUrl: "https://example.com/support",
      supportEmail: "support@example.com",
    },
    service: {
      id: "example_service",
      name: "Example Paid API Service",
      description: "Example paid APIs exposed through Stellar Oxide Gateway",
      version: "1.0.0",
      category: "paid-agent-api",
      tags: ["example", "api", "stellar-oxide-gateway"],
      audience: ["agents", "developers"],
      documentationUrl: "https://example.com/docs",
    },
  },
  routes: [
    {
      method: "POST",
      path: "/summarize",
      description: "Summarize text content",
      priceUsd: "0.05",
      handler: async (config, query) => ({
        summary: `Summarized: ${query}`,
        source: "example-provider",
      }),
    },
    {
      method: "POST",
      path: "/classify",
      description: "Classify text content",
      priceUsd: "0.03",
      handler: async (config, query) => ({
        label: query.length > 20 ? "long-form" : "short-form",
        source: "example-provider",
      }),
    },
    {
      method: "POST",
      path: "/proxy-summarize",
      description: "Proxy paid summarize requests to an upstream API",
      priceUsd: "0.04",
      upstream: {
        url: process.env.UPSTREAM_SUMMARIZE_URL || "https://api.example.com/summarize",
        headers: process.env.UPSTREAM_API_KEY
          ? {
            Authorization: `Bearer ${process.env.UPSTREAM_API_KEY}`,
          }
          : {},
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
  console.log(`Example Stellar Oxide Gateway provider running on http://localhost:${process.env.PORT || 3000}`);
});
