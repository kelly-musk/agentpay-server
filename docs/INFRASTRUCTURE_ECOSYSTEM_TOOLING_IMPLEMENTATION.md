# Infrastructure and Ecosystem Tooling Implementation Guide

> Status: future-facing implementation guide.
> This document explains how to build the infrastructure / ecosystem-tooling
> wedge. It should be read as an implementation plan and reference, not as proof
> that the full wedge already exists in the product today.

This guide explains how to implement Stellar Oxide Gateway as **infrastructure / ecosystem
tooling**, not just as a single paid API gateway.

It is the practical companion to:

- [docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md)
- [docs/ROADMAP_ECOSYSTEM_TOOLING.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ROADMAP_ECOSYSTEM_TOOLING.md)

This document focuses on what developers and product builders should actually
build if they want Stellar Oxide Gateway to function as ecosystem infrastructure.

## Current State vs Target State

Implemented today:

- provider SDK
- payment gateway
- capabilities endpoint
- discovery endpoint
- readiness and health surfaces
- receipts
- paid API templates

Not fully implemented yet:

- trust and reputation layers

Now implemented at a foundation level:

- versioned provider manifest endpoint:
  - `GET /.well-known/stellar-oxide-gateway.json`
- registry-friendly listing export:
  - `GET /registry/export`
- consumer-side service resolution helpers in the client SDK:
  - `resolveStellarOxideGatewayService(...)`
  - `selectStellarOxideGatewayRoute(...)`
- explicit contract version constants for:
  - manifest
  - registry export
  - capabilities
  - discovery
  - receipts

Use this guide to build the missing parts intentionally.

## What This Wedge Means

In this wedge, Stellar Oxide Gateway is not only:

- a payment gateway
- a route paywall
- a provider SDK

It also becomes:

- a publishing layer for paid services
- a discovery layer for agents and platforms
- a compatibility layer for registries and marketplaces
- an operations layer for providers

The key shift is:

- from "protect my endpoint"
- to "publish, discover, and consume paid services in a shared ecosystem"

## Who Uses This Layer

### Providers

Providers need to:

- publish paid services
- expose machine-readable metadata
- remain discoverable to external systems

### Registries / Bazaars / Marketplaces

They need to:

- crawl or ingest service metadata
- index services
- filter by compatibility
- display or rank providers

### Agents / Platforms / SDK Consumers

They need to:

- discover compatible services
- select them programmatically
- resolve payment and request contracts

## The Four Core Implementation Surfaces

This wedge should be implemented across four surfaces.

### 1. Publishing Surface

Purpose:

- let providers describe their services in a standard way

Required output:

- a provider/service manifest
- richer capabilities metadata
- richer discovery metadata

### 2. Discovery Surface

Purpose:

- let agents and registries find and filter services

Required output:

- category and tag metadata
- network and asset compatibility
- billing unit information
- schemas and examples

### 3. Compatibility Surface

Purpose:

- make services consumable by external tools without private knowledge of the
  codebase

Required output:

- stable, versioned fields
- explicit route metadata
- provider-level metadata
- machine-readable compatibility contract

### 4. Operations Surface

Purpose:

- make providers operable in real deployments and indexable as healthy services

Required output:

- health
- readiness
- storage status
- version and deployment metadata
- structured receipts and request observability later

## What Stellar Oxide Gateway Already Has

Already present:

- `GET /capabilities`
- `GET /discovery/resources`
- `GET /health`
- `GET /ready`
- route metadata:
  - category
  - billing unit
  - audience
  - tags
  - use cases
  - examples
  - input/output schemas
- payment receipts
- storage-backed intents and usage

This is a good foundation, but not the full infra/ecosystem-tooling layer yet.

## What Still Needs to Be Built

To make this wedge implementable in a real ecosystem, build these next.

### A. Provider Manifest

Add a stable well-known manifest endpoint.

Recommended path:

- `GET /.well-known/stellar-oxide-gateway.json`

Purpose:

- describe the provider
- describe the service
- advertise discovery and capability endpoints
- expose compatibility information for external systems

Recommended fields:

- `manifestVersion`
- `provider`
- `service`
- `network`
- `assetSupport`
- `capabilitiesUrl`
- `discoveryUrl`
- `readyUrl`
- `routes`
- `support`
- `links`

### B. Richer Discovery Contract

Extend discovery so indexers can understand services without route-specific
custom logic.

Recommended additions:

- provider display name
- service name
- service category
- supported assets
- supported networks
- billing model
- route examples
- version
- manifest URL

### C. Registry Export Compatibility

Provide a normalized export shape that an external registry can ingest directly.

This should eventually support:

- listing
- filtering
- category browsing
- provider metadata
- route metadata
- compatibility flags

### D. Versioned Public Contracts

Lock down and version the public machine-readable shapes for:

- manifest
- capabilities
- discovery
- receipts
- readiness responses

Without versioning, ecosystem consumers will break over time.

### E. Provider Identity Metadata

Providers should be able to declare:

- display name
- support email / support URL
- docs URL
- website URL
- icon/logo URL later
- legal/compliance fields later

That metadata is necessary for marketplaces and trust layers.

## Implementation Sequence

This is the recommended order for building this wedge.

### Step 1: Manifest Contract

Implement:

- provider/service manifest schema
- `/.well-known/stellar-oxide-gateway.json`

This is the first real infrastructure move.

### Step 2: Discovery Enrichment

Extend:

- `/discovery/resources`
- `/capabilities`

Make them carry:

- provider metadata
- service metadata
- version metadata
- compatibility metadata

### Step 3: Registry-Friendly Export

Add:

- a normalized listing/export shape
- optional filters and query support

This makes registry or bazaar ingestion realistic.

### Step 4: Client Resolution Helpers

Add:

- client-side helpers to resolve services from manifests/discovery metadata
- compatibility filters by network/asset/category

### Step 5: Trust and Ops Foundations

Add:

- provider reference IDs
- receipt versioning
- structured logs
- request IDs
- signed manifests later

## What a Good Ecosystem-Ready Provider Should Expose

A provider should be able to answer these questions programmatically:

- who are you?
- what service are you publishing?
- what routes do you offer?
- what does each route do?
- who is each route for?
- how is each route billed?
- what network and asset do you accept?
- how do I call you?
- what schema do you expect?
- what schema do you return?
- are you healthy and ready right now?

If the system cannot answer those clearly, it is still only a gateway, not
full ecosystem infrastructure.

## Practical Implementer Checklist

When building for this wedge, implementers should be able to provide:

- provider name
- service name
- route catalog
- route descriptions
- route categories
- billing units
- input/output schemas
- example requests
- support/contact metadata
- network selection
- asset selection

## Consumer / Registry Checklist

Consumers and ecosystem tools should be able to:

- list services
- inspect service compatibility
- inspect route metadata
- compare billing units and base prices
- retrieve schemas and examples
- verify readiness and capabilities

## Design Rules

### 1. Design for external readers

Discovery surfaces should assume:

- the reader has not seen the codebase
- the reader may be an agent or indexer

### 2. Prefer explicit fields over implicit conventions

Do not rely on:

- route name guesswork
- hidden pricing assumptions
- undocumented schemas

### 3. Keep provider and service identity separate

A provider can publish one or many services later.

The model should distinguish:

- provider
- service
- route/capability

### 4. Make compatibility obvious

Every service should clearly communicate:

- network
- asset
- billing unit
- route method
- request and response shape

### 5. Preserve future trust expansion

Leave room for:

- signatures
- identity assertions
- ratings/reviews
- uptime metadata

## Example Long-Term Shape

```text
Provider
  └── Service
      ├── Manifest
      ├── Capabilities
      ├── Discovery Resources
      ├── Routes / Capabilities
      ├── Receipts
      └── Readiness / Health
```

## Immediate Next Build Recommendation

If you want to implement this wedge properly, the next feature should be:

- a versioned provider manifest endpoint at `/.well-known/stellar-oxide-gateway.json`

Why:

- it upgrades Stellar Oxide Gateway from "SDK with discovery" to "publishable ecosystem
  service"
- it gives external registries and agents a single source of truth
- it creates a durable compatibility contract

## Source of Truth

This document is the practical implementation guide for the
**Infrastructure / ecosystem tooling** wedge.

Use it together with:

- [docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md)
- [docs/ROADMAP_ECOSYSTEM_TOOLING.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ROADMAP_ECOSYSTEM_TOOLING.md)

If there is a conflict between ad-hoc examples and the intended infra direction,
these documents should be treated as the stronger reference.
