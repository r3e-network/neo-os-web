import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_SCRIPT_ENGINE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-script-register", permission: "scripts" },
  async ({ appId, params }) => {
    const hookPoint = String(params.hook_point ?? params.hookPoint ?? "").trim();
    if (!hookPoint) throw new Error("hook_point required");

    const scriptHash = String(params.script_hash ?? params.scriptHash ?? "").trim();
    if (!scriptHash) throw new Error("script_hash required");

    return buildInvocationIntent(CONTRACT_HASH, "RegisterScript", [
      { type: "String", value: appId },
      { type: "String", value: hookPoint },
      { type: "Hash160", value: scriptHash },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
