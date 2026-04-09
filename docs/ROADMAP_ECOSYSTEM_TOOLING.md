# Ecosystem Tooling Roadmap

This roadmap translates
[docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md](/home/kelly-musk/stellar-oxide-gateway-server/docs/ECOSYSTEM_TOOLING_ARCHITECTURE.md)
into concrete implementation phases.

## Phase 1: Paid Agent Service Foundation

Goal:

- make Stellar Oxide Gateway clearly useful for real paid APIs

Deliverables:

- service metadata on routes
- paid API templates
- route schemas in capabilities/discovery

Status:

- in progress / partially implemented

## Phase 2: Provider Publishing

Goal:

- let providers publish a stable machine-readable service contract

Deliverables:

- `/.well-known/stellar-oxide-gateway.json`
- provider manifest schema
- versioned service publishing shape

## Phase 3: Discovery and Bazaar Compatibility

Goal:

- make services indexable and discoverable by external ecosystem tooling

Deliverables:

- richer discovery format
- category/tag/search model
- listing/export compatibility layer

## Phase 4: Consumer Resolution

Goal:

- let clients and agents choose services programmatically

Deliverables:

- client helper for resolving services from manifests/discovery
- compatibility filters
- simpler consumption flow for agent frameworks

## Phase 5: Operations and Trust Foundations

Goal:

- make ecosystem services operable and increasingly trustworthy

Deliverables:

- structured logging and metrics
- receipt/reference hardening
- provider identity hooks
- signed manifest design
- trust metadata placeholders
