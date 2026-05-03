import { normalizeUInt160 } from "../_shared/contracts.ts";
import { NATIVE_CONTRACTS } from "../_shared/os-contracts.ts";
import {
  createOSHandler,
  invokeOSContractCached,
  parseInvokeResultValue,
} from "../_shared/os-service.ts";

function toIntegerString(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? text : fallback;
}

export const handler = createOSHandler(
  { scopeName: "os-checkin-checkin", permission: "checkin" },
  async ({ appId, policy }) => {
    const contractHash = policy?.contractHash;
    if (!contractHash) throw new Error("checkin contract hash not configured");

    const platformStatsRaw = await invokeOSContractCached(contractHash, "getPlatformStats", []);
    const platformStats = parseInvokeResultValue(platformStatsRaw) as Record<string, unknown> | null;
    const checkInFee = toIntegerString(platformStats?.checkInFee, "100000");

    return {
      intent: "checkin",
      invocation: {
        contract_hash: normalizeUInt160(NATIVE_CONTRACTS.gas),
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          { type: "Hash160", value: normalizeUInt160(contractHash) },
          { type: "Integer", value: checkInFee },
          { type: "String", value: `${appId}:checkin` },
        ],
      },
    };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
