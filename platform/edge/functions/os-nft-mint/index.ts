import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_NFT_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-nft-mint", permission: "nft" },
  async ({ appId, userId, params }) => {
    const metadata = params.metadata;
    if (!metadata || typeof metadata !== "object") throw new Error("metadata required");

    return buildInvocationIntent(CONTRACT_HASH, "Mint", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "String", value: JSON.stringify(metadata) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
