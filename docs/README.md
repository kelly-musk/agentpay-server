# Getting Around The Repo

This guide is the quickest way to understand where things live, what runs what,
and where to make changes when you want to extend Stellar Oxide Gateway.

## Mental Model

There are two main execution paths:

1. The gateway in [server/server.js](/home/kelly-musk/stellar-oxide-gateway-server/server/server.js)
2. The CLI payer in [client/client.js](/home/kelly-musk/stellar-oxide-gateway-server/client/client.js)

There is now also an embeddable provider layer in
[server/provider.js](/home/kelly-musk/stellar-oxide-gateway-server/server/provider.js)
that lets other developers mount Stellar Oxide Gateway routes into their own Express apps.
Intent persistence is now pluggable through
[server/intents.js](/home/kelly-musk/stellar-oxide-gateway-server/server/intents.js).

The gateway exposes paywalled routes, returns `402` payment challenges, verifies
incoming Stellar payments, executes business logic, and logs usage.

The CLI sends a request, receives the `402`, creates a signed Stellar payment,
retries with `x-payment`, and prints the final API response.

## File Map

### Root

- [index.js](/home/kelly-musk/stellar-oxide-gateway-server/index.js): root SDK entrypoint for implementers.
- [server.js](/home/kelly-musk/stellar-oxide-gateway-server/server.js): thin root entrypoint that boots the server folder.
- [client.js](/home/kelly-musk/stellar-oxide-gateway-server/client.js): thin root entrypoint that boots the client folder.
- [package.json](/home/kelly-musk/stellar-oxide-gateway-server/package.json): scripts, metadata, and dependencies.
- [README.md](/home/kelly-musk/stellar-oxide-gateway-server/README.md): product-facing project overview.
- [docs/PAID_AGENT_APIS_IMPLEMENTATION.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/PAID_AGENT_APIS_IMPLEMENTATION.md): practical guide for the currently implementable paid agent services / APIs wedge.
- [docs/INFRASTRUCTURE_ECOSYSTEM_TOOLING_IMPLEMENTATION.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/INFRASTRUCTURE_ECOSYSTEM_TOOLING_IMPLEMENTATION.md): future-facing implementation guide for the infrastructure / ecosystem tooling wedge.
- [docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md): target-state source of truth for the infrastructure/ecosystem-tooling direction.
- [docs/ROADMAP_ECOSYSTEM_TOOLING.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ROADMAP_ECOSYSTEM_TOOLING.md): roadmap derived from the architecture reference.
- [examples/express-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/express-provider.js): copyable Express integration example.
- [examples/paid-search-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-search-provider.js): paid-agent-API template for a search service.
- [examples/paid-market-data-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-market-data-provider.js): paid market/news data template.
- [examples/paid-scraper-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-scraper-provider.js): paid scraping/data extraction template.
- [examples/paid-inference-provider.js](/home/kelly-musk/stellar-oxide-gateway-server/examples/paid-inference-provider.js): paid AI inference template.

### Server

- [server/index.js](/home/kelly-musk/stellar-oxide-gateway-server/server/index.js): server-focused SDK entrypoint.
- [server/server.js](/home/kelly-musk/stellar-oxide-gateway-server/server/server.js): Express app setup, routes, and payment enforcement.
- [server/provider.js](/home/kelly-musk/stellar-oxide-gateway-server/server/provider.js): reusable provider integration layer for implementers.
- [server/payments.js](/home/kelly-musk/stellar-oxide-gateway-server/server/payments.js): x402 requirement generation, verification, settlement, and capabilities.
- [server/intents.js](/home/kelly-musk/stellar-oxide-gateway-server/server/intents.js): intent store abstractions and file, SQLite, and Postgres storage adapters.
- [server/pricing.js](/home/kelly-musk/stellar-oxide-gateway-server/server/pricing.js): endpoint catalog and dynamic pricing rules.
- [server/logger.js](/home/kelly-musk/stellar-oxide-gateway-server/server/logger.js): request logging and `/stats` aggregation.
- [server/handlers/shared.js](/home/kelly-musk/stellar-oxide-gateway-server/server/handlers/shared.js): shared business logic and Rust forwarding helper.
- [server/handlers/ai.js](/home/kelly-musk/stellar-oxide-gateway-server/server/handlers/ai.js): AI endpoint handler.
- [server/handlers/data.js](/home/kelly-musk/stellar-oxide-gateway-server/server/handlers/data.js): data endpoint handler.
- [server/handlers/compute.js](/home/kelly-musk/stellar-oxide-gateway-server/server/handlers/compute.js): compute endpoint handler.

### Client

- [client/index.js](/home/kelly-musk/stellar-oxide-gateway-server/client/index.js): client-focused SDK entrypoint.
- [client/client.js](/home/kelly-musk/stellar-oxide-gateway-server/client/client.js): CLI argument parsing and request orchestration.
- [client/lib/config.js](/home/kelly-musk/stellar-oxide-gateway-server/client/lib/config.js): persistent non-secret CLI config storage.
- [client/lib/secure-store.js](/home/kelly-musk/stellar-oxide-gateway-server/client/lib/secure-store.js): OS keychain storage for wallet secrets.
- [client/lib/payer-check.js](/home/kelly-musk/stellar-oxide-gateway-server/client/lib/payer-check.js): reusable payer readiness checks.
- [client/payFetch.js](/home/kelly-musk/stellar-oxide-gateway-server/client/payFetch.js): local Stellar payer implementation for `402 -> sign -> retry`.

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

- [scripts/lint.mjs](/home/kelly-musk/stellar-oxide-gateway-server/scripts/lint.mjs): syntax and lightweight style checks.
- [scripts/build.mjs](/home/kelly-musk/stellar-oxide-gateway-server/scripts/build.mjs): quality-gated build step that writes `dist/manifest.json`.
- [scripts/smoke.mjs](/home/kelly-musk/stellar-oxide-gateway-server/scripts/smoke.mjs): tiny repo sanity check.
- [tests/pricing.test.mjs](/home/kelly-musk/stellar-oxide-gateway-server/tests/pricing.test.mjs): pricing unit tests.
- [tests/payments.test.mjs](/home/kelly-musk/stellar-oxide-gateway-server/tests/payments.test.mjs): payment requirement unit tests.

## Common Tasks

Run the gateway:

```bash
X402_ASSET=USDC yarn start
```

Mount Stellar Oxide Gateway into another Express app:

```js
import express from "express";
import { registerStellarOxideGatewayRoutes } from "stellar-oxide-gateway";
```

Import server/client helpers from stable SDK paths:

```js
import { NETWORK_IDS } from "stellar-oxide-gateway";
import { createPaymentContext } from "stellar-oxide-gateway/server";
import { payFetch } from "stellar-oxide-gateway/client";
```

Run provider or gateway config through the fail-fast validators:

```js
import {
  NETWORK_IDS,
  SUPPORTED_NETWORK_IDS,
  isSupportedNetworkId,
  validateGatewayConfig,
  validateProviderOptions,
} from "stellar-oxide-gateway/server";
```

`NETWORK_IDS` includes the broader future identifier space. Use
`SUPPORTED_NETWORK_IDS` or `isSupportedNetworkId(...)` when you need to check
what this package actually supports at runtime today.

Use the simpler declarative route API:

```js
registerStellarOxideGatewayRoutes(app, {
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

Add route-level policy hooks when implementers need more than a static price:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
      priceUsd: "0.05",
      pricing: ({ query }) => (query.length > 20 ? "0.07" : "0.05"),
      shouldRequirePayment: ({ req }) => req.headers["x-plan"] !== "pro",
      paymentMetadata: ({ req }) => ({
        tenantId: req.headers["x-tenant-id"],
      }),
      handler: async (gatewayConfig, query) => ({ summary: query }),
    },
  ],
});
```

Those policy hooks now flow into intents as well. Intent creation stores the
resolved price, payment-required decision, and metadata so intent execution uses
the same policy outcome later.

Provider and gateway network selection are explicit. For implementer-facing
server integration, do not rely on a silent testnet default. Set
`config.network` or `X402_NETWORK` directly.

Or protect an existing upstream API directly:

```js
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [
    {
      method: "POST",
      path: "/summarize",
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

Inject a custom intent store:

```js
import { createIntentStore, createMemoryIntentStorage } from "stellar-oxide-gateway";
```

Or select SQLite-backed intent storage:

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

Or select Postgres-backed storage for production persistence:

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

If the merchant backend should automatically create the payee trustline for a
classic Stellar asset, set these server-side env vars:

```bash
AUTO_CREATE_PAYEE_TRUSTLINE=true
MERCHANT_WALLET_SECRET_KEY=<merchant/payee stellar secret key>
MERCHANT_CLASSIC_ASSET=USDC
```

For a custom classic asset that is not in the built-in registry:

```bash
MERCHANT_ASSET_CODE=<classic asset code>
MERCHANT_ASSET_ISSUER=<classic stellar issuer address>
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
3. register routes through [server/provider.js](/home/kelly-musk/stellar-oxide-gateway-server/server/provider.js)

To change how payment verification works:

- start in [server/payments.js](/home/kelly-musk/stellar-oxide-gateway-server/server/payments.js)

To change how implementers embed Stellar Oxide Gateway:

- start in [server/provider.js](/home/kelly-musk/stellar-oxide-gateway-server/server/provider.js)

To change persistence or storage behavior:

- start in [server/intents.js](/home/kelly-musk/stellar-oxide-gateway-server/server/intents.js)
- usage/analytics storage also lives in [server/logger.js](/home/kelly-musk/stellar-oxide-gateway-server/server/logger.js)

To change the CLI signing flow:

- start in [client/payFetch.js](/home/kelly-musk/stellar-oxide-gateway-server/client/payFetch.js)

To swap local fallback logic for Rust-backed execution:

- start in [server/handlers/shared.js](/home/kelly-musk/stellar-oxide-gateway-server/server/handlers/shared.js)

## Environment Notes

- `WALLET_ADDRESS` is required for the merchant side.
- `X402_NETWORK` is required for gateway/provider startup unless you pass
  `config.network` directly in code.
- the preferred CLI path is secure local secret storage via `yarn cli setup`
- `STELLAR_SECRET_KEY` remains available as a fallback/dev path
- `AUTO_FUND_TESTNET_ACCOUNTS=true` is useful for local testnet demos.
- `X402_ASSET=USDC` is the primary stablecoin path now that Soroban payments work end to end.
- `X402_ASSET=native` remains the simplest fallback demo path.
- gateway and provider startup now fail fast on invalid wallet addresses, URLs,
  route methods, route pricing, and malformed storage configs.
- Postgres-backed storage requires the `pg` runtime dependency and a valid
  `connectionString` if you are not injecting your own query client.

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
3. [server/intents.js](/home/kelly-musk/stellar-oxide-gateway-server/server/intents.js) records `pending`, `paid`, `executed`, or `failed`.

By default the standalone gateway uses file-backed intent storage, but
implementers can inject their own in-memory, SQLite, or Postgres-backed storage
through the provider layer. The same pattern now applies to usage and revenue
logging.

## Public Route Map

- `/` service summary
- `/health` runtime health probe
- `/ready` readiness probe with storage backend status
- `/capabilities` simplified machine-readable integration contract
- `/discovery/resources` x402-style resource discovery
- `/stats` usage and revenue summary
- `/ai`, `/data`, `/compute` paid business endpoints
