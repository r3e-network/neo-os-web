import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-badge-update-stat", permission: "badges" },
  async ({ appId, userId, params }) => {
    const statKey = String(params.stat_key ?? params.statKey ?? "").trim();
    if (!statKey) throw new Error("stat_key required");

    const value = params.value;
    if (value === undefined || value === null) throw new Error("value required");
    const valueInt = Number(value);
    if (!Number.isFinite(valueInt)) throw new Error("value must be a number");

    return buildInvocationIntent(CONTRACT_HASH, "UpdateStat", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "String", value: statKey },
      { type: "Integer", value: String(Math.floor(valueInt)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
