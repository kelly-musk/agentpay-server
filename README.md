# Stellar Oxide Gateway

Stellar Oxide Gateway is agent-native API monetization infrastructure on Stellar.

It turns protected HTTP endpoints into pay-per-request services using x402-style
payment challenges, Stellar-based settlement, and agent-friendly responses.
Instead of API keys, subscriptions, or centralized billing, callers pay when
they use the service.

This repo is built around a simple idea:

- an agent or CLI calls a protected endpoint
- the gateway returns `402 Payment Required`
- the client signs and submits a Stellar payment
- the request is retried with `x-payment`
- the gateway verifies payment and unlocks the resource

It now also supports an intent-based execution flow:

- a caller creates a payment intent for a specific action
- the gateway returns the intent plus exact payment requirements
- the caller pays against that intent-specific execution resource
- the gateway verifies, executes, and records the intent lifecycle

## Positioning

This project is infrastructure, not just an app.

It is designed to sit in front of backend services and provide:

- API monetization infrastructure
- machine-to-machine payment gating
- x402-style request verification on Stellar
- programmable per-request billing for agents

That makes it useful for many downstream services, including:

- AI inference
- data APIs
- compute jobs
- tool execution
- future backend microservices

## Current Progress

Stellar Oxide Gateway is currently strongest in the **Paid agent services / APIs** wedge.

Implemented today:

- provider SDK for embedding paid routes into Express apps
- standalone gateway mode
- `402 -> pay -> verify -> settle` flow on Stellar
- direct paid routes and intent-based paid execution
- structured blockchain receipts
- versioned provider manifest endpoint
- capabilities and discovery endpoints
- route metadata for category, billing unit, audience, tags, use cases, and schemas
- paid API templates for:
  - search
  - market/news data
  - scraping/data extraction
  - AI inference
- storage adapters for memory, file, SQLite, and Postgres
- readiness, stats, and production-style test coverage

Partially implemented:

- infrastructure / ecosystem tooling
- provider publishing and service discovery surfaces
- provider-grade operations and storage confidence
- versioned public contract layer for manifest, registry export, capabilities, discovery, and receipts

Planned, not fully implemented yet:

- provider manifest endpoint
- bazaar / registry export format
- versioned ecosystem contracts
- consumer-side service resolution from manifests
- trust and reputation layers

So the product should currently be described as:

- strong for paid agent APIs
- increasingly infrastructure-shaped
- not yet a fully realized ecosystem tooling platform

Reference docs:

- **Product Requirements Document (PRD):**
  [Google Docs](https://docs.google.com/document/d/1BOtask_WttU2Oni6gIoFt5Mk9DrrWbRB/edit?usp=sharing&ouid=100722320761073170367&rtpof=true&sd=true) | [PRD.md](PRD.md)
- paid agent APIs implementation:
  [docs/PAID_AGENT_APIS_IMPLEMENTATION.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/PAID_AGENT_APIS_IMPLEMENTATION.md)
- ecosystem tooling architecture target:
  [docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md)
- ecosystem tooling implementation plan:
  [docs/INFRASTRUCTURE_ECOSYSTEM_TOOLING_IMPLEMENTATION.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/INFRASTRUCTURE_ECOSYSTEM_TOOLING_IMPLEMENTATION.md)

## Integration Modes

Stellar Oxide Gateway can now be used in two ways:

1. as a standalone hosted gateway
2. as an embeddable provider layer inside another Express service

That means implementers can either deploy Stellar Oxide Gateway directly or mount its routes
inside their own app and protect their own paid endpoints with Stellar-backed
payment verification.

## What It Does

For protected routes, the gateway:

1. returns `402 Payment Required`
2. includes machine-readable payment requirements in `accepts`
3. verifies the retried `x-payment` payload
4. settles the payment on Stellar
5. returns a structured JSON response with payment metadata
6. logs the request and exposes usage stats

The repo also includes a CLI payer that can:

1. call protected endpoints
2. handle the `402` challenge
3. build and sign Stellar payment payloads
4. retry automatically
5. print settlement confirmation data

## Architecture

```text
Agent CLI / Agent Client
        ↓
Public Stellar Oxide Gateway
        ↓
402 Challenge + Payment Verification
        ↓
Backend Handler / Forwarded Service
        ↓
Structured Response + Payment Metadata + Logging
```

## Product Architecture

```text
                         STELLAR_OXIDE_GATEWAY PRODUCT ARCHITECTURE

┌──────────────────────────── IMPLEMENTER SIDE ─────────────────────────────┐
│                                                                           │
│  Developer / Company / Protocol                                           │
│          │                                                                │
│          ▼                                                                │
│  Integrates Stellar Oxide Gateway into:                                                │
│  - paid API service                                                       │
│  - protocol service                                                       │
│  - SaaS backend                                                           │
│  - agent platform                                                         │
│          │                                                                │
│          ▼                                                                │
│  Configures:                                                              │
│  - protected routes                                                       │
│  - pricing                                                                │
│  - merchant wallet                                                        │
│  - backend handler / forward target                                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────── STELLAR_OXIDE_GATEWAY LAYER ───────────────────────────────┐
│                                                                           │
│  Stellar Oxide Gateway / Middleware / SDK                                      │
│  - returns 402 payment challenge                                          │
│  - exposes payment requirements                                           │
│  - verifies x-payment                                                     │
│  - settles Stellar transaction                                            │
│  - unlocks backend resource                                               │
│  - logs usage and revenue                                                 │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               │                                       │
               ▼                                       ▼

      FRONTEND CONSUMER FLOW                    BACKEND CONSUMER FLOW

┌──────────────────────────────┐         ┌──────────────────────────────┐
│ Frontend App / Web Product   │         │ Backend Service / Agent      │
│ consuming paid API           │         │ consuming paid API           │
└──────────────────────────────┘         └──────────────────────────────┘
               │                                       │
               ▼                                       ▼
      Calls protected endpoint                 Calls protected endpoint
               │                                       │
               ▼                                       ▼
          Receives 402                            Receives 402
               │                                       │
               ▼                                       ▼
      Decide who pays:                          Service pays itself
               │                                       │
       ┌───────┴────────┐                              │
       │                │                              ▼
       ▼                ▼                    Backend wallet signs payment
User wallet pays   Platform backend pays              │
       │                │                              ▼
       │                ▼                     Retries with x-payment
       │        Service wallet signs                   │
       │                │                              ▼
       ▼                ▼                      Stellar Oxide Gateway verifies
Connect wallet     Retries with x-payment              │
signs payment             │                            ▼
       │                  ▼                     Protected logic runs
       ▼          Stellar Oxide Gateway verifies                    │
Retries with             │                             ▼
x-payment                ▼                      Response returned
       │          Protected logic runs
       ▼                  │
Stellar Oxide Gateway verifies         ▼
       │           Response returned
       ▼
Protected logic runs
       │
       ▼
Response returned
```

This is the intended product shape:

- implementers integrate Stellar Oxide Gateway into their own service, protocol, or platform
- Stellar Oxide Gateway acts as the payment and authorization layer
- consumers can be frontend apps, agents, or backend services
- payment can come from the end user wallet or from a service wallet

The two payer models matter:

- user-paid flow: the caller receives `402`, connects a wallet, signs the payment, and retries
- service-paid flow: the platform or backend holds a service wallet, signs server-side, and retries on behalf of its own consumption

In practice:

- browser/frontend integrations should use wallet-connect style signing when the end user is the payer
- backend and agent integrations should use a service wallet stored in server-side env or a secret manager
- frontends should not embed raw private keys for payment signing

## Provider Integration

The package now exposes a reusable provider surface for implementers:

- `createStellarOxideGatewayApp(...)`
- `createStellarOxideGatewayProvider(...)`
- `registerStellarOxideGatewayRoutes(app, ...)`
- `validateProviderOptions(...)`
- `validateGatewayConfig(...)`
- `createIntentStore(...)`
- `createMemoryIntentStorage(...)`
- `createFileIntentStorage(...)`
- `createPostgresIntentStorage(...)`
- `createSqliteIntentStorage(...)`
- `createUsageStore(...)`
- `createMemoryUsageStorage(...)`
- `createFileUsageStorage(...)`
- `createPostgresUsageStorage(...)`
- `createSqliteUsageStorage(...)`

Stable import paths:

```js
import { NETWORK_IDS, registerStellarOxideGatewayRoutes } from "stellar-oxide-gateway";
import { createPaymentContext } from "stellar-oxide-gateway/server";
import { getPriceUsd } from "stellar-oxide-gateway/pricing";
import { payFetch } from "stellar-oxide-gateway/client";
```

Stellar Oxide Gateway validates provider and gateway config before route registration. Invalid
wallets, URLs, route methods, prices, or storage definitions fail fast during
startup instead of surfacing later as runtime payment errors.

Network selection is explicit by design. Implementers must provide
`config.network` or `X402_NETWORK`; the gateway no longer silently falls back to
testnet on the server/provider side.

For a better developer experience, the SDK exports named network constants:

```js
import {
  NETWORK_IDS,
  SUPPORTED_NETWORK_IDS,
  isSupportedNetworkId,
} from "stellar-oxide-gateway";

const network = NETWORK_IDS.STELLAR_TESTNET;
const supported = isSupportedNetworkId(network);
```

`NETWORK_IDS` is the forward-looking identifier surface for the SDK. The current
runtime support in this package is narrower and exposed via
`SUPPORTED_NETWORK_IDS`, which currently contains only Stellar network ids.

The simplest integration path is now a declarative protected-route array:

```js
import express from "express";
import { NETWORK_IDS, registerStellarOxideGatewayRoutes } from "stellar-oxide-gateway";

const app = express();

registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
      description: "Summarize text",
      priceUsd: "0.05",
      handler: async (gatewayConfig, query) => ({
        summary: `Summarized: ${query}`,
        source: "route-definition",
      }),
    },
  ],
});
```

Routes can also define policy hooks for dynamic pricing, conditional paywalling,
and extra payment metadata:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
      description: "Summarize text",
      priceUsd: "0.05",
      pricing: ({ query }) => (query.length > 20 ? "0.07" : "0.05"),
      shouldRequirePayment: ({ req }) => req.headers["x-plan"] !== "pro",
      paymentMetadata: ({ req }) => ({
        tenantId: req.headers["x-tenant-id"],
        plan: req.headers["x-plan"],
      }),
      handler: async (gatewayConfig, query) => ({
        summary: `Summarized: ${query}`,
      }),
    },
  ],
});
```

Routes and endpoints can also describe themselves as real paid agent services:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/search",
      description: "Paid search for agent workflows",
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
          result: { type: "array" },
        },
        required: ["success", "result"],
      },
      handler: async (gatewayConfig, query) => ({
        result: [{ title: `Search result for ${query}` }],
      }),
    },
  ],
});
```

That metadata is exposed through `/capabilities`, `/discovery/resources`, and
the `402` payment requirements so agents can understand:

- what kind of service the route provides
- who it is meant for
- how it is billed
- what request and response shape to expect

The same hooks also apply to the intent lifecycle:

- `POST /intents` evaluates pricing, paywall, and payment metadata policies
- the resulting policy output is stored on the intent
- `POST /intents/:intentId/execute` follows the stored policy result

If you already have an upstream API and want Stellar Oxide Gateway to sit in front of it,
routes can proxy directly to that upstream without a custom local handler:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
      description: "Paid summarize endpoint",
      priceUsd: "0.05",
      upstream: {
        url: "https://api.example.com/summarize",
        headers: {
          Authorization: `Bearer ${process.env.UPSTREAM_API_KEY}`,
        },
      },
    },
  ],
});
```

For non-`GET` proxy routes, Stellar Oxide Gateway forwards a JSON body that includes the
incoming request body plus `query`, `endpoint`, `path`, and `intentId` when the
call came from an intent execution flow.

If you want an explicit preflight step in your own app, call the validators
directly:

```js
import {
  validateGatewayConfig,
  validateProviderOptions,
} from "stellar-oxide-gateway/server";

const gatewayConfig = validateGatewayConfig(config);
validateProviderOptions({
  config: gatewayConfig,
  routes,
  storage,
});
```

If you want more control, you can still provide `endpoints` and `handlers`
separately.

A copyable end-to-end provider example lives at
[examples/express-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/express-provider.js).

A more product-shaped paid-agent-API example lives at
[examples/paid-search-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-search-provider.js).
It shows how to expose a paid search endpoint with:

- service metadata for agents and developers
- per-query billing
- dynamic pricing by query complexity
- input/output schemas in discovery and `402` responses

Additional first-class paid-agent-API templates are available for:

- [examples/paid-market-data-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-market-data-provider.js)
- [examples/paid-scraper-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-scraper-provider.js)
- [examples/paid-inference-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-inference-provider.js)

For ecosystem tooling and provider publishing, Stellar Oxide Gateway now also exposes a
versioned manifest endpoint:

```text
GET /.well-known/stellar-oxide-gateway.json
```

That manifest is intended to become the provider-facing publishing contract for:

- registries
- marketplaces
- discovery tooling
- agent platforms

For flatter registry ingestion and listing systems, Stellar Oxide Gateway also exposes:

```text
GET /registry/export
```

This export is designed for:

- service directories
- bazaars
- marketplace backends
- compatibility crawlers

It provides a more listable surface than the manifest, including:

- provider summary
- service summary
- network and asset compatibility
- categories and tags
- flattened route metadata
- links back to manifest, capabilities, discovery, readiness, and health

Consumer SDKs can now resolve those publishing surfaces programmatically:

```js
import {
  resolveStellarOxideGatewayService,
  selectStellarOxideGatewayRoute,
} from "stellar-oxide-gateway/client";

const service = await resolveStellarOxideGatewayService("https://api.example.com");
const route = selectStellarOxideGatewayRoute(service, {
  category: "search-api",
  audience: "agents",
});
```

That is the first consumer-side service resolution layer built on top of:

- `/.well-known/stellar-oxide-gateway.json`
- `/registry/export`
- `/capabilities`
- `/discovery/resources`

Those surfaces are now explicitly versioned public contracts. The SDK exports
`CONTRACT_VERSIONS` so downstream consumers and tests can pin against:

- manifest version
- registry export version
- capabilities version
- discovery version
- receipt version

Example:

```js
import express from "express";
import { registerStellarOxideGatewayRoutes } from "stellar-oxide-gateway";

const app = express();

registerStellarOxideGatewayRoutes(app, {
  config: {
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
  },
  endpoints: {
    summarize: {
      id: "summarize",
      path: "/summarize",
      description: "Summarize text",
      basePriceUsd: "0.05",
    },
  },
  handlers: {
    summarize: async (config, query) => ({
      summary: `Summarized: ${query}`,
      source: "custom-handler",
    }),
  },
});

app.listen(3000);
```

Implementers can also inject their own persistence:

```js
import {
  createIntentStore,
  createMemoryIntentStorage,
  registerStellarOxideGatewayRoutes,
} from "stellar-oxide-gateway";

const intentStore = createIntentStore(createMemoryIntentStorage());

registerStellarOxideGatewayRoutes(app, {
  config,
  intentStore,
  endpoints,
  handlers,
});
```

Or choose storage by type through provider config:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
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
  endpoints,
  handlers,
});
```

For production persistence, select Postgres-backed storage:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  storage: {
    intents: {
      type: "postgres",
      connectionString: process.env.DATABASE_URL,
      schemaName: "public",
      tableName: "stellar-oxide-gateway_intents",
    },
    usage: {
      type: "postgres",
      connectionString: process.env.DATABASE_URL,
      schemaName: "public",
      tableName: "stellar-oxide-gateway_usage",
    },
  },
  endpoints,
  handlers,
});
```

The Postgres adapters lazy-load `pg` and auto-create their tables on first use.
Embedded providers also expose `getReadinessReport()` and `close()` so hosts can
wire readiness probes and graceful shutdown into their own runtime.

## Current Working Paths

- `USDC` on Stellar testnet via Soroban token transfer
- native `XLM` on Stellar testnet as a simpler fallback/demo path

The current repo has a working end-to-end USDC path, including:

- payer readiness checks
- trustline and token-balance preflight
- signed Soroban transfer payload generation
- local gateway-side payment verification
- settlement confirmation returned in the API response

## Core Features

- paywalled endpoints for `/ai`, `/data`, and `/compute`
- dynamic pricing based on query complexity
- payment intents and guarded execution routes
- discovery-friendly payment metadata
- agent-friendly JSON responses
- local verification for native and Soroban payment payloads
- request logging and aggregated revenue stats
- CLI wallet setup with secure local secret storage
- optional backend forwarding for business logic

## Endpoint Pricing

| Endpoint | Description | Base Price |
| --- | --- | --- |
| `/ai` | AI-related queries | `0.02` |
| `/data` | Dataset queries | `0.01` |
| `/compute` | Processing tasks | `0.03` |

Longer queries receive a small surcharge.

## Project Structure

```text
stellar-oxide-gateway/
├── server/
│   ├── server.js
│   ├── pricing.js
│   ├── payments.js
│   ├── logger.js
│   └── handlers/
├── client/
│   ├── client.js
│   ├── payFetch.js
│   └── lib/
├── scripts/
├── tests/
├── production-tests/
├── docs/
├── server.js
├── client.js
└── package.json
```

For a contributor-oriented repo walkthrough, see
[docs/README.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/README.md).

## Environment Variables

Required for the gateway:

```bash
WALLET_ADDRESS=<stellar public key>
```

Common optional variables:

```bash
PORT=3000
GATEWAY_URL=http://localhost:3000
RUST_SERVICE_URL=http://localhost:4000
FACILITATOR_URL=https://facilitator.stellar-x402.org
X402_NETWORK=stellar-testnet
X402_ASSET=USDC
X402_ASSET_SYMBOL=TOKEN
X402_ASSET_DECIMALS=7
X402_ASSET_NAME=Custom Stellar Token
STELLAR_SECRET_KEY=<payer secret key>
AUTO_FUND_TESTNET_ACCOUNTS=true
```

Merchant backend variables for automatic payee trustline setup:

```bash
AUTO_CREATE_PAYEE_TRUSTLINE=true
MERCHANT_WALLET_SECRET_KEY=<merchant/payee stellar secret key>
MERCHANT_CLASSIC_ASSET=USDC
```

For custom classic Stellar assets not present in the built-in registry:

```bash
MERCHANT_ASSET_CODE=<classic asset code>
MERCHANT_ASSET_ISSUER=<classic stellar issuer address>
```

Notes:

- `X402_ASSET=USDC` is the primary stablecoin path in this repo.
- `X402_ASSET=USDC` requires the payer to already have the right trustline and token balance.
- if the payee wallet must auto-establish a trustline, configure
  `AUTO_CREATE_PAYEE_TRUSTLINE=true` plus
  `MERCHANT_WALLET_SECRET_KEY` and either
  `MERCHANT_CLASSIC_ASSET=USDC` for a built-in known asset or
  `MERCHANT_ASSET_CODE`/`MERCHANT_ASSET_ISSUER` for a custom classic asset
- `X402_ASSET=native` remains available as the simpler XLM path.
- `RUST_SERVICE_URL` is optional. If unset, handlers fall back to local logic.
- `STELLAR_SECRET_KEY` is still supported as a fallback/dev path for the CLI.
- the preferred CLI flow is secure local setup via `yarn cli setup`

## Quick Start

### See the Demo First! 🎬

Want to see the problem and solution in action? Run the side-by-side comparison:

```bash
# Install dependencies
yarn install

# Run both traditional API and Stellar Oxide Gateway
yarn demo:comparison
```

This starts:
- **Traditional API** (port 4000) - Shows the problems with API keys, subscriptions, and rate limits
- **Stellar Oxide Gateway** (port 3000) - Shows the solution with blockchain payments

See [src/README.md](src/README.md) for detailed demo documentation.

### Quick Start (5 minutes)

Install dependencies:

```bash
yarn install
```

Run the gateway:

```bash
X402_ASSET=USDC yarn start
```

Run the legacy single-command client:

```bash
X402_ASSET=USDC yarn start:client -- --endpoint ai --query "ai startups"
```

Run the command-based CLI:

```bash
yarn cli --help
```

Create and execute intent-based flows:

```bash
yarn cli intent:create --endpoint ai --query "hello agent"
yarn cli intent:list
yarn cli intent:get --id intent_...
yarn cli intent:execute --id intent_...
```

Run a one-shot diagnostics report:

```bash
yarn doctor
```

Check payer readiness:

```bash
yarn payer:check
```

Quality checks:

```bash
yarn lint
yarn test
yarn test:production
yarn check
yarn build
yarn smoke
```

`yarn test:production` runs the live Stellar testnet verification suite in
[production-tests/stellar-testnet.test.mjs](/home/kelly-musk/stellar-oxide-gateway-server/production-tests/stellar-testnet.test.mjs).
It is intentionally separate from `yarn test` because it performs real network
calls and real Stellar testnet payments. The suite is self-contained and does
not require local env secrets because it uses:

- a hardcoded testnet merchant wallet address
- a temporary in-process gateway
- auto-funded ephemeral testnet payer accounts for the live payment steps

## Package Exports

Implementers can import:

- `stellar-oxide-gateway`
- `stellar-oxide-gateway/server`
- `stellar-oxide-gateway/payments`
- `stellar-oxide-gateway/pricing`
- `stellar-oxide-gateway/client`

The provider surface is aimed at implementers who want to:

- mount Stellar Oxide Gateway routes inside their own Express service
- bring their own endpoint catalog and handlers
- inject durable intent and usage storage
- inject their own intent storage and persistence strategy

## Public API

### `GET /`

Service summary and route overview.

### `GET /health`

Runtime health probe for operators and deployment checks.

### `GET /ready`

Readiness probe that reports provider storage status and returns `503` if a
configured storage backend is not healthy.

### `GET /capabilities`

Machine-readable endpoint and payment metadata for agent integrations.

### `GET /.well-known/stellar-oxide-gateway.json`

Versioned provider manifest for ecosystem tooling, discovery systems, and
registry-style integrations.

### `GET /registry/export`

Versioned registry/listing export for directories, bazaars, and crawlers.

### `GET /discovery/resources`

Discovery endpoint listing monetized resources and their payment requirements.

### `GET /stats`

Aggregated request and revenue stats from the configured usage store.

### `GET /intents`

List recent payment intents and execution state.

### `POST /intents`

Create a payable intent for a specific endpoint and query.

### `GET /intents/:intentId`

Fetch a single intent record.

### `POST /intents/:intentId/execute`

Execute a specific intent behind x402 payment verification.

### `GET /ai?q=...`

Paid AI-related endpoint.

### `GET /data?q=...`

Paid data endpoint.

### `GET /compute?q=...`

Paid compute endpoint.

## Example Response

```json
{
  "success": true,
  "endpoint": "ai",
  "payment": {
    "status": "verified",
    "network": "stellar-testnet",
    "asset": "USDC",
    "amount": "0.02",
    "receipt": {
      "transactionHash": "70c1427f87e740d4706d32ff8f7b53667f6a0b0c399349fde5e434daed743b5d",
      "ledger": 123456,
      "payer": "GDJ6ODLWKV26CTH5I5BD74HDBE6TSN3WI3U46AQ6ZSIU6VFDBUEEZCQD",
      "payee": "GD3PXXADIXMWGINT2LK3Q45SLI3HRCRA2I7NDOTXXTGNXO7GDYKI4SK7",
      "amount": {
        "display": "0.02",
        "baseUnits": "200000"
      },
      "asset": {
        "symbol": "USDC"
      }
    },
    "settlement": {
      "success": true,
      "payer": "GDJ6ODLWKV26CTH5I5BD74HDBE6TSN3WI3U46AQ6ZSIU6VFDBUEEZCQD",
      "transaction": "70c1427f87e740d4706d32ff8f7b53667f6a0b0c399349fde5e434daed743b5d",
      "network": "stellar-testnet"
    }
  },
  "result": {
    "summary": "Processed ai request for \"hello agent\"",
    "source": "local-fallback"
  }
}
```

## Happy Path

1. Store your wallet locally:

```bash
yarn cli setup
```

Non-interactive setup is also supported:

```bash
yarn cli setup --secret-key S... --network stellar-testnet --gateway-url http://localhost:3000 --asset USDC
```

2. Confirm local CLI state:

```bash
yarn cli whoami
yarn cli doctor
```

3. Confirm the payer is ready:

```bash
yarn cli payer:check
```

4. Start the gateway:

```bash
X402_ASSET=USDC yarn start
```

The gateway requires an explicit network:

```bash
X402_NETWORK=stellar-testnet X402_ASSET=USDC yarn start
```

5. In another terminal, make a paid request:

```bash
yarn cli ai --query "hello agent"
```

6. Inspect the returned settlement hash on a Stellar testnet explorer.
7. Check runtime readiness:

```bash
curl http://localhost:3000/ready
```

## Production-Style Verification

This is the closest step-by-step verification flow for a production-shaped
deployment in the current repo. It is still based on Stellar testnet unless you
point the gateway at a supported production network and production-grade
services.

1. Install dependencies and run repo checks:

```bash
yarn install
yarn lint
yarn test
yarn test:production
yarn build
```

If you want the fastest single-command production-style verification, run:

```bash
yarn test:production
```

That suite covers:

- gateway startup
- `/health`
- `/ready`
- real `402` challenge generation
- real direct-route payment on Stellar testnet
- real intent creation
- real paid intent execution on Stellar testnet
- Horizon validation of the returned transaction hash

It currently uses the native XLM path on Stellar testnet because that is the
most stable self-contained live verification route and does not require local
merchant secrets or token trustline setup.

2. Prepare operator env for the gateway:

```bash
export X402_NETWORK=stellar-testnet
export X402_ASSET=USDC
export WALLET_ADDRESS=<merchant public key>
```

If the merchant backend should automatically establish the payee trustline for a
known classic asset:

```bash
export AUTO_CREATE_PAYEE_TRUSTLINE=true
export MERCHANT_WALLET_SECRET_KEY=<merchant/payee secret key>
export MERCHANT_CLASSIC_ASSET=USDC
```

For a custom classic asset instead of a built-in registry asset:

```bash
export MERCHANT_ASSET_CODE=<classic asset code>
export MERCHANT_ASSET_ISSUER=<classic issuer address>
```

3. Start the gateway:

```bash
yarn start
```

4. Verify operator health and readiness:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/capabilities
```

Expected:

- `/health` returns basic runtime status
- `/ready` returns `200` and all checks as healthy
- if the payee cannot receive the configured token, `/ready` should show a
  `missing_trustline` status and an operator `nextStep`

5. Verify the payer wallet is ready:

```bash
yarn cli payer:check
```

Expected:

- payer exists on the selected network
- payer has native XLM for fees
- payer has the correct token balance and trustline for non-native assets

6. Run a direct paid route:

```bash
yarn cli ai --query "production style verification"
```

Expected:

- request succeeds
- response contains `payment.status = "verified"`
- response contains a structured `payment.receipt`
- receipt includes:
  - `transactionHash`
  - `ledger`
  - `payer`
  - `payee`
  - `amount.display`
  - `amount.baseUnits`
  - `asset`
  - `explorer.transaction`

7. Run the intent lifecycle:

```bash
yarn cli intent:create --endpoint ai --query "intent verification"
yarn cli intent:list
yarn cli intent:execute --id intent_...
```

Expected:

- intent is created with the resolved policy result
- paid intents return `accepts`
- free/bypassed intents return `payment.status = "not_required"`
- execution returns a structured receipt when payment occurs

8. Verify usage and revenue reporting:

```bash
curl http://localhost:3000/stats
```

Expected:

- request count increments
- revenue reflects the settled payment asset/amount

9. Validate the blockchain receipt externally:

- open `payment.receipt.explorer.transaction`
- confirm the transaction hash, ledger, payer, payee, and amount match the API
  response

10. Verify provider-grade behavior if using embedded mode:

- restart the host app
- confirm `/ready` returns healthy after restart
- if using Postgres-backed storage, confirm intents and usage survive process
  restart

This flow is the right production-style checklist for the repo today, but it is
still not a substitute for the broader work tracked in
[docs/PRODUCTION_READINESS.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/PRODUCTION_READINESS.md).

## Verified Progress

As of April 8, 2026, the repo has been verified with both repo-level checks and
live Stellar testnet payments.

Verified in code:

- `yarn lint`
- `yarn test`
- `yarn build`

Verified live on Stellar testnet:

- `/health`, `/ready`, and `/capabilities` returned expected runtime metadata
- a direct paid `/ai` request completed successfully with a confirmed on-chain receipt
- an intent was created and then executed successfully through the paid intent flow
- a returned transaction hash was validated directly against Horizon

Verified live receipts included:

- `transactionHash`
- `ledger`
- `ledgerCloseTime`
- `payer`
- `payee`
- `amount.display`
- `amount.baseUnits`
- `explorer.transaction`
- raw XDR fields for reconciliation

One real production-style defect was found and fixed during that live pass:

- `POST /intents` for built-in GET endpoints was not correctly bridging the
  intent query into the policy evaluation path
- that bug is now fixed in
  [server/provider.js](/home/kelly-musk/stellar-oxide-gateway-server/server/provider.js)
- regression coverage was added in
  [tests/provider.test.mjs](/home/kelly-musk/stellar-oxide-gateway-server/tests/provider.test.mjs)

## Request Lifecycle

1. A client calls a protected endpoint.
2. The gateway returns `402` and machine-readable payment requirements.
3. The client signs a Stellar payment payload.
4. The client retries the same request with `x-payment`.
5. The gateway verifies the payload.
6. The protected handler runs.
7. The gateway settles, logs, and returns the final response.

## Intent Lifecycle

1. A client creates an intent with `POST /intents`.
2. The gateway stores the intent in `pending` state and returns exact payment requirements.
3. The client calls `POST /intents/:intentId/execute`.
4. The gateway returns `402` if payment is missing.
5. The client signs and retries with `x-payment`.
6. The gateway verifies payment, marks the intent `paid`, executes the action, and stores the final result.
7. The intent ends in `executed` or `failed` state.

## Why This Is Different

Many x402 demos monetize a single application workflow, like trading.

Stellar Oxide Gateway is different: it exposes a reusable payment layer that can be placed
in front of arbitrary services. The goal is not just to sell one app feature,
but to provide a public-facing payment gateway for agent-native APIs on Stellar.

## Current Notes

- The USDC Soroban path works end to end on Stellar testnet.
- The native XLM path also works and remains useful for simpler demos.
- The CLI implements its own local `payFetch` behavior because the published `x402-stellar` package does not ship a ready-made client helper.
- The gateway now performs local verification for both native payments and Soroban transfer payloads.
- The response includes settlement metadata so clients can inspect transaction confirmation directly.
- Secure CLI key storage is available now, with env-based secrets still supported as a fallback.

## Next Extensions

- stronger production hardening and broader test coverage
- OS-keystore-first CLI onboarding as the default product experience
- richer discovery and capabilities metadata
- backend integrations beyond the current local fallback flow
- more durable provider-side storage for intents and execution state
