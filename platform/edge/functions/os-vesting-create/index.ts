import { getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_VESTING_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-vesting-create", permission: "vesting" },
  async ({ appId, userId, params }) => {
    const beneficiary = String(params.beneficiary ?? "").trim();
    if (!beneficiary) throw new Error("beneficiary required");

    let amount: bigint;
    try {
      amount = parseDecimalToInt(String(params.amount ?? ""), 8);
    } catch {
      throw new Error("invalid amount");
    }
    if (amount <= 0n) throw new Error("amount must be > 0");

    const startTime = String(params.start_time ?? params.startTime ?? "").trim();
    if (!startTime) throw new Error("start_time required");

    const duration = String(params.duration ?? "").trim();
    if (!duration) throw new Error("duration required");

    return buildInvocationIntent(CONTRACT_HASH, "CreateStream", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Hash160", value: beneficiary },
      { type: "Integer", value: amount.toString() },
      { type: "Integer", value: startTime },
      { type: "Integer", value: duration },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
