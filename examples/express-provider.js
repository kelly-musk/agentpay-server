import express from "express";
import { NETWORK_IDS, registerAgentPayRoutes } from "../index.js";

const app = express();

registerAgentPayRoutes(app, {
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
      filename: "./agentpay-intents.db",
    },
    usage: {
      type: "sqlite",
      filename: "./agentpay-usage.db",
    },
  },
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Example AgentPay provider running on http://localhost:${process.env.PORT || 3000}`);
});
