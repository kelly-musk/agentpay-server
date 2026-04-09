# Stellar Oxide Gateway Ecosystem Tooling Architecture

> Status: target-state architecture and planning reference.
> This document describes where Stellar Oxide Gateway should go for the ecosystem-tooling
> wedge. It does not mean the full ecosystem layer is already implemented.

This document is the long-term reference and source of truth for Stellar Oxide Gateway as
infrastructure and ecosystem tooling, beyond the gateway and SDK that exist
today.

It defines the target architecture, product arcs, system boundaries, and the
major building blocks required for Stellar Oxide Gateway to evolve from:

- a gateway and SDK for paid agent APIs

into:

- a publishing, discovery, billing, and consumption infrastructure layer for
  paid agent services on Stellar/x402

## Status

- Current implementation: paid agent service gateway + provider SDK + client CLI
- Current strongest wedge: paid agent services / APIs
- Intended second layer: infrastructure / ecosystem tooling
- This document is strategic design guidance, not a statement that all features
  are already implemented
- Treat this as the architecture target and product reference for future work

## Product Thesis

Stellar Oxide Gateway should not stop at "protect routes with a 402 payment flow."

The larger infrastructure opportunity is to support an ecosystem where:

- providers publish paid services
- agents and platforms discover them
- consumers pay and access them programmatically
- operators run them with observable, durable, and verifiable infrastructure
- ecosystem tooling can index, compare, validate, and eventually trust them

That means Stellar Oxide Gateway becomes:

- provider infrastructure
- payment infrastructure
- discovery infrastructure
- consumer integration infrastructure
- ecosystem compatibility infrastructure

## High-Level Product Arc

```text
Provider builds a service
        ↓
Provider integrates Stellar Oxide Gateway
        ↓
Provider publishes service metadata
        ↓
Service becomes discoverable to agents/platforms
        ↓
Consumer resolves service metadata and price/payment requirements
        ↓
Consumer pays and accesses the service
        ↓
Gateway verifies, settles, logs, and returns structured receipts
        ↓
Registry / bazaar / facilitator / platform can index or observe compatible services
```

## Target Layers

### Layer 1: Paid Agent Services / APIs

This is the first product wedge and the current foundation.

Stellar Oxide Gateway already supports:

- paywalled endpoints
- payment verification
- settlement
- intent-based paid execution
- provider integration
- route and policy metadata

Examples:

- search APIs
- market/news data APIs
- scraping/data extraction APIs
- AI inference APIs
- compute APIs

### Layer 2: Ecosystem Tooling

This is the next major product layer.

The ecosystem layer should make it easy to:

- publish services
- discover services
- validate services
- integrate services
- operate services

This is broader than a single gateway and broader than a single paid API.

## Five Pillars of Ecosystem Tooling

### Pillar 1: Provider Publishing

Providers need a standard way to describe what they offer.

Required capabilities:

- service manifest format
- provider identity metadata
- endpoint/service metadata
- version metadata
- pricing model metadata
- network/asset compatibility metadata
- support/contact metadata
- readiness / availability metadata

Desired output:

- a stable publishable service contract
- a machine-readable provider/service descriptor

### Pillar 2: Discovery and Bazaar Infrastructure

Agents and platforms need a way to find compatible paid services.

Required capabilities:

- discovery endpoints
- category and tag filtering
- network and asset filtering
- billing model filtering
- schema visibility
- examples and usage hints
- compatibility metadata for indexers/registries

Desired output:

- a bazaar-style service discovery surface
- compatibility with future facilitator or registry listing systems

### Pillar 3: Consumer Integration

Consumers should not have to manually stitch together payment and service logic.

Required capabilities:

- client SDKs
- service resolution from manifest/capabilities
- wallet/service-wallet integrations
- request + payment orchestration
- receipt parsing and verification helpers
- compatibility checks

Consumers include:

- AI agents
- backend services
- platforms
- browser-based apps

### Pillar 4: Provider Operations

Providers need operational infrastructure, not just payment logic.

Required capabilities:

- durable storage
- readiness and health reporting
- structured logs
- metrics
- request tracing / IDs
- failure reporting
- deployment guidance
- version rollout and compatibility controls

Desired output:

- providers can run Stellar Oxide Gateway-backed services reliably in real deployments

### Pillar 5: Trust and Ecosystem Reputation

Long term, ecosystem tooling must help consumers assess trust.

Potential capabilities:

- provider identity assertions
- signed manifests
- ratings and reviews
- service reputation signals
- uptime and reliability signals
- compatibility certification

This pillar is later-stage but should influence the data model early.

## Core System Arcs

### Arc 1: Provider Publishing Arc

```text
Provider defines service
        ↓
Provider configures routes, pricing, schemas, and metadata
        ↓
Stellar Oxide Gateway publishes a manifest + capabilities + discovery surface
        ↓
Service becomes indexable by ecosystem tooling
```

### Arc 2: Consumer Discovery Arc

```text
Agent / platform / indexer looks for paid services
        ↓
Reads manifest / discovery / capabilities
        ↓
Filters by category, network, asset, billing unit, tags, and schemas
        ↓
Selects a compatible service
```

### Arc 3: Paid Consumption Arc

```text
Consumer calls protected endpoint
        ↓
Receives 402 challenge + structured payment requirements
        ↓
Signs and submits payment
        ↓
Retries request with payment proof
        ↓
Stellar Oxide Gateway verifies and settles
        ↓
Service response + structured receipt returned
```

### Arc 4: Operator Visibility Arc

```text
Provider runs service
        ↓
Stellar Oxide Gateway records usage, revenue, and intent lifecycle
        ↓
Provider observes readiness, logs, metrics, and receipts
        ↓
Provider improves pricing, reliability, and integration quality
```

### Arc 5: Ecosystem Registry Arc

```text
Provider publishes compatible metadata
        ↓
Registry / bazaar indexes services
        ↓
Agents and platforms search/select services
        ↓
Consumers transact through Stellar Oxide Gateway-compatible flows
        ↓
Registry can later incorporate trust and reputation signals
```

## Source-of-Truth Interfaces

The ecosystem tooling layer should eventually standardize these interfaces.

### 1. Provider Manifest

Purpose:

- stable service publishing contract

Suggested endpoint:

- `GET /.well-known/stellar-oxide-gateway.json`

Suggested top-level fields:

- `service`
- `provider`
- `version`
- `network`
- `assetSupport`
- `capabilitiesUrl`
- `discoveryUrl`
- `readyUrl`
- `routes`
- `support`
- `compliance`

### 2. Capabilities Endpoint

Purpose:

- machine-readable contract for supported routes and payment-facing behavior

Current implementation:

- `GET /capabilities`

Should evolve to include:

- richer service metadata
- route schemas
- pricing model hints
- supported payment assets
- compatibility/version info

### 3. Discovery Endpoint

Purpose:

- list and describe monetized resources for agents and indexers

Current implementation:

- `GET /discovery/resources`

Should evolve to include:

- richer categorization
- provider metadata
- route-level examples
- compatibility metadata for registries

### 4. Receipt Contract

Purpose:

- reconciliation, auditability, and downstream verification

Current implementation already includes:

- transaction hash
- ledger
- payer
- payee
- amount
- asset
- explorer URL

Should evolve to include:

- explicit receipt version
- provider reference ID
- request correlation ID
- settlement status model for downstream systems

## Canonical Data Model Direction

The long-term model should think in terms of these entities:

### Provider

- provider ID
- display name
- support metadata
- trust metadata later

### Service

- service ID
- service type/category
- version
- network compatibility
- asset compatibility

### Route / Capability

- route ID
- path
- method
- pricing model
- billing unit
- input/output schemas
- examples

### Intent / Execution

- intent ID
- lifecycle status
- payment-required decision
- execution result

### Receipt

- receipt ID
- transaction hash
- ledger
- payer/payee
- amount
- settlement status

## Strategic Non-Goals Right Now

To keep execution focused, these are not the immediate priority:

- DAO/governance design
- private x402 pooling architecture
- trust marketplace / ratings implementation
- fully generalized multi-chain support
- end-user social/reputation systems

They may come later, but they should not distract from the core infra path.

## Immediate Implementation Priorities

These are the recommended implementation steps derived from this architecture.

### Priority A: Publishing Layer

Build:

- provider manifest spec
- well-known manifest endpoint
- versioned provider/service metadata

### Priority B: Discovery Layer

Build:

- richer discovery schema
- category/tag compatibility model
- service listing/export shape

### Priority C: Consumer Layer

Build:

- service resolution helper in client SDK
- easier client-side selection of services from discovery/manifest data

### Priority D: Operations Layer

Build:

- metrics hooks
- structured logs
- correlation IDs
- stronger receipt/reference model

### Priority E: Trust Foundations

Design and reserve fields for:

- signed manifests
- reputation signals
- provider identity

## What This Means for Product Positioning

The correct product framing becomes:

Stellar Oxide Gateway is infrastructure for publishing, discovering, and consuming paid
agent services on Stellar with x402-style payment flows.

That breaks down into:

- a provider SDK
- a payment gateway
- a discovery surface
- a client integration surface
- an ecosystem compatibility layer

## Current Mapping to This Architecture

Already present in the repo:

- provider SDK
- gateway/payment layer
- route and policy metadata
- capabilities endpoint
- discovery endpoint
- intent lifecycle
- receipts
- readiness and storage layers

Partially present:

- service metadata model
- paid API templates

Not yet present:

- provider manifest endpoint
- bazaar/listing export format
- versioned ecosystem contracts
- trust/reputation layer
- consumer-side service resolution from manifests

## Source of Truth Rule

When future implementation choices conflict with older README wording,
ad-hoc examples, or temporary experiments, this document should be treated as
the reference architecture for the ecosystem-tooling direction unless a newer
architecture document explicitly replaces it.
