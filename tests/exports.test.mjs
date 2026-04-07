import test from "node:test";
import assert from "node:assert/strict";

test("root package entry exports provider helpers", async () => {
  const sdk = await import("../index.js");

  assert.equal(typeof sdk.registerAgentPayRoutes, "function");
  assert.equal(typeof sdk.createAgentPayProvider, "function");
  assert.equal(typeof sdk.createSqliteIntentStorage, "function");
  assert.equal(typeof sdk.createSqliteUsageStorage, "function");
});

test("server entry exports provider and payment helpers", async () => {
  const serverSdk = await import("../server/index.js");

  assert.equal(typeof serverSdk.registerAgentPayRoutes, "function");
  assert.equal(typeof serverSdk.createPaymentContext, "function");
  assert.equal(typeof serverSdk.requirePaymentWith, "function");
});

test("client entry exports payFetch", async () => {
  const clientSdk = await import("../client/index.js");

  assert.equal(typeof clientSdk.payFetch, "function");
});
