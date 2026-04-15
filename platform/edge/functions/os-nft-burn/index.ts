import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-nft-burn", permission: "nft" },
  async ({ appId, userId, params }) => {
    const tokenId = String(params.token_id ?? params.tokenId ?? "").trim();
    if (!tokenId) throw new Error("token_id required");

    return buildInvocationIntent(CONTRACT_HASH, "Burn", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "String", value: tokenId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
