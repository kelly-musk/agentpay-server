import express from "express";
import {
  useFacilitator,
  STELLAR_TOKENS,
  decodePaymentHeader,
} from "x402-stellar";

const app = express();
app.use(express.json());

const NETWORK = "stellar-testnet";
const PRICE_USDC = "0.01";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const RUST_SERVICE_URL = process.env.RUST_SERVICE_URL || "http://localhost:4000";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.x402.org";

const { verify, settle } = useFacilitator({ url: FACILITATOR_URL });
const usdcToken = STELLAR_TOKENS[NETWORK].USDC;

const logs = [];

// Build 402 payment requirements
function paymentRequirements(endpoint) {
  return {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired: String(Number(PRICE_USDC) * 10 ** usdcToken.decimals),
    resource: endpoint,
    description: "AgentPay access",
    mimeType: "application/json",
    payTo: WALLET_ADDRESS,
    maxTimeoutSeconds: 60,
    asset: usdcToken.address,
    outputSchema: null,
    extra: null,
  };
}

// x402 middleware
function requirePayment(req, res, next) {
  const paymentHeader = req.headers["x-payment"];

  if (!paymentHeader) {
    const requirements = paymentRequirements(req.path);
    return res.status(402).json({
      x402Version: 1,
      error: "Payment required",
      accepts: [requirements],
    });
  }

  const requirements = paymentRequirements(req.path);

  verify(decodePaymentHeader(paymentHeader), requirements)
    .then((result) => {
      if (!result.isValid) {
        return res.status(402).json({ error: "Invalid payment", reason: result.invalidReason });
      }
      req.paymentPayload = decodePaymentHeader(paymentHeader);
      req.paymentRequirements = requirements;
      next();
    })
    .catch(() => res.status(402).json({ error: "Payment verification failed" }));
}

// Settle after response
function settlePayment(req) {
  settle(req.paymentPayload, req.paymentRequirements).catch((e) =>
    console.error("Settle failed:", e.message)
  );
}

// Call Rust backend
async function callRust(query) {
  const res = await fetch(`${RUST_SERVICE_URL}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

// Free route
app.get("/", (req, res) => res.send("AgentPay Gateway — testnet"));

// Paywalled routes
app.get("/premium", requirePayment, async (req, res) => {
  const { result } = await callRust("premium-data");
  settlePayment(req);
  logs.push({ endpoint: "/premium", amount: PRICE_USDC + " USDC", timestamp: Date.now() });
  res.json({ result, cost: `${PRICE_USDC} USDC`, timestamp: Date.now() });
});

app.get("/ai-query", requirePayment, async (req, res) => {
  const { result } = await callRust(req.query.q || "default");
  settlePayment(req);
  logs.push({ endpoint: "/ai-query", amount: PRICE_USDC + " USDC", timestamp: Date.now() });
  res.json({ result, cost: `${PRICE_USDC} USDC`, timestamp: Date.now() });
});

app.get("/compute", requirePayment, async (req, res) => {
  const { result } = await callRust("compute");
  settlePayment(req);
  logs.push({ endpoint: "/compute", amount: PRICE_USDC + " USDC", timestamp: Date.now() });
  res.json({ result, cost: `${PRICE_USDC} USDC`, timestamp: Date.now() });
});

app.get("/logs", (req, res) => res.json(logs));

app.listen(3000, () =>
  console.log(`AgentPay Gateway (testnet) running on http://localhost:3000`)
);
