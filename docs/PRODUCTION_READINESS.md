# Production Readiness

This document tracks the work required to move Stellar Oxide Gateway from a well-tested
development SDK into a production-confident infrastructure product.

The current repo has strong local validation and unit/integration-style repo
tests, but that is not enough for a real production claim. The items below are
the minimum work needed to raise confidence in runtime correctness, security,
operability, and reliability.

## Status

- Current state: development/staging quality
- Not yet sufficient for: production deployment with high confidence

## Priority 1: End-to-End Integration

- Add HTTP integration tests against a running Express app, not just route-layer invocation helpers.
- Test the real `402 -> pay -> retry -> verify -> settle -> response` flow through HTTP.
- Add integration coverage for:
  - `GET /ready`
  - `GET /capabilities`
  - `GET /stats`
  - `POST /intents`
  - `POST /intents/:intentId/execute`
  - direct paid routes
- Add live-like tests for both:
  - direct route flow
  - intent execution flow

## Priority 2: Database and Storage Confidence

- Add real Postgres integration tests using a temporary database.
- Verify schema creation, reads, writes, updates, and shutdown behavior against a live Postgres instance.
- Add degraded-dependency tests:
  - Postgres unavailable at startup
  - Postgres unavailable during request handling
  - readiness behavior when storage is unhealthy
- Add migration/versioning strategy for storage schemas.

## Priority 3: Payment and Blockchain Confidence

- Add staging tests with real Stellar testnet payments.
- Validate actual settlement receipt contents against live chain data:
  - transaction hash
  - ledger number
  - ledger close time
  - payer
  - payee
  - amount
  - asset
- Test native XLM and Soroban token paths in staging.
- Add negative-path tests for:
  - invalid signature
  - wrong destination
  - wrong asset
  - wrong amount
  - expired ledger
  - replayed nonce

## Priority 4: Security Hardening

- Review all payment verification paths for tampering opportunities.
- Add tests for metadata tampering and requirement mismatch.
- Add abuse tests for:
  - replay attempts under concurrency
  - duplicate intent execution
  - malformed `x-payment` headers
  - oversized payloads
  - invalid JSON bodies
  - upstream proxy abuse and header injection
- Add request/body size limits and validate them explicitly.
- Review secret handling and ensure no sensitive values are logged.

## Priority 5: Concurrency and Race Conditions

- Add tests for simultaneous execution of the same intent.
- Verify only one execution wins and others fail cleanly.
- Add concurrent paid-route request tests.
- Add shutdown-during-request tests.
- Add storage contention tests for SQLite and Postgres-backed flows.

## Priority 6: Upstream Proxy Production Safety

- Add integration tests for proxy-backed routes with a real mock upstream server.
- Validate:
  - request method mapping
  - header forwarding rules
  - query/body forwarding
  - timeout handling
  - upstream 4xx/5xx propagation
  - retry behavior, if any
- Decide and document a strict allowlist/forwarding policy for upstream headers.

## Priority 7: Observability and Operations

- Add structured logging format for production.
- Add correlation IDs / request IDs.
- Add explicit receipt/reference IDs suitable for reconciliation.
- Add metrics for:
  - request count
  - payment verification failures
  - settlement failures
  - intent executions
  - upstream failures
  - storage failures
- Add operator-facing docs for:
  - readiness
  - liveness
  - storage health
  - incident handling

## Priority 8: Deployment and Environment Safety

- Add production configuration docs with explicit required env vars.
- Fail fast on incomplete production config.
- Add deployment examples for:
  - standalone gateway
  - embedded provider
  - Postgres-backed deployment
- Add staging/production environment profiles.
- Add a release checklist before publishing package versions.

## Priority 9: SDK Contract Stability

- Define a versioned receipt schema.
- Define a versioned response contract for:
  - direct routes
  - intent creation
  - intent execution
  - readiness responses
- Add contract tests so future changes do not silently break implementers.
- Decide which fields are stable public API and document them.

## Priority 10: Final Go-Live Gate

Before any production claim, require:

- all repo tests green
- HTTP integration suite green
- live Postgres integration suite green
- Stellar testnet staging flow green
- concurrency/race tests green
- security review completed
- operator runbook written
- deployment rollback plan documented

## Recommended Next Implementation Order

1. Build a real HTTP integration test layer.
2. Add live Postgres integration coverage.
3. Add staging Stellar testnet receipt validation.
4. Add duplicate-intent and replay/concurrency tests.
5. Add structured production logging and metrics hooks.

## Practical Definition of Production Confidence

Stellar Oxide Gateway should only be called production-confident when we can show:

- real HTTP behavior is tested
- real storage backends are tested
- real blockchain receipts are validated
- concurrency edge cases are handled
- degraded dependencies fail safely
- operator health and observability are in place

Until then, the repo should be described as:

- production-shaped
- increasingly hardened
- not yet fully production-certified
