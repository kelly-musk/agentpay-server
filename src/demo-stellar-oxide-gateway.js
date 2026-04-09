/**
 * STELLAR OXIDE GATEWAY SOLUTION (AFTER)
 * 
 * This demonstrates how Stellar Oxide Gateway solves the problems:
 * ✅ No API keys needed
 * ✅ Pay-per-use with blockchain payments
 * ✅ Agents can self-onboard
 * ✅ Instant settlement
 * ✅ No subscription friction
 */

import express from "express";
import { registerStellarOxideGatewayRoutes, NETWORK_IDS } from "../index.js";

const app = express();
app.use(express.json());

// ✅ SOLUTION: Use Stellar Oxide Gateway
// No API key management, no subscriptions, no manual onboarding
registerStellarOxideGatewayRoutes(app, {
  config: {
    port: 3000,
    gatewayUrl: process.env.GATEWAY_URL || "http://localhost:3000",
    rustServiceUrl: "",
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.stellar-x402.org",
    network: process.env.X402_NETWORK || NETWORK_IDS.STELLAR_TESTNET,
    walletAddress: process.env.WALLET_ADDRESS || "GD3PXXADIXMWGINT2LK3Q45SLI3HRCRA2I7NDOTXXTGNXO7GDYKI4SK7",
    asset: {
      address: process.env.X402_ASSET || "native",
      symbol: process.env.X402_ASSET === "native" ? "XLM" : "USDC",
      decimals: parseInt(process.env.X402_ASSET_DECIMALS || "7", 10),
      displayName: process.env.X402_ASSET === "native" ? "Stellar Lumens" : "USD Coin",
    },
    provider: {
      id: "demo_provider",
      name: "Demo Provider",
      description: "Demonstration of Stellar Oxide Gateway solving API monetization problems",
      websiteUrl: "https://stellar-oxide-gateway.com",
      supportUrl: "https://stellar-oxide-gateway.com/support",
      supportEmail: "support@stellar-oxide-gateway.com",
    },
    service: {
      id: "demo_service",
      name: "Demo Paid API Service",
      description: "Pay-per-use APIs without API keys or subscriptions",
      version: "1.0.0",
      category: "paid-agent-api",
      tags: ["demo", "search", "ai", "market-data"],
      audience: ["agents", "developers"],
      documentationUrl: "https://stellar-oxide-gateway.com/docs",
    },
  },
  
  // ✅ SOLUTION: Declarative paid routes
  // Each route is automatically protected with x402 payment verification
  routes: [
    {
      id: "search",
      method: "GET",
      path: "/api/search",
      description: "Pay-per-query search API",
      priceUsd: "0.02",
      category: "search-api",
      billingUnit: "query",
      audience: ["agents", "developers"],
      tags: ["search", "retrieval"],
      useCases: ["research agents", "web grounding"],
      
      // ✅ Dynamic pricing based on query complexity
      pricing: ({ query }) => {
        const length = query?.length || 0;
        if (length > 100) return "0.05";
        if (length > 50) return "0.03";
        return "0.02";
      },
      
      handler: async (config, query) => ({
        success: true,
        query,
        results: [
          { title: "Result 1", url: "https://example.com/1" },
          { title: "Result 2", url: "https://example.com/2" },
          { title: "Result 3", url: "https://example.com/3" }
        ],
        note: "✅ Paid with Stellar blockchain - no API key needed!"
      }),
    },
    
    {
      id: "inference",
      method: "GET",
      path: "/api/inference",
      description: "Pay-per-token AI inference",
      priceUsd: "0.10",
      category: "ai-inference",
      billingUnit: "1000 tokens",
      audience: ["agents", "developers"],
      tags: ["ai", "inference", "llm"],
      useCases: ["AI agents", "chatbots", "content generation"],
      
      // ✅ Dynamic pricing based on prompt length
      pricing: ({ query }) => {
        const promptLength = query?.length || 0;
        const estimatedTokens = Math.ceil(promptLength / 4);
        const price = Math.max(0.10, (estimatedTokens / 1000) * 0.10);
        return price.toFixed(2);
      },
      
      handler: async (config, query) => ({
        success: true,
        prompt: query,
        response: `AI response to: ${query}`,
        tokens_used: Math.ceil((query?.length || 0) / 4),
        note: "✅ Pay only for tokens used - no subscription needed!"
      }),
    },
    
    {
      id: "market-data",
      method: "GET",
      path: "/api/market-data",
      description: "Real-time market data",
      priceUsd: "0.05",
      category: "market-data",
      billingUnit: "query",
      audience: ["agents", "traders", "developers"],
      tags: ["market", "crypto", "finance"],
      useCases: ["trading bots", "portfolio trackers", "market analysis"],
      
      handler: async (config, query) => {
        const symbol = query || "BTC";
        return {
          success: true,
          symbol,
          price: 45000 + Math.random() * 1000,
          volume: 1234567890,
          change_24h: (Math.random() * 10 - 5).toFixed(2) + "%",
          timestamp: new Date().toISOString(),
          note: "✅ Instant payment, instant access - no account needed!"
        };
      },
    },
    
    {
      id: "scrape",
      method: "POST",
      path: "/api/scrape",
      description: "Web scraping as a service",
      priceUsd: "0.03",
      category: "data-extraction",
      billingUnit: "page",
      audience: ["agents", "developers"],
      tags: ["scraping", "data", "extraction"],
      useCases: ["data collection", "web monitoring", "research"],
      
      handler: async (config, query) => ({
        success: true,
        url: query,
        content: `Scraped content from ${query}`,
        word_count: 1234,
        extracted_at: new Date().toISOString(),
        note: "✅ Pay per page scraped - perfect for one-time jobs!"
      }),
    },
  ],
  
  // ✅ SOLUTION: Durable storage for production
  storage: {
    intents: {
      type: "sqlite",
      filename: "./demo-intents.db",
    },
    usage: {
      type: "sqlite",
      filename: "./demo-usage.db",
    },
  },
});

// Info endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Stellar Oxide Gateway Demo",
    description: "Pay-per-use APIs without API keys or subscriptions",
    solutions: [
      "✅ No API keys - pay with blockchain",
      "✅ Pay-per-use - no subscriptions",
      "✅ Agents can self-onboard",
      "✅ Instant settlement on Stellar",
      "✅ Dynamic pricing based on usage",
      "✅ No rate limits - pay for what you need",
      "✅ Structured blockchain receipts"
    ],
    endpoints: [
      {
        path: "/api/search",
        method: "GET",
        price: "0.02 USD per query",
        description: "Pay-per-query search"
      },
      {
        path: "/api/inference",
        method: "GET",
        price: "0.10 USD per 1000 tokens",
        description: "Pay-per-token AI inference"
      },
      {
        path: "/api/market-data",
        method: "GET",
        price: "0.05 USD per query",
        description: "Real-time market data"
      },
      {
        path: "/api/scrape",
        method: "POST",
        price: "0.03 USD per page",
        description: "Web scraping service"
      }
    ],
    how_to_use: {
      step_1: "Set up CLI wallet: yarn cli setup",
      step_2: "Make a paid request: yarn cli ai --query 'test'",
      step_3: "Or use the payFetch client in your code"
    },
    discovery: {
      capabilities: "http://localhost:3000/capabilities",
      manifest: "http://localhost:3000/.well-known/stellar-oxide-gateway.json",
      registry: "http://localhost:3000/registry/export",
      stats: "http://localhost:3000/stats"
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Stellar Oxide Gateway Demo running on http://localhost:${PORT}`);
  console.log(`\nSolutions provided:`);
  console.log(`  ✅ No API keys - pay with Stellar blockchain`);
  console.log(`  ✅ Pay-per-use - no subscriptions needed`);
  console.log(`  ✅ Agents can self-onboard automatically`);
  console.log(`  ✅ Instant settlement with structured receipts`);
  console.log(`  ✅ Dynamic pricing based on actual usage`);
  console.log(`  ✅ No rate limits - pay for what you need\n`);
  
  console.log(`Try it:`);
  console.log(`  1. Set up wallet: yarn cli setup`);
  console.log(`  2. Make paid request: yarn cli ai --query "test"`);
  console.log(`  3. Check stats: curl http://localhost:${PORT}/stats\n`);
  
  console.log(`Discovery endpoints:`);
  console.log(`  Info: http://localhost:${PORT}/`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Capabilities: http://localhost:${PORT}/capabilities`);
  console.log(`  Manifest: http://localhost:${PORT}/.well-known/stellar-oxide-gateway.json`);
  console.log(`  Stats: http://localhost:${PORT}/stats\n`);
});
