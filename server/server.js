import { pathToFileURL } from "url";
import { createAgentPayApp, createAgentPayProvider } from "./provider.js";
import { loadGatewayConfig } from "./payments.js";

export function createServerApp(config = loadGatewayConfig()) {
  return createAgentPayApp({ config });
}

export function startServer(config = loadGatewayConfig()) {
  const app = createServerApp(config);
  const provider = app.locals.agentpayProvider;
  const server = app.listen(config.port, () => {
    console.log(`AgentPay Gateway running on http://localhost:${config.port}`);
  });
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    server.close(async () => {
      try {
        if (provider?.close) {
          await provider.close();
        }
      } catch (error) {
        console.error("AgentPay shutdown failed:", error.message);
      } finally {
        process.exit(0);
      }
    });
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
