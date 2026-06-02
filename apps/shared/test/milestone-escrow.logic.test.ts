import { describe, expect, it, vi } from "vitest";

import { useMilestoneEscrow } from "../../milestone-escrow/src/composables/useMilestoneEscrow";
import type { EscrowItem } from "../../milestone-escrow/src/pages/index/components/EscrowList";
import type { EscrowProxy } from "../services/os/EscrowProxy";
import type { PaymentProxy } from "../services/os/PaymentProxy";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string) {
  const messages: Record<string, string> = {
    escrowCreated: "Escrow created",
    escrowCancelled: "Escrow cancelled",
    escrowNameRequired: "Escrow name is required",
    escrowsLoaded: "Escrows loaded",
    invalidAddress: "Invalid beneficiary address",
    invalidAmount: "Enter a valid amount",
    milestone: "Milestone",
    milestoneApproved: "Milestone approved",
    milestoneClaimed: "Milestone claimed",
    milestoneLimit: "Milestones must be between 1 and 12",
    noClaimableMilestone: "No approved milestone to claim",
    noPendingMilestone: "No pending milestone to approve",
    refreshingEscrows: "Refreshing escrows",
    statusActive: "Active",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    workflowApproving: "Approving milestone",
    workflowCancelling: "Cancelling escrow",
    workflowClaiming: "Claiming milestone",
    workflowCreating: "Creating escrow",
    workflowFailed: "Action failed",
    workflowReady: "Ready",
  };
  return messages[key] ?? key;
}

function setup() {
  const escrow = {
    get: vi.fn(async () => []),
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

  const app = useMilestoneEscrow({
    escrowService: escrow,
    paymentService: payment,
    t,
  });
  app.setAddress(OWNER);
  return { app, escrow, payment };
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
    milestoneNames: ["Design"],
    title: "Website delivery",
    notes: "Ship the UI",
    active: true,
    ...overrides,
  };
}

describe("useMilestoneEscrow", () => {
  it("creates a funded escrow with named milestones and records evidence", async () => {
    const { app, escrow, payment } = setup();

    const created = await app.createEscrow({
      name: "Website delivery",
      beneficiary: OWNER,
      asset: "GAS",
      notes: "Frontend acceptance",
      milestones: [
        { name: "Design", amount: "0.05" },
        { name: "Build", amount: "0.05" },
      ],
    });

    expect(payment.deposit).toHaveBeenCalledWith(
      "10000000",
      "escrow:create:Website delivery",
    );
    expect(escrow.create).toHaveBeenCalledWith({
      beneficiary: OWNER,
      amount: "10000000",
      milestones: [
        { name: "Design", amount: "5000000" },
        { name: "Build", amount: "5000000" },
      ],
    });
    expect(created?.milestoneNames).toEqual(["Design", "Build"]);
    expect(app.creatorEscrows.get()).toHaveLength(1);
    expect(app.latestResult.get()?.status).toBe("success");
  });

  it("approves, claims, and cancels escrows through the OS proxy actions", async () => {
    const { app, escrow } = setup();
    const active = escrowItem();
    app.creatorEscrows.set([active]);
    app.beneficiaryEscrows.set([active]);

    await app.approveMilestone(active, 0);
    expect(escrow.completeMilestone).toHaveBeenCalledWith("esc-1", 0);
    expect(app.creatorEscrows.get()[0].milestoneApproved[0]).toBe(true);

    const approved = app.beneficiaryEscrows.get()[0];
    await app.claimMilestone(approved, 0);
    expect(escrow.fund).toHaveBeenCalledWith("esc-1", 0);
    expect(app.beneficiaryEscrows.get()[0].milestoneClaimed[0]).toBe(true);
    expect(app.beneficiaryEscrows.get()[0].status).toBe("completed");

    const cancellable = escrowItem({ id: "esc-2" });
    app.creatorEscrows.set([cancellable]);
    await app.cancelEscrow(cancellable);
    expect(escrow.refund).toHaveBeenCalledWith("esc-2");
    expect(app.creatorEscrows.get()[0].status).toBe("cancelled");
  });

  it("rejects invalid create payloads before proxy calls", async () => {
    const { app, escrow, payment } = setup();

    await expect(app.createEscrow({
      name: "Bad escrow",
      beneficiary: "not-a-neo-address",
      asset: "GAS",
      notes: "",
      milestones: [{ name: "Bad", amount: "0.05" }],
    })).rejects.toThrow("Invalid beneficiary address");

    expect(payment.deposit).not.toHaveBeenCalled();
    expect(escrow.create).not.toHaveBeenCalled();
  });
});
