import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_VESTING_SERVICE_HASH") ?? "";

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
