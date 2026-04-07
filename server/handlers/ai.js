import { runBusinessLogic } from "./shared.js";

export async function handleAi(config, query) {
  return runBusinessLogic(config, "ai", query);
}
