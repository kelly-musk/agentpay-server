async function callRustBackend(config, endpoint, query) {
  if (!config.rustServiceUrl) {
    return null;
  }

  const response = await fetch(`${config.rustServiceUrl}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, query }),
  });

  if (!response.ok) {
    throw new Error(`Rust backend returned ${response.status}`);
  }

  return response.json();
}

export async function runBusinessLogic(config, endpoint, query) {
  const backendResponse = await callRustBackend(config, endpoint, query);

  if (backendResponse) {
    return backendResponse.result ?? backendResponse;
  }

  return {
    summary: `Processed ${endpoint} request for "${query}"`,
    source: "local-fallback",
  };
}

function assertAbsoluteUrl(name, value) {
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Invalid ${name}: expected an absolute URL`);
  }
}

async function parseProxyResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return {
    value: text,
    contentType: contentType || "text/plain",
  };
}

export function validateUpstreamRouteConfig(route) {
  const upstream = route?.upstream;

  if (!upstream || typeof upstream !== "object") {
    throw new Error(`Missing upstream config for protected route ${route.path || route.id}`);
  }

  if (!upstream.url) {
    throw new Error(`Invalid upstream config for protected route ${route.path || route.id}: missing url`);
  }

  assertAbsoluteUrl("upstream.url", upstream.url);

  if (upstream.method && !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(upstream.method).toUpperCase())) {
    throw new Error(`Unsupported upstream method: ${upstream.method}`);
  }

  if (upstream.headers && typeof upstream.headers !== "object") {
    throw new Error("Invalid upstream headers: expected an object");
  }

  if (upstream.queryParam && typeof upstream.queryParam !== "string") {
    throw new Error("Invalid upstream queryParam: expected a string");
  }
}

export function createUpstreamHandler(route) {
  validateUpstreamRouteConfig(route);

  const upstream = route.upstream;
  const requestMethod = String(upstream.method || route.method || "POST").toUpperCase();
  const upstreamUrl = new URL(upstream.url);
  const queryParam = upstream.queryParam || "q";
  const fetchImpl = upstream.fetch || fetch;

  return async (config, query, context = {}) => {
    const requestUrl = new URL(upstreamUrl);
    const headers = {
      Accept: "application/json, text/plain;q=0.9",
      ...(upstream.headers || {}),
    };

    if (context.intent?.id) {
      headers["x-agentpay-intent-id"] = context.intent.id;
    }

    if (requestMethod === "GET") {
      if (!requestUrl.searchParams.has(queryParam)) {
        requestUrl.searchParams.set(queryParam, query);
      }

      const response = await fetchImpl(requestUrl, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Upstream service returned ${response.status}`);
      }

      return parseProxyResponse(response);
    }

    headers["Content-Type"] = "application/json";

    const body = {
      ...(context.req?.body && typeof context.req.body === "object" ? context.req.body : {}),
      query,
      endpoint: route.id,
      path: route.path,
    };

    if (context.intent?.id) {
      body.intentId = context.intent.id;
    }

    const response = await fetchImpl(requestUrl, {
      method: requestMethod,
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Upstream service returned ${response.status}`);
    }

    return parseProxyResponse(response);
  };
}
