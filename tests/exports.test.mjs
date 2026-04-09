import test from "node:test";
import assert from "node:assert/strict";

test("root package entry exports provider helpers", async () => {
  const sdk = await import("../index.js");

  assert.equal(typeof sdk.registerStellarOxideGatewayRoutes, "function");
  assert.equal(typeof sdk.createStellarOxideGatewayProvider, "function");
  assert.equal(typeof sdk.CONTRACT_VERSIONS, "object");
  assert.equal(typeof sdk.NETWORK_IDS, "object");
  assert.equal(typeof sdk.SUPPORTED_NETWORK_IDS?.length, "number");
  assert.equal(typeof sdk.CLASSIC_ASSET_IDS, "object");
  assert.equal(typeof sdk.CLASSIC_STELLAR_ASSETS, "object");
  assert.equal(typeof sdk.isSupportedNetworkId, "function");
  assert.equal(sdk.NETWORK_IDS.STELLAR_TESTNET, "stellar-testnet");
  assert.equal(sdk.NETWORK_IDS.BASE_SEPOLIA, "base-sepolia");
  assert.equal(sdk.CLASSIC_ASSET_IDS.USDC, "USDC");
  assert.equal(typeof sdk.createPostgresIntentStorage, "function");
  assert.equal(typeof sdk.createPostgresUsageStorage, "function");
  assert.equal(typeof sdk.createSqliteIntentStorage, "function");
  assert.equal(typeof sdk.createSqliteUsageStorage, "function");
});

test("server entry exports provider and payment helpers", async () => {
  const serverSdk = await import("../server/index.js");

  assert.equal(typeof serverSdk.registerStellarOxideGatewayRoutes, "function");
  assert.equal(typeof serverSdk.CONTRACT_VERSIONS, "object");
  assert.equal(typeof serverSdk.NETWORK_IDS, "object");
  assert.equal(typeof serverSdk.CLASSIC_ASSET_IDS, "object");
  assert.equal(typeof serverSdk.isSupportedNetworkId, "function");
  assert.equal(typeof serverSdk.createPaymentContext, "function");
  assert.equal(typeof serverSdk.validateProviderOptions, "function");
  assert.equal(typeof serverSdk.validateGatewayConfig, "function");
  assert.equal(typeof serverSdk.requirePaymentWith, "function");
});

test("client entry exports payFetch", async () => {
  const clientSdk = await import("../client/index.js");

  assert.equal(typeof clientSdk.payFetch, "function");
  assert.equal(typeof clientSdk.resolveStellarOxideGatewayService, "function");
  assert.equal(typeof clientSdk.selectStellarOxideGatewayRoute, "function");
});
