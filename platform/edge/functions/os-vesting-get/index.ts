import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-vesting-get", permission: "vesting", cacheable: true },
  async ({ appId, params }) => {
    const streamId = String(params.stream_id ?? params.streamId ?? "").trim();
    if (!streamId) throw new Error("stream_id required");

    return invokeOSContractCached(CONTRACT_HASH, "GetStream", [
      { type: "String", value: appId },
      { type: "String", value: streamId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
