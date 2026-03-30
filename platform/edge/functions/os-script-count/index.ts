import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_SCRIPT_ENGINE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-script-count", permission: "scripts" },
  async ({ appId, params }) => {
    const scriptHash = String(params.script_hash ?? params.scriptHash ?? "").trim();
    if (!scriptHash) throw new Error("script_hash required");

    return invokeOSContract(CONTRACT_HASH, "GetExecutionCount", [
      { type: "String", value: appId },
      { type: "Hash160", value: scriptHash },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
