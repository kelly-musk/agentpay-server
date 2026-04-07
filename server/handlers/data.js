import { runBusinessLogic } from "./shared.js";

export async function handleData(config, query) {
  return runBusinessLogic(config, "data", query);
}
