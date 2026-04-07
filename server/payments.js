import {
  Asset,
  Horizon,
  StrKey,
  TransactionBuilder,
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

function normalizeNetwork(network) {
  if (network === "testnet") {
    return "stellar-testnet";
  }

  return network || "stellar-testnet";
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

export function validateGatewayConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid gateway config: expected an object");
  }

  const network = normalizeNetwork(config.network);

  if (!STELLAR_NETWORKS[network]) {
    throw new Error(`Unsupported network: ${network}`);
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

  return {
    ...config,
    port,
    network,
    gatewayUrl,
    facilitatorUrl,
  };
}

function toBaseUnits(displayAmount, decimals) {
  const [wholePart, fractionPart = ""] = displayAmount.split(".");
  const paddedFraction = (fractionPart + "0".repeat(decimals)).slice(0, decimals);
  const whole = BigInt(wholePart || "0") * 10n ** BigInt(decimals);
  const fraction = BigInt(paddedFraction || "0");

  return (whole + fraction).toString();
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
        },
      },
      result: {},
    },
    required: ["success", "endpoint", "payment", "result"],
    additionalProperties: true,
    assetSymbol,
  };
}

export function loadGatewayConfig() {
  const network = normalizeNetwork(process.env.X402_NETWORK);
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

  async function settleNativePayment(paymentPayload) {
    const parsed = PaymentPayloadSchema.parse(paymentPayload);
    const horizonServer = new Horizon.Server(
      STELLAR_NETWORKS[config.network].horizonUrl,
    );
    const transaction = parseNativeTransaction(parsed.payload.signedTxXdr);
    const response = await horizonServer.submitTransaction(transaction);

    seenNonces.add(parsed.payload.nonce);

    return {
      success: true,
      payer: parsed.payload.sourceAccount,
      transaction: response.hash,
      network: config.network,
    };
  }

  async function settleContractPayment(paymentPayload) {
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
        return {
          success: true,
          payer: parsed.payload.sourceAccount,
          transaction: transactionHash,
          network: config.network,
        };
      }

      if (status === "FAILED") {
        throw new Error(`Soroban transaction ${transactionHash} failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      const polled = await rpcServer.getTransaction(transactionHash);
      status = polled.status;
    }

    seenNonces.add(parsed.payload.nonce);

    return {
      success: true,
      payer: parsed.payload.sourceAccount,
      transaction: transactionHash,
      network: config.network,
    };
  }

  function buildRequirementsForResource(resourceUrl, endpointId, query = "", options = {}) {
    const priceUsd = options.priceUsd || getPriceUsdFromCatalog(endpointCatalog, endpointId, query);
    const description =
      options.description || `AgentPay ${getEndpointConfigFromCatalog(endpointCatalog, endpointId).description}`;

    return {
      x402Version: 1,
      scheme: "exact",
      network: config.network,
      maxAmountRequired: toBaseUnits(priceUsd, config.asset.decimals),
      resource: resourceUrl,
      description,
      mimeType: "application/json",
      outputSchema: buildOutputSchema(config.asset.symbol),
      payTo: config.walletAddress,
      maxTimeoutSeconds: 60,
      asset: config.asset.address,
      extra: {
        endpoint: endpointId,
        pricingModel: "dynamic",
        queryLength: query.length,
        priceUsd,
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
      service: "agentpay-gateway",
      protocol: "x402-stellar",
      network: config.network,
      facilitator: config.facilitatorUrl,
      walletAddress: config.walletAddress,
      asset: config.asset,
      endpoints: listEndpointsFromCatalog(endpointCatalog).map((endpoint) => ({
        id: endpoint.id,
        path: endpoint.path,
        description: endpoint.description,
        base_price: endpoint.basePriceUsd,
      })),
    };
  }

  function getDiscoveryResources() {
    return listEndpointsFromCatalog(endpointCatalog).map((endpoint) => ({
      resource: `${config.gatewayUrl}${endpoint.path}`,
      type: "http",
      x402Version: 1,
      accepts: [
        buildRequirementsForResource(`${config.gatewayUrl}${endpoint.path}`, endpoint.id),
      ],
      lastUpdated: DISCOVERY_UPDATED_AT,
      metadata: {
        endpoint: endpoint.id,
        description: endpoint.description,
        pricingModel: "dynamic",
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
      if (config.asset.address === "native") {
        return settleNativePayment(paymentPayload, paymentRequirements);
      }

      if (paymentRequirements.asset.startsWith("C")) {
        return settleContractPayment(paymentPayload, paymentRequirements);
      }

      return facilitator.settle(paymentPayload, paymentRequirements);
    },
    buildRequirements,
    buildRequirementsForResource,
    getCapabilities,
    getDiscoveryResources,
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
      requirements = buildRequirements(req);
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
