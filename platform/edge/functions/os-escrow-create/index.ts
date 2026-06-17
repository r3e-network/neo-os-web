import { requireKernelHash } from "../_shared/kernel-rpc.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-escrow-create", permission: "escrow" },
  async ({ appId, userId, params }) => {
    // Audit fix E-6 (writes): resolve the kernel hash at call time with the
    // strict accessor. The previous module-load `getKernelHash()` captured ""
    // when the deploy booted before its secrets arrived and produced an
    // empty-contract CreateEscrow intent for the wallet to sign.
    const contractHash = requireKernelHash();
    const counterparty = String(params.counterparty ?? params.beneficiary ?? "").trim() || userId;

    let amount: bigint;
    try {
      amount = parseDecimalToInt(String(params.amount ?? ""), 8);
    } catch {
      throw new Error("invalid amount");
    }
    if (amount <= 0n) throw new Error("amount must be > 0");

    const milestones = Array.isArray(params.milestones)
      ? params.milestones.length
      : Number(params.milestones ?? params.milestoneCount ?? 1);
    if (!Number.isFinite(milestones) || milestones < 1) throw new Error("milestones must be >= 1");

    return buildInvocationIntent(contractHash, "CreateEscrow", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Hash160", value: counterparty },
      { type: "Integer", value: amount.toString() },
      { type: "Integer", value: String(Math.floor(milestones)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
