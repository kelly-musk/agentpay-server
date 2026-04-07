import "dotenv/config";
import {
  Asset,
  Contract,
  Horizon,
  Keypair,
  Operation,
  scValToNative,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { randomUUID } from "crypto";
import { encodePaymentHeader, STELLAR_NETWORKS } from "x402-stellar";

function normalizeNetwork(network) {
  if (!network || network === "testnet") {
    return "stellar-testnet";
  }

  if (network === "mainnet") {
    return "stellar";
  }

  return network;
}

function parseAmountFromBaseUnits(amount, decimals) {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

function getNetworkConfig(network) {
  const normalized = normalizeNetwork(network);
  const config = STELLAR_NETWORKS[normalized];

  if (!config) {
    throw new Error(`Unsupported Stellar network: ${network}`);
  }

  return { id: normalized, ...config };
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

async function getLatestLedger(horizonServer) {
  const page = await horizonServer.ledgers().order("desc").limit(1).call();
  const latest = page.records?.[0];

  if (!latest) {
    throw new Error("Unable to determine the latest Stellar ledger");
  }

  return Number.parseInt(latest.sequence, 10);
}

async function maybeFundPayer(rpcServer, networkId, publicKey, autoFund) {
  if (!autoFund || networkId !== "stellar-testnet") {
    return;
  }

  await rpcServer.fundAddress(publicKey);
}

async function checkTokenBalance({
  publicKey,
  requirements,
  networkConfig,
}) {
  const horizonServer = new Horizon.Server(networkConfig.horizonUrl);
  const rpcServer = new rpc.Server(networkConfig.sorobanRpcUrl);
  const account = await horizonServer.loadAccount(publicKey);
  const contract = new Contract(requirements.asset);
  const simulationTransaction = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "balance",
        nativeToScVal(publicKey, { type: "address" }),
      ),
    )
    .setTimeout(0)
    .build();

  const simulation = await rpcServer.simulateTransaction(simulationTransaction);

  if (simulation.error) {
    if (String(simulation.error).includes("trustline entry is missing for account")) {
      throw new Error(
        `The payer account ${publicKey} is missing the trustline for asset ${requirements.asset}. Add the token trustline before retrying.`,
      );
    }

    throw new Error(`Unable to simulate token balance: ${simulation.error}`);
  }

  const balance = BigInt(scValToNative(simulation.result.retval).toString());
  const requiredAmount = BigInt(requirements.maxAmountRequired);

  if (balance < requiredAmount) {
    throw new Error(
      `The payer account ${publicKey} has insufficient ${requirements.asset} balance. Required ${formatUnits(requiredAmount, 7)}, available ${formatUnits(balance, 7)}.`,
    );
  }
}

async function preflightPayment({
  keypair,
  requirements,
  networkConfig,
  autoFund,
}) {
  const rpcServer = new rpc.Server(networkConfig.sorobanRpcUrl);

  await maybeFundPayer(rpcServer, networkConfig.id, keypair.publicKey(), autoFund);

  if (requirements.asset === "native") {
    const horizonServer = new Horizon.Server(networkConfig.horizonUrl);

    try {
      await horizonServer.loadAccount(keypair.publicKey());
    } catch (error) {
      const message = String(error.message || error);

      if (message.includes("Not Found")) {
        throw new Error(
          `The payer account ${keypair.publicKey()} was not found on ${networkConfig.id}. Export STELLAR_SECRET_KEY for a funded testnet account, or run with AUTO_FUND_TESTNET_ACCOUNTS=true for demo mode.`,
        );
      }

      throw error;
    }

    return;
  }

  await checkTokenBalance({
    publicKey: keypair.publicKey(),
    requirements,
    networkConfig,
  });
}

async function buildNativePaymentPayload({
  keypair,
  requirements,
  networkConfig,
}) {
  const horizonServer = new Horizon.Server(networkConfig.horizonUrl);
  const account = await horizonServer.loadAccount(keypair.publicKey());
  const baseFee = await horizonServer.fetchBaseFee();
  const currentLedger = await getLatestLedger(horizonServer);
  const validUntilLedger = currentLedger + 120;
  const amount = parseAmountFromBaseUnits(requirements.maxAmountRequired, 7);

  const builtTransaction = new TransactionBuilder(account, {
    fee: String(baseFee),
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: requirements.payTo,
        asset: Asset.native(),
        amount,
      }),
    )
    .setLedgerbounds(currentLedger, validUntilLedger)
    .setTimeout(0)
    .build();

  builtTransaction.sign(keypair);

  return {
    x402Version: 1,
    scheme: "exact",
    network: networkConfig.id,
    payload: {
      signedTxXdr: builtTransaction.toXDR(),
      sourceAccount: keypair.publicKey(),
      amount: requirements.maxAmountRequired,
      destination: requirements.payTo,
      asset: requirements.asset,
      validUntilLedger,
      nonce: randomUUID(),
    },
  };
}

async function buildContractPaymentPayload({
  keypair,
  requirements,
  networkConfig,
}) {
  const horizonServer = new Horizon.Server(networkConfig.horizonUrl);
  const rpcServer = new rpc.Server(networkConfig.sorobanRpcUrl);
  const account = await horizonServer.loadAccount(keypair.publicKey());
  const currentLedger = await getLatestLedger(horizonServer);
  const validUntilLedger = currentLedger + 120;
  const contract = new Contract(requirements.asset);

  const rawTransaction = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "transfer",
        nativeToScVal(keypair.publicKey(), { type: "address" }),
        nativeToScVal(requirements.payTo, { type: "address" }),
        nativeToScVal(BigInt(requirements.maxAmountRequired), { type: "i128" }),
      ),
    )
    .setLedgerbounds(currentLedger, validUntilLedger)
    .setTimeout(0)
    .build();

  let preparedTransaction;
  try {
    preparedTransaction = await rpcServer.prepareTransaction(rawTransaction);
  } catch (error) {
    if (String(error.message).includes("trustline entry is missing for account")) {
      throw new Error(
        `The payer account ${keypair.publicKey()} is missing a trustline or balance for asset ${requirements.asset}. Fund the payer with that Stellar token before retrying.`,
      );
    }

    throw error;
  }

  preparedTransaction.sign(keypair);

  return {
    x402Version: 1,
    scheme: "exact",
    network: networkConfig.id,
    payload: {
      signedTxXdr: preparedTransaction.toXDR(),
      sourceAccount: keypair.publicKey(),
      amount: requirements.maxAmountRequired,
      destination: requirements.payTo,
      asset: requirements.asset,
      validUntilLedger: preparedTransaction.ledgerBounds.maxLedger,
      nonce: randomUUID(),
    },
  };
}

async function createPaymentPayload(requirements, options) {
  const networkConfig = getNetworkConfig(options.network || requirements.network);
  const secretKey = options.secretKey || process.env.STELLAR_SECRET_KEY;
  const autoFund = options.autoFund ?? process.env.AUTO_FUND_TESTNET_ACCOUNTS === "true";

  if (!secretKey && !autoFund) {
    throw new Error(
      "No payer credentials found. Export STELLAR_SECRET_KEY for your funded wallet, or run with AUTO_FUND_TESTNET_ACCOUNTS=true for demo mode.",
    );
  }

  const keypair = secretKey ? Keypair.fromSecret(secretKey) : Keypair.random();

  await preflightPayment({
    keypair,
    requirements,
    networkConfig,
    autoFund,
  });

  if (requirements.asset === "native") {
    return buildNativePaymentPayload({
      keypair,
      requirements,
      networkConfig,
    });
  }

  return buildContractPaymentPayload({
    keypair,
    requirements,
    networkConfig,
  });
}

export async function payFetch(url, options = {}) {
  const {
    network,
    asset,
    secretKey,
    autoFund,
    headers,
    ...fetchOptions
  } = options;

  const initialResponse = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (initialResponse.status !== 402) {
    return initialResponse;
  }

  const challenge = await initialResponse.json();
  const requirements = challenge.accepts?.[0];

  if (!requirements) {
    throw new Error("No payment requirements were returned by the gateway");
  }

  const paymentPayload = await createPaymentPayload(requirements, {
    network,
    asset,
    secretKey,
    autoFund,
  });

  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...(headers || {}),
      "x-payment": encodePaymentHeader(paymentPayload),
    },
  });
}
