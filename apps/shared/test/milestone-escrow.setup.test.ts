import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationService } from "../services/NotificationService";
import type { EventBus } from "../services/EventBus";
import { createMiniAppFramework } from "../../../framework";

/**
 * Milestone Escrow setup wiring — every registered action must run through
 * app.notify.guard (delegating to the injected notify service) so a failing
 * handler surfaces an error toast instead of an unhandled rejection. This
 * matters most for the deposit-then-create flow, where
 * "depositPrepaidNoEscrow" fires AFTER the user's funds already moved:
 * before the guard wrapping, that error was silently swallowed as an
 * unhandled promise rejection with zero feedback.
 */
const harness = vi.hoisted(() => {
  function observable<T>(initial: T) {
    let value = initial;
    return {
      get: () => value,
      set: (next: T) => {
        value = next;
      },
      subscribe: () => () => undefined,
    };
  }

  const state = {
    definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
    escrow: null as null | Record<string, unknown>,
  };

  const reset = () => {
    state.definition = null;
    state.escrow = {
      setAddress: vi.fn(),
      refreshEscrows: vi.fn(async () => {}),
      connectWallet: vi.fn(async () => {}),
      createEscrow: vi.fn(async () => {}),
      approveMilestone: vi.fn(async () => {}),
      claimMilestone: vi.fn(async () => {}),
      cancelEscrow: vi.fn(async () => {}),
      contractReady: observable(true),
      creatorEscrowCount: observable(0),
      beneficiaryEscrowCount: observable(0),
      activeCount: observable(0),
      completedCount: observable(0),
      creatorEscrows: observable([]),
      beneficiaryEscrows: observable([]),
      isRefreshing: observable(false),
      isCreating: observable(false),
      approvingId: observable<string | null>(null),
      claimingId: observable<string | null>(null),
      cancellingId: observable<string | null>(null),
      statusLabel: (s: string) => s,
      formatAmount: (sym: string, amt: bigint) => `${amt} ${sym}`,
      formatAddress: (a: string) => a,
      loadAll: vi.fn(async () => {}),
      cleanup: vi.fn(),
    };
  };

  reset();
  return { state, reset };
});

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("../react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.state.definition = definition as { setup?: (ctx: Record<string, unknown>) => unknown };
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("../../milestone-escrow/src/composables/useMilestoneEscrow", () => ({
  useMilestoneEscrow: vi.fn(() => harness.state.escrow),
}));

type ActionHandler = (...args: unknown[]) => Promise<unknown>;

function buildCtx(registeredActions: Map<string, ActionHandler>) {
  const emitted: Array<{ message: string; type: string }> = [];
  const bus = {
    emit: (_event: string, payload: unknown) => {
      emitted.push(payload as { message: string; type: string });
    },
  } as unknown as EventBus;
  // The REAL guard semantics: success toast on success, error toast +
  // swallowed rejection on failure. t is identity so toasts carry the key.
  const notify = new NotificationService(bus, (key: string) => key);

  const ctx = {
    services: {
      chain: {
        address: {
          get: () => "",
          set: () => {},
          subscribe: () => () => undefined,
        },
        ensureWallet: vi.fn(async () => "NMockWalletAddress0000000000000000"),
      },
      notify,
    },
    t: (key: string) => key,
    registerAction: (key: string, handler: ActionHandler) => {
      registeredActions.set(key, handler);
    },
  };
  Object.assign(ctx, {
    framework: createMiniAppFramework(ctx as never, { appId: "miniapp-milestone-escrow" }),
  });
  return { ctx, emitted };
}

const ACTION_ARGS: Record<string, unknown[]> = {
  refreshEscrows: [],
  connectWallet: [],
  createEscrow: [{ name: "x", beneficiary: "N", asset: "GAS", notes: "", milestones: [] }],
  approveMilestone: [{ id: "1" }],
  claimMilestone: [{ id: "1" }],
  cancelEscrow: [{ id: "1" }],
};

describe("Milestone Escrow setup (app.notify.guard wiring)", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.reset();
    await import("../../milestone-escrow/src/main");
  });

  it("registers all six actions", async () => {
    const actions = new Map<string, ActionHandler>();
    const { ctx } = buildCtx(actions);
    await harness.state.definition?.setup?.(ctx);

    expect([...actions.keys()].sort()).toEqual(Object.keys(ACTION_ARGS).sort());
  });

  it("a failing handler emits an error toast and resolves instead of rejecting", async () => {
    const escrow = harness.state.escrow as Record<string, ReturnType<typeof vi.fn>>;
    for (const name of Object.keys(ACTION_ARGS)) {
      escrow[name] = vi.fn(async () => {
        throw new Error(`${name} failed`);
      });
    }

    const actions = new Map<string, ActionHandler>();
    const { ctx, emitted } = buildCtx(actions);
    await harness.state.definition?.setup?.(ctx);

    // Without the guard wrapping, every one of these awaits would REJECT and
    // fail the test — the regression this suite pins down.
    for (const [name, args] of Object.entries(ACTION_ARGS)) {
      await actions.get(name)!(...args);
    }

    const errors = emitted.filter((n) => n.type === "error").map((n) => n.message);
    expect(errors).toEqual(
      Object.keys(ACTION_ARGS).map((name) => `${name} failed`),
    );
  });

  it("createEscrow resolves false on failure (PlayArea keeps the form) and true on success", async () => {
    const escrow = harness.state.escrow as Record<string, ReturnType<typeof vi.fn>>;
    escrow.createEscrow = vi.fn(async () => {
      throw new Error("depositPrepaidNoEscrow");
    });

    const actions = new Map<string, ActionHandler>();
    const { ctx, emitted } = buildCtx(actions);
    await harness.state.definition?.setup?.(ctx);

    await expect(actions.get("createEscrow")!(...ACTION_ARGS.createEscrow)).resolves.toBe(false);
    expect(emitted).toContainEqual({ message: "depositPrepaidNoEscrow", type: "error" });

    escrow.createEscrow = vi.fn(async () => {});
    await expect(actions.get("createEscrow")!(...ACTION_ARGS.createEscrow)).resolves.toBe(true);
    expect(emitted).toContainEqual({ message: "escrowCreated", type: "success" });
  });

  it("approve, claim, and cancel emit their success toasts", async () => {
    const actions = new Map<string, ActionHandler>();
    const { ctx, emitted } = buildCtx(actions);
    await harness.state.definition?.setup?.(ctx);

    await actions.get("approveMilestone")!(...ACTION_ARGS.approveMilestone);
    await actions.get("claimMilestone")!(...ACTION_ARGS.claimMilestone);
    await actions.get("cancelEscrow")!(...ACTION_ARGS.cancelEscrow);

    const successes = emitted.filter((n) => n.type === "success").map((n) => n.message);
    expect(successes).toEqual(["approveSuccess", "claimSuccess", "cancelSuccess"]);
  });
});
