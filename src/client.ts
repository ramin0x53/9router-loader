import type { NineRouterModel, NineRouterModelsResponse } from "./types.js";

export interface FetchModelsOptions {
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
}

export async function fetch9RouterModels(options: FetchModelsOptions): Promise<NineRouterModel[]> {
  const { baseURL, apiKey, timeoutMs = 8000 } = options;

  let url = baseURL.trim().replace(/\/+$/, "");
  if (!url.endsWith("/models")) {
    url = `${url}/models`;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey && apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`9Router API returned HTTP ${response.status} ${response.statusText} from ${url}`);
  }

  const body = (await response.json()) as NineRouterModelsResponse;
  if (!body || !Array.isArray(body.data)) {
    throw new Error(`Invalid response format from ${url}: missing 'data' array`);
  }

  return body.data;
}
