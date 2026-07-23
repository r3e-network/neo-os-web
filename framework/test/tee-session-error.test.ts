import { describe, expect, it } from "vitest";
import { teeSessionStart } from "@framework/logic/tee-session";

describe("Morpheus TEE session errors", () => {
  it("surfaces the cached live view and accepted operation count", async () => {
    const fetcher = async () => new Response(JSON.stringify({
      commitment: "a".repeat(64),
      public_key: "public",
      session_token: "session",
      view: { cards: [1], slots: [] },
      current_view: { cards: [2], slots: [2] },
      op_count: 3,
      config: {},
    }), { status: 200, headers: { "content-type": "application/json" } });

    const started = await teeSessionStart({
      appId: "miniapp-sheep-solitaire",
      engineHash: "0".repeat(64),
      network: "testnet",
      contractHash: `0x${"1".repeat(40)}`,
      gameId: "7",
      player: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      difficulty: 0,
    }, fetcher as typeof fetch);

    expect(started.view).toEqual({ cards: [1], slots: [] });
    expect(started.currentView).toEqual({ cards: [2], slots: [2] });
    expect(started.opCount).toBe(3);
  });

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
