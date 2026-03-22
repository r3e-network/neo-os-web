import { getExternalIntegrationConfig, resolveNeoNetwork, type NeoNetwork } from "../../../apps/shared/constants/rpc";

export interface OraclePublicKeyResponse {
  network: NeoNetwork;
  source: "neo_n3_contract";
  contract: string;
  rpc_url: string;
  algorithm: string;
  public_key: string;
  public_key_format: "raw";
}

function decodeBase64Utf8(value: unknown): string {
  return Buffer.from(String(value ?? ""), "base64").toString("utf8");
}

function parseNeoRpcString(stackItem: unknown): string {
  if (!stackItem || typeof stackItem !== "object") return "";
  const typed = stackItem as { type?: string; value?: unknown };
  const type = String(typed.type || "").toLowerCase();
  if (type === "string") return String(typed.value ?? "").trim();
  if (type === "bytestring" || type === "bytearray") return decodeBase64Utf8(typed.value).trim();
  return "";
}

async function invokeReadString(rpcUrl: string, scriptHash: string, operation: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [scriptHash, operation, []],
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload?.error?.message || `${operation} RPC failed`);
  }
  return parseNeoRpcString(payload?.result?.stack?.[0]);
}

export async function fetchOraclePublicKey(networkInput?: string | null): Promise<OraclePublicKeyResponse> {
  const network = resolveNeoNetwork(networkInput);
  const integration = getExternalIntegrationConfig(network);
  const contract = integration.contracts.morpheusOracle;
  const rpcUrl = integration.rpcUrl;

  const [algorithm, publicKey] = await Promise.all([
    invokeReadString(rpcUrl, contract, "oracleEncryptionAlgorithm").catch((e: unknown) => { console.warn("[morpheus-oracle] failed to read encryption algorithm, using default:", e instanceof Error ? e.message : String(e)); return "X25519-HKDF-SHA256-AES-256-GCM"; }),
    invokeReadString(rpcUrl, contract, "oracleEncryptionPublicKey"),
  ]);

  if (!publicKey) {
    throw new Error(`Oracle encryption public key is empty for contract="${contract}" on network="${network}"`);
  }

  return {
    network,
    source: "neo_n3_contract",
    contract,
    rpc_url: rpcUrl,
    algorithm: algorithm || "X25519-HKDF-SHA256-AES-256-GCM",
    public_key: publicKey,
    public_key_format: "raw",
  };
}
