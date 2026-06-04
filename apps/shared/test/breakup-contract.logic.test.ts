import { describe, expect, it, vi } from "vitest";

import { useBreakup } from "../../breakup-contract/src/composables/useBreakup";
import type { BadgeProxy } from "../services/os/BadgeProxy";
import type { EscrowProxy } from "../services/os/EscrowProxy";
import type { StorageProxy } from "../services/os/StorageProxy";

const PARTNER = `N${"A".repeat(33)}`;

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    contractActionUnavailable:
      "Contract submission services are not configured in this environment yet.",
    contractCreated: "Contract created successfully!",
    contractIndexUnavailable:
      "Live contract records are not available in this environment yet.",
    contractPreparing: `Preparing wallet confirmation for "${params?.title ?? ""}" with ${params?.amount ?? ""} stake.`,
    contractSubmitted: `Contract "${params?.title ?? ""}" submitted. Refreshing contract state.`,
    partnerInvalid: "Invalid partner address",
    partnerRequired: "Partner address is required",
    stakeOrDurationInvalid:
      "Stake must be at least 1 GAS and duration at least 30 days",
    stakeRequired: "Stake amount is required",
    titleRequired: "Contract title is required",
    titleTooLong: "Title must be 100 characters or less",
    termsTooLong: "Terms must be 2000 characters or less",
  };
  return messages[key] ?? key;
}

function services(overrides: {
  escrow?: Partial<EscrowProxy>;
  storage?: Partial<StorageProxy>;
  badge?: Partial<BadgeProxy>;
} = {}) {
  return {
    escrowService: {
      create: vi.fn(async () => ({ txid: "0xescrow" })),
      fund: vi.fn(),
      completeMilestone: vi.fn(),
      refund: vi.fn(),
      get: vi.fn(async () => null),
      ...overrides.escrow,
    } as unknown as EscrowProxy,
    storageService: {
      list: vi.fn(async () => ({})),
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      ...overrides.storage,
    } as unknown as StorageProxy,
    badgeService: {
      award: vi.fn(async () => undefined),
      ...overrides.badge,
    } as unknown as BadgeProxy,
    eventBus: {
      emit: vi.fn(),
    },
  };
}

function validApp(overrides = {}) {
  const mocks = services(overrides);
  const app = useBreakup({ ...mocks, t });
  app.partnerAddress.set(PARTNER);
  app.stakeAmount.set("5");
  app.duration.set("90");
  app.contractTitle.set("Summer covenant");
  app.contractTerms.set("Shared plans and clean exit rules.");
  return { app, mocks };
}

describe("useBreakup", () => {
  it("keeps the contract desk usable when storage index is unavailable", async () => {
    const app = useBreakup({
      ...services({
        storage: {
          list: vi.fn(async () => {
            throw new Error("OS service error (os-storage-list): Not Found");
          }),
        },
      }),
      t,
    });

    await expect(app.loadContracts()).resolves.toBeUndefined();
    expect(app.contracts.get()).toEqual([]);
    expect(app.serviceNotice.get()).toBe(
      "Live contract records are not available in this environment yet.",
    );
  });

  it("creates relationship contracts through escrow and storage services", async () => {
    const { app, mocks } = validApp();

    await app.createContract();

    expect(mocks.escrowService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        beneficiary: PARTNER,
        amount: "5",
        milestones: [{ name: "relationship", amount: "5" }],
      }),
    );
    // The index write MUST use the same prefix loadContracts() lists
    // (contracts:) and carry a full StoredContract shape so the contract is
    // readable back. party1 is the creator, party2 the partner, stake in
    // fixed8 base units, and the storage-key id equals the escrowId.
    expect(mocks.storageService.set).toHaveBeenCalledWith(
      expect.stringMatching(/^contracts:\d+$/),
      expect.objectContaining({
        party2: PARTNER,
        title: "Summer covenant",
        terms: "Shared plans and clean exit rules.",
        stake: 5 * 1e8,
        duration: 90 * 86400,
      }),
    );
    const [storageKey, storedRecord] = (
      mocks.storageService.set as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    // The stored id MUST equal the storage-key suffix so fund/complete (which
    // pass String(contract.id)) target the right escrow.
    expect(`contracts:${(storedRecord as { id: number }).id}`).toBe(storageKey);
    expect(app.actionNotice.get()).toBe(
      'Contract "Summer covenant" submitted. Refreshing contract state.',
    );
    expect(app.lastSubmittedTitle.get()).toBe("Summer covenant");
  });

  it("round-trips a created contract through storage so it lists and signs against the right escrow", async () => {
    const store: Record<string, unknown> = {};
    const { app, mocks } = validApp({
      storage: {
        set: vi.fn(async (key: string, value: unknown) => {
          store[key] = value;
          return undefined;
        }),
        list: vi.fn(async (prefix: string) =>
          Object.fromEntries(
            Object.entries(store).filter(([k]) => k.startsWith(prefix)),
          ),
        ),
      },
    });
    // Creator is the connected wallet (party1); without it the per-party
    // Sign/Break controls would never render.
    app.address.set(PARTNER.replace("A", "B"));

    await app.createContract();

    // The post-create refresh must surface the contract the user just made.
    const listed = app.contracts.get();
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Summer covenant");
    expect(listed[0].party2).toBe(PARTNER);
    expect(listed[0].stake).toBe(5);
    expect(listed[0].status).toBe("pending");

    // Signing must fund the escrow whose id equals the listed contract id.
    await app.signContract({ id: listed[0].id, stake: listed[0].stake });
    expect(mocks.escrowService.fund).toHaveBeenCalledWith(String(listed[0].id));
  });

  it("captures the kernel-assigned escrow id and targets it for sign/break", async () => {
    // The os-escrow-create edge fn returns the kernel CreateEscrow value (a
    // sequential id) — here "42", distinct from the Date.now() storage id. The
    // composable must persist THAT as escrowId and use it (not the storage id)
    // for fund()/completeMilestone(), otherwise those calls hit a non-existent
    // escrow on chain.
    const store: Record<string, unknown> = {};
    const { app, mocks } = validApp({
      escrow: {
        create: vi.fn(async () => "42"),
      },
      storage: {
        get: vi.fn(async (key: string) => store[key] ?? null),
        set: vi.fn(async (key: string, value: unknown) => {
          store[key] = value;
          return undefined;
        }),
        list: vi.fn(async (prefix: string) =>
          Object.fromEntries(
            Object.entries(store).filter(([k]) => k.startsWith(prefix)),
          ),
        ),
      },
    });
    app.address.set(PARTNER.replace("A", "B"));

    await app.createContract();

    const [, storedRecord] = (
      mocks.storageService.set as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect((storedRecord as { escrowId: string }).escrowId).toBe("42");

    const listed = app.contracts.get();
    expect(listed).toHaveLength(1);
    // The storage-key id is a Date.now() timestamp, NOT the kernel escrow id.
    expect(String(listed[0].id)).not.toBe("42");
    expect(listed[0].escrowId).toBe("42");

    await app.signContract({ id: listed[0].id, stake: listed[0].stake, escrowId: listed[0].escrowId });
    expect(mocks.escrowService.fund).toHaveBeenCalledWith("42");

    await app.breakContract({ id: listed[0].id, escrowId: listed[0].escrowId });
    expect(mocks.escrowService.completeMilestone).toHaveBeenCalledWith("42", 0);
  });

  it("advances contract status from live escrow state instead of the write-once snapshot", async () => {
    // A freshly created contract is stored pending (party2Signed:false). Once
    // the kernel escrow reports funded/active, loadContracts must hydrate that
    // live state so the card flips to 'active' (exposing Break) rather than
    // staying frozen on 'pending' (still showing Sign).
    const store: Record<string, unknown> = {};
    const liveState: Record<string, { funded: boolean; active: boolean; completed: boolean }> = {};
    const { app } = validApp({
      escrow: {
        create: vi.fn(async () => "7"),
        get: vi.fn(async (escrowId: string) => liveState[String(escrowId)] ?? null),
      },
      storage: {
        get: vi.fn(async (key: string) => store[key] ?? null),
        set: vi.fn(async (key: string, value: unknown) => {
          store[key] = value;
          return undefined;
        }),
        list: vi.fn(async (prefix: string) =>
          Object.fromEntries(
            Object.entries(store).filter(([k]) => k.startsWith(prefix)),
          ),
        ),
      },
    });
    app.address.set(PARTNER.replace("A", "B"));

    await app.createContract();
    expect(app.contracts.get()[0].status).toBe("pending");

    // Kernel now reports the escrow funded/active. A reload must surface it.
    liveState["7"] = { funded: true, active: true, completed: false };
    await app.loadContracts();
    expect(app.contracts.get()[0].status).toBe("active");

    // Kernel reports the milestone completed -> status becomes 'broken'.
    liveState["7"] = { funded: true, active: false, completed: true };
    await app.loadContracts();
    expect(app.contracts.get()[0].status).toBe("broken");
  });

  it("normalizes escrow boundary errors during create", async () => {
    const { app } = validApp({
      escrow: {
        create: vi.fn(async () => {
          throw new Error("OS service error (os-escrow-create): Not Found");
        }),
      },
    });

    await expect(app.createContract()).rejects.toThrow(
      "Contract submission services are not configured in this environment yet.",
    );
    expect(app.actionNotice.get()).toBe(
      "Contract submission services are not configured in this environment yet.",
    );
  });
});
