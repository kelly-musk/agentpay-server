import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC_ASSET_IDS,
  NETWORK_IDS,
  checkPayeeAssetReadiness,
  createPaymentReceipt,
  createPaymentContext,
  isSupportedNetworkId,
  validateGatewayConfig,
} from "../server/payments.js";
import { createEndpointCatalog } from "../server/pricing.js";

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

test("exposes paid agent service metadata and endpoint-specific output schemas", () => {
  const endpointCatalog = createEndpointCatalog({
    search: {
      id: "search",
      path: "/search",
      method: "POST",
      description: "Paid search for agent workflows",
      basePriceUsd: "0.05",
      category: "search-api",
      billingUnit: "query",
      audience: ["agents", "developers"],
      tags: ["search", "web", "retrieval"],
      useCases: ["research agents", "web grounding"],
      examples: [
        {
          query: "latest x402 news",
        },
      ],
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
          result: {
            type: "array",
          },
        },
        required: ["success", "result"],
      },
    },
  });
  const paymentContext = createPaymentContext({
    ...config,
    endpointCatalog,
  });
  const capabilities = paymentContext.getCapabilities();
  const resources = paymentContext.getDiscoveryResources();
  const requirements = paymentContext.buildRequirementsForResource(
    "http://localhost:3000/search",
    "search",
    "latest x402 news",
  );

  assert.equal(capabilities.endpoints[0].method, "POST");
  assert.equal(capabilities.endpoints[0].service.category, "search-api");
  assert.equal(capabilities.endpoints[0].service.billingUnit, "query");
  assert.equal(capabilities.endpoints[0].service.tags.includes("search"), true);
  assert.deepEqual(capabilities.endpoints[0].service.inputSchema.required, ["query"]);
  assert.equal(resources[0].metadata.service.useCases.includes("research agents"), true);
  assert.equal(requirements.outputSchema.required.includes("result"), true);
  assert.equal(requirements.extra.billingUnit, "query");
  assert.equal(requirements.extra.category, "search-api");
});

test("validates gateway config before use", () => {
  assert.throws(
    () => validateGatewayConfig({ ...config, network: undefined }),
    /Missing required network/,
  );
  assert.throws(
    () => validateGatewayConfig({ ...config, walletAddress: "not-a-wallet" }),
    /Invalid walletAddress/,
  );
  assert.throws(
    () => validateGatewayConfig({ ...config, gatewayUrl: "not-a-url" }),
    /Invalid gatewayUrl/,
  );
  assert.throws(
    () => validateGatewayConfig({ ...config, network: NETWORK_IDS.BASE_SEPOLIA }),
    /currently supports stellar-testnet, stellar/,
  );
});

test("exposes future-facing network ids while only supporting Stellar today", () => {
  assert.equal(isSupportedNetworkId(NETWORK_IDS.STELLAR_TESTNET), true);
  assert.equal(isSupportedNetworkId(NETWORK_IDS.STELLAR_MAINNET), true);
  assert.equal(isSupportedNetworkId(NETWORK_IDS.BASE_SEPOLIA), false);
  assert.equal(isSupportedNetworkId(NETWORK_IDS.SOLANA_DEVNET), false);
});

test("creates a structured blockchain payment receipt", () => {
  const receipt = createPaymentReceipt(config, {
    scheme: "exact",
    payTo: config.walletAddress,
    asset: "native",
    maxAmountRequired: "200000",
    resource: "http://localhost:3000/ai?q=hello",
    extra: {
      endpoint: "ai",
      priceUsd: "0.02",
      intentId: "intent_123",
      flow: "intent-execution",
    },
  }, {
    transactionHash: "abc123hash",
    payer: "GCPAYER123",
    payee: config.walletAddress,
    amountBaseUnits: "200000",
    ledger: 123456,
    ledgerCloseTime: "2026-04-08T12:00:00Z",
    submittedAt: "2026-04-08T12:00:00Z",
    finalizedAt: "2026-04-08T12:00:02Z",
  });

  assert.equal(receipt.transactionHash, "abc123hash");
  assert.equal(receipt.ledger, 123456);
  assert.equal(receipt.payer, "GCPAYER123");
  assert.equal(receipt.payee, config.walletAddress);
  assert.equal(receipt.amount.display, "0.02");
  assert.equal(receipt.amount.baseUnits, "200000");
  assert.equal(receipt.asset.symbol, "XLM");
  assert.equal(receipt.endpoint, "ai");
  assert.equal(receipt.intentId, "intent_123");
  assert.equal(receipt.flow, "intent-execution");
  assert.match(receipt.explorer.transaction, /stellar\.expert/);
});

test("reports a missing payee trustline with operator guidance", async () => {
  const readiness = await checkPayeeAssetReadiness(
    {
      ...config,
      asset: {
        address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
        symbol: "USDC",
        decimals: 7,
        displayName: "USD Coin",
      },
    },
    {
      horizonServer: {
        async loadAccount() {
          return {
            accountId: () => config.walletAddress,
            sequenceNumber: () => "1",
            incrementSequenceNumber() {},
          };
        },
      },
      rpcServer: {
        async simulateTransaction() {
          return {
            error: "trustline entry is missing for account",
          };
        },
      },
      autoCreateTrustline: false,
    },
  );

  assert.equal(readiness.ok, false);
  assert.equal(readiness.status, "missing_trustline");
  assert.match(readiness.nextStep, /cannot receive USDC yet/);
});

test("allows auto trustline setup when merchant asset details are configured", async () => {
  const submitted = [];
  process.env.MERCHANT_WALLET_SECRET_KEY = "SDXC5F43H67VH4Y4NKQN32SWCT7OMDPFTMVS47QKBIF6ARSGIM6WYP3R";
  process.env.MERCHANT_CLASSIC_ASSET = CLASSIC_ASSET_IDS.USDC;

  try {
    const readiness = await checkPayeeAssetReadiness(
      {
        ...config,
        walletAddress: "GDCEVL6NNYDT46MOF7S66YU3FGBHDRTR3D56WCGQRPIRK3ZDBZ2QOZCE",
        asset: {
          address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
          symbol: "USDC",
          decimals: 7,
          displayName: "USD Coin",
        },
      },
      {
        horizonServer: {
          async loadAccount() {
            return {
              accountId: () => "GDCEVL6NNYDT46MOF7S66YU3FGBHDRTR3D56WCGQRPIRK3ZDBZ2QOZCE",
              sequenceNumber: () => "1",
              incrementSequenceNumber() {},
            };
          },
          async submitTransaction(transaction) {
            submitted.push(transaction);
            return { hash: "trustline_tx_hash" };
          },
        },
        rpcServer: {
          async simulateTransaction() {
            return {
              error: "trustline entry is missing for account",
            };
          },
        },
        autoCreateTrustline: true,
      },
    );

    assert.equal(readiness.ok, true);
    assert.equal(readiness.status, "trustline_created");
    assert.equal(submitted.length, 1);
  } finally {
    delete process.env.MERCHANT_WALLET_SECRET_KEY;
    delete process.env.MERCHANT_CLASSIC_ASSET;
  }
});
