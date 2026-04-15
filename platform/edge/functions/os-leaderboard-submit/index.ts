import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-leaderboard-submit", permission: "leaderboard" },
  async ({ appId, userId, params }) => {
    const score = params.score;
    if (score === undefined || score === null) throw new Error("score required");
    const scoreInt = Number(score);
    if (!Number.isFinite(scoreInt)) throw new Error("score must be a number");

    return buildInvocationIntent(getKernelHash(), "SubmitScore", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
      { type: "Integer", value: String(Math.floor(scoreInt)) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
