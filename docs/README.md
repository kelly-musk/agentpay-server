# Getting Around The Repo

This guide is the quickest way to understand where things live, what runs what,
and where to make changes when you want to extend AgentPay Gateway.

## Mental Model

There are two main execution paths:

1. The gateway in [server/server.js](/home/kelly-musk/agentpay-server/server/server.js)
2. The CLI payer in [client/client.js](/home/kelly-musk/agentpay-server/client/client.js)

There is now also an embeddable provider layer in
[server/provider.js](/home/kelly-musk/agentpay-server/server/provider.js)
that lets other developers mount AgentPay routes into their own Express apps.
Intent persistence is now pluggable through
[server/intents.js](/home/kelly-musk/agentpay-server/server/intents.js).

The gateway exposes paywalled routes, returns `402` payment challenges, verifies
incoming Stellar payments, executes business logic, and logs usage.

The CLI sends a request, receives the `402`, creates a signed Stellar payment,
retries with `x-payment`, and prints the final API response.

## File Map

### Root

- [index.js](/home/kelly-musk/agentpay-server/index.js): root SDK entrypoint for implementers.
- [server.js](/home/kelly-musk/agentpay-server/server.js): thin root entrypoint that boots the server folder.
- [client.js](/home/kelly-musk/agentpay-server/client.js): thin root entrypoint that boots the client folder.
- [package.json](/home/kelly-musk/agentpay-server/package.json): scripts, metadata, and dependencies.
- [README.md](/home/kelly-musk/agentpay-server/README.md): product-facing project overview.
- [examples/express-provider.js](/home/kelly-musk/agentpay-server/examples/express-provider.js): copyable Express integration example.

### Server

- [server/index.js](/home/kelly-musk/agentpay-server/server/index.js): server-focused SDK entrypoint.
- [server/server.js](/home/kelly-musk/agentpay-server/server/server.js): Express app setup, routes, and payment enforcement.
- [server/provider.js](/home/kelly-musk/agentpay-server/server/provider.js): reusable provider integration layer for implementers.
- [server/payments.js](/home/kelly-musk/agentpay-server/server/payments.js): x402 requirement generation, verification, settlement, and capabilities.
- [server/intents.js](/home/kelly-musk/agentpay-server/server/intents.js): intent store abstractions, file storage, and in-memory storage.
- [server/pricing.js](/home/kelly-musk/agentpay-server/server/pricing.js): endpoint catalog and dynamic pricing rules.
- [server/logger.js](/home/kelly-musk/agentpay-server/server/logger.js): request logging and `/stats` aggregation.
- [server/handlers/shared.js](/home/kelly-musk/agentpay-server/server/handlers/shared.js): shared business logic and Rust forwarding helper.
- [server/handlers/ai.js](/home/kelly-musk/agentpay-server/server/handlers/ai.js): AI endpoint handler.
- [server/handlers/data.js](/home/kelly-musk/agentpay-server/server/handlers/data.js): data endpoint handler.
- [server/handlers/compute.js](/home/kelly-musk/agentpay-server/server/handlers/compute.js): compute endpoint handler.

### Client

- [client/index.js](/home/kelly-musk/agentpay-server/client/index.js): client-focused SDK entrypoint.
- [client/client.js](/home/kelly-musk/agentpay-server/client/client.js): CLI argument parsing and request orchestration.
- [client/lib/config.js](/home/kelly-musk/agentpay-server/client/lib/config.js): persistent non-secret CLI config storage.
- [client/lib/secure-store.js](/home/kelly-musk/agentpay-server/client/lib/secure-store.js): OS keychain storage for wallet secrets.
- [client/lib/payer-check.js](/home/kelly-musk/agentpay-server/client/lib/payer-check.js): reusable payer readiness checks.
- [client/payFetch.js](/home/kelly-musk/agentpay-server/client/payFetch.js): local Stellar payer implementation for `402 -> sign -> retry`.

The CLI command surface currently includes:

- `setup`
- `whoami`
- `doctor`
- `payer:check`
- `intent:create`
- `intent:list`
- `intent:get`
- `intent:execute`
- `ai`
- `data`
- `compute`
- `logout`
- `reset`

### Tooling

- [scripts/lint.mjs](/home/kelly-musk/agentpay-server/scripts/lint.mjs): syntax and lightweight style checks.
- [scripts/build.mjs](/home/kelly-musk/agentpay-server/scripts/build.mjs): quality-gated build step that writes `dist/manifest.json`.
- [scripts/smoke.mjs](/home/kelly-musk/agentpay-server/scripts/smoke.mjs): tiny repo sanity check.
- [tests/pricing.test.mjs](/home/kelly-musk/agentpay-server/tests/pricing.test.mjs): pricing unit tests.
- [tests/payments.test.mjs](/home/kelly-musk/agentpay-server/tests/payments.test.mjs): payment requirement unit tests.

## Common Tasks

Run the gateway:

```bash
X402_ASSET=USDC yarn start
```

Mount AgentPay into another Express app:

```js
import express from "express";
import { registerAgentPayRoutes } from "agentpay-gateway";
```

Import server/client helpers from stable SDK paths:

```js
import { createPaymentContext } from "agentpay-gateway/server";
import { payFetch } from "agentpay-gateway/client";
```

Run provider or gateway config through the fail-fast validators:

```js
import {
  validateGatewayConfig,
  validateProviderOptions,
} from "agentpay-gateway/server";
```

Use the simpler declarative route API:

```js
registerAgentPayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
      description: "Summarize text",
      priceUsd: "0.05",
      handler: async (gatewayConfig, query) => ({ summary: query }),
    },
  ],
});
```

Inject a custom intent store:

```js
import { createIntentStore, createMemoryIntentStorage } from "agentpay-gateway";
```

Or select SQLite-backed intent storage:

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

Run the CLI against the gateway:

```bash
yarn cli ai --query "ai startups"
```

Run the intent flow:

```bash
yarn cli intent:create --endpoint ai --query "hello agent"
yarn cli intent:list
yarn cli intent:get --id intent_...
yarn cli intent:execute --id intent_...
```

Run a combined local diagnostics check:

```bash
yarn cli doctor
```

Check payer readiness:

```bash
yarn cli payer:check
```

Set up secure local credentials:

```bash
yarn cli setup
yarn cli whoami
```

Use non-interactive setup flags when bootstrapping a machine:

```bash
yarn cli setup --secret-key S... --network stellar-testnet --gateway-url http://localhost:3000 --asset USDC
```

Run quality checks:

```bash
yarn lint
yarn test
yarn check
```

Generate build metadata:

```bash
yarn build
```

Run a minimal smoke check:

```bash
yarn smoke
```

## Where To Edit

To add a new paid endpoint:

1. add a route object to `routes`, or add metadata to your endpoint catalog
2. provide its handler either inline in `routes` or via the provider `handlers` map
3. register routes through [server/provider.js](/home/kelly-musk/agentpay-server/server/provider.js)

To change how payment verification works:

- start in [server/payments.js](/home/kelly-musk/agentpay-server/server/payments.js)

To change how implementers embed AgentPay:

- start in [server/provider.js](/home/kelly-musk/agentpay-server/server/provider.js)

To change persistence or storage behavior:

- start in [server/intents.js](/home/kelly-musk/agentpay-server/server/intents.js)
- usage/analytics storage also lives in [server/logger.js](/home/kelly-musk/agentpay-server/server/logger.js)

To change the CLI signing flow:

- start in [client/payFetch.js](/home/kelly-musk/agentpay-server/client/payFetch.js)

To swap local fallback logic for Rust-backed execution:

- start in [server/handlers/shared.js](/home/kelly-musk/agentpay-server/server/handlers/shared.js)

## Environment Notes

- `WALLET_ADDRESS` is required for the merchant side.
- the preferred CLI path is secure local secret storage via `yarn cli setup`
- `STELLAR_SECRET_KEY` remains available as a fallback/dev path
- `AUTO_FUND_TESTNET_ACCOUNTS=true` is useful for local testnet demos.
- `X402_ASSET=USDC` is the primary stablecoin path now that Soroban payments work end to end.
- `X402_ASSET=native` remains the simplest fallback demo path.
- gateway and provider startup now fail fast on invalid wallet addresses, URLs,
  route methods, route pricing, and malformed storage configs.

## Request Lifecycle

1. `client/client.js` sends a request.
2. `server/server.js` returns `402` if `x-payment` is missing.
3. `client/payFetch.js` builds a Stellar payment payload and retries.
4. `server/payments.js` verifies the payload.
5. A handler in `server/handlers/` runs.
6. `server/logger.js` records the paid request.

For intent-based execution:

1. `POST /intents` creates a payable intent.
2. `POST /intents/:intentId/execute` is payment-gated.
3. [server/intents.js](/home/kelly-musk/agentpay-server/server/intents.js) records `pending`, `paid`, `executed`, or `failed`.

By default the standalone gateway uses file-backed intent storage, but
implementers can inject their own in-memory or external storage through the
provider layer.
The same pattern now applies to usage and revenue logging.

## Public Route Map

- `/` service summary
- `/health` runtime health probe
- `/capabilities` simplified machine-readable integration contract
- `/discovery/resources` x402-style resource discovery
- `/stats` usage and revenue summary
- `/ai`, `/data`, `/compute` paid business endpoints
