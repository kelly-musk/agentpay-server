import "dotenv/config";
import { getStoredSecret } from "../client/lib/secure-store.js";
import { getEffectiveConfig, loadConfig } from "../client/lib/config.js";
import { runPayerCheck } from "../client/lib/payer-check.js";

async function main() {
  const config = await loadConfig();
  const effective = await getEffectiveConfig();
  const storedSecret = config.payerPublicKey
    ? await getStoredSecret(config.payerPublicKey)
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

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exitCode = 1;
});
