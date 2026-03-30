import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_ESCROW_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-escrow-complete", permission: "escrow" },
  async ({ appId, userId, params }) => {
    const escrowId = String(params.escrow_id ?? params.escrowId ?? "").trim();
    if (!escrowId) throw new Error("escrow_id required");

    const milestoneIndex = Number(params.milestone_index ?? params.milestoneIndex ?? 0);
    if (!Number.isFinite(milestoneIndex) || milestoneIndex < 0) throw new Error("invalid milestone_index");

    return buildInvocationIntent(CONTRACT_HASH, "CompleteMilestone", [
      { type: "String", value: appId },
      { type: "String", value: escrowId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: String(Math.floor(milestoneIndex)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
