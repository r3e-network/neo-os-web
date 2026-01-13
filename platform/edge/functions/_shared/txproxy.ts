/**
 * TxProxy client for Edge Functions
 * Calls the TxProxy service to execute on-chain transactions
 */
import { getServiceConfig } from "./k8s-config.ts";

const GAS_CONTRACT_ADDRESS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

interface InvokeRequest {
  request_id: string;
  intent?: string;
  contract_address: string;
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
export async function transferGas(requestId: string, toAddress: string, amount: string): Promise<InvokeResponse> {
  const config = getServiceConfig();

  // Convert decimal amount to integer (8 decimals)
  const amountInt = Math.floor(parseFloat(amount) * 1e8).toString();

  const req: InvokeRequest = {
    request_id: requestId,
    intent: "gas-sponsor",
    contract_address: GAS_CONTRACT_ADDRESS,
    method: "transfer",
    params: [
      { type: "Hash160", value: "PLATFORM_SPONSOR" },
      { type: "Hash160", value: toAddress },
      { type: "Integer", value: amountInt },
      { type: "Any", value: "" },
    ],
    wait: true,
  };

  const res = await fetch(`${config.txProxyUrl}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TxProxy error: ${res.status} - ${text}`);
  }

  return await res.json();
}
