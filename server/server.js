import { pathToFileURL } from "url";
import { createAgentPayApp, createAgentPayProvider } from "./provider.js";
import { loadGatewayConfig } from "./payments.js";

export function createServerApp(config = loadGatewayConfig()) {
  return createAgentPayApp({ config });
}

export function startServer(config = loadGatewayConfig()) {
  const app = createServerApp(config);
  const server = app.listen(config.port, () => {
    console.log(`AgentPay Gateway running on http://localhost:${config.port}`);
  });

  function shutdown() {
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return server;
}

export { createAgentPayApp, createAgentPayProvider } from "./provider.js";

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  startServer();
}
