/**
 * TxProxy client for Edge Functions
 * Calls the TxProxy service to execute on-chain transactions
 */
import { getServiceConfig } from "./k8s-config.ts";
import { getNativeContractAddress } from "./chains.ts";

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

interface InvokeOptions {
  baseUrl: string;
  serviceId: string;
  contractAddress: string;
  method: string;
  params: ContractParam[];
  signers?: string[];
  extraWitnesses?: string[];
  wait?: boolean;
}

interface InvokeResult {
  success: boolean;
  tx_id?: string;
  error?: string;
}

/**
 * Generic invoke function for TxProxy
 */
export async function invokeTxProxy(
  options: InvokeOptions,
  context: { requestId: string; req?: Request },
  wait = false
): Promise<InvokeResult | Response> {
  const { getServiceConfig } = await import("./k8s-config.ts");
  const { error } = await import("./error-codes.ts");

  const config = getServiceConfig();

  const req: InvokeRequest = {
    request_id: context.requestId,
    contract_address: options.contractAddress,
    method: options.method,
    params: options.params,
    wait: options.wait ?? wait,
  };

  const res = await fetch(`${options.baseUrl || config.txProxyUrl}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.serviceId ? { "X-Service-ID": options.serviceId } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    return error(503, `TxProxy error: ${res.status} - ${text}`, "EXT_001", context.req);
  }

  const result: InvokeResponse = await res.json();

  if (result.vm_state && result.vm_state !== "HALT") {
    return {
      success: false,
      error: result.exception || "VM fault",
    };
  }

  return {
    success: true,
    tx_id: result.tx_hash,
  };
}

/**
 * Transfer GAS from platform account to user
 * @param requestId Request identifier
 * @param toAddress Recipient address
 * @param amount Amount in GAS (decimal format)
 * @param chainId Chain identifier (defaults to neo-n3-testnet)
 */
export async function transferGas(
  requestId: string,
  toAddress: string,
  amount: string,
  chainId: string = "neo-n3-testnet"
): Promise<InvokeResponse> {
  const config = getServiceConfig();
  const gasAddress = getNativeContractAddress(chainId, "gas");
  if (!gasAddress) {
    throw new Error(`GAS contract not found for chain: ${chainId}`);
  }

  // Convert decimal amount to integer (8 decimals)
  const amountInt = Math.floor(parseFloat(amount) * 1e8).toString();

  const req: InvokeRequest = {
    request_id: requestId,
    intent: "gas-sponsor",
    contract_address: gasAddress,
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
