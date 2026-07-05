import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OWNER_HASH = addressToScriptHash(OWNER);
const CONTRACT = "0xe2fba2a73cf92874ecc41b7fff8d3d5da0354c43";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;

// Captured invoke/read calls the composable makes through the wallet SDK.
const invokeContract = vi.fn(async (params: { operation: string }) => ({
  txid: `0x${params.operation}`,
}));
const invokeRead = vi.fn(
  async (_params: { operation: string }): Promise<{ stack: unknown[] }> => ({ stack: [] }),
);

const chainTypeRef = { value: "neo-n3-mainnet" };
const addressRef = { value: OWNER };

vi.mock("@shared/utils/wallet-sdk", () => ({
  useWallet: () => ({
    address: addressRef,
    chainType: chainTypeRef,
    connect: vi.fn(async () => OWNER),
    invokeContract,
    invokeRead,
    getContractAddress: vi.fn(async () => CONTRACT),
  }),
  useEvents: () => ({ list: vi.fn(async () => ({ events: [] })) }),
  usePayments: () => ({ payGAS: vi.fn(async () => ({ txid: "0xpay", receipt_id: "" })) }),
}));

// The deposit-then-act flow waits for the deposit to confirm; return "confirmed"
// so the test exercises the consuming call without a real indexer.
vi.mock("../utils/n3index", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    waitForTransactionStatus: vi.fn(async () => ({ status: "confirmed" })),
  };
});

import { useQuadraticRounds } from "../../quadratic-funding/src/composables/useQuadraticRounds";

afterEach(() => {
  vi.clearAllMocks();
});

/** display-order 0x hex (20 bytes) -> base64 of the chain (reversed) bytes. */
function displayHashToChainBase64(displayHash: string): string {
  const hex = displayHash.replace(/^0x/, "");
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  bytes.reverse();
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function mapEntry(key: string, value: { type: string; value: unknown }) {
  return { key: { type: "ByteString", value: btoa(key) }, value };
}

/** Build a getRoundDetails Map stack item for a round owned by OWNER. */
function roundDetailsStack(creatorDisplayHash: string, overrides: Record<string, { type: string; value: unknown }> = {}) {
  const base: Record<string, { type: string; value: unknown }> = {
    creator: { type: "ByteString", value: displayHashToChainBase64(creatorDisplayHash) },
    asset: { type: "ByteString", value: displayHashToChainBase64(GAS_HASH) },
    assetSymbol: { type: "ByteString", value: btoa("GAS") },
    matchingPool: { type: "Integer", value: "1000000000" },
    matchingAllocated: { type: "Integer", value: "0" },
    matchingWithdrawn: { type: "Integer", value: "0" },
    matchingRemaining: { type: "Integer", value: "1000000000" },
    totalContributed: { type: "Integer", value: "0" },
    projectCount: { type: "Integer", value: "0" },
    startTime: { type: "Integer", value: "1778242209689" },
    endTime: { type: "Integer", value: "1778242359689" },
    status: { type: "ByteString", value: btoa("active") },
    title: { type: "ByteString", value: btoa("Public Goods") },
    description: { type: "ByteString", value: btoa("infra") },
    ...overrides,
  };
  return {
    stack: [
      {
        type: "Map",
        value: Object.entries(base).map(([k, v]) => mapEntry(k, v)),
      },
    ],
  };
}

function wireReads(adminDisplayHash: string, creatorDisplayHash: string, roundOverrides?: Record<string, { type: string; value: unknown }>) {
  invokeRead.mockImplementation(async (params: { operation: string }) => {
    switch (params.operation) {
      case "admin":
        return { stack: [{ type: "ByteString", value: displayHashToChainBase64(adminDisplayHash) }] };
      case "getRounds":
        return { stack: [{ type: "Array", value: [{ type: "Integer", value: "1" }] }] };
      case "getRoundDetails":
        return roundDetailsStack(creatorDisplayHash, roundOverrides);
      default:
        return { stack: [] };
    }
  });
}

function futureLocalTime(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe("useQuadraticRounds deposit-then-act + milliseconds", () => {
  beforeEach(() => {
    addressRef.value = OWNER;
    chainTypeRef.value = "neo-n3-mainnet";
  });

  it("deposits matching funds with a memo, then createRound with millisecond times", async () => {
    const rounds = useQuadraticRounds();

    // End time 1h in the future, start time 30min in the future.
    const startMs = Date.now() + 30 * 60 * 1000;
    const endMs = Date.now() + 60 * 60 * 1000;
    const toLocal = (ms: number) => {
      const d = new Date(ms);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    await rounds.createRound({
      title: "Public Goods",
      description: "infra + education",
      asset: "GAS",
      matchingPool: "2",
      startTime: toLocal(startMs),
      endTime: toLocal(endMs),
    });

    // First call: the prepaid GAS transfer with the app-namespaced memo.
    const transferCall = invokeContract.mock.calls.find(
      (call) => call[0].operation === "transfer",
    );
    expect(transferCall).toBeDefined();
    const transferArgs = (transferCall![0] as { args: Array<{ type: string; value: unknown }> }).args;
    expect((transferCall![0] as { scriptHash: string }).scriptHash).toBe(GAS_HASH);
    expect(transferArgs[1]).toEqual({ type: "Hash160", value: CONTRACT });
    expect(transferArgs[2]).toEqual({ type: "Integer", value: "200000000" });
    expect(transferArgs[3]).toEqual({
      type: "String",
      value: "miniapp-quadratic-funding:create",
    });

    // Second call: createRound with start/end in MILLISECONDS (not seconds).
    const createCall = invokeContract.mock.calls.find(
      (call) => call[0].operation === "createRound",
    );
    expect(createCall).toBeDefined();
    const createArgs = (createCall![0] as { args: Array<{ type: string; value: string }> }).args;
    // Minute-resolution local input → multiple of 60_000 ms; both ≥ 12 digits.
    expect(Number(createArgs[3].value)).toBeGreaterThan(1_000_000_000_000);
    expect(Number(createArgs[4].value)).toBeGreaterThan(Number(createArgs[3].value));
    expect(Number(createArgs[4].value) % 1000).toBe(0);
  });

  it("rejects a round whose end time is already in the past without any invoke", async () => {
    const rounds = useQuadraticRounds();
    await rounds.createRound({
      title: "Late",
      description: "",
      asset: "GAS",
      matchingPool: "2",
      startTime: "2000-01-01 00:00",
      endTime: "2000-01-02 00:00",
    });
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it("rejects fractional NEO matching pool creation instead of truncating", async () => {
    const rounds = useQuadraticRounds();
    await rounds.createRound({
      title: "NEO Round",
      description: "",
      asset: "NEO",
      matchingPool: "1.5",
      startTime: futureLocalTime(30 * 60 * 1000),
      endTime: futureLocalTime(60 * 60 * 1000),
    });

    expect(invokeContract).not.toHaveBeenCalled();
  });

  it("rejects fractional NEO addMatching instead of truncating", async () => {
    wireReads(OWNER_HASH, OWNER_HASH, {
      asset: { type: "ByteString", value: displayHashToChainBase64(NEO_HASH) },
      assetSymbol: { type: "ByteString", value: btoa("NEO") },
      matchingPool: { type: "Integer", value: "10" },
      matchingRemaining: { type: "Integer", value: "10" },
    });
    const rounds = useQuadraticRounds();
    await rounds.refreshRounds();
    invokeContract.mockClear();

    await rounds.addMatching("2.25");

    expect(invokeContract).not.toHaveBeenCalled();
  });
});

describe("useQuadraticRounds identity + admin gating", () => {
  beforeEach(() => {
    addressRef.value = OWNER;
    chainTypeRef.value = "neo-n3-mainnet";
  });

  it("recognizes the connected wallet as the round creator despite the contract returning a hex hash", async () => {
    // Round creator is OWNER; admin is a different wallet. Pre-start, no
    // contributions, so cancel is available.
    const futureStart = String(Date.now() + 24 * 3600 * 1000);
    const futureEnd = String(Date.now() + 48 * 3600 * 1000);
    wireReads("0x1111111111111111111111111111111111111111", OWNER_HASH, {
      startTime: { type: "Integer", value: futureStart },
      endTime: { type: "Integer", value: futureEnd },
      status: { type: "ByteString", value: btoa("upcoming") },
    });
    const rounds = useQuadraticRounds();
    await rounds.refreshRounds();

    const round = rounds.selectedRound.get();
    expect(round).toBeTruthy();
    // creator is normalized to display-order 0x hex matching the wallet.
    expect(round!.creator).toBe(OWNER_HASH);
    // Owner controls (cancel pre-start with no contributions) are enabled.
    expect(rounds.canManageSelectedRound.get()).toBe(true);
    expect(rounds.canCancelSelectedRound.get()).toBe(true);
    // Finalize stays admin-only — the creator is NOT the admin here.
    expect(rounds.canFinalizeSelectedRound.get()).toBe(false);
    expect(rounds.isAdmin.get()).toBe(false);
  });

  it("enables finalize only for the platform admin wallet after the round ends", async () => {
    // Admin == OWNER; round ended; some contributions made.
    wireReads(OWNER_HASH, "0x2222222222222222222222222222222222222222", {
      status: { type: "ByteString", value: btoa("ended") },
      totalContributed: { type: "Integer", value: "10000000" },
      matchingAllocated: { type: "Integer", value: "0" },
    });
    const rounds = useQuadraticRounds();
    await rounds.refreshRounds();

    expect(rounds.isAdmin.get()).toBe(true);
    expect(rounds.canFinalizeSelectedRound.get()).toBe(true);
    // Non-admin creator controls are disabled for this wallet.
    expect(rounds.canManageSelectedRound.get()).toBe(false);
    // Cancel is blocked once contributions exist even if it were the creator.
    expect(rounds.canCancelSelectedRound.get()).toBe(false);
  });

  it("enables claim-unused only for a finalized round with remaining matching, for the creator", async () => {
    wireReads("0x3333333333333333333333333333333333333333", OWNER_HASH, {
      status: { type: "ByteString", value: btoa("finalized") },
      matchingAllocated: { type: "Integer", value: "300000000" },
      matchingRemaining: { type: "Integer", value: "700000000" },
      totalContributed: { type: "Integer", value: "10000000" },
    });
    const rounds = useQuadraticRounds();
    await rounds.refreshRounds();

    expect(rounds.canClaimUnused.get()).toBe(true);
  });
});
