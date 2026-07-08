/**
 * quadratic-funding flows — user-visible behavior pins.
 *
 * Snapshots the app's end-to-end action behavior at the PAGE level (the layer
 * main.tsx registers actions against): toast copy (byte-exact English
 * strings), the success booleans the PlayArea uses to clear its inputs, the
 * deposit-then-act transfer/consume call shapes (memo, asset target, base-unit
 * scaling — including the legacy ".5"/"5." acceptance), the finalize parallel
 * arrays, and the stranded-credit message when a consuming call fails after a
 * confirmed deposit. Written BEFORE the framework rewrite so the rewrite is
 * pinned to identical user-visible behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OWNER_HASH = addressToScriptHash(OWNER);
const CONTRACT = "0xe2fba2a73cf92874ecc41b7fff8d3d5da0354c43";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;

/**
 * Key-echo translator with `{param}` interpolation. Under the shared test
 * alias the composables' app-specific keys resolve to the raw key, so every
 * toast assertion below pins the exact i18n KEY (+ params) the user-visible
 * copy is rendered from — the stable contract across the framework rewrite.
 */
function t(key: string, params?: Record<string, string | number>): string {
  let out = key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

// Captured invoke/read calls the composables make through the wallet SDK.
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

// Deposit-then-act waits for the deposit to confirm; report "confirmed" so the
// flows exercise the consuming call without a real indexer.
vi.mock("../utils/n3index", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    waitForTransactionStatus: vi.fn(async () => ({ status: "confirmed" })),
  };
});

import { useQuadraticFundingPage } from "../../quadratic-funding/src/composables/useQuadraticFundingPage";
import { createMiniAppFramework } from "../react";
import { ChainService } from "../services/ChainService";
import { CacheService } from "../services/CacheService";
import { EventBus } from "../services/EventBus";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  addressRef.value = OWNER;
  chainTypeRef.value = "neo-n3-mainnet";
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

function stackMap(fields: Record<string, { type: string; value: unknown }>) {
  return {
    stack: [
      { type: "Map", value: Object.entries(fields).map(([k, v]) => mapEntry(k, v)) },
    ],
  };
}

interface WireOptions {
  adminDisplayHash?: string;
  creatorDisplayHash?: string;
  roundOverrides?: Record<string, { type: string; value: unknown }>;
  projectIds?: string[];
  projectOverrides?: Record<string, { type: string; value: unknown }>;
}

/** Wire admin/getRounds/getRoundDetails + project reads for round id "1". */
function wireReads(options: WireOptions = {}) {
  const {
    adminDisplayHash = "0x1111111111111111111111111111111111111111",
    creatorDisplayHash = OWNER_HASH,
    roundOverrides = {},
    projectIds = [],
    projectOverrides = {},
  } = options;
  invokeRead.mockImplementation(async (params: { operation: string; args?: Array<{ value: unknown }> }) => {
    switch (params.operation) {
      case "admin":
        return { stack: [{ type: "ByteString", value: displayHashToChainBase64(adminDisplayHash) }] };
      case "getRounds":
        return { stack: [{ type: "Array", value: [{ type: "Integer", value: "1" }] }] };
      case "getRoundDetails":
        return stackMap({
          creator: { type: "ByteString", value: displayHashToChainBase64(creatorDisplayHash) },
          asset: { type: "ByteString", value: displayHashToChainBase64(GAS_HASH) },
          assetSymbol: { type: "ByteString", value: btoa("GAS") },
          matchingPool: { type: "Integer", value: "1000000000" },
          matchingAllocated: { type: "Integer", value: "0" },
          matchingWithdrawn: { type: "Integer", value: "0" },
          matchingRemaining: { type: "Integer", value: "1000000000" },
          totalContributed: { type: "Integer", value: "0" },
          projectCount: { type: "Integer", value: String(projectIds.length) },
          startTime: { type: "Integer", value: String(Date.now() - 3_600_000) },
          endTime: { type: "Integer", value: String(Date.now() + 3_600_000) },
          status: { type: "ByteString", value: btoa("active") },
          title: { type: "ByteString", value: btoa("Public Goods") },
          description: { type: "ByteString", value: btoa("infra") },
          ...roundOverrides,
        });
      case "getRoundProjects":
        return {
          stack: [
            {
              type: "Array",
              value: projectIds.map((id) => ({ type: "Integer", value: id })),
            },
          ],
        };
      case "getProjectDetails":
        return stackMap({
          roundId: { type: "Integer", value: "1" },
          owner: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
          name: { type: "ByteString", value: btoa("Proj") },
          description: { type: "ByteString", value: btoa("") },
          link: { type: "ByteString", value: btoa("") },
          totalContributed: { type: "Integer", value: "100000000" },
          contributorCount: { type: "Integer", value: "2" },
          matchedAmount: { type: "Integer", value: "0" },
          active: { type: "Boolean", value: true },
          claimed: { type: "Boolean", value: false },
          status: { type: "ByteString", value: btoa("active") },
          ...projectOverrides,
        });
      default:
        return { stack: [] };
    }
  });
}

type Toast = { msg: string; type: string } | null;

/**
 * Build the page and a user-visible toast accessor (source-agnostic).
 *
 * Post-rewrite the page's only service surface is ctx.framework, so the
 * harness wraps a REAL ChainService (running over the mocked wallet-sdk
 * lane above) in the MiniApp framework — the recorded invokeContract /
 * invokeRead calls keep the exact pre-rewrite wire shapes, and every
 * behavior assertion below is unchanged from the pre-rewrite snapshot.
 * The deposit-confirmation wait still flows through the app's real
 * default (waitForDepositConfirmation → the mocked n3index poll).
 */
function harness() {
  const chain = new ChainService(
    "miniapp-quadratic-funding",
    t,
    new CacheService("miniapp-quadratic-funding"),
    new EventBus(),
  );
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-quadratic-funding" },
  );
  const page = useQuadraticFundingPage({ app, t });
  const lastToast = (): Toast => {
    const status = page.roundsStatus.get() as { msg?: unknown; type?: unknown } | null;
    if (!status) return null;
    return { msg: String(status.msg ?? ""), type: String(status.type ?? "") };
  };
  return { page, lastToast };
}

/** Find the recorded wallet invoke for an operation. */
function callFor(operation: string) {
  return invokeContract.mock.calls.find(
    (call) => (call[0] as { operation: string }).operation === operation,
  ) as [{ operation: string; scriptHash: string; args: Array<{ type: string; value: unknown }> }] | undefined;
}

function futureLocalTime(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** args[0] is the caller account — base58 or its script hash both resolve to OWNER. */
function expectOwnerArg(arg: { type: string; value: unknown }) {
  expect(arg.type).toBe("Hash160");
  expect([OWNER, OWNER_HASH]).toContain(arg.value);
}

describe("quadratic-funding contribute flow", () => {
  it("deposits the exact amount with the :contribute memo then contributes, returns true", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    await page.handleSelectRound({ id: "1" } as never);
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1.5",
      memo: "for infra",
    });

    const transfer = callFor("transfer");
    expect(transfer).toBeDefined();
    expect(transfer![0].scriptHash).toBe(GAS_HASH);
    expect(transfer![0].args[1]).toEqual({ type: "Hash160", value: CONTRACT });
    expect(transfer![0].args[2]).toEqual({ type: "Integer", value: "150000000" });
    expect(transfer![0].args[3]).toEqual({
      type: "String",
      value: "miniapp-quadratic-funding:contribute",
    });

    const contribute = callFor("contribute");
    expect(contribute).toBeDefined();
    expect(contribute![0].scriptHash).toBe(CONTRACT);
    expectOwnerArg(contribute![0].args[0]);
    expect(contribute![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(contribute![0].args[2]).toEqual({ type: "Integer", value: "7" });
    expect(contribute![0].args[3]).toEqual({ type: "Integer", value: "150000000" });
    expect(contribute![0].args[4]).toEqual({ type: "String", value: "for infra" });

    expect(ok).toBe(true);
    expect(lastToast()).toEqual({ msg: "contributionSent", type: "success" });
  });

  it("accepts the legacy dot-leading ('.5') GAS amount as 0.5", async () => {
    wireReads({ projectIds: ["7"] });
    const { page } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: ".5",
      memo: "",
    });

    expect(ok).toBe(true);
    expect(callFor("transfer")![0].args[2]).toEqual({ type: "Integer", value: "50000000" });
    expect(callFor("contribute")![0].args[3]).toEqual({ type: "Integer", value: "50000000" });
  });

  it("rejects a non-numeric amount with the invalid-contribution copy, returns false", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "abc",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidContribution", type: "error" });
  });

  it("sends whole-unit amounts unscaled for NEO rounds", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: {
        asset: { type: "ByteString", value: displayHashToChainBase64(NEO_HASH) },
        assetSymbol: { type: "ByteString", value: btoa("NEO") },
        matchingPool: { type: "Integer", value: "10" },
        matchingRemaining: { type: "Integer", value: "10" },
      },
    });
    const { page } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "3",
      memo: "",
    });

    expect(ok).toBe(true);
    const transfer = callFor("transfer");
    expect(transfer![0].scriptHash).toBe(NEO_HASH);
    expect(transfer![0].args[2]).toEqual({ type: "Integer", value: "3" });
    expect(callFor("contribute")![0].args[3]).toEqual({ type: "Integer", value: "3" });
  });

  it("truncates GAS contribution decimals beyond 8 places (legacy slice, not reject)", async () => {
    wireReads({ projectIds: ["7"] });
    const { page } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1.123456789",
      memo: "",
    });

    expect(ok).toBe(true);
    expect(callFor("transfer")![0].args[2]).toEqual({ type: "Integer", value: "112345678" });
    expect(callFor("contribute")![0].args[3]).toEqual({ type: "Integer", value: "112345678" });
  });

  it("rejects a non-positive project id with the invalid-contribution copy, returns false", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "0",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidContribution", type: "error" });
  });

  it("rejects fractional NEO contributions with the indivisible copy", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: {
        asset: { type: "ByteString", value: displayHashToChainBase64(NEO_HASH) },
        assetSymbol: { type: "ByteString", value: btoa("NEO") },
        matchingPool: { type: "Integer", value: "10" },
        matchingRemaining: { type: "Integer", value: "10" },
      },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1.5",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({
      msg: "neoNoFractional",
      type: "error",
    });
  });

  it("surfaces the stranded-credit message when the consuming call fails after a confirmed deposit", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();
    invokeContract.mockImplementation(async (params: { operation: string }) => {
      if (params.operation === "contribute") throw new Error("boom");
      return { txid: `0x${params.operation}` };
    });

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(lastToast()).toEqual({
      msg:
        'Deposit confirmed but "contribute" failed — the prepaid credit remains on the contract and is withdrawable (deposit tx 0xtransfer): boom',
      type: "error",
    });
  });
});

describe("quadratic-funding round creation + matching", () => {
  it("returns true and toasts the round-created copy on success", async () => {
    const { page, lastToast } = harness();

    const ok = await page.handleCreateRound({
      title: "Public Goods",
      description: "infra",
      asset: "GAS",
      matchingPool: "2",
      startTime: futureLocalTime(30 * 60 * 1000),
      endTime: futureLocalTime(60 * 60 * 1000),
    });

    expect(ok).toBe(true);
    expect(callFor("transfer")![0].args[3]).toEqual({
      type: "String",
      value: "miniapp-quadratic-funding:create",
    });
    expect(callFor("createRound")).toBeDefined();
    expect(lastToast()).toEqual({ msg: "roundCreated", type: "success" });
  });

  it("rejects an empty title with the invalid-round copy, returns false, no invoke", async () => {
    const { page, lastToast } = harness();

    const ok = await page.handleCreateRound({
      title: "   ",
      description: "",
      asset: "GAS",
      matchingPool: "2",
      startTime: futureLocalTime(30 * 60 * 1000),
      endTime: futureLocalTime(60 * 60 * 1000),
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidRound", type: "error" });
  });

  it("rejects a past end time with the end-time copy", async () => {
    const { page, lastToast } = harness();

    const ok = await page.handleCreateRound({
      title: "Late",
      description: "",
      asset: "GAS",
      matchingPool: "2",
      startTime: "2000-01-01 00:00",
      endTime: "2000-01-02 00:00",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidEndTime", type: "error" });
  });

  it("accepts the legacy dot-leading ('.5') GAS matching top-up as 0.5", async () => {
    wireReads();
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    await page.handleAddMatching(".5");

    const transfer = callFor("transfer");
    expect(transfer![0].scriptHash).toBe(GAS_HASH);
    expect(transfer![0].args[2]).toEqual({ type: "Integer", value: "50000000" });
    expect(transfer![0].args[3]).toEqual({
      type: "String",
      value: "miniapp-quadratic-funding:matching",
    });
    const add = callFor("addMatchingPool");
    expect(add).toBeDefined();
    expectOwnerArg(add![0].args[0]);
    expect(add![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(add![0].args[2]).toEqual({ type: "Integer", value: "50000000" });
    expect(lastToast()).toEqual({ msg: "matchingAdded", type: "success" });
  });

  it("rejects a non-numeric matching amount with the matching-pool copy", async () => {
    wireReads();
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    await page.handleAddMatching("abc");

    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidMatchingPool", type: "error" });
  });

  it("creates NEO rounds with whole-unit (unscaled) matching pools", async () => {
    const { page, lastToast } = harness();

    const ok = await page.handleCreateRound({
      title: "NEO Round",
      description: "",
      asset: "NEO",
      matchingPool: "10",
      startTime: futureLocalTime(30 * 60 * 1000),
      endTime: futureLocalTime(60 * 60 * 1000),
    });

    expect(ok).toBe(true);
    const transfer = callFor("transfer");
    expect(transfer![0].scriptHash).toBe(NEO_HASH);
    expect(transfer![0].args[2]).toEqual({ type: "Integer", value: "10" });
    expect(callFor("createRound")![0].args[2]).toEqual({ type: "Integer", value: "10" });
    expect(lastToast()).toEqual({ msg: "roundCreated", type: "success" });
  });

  it("silently ignores addMatching when no round is selected (no banner, no invoke)", async () => {
    const { page, lastToast } = harness();

    await page.handleAddMatching("2");

    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toBeNull();
  });
});

describe("quadratic-funding projects", () => {
  it("registers a project with trimmed fields and returns true", async () => {
    wireReads();
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleRegisterProject({
      name: "  Open Source Explorer  ",
      description: " Tools for Neo devs ",
      link: " https://example.org ",
    });

    expect(ok).toBe(true);
    const call = callFor("registerProject");
    expect(call).toBeDefined();
    expect(call![0].scriptHash).toBe(CONTRACT);
    expectOwnerArg(call![0].args[0]);
    expect(call![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(call![0].args[2]).toEqual({ type: "String", value: "Open Source Explorer" });
    expect(call![0].args[3]).toEqual({ type: "String", value: "Tools for Neo devs" });
    expect(call![0].args[4]).toEqual({ type: "String", value: "https://example.org" });
    expect(lastToast()).toEqual({ msg: "projectRegistered", type: "success" });
  });

  it("rejects registration without a selected round", async () => {
    const { page, lastToast } = harness();

    const ok = await page.handleRegisterProject({
      name: "Proj",
      description: "",
      link: "",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "noSelectedRound", type: "error" });
  });

  it("claims a project and toasts the claimed copy", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: { status: { type: "ByteString", value: btoa("finalized") } },
      projectOverrides: { matchedAmount: { type: "Integer", value: "500000000" } },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    await page.handleSelectRound({ id: "1" } as never);
    invokeContract.mockClear();

    const project = (page.projects.get() as Array<{ id: string }>)[0];
    expect(project).toBeDefined();
    await page.handleClaimProject(project as never);

    const call = callFor("claimProject");
    expect(call).toBeDefined();
    expectOwnerArg(call![0].args[0]);
    expect(call![0].args[1]).toEqual({ type: "Integer", value: "7" });
    expect(lastToast()).toEqual({ msg: "projectClaimed", type: "success" });
  });
});

describe("quadratic-funding finalize + creator ops", () => {
  it("finalizes with suggested matches as parallel Integer arrays", async () => {
    wireReads({ adminDisplayHash: OWNER_HASH, projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    await page.handleSelectRound({ id: "1" } as never);
    invokeContract.mockClear();

    await page.handleFinalizeSuggested();

    const call = callFor("finalizeRound");
    expect(call).toBeDefined();
    expectOwnerArg(call![0].args[0]);
    expect(call![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(call![0].args[2]).toEqual({
      type: "Array",
      value: [{ type: "Integer", value: "7" }],
    });
    // Single project with donors ⇒ the full 10-GAS pool is suggested for it.
    expect(call![0].args[3]).toEqual({
      type: "Array",
      value: [{ type: "Integer", value: "1000000000" }],
    });
    expect(lastToast()).toEqual({ msg: "roundFinalized", type: "success" });
  });

  it("finalizes hand-typed JSON with GAS scaling and rejects desynced arrays", async () => {
    wireReads({ adminDisplayHash: OWNER_HASH });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    await page.handleFinalize("[7]", '["2"]');
    const call = callFor("finalizeRound");
    expect(call).toBeDefined();
    expect(call![0].args[2]).toEqual({
      type: "Array",
      value: [{ type: "Integer", value: "7" }],
    });
    expect(call![0].args[3]).toEqual({
      type: "Array",
      value: [{ type: "Integer", value: "200000000" }],
    });
    expect(lastToast()).toEqual({ msg: "roundFinalized", type: "success" });

    invokeContract.mockClear();
    await page.handleFinalize("[7, 8]", "[2]");
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidRound", type: "error" });
  });

  it("claims unused matching for the creator of a finalized round", async () => {
    wireReads({
      roundOverrides: {
        status: { type: "ByteString", value: btoa("finalized") },
        matchingAllocated: { type: "Integer", value: "300000000" },
        matchingRemaining: { type: "Integer", value: "700000000" },
        totalContributed: { type: "Integer", value: "10000000" },
      },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    await page.handleClaimUnused();

    const call = callFor("claimUnusedMatching");
    expect(call).toBeDefined();
    expectOwnerArg(call![0].args[0]);
    expect(call![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(lastToast()).toEqual({ msg: "unusedClaimed", type: "success" });
  });

  it("cancels a pre-start round and toasts the refund copy", async () => {
    const futureStart = String(Date.now() + 24 * 3600 * 1000);
    const futureEnd = String(Date.now() + 48 * 3600 * 1000);
    wireReads({
      roundOverrides: {
        startTime: { type: "Integer", value: futureStart },
        endTime: { type: "Integer", value: futureEnd },
        status: { type: "ByteString", value: btoa("upcoming") },
      },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    await page.handleCancelRound();

    const call = callFor("cancelRound");
    expect(call).toBeDefined();
    expectOwnerArg(call![0].args[0]);
    expect(call![0].args[1]).toEqual({ type: "Integer", value: "1" });
    expect(lastToast()).toEqual({
      msg: "roundCancelled",
      type: "success",
    });
  });
});

describe("quadratic-funding read failures", () => {
  it("surfaces a rounds-refresh failure through the app's error copy", async () => {
    invokeRead.mockImplementation(async (params: { operation: string }) => {
      if (params.operation === "getRounds") throw new Error("rpc down");
      return { stack: [] };
    });
    const { page, lastToast } = harness();

    await page.refreshRounds();

    expect(lastToast()).toEqual({ msg: "rpc down", type: "error" });
  });
});
