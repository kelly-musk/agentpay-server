# Paid Agent APIs Implementation Guide

This guide explains how to implement AgentPay as a real **paid agent services /
APIs** product.

It is the practical reference for developers who want to turn an API into a
pay-per-request service for:

- AI agents
- backend services
- SaaS platforms
- developer tools

This document is implementation-focused. It shows:

- what to build
- how to wire it into AgentPay
- how consumers pay
- what metadata to expose
- which example templates to start from

## What "Paid Agent APIs" Means Here

A paid agent API is an API endpoint that:

- exposes a useful machine-consumable capability
- returns a `402 Payment Required` challenge before access
- accepts programmatic payment
- unlocks the response only after verification
- returns structured receipts and agent-friendly output

Examples:

- paid search
- paid market/news data
- paid scraping / extraction
- paid AI inference
- paid compute tasks

## Who This Is For

There are two roles:

### Implementer

The implementer is the provider of the paid API.

Examples:

- a startup exposing search
- a data provider exposing market data
- an AI product exposing inference
- a platform exposing a paid internal tool

### Consumer

The consumer is the caller of the API.

Examples:

- an agent framework
- a backend service
- a platform server
- a frontend with wallet-based payment

## Implementation Modes

Use one of these modes.

### Mode 1: Embed AgentPay in your own Express app

Best for:

- existing APIs
- app teams
- product integrations

Use:

- `registerAgentPayRoutes(...)`

### Mode 2: Run AgentPay as a standalone public gateway

Best for:

- hosted gateway deployments
- reverse-proxy style monetization
- simpler standalone operator flow

## What a Good Paid Agent API Needs

To be useful to agents and developers, a paid route should define:

- path
- method
- description
- price
- category
- billing unit
- audience
- tags
- use cases
- request schema
- response schema
- optional dynamic pricing

Without this metadata, a route is only protected. With this metadata, it
becomes a discoverable agent service.

## Recommended Route Shape

This is the recommended shape for a real paid route:

```js
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
  useCases: ["research agents", "workflow enrichment"],
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      result: { type: "array" },
    },
    required: ["success", "result"],
  },
  pricing: ({ query }) => query.length > 50 ? "0.08" : "0.05",
  handler: async (config, query, context) => {
    return {
      result: [
        { title: `Result for ${query}` },
      ],
    };
  },
}
```

## Step-by-Step: Implement a Paid Agent API

### 1. Create an Express app

```js
import express from "express";

const app = express();
```

### 2. Import AgentPay

```js
import { NETWORK_IDS, registerAgentPayRoutes } from "agentpay-gateway";
```

### 3. Define gateway config

```js
const config = {
  port: 3000,
  gatewayUrl: "http://localhost:3000",
  rustServiceUrl: "",
  facilitatorUrl: "https://facilitator.stellar-x402.org",
  network: NETWORK_IDS.STELLAR_TESTNET,
  walletAddress: process.env.WALLET_ADDRESS,
  asset: {
    address: "native",
    symbol: "XLM",
    decimals: 7,
    displayName: "Stellar Lumens",
  },
};
```

### 4. Define your paid route

```js
const routes = [
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
    useCases: ["research agents", "web grounding"],
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
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
            sources: { type: "array" },
          },
        },
      },
      required: ["success", "endpoint", "payment", "result"],
    },
    handler: async (gatewayConfig, query) => ({
      query,
      sources: [
        {
          title: `Search result for ${query}`,
          url: `https://example.com?q=${encodeURIComponent(query)}`,
          snippet: "Example response from a paid agent API.",
        },
      ],
    }),
  },
];
```

### 5. Register the routes

```js
registerAgentPayRoutes(app, {
  config,
  routes,
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
```

### 6. Start the server

```js
app.listen(3000);
```

## How Consumers Pay

There are two supported payment models.

### A. Service-paid / backend-paid

Best for:

- agents
- server-to-server usage
- platform-sponsored usage

Flow:

1. backend calls endpoint
2. receives `402`
3. backend signs payment with service wallet
4. backend retries with `x-payment`
5. response is returned

Backend/service wallet secrets belong in:

- env vars
- secret manager
- secure backend store

Not in:

- frontend browser code

### B. User-paid / wallet-paid

Best for:

- consumer-facing apps
- direct end-user payment flows
- wallet-native agent products

Flow:

1. frontend calls endpoint
2. receives `402`
3. user wallet signs payment
4. frontend retries with `x-payment`
5. response is returned

Use wallet-connect style integrations for this mode.

Do not put raw private keys in frontend/browser env.

## What the Consumer Sees

An unpaid call returns:

- `402 Payment Required`
- `accepts`
- machine-readable payment metadata

A paid call returns:

- `success`
- `payment.status`
- `payment.receipt`
- business result payload

That means agents and platforms can reason about:

- cost
- network
- asset
- billing unit
- result shape
- settlement receipt

## Required Provider Metadata

For real paid-agent-API adoption, include at least:

- `description`
- `priceUsd`
- `category`
- `billingUnit`
- `audience`
- `tags`
- `inputSchema`
- `outputSchema`

Recommended:

- `useCases`
- `examples`
- dynamic `pricing(...)`

## Which Template To Start From

Use the template closest to your product:

- [examples/paid-search-provider.js](/home/kelly-musk/agentpay-server/examples/paid-search-provider.js)
  For search, retrieval, and grounded lookup APIs.

- [examples/paid-market-data-provider.js](/home/kelly-musk/agentpay-server/examples/paid-market-data-provider.js)
  For market data, signals, and news APIs.

- [examples/paid-scraper-provider.js](/home/kelly-musk/agentpay-server/examples/paid-scraper-provider.js)
  For scraping, extraction, and collection APIs.

- [examples/paid-inference-provider.js](/home/kelly-musk/agentpay-server/examples/paid-inference-provider.js)
  For AI inference, summarization, and generation APIs.

## Design Rules for Good Paid Agent APIs

### 1. Prefer structured responses

Agents should receive:

- objects
- arrays
- typed fields

Avoid:

- vague strings only
- human-only formatting

### 2. Make billing legible

Include:

- billing unit
- price basis
- dynamic pricing hints if relevant

### 3. Expose schemas

Agents and developers should be able to discover:

- what to send
- what comes back

### 4. Keep service semantics clear

A route should say what it does:

- search
- inference
- scrape
- compute
- market data

not just:

- tool
- execute
- query

### 5. Return receipts

Paid APIs should return real payment confirmation data for:

- reconciliation
- debugging
- downstream automation

## Current AgentPay Features That Support This

Already implemented:

- paid routes
- dynamic pricing
- route metadata
- capabilities and discovery surfaces
- payment receipts
- intent flows
- storage-backed usage and intent tracking
- paid API templates

## What Still Strengthens This Wedge Further

The next major improvements for paid agent APIs are:

- a provider manifest endpoint
- richer discovery/export for registries
- first-class browser client flow for user-paid services
- stronger response contract/versioning
- more domain templates

## Source of Truth

This document is the practical implementation reference for the
**Paid agent services / APIs** wedge.

For the larger ecosystem/infrastructure direction, use:

- [docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/agentpay-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md)
- [docs/ROADMAP_ECOSYSTEM_TOOLING.md](/home/kelly-musk/agentpay-server/docs/ROADMAP_ECOSYSTEM_TOOLING.md)
