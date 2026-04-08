export const DEFAULT_ENDPOINTS = {
  ai: {
    id: "ai",
    path: "/ai",
    description: "AI-related queries",
    basePriceUsd: "0.02",
    category: "ai-inference",
    billingUnit: "request",
    audience: ["agents", "developers"],
    tags: ["ai", "inference", "agent-tools"],
    useCases: ["question-answering", "workflow automation"],
  },
  data: {
    id: "data",
    path: "/data",
    description: "Dataset queries",
    basePriceUsd: "0.01",
    category: "data-api",
    billingUnit: "request",
    audience: ["agents", "developers"],
    tags: ["data", "search", "retrieval"],
    useCases: ["research", "retrieval"],
  },
  compute: {
    id: "compute",
    path: "/compute",
    description: "Processing tasks",
    basePriceUsd: "0.03",
    category: "compute",
    billingUnit: "request",
    audience: ["agents", "developers"],
    tags: ["compute", "automation", "processing"],
    useCases: ["batch jobs", "tool execution"],
  },
};

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function normalizeEndpoint(entry) {
  const audience = normalizeStringArray(entry.audience);

  return {
    ...entry,
    id: entry.id,
    path: entry.path || `/${entry.id}`,
    method: (entry.method || "GET").toUpperCase(),
    category: entry.category || "general",
    billingUnit: entry.billingUnit || "request",
    audience: audience.length > 0
      ? audience
      : ["agents", "developers"],
    tags: normalizeStringArray(entry.tags),
    useCases: normalizeStringArray(entry.useCases),
    examples: Array.isArray(entry.examples) ? entry.examples : [],
    inputSchema: entry.inputSchema || null,
    outputSchema: entry.outputSchema || null,
  };
}

export function createEndpointCatalog(endpoints = DEFAULT_ENDPOINTS) {
  const values = Array.isArray(endpoints)
    ? endpoints
    : Object.values(endpoints);

  return Object.fromEntries(
    values.map((endpoint) => [endpoint.id, normalizeEndpoint(endpoint)]),
  );
}

export function getEndpointConfigFromCatalog(catalog, endpointId) {
  const endpoint = catalog[endpointId];

  if (!endpoint) {
    throw new Error(`Unknown endpoint: ${endpointId}`);
  }

  return endpoint;
}

export function listEndpointsFromCatalog(catalog) {
  return Object.values(catalog);
}

export function getPriceUsdFromCatalog(catalog, endpointId, query) {
  const endpoint = getEndpointConfigFromCatalog(catalog, endpointId);
  const basePrice = Number.parseFloat(endpoint.basePriceUsd);
  const complexitySurcharge = query.trim().length > 20 ? 0.01 : 0;

  return (basePrice + complexitySurcharge).toFixed(2);
}

const DEFAULT_CATALOG = createEndpointCatalog(DEFAULT_ENDPOINTS);

export function getEndpointConfig(endpointId) {
  return getEndpointConfigFromCatalog(DEFAULT_CATALOG, endpointId);
}

export function listEndpoints() {
  return listEndpointsFromCatalog(DEFAULT_CATALOG);
}

export function getPriceUsd(endpointId, query) {
  return getPriceUsdFromCatalog(DEFAULT_CATALOG, endpointId, query);
}
