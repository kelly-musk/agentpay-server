import "dotenv/config";
import express from "express";
import { pathToFileURL } from "url";
import { handleAi } from "./handlers/ai.js";
import { handleCompute } from "./handlers/compute.js";
import { handleData } from "./handlers/data.js";
import {
  createIntent,
  getIntentById,
  listIntents,
  updateIntent,
} from "./intents.js";
import { logRequest, readStats } from "./logger.js";
import {
  createPaymentContext,
  loadGatewayConfig,
  requirePayment,
  requirePaymentWith,
} from "./payments.js";
import { getEndpointConfig, getPriceUsd } from "./pricing.js";

const handlers = {
  ai: handleAi,
  data: handleData,
  compute: handleCompute,
};

export function createServerApp(config = loadGatewayConfig()) {
  const app = express();
  const paymentContext = createPaymentContext(config);
  const executingIntents = new Set();

  app.use(express.json());
  app.set("trust proxy", true);

  app.get("/", (req, res) => {
    res.json({
      service: "agentpay-gateway",
      protocol: "x402-stellar",
      network: config.network,
      asset: paymentContext.getCapabilities().asset.symbol,
      routes: paymentContext.getCapabilities().endpoints,
    });
  });

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "agentpay-gateway",
      network: config.network,
      asset: config.asset.symbol,
    });
  });

  app.get("/capabilities", (req, res) => {
    res.json(paymentContext.getCapabilities());
  });

  app.get("/discovery/resources", (req, res) => {
    const type = req.query.type ? String(req.query.type) : undefined;
    const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
    const offset = req.query.offset ? Number.parseInt(String(req.query.offset), 10) : 0;

    let items = paymentContext.getDiscoveryResources();

    if (type) {
      items = items.filter((item) => item.type === type);
    }

    const start = Number.isNaN(offset) ? 0 : offset;
    const end = limit && !Number.isNaN(limit) ? start + limit : undefined;
    const pagedItems = items.slice(start, end);

    res.json({
      x402Version: 1,
      items: pagedItems,
      pagination: {
        limit: limit && !Number.isNaN(limit) ? limit : items.length,
        offset: start,
        total: items.length,
      },
    });
  });

  app.get("/stats", (req, res) => {
    res.json(readStats());
  });

  app.get("/intents", (req, res) => {
    const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 50;
    res.json({
      items: listIntents(Number.isNaN(limit) ? 50 : limit),
    });
  });

  app.post("/intents", (req, res) => {
    try {
      const endpoint = String(req.body.endpoint || "").trim();
      const query = String(req.body.query || "").trim();

      if (!endpoint) {
        return res.status(400).json({ error: "Missing required field: endpoint" });
      }

      getEndpointConfig(endpoint);

      const amount = getPriceUsd(endpoint, query);
      const intent = createIntent({
        endpoint,
        query,
        amount,
        asset: config.asset.symbol,
      });
      const resourceUrl = `${config.gatewayUrl}/intents/${intent.id}/execute`;
      const accepts = [
        paymentContext.buildRequirementsForResource(resourceUrl, endpoint, query, {
          priceUsd: amount,
          description: `Execute AgentPay ${endpoint} intent`,
          extra: {
            intentId: intent.id,
            flow: "intent-execution",
          },
        }),
      ];

      return res.status(201).json({
        intent,
        paymentRequest: {
          resource: resourceUrl,
          amount,
          asset: config.asset.symbol,
        },
        accepts,
      });
    } catch (error) {
      return res.status(400).json({
        error: error.message,
      });
    }
  });

  app.get("/intents/:intentId", (req, res) => {
    const intent = getIntentById(req.params.intentId);

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    return res.json({ intent });
  });

  app.post(
    "/intents/:intentId/execute",
    requirePaymentWith((req) => {
      const intent = getIntentById(req.params.intentId);

      if (!intent) {
        throw new Error("Intent not found");
      }

      return paymentContext.buildRequirementsForResource(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        intent.endpoint,
        intent.query,
        {
          priceUsd: intent.amount,
          description: `Execute AgentPay ${intent.endpoint} intent`,
          extra: {
            intentId: intent.id,
            flow: "intent-execution",
          },
        },
      );
    }, paymentContext),
    async (req, res) => {
      const intent = getIntentById(req.params.intentId);

      if (!intent) {
        return res.status(404).json({ error: "Intent not found" });
      }

      if (intent.status === "executed") {
        return res.status(409).json({ error: "Intent already executed" });
      }

      if (executingIntents.has(intent.id)) {
        return res.status(409).json({ error: "Intent is already executing" });
      }

      executingIntents.add(intent.id);

      try {
        updateIntent(intent.id, {
          status: "paid",
          payment: {
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
          },
        });

        const result = await handlers[intent.endpoint](config, intent.query);
        let settlement = null;

        try {
          settlement = await paymentContext.settle(
            req.paymentPayload,
            req.paymentRequirements,
          );
        } catch (error) {
          settlement = {
            success: false,
            network: config.network,
            error: error.message,
          };
          console.error("Settlement failed:", error.message);
        }

        const finalizedIntent = updateIntent(intent.id, {
          status: "executed",
          settlement,
          result,
          executedAt: new Date().toISOString(),
        });

        logRequest({
          endpoint: intent.endpoint,
          query: intent.query,
          timestamp: new Date().toISOString(),
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
          },
          intentId: intent.id,
          flow: "intent-execution",
        });

        return res.json({
          success: true,
          intent: finalizedIntent,
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: intent.amount,
            settlement,
          },
          result,
        });
      } catch (error) {
        updateIntent(intent.id, {
          status: "failed",
          error: error.message,
        });

        return res.status(502).json({
          success: false,
          intentId: intent.id,
          error: error.message,
        });
      } finally {
        executingIntents.delete(intent.id);
      }
    },
  );

  for (const [endpointId, handler] of Object.entries(handlers)) {
    app.get(`/${endpointId}`, requirePayment(endpointId, paymentContext), async (req, res) => {
      try {
        const query = String(req.query.q || "default query");
        const result = await handler(config, query);
        let settlement = null;

        try {
          settlement = await paymentContext.settle(
            req.paymentPayload,
            req.paymentRequirements,
          );
        } catch (error) {
          settlement = {
            success: false,
            network: config.network,
            error: error.message,
          };
          console.error("Settlement failed:", error.message);
        }

        logRequest({
          endpoint: endpointId,
          query,
          timestamp: new Date().toISOString(),
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: req.pricing.amount,
          },
        });

        res.json({
          success: true,
          endpoint: endpointId,
          payment: {
            status: "verified",
            network: config.network,
            asset: config.asset.symbol,
            amount: req.pricing.amount,
            settlement,
          },
          result,
        });
      } catch (error) {
        res.status(502).json({
          success: false,
          endpoint: endpointId,
          error: error.message,
        });
      }
    });
  }

  return app;
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

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  startServer();
}
