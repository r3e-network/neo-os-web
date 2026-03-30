import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_NFT_SERVICE_HASH") ?? "";

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
