/**
 * SIDE-BY-SIDE COMPARISON DEMO
 * 
 * This runs both the traditional API and Stellar Oxide Gateway solution
 * so you can see the difference in real-time.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("\n" + "=".repeat(80));
console.log("  STELLAR OXIDE GATEWAY - BEFORE & AFTER COMPARISON");
console.log("=".repeat(80) + "\n");

console.log("Starting both servers for comparison...\n");

// Start traditional API on port 4000
const traditionalApi = spawn("node", [join(__dirname, "demo-traditional-api.js")], {
  env: { ...process.env, PORT: "4000" },
  stdio: "inherit"
});

// Wait a bit before starting the second server
setTimeout(() => {
  // Start Stellar Oxide Gateway on port 3000
  const stellarGateway = spawn("node", [join(__dirname, "demo-stellar-oxide-gateway.js")], {
    env: { 
      ...process.env, 
      PORT: "3000",
      X402_NETWORK: "stellar-testnet",
      X402_ASSET: "native"
    },
    stdio: "inherit"
  });

  // Handle cleanup
  process.on("SIGINT", () => {
    console.log("\n\nShutting down demo servers...");
    traditionalApi.kill();
    stellarGateway.kill();
    process.exit(0);
  });

  stellarGateway.on("exit", () => {
    traditionalApi.kill();
    process.exit(0);
  });

  traditionalApi.on("exit", () => {
    stellarGateway.kill();
    process.exit(0);
  });
}, 1000);

// Print comparison after servers start
setTimeout(() => {
  console.log("\n" + "=".repeat(80));
  console.log("  COMPARISON: TRADITIONAL API vs STELLAR OXIDE GATEWAY");
  console.log("=".repeat(80) + "\n");
  
  console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ TRADITIONAL API (Port 4000)                                                 │");
  console.log("├─────────────────────────────────────────────────────────────────────────────┤");
  console.log("│ ❌ Requires API keys                                                        │");
  console.log("│ ❌ Manual user onboarding                                                   │");
  console.log("│ ❌ Subscription billing only                                                │");
  console.log("│ ❌ Rate limits block users                                                  │");
  console.log("│ ❌ Agents can't self-onboard                                                │");
  console.log("│ ❌ Keys can leak or be stolen                                               │");
  console.log("│ ❌ Complex billing infrastructure                                           │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘\n");
  
  console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ STELLAR OXIDE GATEWAY (Port 3000)                                           │");
  console.log("├─────────────────────────────────────────────────────────────────────────────┤");
  console.log("│ ✅ No API keys - pay with blockchain                                        │");
  console.log("│ ✅ Zero setup - agents self-onboard                                         │");
  console.log("│ ✅ Pay-per-use - no subscriptions                                           │");
  console.log("│ ✅ No rate limits - pay for what you need                                   │");
  console.log("│ ✅ Instant settlement on Stellar                                            │");
  console.log("│ ✅ Structured blockchain receipts                                           │");
  console.log("│ ✅ Dynamic pricing based on usage                                           │");
  console.log("└─────────────────────────────────────────────────────────────────────────────┘\n");
  
  console.log("TRY IT YOURSELF:\n");
  
  console.log("Traditional API (will fail without API key):");
  console.log("  curl http://localhost:4000/api/search?q=test\n");
  
  console.log("Traditional API (with API key, but counts against limit):");
  console.log("  curl -H 'x-api-key: sk_test_123' http://localhost:4000/api/search?q=test\n");
  
  console.log("Stellar Oxide Gateway (returns 402, then pay and retry):");
  console.log("  1. Set up wallet: yarn cli setup");
  console.log("  2. Make paid request: yarn cli ai --query 'test'");
  console.log("  3. Check stats: curl http://localhost:3000/stats\n");
  
  console.log("Compare the endpoints:");
  console.log("  Traditional: http://localhost:4000/");
  console.log("  Stellar:     http://localhost:3000/\n");
  
  console.log("Press Ctrl+C to stop both servers\n");
  console.log("=".repeat(80) + "\n");
}, 3000);
