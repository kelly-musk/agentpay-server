import { runBusinessLogic } from "./shared.js";

export async function handleCompute(config, query) {
  return runBusinessLogic(config, "compute", query);
}
