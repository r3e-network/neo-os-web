import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_NFT_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-nft-transfer", permission: "nft" },
  async ({ appId, userId, params }) => {
    const tokenId = String(params.token_id ?? params.tokenId ?? "").trim();
    if (!tokenId) throw new Error("token_id required");

    const to = String(params.to ?? params.recipient ?? "").trim();
    if (!to) throw new Error("to (recipient) required");

    return buildInvocationIntent(CONTRACT_HASH, "Transfer", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Hash160", value: to },
      { type: "String", value: tokenId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
