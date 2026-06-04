import { describe, expect, it, vi } from "vitest";

import { useMilestoneEscrow } from "../../milestone-escrow/src/composables/useMilestoneEscrow";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";
import type { EscrowProxy } from "../services/os/EscrowProxy";
import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { StorageProxy } from "../services/os/StorageProxy";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string) {
  const messages: Record<string, string> = {
    invalidAmount: "Enter a valid amount",
    milestoneLimit: "Milestones must be between 1 and 12",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
  };
  return messages[key] ?? key;
}

/**
 * In-memory StorageProxy stand-in so refreshEscrows can rebuild the list from
 * the per-user index the composable writes (escrow:<addr>:<id> → meta).
 */
function makeStorage() {
  const store = new Map<string, unknown>();
  const storage = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return undefined;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
      return undefined;
    }),
    list: vi.fn(async (prefix: string) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of store.entries()) {
        if (k.startsWith(prefix)) out[k] = v;
      }
      return out;
    }),
  } as unknown as StorageProxy & {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  return { storage, store };
}

function setup() {
  const escrow = {
    get: vi.fn(async () => null),
    create: vi.fn(async () => "esc-1"),
    completeMilestone: vi.fn(async () => undefined),
    fund: vi.fn(async () => undefined),
    refund: vi.fn(async () => undefined),
  } as unknown as EscrowProxy & {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    completeMilestone: ReturnType<typeof vi.fn>;
    fund: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
  };
  const payment = {
    deposit: vi.fn(async () => ({ invocation: { txid: "0xdeposit" } })),
  } as unknown as PaymentProxy & { deposit: ReturnType<typeof vi.fn> };
  const { storage, store } = makeStorage();

  const app = useMilestoneEscrow({
    escrowService: escrow,
    paymentService: payment,
    storageService: storage,
    t,
  });
  app.setAddress(OWNER);
  return { app, escrow, payment, storage, store };
}

function escrowItem(overrides: Partial<EscrowItem> = {}): EscrowItem {
  return {
    id: "esc-1",
    creator: OWNER,
    beneficiary: OWNER,
    assetSymbol: "GAS",
    totalAmount: 5_000_000n,
    releasedAmount: 0n,
    status: "active",
    milestoneAmounts: [5_000_000n],
    milestoneApproved: [false],
    milestoneClaimed: [false],
    title: "Website delivery",
    notes: "Ship the UI",
    active: true,
    ...overrides,
  };
}

describe("useMilestoneEscrow", () => {
  it("passes human-decimal amounts to the OS proxies (no 10^8 double-scaling)", async () => {
    const { app, escrow, payment, store } = setup();

    await app.createEscrow({
      name: "Website delivery",
      beneficiary: BENEFICIARY,
      asset: "GAS",
      notes: "Frontend acceptance",
      milestones: [{ amount: "0.05" }, { amount: "0.05" }],
    });

    // Edge functions scale by 10^8 themselves: the client must send the
    // human-decimal value, not pre-scaled base units. 0.05 + 0.05 = 0.1 GAS.
    expect(payment.deposit).toHaveBeenCalledWith(
      "0.1",
      "escrow:create:Website delivery",
    );
    expect(escrow.create).toHaveBeenCalledWith({
      beneficiary: BENEFICIARY,
      amount: "0.1",
      milestones: [
        { name: "milestone-0", amount: "0.05" },
        { name: "milestone-1", amount: "0.05" },
      ],
    });

    // The local os-storage index keeps base-unit strings for display.
    expect(app.creatorEscrows.get()).toHaveLength(1);
    expect(app.creatorEscrows.get()[0].totalAmount).toBe(10_000_000n);
    const creatorKeys = [...store.keys()].filter((k) => k.startsWith(`escrow:${OWNER}:`));
    expect(creatorKeys).toHaveLength(1);
  });

  it("rejects invalid amounts before any proxy call", async () => {
    const { app, escrow, payment } = setup();

    await expect(
      app.createEscrow({
        name: "Bad",
        beneficiary: BENEFICIARY,
        asset: "GAS",
        notes: "",
        milestones: [{ amount: "-1" }],
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(payment.deposit).not.toHaveBeenCalled();
    expect(escrow.create).not.toHaveBeenCalled();
  });

  it("rejects fractional NEO amounts (NEO is indivisible)", async () => {
    const { app, payment } = setup();

    await expect(
      app.createEscrow({
        name: "Frac",
        beneficiary: BENEFICIARY,
        asset: "NEO",
        notes: "",
        milestones: [{ amount: "1.5" }],
      }),
    ).rejects.toThrow("Enter a valid amount");

    expect(payment.deposit).not.toHaveBeenCalled();
  });

  it("approves, claims, and cancels escrows through the OS proxy actions", async () => {
    const { app, escrow } = setup();
    const active = escrowItem();
    app.creatorEscrows.set([active]);
    app.beneficiaryEscrows.set([escrowItem({ creator: BENEFICIARY })]);

    await app.approveMilestone(active, 0);
    expect(escrow.completeMilestone).toHaveBeenCalledWith("esc-1", 0);

    const claimable = escrowItem({ milestoneApproved: [true], milestoneClaimed: [false] });
    await app.claimMilestone(claimable, 0);
    expect(escrow.fund).toHaveBeenCalledWith("esc-1");

    const cancellable = escrowItem({ id: "esc-2" });
    await app.cancelEscrow(cancellable);
    expect(escrow.refund).toHaveBeenCalledWith("esc-2");
  });
});
