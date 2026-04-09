import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import fetch from "node-fetch";
import { createStellarOxideGatewayApp, createMemoryIntentStorage, createMemoryUsageStorage } from "../server/index.js";
import { payFetch } from "../client/index.js";

const MERCHANT_WALLET_ADDRESS = "GD3PXXADIXMWGINT2LK3Q45SLI3HRCRA2I7NDOTXXTGNXO7GDYKI4SK7";

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function createTestConfig(port) {
  return {
    port,
    gatewayUrl: `http://127.0.0.1:${port}`,
    rustServiceUrl: "",
    facilitatorUrl: "https://facilitator.stellar-x402.org",
    network: "stellar-testnet",
    walletAddress: MERCHANT_WALLET_ADDRESS,
    asset: {
      address: "native",
      symbol: "XLM",
      decimals: 7,
      displayName: "Stellar Lumens",
    },
  };
}

async function startTestServer() {
  const port = await getAvailablePort();
  const config = createTestConfig(port);
  const app = createStellarOxideGatewayApp({
    config,
    intentStorage: createMemoryIntentStorage(),
    usageStorage: createMemoryUsageStorage(),
  });
  const provider = app.locals.stellarOxideGatewayProvider;
  const server = app.listen(port, "127.0.0.1");

  await once(server, "listening");

  return {
    server,
    provider,
    baseUrl: provider.config.gatewayUrl,
  };
}

async function stopTestServer(server, provider) {
  await provider.close();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

test("production-style Stellar testnet flow works end to end", { timeout: 120000 }, async () => {
  const { server, provider, baseUrl } = await startTestServer();

  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    const health = await readJson(healthResponse);
    assert.equal(health.ok, true);
    assert.equal(health.network, "stellar-testnet");
    assert.equal(health.asset, "XLM");

    const readinessResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(readinessResponse.status, 200);
    const readiness = await readJson(readinessResponse);
    assert.equal(readiness.ok, true);
    assert.equal(readiness.checks.payment.status, "ready");

    const capabilitiesResponse = await fetch(`${baseUrl}/capabilities`);
    assert.equal(capabilitiesResponse.status, 200);
    const capabilities = await readJson(capabilitiesResponse);
    assert.equal(capabilities.service, "stellar-oxide-gateway");
    assert.equal(capabilities.protocol, "x402-stellar");
    assert.equal(capabilities.network, "stellar-testnet");
    assert.equal(capabilities.asset.symbol, "XLM");
    assert.equal(Array.isArray(capabilities.endpoints), true);
    assert.equal(capabilities.endpoints.some((endpoint) => endpoint.id === "ai"), true);

    const unpaidResponse = await fetch(`${baseUrl}/ai?q=production+test`);
    assert.equal(unpaidResponse.status, 402);
    const unpaidBody = await readJson(unpaidResponse);
    assert.equal(unpaidBody.x402Version, 1);
    assert.equal(Array.isArray(unpaidBody.accepts), true);
    assert.equal(unpaidBody.accepts[0].network, "stellar-testnet");
    assert.equal(unpaidBody.accepts[0].payTo, MERCHANT_WALLET_ADDRESS);

    const paidDirectResponse = await payFetch(`${baseUrl}/ai?q=production+test`, {
      method: "GET",
      network: "stellar-testnet",
      asset: "native",
      autoFund: true,
    });
    assert.equal(paidDirectResponse.status, 200);
    const paidDirectBody = await readJson(paidDirectResponse);
    assert.equal(paidDirectBody.success, true);
    assert.equal(paidDirectBody.payment.status, "verified");
    assert.equal(paidDirectBody.payment.asset, "XLM");
    assert.equal(typeof paidDirectBody.payment.receipt.transactionHash, "string");
    assert.equal(typeof paidDirectBody.payment.receipt.ledger, "number");

    const horizonResponse = await fetch(
      `https://horizon-testnet.stellar.org/transactions/${paidDirectBody.payment.receipt.transactionHash}`,
    );
    assert.equal(horizonResponse.status, 200);
    const horizonBody = await readJson(horizonResponse);
    assert.equal(horizonBody.successful, true);
    assert.equal(horizonBody.hash, paidDirectBody.payment.receipt.transactionHash);
    assert.equal(horizonBody.ledger, paidDirectBody.payment.receipt.ledger);

    const createIntentResponse = await fetch(`${baseUrl}/intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "ai",
        query: "production intent test",
      }),
    });
    assert.equal(createIntentResponse.status, 201);
    const createdIntentBody = await readJson(createIntentResponse);
    assert.equal(createdIntentBody.intent.status, "pending");
    assert.equal(createdIntentBody.intent.endpoint, "ai");
    assert.equal(createdIntentBody.payment.status, "required");
    assert.equal(createdIntentBody.paymentRequest.resource.includes("/intents/"), true);

    const listIntentsResponse = await fetch(`${baseUrl}/intents`);
    assert.equal(listIntentsResponse.status, 200);
    const listedIntentsBody = await readJson(listIntentsResponse);
    assert.equal(Array.isArray(listedIntentsBody.items), true);
    assert.equal(listedIntentsBody.items.some((intent) => intent.id === createdIntentBody.intent.id), true);

    const executeIntentResponse = await payFetch(
      `${baseUrl}/intents/${createdIntentBody.intent.id}/execute`,
      {
        method: "POST",
        network: "stellar-testnet",
        asset: "native",
        autoFund: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    assert.equal(executeIntentResponse.status, 200);
    const executedIntentBody = await readJson(executeIntentResponse);
    assert.equal(executedIntentBody.success, true);
    assert.equal(executedIntentBody.intent.status, "executed");
    assert.equal(executedIntentBody.payment.status, "verified");
    assert.equal(executedIntentBody.payment.receipt.intentId, createdIntentBody.intent.id);
    assert.equal(executedIntentBody.payment.receipt.flow, "intent-execution");

    const statsResponse = await fetch(`${baseUrl}/stats`);
    assert.equal(statsResponse.status, 200);
    const stats = await readJson(statsResponse);
    assert.equal(Number.parseInt(String(stats.total_requests), 10) >= 2, true);
    assert.equal(String(stats.total_revenue).endsWith("XLM"), true);
  } finally {
    await stopTestServer(server, provider);
  }
});
