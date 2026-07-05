import { describe, expect, it } from "vitest";
import { teeSessionStart } from "../logic/tee-session";

describe("Morpheus TEE session errors", () => {
  it("surfaces the human-readable runtime message before the machine code", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          error: "runtime_route_unavailable",
          message:
            "This oracle route requires the full runtime (restoration in progress).",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );

    await expect(
      teeSessionStart(
        {
          appId: "miniapp-flappy-dash",
          engineHash: "0".repeat(64),
          network: "testnet",
          contractHash: `0x${"1".repeat(40)}`,
          gameId: "probe",
          player: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
          difficulty: 0,
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toThrow(
      "This oracle route requires the full runtime (restoration in progress). (runtime_route_unavailable)",
    );
  });
});
