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
const ROUND_CREATOR_HASH = "0x2222222222222222222222222222222222222222";
const PROJECT_OWNER_HASH = "0x3333333333333333333333333333333333333333";
const PAUSE_REGISTRY_HASH = "0x4444444444444444444444444444444444444444";
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

function eventFor(eventName: string, txHash: string) {
  const operation = txHash.replace(/^0x/, "");
  const call = invokeContract.mock.calls.find(
    (entry) => (entry[0] as { operation?: string }).operation === operation,
  )?.[0] as { args?: Array<{ value?: unknown }> } | undefined;
  const args = call?.args ?? [];
  let state: Array<{ value: unknown }> = [];
  switch (eventName) {
    case "ContributionMade":
      state = [args[1], args[2], args[0], args[3], args[4]] as Array<{ value: unknown }>;
      break;
    case "RoundCreated":
      state = [{ value: "2" }, args[0], args[1], args[2]] as Array<{ value: unknown }>;
      break;
    case "MatchingPoolAdded":
      state = [args[1], args[0], args[2], { value: String(1_000_000_000n + BigInt(String(args[2]?.value ?? "0"))) }] as Array<{ value: unknown }>;
      break;
    case "ProjectRegistered":
      state = [{ value: "7" }, args[1], args[0], args[2]] as Array<{ value: unknown }>;
      break;
    case "ProjectClaimed":
      state = [args[1], args[0], { value: "600000000" }] as Array<{ value: unknown }>;
      break;
    case "RoundFinalized": {
      const amounts = (args[3]?.value as Array<{ value?: unknown }> | undefined) ?? [];
      state = [args[1], { value: amounts.reduce((sum, item) => sum + BigInt(String(item.value ?? "0")), 0n).toString() }] as Array<{ value: unknown }>;
      break;
    }
    case "MatchingWithdrawn":
      state = [args[1], args[0], { value: "700000000" }] as Array<{ value: unknown }>;
      break;
    case "RoundCancelled":
      state = [args[1], args[0]] as Array<{ value: unknown }>;
      break;
  }
  return { id: 1, event_name: eventName, tx_hash: txHash, state };
}

vi.mock("@shared/utils/wallet-sdk", () => ({
  useWallet: () => ({
    address: addressRef,
    chainType: chainTypeRef,
    connect: vi.fn(async () => OWNER),
    invokeContract,
    invokeRead,
    getContractAddress: vi.fn(async () => CONTRACT),
  }),
  useEvents: () => ({
    list: vi.fn(async (params: { event_name?: string; tx_hash?: string }) => ({
      events: params.event_name && params.tx_hash
        ? [eventFor(params.event_name, params.tx_hash)]
        : [],
    })),
    waitForEvent: vi.fn(async (txHash: string, eventName: string) =>
      eventFor(eventName, txHash)),
  }),
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
  recoveryCapable?: boolean;
  globalPaused?: boolean;
}

/** Wire admin/getRounds/getRoundDetails + project reads for round id "1". */
function wireReads(options: WireOptions = {}) {
  const {
    adminDisplayHash = "0x1111111111111111111111111111111111111111",
    creatorDisplayHash = ROUND_CREATOR_HASH,
    roundOverrides = {},
    projectIds = [],
    projectOverrides = {},
    recoveryCapable = true,
    globalPaused = false,
  } = options;
  invokeRead.mockImplementation(async (params: { operation: string; scriptHash?: string; args?: Array<{ value: unknown }> }) => {
    switch (params.operation) {
      case "admin":
        return { stack: [{ type: "ByteString", value: displayHashToChainBase64(adminDisplayHash) }] };
      case "getPlatformStats":
        return stackMap({
          totalRounds: { type: "Integer", value: "1" },
          totalProjects: { type: "Integer", value: String(projectIds.length) },
        });
      case "isPaused":
        return { stack: [{ type: "Boolean", value: params.scriptHash === PAUSE_REGISTRY_HASH ? globalPaused : false }] };
      case "pauseRegistry":
        return { stack: [{ type: "ByteString", value: displayHashToChainBase64(PAUSE_REGISTRY_HASH) }] };
      case "totalRounds":
        return { stack: [{ type: "Integer", value: "1" }] };
      case "directAssetCreditOf":
        if (!recoveryCapable) throw new Error("method not found: directAssetCreditOf/2");
        return { stack: [{ type: "Integer", value: "0" }] };
      case "deploymentFingerprint":
        return { stack: [{ type: "ByteString", value: btoa("qf-test-v1") }] };
      case "getRounds":
        return { stack: [{ type: "Array", value: [{ type: "Integer", value: "1" }] }] };
      case "getRoundDetails":
        if (callFor("createRound")) {
          const create = callFor("createRound")![0].args;
          return stackMap({
            creator: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
            asset: { type: "ByteString", value: displayHashToChainBase64(String(create[1]?.value ?? GAS_HASH)) },
            assetSymbol: { type: "ByteString", value: btoa(String(create[1]?.value) === NEO_HASH ? "NEO" : "GAS") },
            matchingPool: { type: "Integer", value: String(create[2]?.value ?? "0") },
            matchingAllocated: { type: "Integer", value: "0" },
            matchingWithdrawn: { type: "Integer", value: "0" },
            matchingRemaining: { type: "Integer", value: String(create[2]?.value ?? "0") },
            totalContributed: { type: "Integer", value: "0" },
            projectCount: { type: "Integer", value: "0" },
            startTime: { type: "Integer", value: String(create[3]?.value ?? "0") },
            endTime: { type: "Integer", value: String(create[4]?.value ?? "0") },
            status: { type: "ByteString", value: btoa("upcoming") },
            title: { type: "ByteString", value: btoa(String(create[5]?.value ?? "")) },
            description: { type: "ByteString", value: btoa(String(create[6]?.value ?? "")) },
          });
        }
        if (callFor("addMatchingPool")) {
          const amount = BigInt(String(callFor("addMatchingPool")![0].args[2]?.value ?? "0"));
          roundOverrides.matchingPool = { type: "Integer", value: String(1_000_000_000n + amount) };
          roundOverrides.matchingRemaining = { type: "Integer", value: String(1_000_000_000n + amount) };
        }
        if (callFor("finalizeRound")) {
          const values = callFor("finalizeRound")![0].args[3]?.value as Array<{ value?: unknown }>;
          const allocated = values.reduce((sum, item) => sum + BigInt(String(item.value ?? "0")), 0n);
          roundOverrides.status = { type: "ByteString", value: btoa("finalized") };
          roundOverrides.matchingAllocated = { type: "Integer", value: allocated.toString() };
          roundOverrides.matchingRemaining = { type: "Integer", value: (1_000_000_000n - allocated).toString() };
        }
        if (callFor("claimUnusedMatching")) {
          roundOverrides.matchingRemaining = { type: "Integer", value: "0" };
        }
        if (callFor("cancelRound")) {
          roundOverrides.status = { type: "ByteString", value: btoa("cancelled") };
        }
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
        if (callFor("registerProject")) {
          const register = callFor("registerProject")![0].args;
          return stackMap({
            roundId: { type: "Integer", value: String(register[1]?.value ?? "1") },
            owner: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
            name: { type: "ByteString", value: btoa(String(register[2]?.value ?? "")) },
            description: { type: "ByteString", value: btoa(String(register[3]?.value ?? "")) },
            link: { type: "ByteString", value: btoa(String(register[4]?.value ?? "")) },
            totalContributed: { type: "Integer", value: "0" },
            contributorCount: { type: "Integer", value: "0" },
            matchedAmount: { type: "Integer", value: "0" },
            active: { type: "Boolean", value: true },
            claimed: { type: "Boolean", value: false },
            status: { type: "ByteString", value: btoa("active") },
          });
        }
        {
          const requestedProjectId = String(params.args?.[0]?.value ?? "");
          const finalize = callFor("finalizeRound")?.[0].args;
          const finalizedProjectIds = (finalize?.[2]?.value as Array<{ value?: unknown }> | undefined) ?? [];
          const finalizedAmounts = (finalize?.[3]?.value as Array<{ value?: unknown }> | undefined) ?? [];
          const finalizedIndex = finalizedProjectIds.findIndex(
            (item) => String(item.value ?? "") === requestedProjectId,
          );
          const finalizedMatch = finalizedIndex >= 0
            ? String(finalizedAmounts[finalizedIndex]?.value ?? "0")
            : "0";
          return stackMap({
          roundId: { type: "Integer", value: "1" },
          owner: { type: "ByteString", value: displayHashToChainBase64(PROJECT_OWNER_HASH) },
          name: { type: "ByteString", value: btoa("Proj") },
          description: { type: "ByteString", value: btoa("") },
          link: { type: "ByteString", value: btoa("") },
          totalContributed: { type: "Integer", value: "100000000" },
          contributorCount: { type: "Integer", value: "2" },
          matchedAmount: { type: "Integer", value: finalizedMatch },
          active: { type: "Boolean", value: true },
          claimed: { type: "Boolean", value: Boolean(callFor("claimProject")) },
          status: { type: "ByteString", value: btoa("active") },
          ...projectOverrides,
          });
        }
      case "getContribution": {
        const contribution = callFor("contribute");
        return {
          stack: [{
            type: "Integer",
            value: String(contribution?.[0].args[3]?.value ?? "0"),
          }],
        };
      }
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
function harness({ approved = true }: { approved?: boolean } = {}) {
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
  const page = useQuadraticFundingPage({
    app,
    t,
    approvedRecoveryDeployments: approved
      ? new Set([`neo-n3-mainnet:${CONTRACT}:qf-test-v1`])
      : undefined,
  });
  const lastToast = (): Toast => {
    const status = page.roundsStatus.get() as { msg?: unknown; type?: unknown } | null;
    if (!status) return null;
    return { msg: String(status.msg ?? ""), type: String(status.type ?? "") };
  };
  return { app, page, lastToast };
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

  it("rejects partially numeric project IDs instead of silently truncating them", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7abc",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidContribution", type: "error" });
  });

  it("blocks inactive projects before any prepaid transfer", async () => {
    wireReads({
      projectIds: ["7"],
      projectOverrides: {
        active: { type: "Boolean", value: false },
        status: { type: "ByteString", value: btoa("inactive") },
      },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(callFor("transfer")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "projectStateChanged", type: "error" });
  });

  it("blocks project-owner self-contributions before any prepaid transfer", async () => {
    wireReads({
      projectIds: ["7"],
      projectOverrides: {
        owner: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
      },
    });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(callFor("transfer")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "selfContributionBlocked", type: "error" });
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

  it("rejects GAS precision beyond 8 decimals instead of changing the signed amount", async () => {
    wireReads({ projectIds: ["7"] });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1.123456789",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(callFor("transfer")).toBeUndefined();
    expect(callFor("contribute")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "invalidContribution", type: "error" });
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
    wireReads();
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
    wireReads();
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

  it("rejects non-web project links before opening a wallet request", async () => {
    wireReads();
    const { page, lastToast } = harness();
    await page.refreshRounds();
    invokeContract.mockClear();

    const ok = await page.handleRegisterProject({
      name: "Unsafe link",
      description: "",
      link: "javascript:alert(1)",
    });

    expect(ok).toBe(false);
    expect(callFor("registerProject")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "invalidProjectLink", type: "error" });
  });

  it("claims a project and toasts the claimed copy", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: { status: { type: "ByteString", value: btoa("finalized") } },
      projectOverrides: {
        owner: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
        matchedAmount: { type: "Integer", value: "500000000" },
      },
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
    wireReads({
      adminDisplayHash: OWNER_HASH,
      projectIds: ["7"],
      roundOverrides: {
        status: { type: "ByteString", value: btoa("ended") },
        endTime: { type: "Integer", value: String(Date.now() - 1_000) },
      },
    });
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
    wireReads({
      adminDisplayHash: OWNER_HASH,
      projectIds: ["7"],
      roundOverrides: {
        status: { type: "ByteString", value: btoa("ended") },
        endTime: { type: "Integer", value: String(Date.now() - 1_000) },
      },
    });
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

    await page.handleFinalize('["7abc"]', '["2"]');
    expect(invokeContract).not.toHaveBeenCalled();
    expect(lastToast()).toEqual({ msg: "invalidRound", type: "error" });
  });

  it("claims unused matching for the creator of a finalized round", async () => {
    wireReads({
      creatorDisplayHash: OWNER_HASH,
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
      creatorDisplayHash: OWNER_HASH,
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
      if (params.operation === "totalRounds") {
        return { stack: [{ type: "Integer", value: "1" }] };
      }
      if (params.operation === "getRounds") throw new Error("rpc down");
      return { stack: [] };
    });
    const { page, lastToast } = harness();

    await page.refreshRounds();

    expect(lastToast()).toEqual({ msg: "rpc down", type: "error" });
  });
});

describe("quadratic-funding production safety", () => {
  it("keeps a legacy deployment browseable but blocks every prepaid funding transfer", async () => {
    wireReads({ projectIds: ["7"], recoveryCapable: false });
    const { page, lastToast } = harness();

    await page.refreshRounds();
    expect(page.rounds.get()).toHaveLength(1);
    expect(page.deploymentStatus.get()).toBe("legacy");
    expect(page.fundingWritesEnabled.get()).toBe(false);
    invokeContract.mockClear();

    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(callFor("transfer")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "fundingSafetyLegacy", type: "error" });
  });

  it("blocks deposits when the external pause registry pauses this app", async () => {
    wireReads({ projectIds: ["7"], recoveryCapable: true, globalPaused: true });
    const { page, lastToast } = harness();

    await page.refreshRounds();
    expect(page.deploymentStatus.get()).toBe("paused");
    invokeContract.mockClear();
    const ok = await page.handleContribute({
      roundId: "1",
      projectId: "7",
      amount: "1",
      memo: "",
    });

    expect(ok).toBe(false);
    expect(callFor("transfer")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "fundingSafetyPaused", type: "error" });
  });

  it("does not enable writes from a capability probe without explicit deployment approval", async () => {
    wireReads({ projectIds: ["7"], recoveryCapable: true });
    const { page, lastToast } = harness({ approved: false });

    await page.refreshRounds();
    expect(page.rounds.get()).toHaveLength(1);
    expect(page.deploymentStatus.get()).toBe("unverified");
    expect(page.fundingWritesEnabled.get()).toBe(false);
    invokeContract.mockClear();

    const ok = await page.handleRegisterProject({
      name: "New project",
      description: "",
      link: "",
    });

    expect(ok).toBe(false);
    expect(callFor("registerProject")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "fundingSafetyUnverified", type: "error" });
  });

  it("rechecks the exact approved deployment after a wallet network switch", async () => {
    wireReads({ projectIds: ["7"], recoveryCapable: true });
    const { page, lastToast } = harness();
    await page.refreshRounds();
    expect(page.deploymentStatus.get()).toBe("ready");

    chainTypeRef.value = "neo-n3-testnet";
    invokeContract.mockClear();
    const ok = await page.handleRegisterProject({
      name: "Network switched",
      description: "",
      link: "",
    });

    expect(ok).toBe(false);
    expect(callFor("registerProject")).toBeUndefined();
    expect(page.deploymentStatus.get()).toBe("unverified");
    expect(lastToast()).toEqual({ msg: "fundingSafetyUnverified", type: "error" });
  });

  it("rechecks approval after wallet connection before invoking a write", async () => {
    wireReads({ projectIds: ["7"], recoveryCapable: true });
    const { app, page, lastToast } = harness();
    await page.refreshRounds();
    expect(page.deploymentStatus.get()).toBe("ready");
    vi.spyOn(app.chain, "ensureWallet").mockImplementation(async () => {
      chainTypeRef.value = "neo-n3-testnet";
      return OWNER;
    });
    invokeContract.mockClear();

    const ok = await page.handleRegisterProject({
      name: "Prompt switched network",
      description: "",
      link: "",
    });

    expect(ok).toBe(false);
    expect(callFor("registerProject")).toBeUndefined();
    expect(lastToast()).toEqual({ msg: "fundingWriteScopeChanged", type: "error" });
  });

  it("allows an owner to claim contribution-only proceeds after finalization", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: { status: { type: "ByteString", value: btoa("finalized") } },
      projectOverrides: {
        owner: { type: "ByteString", value: displayHashToChainBase64(OWNER_HASH) },
        totalContributed: { type: "Integer", value: "100000000" },
        matchedAmount: { type: "Integer", value: "0" },
      },
    });
    const { page } = harness();
    await page.refreshRounds();
    await page.handleSelectRound({ id: "1" } as never);

    expect(page.claimableProjectIds.get()).toContain("7");
  });

  it("shows finalized project allocations instead of recomputing an estimate", async () => {
    wireReads({
      projectIds: ["7"],
      roundOverrides: {
        status: { type: "ByteString", value: btoa("finalized") },
        matchingAllocated: { type: "Integer", value: "300000000" },
        matchingRemaining: { type: "Integer", value: "700000000" },
      },
      projectOverrides: {
        matchedAmount: { type: "Integer", value: "300000000" },
      },
    });
    const { page } = harness();

    await page.refreshRounds();

    expect(page.matchPreviewMode.get()).toBe("finalized");
    expect(page.matchingPoolDisplay.get()).toBe("10 GAS");
    expect(page.matchingRemainingDisplay.get()).toBe("7 GAS");
    expect(page.suggestedMatches.get()).toEqual([
      expect.objectContaining({ id: "7", matchBaseUnits: "300000000", matchDisplay: "3 GAS" }),
    ]);
  });

  it("requires prepaid credit recovery before clearing a deposit journal", () => {
    wireReads();
    const { page, lastToast } = harness();
    page.pendingOperation.set({ phase: "deposit", txid: `0x${"d".repeat(64)}` } as never);

    page.handleClearPending();

    expect(page.pendingOperation.get()).toEqual(expect.objectContaining({ phase: "deposit" }));
    expect(lastToast()).toEqual({ msg: "pendingDepositMustRecover", type: "error" });
    page.pendingOperation.set(null);
  });
});
