/**
 * Neo N3 RPC utilities for balance queries
 */
import { getNeoRpcUrl } from "./k8s-config.ts";
import { getNativeContractAddress } from "./chains.ts";

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

interface Nep17Balance {
  assethash: string;
  amount: string;
  lastupdatedblock: number;
}

interface Nep17BalancesResult {
  address: string;
  balance: Nep17Balance[];
}

/**
 * Call Neo RPC method
 */
async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const rpcUrl = getNeoRpcUrl();
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status}`);
  }

  const data: RpcResponse<T> = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result as T;
}

/**
 * Get GAS balance for an address
 * @param address Wallet address
 * @param chainId Chain identifier (defaults to neo-n3-testnet)
 * @returns GAS balance as decimal string (8 decimals)
 */
export async function getGasBalance(address: string, chainId: string = "neo-n3-testnet"): Promise<string> {
  const gasAddress = getNativeContractAddress(chainId, "gas");
  if (!gasAddress) {
    throw new Error(`GAS contract not found for chain: ${chainId}`);
  }

  const result = await rpcCall<Nep17BalancesResult>("getnep17balances", [address]);

  const gasBalance = result.balance.find((b) => b.assethash.toLowerCase() === gasAddress.toLowerCase());

  if (!gasBalance) {
    return "0";
  }

  // Convert from integer (8 decimals) to decimal string
  const amount = BigInt(gasBalance.amount);
  const decimals = 8n;
  const divisor = 10n ** decimals;
  const intPart = amount / divisor;
  const fracPart = amount % divisor;

  return `${intPart}.${fracPart.toString().padStart(8, "0")}`;
}
