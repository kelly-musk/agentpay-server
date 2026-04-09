/**
 * TRADITIONAL API (BEFORE STELLAR OXIDE GATEWAY)
 * 
 * This demonstrates the problems with traditional API monetization:
 * - Requires API key management
 * - Manual user onboarding
 * - Subscription billing complexity
 * - No pay-per-use option
 * - Agents can't self-onboard
 */

import express from "express";

const app = express();
app.use(express.json());

// Simulated API key database
const API_KEYS = {
  "sk_test_123": { user: "alice", plan: "free", requests: 0, limit: 100 },
  "sk_test_456": { user: "bob", plan: "pro", requests: 0, limit: 1000 },
};

// ❌ PROBLEM 1: API Key Management
// - Keys can leak
// - Manual provisioning required
// - Revocation is complex
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  
  if (!apiKey) {
    return res.status(401).json({
      error: "Missing API key",
      message: "Please sign up at https://example.com/signup to get an API key"
    });
  }
  
  const keyData = API_KEYS[apiKey];
  if (!keyData) {
    return res.status(401).json({
      error: "Invalid API key",
      message: "Your API key is invalid or has been revoked"
    });
  }
  
  // ❌ PROBLEM 2: Rate Limiting Instead of Pay-Per-Use
  // - Users hit limits and get blocked
  // - Can't pay for extra usage on-demand
  if (keyData.requests >= keyData.limit) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Upgrade your plan at https://example.com/upgrade"
    });
  }
  
  keyData.requests++;
  req.user = keyData;
  next();
}

// ❌ PROBLEM 3: Subscription Friction
// - Users must commit to monthly plans
// - Can't pay for one-time usage
// - Billing infrastructure is complex
app.get("/api/search", validateApiKey, (req, res) => {
  const query = req.query.q || "default";
  
  res.json({
    success: true,
    query,
    results: [
      { title: "Result 1", url: "https://example.com/1" },
      { title: "Result 2", url: "https://example.com/2" }
    ],
    user: req.user.user,
    plan: req.user.plan,
    requests_remaining: req.user.limit - req.user.requests
  });
});

app.get("/api/inference", validateApiKey, (req, res) => {
  const prompt = req.query.prompt || "Hello";
  
  res.json({
    success: true,
    prompt,
    response: `AI response to: ${prompt}`,
    tokens_used: 150,
    user: req.user.user,
    plan: req.user.plan,
    requests_remaining: req.user.limit - req.user.requests
  });
});

app.get("/api/market-data", validateApiKey, (req, res) => {
  const symbol = req.query.symbol || "BTC";
  
  res.json({
    success: true,
    symbol,
    price: 45000 + Math.random() * 1000,
    volume: 1234567890,
    timestamp: new Date().toISOString(),
    user: req.user.user,
    plan: req.user.plan,
    requests_remaining: req.user.limit - req.user.requests
  });
});

// ❌ PROBLEM 4: Manual Onboarding
// - Agents can't self-onboard
// - Requires human intervention
// - Email verification, payment setup, etc.
app.get("/", (req, res) => {
  res.json({
    service: "Traditional API",
    problems: [
      "Requires API key management",
      "Manual user onboarding",
      "Subscription billing only",
      "Rate limits instead of pay-per-use",
      "Agents can't self-onboard",
      "Keys can leak or be stolen",
      "Complex billing infrastructure"
    ],
    signup: "https://example.com/signup",
    pricing: {
      free: "100 requests/month",
      pro: "$29/month for 1000 requests",
      enterprise: "Contact sales"
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n❌ Traditional API running on http://localhost:${PORT}`);
  console.log(`\nProblems with this approach:`);
  console.log(`  1. Requires API keys (can leak, manual provisioning)`);
  console.log(`  2. Subscription billing only (no pay-per-use)`);
  console.log(`  3. Rate limits block users (can't pay for extra)`);
  console.log(`  4. Manual onboarding (agents can't self-onboard)`);
  console.log(`  5. Complex billing infrastructure\n`);
  console.log(`Try it:`);
  console.log(`  curl http://localhost:${PORT}/api/search?q=test`);
  console.log(`  (Will fail without API key)\n`);
  console.log(`  curl -H "x-api-key: sk_test_123" http://localhost:${PORT}/api/search?q=test`);
  console.log(`  (Works but counts against rate limit)\n`);
});
