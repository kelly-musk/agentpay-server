export const DEFAULT_ENDPOINTS = {
  ai: {
    id: "ai",
    path: "/ai",
    description: "AI-related queries",
    basePriceUsd: "0.02",
  },
  data: {
    id: "data",
    path: "/data",
    description: "Dataset queries",
    basePriceUsd: "0.01",
  },
  compute: {
    id: "compute",
    path: "/compute",
    description: "Processing tasks",
    basePriceUsd: "0.03",
  },
};

function normalizeEndpoint(entry) {
  return {
    ...entry,
    id: entry.id,
    path: entry.path || `/${entry.id}`,
    method: (entry.method || "GET").toUpperCase(),
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
