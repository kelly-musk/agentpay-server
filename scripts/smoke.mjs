import { readFileSync } from "fs";

const statsExists = (() => {
  try {
    readFileSync("README.md", "utf-8");
    readFileSync("server/server.js", "utf-8");
    readFileSync("client/client.js", "utf-8");
    return true;
  } catch {
    return false;
  }
})();

if (!statsExists) {
  console.error("Smoke check failed: expected project entrypoints are missing.");
  process.exit(1);
}

console.log("Smoke check passed: key entrypoints are present.");
