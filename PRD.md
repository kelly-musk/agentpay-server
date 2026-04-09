# Stellar Oxide Gateway — Product Requirements Document

**Version:** 1.0  
**Date:** April 9, 2026  
**Status:** Implemented (Core) / In Progress (Ecosystem)  
**Category:** Infrastructure / Paid Agent Services & APIs  
**Hackathon Alignment:** Stellar x402 Hackathon — Paid Agent Services, Infrastructure & Ecosystem Tooling

---

## Executive Summary

Stellar Oxide Gateway is agent-native API monetization infrastructure built on Stellar. It transforms any HTTP endpoint into a pay-per-request service using x402-style payment challenges, Stellar-based settlement, and machine-readable responses designed for autonomous agents and programmatic consumers.

Unlike traditional API monetization approaches that rely on API keys, subscriptions, or centralized billing systems, Stellar Oxide Gateway enables direct machine-to-machine payments at the protocol level. Callers pay only when they use a service, with payments verified and settled on-chain in real-time.

The platform is designed as embeddable infrastructure rather than a standalone application. Developers can either deploy Stellar Oxide Gateway as a standalone gateway or integrate it directly into their existing Express applications as middleware, making it suitable for a wide range of use cases from AI inference APIs to data services and compute platforms.

**Product Evolution:**

Stellar Oxide Gateway is evolving from a payment gateway into a full ecosystem infrastructure layer:

- **Current State (✅ Implemented):** Paid agent services / APIs wedge — Provider SDK, payment gateway, route protection, intent flows, storage backends, client SDK
- **Next Phase (🚧 In Progress):** Infrastructure / ecosystem tooling wedge — Service publishing, discovery, registry compatibility, consumer resolution, trust foundations
- **Future Vision (🔮 Planned):** Full ecosystem layer — Bazaar marketplace, reputation systems, multi-chain support, privacy pools, DeFi integrations

**Key Value Propositions:**

- **Zero setup friction** — No API key provisioning, no subscription management, no billing infrastructure
- **Agent-native** — Machine-readable payment requirements, structured receipts, automatic retry logic
- **Embeddable** — Mounts inside existing Express apps or runs standalone
- **Blockchain-verified** — Every payment is cryptographically verified and settled on Stellar
- **Ecosystem-ready** — Versioned manifests, discovery surfaces, registry export, consumer resolution
- **Production-shaped** — Multiple storage backends, health checks, graceful shutdown, comprehensive test coverage

---

## Problem Statement

### Current State

Developers building APIs for agents and automated systems face significant friction in monetization:

1. **API Keys** require out-of-band provisioning, manual distribution, and centralized key management
2. **Subscriptions** don't align with per-request agent workflows where usage is unpredictable
3. **Payment processors** add latency, fees, and compliance overhead
4. **No standard protocol** exists for machine-to-machine HTTP payments
5. **No discovery layer** — Agents cannot programmatically find and evaluate paid services
6. **No ecosystem infrastructure** — Each provider builds custom billing, discovery, and integration

### Pain Points

**For API Providers:**
- Building billing infrastructure is expensive and time-consuming
- Managing API keys and rate limits requires custom tooling
- Payment reconciliation across multiple consumers is manual
- No visibility into real-time revenue per endpoint
- No standard way to publish services for agent discovery
- No ecosystem tooling for service listing or reputation

**For API Consumers (Agents):**
- Acquiring API access requires human intervention
- Subscription costs are wasted when usage is sporadic
- No programmatic way to discover and pay for services
- Trust requires centralized intermediaries
- No standard contract for service metadata, pricing, or schemas
- Each provider has custom integration requirements

**For Ecosystem Builders (Registries, Marketplaces, Platforms):**
- No standard format for ingesting service metadata
- No compatibility layer for indexing providers
- No trust or reputation primitives
- No versioned contracts for ecosystem tooling

### Market Opportunity

The Stellar x402 Hackathon categories explicitly call out:

**1. Paid agent services / APIs** (✅ Current Strength)
- Pay-per-token AI inference
- Pay-per-query search
- Financial market data
- Trading signals
- Web scraping / data collection
- Real-time news feeds
- Security vulnerability scanning
- Blockchain indexing

**2. Infrastructure / ecosystem tooling** (🚧 Next Phase)
- Bazaar-style discoverability for x402 services
- Bazaar-enabled Stellar facilitator
- Mainnet-ready facilitator infrastructure
- Service listing and discovery

**3. Agent wallets, coordination, and commerce** (🔮 Future)
- Agent wallet integrations
- Agent-to-agent communication and payments
- Agent marketplaces / service discovery
- Rating, reputation, and trust systems

**Concrete Demand Signal:**
The hackathon specifically highlights "pay-per-query web search instead of monthly subscriptions" as a real user pain point. Stellar Oxide Gateway's `examples/paid-search-provider.js` directly addresses this use case.

Stellar Oxide Gateway is strongest in category 1, provides foundational infrastructure for category 2, and creates the primitives needed for category 3.

---

## Solution Overview

### Core Concept

Stellar Oxide Gateway implements the x402 payment protocol on Stellar with a two-layer architecture:

**Layer 1: Paid Agent Services / APIs (✅ Implemented)**

The foundation layer that enables pay-per-request APIs:

```
1. Agent calls protected endpoint
2. Gateway returns 402 Payment Required with machine-readable requirements
3. Agent signs Stellar payment transaction
4. Agent retries request with x-payment header
5. Gateway verifies payment locally (no third-party round-trip)
6. Gateway settles payment on Stellar blockchain
7. Gateway returns protected resource + structured receipt
```

**Layer 2: Infrastructure / Ecosystem Tooling (🚧 In Progress)**

The ecosystem layer that enables service publishing, discovery, and trust:

```
Provider publishes service metadata
        ↓
Service becomes discoverable via manifest + registry export
        ↓
Agents/platforms resolve service metadata programmatically
        ↓
Consumers select compatible services by category/network/asset
        ↓
Ecosystem tools (registries, bazaars, marketplaces) index services
        ↓
Trust and reputation signals emerge over time
```

### Product Evolution Path

**Phase 1: Core Infrastructure (✅ Complete)**
- x402 payment flow on Stellar
- Provider SDK with route registration
- Intent-based execution
- Multiple storage backends (memory, file, SQLite, Postgres)
- Service discovery surfaces (capabilities, discovery, manifest, registry export)
- Client SDK with payFetch and service resolution

**Phase 2: Ecosystem Tooling (🚧 Current Focus)**
- Versioned provider manifest at `/.well-known/stellar-oxide-gateway.json`
- Registry-friendly export at `/registry/export` with filtering
- Consumer-side service resolution (`resolveStellarOxideGatewayService`, `selectStellarOxideGatewayRoute`)
- Explicit contract versioning for all public surfaces
- Provider and service identity metadata
- Trust foundations (reserved fields for signatures, reputation)

**Phase 3: Advanced Features (🔮 Planned)**
- Bazaar-style marketplace UI
- Registry crawler and indexer
- Provider reputation system
- Consumer wallet-connect flow for browsers
- Mainnet facilitator infrastructure
- Privacy pools for x402 payments
- Batched settlement for efficiency
- Multi-chain support (Base, Solana)
- Prompt injection defenses
- Sandboxed execution for untrusted handlers
- DeFi integrations for automated treasury management

---

## Roles and Actors

### Implementer (Provider)

The implementer is the provider of the paid API.

**Examples:**
- A startup exposing search
- A data provider exposing market data
- An AI product exposing inference
- A platform exposing a paid internal tool

**Responsibilities:**
- Integrate Stellar Oxide Gateway into their service
- Configure protected routes with metadata
- Set pricing (static or dynamic)
- Provide merchant wallet
- Define backend handler or upstream proxy
- Publish provider and service identity

### Consumer

The consumer is the caller of the API.

**Examples:**
- An agent framework
- A backend service
- A platform server
- A frontend with wallet-based payment

**Responsibilities:**
- Discover compatible services
- Handle 402 challenges
- Sign and submit payments
- Parse receipts and responses

### Ecosystem Builder

Registries, bazaars, marketplaces, and platforms.

**Responsibilities:**
- Index services from manifest + registry export
- Filter and rank by compatibility
- Display provider metadata
- Enable trust and reputation signals (future)

---

## Integration Modes

### Mode 1: Standalone Gateway

Deploy Stellar Oxide Gateway as its own service that sits in front of backend APIs.

**Best for:**
- Hosted gateway deployments
- Reverse-proxy style monetization
- Simpler standalone operator flow
- Adding payment gating to existing services without code changes

### Mode 2: Embedded Provider

Mount Stellar Oxide Gateway routes directly inside an Express application using `registerStellarOxideGatewayRoutes(app, options)`.

**Best for:**
- Existing APIs
- App teams
- Product integrations
- Tighter integration and shared application context

---

## Payment Models

### Service-Paid Flow (Backend Wallet)

**Best for:** Agents, server-to-server usage, platform-sponsored usage

**Flow:**
1. Backend calls endpoint
2. Receives 402
3. Backend signs payment with service wallet
4. Backend retries with x-payment
5. Response is returned

**Security:**
- Backend/service wallet secrets belong in env vars or secret manager
- Never in frontend browser code

### User-Paid Flow (Wallet-Connect)

**Best for:** Consumer-facing apps, direct end-user payment flows, wallet-native agent products

**Flow:**
1. Frontend calls endpoint
2. Receives 402
3. User wallet signs payment
4. Frontend retries with x-payment
5. Response is returned

**Security:**
- Use wallet-connect style integrations
- Do not put raw private keys in frontend/browser env

---

## Functional Requirements

### FR-1: Payment Challenge Generation

**Description:** When a caller requests a protected endpoint without payment, the gateway must return a 402 status with machine-readable payment requirements.

**Acceptance Criteria:**
- Response status is 402 Payment Required
- Response includes `accepts` array with payment requirements
- Requirements include: `payTo` (merchant wallet), `maxAmountRequired` (in base units), `asset` (address), `resource` (URL), `scheme` ("exact")
- Requirements include endpoint metadata: `description`, `category`, `billingUnit`, `audience`, `tags`, `useCases`
- Optional `inputSchema` and `outputSchema` for agent integration

**Implementation Status:** ✅ Implemented  
**Location:** `server/provider.js` — `registerDirectEndpointRoutes()`, `requirePaymentWith()`

---

### FR-2: Payment Verification

**Description:** The gateway must verify signed Stellar payment payloads locally without requiring a third-party verification service.

**Acceptance Criteria:**
- Accepts payment payload in `x-payment` header (base64-encoded JSON)
- Verifies network matches configured network
- Verifies destination matches merchant wallet
- Verifies amount matches required amount
- Verifies asset matches required asset
- Verifies transaction is signed
- Verifies transaction has not been used before (nonce check)
- Verifies transaction has not expired (ledger bounds check)
- Supports both native XLM and Soroban token transfers

**Implementation Status:** ✅ Implemented  
**Location:** `server/payments.js` — `verifyNativePayment()`, `verifyContractPayment()`

---

### FR-3: Payment Settlement

**Description:** After verification, the gateway must submit the signed transaction to Stellar and return a structured receipt.

**Acceptance Criteria:**
- Submits native payments to Horizon
- Submits Soroban contract calls to RPC
- Returns transaction hash
- Returns ledger number and close time
- Returns payer and payee addresses
- Returns amount in both display units and base units
- Returns explorer URLs for transaction and accounts
- Includes receipt version for forward compatibility

**Implementation Status:** ✅ Implemented  
**Location:** `server/payments.js` — `settleNativePayment()`, `settleContractPayment()`, `createPaymentReceipt()`

---

### FR-4: Intent-Based Execution

**Description:** Support a two-phase flow where callers create a payment intent before committing payment.

**Acceptance Criteria:**
- `POST /intents` creates intent with endpoint and query
- Returns intent ID and payment requirements
- `POST /intents/:id/execute` executes behind x402 payment gate
- Intent lifecycle: `pending → paid → executed` (or `failed`)
- Intent stores policy evaluation result (price, metadata, paywall decision)
- Execution follows stored policy (no re-evaluation)

**Implementation Status:** ✅ Implemented  
**Location:** `server/provider.js` — `registerPublicRoutes()`, `registerIntentExecutionRoutes()`

---

### FR-5: Dynamic Pricing and Policies

**Description:** Routes must support dynamic pricing, conditional paywalling, and custom payment metadata.

**Acceptance Criteria:**
- `pricing` function receives `{ req, query, config, endpoint }` and returns price USD
- `shouldRequirePayment` function or boolean controls paywall per request
- `paymentMetadata` function or object adds custom fields to receipt
- Policy evaluation happens once per request (or intent creation)
- Policy result is stored on intent for execution phase

**Implementation Status:** ✅ Implemented  
**Location:** `server/provider.js` — `evaluateEndpointPolicy()`, `evaluateIntentPolicy()`

---

### FR-6: Upstream Proxying

**Description:** Routes without local handlers must proxy to upstream APIs.

**Acceptance Criteria:**
- Route config accepts `upstream: { url, headers }`
- Gateway forwards request body plus `query`, `endpoint`, `path`, `intentId`
- Gateway returns upstream response as result
- Payment verification happens before proxying

**Implementation Status:** ✅ Implemented  
**Location:** `server/handlers/shared.js` — `createUpstreamHandler()`

---

### FR-7: Storage Abstraction

**Description:** Intent and usage data must be persistable across multiple backend types.

**Acceptance Criteria:**
- Supports memory, file, SQLite, and Postgres storage
- All backends implement `healthCheck()` and `close()`
- Postgres adapters lazy-initialize and auto-create tables
- Storage failures return 503 for dependency errors
- Storage is injectable via provider options

**Implementation Status:** ✅ Implemented  
**Location:** `server/intents.js`, `server/logger.js`, `server/postgres.js`

---

### FR-8: Service Discovery

**Description:** Providers must expose machine-readable metadata for ecosystem tooling, registries, and agent platforms.

**Acceptance Criteria:**
- `GET /.well-known/stellar-oxide-gateway.json` returns versioned manifest
- `GET /registry/export` returns flattened listing with filters
- `GET /capabilities` returns endpoint catalog with payment metadata
- `GET /discovery/resources` returns paginated resource list
- All surfaces include provider and service metadata
- Registry export supports `?category=`, `?tag=`, `?audience=` filters

**Implementation Status:** ✅ Implemented  
**Location:** `server/provider.js` — `registerPublicRoutes()`, `server/payments.js` — `createPaymentContext()`

---

### FR-9: Client SDK

**Description:** Consumers need a drop-in client that handles the full 402 → sign → retry flow automatically.

**Acceptance Criteria:**
- `payFetch(url, options)` wraps standard fetch
- Detects 402 response
- Builds and signs Stellar payment
- Retries with `x-payment` header
- Returns final response
- Supports both native XLM and Soroban tokens
- Auto-funds testnet accounts in demo mode

**Implementation Status:** ✅ Implemented  
**Location:** `client/payFetch.js`

---

### FR-10: Service Resolution

**Description:** Consumers need programmatic discovery of Stellar Oxide Gateway services.

**Acceptance Criteria:**
- `resolveStellarOxideGatewayService(baseUrl)` fetches all discovery surfaces
- Returns manifest, capabilities, registry, discovery in parallel
- `selectStellarOxideGatewayRoute(service, criteria)` filters routes by id, category, method, tag, audience
- Supports filtering at resolution time via options

**Implementation Status:** ✅ Implemented  
**Location:** `client/lib/service-resolution.js`

---

### FR-11: Operational Readiness

**Description:** Providers must expose health and readiness probes for production deployment.

**Acceptance Criteria:**
- `GET /health` returns liveness status
- `GET /ready` returns readiness status with storage health checks
- Returns 503 if any storage backend is unhealthy
- Provider exposes `getReadinessReport()` for programmatic checks
- Provider exposes `close()` for graceful shutdown

**Implementation Status:** ✅ Implemented  
**Location:** `server/provider.js` — `createStellarOxideGatewayProvider()`

---

### FR-12: Usage Analytics

**Description:** Providers must log requests and expose aggregated revenue stats.

**Acceptance Criteria:**
- Every request is logged with endpoint, query, timestamp, payment, intentId, flow
- `GET /stats` returns total requests and total revenue
- Stats are computed from configured usage store
- Supports all storage backends

**Implementation Status:** ✅ Implemented  
**Location:** `server/logger.js`, `server/provider.js`

---

## Recommended Route Shape for Paid Agent APIs

To be useful to agents and developers, a paid route should define:

```javascript
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

**Without this metadata**, a route is only protected. **With this metadata**, it becomes a discoverable agent service.

---

## Design Rules for Good Paid Agent APIs

### 1. Prefer structured responses

Agents should receive objects, arrays, and typed fields. Avoid vague strings only or human-only formatting.

### 2. Make billing legible

Include billing unit, price basis, and dynamic pricing hints if relevant.

### 3. Expose schemas

Agents and developers should be able to discover what to send and what comes back.

### 4. Keep service semantics clear

A route should say what it does (search, inference, scrape, compute, market data), not just generic terms (tool, execute, query).

### 5. Return receipts

Paid APIs should return real payment confirmation data for reconciliation, debugging, and downstream automation.

---

## Non-Functional Requirements

### NFR-1: Performance

- Payment verification must complete in <100ms for native payments
- Payment verification must complete in <500ms for Soroban payments
- Storage operations must not block request handling
- Postgres adapters must use connection pooling

**Status:** ✅ Implemented (connection pooling via `pg` package)

### NFR-2: Security

- Private keys must never be logged or exposed in responses
- Nonce reuse must be prevented (in-memory set)
- Transaction expiry must be enforced (ledger bounds check)
- Payment amounts must be verified in base units (no floating point)
- SQL injection must be prevented (parameterized queries)
- Postgres identifiers must be validated (alphanumeric + underscore only)

**Status:** ✅ Implemented

### NFR-3: Reliability

- Storage failures must return 503 (not 500)
- Intent execution must be idempotent (status check before execution)
- Concurrent intent execution must be prevented (in-memory lock)
- Settlement failures must not block response (logged, returned in receipt)

**Status:** ✅ Implemented

### NFR-4: Observability

- All errors must include actionable messages
- Payment verification failures must include specific reason codes
- Readiness checks must report per-backend status
- Usage logs must include flow type (direct vs intent)

**Status:** ✅ Implemented

---

## Technical Specifications

### Supported Networks

| Network ID | Stellar Network | Status |
|---|---|---|
| `stellar-testnet` | Testnet | ✅ Supported |
| `stellar` | Mainnet | ✅ Supported |
| `base-sepolia` | Base Sepolia | 🔮 Future |
| `base` | Base Mainnet | 🔮 Future |
| `solana-devnet` | Solana Devnet | 🔮 Future |

### Supported Assets

| Asset Type | Example | Verification Method |
|---|---|---|
| Native XLM | `"native"` | Horizon payment operation |
| Soroban Token | `"C..."` (contract address) | RPC contract call simulation |
| USDC (testnet) | Built-in registry | Soroban transfer |

### Storage Backends

| Type | Use Case | Initialization | Health Check |
|---|---|---|---|
| `memory` | Testing, ephemeral | Immediate | Always healthy |
| `file` | Single-process, simple | Immediate | File access check |
| `sqlite` | Local persistent | Auto-create tables | SELECT 1 query |
| `postgres` | Production | Lazy init + auto-create | SELECT 1 query |

### Contract Versions

All public discovery surfaces are versioned:

```javascript
CONTRACT_VERSIONS = {
  RECEIPT: "1.0.0",
  CAPABILITIES: "1.0.0",
  MANIFEST: "1.0.0",
  REGISTRY_EXPORT: "1.0.0",
  DISCOVERY: "1.0.0"
}
```

---

## Configuration

### Required Environment Variables

```bash
X402_NETWORK=stellar-testnet          # or stellar
WALLET_ADDRESS=G...                   # Merchant public key
```

### Optional Environment Variables

```bash
PORT=3000
GATEWAY_URL=http://localhost:3000
FACILITATOR_URL=https://facilitator.stellar-x402.org
X402_ASSET=USDC                       # or native, or C... contract address
X402_ASSET_SYMBOL=TOKEN               # For custom tokens
X402_ASSET_DECIMALS=7                 # For custom tokens
X402_ASSET_NAME=Custom Token          # For custom tokens

# Payer (client-side)
STELLAR_SECRET_KEY=S...               # Payer secret key
AUTO_FUND_TESTNET_ACCOUNTS=true       # Auto-fund in demo mode

# Merchant trustline auto-setup
AUTO_CREATE_PAYEE_TRUSTLINE=true
MERCHANT_WALLET_SECRET_KEY=S...       # Merchant secret for trustline
MERCHANT_CLASSIC_ASSET=USDC           # Or custom asset below
MERCHANT_ASSET_CODE=MYTOKEN
MERCHANT_ASSET_ISSUER=G...
```

---

## Use Cases

### Use Case 1: Paid Search API for Agents

**Actor:** Research agent  
**Goal:** Pay per query for web search results

**Flow:**
1. Agent calls `POST /search` with query
2. Gateway returns 402 with $0.05 requirement
3. Agent signs payment from service wallet
4. Agent retries with x-payment header
5. Gateway verifies, settles, returns search results + receipt
6. Agent logs receipt for accounting

**Template:** `examples/paid-search-provider.js`

---

### Use Case 2: Pay-Per-Token AI Inference

**Actor:** AI agent platform  
**Goal:** Charge per inference request with dynamic pricing based on model size

**Flow:**
1. Platform mounts Stellar Oxide Gateway routes for `/inference`
2. Route uses `pricing` function to calculate cost based on model parameter
3. Caller creates intent with model and prompt
4. Caller pays against intent
5. Platform executes inference and returns result

**Template:** `examples/paid-inference-provider.js`

---

### Use Case 3: Freemium API with Conditional Paywall

**Actor:** SaaS platform  
**Goal:** Free tier for pro users, paid for free users

**Flow:**
1. Platform checks `x-plan` header in `shouldRequirePayment`
2. Pro users bypass payment
3. Free users receive 402 and must pay
4. Payment metadata includes tenant ID for accounting

---

### Use Case 4: Market Data Provider

**Actor:** Financial data provider  
**Goal:** Monetize real-time market data per query

**Flow:**
1. Provider exposes `/market-data` endpoint
2. Dynamic pricing based on data freshness and asset type
3. Agents pay per query
4. Provider returns structured market data + receipt

**Template:** `examples/paid-market-data-provider.js`

---

### Use Case 5: Web Scraping Service

**Actor:** Data extraction service  
**Goal:** Charge per scraping job

**Flow:**
1. Service exposes `/scrape` endpoint
2. Pricing based on target URL complexity
3. Agents submit scraping requests with payment
4. Service returns extracted data + receipt

**Template:** `examples/paid-scraper-provider.js`

---

## Success Metrics

### Provider Metrics

- Number of protected routes registered
- Total requests per endpoint
- Total revenue per endpoint
- Average price per request
- Payment verification success rate
- Settlement success rate
- Storage health uptime

### Consumer Metrics

- 402 challenge response time
- Payment signing time
- End-to-end request latency
- Payment failure rate
- Service discovery success rate

### Ecosystem Metrics

- Number of providers publishing manifests
- Number of routes in registry exports
- Number of consumers using service resolution
- Cross-provider payment volume

---

## Production Readiness Status

### Current State

- **Development/staging quality** — Strong local validation and unit/integration tests
- **Not yet sufficient for:** Production deployment with high confidence

### Priority Work for Production

**Priority 1: End-to-End Integration**
- Add HTTP integration tests against running Express app
- Test real `402 -> pay -> retry -> verify -> settle -> response` flow
- Cover all public endpoints

**Priority 2: Database and Storage Confidence**
- Add real Postgres integration tests
- Verify schema creation, reads, writes, updates, shutdown
- Add degraded-dependency tests

**Priority 3: Payment and Blockchain Confidence**
- Add staging tests with real Stellar testnet payments
- Validate settlement receipt contents against live chain data
- Test native XLM and Soroban token paths

**Priority 4: Security Hardening**
- Review payment verification for tampering opportunities
- Add abuse tests (replay, duplicate execution, malformed headers)
- Add request/body size limits

**Priority 5: Concurrency and Race Conditions**
- Test simultaneous execution of same intent
- Add concurrent paid-route request tests
- Add shutdown-during-request tests

---

## Future Roadmap

### Phase 1: Core Infrastructure (✅ Complete)
- x402 payment flow on Stellar
- Provider SDK with route registration
- Intent-based execution
- Multiple storage backends
- Service discovery surfaces
- Client SDK with payFetch

### Phase 2: Ecosystem Tooling (🚧 In Progress)
- Versioned provider manifest
- Registry-friendly export with filtering
- Consumer-side service resolution
- Provider and service identity metadata
- Trust foundations

### Phase 3: Advanced Features (🔮 Planned)
- Bazaar-style marketplace UI
- Registry crawler and indexer
- Provider reputation system
- Consumer wallet-connect flow for browsers
- Mainnet facilitator infrastructure
- Privacy pools for x402 payments
- Batched settlement
- Multi-chain support (Base, Solana)
- Prompt injection defenses
- Sandboxed execution
- DeFi integrations

---

## Appendix A: Default Endpoints

Stellar Oxide Gateway includes three built-in endpoints for demonstration:

| Endpoint | Method | Path | Category | Base Price | Description |
|---|---|---|---|---|---|
| ai | GET | /ai | ai-inference | $0.02 | AI-related queries |
| data | GET | /data | data-api | $0.01 | Dataset queries |
| compute | GET | /compute | compute | $0.03 | Processing tasks |

All default endpoints add a $0.01 surcharge for queries over 20 characters.

---

## Appendix B: Package Exports

```javascript
// Main package
import {
  registerStellarOxideGatewayRoutes,
  createStellarOxideGatewayApp,
  createStellarOxideGatewayProvider,
  validateProviderOptions,
  NETWORK_IDS,
  SUPPORTED_NETWORK_IDS,
  isSupportedNetworkId,
  CONTRACT_VERSIONS,
  payFetch,
  resolveStellarOxideGatewayService,
  selectStellarOxideGatewayRoute
} from "stellar-oxide-gateway";

// Server utilities
import {
  createPaymentContext,
  loadGatewayConfig,
  validateGatewayConfig,
  requirePayment,
  requirePaymentWith,
  createIntentStore,
  createUsageStore
} from "stellar-oxide-gateway/server";

// Pricing utilities
import { getPriceUsd } from "stellar-oxide-gateway/pricing";

// Client utilities
import {
  payFetch,
  fetchStellarOxideGatewayManifest,
  fetchStellarOxideGatewayCapabilities,
  fetchStellarOxideGatewayRegistryExport,
  fetchStellarOxideGatewayDiscovery
} from "stellar-oxide-gateway/client";
```

---

## Appendix C: Testing

### Unit Tests
- Config validation
- Payment verification (native and Soroban)
- Pricing calculation
- Storage adapters
- Service resolution

**Command:** `yarn test`

### Production Tests
- Live Stellar testnet payments
- Real 402 challenge generation
- Real payment verification and settlement
- Horizon transaction validation
- Auto-funded ephemeral payer accounts

**Command:** `yarn test:production`

### Smoke Tests
- Gateway startup
- Health and readiness probes
- Basic request flow

**Command:** `yarn smoke`

---

## Appendix D: Deployment Checklist

**Pre-deployment:**
- [ ] Set `X402_NETWORK` to target network
- [ ] Set `WALLET_ADDRESS` to funded merchant wallet
- [ ] Configure `X402_ASSET` (native or USDC)
- [ ] Set up Postgres database (if using)
- [ ] Configure `DATABASE_URL` connection string
- [ ] Test merchant wallet can receive payments
- [ ] Run `yarn test:production` on testnet

**Deployment:**
- [ ] Deploy with `PORT` and `GATEWAY_URL` configured
- [ ] Verify `GET /health` returns 200
- [ ] Verify `GET /ready` returns 200
- [ ] Test 402 challenge generation
- [ ] Test payment verification with test wallet
- [ ] Monitor settlement success rate

**Post-deployment:**
- [ ] Publish manifest at `/.well-known/stellar-oxide-gateway.json`
- [ ] Submit registry export to ecosystem directories
- [ ] Monitor `GET /stats` for usage
- [ ] Set up alerts for storage health failures
- [ ] Document service in provider metadata

---

## Appendix E: Paid Agent API Templates

Stellar Oxide Gateway provides four first-class templates for common paid agent services:

### 1. Paid Search Provider
**File:** `examples/paid-search-provider.js`  
**Use Case:** Pay-per-query web search for research agents and workflow enrichment  
**Features:** Dynamic pricing by query complexity, structured search results, agent-friendly schemas

### 2. Paid Market Data Provider
**File:** `examples/paid-market-data-provider.js`  
**Use Case:** Real-time financial market data, trading signals, news feeds  
**Features:** Per-query billing, asset-specific pricing, structured market data responses

### 3. Paid Scraper Provider
**File:** `examples/paid-scraper-provider.js`  
**Use Case:** Web scraping, data extraction, content collection  
**Features:** URL-based pricing, extraction result schemas, agent-consumable output

### 4. Paid Inference Provider
**File:** `examples/paid-inference-provider.js`  
**Use Case:** AI inference, summarization, generation  
**Features:** Model-based pricing, token counting, structured AI responses

---

**End of Document**
