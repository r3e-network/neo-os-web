/**
 * Script Verification Module
 *
 * Verifies off-chain computation scripts against on-chain registered hashes.
 * Ensures only authorized scripts are executed in the TEE.
 */

export type ScriptInfo = {
  name: string;
  hash: string;
  version: number;
  enabled: boolean;
  exists: boolean;
};

export type VerificationResult = {
  valid: boolean;
  error?: string;
  scriptInfo?: ScriptInfo;
};

/**
 * Compute SHA256 hash of script content.
 */
export async function computeScriptHash(scriptContent: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(scriptContent);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Query on-chain script info from contract.
 */
export async function getOnChainScriptInfo(
  contractHash: string,
  scriptName: string,
  rpcUrl: string
): Promise<ScriptInfo | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "invokefunction",
        params: [
          contractHash,
          "getScriptInfo",
          [{ type: "String", value: scriptName }]
        ]
      })
    });

    const result = await response.json();
    if (result.error || result.result?.state !== "HALT") {
      return null;
    }

    // Parse Neo N3 Map result
    const stack = result.result?.stack?.[0];
    if (!stack || stack.type !== "Map") return null;

    const info = parseNeoMap(stack.value);
    return {
      name: scriptName,
      hash: info.hash || "",
      version: parseInt(info.version || "0"),
      enabled: info.enabled === "true",
      exists: info.exists === "true"
    };
  } catch {
    return null;
  }
}

/**
 * Parse Neo N3 Map type to JS object.
 */
function parseNeoMap(mapValue: Array<{ key: unknown; value: unknown }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of mapValue) {
    const key = parseNeoValue(item.key);
    const value = parseNeoValue(item.value);
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Parse Neo N3 stack value to string.
 */
function parseNeoValue(val: unknown): string {
  if (!val || typeof val !== "object") return "";
  const v = val as { type: string; value: string };

  switch (v.type) {
    case "ByteString":
      return hexToString(v.value);
    case "Integer":
      return v.value;
    case "Boolean":
      return v.value;
    default:
      return v.value || "";
  }
}

/**
 * Convert hex string to UTF-8 string.
 */
function hexToString(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Verify script against on-chain registration.
 */
export async function verifyScript(
  contractHash: string,
  scriptName: string,
  scriptContent: string,
  rpcUrl: string
): Promise<VerificationResult> {
  // Get on-chain script info
  const onChainInfo = await getOnChainScriptInfo(contractHash, scriptName, rpcUrl);

  if (!onChainInfo) {
    return { valid: false, error: "failed to query on-chain script info" };
  }

  if (!onChainInfo.exists) {
    return { valid: false, error: "script not registered on-chain" };
  }

  if (!onChainInfo.enabled) {
    return { valid: false, error: "script is disabled" };
  }

  // Compute hash of provided script
  const computedHash = await computeScriptHash(scriptContent);

  // Compare hashes
  if (computedHash.toLowerCase() !== onChainInfo.hash.toLowerCase()) {
    return {
      valid: false,
      error: "script hash mismatch",
      scriptInfo: onChainInfo
    };
  }

  return { valid: true, scriptInfo: onChainInfo };
}
