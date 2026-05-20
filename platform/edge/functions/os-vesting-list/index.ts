import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Audit fix E-7: previously returned an empty array unconditionally. Now routes
// to the kernel's `ListVestingStreams(appId, user, limit)` read so callers see
// the real stream list (or an honest "no streams" empty list).

export const handler = createOSHandler(
  { scopeName: "os-vesting-list", permission: "vesting", cacheable: true },
  async ({ appId, userId, params }) => {
    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const contractHash = getKernelHash();
    if (!contractHash) {
      throw new Error("vesting service contract hash not configured");
    }
    const result = await invokeOSContractCached(contractHash, "ListVestingStreams", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: String(limit) },
    ]);
    if (Array.isArray(result)) return result as unknown[];
    return [] as unknown[];
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
