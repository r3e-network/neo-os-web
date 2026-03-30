import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_SCRIPT_ENGINE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-script-list", permission: "scripts" },
  async ({ appId }) => {
    return invokeOSContract(CONTRACT_HASH, "GetScript", [
      { type: "String", value: appId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
