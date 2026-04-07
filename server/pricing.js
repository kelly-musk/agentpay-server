export const ENDPOINTS = {
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

export function getEndpointConfig(endpointId) {
  const endpoint = ENDPOINTS[endpointId];

  if (!endpoint) {
    throw new Error(`Unknown endpoint: ${endpointId}`);
  }

  return endpoint;
}

export function listEndpoints() {
  return Object.values(ENDPOINTS);
}

export function getPriceUsd(endpointId, query) {
  const endpoint = getEndpointConfig(endpointId);
  const basePrice = Number.parseFloat(endpoint.basePriceUsd);
  const complexitySurcharge = query.trim().length > 20 ? 0.01 : 0;

  return (basePrice + complexitySurcharge).toFixed(2);
}
