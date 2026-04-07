import test from "node:test";
import assert from "node:assert/strict";
import { createPaymentContext } from "../server/payments.js";

const config = {
  port: 3000,
  gatewayUrl: "http://localhost:3000",
  rustServiceUrl: "",
  facilitatorUrl: "https://facilitator.stellar-x402.org",
  network: "stellar-testnet",
  walletAddress: "GD3PXXADIXMWGINT2LK3Q45SLI3HRCRA2I7NDOTXXTGNXO7GDYKI4SK7",
  asset: {
    address: "native",
    symbol: "XLM",
    decimals: 7,
    displayName: "Stellar Lumens",
  },
};

function createMockRequest(query = "hello") {
  return {
    protocol: "http",
    originalUrl: `/ai?q=${encodeURIComponent(query)}`,
    query: { q: query },
    get(name) {
      if (name === "host") {
        return "localhost:3000";
      }

      return "";
    },
  };
}

test("builds x402 payment requirements for a request", () => {
  const paymentContext = createPaymentContext(config);
  const requirements = paymentContext.buildRequirements(createMockRequest(), "ai");

  assert.equal(requirements.scheme, "exact");
  assert.equal(requirements.network, "stellar-testnet");
  assert.equal(requirements.payTo, config.walletAddress);
  assert.equal(requirements.asset, "native");
  assert.equal(requirements.maxAmountRequired, "200000");
  assert.equal(requirements.resource, "http://localhost:3000/ai?q=hello");
});

test("exposes capability metadata for clients", () => {
  const paymentContext = createPaymentContext(config);
  const capabilities = paymentContext.getCapabilities();

  assert.equal(capabilities.protocol, "x402-stellar");
  assert.equal(capabilities.asset.symbol, "XLM");
  assert.equal(capabilities.endpoints.length, 3);
});

test("builds discovery resources for agents", () => {
  const paymentContext = createPaymentContext(config);
  const resources = paymentContext.getDiscoveryResources();

  assert.equal(resources.length, 3);
  assert.equal(resources[0].resource, "http://localhost:3000/ai");
  assert.equal(resources[0].accepts[0].scheme, "exact");
});
