# Stellar Oxide Gateway - Stellar x402 Hackathon Submission

> **Agent-native API monetization infrastructure on Stellar blockchain**

**Stellar Oxide Gateway turns APIs into pay-per-request services on Stellar blockchain. No API keys, subscriptions, or billing—autonomous agents discover, pay on-chain, and consume instantly. Drop-in middleware with x402 protocol for frictionless monetization.**

---

## 🎯 Hackathon Categories

This project targets **two primary categories** in the Stellar x402 Hackathon:

### 1. **Paid Agent Services / APIs** ✅ (Primary - Fully Implemented)
- Pay-per-token AI inference
- Pay-per-query search
- Financial market data APIs
- Web scraping / data collection
- Real-time news feeds
- Blockchain indexing

### 2. **Infrastructure / Ecosystem Tooling** 🚧 (Secondary - In Progress)
- Bazaar-style discoverability for x402 services
- Service listing and discovery infrastructure
- Provider manifest and registry export endpoints
- Agent-to-agent service resolution

---

## 🚀 What Problem Does This Solve?

### The Problem
Traditional API monetization is broken:
- **API keys leak** and require manual provisioning
- **Subscriptions create friction** for one-time or sporadic usage
- **Billing infrastructure is complex** and expensive to build
- **Autonomous agents can't self-onboard** without human intervention
- **Pay-per-use is impossible** with traditional payment rails

### The Solution
Stellar Oxide Gateway enables **protocol-level API monetization**:
- ✅ **Zero setup friction** - No API key provisioning, no account creation
- ✅ **Pay only for what you use** - Per-request billing on Stellar blockchain
- ✅ **Agent-native** - Machines pay machines directly, no human in the loop
- ✅ **Instant settlement** - Payments verified and settled on-chain in real-time
- ✅ **Embeddable infrastructure** - Drop into any Express app as middleware

---

## 💡 Innovation & Uniqueness

### What Makes This Different?

**Most x402 demos monetize a single app feature.** Stellar Oxide Gateway is different:

1. **Infrastructure, not just an app** - Reusable payment layer for ANY service
2. **Embeddable SDK** - Developers integrate it into their own apps
3. **Two deployment modes**:
   - Standalone gateway (hosted service)
   - Embedded provider (middleware in your Express app)
4. **Production-ready** - Real storage backends (Postgres, SQLite), health checks, graceful shutdown
5. **Agent-first design** - Machine-readable payment requirements, structured receipts, automatic retry logic

### Technical Innovation

- **x402 protocol implementation** on Stellar with native XLM and USDC support
- **Intent-based execution flow** - Create payment intent, pay, execute atomically
- **Policy-driven pricing** - Dynamic pricing, conditional paywalls, custom metadata
- **Upstream proxy mode** - Sit in front of existing APIs without code changes
- **Versioned ecosystem contracts** - Manifest, capabilities, discovery, registry export
- **Multi-storage backends** - Memory, file, SQLite, Postgres with health monitoring

---

## 🏗️ Architecture

### High-Level Flow

```
Agent/CLI → Protected Endpoint → 402 Challenge → Sign Payment → Retry with x-payment
                                                                         ↓
                                                              Verify → Settle → Execute
```

### Product Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTER SIDE                           │
│  Developer integrates Stellar Oxide Gateway into:               │
│  • Paid API service                                             │
│  • Protocol service                                             │
│  • SaaS backend                                                 │
│  • Agent platform                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STELLAR OXIDE GATEWAY LAYER                        │
│  • Returns 402 payment challenge                                │
│  • Exposes payment requirements                                 │
│  • Verifies x-payment                                           │
│  • Settles Stellar transaction                                  │
│  • Unlocks backend resource                                     │
│  • Logs usage and revenue                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
          Frontend Consumer      Backend Consumer
          (User wallet pays)     (Service wallet pays)
```

---

## ✨ Key Features

### Core Functionality ✅
- [x] x402 payment challenge generation
- [x] Stellar payment verification (native XLM + USDC)
- [x] On-chain settlement with structured receipts
- [x] Direct paid routes (`/ai`, `/data`, `/compute`)
- [x] Intent-based execution flow
- [x] Dynamic pricing based on query complexity
- [x] Policy hooks (pricing, conditional paywall, metadata)
- [x] Request logging and revenue stats
- [x] CLI with secure wallet storage

### Provider SDK ✅
- [x] `createStellarOxideGatewayApp()` - Standalone gateway
- [x] `registerStellarOxideGatewayRoutes()` - Embeddable middleware
- [x] Declarative route definitions
- [x] Upstream proxy mode (sit in front of existing APIs)
- [x] Multi-storage backends (memory, file, SQLite, Postgres)
- [x] Health checks and readiness probes
- [x] Graceful shutdown hooks

### Ecosystem Tooling 🚧
- [x] `/.well-known/stellar-oxide-gateway.json` - Provider manifest
- [x] `/capabilities` - Machine-readable endpoint metadata
- [x] `/discovery/resources` - Discovery endpoint for agents
- [x] `/registry/export` - Registry/listing export
- [x] Service resolution SDK (`resolveStellarOxideGatewayService()`)
- [ ] Bazaar marketplace integration (planned)
- [ ] Reputation and trust systems (planned)

---

## 🎬 Demo & Usage

### 🚀 Live Demo - See It In Action!

We've created a side-by-side comparison demo that shows the problem and solution:

```bash
# Run the comparison demo
yarn demo:comparison
```

This starts two servers:
- **Traditional API** (port 4000) - Shows all the problems
  - Requires API keys
  - Has rate limits
  - Needs subscriptions
  - Blocks agents from self-onboarding

- **Stellar Oxide Gateway** (port 3000) - Shows the solution
  - No API keys needed
  - Pay-per-use with Stellar
  - Agents self-onboard instantly
  - No rate limits

**Try the traditional API:**
```bash
curl http://localhost:4000/api/search?q=test
# ❌ Fails: "Missing API key"

curl -H "x-api-key: sk_test_123" http://localhost:4000/api/search?q=test
# ✅ Works, but counts against rate limit (100 requests max)
```

**Try Stellar Oxide Gateway:**
```bash
yarn cli setup  # One-time wallet setup
yarn cli ai --query "test"
# ✅ Pays 0.02 USD in XLM, gets instant access, no limits!
```

See [src/README.md](src/README.md) for detailed demo scenarios.

### Quick Start (5 minutes)

**1. Install dependencies:**
```bash
yarn install
```

**2. Set up CLI wallet:**
```bash
yarn cli setup
```

**3. Start the gateway:**
```bash
X402_NETWORK=stellar-testnet X402_ASSET=USDC yarn start
```

**4. Make a paid request:**
```bash
yarn cli ai --query "hello agent"
```

**5. Check stats:**
```bash
curl http://localhost:3000/stats
```

### Live Demo Endpoints

When running locally:
- Health: `http://localhost:3000/health`
- Readiness: `http://localhost:3000/ready`
- Capabilities: `http://localhost:3000/capabilities`
- Manifest: `http://localhost:3000/.well-known/stellar-oxide-gateway.json`
- Stats: `http://localhost:3000/stats`

### Example Response

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
    }
  },
  "result": {
    "summary": "Processed ai request",
    "source": "local-fallback"
  }
}
```

---

## 🛠️ Technical Implementation

### Technology Stack
- **Runtime**: Node.js (ES modules)
- **Framework**: Express.js
- **Blockchain**: Stellar (testnet & mainnet ready)
- **Payment Protocol**: x402-stellar
- **Storage**: Memory, File, SQLite, PostgreSQL
- **CLI**: Secure keystore with keytar
- **Testing**: Node.js test runner (40 tests, 100% passing)

### Code Quality
- ✅ **40/40 tests passing** (100% success rate)
- ✅ Linting with custom rules
- ✅ Production-style test suite with live Stellar testnet verification
- ✅ Smoke tests for all entry points
- ✅ Type-safe configuration validation

### Project Structure
```
stellar-oxide-gateway/
├── server/              # Gateway server implementation
│   ├── provider.js      # Provider SDK and route registration
│   ├── payments.js      # x402 payment verification
│   ├── pricing.js       # Dynamic pricing engine
│   ├── intents.js       # Intent storage adapters
│   ├── logger.js        # Usage tracking
│   └── handlers/        # Endpoint handlers
├── client/              # CLI and client SDK
│   ├── client.js        # CLI commands
│   ├── payFetch.js      # Payment-aware fetch
│   └── lib/             # Config, wallet, service resolution
├── examples/            # Integration templates
│   ├── express-provider.js
│   ├── paid-search-provider.js
│   ├── paid-inference-provider.js
│   ├── paid-market-data-provider.js
│   └── paid-scraper-provider.js
├── tests/               # Unit and integration tests
├── production-tests/    # Live Stellar testnet tests
└── docs/                # Architecture and implementation docs
```

---

## 📊 Real-World Use Cases

### 1. AI Inference APIs
```javascript
registerStellarOxideGatewayRoutes(app, {
  routes: [{
    path: "/inference",
    description: "Pay-per-token AI inference",
    priceUsd: "0.10",
    billingUnit: "1000 tokens",
    handler: async (config, query) => ({
      result: await runInference(query)
    })
  }]
});
```

### 2. Market Data APIs
```javascript
registerStellarOxideGatewayRoutes(app, {
  routes: [{
    path: "/market-data",
    description: "Real-time market data",
    priceUsd: "0.05",
    billingUnit: "query",
    handler: async (config, query) => ({
      data: await fetchMarketData(query)
    })
  }]
});
```

### 3. Web Scraping Service
```javascript
registerStellarOxideGatewayRoutes(app, {
  routes: [{
    path: "/scrape",
    description: "Web scraping as a service",
    priceUsd: "0.03",
    billingUnit: "page",
    handler: async (config, query) => ({
      content: await scrapePage(query)
    })
  }]
});
```

### 4. Proxy Existing API (No Code Changes)
```javascript
registerStellarOxideGatewayRoutes(app, {
  routes: [{
    path: "/search",
    description: "Paid search API",
    priceUsd: "0.02",
    upstream: {
      url: "https://api.example.com/search",
      headers: { Authorization: `Bearer ${API_KEY}` }
    }
  }]
});
```

---

## 🧪 Testing & Verification

### Test Coverage
```bash
# Run all tests
yarn test

# Run live Stellar testnet tests
yarn test:production

# Run smoke tests
yarn smoke

# Run linting
yarn lint

# Full check
yarn check
```

### Test Results
- **40/40 tests passing** ✅
- **Live Stellar testnet verification** ✅
- **Real on-chain payments tested** ✅
- **Transaction hash validation on Horizon** ✅

### Verified Features
- ✅ Gateway startup and health checks
- ✅ 402 challenge generation
- ✅ Payment verification (native XLM + USDC)
- ✅ On-chain settlement
- ✅ Intent creation and execution
- ✅ Storage backends (memory, SQLite, Postgres)
- ✅ Policy hooks and dynamic pricing
- ✅ Upstream proxy mode
- ✅ CLI wallet management
- ✅ Service discovery and resolution

---

## 📖 Integration Examples

### Minimal Integration (3 lines)
```javascript
import express from "express";
import { registerStellarOxideGatewayRoutes } from "stellar-oxide-gateway";

const app = express();

registerStellarOxideGatewayRoutes(app, {
  config: {
    network: "stellar-testnet",
    walletAddress: process.env.WALLET_ADDRESS,
    asset: { address: "native", symbol: "XLM", decimals: 7 }
  },
  routes: [{
    path: "/api",
    priceUsd: "0.01",
    handler: async () => ({ result: "paid data" })
  }]
});

app.listen(3000);
```

### Advanced Integration with Policies
```javascript
registerStellarOxideGatewayRoutes(app, {
  config,
  routes: [{
    path: "/premium",
    description: "Premium API with dynamic pricing",
    priceUsd: "0.05",
    
    // Dynamic pricing based on query complexity
    pricing: ({ query }) => 
      query.length > 100 ? "0.10" : "0.05",
    
    // Conditional paywall (bypass for pro users)
    shouldRequirePayment: ({ req }) => 
      req.headers["x-plan"] !== "pro",
    
    // Custom payment metadata
    paymentMetadata: ({ req }) => ({
      tenantId: req.headers["x-tenant-id"],
      plan: req.headers["x-plan"]
    }),
    
    handler: async (config, query) => ({
      result: await processQuery(query)
    })
  }],
  
  // Production storage
  storage: {
    intents: {
      type: "postgres",
      connectionString: process.env.DATABASE_URL,
      tableName: "intents"
    },
    usage: {
      type: "postgres",
      connectionString: process.env.DATABASE_URL,
      tableName: "usage"
    }
  }
});
```

---

## 🎯 Hackathon Alignment

### Paid Agent Services / APIs ✅

**How it fits:**
- Enables pay-per-token AI inference
- Enables pay-per-query search
- Enables pay-per-request data APIs
- Provides templates for common paid agent services
- Agent-native design with machine-readable requirements

**Evidence:**
- Working examples in `/examples` directory
- Live Stellar testnet verification
- Structured receipts for agent consumption
- CLI that autonomous agents can use programmatically

### Infrastructure / Ecosystem Tooling 🚧

**How it fits:**
- Provider manifest endpoint for service discovery
- Registry export format for bazaar-style listings
- Capabilities endpoint for agent introspection
- Service resolution SDK for consumer-side discovery
- Versioned public contracts for ecosystem compatibility

**Evidence:**
- `/.well-known/stellar-oxide-gateway.json` manifest
- `/registry/export` for directory listings
- `/capabilities` and `/discovery/resources` endpoints
- `resolveStellarOxideGatewayService()` consumer SDK
- Documentation for ecosystem integration

---

## 🚀 Future Roadmap

### Phase 1: Core Infrastructure ✅ (Complete)
- [x] x402 payment gateway
- [x] Provider SDK
- [x] CLI with secure wallet
- [x] Multi-storage backends
- [x] Production test coverage

### Phase 2: Ecosystem Tooling 🚧 (In Progress)
- [x] Provider manifest endpoint
- [x] Registry export format
- [x] Service resolution SDK
- [ ] Bazaar marketplace integration
- [ ] Trust and reputation systems

### Phase 3: Advanced Features 🔮 (Planned)
- [ ] Multi-chain support (beyond Stellar)
- [ ] Privacy pools for x402 payments
- [ ] DeFi integrations (yield on escrow)
- [ ] Agent-to-agent communication protocol
- [ ] Decentralized service registry

---

## 📚 Documentation

### Core Documentation
- **README.md** - Complete project documentation
- **PRD.md** - Product Requirements Document
- **HACKATHON.md** - This file (hackathon submission)

### Technical Documentation
- **docs/PAID_AGENT_APIS_IMPLEMENTATION.md** - Paid APIs implementation guide
- **docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md** - Ecosystem architecture
- **docs/INFRASTRUCTURE_ECOSYSTEM_TOOLING_IMPLEMENTATION.md** - Implementation plan
- **docs/PRODUCTION_READINESS.md** - Production deployment guide
- **docs/ROADMAP_ECOSYSTEM_TOOLING.md** - Ecosystem roadmap
- **docs/README.md** - Developer guide

### API Documentation
All endpoints are documented with:
- Request/response schemas
- Payment requirements
- Example payloads
- Error handling

---

## 🏆 Why This Should Win

### 1. **Real Infrastructure, Not Just a Demo**
- Embeddable SDK that developers can actually use
- Production-ready storage backends
- Health checks, graceful shutdown, readiness probes
- 40 tests with 100% pass rate

### 2. **Solves a Real Problem**
- API monetization is broken today
- Agents need frictionless access without human setup
- Pay-per-use is impossible with traditional payment rails
- This enables a new category of agent-native services

### 3. **Two Hackathon Categories**
- **Primary**: Paid agent services / APIs (fully implemented)
- **Secondary**: Infrastructure / ecosystem tooling (in progress)

### 4. **Extensible & Composable**
- Drop into any Express app
- Proxy existing APIs without code changes
- Policy hooks for custom business logic
- Multiple storage backends

### 5. **Agent-First Design**
- Machine-readable payment requirements
- Structured blockchain receipts
- Automatic retry logic
- Service discovery and resolution

### 6. **Live on Stellar Testnet**
- Real payments verified on-chain
- Transaction hashes validated on Horizon
- Production-style test suite
- Ready for mainnet deployment

---

## 🔗 Links & Resources

### Repository
- **GitHub**: [stellar-oxide-gateway](https://github.com/yourusername/stellar-oxide-gateway)
- **NPM Package**: `stellar-oxide-gateway` (ready to publish)

### Documentation
- **PRD (Google Docs)**: [Product Requirements Document](https://docs.google.com/document/d/1BOtask_WttU2Oni6gIoFt5Mk9DrrWbRB/edit?usp=sharing&ouid=100722320761073170367&rtpof=true&sd=true)
- **Technical Docs**: See `/docs` directory

### Demo
- **Live Demo**: (Add your deployed demo URL here)
- **Video Demo**: (Add your video demo URL here)
- **Slides**: (Add your presentation slides URL here)

---

## 👥 Team

**Solo Developer**: Kelly Musk
- Full-stack developer
- Blockchain infrastructure specialist
- Agent-native API design

---

## 🙏 Acknowledgments

Built for the **Stellar x402 Hackathon** with:
- **Stellar SDK** for blockchain integration
- **x402-stellar** protocol implementation
- **Express.js** for HTTP server
- **Node.js** for runtime
- **PostgreSQL** for production storage

Special thanks to the Stellar Foundation and x402 protocol designers for creating the infrastructure that makes agent-native payments possible.

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🚀 Get Started Now

```bash
# Clone the repository
git clone https://github.com/yourusername/stellar-oxide-gateway.git
cd stellar-oxide-gateway

# Install dependencies
yarn install

# Set up your wallet
yarn cli setup

# Start the gateway
X402_NETWORK=stellar-testnet X402_ASSET=USDC yarn start

# Make your first paid request
yarn cli ai --query "hello agent"
```

**Welcome to the future of agent-native API monetization on Stellar!** 🌟
