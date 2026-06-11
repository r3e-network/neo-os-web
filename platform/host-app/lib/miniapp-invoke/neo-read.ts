import type { NeoNetwork } from "../neo-network";

type NeoReadStackItem = {
  type?: string;
  value?: unknown;
};

type NeoReadResponse = {
  error?: { message?: string };
  result?: {
    state?: string;
    exception?: string;
    stack?: NeoReadStackItem[];
  };
};

function stackInteger(item: NeoReadStackItem | undefined, label: string): bigint {
  if (!item || item.type !== "Integer") {
    throw new Error(`${label} did not return an integer.`);
  }
  try {
    return BigInt(String(item.value ?? "0"));
  } catch {
    throw new Error(`${label} returned an invalid integer.`);
  }
}

export async function readNeoInteger({
  contractHash,
  method,
  params,
  network,
  label,
}: {
  contractHash: string;
  method: string;
  params: Array<{ type: string; value: string }>;
  network: NeoNetwork;
  label: string;
}): Promise<bigint> {
  const response = await fetch("/api/rpc/neo-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractHash, method, params, network }),
    signal: AbortSignal.timeout(10000),
  });
  const body = (await response.json().catch(() => ({}))) as NeoReadResponse;
  if (!response.ok) {
    throw new Error(`${label} lookup failed with status ${response.status}.`);
  }
  if (body.error?.message) {
    throw new Error(`${label} lookup failed: ${body.error.message}`);
  }
  if (body.result?.state !== "HALT") {
    throw new Error(
      body.result?.exception || `${label} lookup failed on-chain.`,
    );
  }
  return stackInteger(body.result.stack?.[0], label);
}
