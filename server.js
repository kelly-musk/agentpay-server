import express from "express";
import { readFileSync } from "fs";
import { useFacilitator, STELLAR_TOKENS, decodePaymentHeader } from "x402-stellar";
import { logRequest } from "./logger.js";

const app = express();
app.use(express.json());

const NETWORK = "stellar-testnet";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const RUST_SERVICE_URL = process.env.RUST_SERVICE_URL || "http://localhost:4000";

const { verify, settle } = useFacilitator({ url: "https://facilitator.x402.org" });
const usdcToken = STELLAR_TOKENS[NETWORK].USDC;

const BASE_PRICES = { ai: "0.02", data: "0.01", compute: "0.03" };

function getPrice(endpoint, query) {
  const base = parseFloat(BASE_PRICES[endpoint] || "0.01");
  return (query.length > 20 ? base + 0.01 : base).toFixed(2);
}

function requirePayment(endpoint) {
  return (req, res, next) => {
    const price = getPrice(endpoint, req.query.q || "");
    const requirements = {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: String(parseFloat(price) * 10 ** usdcToken.decimals),
      resource: req.path,
      description: `AgentPay /${endpoint}`,
      mimeType: "application/json",
      payTo: WALLET_ADDRESS,
      maxTimeoutSeconds: 60,
      asset: usdcToken.address,
      outputSchema: null,
      extra: null,
    };

    const paymentHeader = req.headers["x-payment"];
    if (!paymentHeader) {
      return res.status(402).json({ x402Version: 1, error: "Payment required", accepts: [requirements] });
    }

    verify(decodePaymentHeader(paymentHeader), requirements)
      .then((result) => {
        if (!result.isValid)
          return res.status(402).json({ error: "Invalid payment", reason: result.invalidReason });
        req.paymentPayload = decodePaymentHeader(paymentHeader);
        req.paymentRequirements = requirements;
        req.price = price;
        next();
      })
      .catch(() => res.status(402).json({ error: "Payment verification failed" }));
  };
}

async function handleRequest(req, res, endpoint) {
  try {
    const userQuery = req.query.q || "default query";
    const response = await fetch(`${RUST_SERVICE_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userQuery }),
    });
    const data = await response.json();
    settle(req.paymentPayload, req.paymentRequirements).catch(console.error);
    logRequest({ endpoint, query: userQuery, cost: `${req.price} USDC`, timestamp: new Date().toISOString() });
    res.json({ success: true, endpoint, pricing_model: "dynamic", payment: { status: "verified", network: NETWORK, method: "x402", asset: "USDC", amount: req.price }, query: userQuery, result: data.result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get("/", (req, res) => res.send("AgentPay Gateway — testnet"));

app.get("/stats", (req, res) => {
  try {
    const logs = readFileSync("logs.txt", "utf-8").trim().split("\n").map(JSON.parse);
    const totalRevenue = logs.reduce((sum, l) => sum + parseFloat(l.cost), 0);
    res.json({ total_requests: logs.length, total_revenue: totalRevenue.toFixed(2) + " USDC" });
  } catch {
    res.json({ total_requests: 0, total_revenue: "0 USDC" });
  }
});

app.get("/ai",      requirePayment("ai"),      (req, res) => handleRequest(req, res, "ai"));
app.get("/data",    requirePayment("data"),    (req, res) => handleRequest(req, res, "data"));
app.get("/compute", requirePayment("compute"), (req, res) => handleRequest(req, res, "compute"));

app.listen(3000, () => console.log("x402 server running on http://localhost:3000"));
