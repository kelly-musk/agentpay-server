#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "fs";
import { basename } from "path";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { Keypair } from "@stellar/stellar-sdk";
import fetch from "node-fetch";
import { deleteStoredSecret, getStoredSecret, saveStoredSecret } from "./lib/secure-store.js";
import {
  clearConfig,
  getConfigFilePath,
  getEffectiveConfig,
  loadConfig,
  saveConfig,
} from "./lib/config.js";
import { runPayerCheck } from "./lib/payer-check.js";
import { payFetch } from "./payFetch.js";

const ENDPOINTS = new Set(["ai", "data", "compute"]);

function parseFlag(argv, name) {
  const index = argv.findIndex((value) => value === name);
  if (index === -1 || index === argv.length - 1) {
    return undefined;
  }

  return argv[index + 1];
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  );

  console.log(`${packageJson.name} v${packageJson.version}`);
  console.log("");
  console.log("Usage:");
  console.log("  agentpay setup");
  console.log("  agentpay setup --secret-key S... --network stellar-testnet --gateway-url http://localhost:3000 --asset USDC");
  console.log("  agentpay whoami");
  console.log("  agentpay doctor");
  console.log("  agentpay payer:check");
  console.log("  agentpay intent:create --endpoint ai --query \"hello agent\"");
  console.log("  agentpay intent:list");
  console.log("  agentpay intent:get --id intent_...");
  console.log("  agentpay intent:execute --id intent_...");
  console.log("  agentpay ai --query \"hello agent\"");
  console.log("  agentpay data --query \"market data\"");
  console.log("  agentpay compute --query \"run simulation\"");
  console.log("  agentpay logout");
  console.log("  agentpay reset");
}

function createMutedInterface() {
  const rl = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
  });

  rl.stdoutMuted = false;
  rl._writeToOutput = function writeToOutput(stringToWrite) {
    if (rl.stdoutMuted) {
      rl.output.write("*");
      return;
    }

    rl.output.write(stringToWrite);
  };

  return rl;
}

async function promptSetup() {
  return promptSetupWithArgs([]);
}

async function promptSetupWithArgs(argv) {
  const rl = createMutedInterface();

  try {
    const existingConfig = await loadConfig();
    const providedSecretKey = parseFlag(argv, "--secret-key") || process.env.STELLAR_SECRET_KEY;
    let secretKey = providedSecretKey;

    if (!secretKey) {
      const secretPrompt = "Enter your Stellar secret key: ";
      rl.stdoutMuted = true;
      secretKey = (await rl.question(secretPrompt)).trim();
      rl.stdoutMuted = false;
      rl.output.write("\n");
    }

    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    const defaultNetwork = existingConfig.network || "stellar-testnet";
    const defaultGatewayUrl = existingConfig.gatewayUrl || "http://localhost:3000";
    const defaultAsset = existingConfig.asset || "USDC";

    const providedNetwork = parseFlag(argv, "--network");
    const providedGatewayUrl = parseFlag(argv, "--gateway-url");
    const providedAsset = parseFlag(argv, "--asset");

    const network = providedNetwork
      || ((
        await rl.question(`Network [${defaultNetwork}]: `)
      ).trim() || defaultNetwork);

    const gatewayUrl = providedGatewayUrl
      || ((
        await rl.question(`Gateway URL [${defaultGatewayUrl}]: `)
      ).trim() || defaultGatewayUrl);

    const asset = providedAsset
      || ((
        await rl.question(`Default asset [${defaultAsset}]: `)
      ).trim() || defaultAsset);

    await saveStoredSecret(publicKey, secretKey);
    await saveConfig({
      ...existingConfig,
      payerPublicKey: publicKey,
      network,
      gatewayUrl,
      asset,
    });

    console.log("Setup complete");
    console.log(`Payer: ${publicKey}`);
    console.log(`Network: ${network}`);
    console.log(`Gateway: ${gatewayUrl}`);
    console.log(`Asset: ${asset}`);
  } finally {
    rl.close();
  }
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function getClientContext() {
  const effective = await getEffectiveConfig();
  const storedSecret = effective.payerPublicKey
    ? await getStoredSecret(effective.payerPublicKey)
    : null;

  return {
    network: effective.network || "stellar-testnet",
    gatewayUrl: effective.gatewayUrl || "http://localhost:3000",
    asset: effective.asset || process.env.X402_ASSET || "USDC",
    secretKey: storedSecret || process.env.STELLAR_SECRET_KEY,
    autoFund: process.env.AUTO_FUND_TESTNET_ACCOUNTS === "true",
  };
}

async function runWhoAmI() {
  const config = await loadConfig();

  if (!config.payerPublicKey) {
    throw new Error("No stored wallet found. Run `agentpay setup` first.");
  }

  printJson({
    payerPublicKey: config.payerPublicKey,
    network: config.network || "stellar-testnet",
    gatewayUrl: config.gatewayUrl || "http://localhost:3000",
    asset: config.asset || "USDC",
    configPath: getConfigFilePath(),
  });
}

async function runDoctor() {
  const config = await loadConfig();
  const effective = await getEffectiveConfig();
  const storedSecret = effective.payerPublicKey
    ? await getStoredSecret(effective.payerPublicKey)
    : null;
  const secretKey = storedSecret || process.env.STELLAR_SECRET_KEY;
  const report = {
    config: {
      path: getConfigFilePath(),
      payerPublicKey: effective.payerPublicKey || null,
      network: effective.network,
      gatewayUrl: effective.gatewayUrl,
      asset: effective.asset,
      hasStoredWallet: Boolean(storedSecret),
      hasEnvWallet: Boolean(process.env.STELLAR_SECRET_KEY),
    },
  };

  try {
    const health = await fetchJson(`${effective.gatewayUrl}/health`);
    report.gateway = {
      reachable: health.ok,
      status: health.status,
      service: health.data?.service || null,
      network: health.data?.network || null,
      asset: health.data?.asset || null,
    };
  } catch (error) {
    report.gateway = {
      reachable: false,
      error: String(error.message || error),
    };
  }

  try {
    const capabilities = await fetchJson(`${effective.gatewayUrl}/capabilities`);
    report.capabilities = {
      reachable: capabilities.ok,
      status: capabilities.status,
      resources:
        Array.isArray(capabilities.data?.resources) ? capabilities.data.resources.length : null,
    };
  } catch (error) {
    report.capabilities = {
      reachable: false,
      error: String(error.message || error),
    };
  }

  if (secretKey) {
    try {
      report.payer = await runPayerCheck({
        secretKey,
        network: effective.network,
        asset: effective.asset,
        assetSymbol: process.env.X402_ASSET_SYMBOL,
        assetDecimals: process.env.X402_ASSET_DECIMALS,
        assetName: process.env.X402_ASSET_NAME,
      });
    } catch (error) {
      report.payer = {
        status: "error",
        error: String(error.message || error),
      };
    }
  } else {
    report.payer = {
      status: "missing_credentials",
      nextStep: "Run `agentpay setup` or export STELLAR_SECRET_KEY.",
    };
  }

  printJson(report);

  const gatewayOk = Boolean(report.gateway?.reachable);
  const capabilitiesOk = Boolean(report.capabilities?.reachable);
  const payerOk = report.payer?.status === "ready";
  const hasWallet = Boolean(config.payerPublicKey || process.env.STELLAR_SECRET_KEY);

  if (!gatewayOk || !capabilitiesOk || !payerOk || !hasWallet) {
    process.exitCode = 1;
  }
}

async function runLogout() {
  const config = await loadConfig();

  if (!config.payerPublicKey) {
    console.log("No stored wallet found.");
    return;
  }

  await deleteStoredSecret(config.payerPublicKey);
  await saveConfig({
    ...config,
    payerPublicKey: undefined,
  });
  console.log("Stored wallet secret removed.");
}

async function runReset() {
  const config = await loadConfig();

  if (config.payerPublicKey) {
    await deleteStoredSecret(config.payerPublicKey);
  }

  await clearConfig();
  console.log("Local AgentPay config and stored secret were removed.");
}

async function runStoredPayerCheck() {
  const effective = await getEffectiveConfig();
  const storedSecret = effective.payerPublicKey
    ? await getStoredSecret(effective.payerPublicKey)
    : null;

  const report = await runPayerCheck({
    secretKey: storedSecret || process.env.STELLAR_SECRET_KEY,
    network: effective.network,
    asset: effective.asset,
    assetSymbol: process.env.X402_ASSET_SYMBOL,
    assetDecimals: process.env.X402_ASSET_DECIMALS,
    assetName: process.env.X402_ASSET_NAME,
  });

  console.log(`Network: ${report.network}`);
  console.log(`Payer: ${report.payer}`);
  console.log(`Native balance: ${report.nativeBalance} XLM`);
  console.log(`Asset: ${report.asset}`);

  if (report.tokenBalance !== undefined) {
    console.log(`Token balance: ${report.tokenBalance} ${report.asset}`);
  }

  console.log(`Status: ${report.status}`);

  if (report.nextStep) {
    console.log(`Next step: ${report.nextStep}`);
  }

  if (report.status !== "ready") {
    process.exitCode = 1;
  }
}

async function runIntentCreate(argv) {
  const { gatewayUrl } = await getClientContext();
  const endpoint = parseFlag(argv, "--endpoint") || "ai";
  const query = parseFlag(argv, "--query") || "real payment";
  const response = await fetchJson(`${gatewayUrl}/intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint,
      query,
    }),
  });

  if (!response.ok) {
    throw new Error(response.data?.error || `Intent creation failed with ${response.status}`);
  }

  console.log("[SUCCESS] Intent created:");
  printJson(response.data);
}

async function runIntentList() {
  const { gatewayUrl } = await getClientContext();
  const response = await fetchJson(`${gatewayUrl}/intents`);

  if (!response.ok) {
    throw new Error(response.data?.error || `Intent listing failed with ${response.status}`);
  }

  printJson(response.data);
}

async function runIntentGet(argv) {
  const { gatewayUrl } = await getClientContext();
  const intentId = parseFlag(argv, "--id");

  if (!intentId) {
    throw new Error("Missing required flag: --id");
  }

  const response = await fetchJson(`${gatewayUrl}/intents/${intentId}`);

  if (!response.ok) {
    throw new Error(response.data?.error || `Intent lookup failed with ${response.status}`);
  }

  printJson(response.data);
}

async function runIntentExecute(argv) {
  const { gatewayUrl, network, asset, secretKey, autoFund } = await getClientContext();
  const intentId = parseFlag(argv, "--id");

  if (!intentId) {
    throw new Error("Missing required flag: --id");
  }

  const url = `${gatewayUrl}/intents/${intentId}/execute`;
  console.log(`[INFO] Sending intent execution request to ${url}`);

  const response = await payFetch(url, {
    method: "POST",
    network,
    asset,
    secretKey,
    autoFund,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await response.json();

  console.log("[SUCCESS] Response:");
  printJson(data);
}

async function runEndpointCommand(endpoint, argv) {
  const { network, gatewayUrl, asset, secretKey, autoFund } = await getClientContext();
  const query = parseFlag(argv, "--query") || "real payment";
  const url = `${gatewayUrl}/${endpoint}?q=${encodeURIComponent(query)}`;

  console.log(`[INFO] Sending request to ${url}`);

  const response = await payFetch(url, {
    method: "GET",
    network,
    asset,
    secretKey,
    autoFund,
  });

  const data = await response.json();

  console.log("[SUCCESS] Response:");
  printJson(data);
}

async function main() {
  const argv = process.argv.slice(2);
  const invokedAs = basename(process.argv[1] || "");
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (command === "setup") {
    await promptSetupWithArgs(argv.slice(1));
    return;
  }

  if (command === "whoami") {
    await runWhoAmI();
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "payer:check") {
    await runStoredPayerCheck();
    return;
  }

  if (command === "intent:create") {
    await runIntentCreate(argv.slice(1));
    return;
  }

  if (command === "intent:list") {
    await runIntentList();
    return;
  }

  if (command === "intent:get") {
    await runIntentGet(argv.slice(1));
    return;
  }

  if (command === "intent:execute") {
    await runIntentExecute(argv.slice(1));
    return;
  }

  if (command === "logout") {
    await runLogout();
    return;
  }

  if (command === "reset") {
    await runReset();
    return;
  }

  if (ENDPOINTS.has(command)) {
    await runEndpointCommand(command, argv.slice(1));
    return;
  }

  if (invokedAs === "client.js") {
    const endpoint = parseFlag(argv, "--endpoint") || "ai";
    await runEndpointCommand(endpoint, argv);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exitCode = 1;
});
