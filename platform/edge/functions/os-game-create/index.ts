import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-game-create", permission: "games" },
  async ({ appId, params }) => {
    const cfg = (params.config && typeof params.config === "object" ? params.config : params) as Record<string, unknown>;
    const poolType = Number(cfg.poolType ?? cfg.pool_type ?? 0);
    const maxPlayers = Number(cfg.maxPlayers ?? cfg.max_players ?? 10);
    const entryFee = String(cfg.entryFee ?? cfg.entry_fee ?? "0");
    const duration = String(cfg.duration ?? "3600");

    return buildInvocationIntent(CONTRACT_HASH, "CreatePool", [
      { type: "String", value: appId },
      { type: "Integer", value: String(poolType) },
      { type: "Integer", value: String(maxPlayers) },
      { type: "Integer", value: entryFee },
      { type: "Integer", value: duration },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
