import test from "node:test";
import assert from "node:assert/strict";
import { createServerApp } from "../server/server.js";

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

function getRoutePaths(app) {
  return app.router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
}

test("registers the public gateway routes", () => {
  const app = createServerApp(config);
  const routePaths = getRoutePaths(app);

  assert.deepEqual(routePaths, [
    "/",
    "/health",
    "/ready",
    "/capabilities",
    "/.well-known/stellar-oxide-gateway.json",
    "/registry/export",
    "/discovery/resources",
    "/stats",
    "/intents",
    "/intents",
    "/intents/:intentId",
    "/intents/:intentId/execute",
    "/ai",
    "/data",
    "/compute",
  ]);
  assert.equal(typeof app.locals.stellarOxideGatewayProvider?.getReadinessReport, "function");
  assert.equal(typeof app.locals.stellarOxideGatewayProvider?.close, "function");
});
