// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, notFoundError } from "../_shared/error-codes.ts";
import { getNeoRpcUrl } from "../_shared/k8s-config.ts";
import { getChainConfig, getNativeContractAddress } from "../_shared/chains.ts";

interface Nep17Balance {
  assethash: string;
  amount: string;
  lastupdatedblock: number;
}

export const handler = createHandler(
  { method: "GET", auth: "user", rateLimit: "wallet-balance", scope: "wallet-balance", requireWallet: true },
  async ({ req, auth, wallet }) => {
    const url = new URL(req.url);
    const chainId = url.searchParams.get("chain_id")?.trim() || "neo-n3-mainnet";
    const chain = getChainConfig(chainId);
    if (!chain) return notFoundError("chain", req);

    // Query on-chain balances
    const rpcUrl = chain.rpc_urls?.[0] || getNeoRpcUrl();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getnep17balances",
        params: [wallet.address],
      }),
    });

    if (!res.ok) {
      return errorResponse("SERVER_002", { message: "RPC request failed" }, req);
    }

    const data = await res.json();
    if (data.error) {
      return errorResponse("SERVER_002", { message: data.error.message }, req);
    }

    // Parse balances
    const balances: Nep17Balance[] = data.result?.balance || [];
    const result: Record<string, string> = {};

    // Get native contract addresses for this chain
    const gasHash = getNativeContractAddress(chainId, "gas")?.toLowerCase();
    const neoHash = getNativeContractAddress(chainId, "neo")?.toLowerCase();

    for (const b of balances) {
      const hash = b.assethash.toLowerCase();
      const amount = BigInt(b.amount);
      const decimals = hash === gasHash ? 8n : 0n;
      const divisor = 10n ** decimals;
      const intPart = amount / divisor;
      const fracPart = amount % divisor;

      let symbol = "UNKNOWN";
      if (hash === gasHash) symbol = "GAS";
      else if (hash === neoHash) symbol = "NEO";

      if (decimals > 0n) {
        result[symbol] = `${intPart}.${fracPart.toString().padStart(Number(decimals), "0")}`;
      } else {
        result[symbol] = intPart.toString();
      }
    }

    // Ensure GAS and NEO are always present
    if (!result.GAS) result.GAS = "0.00000000";
    if (!result.NEO) result.NEO = "0";

    return json({ address: wallet.address, chain_id: chainId, balances: result }, {}, req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
