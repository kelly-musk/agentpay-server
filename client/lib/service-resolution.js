import fetch from "node-fetch";

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/$/, "");
}

async function readJsonResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  return readJsonResponse(response);
}

export async function fetchAgentPayManifest(baseUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/.well-known/agentpay.json`, fetchImpl);
}

export async function fetchAgentPayCapabilities(baseUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/capabilities`, fetchImpl);
}

export async function fetchAgentPayRegistryExport(baseUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  const params = new URLSearchParams();

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.tag) {
    params.set("tag", options.tag);
  }

  if (options.audience) {
    params.set("audience", options.audience);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/registry/export${suffix}`, fetchImpl);
}

export async function fetchAgentPayDiscovery(baseUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/discovery/resources`, fetchImpl);
}

export async function resolveAgentPayService(baseUrl, options = {}) {
  const fetchImpl = options.fetch || fetch;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [manifest, capabilities, registry, discovery] = await Promise.all([
    fetchAgentPayManifest(normalizedBaseUrl, { fetch: fetchImpl }),
    fetchAgentPayCapabilities(normalizedBaseUrl, { fetch: fetchImpl }),
    fetchAgentPayRegistryExport(normalizedBaseUrl, {
      fetch: fetchImpl,
      category: options.category,
      tag: options.tag,
      audience: options.audience,
    }),
    fetchAgentPayDiscovery(normalizedBaseUrl, { fetch: fetchImpl }),
  ]);

  return {
    baseUrl: normalizedBaseUrl,
    manifest,
    capabilities,
    registry,
    discovery,
  };
}

export function selectAgentPayRoute(serviceResolution, criteria = {}) {
  const routes = serviceResolution?.registry?.routes || [];

  return routes.find((route) => {
    if (criteria.id && route.id !== criteria.id) {
      return false;
    }

    if (criteria.category && route.category !== criteria.category) {
      return false;
    }

    if (criteria.method && route.method !== String(criteria.method).toUpperCase()) {
      return false;
    }

    if (criteria.tag && !route.tags.includes(criteria.tag)) {
      return false;
    }

    if (criteria.audience && !route.audience.includes(criteria.audience)) {
      return false;
    }

    return true;
  }) || null;
}
