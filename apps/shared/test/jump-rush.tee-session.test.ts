import { afterEach, describe, expect, it, vi } from "vitest";

import {
  morpheusNetworkOf,
  teeFinalize,
  teeMove,
  teeStart,
  type TeeIdentity,
} from "../../jump-rush/src/logic/tee-session";

const identity: TeeIdentity = {
  appId: "miniapp-jump-rush",
  network: "testnet",
  contractHash: `0x${"11".repeat(20)}`,
  gameId: "7",
  player: `0x${"22".repeat(20)}`,
  difficulty: 0,
};

function response(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function startEnvelope(platforms: unknown): Record<string, unknown> {
  return {
    commitment: "ab".repeat(32),
    bind_signature: "cd".repeat(64),
    public_key: "test-public-key-material",
    session_token: "test-session-token-material",
    view: { platforms },
  };
}

const route = Array.from({ length: 11 }, (_, index) => ({
  x: index === 0 ? 60 : 180 + index * 190,
  width: index === 0 ? 120 : 100,
  gap: index === 0 ? 0 : 90,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("jump-rush TEE session envelope", () => {
  it("fails closed when a proof network cannot be identified", () => {
    expect(morpheusNetworkOf("neo-n3-testnet")).toBe("testnet");
    expect(morpheusNetworkOf("neo-n3-mainnet")).toBe("mainnet");
    expect(() => morpheusNetworkOf("")).toThrow("unknown Neo network");
    expect(() => morpheusNetworkOf("private-chain")).toThrow("unknown Neo network");
  });

  it("accepts and preserves authoritative platform objects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(startEnvelope(route))));
    const started = await teeStart(identity);
    expect(started.view.platforms).toEqual(route);
    expect(started.commitment).toBe("ab".repeat(32));
  });

  it("rejects the legacy number-only view and non-hex proof envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(startEnvelope([10, 20, 30, 40, 50]))));
    await expect(teeStart(identity)).rejects.toThrow("malformed platform view");

    vi.stubGlobal("fetch", vi.fn(async () => response({
      ...startEnvelope(route),
      commitment: "z".repeat(64),
    })));
    await expect(teeStart(identity)).rejects.toThrow("malformed commitment envelope");
  });

  it("sends chargeLevel without a stale chargeMs field", async () => {
    const fetchMock = vi.fn(async () => response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await teeMove(identity, "test-session-token-material", 0, { type: "jump", chargeLevel: 63 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { op?: Record<string, unknown> };
    expect(body.op).toEqual({ type: "jump", chargeLevel: 63 });
    expect(body.op).not.toHaveProperty("chargeMs");
  });

  it("rejects malformed hashes, signatures, and numeric settlement fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      problem_hash: "ab".repeat(32),
      answer_hash: "cd".repeat(32),
      elapsed_ms: -1,
      undos: 0,
      settle_signature: "ef".repeat(64),
    })));
    await expect(teeFinalize(identity, "test-session-token-material"))
      .rejects.toThrow("malformed settlement");
  });
});
