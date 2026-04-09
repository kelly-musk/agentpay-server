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
      id: "market_data",
      method: "POST",
      path: "/market-data",
      description: "Paid market and news snapshot API for trading agents",
      priceUsd: "0.08",
      category: "financial-data",
      billingUnit: "query",
      audience: ["agents", "developers", "analysts"],
      tags: ["market-data", "news", "trading", "finance"],
      useCases: ["signal generation", "portfolio monitoring", "agent research"],
      examples: [
        {
          symbol: "BTC",
          includeNews: true,
        },
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          symbol: { type: "string" },
          includeNews: { type: "boolean" },
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
              symbol: { type: "string" },
              price: { type: "number" },
              change24h: { type: "number" },
              headlines: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["symbol", "price", "change24h", "headlines"],
          },
        },
        required: ["success", "endpoint", "payment", "result"],
        additionalProperties: true,
      },
      pricing: ({ req, query }) => {
        if (req.body?.includeNews) {
          return "0.10";
        }

        return query.length > 40 ? "0.09" : "0.08";
      },
      handler: async (config, query, context = {}) => {
        const symbol = String(context.req?.body?.symbol || "BTC").toUpperCase();
        const includeNews = Boolean(context.req?.body?.includeNews);

        return {
          symbol,
          price: 102345.67,
          change24h: 2.14,
          headlines: includeNews
            ? [
              `${symbol} market sentiment remains positive`,
              `${symbol} derivatives volume rose during the last hour`,
            ]
            : [],
          query,
          source: "paid-market-data-template",
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
  console.log(`Paid market data Stellar Oxide Gateway provider running on http://localhost:${process.env.PORT || 3000}`);
});
