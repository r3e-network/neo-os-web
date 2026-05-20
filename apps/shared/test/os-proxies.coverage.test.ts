/**
 * Backfill unit tests for the OS service proxies that the edge-function
 * coverage audit flagged as having a proxy without integration tests:
 *   EscrowProxy, VestingProxy, NFTProxy, BadgeProxy, LeaderboardProxy.
 *
 * Each test asserts that the proxy method translates into the expected
 * edge function endpoint with the right payload shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgeClient } from "../services/os/EdgeClient";
import { EscrowProxy } from "../services/os/EscrowProxy";
import { VestingProxy } from "../services/os/VestingProxy";
import { NFTProxy } from "../services/os/NFTProxy";
import { BadgeProxy } from "../services/os/BadgeProxy";
import { LeaderboardProxy } from "../services/os/LeaderboardProxy";

const walletMock = vi.hoisted(() => ({
  address: { value: null as string | null },
  connect: vi.fn(async () => {
    walletMock.address.value = "NMockSender";
  }),
  invokeContract: vi.fn(async () => ({ txid: "0xwalletintent" })),
  invokeWithConfirmation: vi.fn(async () => ({ txid: "0xwalletintent" })),
}));

vi.mock("../utils/wallet-sdk", () => ({ useWallet: () => walletMock }));

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchSpy: ReturnType<typeof vi.fn>;
let edge: EdgeClient;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  window.sessionStorage.clear();
  walletMock.address.value = "NMockSender";
  edge = new EdgeClient("test-app", "https://edge.example.com");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// EscrowProxy
// ---------------------------------------------------------------------------
describe("EscrowProxy", () => {
  it("create() → os-escrow-create with full params", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ escrowId: "esc-1" }));
    const proxy = new EscrowProxy("app-escrow", edge);
    await proxy.create({
      beneficiary: "Nbeneficiary",
      amount: "100",
      milestones: [{ name: "M1", amount: "50" }],
      expiry: 1234567,
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://edge.example.com/os-escrow-create");
    const body = JSON.parse(init.body);
    expect(body.beneficiary).toBe("Nbeneficiary");
    expect(body.amount).toBe("100");
    expect(body.milestones).toEqual([{ name: "M1", amount: "50" }]);
  });

  it("fund() → os-escrow-fund with escrowId", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new EscrowProxy("app-escrow", edge).fund("esc-2");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-escrow-fund");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).escrowId).toBe("esc-2");
  });

  it("completeMilestone() → os-escrow-complete with index", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new EscrowProxy("app-escrow", edge).completeMilestone("esc-3", 2);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.escrowId).toBe("esc-3");
    expect(body.milestoneIndex).toBe(2);
  });

  it("refund() → os-escrow-refund", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new EscrowProxy("app-escrow", edge).refund("esc-4");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-escrow-refund");
  });

  it("get() → os-escrow-get", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ escrowId: "esc-5" }));
    await new EscrowProxy("app-escrow", edge).get("esc-5");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-escrow-get");
  });
});

// ---------------------------------------------------------------------------
// VestingProxy
// ---------------------------------------------------------------------------
describe("VestingProxy", () => {
  it("createStream() → os-vesting-create with full payload", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ streamId: "v-1" }));
    await new VestingProxy("app-vest", edge).createStream({
      beneficiary: "Nben",
      totalAmount: "1000",
      rateAmount: "10",
      intervalSeconds: 86400,
      title: "salary",
      notes: "test",
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.beneficiary).toBe("Nben");
    expect(body.totalAmount).toBe("1000");
    expect(body.intervalSeconds).toBe(86400);
  });

  it("claim() → os-vesting-claim with streamId", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new VestingProxy("app-vest", edge).claim("v-2");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-vesting-claim");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).streamId).toBe("v-2");
  });

  it("cancel() → os-vesting-cancel", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new VestingProxy("app-vest", edge).cancel("v-3");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-vesting-cancel");
  });

  it("listStreams(role) → os-vesting-list with role", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await new VestingProxy("app-vest", edge).listStreams("beneficiary");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).role).toBe("beneficiary");
  });
});

// ---------------------------------------------------------------------------
// NFTProxy
// ---------------------------------------------------------------------------
describe("NFTProxy", () => {
  it("mint() → os-nft-mint with metadata", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ tokenId: "nft-1" }));
    await new NFTProxy("app-nft", edge).mint({ name: "card", image: "ipfs://x" });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.metadata).toEqual({ name: "card", image: "ipfs://x" });
  });

  it("transfer() → os-nft-transfer with tokenId + to", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new NFTProxy("app-nft", edge).transfer("nft-1", "NToRecipient");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.tokenId).toBe("nft-1");
    expect(body.to).toBe("NToRecipient");
  });

  it("burn() → os-nft-burn", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new NFTProxy("app-nft", edge).burn("nft-1");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-nft-burn");
  });

  it("list(owner, limit) defaults limit to 50", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await new NFTProxy("app-nft", edge).list("Nown");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).limit).toBe(50);
  });

  it("validate() → os-nft-validate", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new NFTProxy("app-nft", edge).validate("nft-1");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-nft-validate");
  });
});

// ---------------------------------------------------------------------------
// BadgeProxy
// ---------------------------------------------------------------------------
describe("BadgeProxy", () => {
  it("define() → os-badge-define with all fields", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new BadgeProxy("app-badge", edge).define("b-1", "Early Bird", "first 100 users");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.badgeId).toBe("b-1");
    expect(body.name).toBe("Early Bird");
    expect(body.criteria).toBe("first 100 users");
  });

  it("award() → os-badge-award with badgeId + user", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new BadgeProxy("app-badge", edge).award("b-1", "Nuser");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.badgeId).toBe("b-1");
    expect(body.user).toBe("Nuser");
  });

  it("revoke() → os-badge-revoke", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new BadgeProxy("app-badge", edge).revoke("b-1", "Nuser");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-badge-revoke");
  });

  it("list() with no user → empty user param", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await new BadgeProxy("app-badge", edge).list();
    expect(fetchSpy.mock.calls[0][0]).toContain("os-badge-list");
  });

  it("getStat() → os-badge-get-stat", async () => {
    fetchSpy.mockResolvedValue(jsonResponse("42"));
    await new BadgeProxy("app-badge", edge).getStat("Nuser", "kills");
    expect(fetchSpy.mock.calls[0][0]).toContain("os-badge-get-stat");
  });

  it("updateStat() → os-badge-update-stat with value", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new BadgeProxy("app-badge", edge).updateStat("Nuser", "kills", "100");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.value).toBe("100");
  });
});

// ---------------------------------------------------------------------------
// LeaderboardProxy
// ---------------------------------------------------------------------------
describe("LeaderboardProxy", () => {
  it("submitScore() → os-leaderboard-submit", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new LeaderboardProxy("app-lb", edge).submitScore("9001");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.score).toBe("9001");
  });

  it("get() defaults limit to 100", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await new LeaderboardProxy("app-lb", edge).get();
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).limit).toBe(100);
  });

  it("get(limit=25) sends explicit limit", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await new LeaderboardProxy("app-lb", edge).get(25);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).limit).toBe(25);
  });

  it("reset() → os-leaderboard-reset", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await new LeaderboardProxy("app-lb", edge).reset();
    expect(fetchSpy.mock.calls[0][0]).toContain("os-leaderboard-reset");
  });
});

// ---------------------------------------------------------------------------
// AppId injection — every proxy must pipe the EdgeClient's appId through to
// the edge function body. Proxies are constructed with an appId that may
// differ from the EdgeClient's; the EdgeClient's appId is the authoritative
// one that the edge function gates on.
// ---------------------------------------------------------------------------
describe("AppId pass-through across all proxies", () => {
  it.each([
    ["EscrowProxy", () => new EscrowProxy("proxy-app", edge).get("e")],
    ["VestingProxy", () => new VestingProxy("proxy-app", edge).cancel("v")],
    ["NFTProxy", () => new NFTProxy("proxy-app", edge).burn("n")],
    ["BadgeProxy", () => new BadgeProxy("proxy-app", edge).revoke("b", "u")],
    ["LeaderboardProxy", () => new LeaderboardProxy("proxy-app", edge).reset()],
  ])("%s injects appId from EdgeClient (test-app)", async (_, exec) => {
    fetchSpy.mockResolvedValue(jsonResponse(undefined));
    await exec();
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    // EdgeClient was constructed with "test-app" in beforeEach.
    expect(body.appId).toBe("test-app");
  });
});
