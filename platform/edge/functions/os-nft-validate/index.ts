import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-nft-validate", permission: "nft" },
  async ({ appId, params }) => {
    const tokenId = String(params.token_id ?? params.tokenId ?? "").trim();
    if (!tokenId) throw new Error("token_id required");

    return buildInvocationIntent(CONTRACT_HASH, "Validate", [
      { type: "String", value: appId },
      { type: "String", value: tokenId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
