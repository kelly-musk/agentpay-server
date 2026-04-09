import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchAgentPayCapabilities,
  fetchAgentPayDiscovery,
  fetchAgentPayManifest,
  fetchAgentPayRegistryExport,
  resolveAgentPayService,
  selectAgentPayRoute,
} from "../client/index.js";

function createMockFetch() {
  const responses = new Map([
    [
      "http://example.com/.well-known/agentpay.json",
      {
        manifestVersion: "1.0.0",
        provider: { id: "provider_1", name: "Provider One" },
        service: { id: "svc_1", name: "Service One" },
      },
    ],
    [
      "http://example.com/capabilities",
      {
        protocol: "x402-stellar",
        endpoints: [{ id: "search" }],
      },
    ],
    [
      "http://example.com/discovery/resources",
      {
        items: [{ resource: "http://example.com/search" }],
      },
    ],
    [
      "http://example.com/registry/export",
      {
        routes: [
          {
            id: "search",
            method: "POST",
            category: "search-api",
            audience: ["agents", "developers"],
            tags: ["search", "retrieval"],
          },
          {
            id: "inference",
            method: "POST",
            category: "ai-inference",
            audience: ["agents"],
            tags: ["ai", "generation"],
          },
        ],
      },
    ],
    [
      "http://example.com/registry/export?tag=search",
      {
        routes: [
          {
            id: "search",
            method: "POST",
            category: "search-api",
            audience: ["agents", "developers"],
            tags: ["search", "retrieval"],
          },
        ],
      },
    ],
  ]);

  return async function mockFetch(url) {
    const payload = responses.get(String(url));

    if (!payload) {
      return {
        ok: false,
        status: 404,
        async text() {
          return JSON.stringify({ error: `missing mock for ${url}` });
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify(payload);
      },
    };
  };
}

test("fetches manifest, capabilities, registry export, and discovery surfaces", async () => {
  const fetch = createMockFetch();
  const manifest = await fetchAgentPayManifest("http://example.com", { fetch });
  const capabilities = await fetchAgentPayCapabilities("http://example.com", { fetch });
  const registry = await fetchAgentPayRegistryExport("http://example.com", { fetch });
  const discovery = await fetchAgentPayDiscovery("http://example.com", { fetch });

  assert.equal(manifest.provider.id, "provider_1");
  assert.equal(capabilities.protocol, "x402-stellar");
  assert.equal(registry.routes.length, 2);
  assert.equal(discovery.items.length, 1);
});

test("resolves an AgentPay service and selects compatible routes", async () => {
  const fetch = createMockFetch();
  const service = await resolveAgentPayService("http://example.com/", { fetch });
  const searchRoute = selectAgentPayRoute(service, { tag: "search" });
  const aiRoute = selectAgentPayRoute(service, { category: "ai-inference", audience: "agents" });

  assert.equal(service.baseUrl, "http://example.com");
  assert.equal(service.manifest.service.id, "svc_1");
  assert.equal(service.registry.routes.length, 2);
  assert.equal(searchRoute?.id, "search");
  assert.equal(aiRoute?.id, "inference");
});

test("passes registry filters through the resolution helpers", async () => {
  const fetch = createMockFetch();
  const registry = await fetchAgentPayRegistryExport("http://example.com", {
    fetch,
    tag: "search",
  });

  assert.equal(registry.routes.length, 1);
  assert.equal(registry.routes[0].id, "search");
});
