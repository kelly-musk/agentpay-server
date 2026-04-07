import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";

const CONFIG_DIR =
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const AGENTPAY_DIR = join(CONFIG_DIR, "agentpay");
const CONFIG_FILE = join(AGENTPAY_DIR, "config.json");

function sanitizeConfig(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  );
}

export async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function saveConfig(config) {
  await mkdir(dirname(CONFIG_FILE), { recursive: true });
  await writeFile(
    CONFIG_FILE,
    `${JSON.stringify(sanitizeConfig(config), null, 2)}\n`,
  );
}

export async function clearConfig() {
  await rm(CONFIG_FILE, { force: true });
}

export async function getEffectiveConfig() {
  const config = await loadConfig();

  return {
    payerPublicKey: config.payerPublicKey,
    network: process.env.X402_NETWORK || config.network || "stellar-testnet",
    gatewayUrl: process.env.GATEWAY_URL || config.gatewayUrl || "http://localhost:3000",
    asset: process.env.X402_ASSET || config.asset || "USDC",
  };
}

export function getConfigFilePath() {
  return CONFIG_FILE;
}
