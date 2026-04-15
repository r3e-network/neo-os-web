import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-payment-withdraw", permission: "payments" },
  async ({ appId, userId, params }) => {
    let amount: bigint;
    try {
      amount = parseDecimalToInt(String(params.amount ?? ""), 8);
    } catch {
      throw new Error("invalid amount");
    }
    if (amount <= 0n) throw new Error("amount must be > 0");

    return buildInvocationIntent(CONTRACT_HASH, "Withdraw", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: amount.toString() },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
