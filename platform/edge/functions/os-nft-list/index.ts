import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const handler = createOSHandler(
  { scopeName: "os-nft-list", permission: "nft", cacheable: true },
  async ({ appId, userId, params }) => {
    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    return invokeOSContractCached(CONTRACT_HASH, "GetTokensByOwner", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: String(Math.floor(limit)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
