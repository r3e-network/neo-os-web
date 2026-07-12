import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationService } from "../services/NotificationService";
import type { EventBus } from "../services/EventBus";
import { createMiniAppFramework } from "../../../framework";
import { addressToScriptHash } from "../utils/neo";
// Warm the multisig module graph (main → PlayArea → semi-ui, all inlined) at
// collection time. The per-test re-import after vi.resetModules() then only
// re-executes cached transforms, so the first beforeEach never pays the ~3s
// cold-transform cost inside vitest's 10s hook timeout under full-suite load.
import "../../neo-multisig/src/main";

/**
 * Neo Multisig setup wiring (framework-extraction Wave 5) — pins the three
 * user-visible behaviors the migration must keep byte-identical:
 *
 *   1. Toast keys + params ride app.notify: success copy is keyed on
 *      POST-WRITE reads (the new vaultId/reqId, the resolved request status,
 *      the RequestUnfunded amounts), validation/error copy keeps the app's
 *      formatErrorMessage sanitization.
 *   2. The activity log lives in app.storage.local under the LEGACY
 *      localStorage key "multisig_vault_history" (storagePrefix "multisig_"),
 *      so pre-migration users keep their vault/request history.
 *   3. Failing handlers toast and resolve null — never an unhandled rejection.
 */

const SIGNER_A = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const SIGNER_B = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";
const VAULT_CONTRACT = "0xa361cdc792e97c4d8ddf42048cf48f3283ea7178";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const LEGACY_STORAGE_KEY = "multisig_vault_history";
const TXID = `0x${"ab".repeat(32)}`;

const harness = vi.hoisted(() => {
  const state = {
    definition: null as null | {
      storagePrefix?: string;
      setup?: (ctx: Record<string, unknown>) => unknown;
    },
  };
  return { state };
});

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("../react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.state.definition = definition as typeof harness.state.definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

type ActionHandler = (...args: unknown[]) => Promise<unknown>;

const VAULT_READ = {
  id: 7,
  creator: addressToScriptHash(SIGNER_A),
  threshold: 2,
  signers: [addressToScriptHash(SIGNER_A), addressToScriptHash(SIGNER_B)],
  createdTime: 1700000000000,
  neoBalance: 0,
  gasBalance: 100000000,
};

function requestRead(status: number, approvalCount = 1) {
  return {
    id: 4,
    vaultId: 7,
    creator: addressToScriptHash(SIGNER_A),
    recipient: addressToScriptHash(SIGNER_B),
    asset: GAS_HASH,
    amount: 50000000,
    approvalCount,
    status,
    createdTime: 1700000000000,
    memo: "rent",
  };
}

/**
 * Translator that makes params visible in the emitted toast text, so the
 * assertions pin BOTH the key and the exact params (the real host t()
 * interpolates the same params into localized copy).
 */
function t(key: string, params?: Record<string, string | number>): string {
  if (!params || Object.keys(params).length === 0) return key;
  const rendered = Object.entries(params)
    .map(([name, value]) => `${name}=${value}`)
    .join(",");
  return `${key}|${rendered}`;
}

function buildCtx(options: {
  reads?: Record<string, unknown>;
  readSequences?: Record<string, unknown[]>;
  listEvents?: (name: string, opts?: unknown) => Promise<unknown[]>;
} = {}) {
  const registeredActions = new Map<string, ActionHandler>();
  const emitted: Array<{ message: string; type: string }> = [];
  const bus = {
    emit: (_event: string, payload: unknown) => {
      emitted.push(payload as { message: string; type: string });
    },
  } as unknown as EventBus;
  // The REAL notify semantics (string error lane, params-capable success lane).
  const notify = new NotificationService(bus, t);

  const readIndexes = new Map<string, number>();
  const read = vi.fn(async (operation: string) => {
    const sequence = options.readSequences?.[operation];
    if (sequence?.length) {
      const index = readIndexes.get(operation) ?? 0;
      readIndexes.set(operation, index + 1);
      return sequence[Math.min(index, sequence.length - 1)];
    }
    return options.reads?.[operation] ?? null;
  });
  const invoke = vi.fn(async (operation: string, _args: unknown[], writeOptions?: { onTransactionSent?: (txid: string) => void }) => {
    writeOptions?.onTransactionSent?.(TXID);
    const event = operation === "createVault"
      ? { state: [{ value: 7 }, { value: addressToScriptHash(SIGNER_A) }, { value: 2 }, { value: 2 }] }
      : operation === "transfer"
        ? { state: [{ value: 7 }, { value: addressToScriptHash(SIGNER_A) }, { value: GAS_HASH }, { value: 150000000 }] }
        : operation === "createRequest"
          ? { state: [{ value: 4 }, { value: 7 }, { value: addressToScriptHash(SIGNER_A) }, { value: addressToScriptHash(SIGNER_B) }, { value: 50000000 }] }
          : operation === "approve"
            ? { state: [{ value: 4 }, { value: addressToScriptHash(SIGNER_A) }, { value: 2 }] }
            : { state: [{ value: 4 }] };
    return { txid: TXID, verified: true, event };
  });
  const chain: Record<string, unknown> = {
    address: {
      get: () => "",
      set: () => {},
      subscribe: () => () => undefined,
    },
    contractAddress: { get: () => VAULT_CONTRACT },
    detectNetwork: vi.fn(async () => "mainnet"),
    ensureWallet: vi.fn(async () => SIGNER_A),
    invoke,
    read,
  };
  if (options.listEvents) chain.listEvents = vi.fn(options.listEvents);

  const ctx = {
    services: { chain, notify },
    t,
    registerAction: (key: string, handler: ActionHandler) => {
      registeredActions.set(key, handler);
    },
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, {
      appId: "miniapp-neo-multisig",
      // The definition's prefix — asserted separately — is what keeps the
      // legacy "multisig_vault_history" localStorage key resolving.
      storagePrefix: harness.state.definition?.storagePrefix,
    }),
  });
  return { ctx, emitted, registeredActions, invoke, read };
}

async function runSetup(options: Parameters<typeof buildCtx>[0] = {}) {
  const built = buildCtx(options);
  const result = (await harness.state.definition?.setup?.(
    built.ctx as never,
  )) as {
    state: Record<string, { get(): unknown }>;
  };
  return { ...built, result };
}

describe("Neo Multisig setup (app.notify + app.storage.local wiring)", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.state.definition = null;
    localStorage.clear();
    await import("../../neo-multisig/src/main");
  });

  it("registers every vault action", async () => {
    const { registeredActions } = await runSetup();
    expect([...registeredActions.keys()].sort()).toEqual([
      "approveRequest",
      "cancelRequest",
      "createVault",
      "deposit",
      "loadRequest",
      "loadVault",
      "proposeRequest",
      "recoverPending",
    ]);
  });

  it("pins the legacy storage namespace and keeps pre-migration history readable", async () => {
    // The pre-framework activity log lived at this EXACT localStorage key.
    expect(harness.state.definition?.storagePrefix).toBe("multisig_");

    const legacy = [
      { kind: "vault", id: 3, label: "Vault #3", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

    const { result } = await runSetup();
    expect(result.state.history.get()).toEqual(legacy);
  });

  it("createVault toasts the POST-WRITE vault id and appends history under the legacy key", async () => {
    const { registeredActions, emitted, invoke } = await runSetup({
      reads: { getVault: VAULT_READ },
    });

    const outcome = await registeredActions.get("createVault")!({
      signers: [SIGNER_A, SIGNER_B],
      threshold: 2,
    });

    expect(outcome).toMatchObject({ id: 7 });
    expect(emitted).toContainEqual({
      message: "toastVaultCreated|id=7",
      type: "success",
    });
    // The signer list stays a nested Array arg end-to-end (the arg.array lane
    // FrameworkContractArg now types — no widened cast at the call boundary).
    expect(invoke).toHaveBeenCalledWith(
      "createVault",
      [
        { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
        {
          type: "Array",
          value: [
            { type: "Hash160", value: addressToScriptHash(SIGNER_B) },
            { type: "Hash160", value: addressToScriptHash(SIGNER_A) },
          ],
        },
        { type: "Integer", value: "2" },
      ],
      expect.objectContaining({
        scriptHash: VAULT_CONTRACT,
        waitForEvent: "VaultCreated",
        waitTimeoutMs: 30000,
      }),
    );

    const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]") as Array<{
      kind: string;
      id: number;
    }>;
    expect(saved).toContainEqual(expect.objectContaining({ kind: "vault", id: 7 }));
  });

  it("createVault surfaces the validation copy and never hits chain on a bad signer set", async () => {
    const { registeredActions, emitted, invoke } = await runSetup();

    const outcome = await registeredActions.get("createVault")!({
      signers: [SIGNER_A],
      threshold: 1,
    });

    expect(outcome).toBeNull();
    // formatErrorMessage passes the clean validation message through verbatim.
    expect(emitted).toEqual([
      {
        message: "Provide between 2 and 16 signer addresses.",
        type: "error",
      },
    ]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("deposit toasts amount+asset on success and localized copy on invalid input", async () => {
    const { registeredActions, emitted, invoke } = await runSetup({
      readSequences: {
        getVault: [VAULT_READ, { ...VAULT_READ, gasBalance: 250000000 }, { ...VAULT_READ, gasBalance: 250000000 }],
      },
    });
    const deposit = registeredActions.get("deposit")!;

    await deposit({ vaultId: 7, asset: "GAS", amount: "1.5" });
    expect(emitted).toContainEqual({
      message: "toastDeposited|amount=1.5,asset=GAS",
      type: "success",
    });

    await deposit({ vaultId: 0, asset: "GAS", amount: "1" });
    expect(emitted).toContainEqual({ message: "toastNoVault", type: "error" });

    await deposit({ vaultId: 7, asset: "NEO", amount: "1.5" });
    expect(emitted).toContainEqual({ message: "toastInvalidAmount", type: "error" });

    // Only the valid deposit reached the chain.
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("proposeRequest toasts the POST-WRITE request id", async () => {
    const { registeredActions, emitted } = await runSetup({
      reads: {
        getRequest: requestRead(0),
        getVault: VAULT_READ,
      },
    });

    await registeredActions.get("proposeRequest")!({
      vaultId: 7,
      recipient: SIGNER_B,
      asset: "GAS",
      amount: "0.5",
      memo: "rent",
    });

    expect(emitted).toContainEqual({
      message: "toastRequestCreated|id=4",
      type: "success",
    });
  });

  it("approveRequest keys the toast on the post-write status: executed", async () => {
    const { registeredActions, emitted } = await runSetup({
      reads: { getVault: VAULT_READ },
      readSequences: { getRequest: [requestRead(0), requestRead(1, 2), requestRead(1, 2)], hasApproved: [false, true, true, false] },
    });

    await registeredActions.get("approveRequest")!(4);
    expect(emitted).toContainEqual({
      message: "toastRequestExecuted",
      type: "success",
    });
  });

  it("approveRequest keys the toast on the post-write status: still pending", async () => {
    const { registeredActions, emitted } = await runSetup({
      reads: { getVault: VAULT_READ },
      readSequences: { getRequest: [requestRead(0), requestRead(0, 2), requestRead(0, 2)], hasApproved: [false, true, true, false] },
    });

    await registeredActions.get("approveRequest")!(4);
    expect(emitted).toContainEqual({ message: "toastApproved", type: "success" });
  });

  it("approveRequest explains an auto-cancel with the RequestUnfunded amounts", async () => {
    const { registeredActions, emitted } = await runSetup({
      reads: { getVault: VAULT_READ },
      readSequences: { getRequest: [requestRead(0), requestRead(2, 2), requestRead(2, 2)], hasApproved: [false, true] },
      listEvents: async () => [
        {
          event_name: "RequestUnfunded",
          state: [
            { type: "Integer", value: "4" },
            { type: "Integer", value: "50000000" },
            { type: "Integer", value: "10000000" },
          ],
        },
      ],
    });

    await registeredActions.get("approveRequest")!(4);
    // Amounts are pre-formatted display strings (BASE UNITS ÷ 1e8 for GAS).
    expect(emitted).toContainEqual({
      message: "toastRequestUnfunded|required=0.5,available=0.1,asset=GAS",
      type: "error",
    });
  });

  it("approveRequest falls back to the short auto-cancel copy without the event", async () => {
    const { registeredActions, emitted } = await runSetup({
      reads: { getVault: VAULT_READ },
      readSequences: { getRequest: [requestRead(0), requestRead(2, 2), requestRead(2, 2)], hasApproved: [false, true] },
    });

    await registeredActions.get("approveRequest")!(4);
    expect(emitted).toContainEqual({
      message: "toastRequestUnfundedShort",
      type: "error",
    });
  });

  it("loadVault toasts found/not-found with the id param", async () => {
    const found = await runSetup({ reads: { getVault: VAULT_READ } });
    await found.registeredActions.get("loadVault")!(7);
    expect(found.emitted).toContainEqual({
      message: "toastVaultLoaded|id=7",
      type: "success",
    });

    const missing = await runSetup();
    await missing.registeredActions.get("loadVault")!(9);
    expect(missing.emitted).toContainEqual({
      message: "toastVaultNotFound|id=9",
      type: "error",
    });
  });

  it("a failing write toasts the sanitized error and resolves null", async () => {
    const { registeredActions, emitted, invoke } = await runSetup({
      reads: { getVault: VAULT_READ },
    });
    invoke.mockRejectedValueOnce(new Error("Vault is closed."));

    // Without the app-side catch this await would REJECT and fail the test.
    const outcome = await registeredActions.get("deposit")!({
      vaultId: 7,
      asset: "GAS",
      amount: "1",
    });

    expect(outcome).toBeNull();
    // Short clean messages pass formatErrorMessage verbatim.
    expect(emitted).toContainEqual({ message: "Vault is closed.", type: "error" });
  });
});
