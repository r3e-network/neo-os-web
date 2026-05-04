/**
 * TxProxy client for Edge Functions
 * Calls the TxProxy service to execute on-chain transactions
 */
import { getServiceConfig } from "./k8s-config.ts";
import { parseDecimalToInt } from "./amount.ts";

const GAS_CONTRACT_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

interface InvokeRequest {
  request_id: string;
  intent?: string;
  contract_hash: string;
  method: string;
  params: ContractParam[];
  wait?: boolean;
}

interface ContractParam {
  type: string;
  value: string | number | boolean;
}

interface InvokeResponse {
  request_id: string;
  tx_hash?: string;
  vm_state?: string;
  exception?: string;
}

/**
 * Transfer GAS from platform account to user
 */
export async function transferGas(
  requestId: string,
  toAddress: string,
  amount: string,
): Promise<InvokeResponse> {
  const config = getServiceConfig();

  // Convert decimal amount to integer (8 decimals) using parseDecimalToInt to avoid floating-point precision loss
  const amountInt = parseDecimalToInt(amount, 8).toString();

  const req: InvokeRequest = {
    request_id: requestId,
    intent: "gas-sponsor",
    contract_hash: GAS_CONTRACT_HASH,
    method: "transfer",
    params: [
      { type: "Hash160", value: "PLATFORM_SPONSOR" },
      { type: "Hash160", value: toAddress },
      { type: "Integer", value: amountInt },
      { type: "Any", value: "" },
    ],
    wait: false,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${config.txProxyUrl}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("TxProxy request timed out after 10s");
    }
    throw new Error(
      `TxProxy request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TxProxy request failed (${res.status})`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error("TxProxy returned invalid JSON");
  }
}
