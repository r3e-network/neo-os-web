import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

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

    const startTimeRaw = String(params.start_time ?? params.startTime ?? "").trim();
    if (!startTimeRaw) throw new Error("start_time required");
    let startTime: bigint;
    try {
      startTime = BigInt(startTimeRaw);
    } catch {
      throw new Error("invalid start_time");
    }
    if (startTime < 0n) throw new Error("start_time must be non-negative");

    const durationRaw = String(params.duration ?? "").trim();
    if (!durationRaw) throw new Error("duration required");
    let duration: bigint;
    try {
      duration = BigInt(durationRaw);
    } catch {
      throw new Error("invalid duration");
    }
    if (duration <= 0n) throw new Error("duration must be > 0");

    return buildInvocationIntent(CONTRACT_HASH, "CreateStream", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Hash160", value: beneficiary },
      { type: "Integer", value: amount.toString() },
      { type: "Integer", value: startTime.toString() },
      { type: "Integer", value: duration.toString() },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
