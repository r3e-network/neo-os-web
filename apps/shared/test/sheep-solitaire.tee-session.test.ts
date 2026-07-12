import { afterEach, describe, expect, it, vi } from "vitest";

import {
  morpheusNetworkOf,
  teeFinalize,
  teeMove,
  teeStart,
  type TeeIdentity,
} from "../../sheep-solitaire/src/logic/tee-session";

const identity: TeeIdentity = {
  appId: "miniapp-sheep-solitaire",
  network: "testnet",
  contractHash: "0x7541e13629eb35ec54181be2772bff34e39d3c35",
  gameId: "12",
  player: "0x1111111111111111111111111111111111111111",
  difficulty: 0,
};

function response(body: Record<string, unknown>, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sheep-solitaire TEE response validation", () => {
  it("retains stable board coordinates and an authoritative tray on start", async () => {
    response({
      commitment: "a".repeat(64),
      bind_signature: "b".repeat(128),
      public_key: "c".repeat(66),
      session_token: "session-12",
      view: {
        cards: [
          { id: 0, symbol: 2, layer: 0, col: 1, row: 2, exposed: true, picked: false },
        ],
        slots: [
          { id: 8, symbol: 3, layer: 1, col: 2, row: 1, exposed: true, picked: true },
        ],
        shuffle_left: 0,
        remove3_left: 1,
      },
    });

    const started = await teeStart(identity);

    expect(started.cards[0]).toMatchObject({ id: 0, col: 1, row: 2 });
    expect(started.slots).toHaveLength(1);
    expect(started.shuffleLeft).toBe(0);
    expect(started.remove3Left).toBe(1);
  });

  it("uses nested move flags and tray state without client-side guessing", async () => {
    response({
      ok: true,
      view: {
        cards: [],
        slots: [],
        matched: true,
        won: true,
        game_over: false,
        shuffle_left: 1,
        remove3_left: 0,
      },
    });

    const moved = await teeMove(identity, "session-12", 2, { type: "pick", cardId: 7 });

    expect(moved.matched).toBe(true);
    expect(moved.won).toBe(true);
    expect(moved.slots).toEqual([]);
    expect(moved.remove3Left).toBe(0);
  });

  it("rejects duplicate or out-of-domain cards and empty session tokens", async () => {
    response({
      commitment: "a".repeat(64),
      bind_signature: "b".repeat(128),
      session_token: "",
      view: {
        cards: [
          { id: 1, symbol: 0, layer: 0, exposed: true, picked: false },
          { id: 1, symbol: 15, layer: 3, exposed: true, picked: false },
        ],
      },
    });

    await expect(teeStart(identity)).rejects.toThrow(/malformed board card|empty session token/);
  });

  it("rejects malformed settlement fields instead of assuming a verified win", async () => {
    response({
      problem_hash: "a".repeat(64),
      answer_hash: "b".repeat(64),
      elapsed_ms: 60_000,
      undos: 4,
      settle_signature: "c".repeat(128),
    });

    await expect(teeFinalize(identity, "session-12")).rejects.toThrow("malformed settlement");
  });

  it("rejects a move when authoritative tray, flags, or tool counts are omitted", async () => {
    response({
      ok: true,
      view: {
        cards: [],
        matched: false,
        won: false,
        game_over: false,
      },
    });

    await expect(teeMove(identity, "session-12", 0, { type: "undo" }))
      .rejects.toThrow(/authoritative tray|invalid shuffle count/);
  });

  it("carries the sealed op log so finalize survives enclave cache eviction", async () => {
    response({
      problem_hash: "a".repeat(64),
      answer_hash: "b".repeat(64),
      elapsed_ms: 60_000,
      undos: 1,
      settle_signature: "c".repeat(128),
    });
    const replay = [
      { type: "pick" as const, cardId: 0 },
      { type: "undo" as const },
    ];

    await teeFinalize(identity, "session-12", replay);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      session_token: "session-12",
      replay,
    });
  });

  it("fails closed when the detected network is not explicit", () => {
    expect(morpheusNetworkOf("neo-n3-testnet")).toBe("testnet");
    expect(morpheusNetworkOf("Neo MainNet")).toBe("mainnet");
    expect(() => morpheusNetworkOf("unknown")).toThrow("unable to prove");
  });
});
