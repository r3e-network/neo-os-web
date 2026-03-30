import { getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_ESCROW_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-escrow-fund", permission: "escrow" },
  async ({ appId, userId, params }) => {
    const escrowId = String(params.escrow_id ?? params.escrowId ?? "").trim();
    if (!escrowId) throw new Error("escrow_id required");

    let amount: bigint;
    try {
      amount = parseDecimalToInt(String(params.amount ?? ""), 8);
    } catch {
      throw new Error("invalid amount");
    }
    if (amount <= 0n) throw new Error("amount must be > 0");

    return buildInvocationIntent(CONTRACT_HASH, "FundEscrow", [
      { type: "String", value: appId },
      { type: "String", value: escrowId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: amount.toString() },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
