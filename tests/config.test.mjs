import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

async function loadConfigModule(xdgConfigHome) {
  process.env.XDG_CONFIG_HOME = xdgConfigHome;
  return import(`../client/lib/config.js?test=${Date.now()}-${Math.random()}`);
}

test("persists CLI config in the XDG config directory", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "agentpay-config-"));

  try {
    const { getConfigFilePath, loadConfig, saveConfig } = await loadConfigModule(tempRoot);

    await saveConfig({
      payerPublicKey: "GTEST",
      network: "stellar-testnet",
      gatewayUrl: "http://localhost:3000",
      asset: "USDC",
    });

    const stored = await loadConfig();
    const raw = await readFile(getConfigFilePath(), "utf-8");

    assert.equal(getConfigFilePath(), join(tempRoot, "agentpay", "config.json"));
    assert.equal(stored.payerPublicKey, "GTEST");
    assert.match(raw, /"asset": "USDC"/);
  } finally {
    delete process.env.XDG_CONFIG_HOME;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("prefers environment overrides in effective config", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "agentpay-config-"));

  process.env.XDG_CONFIG_HOME = tempRoot;
  process.env.X402_NETWORK = "stellar";
  process.env.GATEWAY_URL = "http://localhost:9999";
  process.env.X402_ASSET = "native";

  try {
    const { getEffectiveConfig, saveConfig } = await loadConfigModule(tempRoot);

    await saveConfig({
      payerPublicKey: "GCONFIG",
      network: "stellar-testnet",
      gatewayUrl: "http://localhost:3000",
      asset: "USDC",
    });

    const effective = await getEffectiveConfig();

    assert.equal(effective.payerPublicKey, "GCONFIG");
    assert.equal(effective.network, "stellar");
    assert.equal(effective.gatewayUrl, "http://localhost:9999");
    assert.equal(effective.asset, "native");
  } finally {
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.X402_NETWORK;
    delete process.env.GATEWAY_URL;
    delete process.env.X402_ASSET;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
