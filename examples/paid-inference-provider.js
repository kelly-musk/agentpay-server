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
  },
  routes: [
    {
      id: "inference",
      method: "POST",
      path: "/inference",
      description: "Paid AI inference API for agent applications",
      priceUsd: "0.12",
      category: "ai-inference",
      billingUnit: "request",
      audience: ["agents", "developers"],
      tags: ["ai", "inference", "llm", "generation"],
      useCases: ["summarization", "classification", "content generation"],
      examples: [
        {
          prompt: "Summarize the latest x402 ecosystem updates.",
          maxTokens: 250,
        },
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          prompt: { type: "string" },
          maxTokens: { type: "integer", minimum: 1, maximum: 2048 },
          task: { type: "string" },
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
              task: { type: "string" },
              completion: { type: "string" },
              tokenEstimate: { type: "integer" },
            },
            required: ["task", "completion", "tokenEstimate"],
          },
        },
        required: ["success", "endpoint", "payment", "result"],
        additionalProperties: true,
      },
      pricing: ({ req, query }) => {
        const maxTokens = Number.parseInt(String(req.body?.maxTokens || 256), 10);

        if (maxTokens > 1000) {
          return "0.18";
        }

        return query.length > 120 ? "0.15" : "0.12";
      },
      handler: async (config, query, context = {}) => {
        const prompt = String(context.req?.body?.prompt || query);
        const task = String(context.req?.body?.task || "general");
        const maxTokens = Number.parseInt(String(context.req?.body?.maxTokens || 256), 10);

        return {
          task,
          completion: `Example inference output for "${prompt}" with a ${task} task.`,
          tokenEstimate: Math.min(maxTokens, Math.max(64, prompt.length * 2)),
          source: "paid-inference-template",
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
  console.log(`Paid inference Stellar Oxide Gateway provider running on http://localhost:${process.env.PORT || 3000}`);
});
