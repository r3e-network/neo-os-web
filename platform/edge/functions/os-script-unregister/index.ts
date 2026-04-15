import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-script-unregister", permission: "scripts" },
  async ({ appId, params }) => {
    const hookPoint = String(params.hook_point ?? params.hookPoint ?? "").trim();
    if (!hookPoint) throw new Error("hook_point required");

    const scriptHash = String(params.script_hash ?? params.scriptHash ?? "").trim();
    if (!scriptHash) throw new Error("script_hash required");

    return buildInvocationIntent(CONTRACT_HASH, "UnregisterScript", [
      { type: "String", value: appId },
      { type: "String", value: hookPoint },
      { type: "Hash160", value: scriptHash },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
