import {
  Contract,
  Horizon,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { STELLAR_NETWORKS, STELLAR_TOKENS } from "x402-stellar";

function normalizeNetwork(network) {
  if (!network || network === "testnet") {
    return "stellar-testnet";
  }

  if (network === "mainnet") {
    return "stellar";
  }

  return network;
}

function resolveAsset(network, rawAsset, overrides = {}) {
  const value = rawAsset || "native";

  if (value === "native") {
    return {
      address: "native",
      symbol: "XLM",
      decimals: 7,
      displayName: "Stellar Lumens",
    };
  }

  if (value.startsWith("C")) {
    return {
      address: value,
      symbol: overrides.assetSymbol || "TOKEN",
      decimals: Number.parseInt(overrides.assetDecimals || "7", 10),
      displayName: overrides.assetName || "Custom Stellar Token",
    };
  }

  const token = STELLAR_TOKENS[network]?.[value];

  if (!token) {
    throw new Error(`Unsupported asset ${value} for network ${network}`);
  }

  return {
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    displayName: token.name,
  };
}

function formatUnits(amount, decimals) {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

async function loadPayerAccount(horizonServer, publicKey, network) {
  try {
    return await horizonServer.loadAccount(publicKey);
  } catch (error) {
    if (String(error.message || error).includes("Not Found")) {
      return {
        status: "missing_account",
        nextStep: `Fund ${publicKey} on ${network} before retrying.`,
      };
    }

    throw error;
  }
}

async function getTokenBalance({
  account,
  publicKey,
  asset,
  networkPassphrase,
  sorobanRpcUrl,
}) {
  const server = new rpc.Server(sorobanRpcUrl);
  const contract = new Contract(asset.address);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "balance",
        nativeToScVal(publicKey, { type: "address" }),
      ),
    )
    .setTimeout(0)
    .build();

  const simulation = await server.simulateTransaction(tx);

  if (simulation.error) {
    if (String(simulation.error).includes("trustline entry is missing for account")) {
      return {
        status: "missing_trustline",
        nextStep: `Add the trustline for ${asset.address} (${asset.symbol}) and fund the payer with that token.`,
        tokenBalance: "0",
      };
    }

    throw new Error(`Unable to simulate token balance: ${simulation.error}`);
  }

  const balance = BigInt(scValToNative(simulation.result.retval).toString());

  return {
    status: balance > 0n ? "ready" : "ready",
    tokenBalance: formatUnits(balance, asset.decimals),
  };
}

export async function runPayerCheck({
  secretKey,
  network,
  asset,
  assetSymbol,
  assetDecimals,
  assetName,
}) {
  if (!secretKey) {
    throw new Error(
      "Missing payer credentials. Run `agentpay setup`, or export STELLAR_SECRET_KEY first.",
    );
  }

  const normalizedNetwork = normalizeNetwork(network);
  const networkConfig = STELLAR_NETWORKS[normalizedNetwork];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${normalizedNetwork}`);
  }

  const resolvedAsset = resolveAsset(normalizedNetwork, asset, {
    assetSymbol,
    assetDecimals,
    assetName,
  });
  const keypair = Keypair.fromSecret(secretKey);
  const publicKey = keypair.publicKey();
  const horizonServer = new Horizon.Server(networkConfig.horizonUrl);
  const account = await loadPayerAccount(horizonServer, publicKey, normalizedNetwork);

  if (account.status === "missing_account") {
    return {
      network: normalizedNetwork,
      payer: publicKey,
      asset: resolvedAsset.symbol,
      assetAddress: resolvedAsset.address,
      nativeBalance: "0",
      status: account.status,
      nextStep: account.nextStep,
    };
  }

  const nativeBalance =
    account.balances.find((balance) => balance.asset_type === "native")?.balance ||
    "0";

  const report = {
    network: normalizedNetwork,
    payer: publicKey,
    asset: resolvedAsset.symbol,
    assetAddress: resolvedAsset.address,
    nativeBalance,
    status: "ready",
  };

  if (resolvedAsset.address === "native") {
    return report;
  }

  const tokenStatus = await getTokenBalance({
    account,
    publicKey,
    asset: resolvedAsset,
    networkPassphrase: networkConfig.networkPassphrase,
    sorobanRpcUrl: networkConfig.sorobanRpcUrl,
  });

  return {
    ...report,
    tokenBalance: tokenStatus.tokenBalance,
    status: tokenStatus.status,
    nextStep: tokenStatus.nextStep,
  };
}
