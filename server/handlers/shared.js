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
