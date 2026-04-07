# AgentPay Gateway

AgentPay Gateway is agent-native API monetization infrastructure on Stellar.

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

## Integration Modes

AgentPay can now be used in two ways:

1. as a standalone hosted gateway
2. as an embeddable provider layer inside another Express service

That means implementers can either deploy AgentPay directly or mount its routes
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
Public AgentPay Gateway
        ↓
402 Challenge + Payment Verification
        ↓
Backend Handler / Forwarded Service
        ↓
Structured Response + Payment Metadata + Logging
```

## Provider Integration

The package now exposes a reusable provider surface for implementers:

- `createAgentPayApp(...)`
- `createAgentPayProvider(...)`
- `registerAgentPayRoutes(app, ...)`
- `validateProviderOptions(...)`
- `validateGatewayConfig(...)`
- `createIntentStore(...)`
- `createMemoryIntentStorage(...)`
- `createFileIntentStorage(...)`
- `createSqliteIntentStorage(...)`
- `createUsageStore(...)`
- `createMemoryUsageStorage(...)`
- `createFileUsageStorage(...)`
- `createSqliteUsageStorage(...)`

Stable import paths:

```js
import { registerAgentPayRoutes } from "agentpay-gateway";
import { createPaymentContext } from "agentpay-gateway/server";
import { getPriceUsd } from "agentpay-gateway/pricing";
import { payFetch } from "agentpay-gateway/client";
```

AgentPay validates provider and gateway config before route registration. Invalid
wallets, URLs, route methods, prices, or storage definitions fail fast during
startup instead of surfacing later as runtime payment errors.

The simplest integration path is now a declarative protected-route array:

```js
import express from "express";
import { registerAgentPayRoutes } from "agentpay-gateway";

const app = express();

registerAgentPayRoutes(app, {
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

If you want an explicit preflight step in your own app, call the validators
directly:

```js
import {
  validateGatewayConfig,
  validateProviderOptions,
} from "agentpay-gateway/server";

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
[examples/express-provider.js](/home/kelly-musk/agentpay-server/examples/express-provider.js).

Example:

```js
import express from "express";
import { registerAgentPayRoutes } from "agentpay-gateway";

const app = express();

registerAgentPayRoutes(app, {
  config: {
    port: 3000,
    gatewayUrl: "http://localhost:3000",
    rustServiceUrl: "",
    facilitatorUrl: "https://facilitator.stellar-x402.org",
    network: "stellar-testnet",
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
  registerAgentPayRoutes,
} from "agentpay-gateway";

const intentStore = createIntentStore(createMemoryIntentStorage());

registerAgentPayRoutes(app, {
  config,
  intentStore,
  endpoints,
  handlers,
});
```

Or choose storage by type through provider config:

```js
registerAgentPayRoutes(app, {
  config,
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
  endpoints,
  handlers,
});
```

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
agentpay-gateway/
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
├── docs/
├── server.js
├── client.js
└── package.json
```

For a contributor-oriented repo walkthrough, see
[docs/README.md](/home/kelly-musk/agentpay-server/docs/README.md).

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

Notes:

- `X402_ASSET=USDC` is the primary stablecoin path in this repo.
- `X402_ASSET=USDC` requires the payer to already have the right trustline and token balance.
- `X402_ASSET=native` remains available as the simpler XLM path.
- `RUST_SERVICE_URL` is optional. If unset, handlers fall back to local logic.
- `STELLAR_SECRET_KEY` is still supported as a fallback/dev path for the CLI.
- the preferred CLI flow is secure local setup via `yarn cli setup`

## Scripts

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
yarn check
yarn build
yarn smoke
```

## Package Exports

Implementers can import:

- `agentpay-gateway`
- `agentpay-gateway/server`
- `agentpay-gateway/payments`
- `agentpay-gateway/pricing`
- `agentpay-gateway/client`

The provider surface is aimed at implementers who want to:

- mount AgentPay routes inside their own Express service
- bring their own endpoint catalog and handlers
- inject durable intent and usage storage
- inject their own intent storage and persistence strategy

## Public API

### `GET /`

Service summary and route overview.

### `GET /health`

Runtime health probe for operators and deployment checks.

### `GET /capabilities`

Machine-readable endpoint and payment metadata for agent integrations.

### `GET /discovery/resources`

Discovery endpoint listing monetized resources and their payment requirements.

### `GET /stats`

Aggregated request and revenue stats from `logs.txt`.

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

5. In another terminal, make a paid request:

```bash
yarn cli ai --query "hello agent"
```

6. Inspect the returned settlement hash on a Stellar testnet explorer.

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

AgentPay is different: it exposes a reusable payment layer that can be placed
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
