import { describe, expect, it, vi } from "vitest";

import { useTimeCapsule } from "../../time-capsule/src/composables/useTimeCapsule";
import type { ChainService } from "../services";
import type { EscrowProxy } from "../services/os/EscrowProxy";
import type { StorageProxy } from "../services/os/StorageProxy";
import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { BadgeProxy } from "../services/os/BadgeProxy";
import { createObservable } from "../react/context";

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OTHER = "NfgHwwTi3wHAS8aFAN243C5vGbkYDpqLHP";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    fishNone: "No public capsule found",
    fishResult: "Fished capsule {id}",
    error: "Something went wrong",
    notAvailable: "N/A",
  };
  const base = messages[key] ?? key;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

interface StoredRecord {
  id: string;
  title: string;
  contentHash: string;
  unlockTime: number;
  isPublic: boolean;
  isRevealed: boolean;
  owner: string;
  escrowId?: string;
  amount?: string;
  fished?: boolean;
  category?: number;
}

function record(partial: Partial<StoredRecord> & { id: string }): StoredRecord {
  return {
    title: `Capsule ${partial.id}`,
    contentHash: `hash-${partial.id}`,
    unlockTime: Date.now() - 1_000,
    isPublic: true,
    isRevealed: false,
    owner: OTHER,
    amount: "0.2",
    category: 1,
    ...partial,
  };
}

function setup(records: StoredRecord[]) {
  const store: Record<string, StoredRecord> = {};
  for (const r of records) store[`capsules:${r.id}`] = r;

  const storage = {
    list: vi.fn(async () => ({ ...store })),
    set: vi.fn(async (key: string, value: unknown) => {
      store[key] = value as StoredRecord;
      return { ok: true };
    }),
    get: vi.fn(async () => null),
  } as unknown as StorageProxy & {
    list: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  const escrow = {
    create: vi.fn(async () => "escrow-1"),
    refund: vi.fn(async () => undefined),
    completeMilestone: vi.fn(async () => undefined),
  } as unknown as EscrowProxy;

  const payment = {
    deposit: vi.fn(async () => ({ ok: true })),
  } as unknown as PaymentProxy & { deposit: ReturnType<typeof vi.fn> };

  const badge = {
    award: vi.fn(async () => undefined),
  } as unknown as BadgeProxy;

  const address = createObservable<string | null>(ME);
  const chain = {
    address,
    ensureWallet: vi.fn(async () => ME),
  } as unknown as ChainService;

  const events: Array<{ event: string; payload?: unknown }> = [];
  const eventBus = {
    emit: (event: string, payload?: unknown) => {
      events.push({ event, payload });
    },
  };

  const capsule = useTimeCapsule({
    chainService: chain,
    escrowService: escrow,
    storageService: storage,
    paymentService: payment,
    badgeService: badge,
    eventBus,
    t,
  });

  return { capsule, storage, payment, events, store };
}

describe("useTimeCapsule.fishCapsule cross-user discovery", () => {
  it("fishes another user's public, unrevealed capsule (not the user's own)", async () => {
    const { capsule, storage, payment, events } = setup([
      record({ id: "100", owner: ME }), // own — should be skipped as a candidate
      record({ id: "200", owner: OTHER }), // other user's — the real target
    ]);

    await capsule.loadAll();
    await capsule.fishCapsule();

    // Fee paid against the OTHER user's capsule, not the user's own.
    expect(payment.deposit).toHaveBeenCalledWith("0.05", "fish:200");

    // The candidate is marked fished while preserving its original owner.
    expect(storage.set).toHaveBeenCalledWith(
      "capsules:200",
      expect.objectContaining({ id: "200", owner: OTHER, fished: true }),
    );

    const fished = events.find((e) => e.event === "capsule:fished");
    expect(fished?.payload).toEqual({ message: "Fished capsule 200" });
  });

  it("reports fishNone and charges no fee when nothing is fishable", async () => {
    const { capsule, payment, events } = setup([
      record({ id: "300", owner: ME, isPublic: false }), // private own
      record({ id: "400", owner: OTHER, isRevealed: true }), // already revealed
      record({ id: "500", owner: OTHER, fished: true }), // already fished
    ]);

    await capsule.loadAll();
    await capsule.fishCapsule();

    expect(payment.deposit).not.toHaveBeenCalled();
    const fished = events.find((e) => e.event === "capsule:fished");
    expect(fished?.payload).toEqual({ message: "No public capsule found" });
  });

  it("falls back to the user's own public capsule when no other-owner candidate exists", async () => {
    const { capsule, payment } = setup([
      record({ id: "600", owner: ME, isPublic: true }), // only own public capsule
    ]);

    await capsule.loadAll();
    await capsule.fishCapsule();

    // No cross-user candidate, so the single-user fallback fishes the own one.
    expect(payment.deposit).toHaveBeenCalledWith("0.05", "fish:600");
  });
});
