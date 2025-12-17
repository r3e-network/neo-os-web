import { getEnv } from "./env.ts";
import { error } from "./response.ts";

let mtlsClient: Deno.HttpClient | null | undefined;

function getMTLSClient(): Deno.HttpClient | undefined {
  if (mtlsClient !== undefined) return mtlsClient ?? undefined;

  const certChain =
    getEnv("TEE_MTLS_CERT_PEM") ?? getEnv("EDGE_MTLS_CERT_PEM");
  const privateKey =
    getEnv("TEE_MTLS_KEY_PEM") ?? getEnv("EDGE_MTLS_KEY_PEM");
  const ca =
    getEnv("TEE_MTLS_ROOT_CA_PEM") ?? getEnv("MARBLERUN_ROOT_CA_PEM");

  if (!certChain || !privateKey || !ca) {
    mtlsClient = null;
    return undefined;
  }

  mtlsClient = Deno.createHttpClient({
    caCerts: [ca],
    certChain,
    privateKey,
  });
  return mtlsClient;
}

export async function postJSON(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<unknown | Response> {
  const init: RequestInit & { client?: Deno.HttpClient } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };

  const client = getMTLSClient();
  if (client) init.client = client;

  const resp = await fetch(url, init);

  const text = await resp.text();
  if (!resp.ok) {
    return error(resp.status, text || `upstream error (${resp.status})`, "UPSTREAM_ERROR");
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return error(502, "invalid upstream JSON", "UPSTREAM_INVALID_JSON");
  }
}

export async function getJSON(
  url: string,
  headers: Record<string, string> = {},
): Promise<unknown | Response> {
  const init: RequestInit & { client?: Deno.HttpClient } = {
    method: "GET",
    headers: { ...headers },
  };

  const client = getMTLSClient();
  if (client) init.client = client;

  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    return error(resp.status, text || `upstream error (${resp.status})`, "UPSTREAM_ERROR");
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return error(502, "invalid upstream JSON", "UPSTREAM_INVALID_JSON");
  }
}
