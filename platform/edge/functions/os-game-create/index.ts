import { getEnv } from "../_shared/env.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_GAME_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-game-create", permission: "games" },
  async ({ appId, params }) => {
    const config = params.config;
    if (!config || typeof config !== "object") throw new Error("config required");

    return buildInvocationIntent(CONTRACT_HASH, "CreatePool", [
      { type: "String", value: appId },
      { type: "String", value: JSON.stringify(config) },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
