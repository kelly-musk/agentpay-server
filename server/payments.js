import {
  Asset,
  Contract,
  Horizon,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  PaymentPayloadSchema,
  STELLAR_NETWORKS,
  STELLAR_TOKENS,
  decodePaymentHeader,
  useFacilitator,
} from "x402-stellar";
import {
  createEndpointCatalog,
  getEndpointConfigFromCatalog,
  getPriceUsdFromCatalog,
  listEndpointsFromCatalog,
} from "./pricing.js";

const DISCOVERY_UPDATED_AT = Date.now();
export const CONTRACT_VERSIONS = Object.freeze({
  RECEIPT: "1.0.0",
  CAPABILITIES: "1.0.0",
  MANIFEST: "1.0.0",
  REGISTRY_EXPORT: "1.0.0",
  DISCOVERY: "1.0.0",
});
export const NETWORK_IDS = Object.freeze({
  BASE_SEPOLIA: "base-sepolia",
  BASE_MAINNET: "base",
  SOLANA_DEVNET: "solana-devnet",
  STELLAR_TESTNET: "stellar-testnet",
  STELLAR_MAINNET: "stellar",
});
export const SUPPORTED_NETWORK_IDS = Object.freeze([
  NETWORK_IDS.STELLAR_TESTNET,
  NETWORK_IDS.STELLAR_MAINNET,
]);
export const CLASSIC_ASSET_IDS = Object.freeze({
  USDC: "USDC",
});
export const CLASSIC_STELLAR_ASSETS = Object.freeze({
  [NETWORK_IDS.STELLAR_TESTNET]: Object.freeze({
    [CLASSIC_ASSET_IDS.USDC]: Object.freeze({
      code: "USDC",
      issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      symbol: "USDC",
      name: "USD Coin",
    }),
  }),
  [NETWORK_IDS.STELLAR_MAINNET]: Object.freeze({}),
});

export function isSupportedNetworkId(network) {
  return SUPPORTED_NETWORK_IDS.includes(normalizeNetwork(network));
}

function normalizeNetwork(network) {
  if (network === "testnet") {
    return "stellar-testnet";
  }

  return network;
}

function normalizeAssetConfig(network, rawAsset) {
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
      symbol: process.env.X402_ASSET_SYMBOL || "TOKEN",
      decimals: Number.parseInt(process.env.X402_ASSET_DECIMALS || "7", 10),
      displayName: process.env.X402_ASSET_NAME || "Custom Stellar Token",
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

function assertValidUrl(name, value) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid ${name}: expected an absolute URL`);
  }
}

function assertOptionalString(name, value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid ${name}: expected a string`);
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function assertOptionalUrl(name, value) {
  const normalized = assertOptionalString(name, value);
  return normalized ? assertValidUrl(name, normalized) : null;
}

function assertOptionalEmail(name, value) {
  const normalized = assertOptionalString(name, value);

  if (!normalized) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`Invalid ${name}: expected an email address`);
  }

  return normalized;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function assertOptionalId(name, value) {
  const normalized = assertOptionalString(name, value);

  if (!normalized) {
    return null;
  }

  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`Invalid ${name}: expected letters, numbers, dot, underscore, or dash`);
  }

  return normalized;
}

function validateAssetConfig(asset) {
  if (!asset || typeof asset !== "object") {
    throw new Error("Invalid asset config: expected an object");
  }

  if (!asset.address || typeof asset.address !== "string") {
    throw new Error("Invalid asset config: missing address");
  }

  if (!asset.symbol || typeof asset.symbol !== "string") {
    throw new Error("Invalid asset config: missing symbol");
  }

  if (!Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 18) {
    throw new Error("Invalid asset config: decimals must be an integer between 0 and 18");
  }

  if (!asset.displayName || typeof asset.displayName !== "string") {
    throw new Error("Invalid asset config: missing displayName");
  }
}

function validateProviderMetadata(provider = {}) {
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    throw new Error("Invalid provider config: expected an object");
  }

  return {
    id: assertOptionalId("provider.id", provider.id),
    name: assertOptionalString("provider.name", provider.name),
    description: assertOptionalString("provider.description", provider.description),
    websiteUrl: assertOptionalUrl("provider.websiteUrl", provider.websiteUrl),
    supportUrl: assertOptionalUrl("provider.supportUrl", provider.supportUrl),
    supportEmail: assertOptionalEmail("provider.supportEmail", provider.supportEmail),
  };
}

function validateServiceMetadata(service = {}) {
  if (!service || typeof service !== "object" || Array.isArray(service)) {
    throw new Error("Invalid service config: expected an object");
  }

  return {
    id: assertOptionalId("service.id", service.id),
    name: assertOptionalString("service.name", service.name),
    description: assertOptionalString("service.description", service.description),
    version: assertOptionalString("service.version", service.version),
    category: assertOptionalString("service.category", service.category),
    tags: normalizeStringArray(service.tags),
    audience: normalizeStringArray(service.audience),
    documentationUrl: assertOptionalUrl("service.documentationUrl", service.documentationUrl),
  };
}

export function validateGatewayConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid gateway config: expected an object");
  }

  if (!config.network) {
    throw new Error(
      `Missing required network: set config.network or X402_NETWORK to one of ${SUPPORTED_NETWORK_IDS.join(", ")}`,
    );
  }

  const network = normalizeNetwork(config.network);

  if (!isSupportedNetworkId(network) || !STELLAR_NETWORKS[network]) {
    throw new Error(
      `Unsupported network: ${network}. This package currently supports ${SUPPORTED_NETWORK_IDS.join(", ")}.`,
    );
  }

  if (!config.walletAddress) {
    throw new Error("Missing required walletAddress");
  }

  if (!StrKey.isValidEd25519PublicKey(config.walletAddress)) {
    throw new Error("Invalid walletAddress: expected a Stellar public key");
  }

  const port = Number.parseInt(String(config.port ?? "3000"), 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Invalid port: expected an integer between 1 and 65535");
  }

  const gatewayUrl = assertValidUrl(
    "gatewayUrl",
    config.gatewayUrl || "http://localhost:3000",
  );
  const facilitatorUrl = assertValidUrl(
    "facilitatorUrl",
    config.facilitatorUrl || "https://facilitator.stellar-x402.org",
  );

  validateAssetConfig(config.asset);
  const provider = validateProviderMetadata(config.provider || {});
  const service = validateServiceMetadata(config.service || {});

  return {
    ...config,
    port,
    network,
    gatewayUrl,
    facilitatorUrl,
    provider,
    service,
  };
}

function toBaseUnits(displayAmount, decimals) {
  const [wholePart, fractionPart = ""] = displayAmount.split(".");
  const paddedFraction = (fractionPart + "0".repeat(decimals)).slice(0, decimals);
  const whole = BigInt(wholePart || "0") * 10n ** BigInt(decimals);
  const fraction = BigInt(paddedFraction || "0");

  return (whole + fraction).toString();
}

function fromBaseUnits(baseAmount, decimals) {
  const value = String(baseAmount || "0");
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = decimals > 0 ? padded.slice(-decimals).replace(/0+$/, "") : "";
  const display = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${display}` : display;
}

function getExplorerUrls(network, transactionHash, account) {
  if (network === NETWORK_IDS.STELLAR_TESTNET) {
    return {
      transaction: `https://testnet.stellar.expert/explorer/testnet/tx/${transactionHash}`,
      account: account
        ? `https://testnet.stellar.expert/explorer/testnet/account/${account}`
        : undefined,
    };
  }

  if (network === NETWORK_IDS.STELLAR_MAINNET) {
    return {
      transaction: `https://stellar.expert/explorer/public/tx/${transactionHash}`,
      account: account
        ? `https://stellar.expert/explorer/public/account/${account}`
        : undefined,
    };
  }

  return {
    transaction: undefined,
    account: undefined,
  };
}

function extractLedgerDetails(result = {}) {
  return {
    ledger: result.ledger
      ?? result.ledgerSeq
      ?? result.latestLedger
      ?? result.ledgerSequence
      ?? null,
    ledgerCloseTime: result.created_at
      ?? result.createdAt
      ?? result.closedAt
      ?? result.ledgerCloseTime
      ?? null,
  };
}

function createRpcServer(network) {
  return new rpc.Server(STELLAR_NETWORKS[network].sorobanRpcUrl);
}

async function simulateTokenBalanceForAccount({
  network,
  account,
  publicKey,
  asset,
  rpcServer = createRpcServer(network),
}) {
  const contract = new Contract(asset.address);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: STELLAR_NETWORKS[network].networkPassphrase,
  })
    .addOperation(
      contract.call(
        "balance",
        nativeToScVal(publicKey, { type: "address" }),
      ),
    )
    .setTimeout(0)
    .build();

  return rpcServer.simulateTransaction(tx);
}

function resolveTrustlineAssetConfig(config) {
  const classicAssetId = process.env.MERCHANT_CLASSIC_ASSET;
  const registryAsset = classicAssetId
    ? CLASSIC_STELLAR_ASSETS[config.network]?.[classicAssetId]
    : null;

  if (registryAsset) {
    return { code: registryAsset.code, issuer: registryAsset.issuer };
  }

  const code = process.env.MERCHANT_ASSET_CODE
    || process.env.X402_ASSET_CODE
    || process.env.X402_ASSET_TRUSTLINE_CODE;
  const issuer = process.env.MERCHANT_ASSET_ISSUER
    || process.env.X402_ASSET_ISSUER
    || process.env.X402_ASSET_TRUSTLINE_ISSUER;

  if (!code || !issuer) {
    return null;
  }

  return { code, issuer };
}

function resolveMerchantWalletSecret() {
  return process.env.MERCHANT_WALLET_SECRET_KEY
    || process.env.WALLET_SECRET_KEY
    || process.env.STELLAR_SECRET_KEY;
}

async function ensurePayeeTrustline({
  config,
  network,
  horizonServer,
  account,
  trustlineAsset,
}) {
  const merchantSecret = resolveMerchantWalletSecret();

  if (!merchantSecret) {
    throw new Error(
      "Automatic trustline setup requires MERCHANT_WALLET_SECRET_KEY for the payee wallet",
    );
  }

  const keypair = Keypair.fromSecret(merchantSecret);

  if (keypair.publicKey() !== config.walletAddress) {
    throw new Error("Configured payee secret does not match walletAddress");
  }

  const asset = new Asset(trustlineAsset.code, trustlineAsset.issuer);
  const transaction = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: STELLAR_NETWORKS[network].networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();

  transaction.sign(keypair);

  return horizonServer.submitTransaction(transaction);
}

export async function checkPayeeAssetReadiness(
  config,
  {
    horizonServer = new Horizon.Server(STELLAR_NETWORKS[config.network].horizonUrl),
    rpcServer = createRpcServer(config.network),
    autoCreateTrustline = process.env.AUTO_CREATE_PAYEE_TRUSTLINE === "true",
    trustlineAsset = resolveTrustlineAssetConfig(config),
  } = {},
) {
  let account;

  try {
    account = await horizonServer.loadAccount(config.walletAddress);
  } catch (error) {
    if (String(error.message || error).includes("Not Found")) {
      return {
        ok: false,
        status: "missing_account",
        payee: config.walletAddress,
        asset: config.asset.symbol,
        nextStep: `Fund the payee account ${config.walletAddress} on ${config.network} before accepting payments.`,
      };
    }

    throw error;
  }

  if (config.asset.address === "native") {
    return {
      ok: true,
      status: "ready",
      payee: config.walletAddress,
      asset: config.asset.symbol,
    };
  }

  const simulation = await simulateTokenBalanceForAccount({
    network: config.network,
    account,
    publicKey: config.walletAddress,
    asset: config.asset,
    rpcServer,
  });

  if (!simulation.error) {
    return {
      ok: true,
      status: "ready",
      payee: config.walletAddress,
      asset: config.asset.symbol,
    };
  }

  if (String(simulation.error).includes("trustline entry is missing for account")) {
    if (autoCreateTrustline) {
      if (!trustlineAsset) {
        return {
          ok: false,
          status: "missing_trustline",
          payee: config.walletAddress,
          asset: config.asset.symbol,
          nextStep:
            "Automatic trustline setup requires MERCHANT_CLASSIC_ASSET for a known registry asset, or MERCHANT_ASSET_CODE and MERCHANT_ASSET_ISSUER for a custom classic asset.",
        };
      }

      await ensurePayeeTrustline({
        config,
        network: config.network,
        horizonServer,
        account,
        trustlineAsset,
      });

      return {
        ok: true,
        status: "trustline_created",
        payee: config.walletAddress,
        asset: config.asset.symbol,
        trustlineAsset,
      };
    }

    return {
      ok: false,
      status: "missing_trustline",
      payee: config.walletAddress,
      asset: config.asset.symbol,
      nextStep:
        `The payee wallet ${config.walletAddress} cannot receive ${config.asset.symbol} yet. ` +
        "Add the required trustline first, or enable AUTO_CREATE_PAYEE_TRUSTLINE=true and configure MERCHANT_WALLET_SECRET_KEY plus MERCHANT_CLASSIC_ASSET (or MERCHANT_ASSET_CODE/MERCHANT_ASSET_ISSUER for a custom classic asset).",
    };
  }

  return {
    ok: false,
    status: "unready",
    payee: config.walletAddress,
    asset: config.asset.symbol,
    error: String(simulation.error),
    nextStep: "Resolve the payee wallet asset configuration before accepting payments.",
  };
}

export function createPaymentReceipt(config, paymentRequirements, details = {}) {
  const amountBaseUnits = String(
    details.amountBaseUnits
      ?? paymentRequirements?.maxAmountRequired
      ?? "0",
  );
  const transactionHash = details.transactionHash || details.transaction || null;
  const payer = details.payer || null;
  const payee = details.payee || paymentRequirements?.payTo || config.walletAddress;
  const assetAddress = details.assetAddress || paymentRequirements?.asset || config.asset.address;
  const explorer = transactionHash
    ? getExplorerUrls(config.network, transactionHash, payer)
    : { transaction: undefined, account: undefined };

  return {
    version: CONTRACT_VERSIONS.RECEIPT,
    receiptId: transactionHash ? `${config.network}:${transactionHash}` : null,
    status: details.status || "confirmed",
    confirmed: details.confirmed ?? true,
    network: config.network,
    scheme: paymentRequirements?.scheme || "exact",
    transactionHash,
    ledger: details.ledger ?? null,
    ledgerCloseTime: details.ledgerCloseTime || null,
    submittedAt: details.submittedAt || null,
    finalizedAt: details.finalizedAt || new Date().toISOString(),
    payer,
    payee,
    asset: {
      address: assetAddress,
      symbol: config.asset.symbol,
      displayName: config.asset.displayName,
      decimals: config.asset.decimals,
    },
    amount: {
      requested: paymentRequirements?.extra?.priceUsd || null,
      display: fromBaseUnits(amountBaseUnits, config.asset.decimals),
      baseUnits: amountBaseUnits,
    },
    resource: paymentRequirements?.resource || null,
    endpoint: paymentRequirements?.extra?.endpoint || null,
    intentId: paymentRequirements?.extra?.intentId || null,
    flow: paymentRequirements?.extra?.flow || "direct",
    explorer,
    raw: details.raw || undefined,
  };
}

function buildOutputSchema(assetSymbol) {
  return {
    type: "object",
    properties: {
      success: { type: "boolean" },
      endpoint: { type: "string" },
      payment: {
        type: "object",
        properties: {
          status: { type: "string" },
          network: { type: "string" },
          asset: { type: "string" },
          amount: { type: "string" },
          receipt: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      result: {},
    },
    required: ["success", "endpoint", "payment", "result"],
    additionalProperties: true,
    assetSymbol,
  };
}

function buildEndpointServiceMetadata(endpoint) {
  return {
    category: endpoint.category || "general",
    billingUnit: endpoint.billingUnit || "request",
    audience: Array.isArray(endpoint.audience) ? endpoint.audience : ["agents", "developers"],
    tags: Array.isArray(endpoint.tags) ? endpoint.tags : [],
    useCases: Array.isArray(endpoint.useCases) ? endpoint.useCases : [],
    examples: Array.isArray(endpoint.examples) ? endpoint.examples : [],
    inputSchema: endpoint.inputSchema || null,
    outputSchema: endpoint.outputSchema || null,
  };
}

function getProviderMetadata(config) {
  const provider = config.provider || {};

  return {
    id: provider.id || "stellar-oxide-gateway-provider",
    name: provider.name || "Stellar Oxide Gateway Provider",
    description: provider.description || "Stellar Oxide Gateway-compatible paid service provider",
    websiteUrl: provider.websiteUrl || null,
    supportUrl: provider.supportUrl || null,
    supportEmail: provider.supportEmail || null,
  };
}

function getServiceMetadata(config, endpointCatalog) {
  const service = config.service || {};

  return {
    id: service.id || "stellar-oxide-gateway-service",
    name: service.name || "Stellar Oxide Gateway Service",
    description: service.description || "Paid agent service powered by Stellar Oxide Gateway",
    version: service.version || "1.0.0",
    category: service.category || "paid-agent-api",
    tags: Array.isArray(service.tags) ? service.tags : [],
    audience: Array.isArray(service.audience) ? service.audience : ["agents", "developers"],
    documentationUrl: service.documentationUrl || null,
    routeCount: Object.keys(endpointCatalog).length,
  };
}

export function loadGatewayConfig() {
  const rawNetwork = process.env.X402_NETWORK;
  const network = normalizeNetwork(rawNetwork);

  if (!network) {
    throw new Error(
      `Missing required X402_NETWORK. Supported values: ${SUPPORTED_NETWORK_IDS.join(", ")}`,
    );
  }

  const asset = normalizeAssetConfig(network, process.env.X402_ASSET);
  const walletAddress = process.env.WALLET_ADDRESS;

  return validateGatewayConfig({
    port: Number.parseInt(process.env.PORT || "3000", 10),
    gatewayUrl: process.env.GATEWAY_URL || "http://localhost:3000",
    rustServiceUrl: process.env.RUST_SERVICE_URL || "",
    facilitatorUrl:
      process.env.FACILITATOR_URL || "https://facilitator.stellar-x402.org",
    network,
    walletAddress,
    asset,
  });
}

export function createPaymentContext(rawConfig) {
  const config = validateGatewayConfig(rawConfig);
  const facilitator = useFacilitator({ url: config.facilitatorUrl });
  const seenNonces = new Set();
  const endpointCatalog = config.endpointCatalog || createEndpointCatalog();

  async function getLatestLedger() {
    const horizonServer = new Horizon.Server(
      STELLAR_NETWORKS[config.network].horizonUrl,
    );
    const page = await horizonServer.ledgers().order("desc").limit(1).call();
    const latest = page.records?.[0];

    if (!latest) {
      throw new Error("Unable to determine the latest Stellar ledger");
    }

    return Number.parseInt(latest.sequence, 10);
  }

  function parseNativeTransaction(signedTxXdr) {
    return TransactionBuilder.fromXDR(
      signedTxXdr,
      STELLAR_NETWORKS[config.network].networkPassphrase,
    );
  }

  function parseContractTransaction(signedTxXdr) {
    return TransactionBuilder.fromXDR(
      signedTxXdr,
      STELLAR_NETWORKS[config.network].networkPassphrase,
    );
  }

  function readContractTransfer(transaction) {
    const operation = transaction.operations?.[0];

    if (!operation || operation.type !== "invokeHostFunction") {
      throw new Error(
        `invalid_payment: expected invokeHostFunction, got ${operation?.type || "missing_operation"}`,
      );
    }

    const invokeHostFunction =
      operation.func && typeof operation.func.value === "function"
        ? operation.func.value()
        : operation.func;

    if (
      !invokeHostFunction ||
      typeof invokeHostFunction.functionName !== "function" ||
      typeof invokeHostFunction.args !== "function" ||
      typeof invokeHostFunction.contractAddress !== "function"
    ) {
      throw new Error("invalid_payment: invokeHostFunction shape was not readable");
    }

    const invoke = invokeHostFunction;
    const contractAddress = StrKey.encodeContract(
      invoke.contractAddress().contractId(),
    );
    const functionName = String(invoke.functionName()).trim();
    const args = invoke.args();

    if (!Array.isArray(args) || args.length < 3) {
      throw new Error(`invalid_payment: expected 3 transfer args, got ${args?.length ?? "unknown"}`);
    }

    return {
      contractAddress,
      functionName,
      from: scValToNative(args[0]),
      to: scValToNative(args[1]),
      amount: scValToNative(args[2]).toString(),
      auth: operation.auth,
    };
  }

  async function verifyNativePayment(paymentPayload, paymentRequirements) {
    const parsed = PaymentPayloadSchema.safeParse(paymentPayload);
    if (!parsed.success) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
      };
    }

    const payload = parsed.data;

    if (payload.network !== config.network) {
      return { isValid: false, invalidReason: "invalid_network" };
    }

    if (payload.payload.destination !== paymentRequirements.payTo) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_destination_mismatch",
      };
    }

    if (payload.payload.amount !== paymentRequirements.maxAmountRequired) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_amount_mismatch",
      };
    }

    if (payload.payload.asset !== paymentRequirements.asset) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_asset_mismatch",
      };
    }

    if (seenNonces.has(payload.payload.nonce)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_transaction_already_used",
      };
    }

    if ((await getLatestLedger()) > payload.payload.validUntilLedger) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_transaction_expired",
      };
    }

    try {
      const transaction = parseNativeTransaction(payload.payload.signedTxXdr);
      const operation = transaction.operations?.[0];

      if (!transaction.signatures?.length) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_missing_required_fields",
        };
      }

      if (!operation || operation.type !== "payment") {
        return {
          isValid: false,
          invalidReason: "invalid_payment",
        };
      }

      if (transaction.source !== payload.payload.sourceAccount) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_missing_required_fields",
        };
      }

      if (operation.destination !== paymentRequirements.payTo) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_destination_mismatch",
        };
      }

      if (!operation.asset.equals(Asset.native())) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_asset_mismatch",
        };
      }

      if (toBaseUnits(operation.amount, 7) !== paymentRequirements.maxAmountRequired) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_amount_mismatch",
        };
      }

      return {
        isValid: true,
        payer: payload.payload.sourceAccount,
      };
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_invalid_xdr",
      };
    }
  }

  async function verifyContractPayment(paymentPayload, paymentRequirements) {
    const parsed = PaymentPayloadSchema.safeParse(paymentPayload);
    if (!parsed.success) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
      };
    }

    const payload = parsed.data;

    if (payload.network !== config.network) {
      return { isValid: false, invalidReason: "invalid_network" };
    }

    if (payload.payload.destination !== paymentRequirements.payTo) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_destination_mismatch",
      };
    }

    if (payload.payload.amount !== paymentRequirements.maxAmountRequired) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_amount_mismatch",
      };
    }

    if (payload.payload.asset !== paymentRequirements.asset) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_asset_mismatch",
      };
    }

    if (seenNonces.has(payload.payload.nonce)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_transaction_already_used",
      };
    }

    if ((await getLatestLedger()) > payload.payload.validUntilLedger) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_transaction_expired",
      };
    }

    try {
      const transaction = parseContractTransaction(payload.payload.signedTxXdr);
      const transfer = readContractTransfer(transaction);

      if (!transaction.signatures?.length) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_missing_required_fields",
        };
      }

      if (transaction.source !== payload.payload.sourceAccount) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_missing_required_fields",
        };
      }

      if (transfer.functionName !== "transfer") {
        return {
          isValid: false,
          invalidReason: `invalid_payment: unexpected contract function ${transfer.functionName}`,
        };
      }

      if (transfer.contractAddress !== paymentRequirements.asset) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_asset_mismatch",
        };
      }

      if (transfer.from !== payload.payload.sourceAccount) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_missing_required_fields",
        };
      }

      if (transfer.to !== paymentRequirements.payTo) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_destination_mismatch",
        };
      }

      if (transfer.amount !== paymentRequirements.maxAmountRequired) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_amount_mismatch",
        };
      }

      return {
        isValid: true,
        payer: payload.payload.sourceAccount,
      };
    } catch (error) {
      console.error("Contract payment verification error:", error);

      if (String(error.message).startsWith("invalid_payment")) {
        return {
          isValid: false,
          invalidReason: error.message,
        };
      }

      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_invalid_xdr",
      };
    }
  }

  async function settleNativePayment(paymentPayload, paymentRequirements) {
    const parsed = PaymentPayloadSchema.parse(paymentPayload);
    const horizonServer = new Horizon.Server(
      STELLAR_NETWORKS[config.network].horizonUrl,
    );
    const transaction = parseNativeTransaction(parsed.payload.signedTxXdr);
    const response = await horizonServer.submitTransaction(transaction);

    seenNonces.add(parsed.payload.nonce);

    const { ledger, ledgerCloseTime } = extractLedgerDetails(response);
    const receipt = createPaymentReceipt(config, paymentRequirements, {
      transactionHash: response.hash,
      payer: parsed.payload.sourceAccount,
      payee: parsed.payload.destination,
      amountBaseUnits: parsed.payload.amount,
      ledger,
      ledgerCloseTime,
      submittedAt: response.created_at || new Date().toISOString(),
      finalizedAt: response.created_at || new Date().toISOString(),
      raw: {
        envelopeXdr: response.envelope_xdr,
        resultXdr: response.result_xdr,
      },
    });

    return {
      success: true,
      payer: parsed.payload.sourceAccount,
      transaction: response.hash,
      network: config.network,
      receipt,
    };
  }

  async function settleContractPayment(paymentPayload, paymentRequirements) {
    const parsed = PaymentPayloadSchema.parse(paymentPayload);
    const rpcServer = new rpc.Server(
      STELLAR_NETWORKS[config.network].sorobanRpcUrl,
    );
    const transaction = parseContractTransaction(parsed.payload.signedTxXdr);
    const submission = await rpcServer.sendTransaction(transaction);
    const transactionHash =
      submission.hash || submission.txHash || submission.transactionHash;

    if (!transactionHash) {
      throw new Error("Soroban transaction submission did not return a hash");
    }

    let status = submission.status || "PENDING";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (status === "SUCCESS") {
        seenNonces.add(parsed.payload.nonce);
        const { ledger, ledgerCloseTime } = extractLedgerDetails(submission);
        const receipt = createPaymentReceipt(config, paymentRequirements, {
          transactionHash,
          payer: parsed.payload.sourceAccount,
          payee: parsed.payload.destination,
          amountBaseUnits: parsed.payload.amount,
          ledger,
          ledgerCloseTime,
          submittedAt: new Date().toISOString(),
          finalizedAt: new Date().toISOString(),
          raw: {
            submissionStatus: submission.status,
          },
        });
        return {
          success: true,
          payer: parsed.payload.sourceAccount,
          transaction: transactionHash,
          network: config.network,
          receipt,
        };
      }

      if (status === "FAILED") {
        throw new Error(`Soroban transaction ${transactionHash} failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const polled = await rpcServer.getTransaction(transactionHash);
      status = polled.status;

      if (status === "SUCCESS") {
        seenNonces.add(parsed.payload.nonce);
        const { ledger, ledgerCloseTime } = extractLedgerDetails(polled);
        const receipt = createPaymentReceipt(config, paymentRequirements, {
          transactionHash,
          payer: parsed.payload.sourceAccount,
          payee: parsed.payload.destination,
          amountBaseUnits: parsed.payload.amount,
          ledger,
          ledgerCloseTime,
          submittedAt: new Date().toISOString(),
          finalizedAt: new Date().toISOString(),
          raw: {
            status,
          },
        });
        return {
          success: true,
          payer: parsed.payload.sourceAccount,
          transaction: transactionHash,
          network: config.network,
          receipt,
        };
      }
    }

    seenNonces.add(parsed.payload.nonce);

    const receipt = createPaymentReceipt(config, paymentRequirements, {
      transactionHash,
      payer: parsed.payload.sourceAccount,
      payee: parsed.payload.destination,
      amountBaseUnits: parsed.payload.amount,
      submittedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      status: "submitted",
      confirmed: false,
      raw: {
        status,
      },
    });

    return {
      success: true,
      payer: parsed.payload.sourceAccount,
      transaction: transactionHash,
      network: config.network,
      receipt,
    };
  }

  function buildRequirementsForResource(resourceUrl, endpointId, query = "", options = {}) {
    const priceUsd = options.priceUsd || getPriceUsdFromCatalog(endpointCatalog, endpointId, query);
    const endpoint = getEndpointConfigFromCatalog(endpointCatalog, endpointId);
    const description =
      options.description || `Stellar Oxide Gateway ${endpoint.description}`;
    const outputSchema = options.outputSchema
      || endpoint.outputSchema
      || buildOutputSchema(config.asset.symbol);
    const service = buildEndpointServiceMetadata(endpoint);

    return {
      x402Version: 1,
      scheme: "exact",
      network: config.network,
      maxAmountRequired: toBaseUnits(priceUsd, config.asset.decimals),
      resource: resourceUrl,
      description,
      mimeType: "application/json",
      outputSchema,
      payTo: config.walletAddress,
      maxTimeoutSeconds: 60,
      asset: config.asset.address,
      extra: {
        endpoint: endpointId,
        pricingModel: "dynamic",
        queryLength: query.length,
        priceUsd,
        category: service.category,
        billingUnit: service.billingUnit,
        audience: service.audience,
        tags: service.tags,
        ...(options.extra || {}),
      },
    };
  }

  function buildRequirements(req, endpointId) {
    const query = String(req.query.q || "");
    const resourceUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    return buildRequirementsForResource(resourceUrl, endpointId, query);
  }

  function getCapabilities() {
    return {
      version: CONTRACT_VERSIONS.CAPABILITIES,
      service: "stellar-oxide-gateway",
      protocol: "x402-stellar",
      network: config.network,
      facilitator: config.facilitatorUrl,
      walletAddress: config.walletAddress,
      asset: config.asset,
      endpoints: listEndpointsFromCatalog(endpointCatalog).map((endpoint) => ({
        id: endpoint.id,
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        base_price: endpoint.basePriceUsd,
        service: buildEndpointServiceMetadata(endpoint),
      })),
    };
  }

  function getServiceManifest() {
    const provider = getProviderMetadata(config);
    const service = getServiceMetadata(config, endpointCatalog);
    const endpoints = listEndpointsFromCatalog(endpointCatalog);
    const manifestUrl = `${config.gatewayUrl}/.well-known/stellar-oxide-gateway.json`;

    return {
      manifestVersion: CONTRACT_VERSIONS.MANIFEST,
      generatedAt: new Date(DISCOVERY_UPDATED_AT).toISOString(),
      protocol: "x402-stellar",
      provider,
      service,
      compatibility: {
        networks: [config.network],
        assets: [
          {
            address: config.asset.address,
            symbol: config.asset.symbol,
            displayName: config.asset.displayName,
            decimals: config.asset.decimals,
          },
        ],
      },
      links: {
        manifest: manifestUrl,
        capabilities: `${config.gatewayUrl}/capabilities`,
        discovery: `${config.gatewayUrl}/discovery/resources`,
        readiness: `${config.gatewayUrl}/ready`,
        health: `${config.gatewayUrl}/health`,
      },
      routes: endpoints.map((endpoint) => ({
        id: endpoint.id,
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        basePriceUsd: endpoint.basePriceUsd,
        service: buildEndpointServiceMetadata(endpoint),
      })),
    };
  }

  function getRegistryExport() {
    const provider = getProviderMetadata(config);
    const service = getServiceMetadata(config, endpointCatalog);
    const manifest = getServiceManifest();
    const endpoints = listEndpointsFromCatalog(endpointCatalog);

    return {
      listingVersion: CONTRACT_VERSIONS.REGISTRY_EXPORT,
      exportedAt: new Date(DISCOVERY_UPDATED_AT).toISOString(),
      provider,
      service,
      protocol: "x402-stellar",
      network: config.network,
      asset: {
        address: config.asset.address,
        symbol: config.asset.symbol,
        displayName: config.asset.displayName,
        decimals: config.asset.decimals,
      },
      manifestUrl: manifest.links.manifest,
      capabilitiesUrl: manifest.links.capabilities,
      discoveryUrl: manifest.links.discovery,
      readinessUrl: manifest.links.readiness,
      healthUrl: manifest.links.health,
      categories: Array.from(new Set(endpoints.map((endpoint) => endpoint.category || "general"))),
      tags: Array.from(
        new Set(
          endpoints.flatMap((endpoint) => (Array.isArray(endpoint.tags) ? endpoint.tags : [])),
        ),
      ),
      routes: endpoints.map((endpoint) => ({
        id: endpoint.id,
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        basePriceUsd: endpoint.basePriceUsd,
        category: endpoint.category || "general",
        billingUnit: endpoint.billingUnit || "request",
        audience: Array.isArray(endpoint.audience) ? endpoint.audience : ["agents", "developers"],
        tags: Array.isArray(endpoint.tags) ? endpoint.tags : [],
        useCases: Array.isArray(endpoint.useCases) ? endpoint.useCases : [],
      })),
    };
  }

  function getDiscoveryResources() {
    return listEndpointsFromCatalog(endpointCatalog).map((endpoint) => ({
      resource: `${config.gatewayUrl}${endpoint.path}`,
      type: "http",
      version: CONTRACT_VERSIONS.DISCOVERY,
      x402Version: 1,
      accepts: [
        buildRequirementsForResource(`${config.gatewayUrl}${endpoint.path}`, endpoint.id),
      ],
      lastUpdated: DISCOVERY_UPDATED_AT,
      metadata: {
        endpoint: endpoint.id,
        method: endpoint.method,
        description: endpoint.description,
        pricingModel: "dynamic",
        service: buildEndpointServiceMetadata(endpoint),
      },
    }));
  }

  return {
    verify: (paymentPayload, paymentRequirements) => {
      if (config.asset.address === "native") {
        return verifyNativePayment(paymentPayload, paymentRequirements);
      }

      if (paymentRequirements.asset.startsWith("C")) {
        return verifyContractPayment(paymentPayload, paymentRequirements);
      }

      return facilitator.verify(paymentPayload, paymentRequirements);
    },
    settle: (paymentPayload, paymentRequirements) => {
      const guardPayeeReadiness = async () => {
        if (config.asset.address === "native") {
          return;
        }

        const readiness = await checkPayeeAssetReadiness(config);

        if (!readiness.ok) {
          throw new Error(readiness.nextStep || "Payee asset readiness check failed");
        }
      };

      if (config.asset.address === "native") {
        return settleNativePayment(paymentPayload, paymentRequirements);
      }

      if (paymentRequirements.asset.startsWith("C")) {
        return guardPayeeReadiness().then(() =>
          settleContractPayment(paymentPayload, paymentRequirements),
        );
      }

      return guardPayeeReadiness().then(() =>
        facilitator.settle(paymentPayload, paymentRequirements),
      );
    },
    buildRequirements,
    buildRequirementsForResource,
    getCapabilities,
    getServiceManifest,
    getRegistryExport,
    getDiscoveryResources,
    checkPayeeAssetReadiness: () => checkPayeeAssetReadiness(config),
  };
}

export function requirePayment(endpointId, paymentContext) {
  return requirePaymentWith(
    (req) => paymentContext.buildRequirements(req, endpointId),
    paymentContext,
  );
}

export function requirePaymentWith(buildRequirements, paymentContext) {
  return async (req, res, next) => {
    let requirements;

    try {
      requirements = await buildRequirements(req);
    } catch (error) {
      const message = String(error.message || error);
      const status = message === "Intent not found" ? 404 : 400;

      return res.status(status).json({
        error: message,
      });
    }

    const paymentHeader = req.headers["x-payment"];

    if (!paymentHeader) {
      return res.status(402).json({
        x402Version: 1,
        error: "Payment required",
        accepts: [requirements],
      });
    }

    try {
      const paymentPayload = decodePaymentHeader(paymentHeader);
      const verification = await paymentContext.verify(paymentPayload, requirements);

      if (!verification.isValid) {
        return res.status(402).json({
          x402Version: 1,
          error: "Invalid payment",
          reason: verification.invalidReason,
        });
      }

      req.paymentPayload = paymentPayload;
      req.paymentRequirements = requirements;
      req.pricing = {
        amount: requirements.extra.priceUsd,
        asset: paymentContext.getCapabilities().asset.symbol,
      };

      return next();
    } catch (error) {
      return res.status(402).json({
        x402Version: 1,
        error: "Payment verification failed",
        reason: error.message,
      });
    }
  };
}
