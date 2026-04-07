import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";

const INTENTS_FILE = "intents.json";

function loadIntents() {
  try {
    const raw = readFileSync(INTENTS_FILE, "utf-8").trim();

    if (!raw) {
      return [];
    }

    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function saveIntents(intents) {
  writeFileSync(INTENTS_FILE, `${JSON.stringify(intents, null, 2)}\n`);
}

export function createIntent({ endpoint, query, amount, asset }) {
  const intents = loadIntents();
  const timestamp = new Date().toISOString();
  const intent = {
    id: `intent_${randomUUID()}`,
    endpoint,
    query,
    amount,
    asset,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  intents.push(intent);
  saveIntents(intents);

  return intent;
}

export function getIntentById(intentId) {
  const intents = loadIntents();
  return intents.find((intent) => intent.id === intentId) || null;
}

export function listIntents(limit = 50) {
  return loadIntents()
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function updateIntent(intentId, patch) {
  const intents = loadIntents();
  const index = intents.findIndex((intent) => intent.id === intentId);

  if (index === -1) {
    return null;
  }

  const updatedIntent = {
    ...intents[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  intents[index] = updatedIntent;
  saveIntents(intents);

  return updatedIntent;
}
