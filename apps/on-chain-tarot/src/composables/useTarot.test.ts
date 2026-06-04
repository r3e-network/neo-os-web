import { describe, expect, it, vi } from "vitest";
import { useTarot } from "./useTarot";
import type { UseTarotOptions } from "./useTarot";

const t = (key: string) => {
  const messages: Record<string, string> = {
    defaultQuestion: "tarot",
    readingPending: "Reading pending",
    readingUnavailable: "Reading unavailable",
    yes: "Yes",
    no: "No",
    past: "Past",
    present: "Present",
    future: "Future",
    readingText: "Reading text",
  };
  return messages[key] ?? key;
};

/**
 * Build a mock OS service set. The reading is now derived client-side from the
 * deposit tx id and persisted via storage.set, so the storage mock echoes the
 * last value written through set() back out of get() to model the round trip.
 */
function createTarotServices(options?: {
  depositResult?: unknown;
  listResult?: unknown;
  rejectDeposit?: boolean;
}) {
  const store = new Map<string, unknown>();

  const paymentService = {
    deposit: vi.fn(async () => {
      if (options?.rejectDeposit) throw new Error("payment unavailable");
      return options?.depositResult ?? { invocation: {}, txid: "tx-reading-1" };
    }),
  };
  const storageService = {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return { ok: true };
    }),
    list: vi.fn(async () => options?.listResult ?? {}),
  };
  const badgeService = {
    award: vi.fn(async () => undefined),
  };
  const clipboard = {
    copy: vi.fn(async () => true),
  };

  return {
    paymentService: paymentService as unknown as UseTarotOptions["paymentService"],
    storageService: storageService as unknown as UseTarotOptions["storageService"],
    badgeService: badgeService as unknown as UseTarotOptions["badgeService"],
    clipboard: clipboard as unknown as UseTarotOptions["clipboard"],
  };
}

describe("useTarot", () => {
  it("pays the draw fee, derives a valid three-card reading, and supports reveal/reset", async () => {
    const services = createTarotServices();
    const tarot = useTarot({ ...services, t });

    tarot.question.set("What should I focus on?");
    await tarot.draw();

    // Draw fee is paid through the OS payment service with the question memo.
    expect(services.paymentService.deposit).toHaveBeenCalledWith("0.1", "What should I focus on?");
    // Reading is persisted under the tx-derived reading id and read back.
    expect(services.storageService.set).toHaveBeenCalledWith(
      "reading:tx-reading-1",
      expect.objectContaining({ status: "completed", readingId: "tx-reading-1" }),
    );
    expect(services.storageService.get).toHaveBeenCalledWith("reading:tx-reading-1");

    // Three unique, valid deck cards were drawn.
    const ids = tarot.drawn.get().map((card) => card.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(78);
    });

    expect(tarot.hasDrawn.get()).toBe(true);
    expect(tarot.allFlipped.get()).toBe(false);
    expect(tarot.readingsCount.get()).toBe(1);
    expect(tarot.cardsDrawnCount.get()).toBe(3);
    expect(tarot.readingMode.get()).toBe("oracle");

    tarot.flipCard(0);
    tarot.flipCard(1);
    tarot.flipCard(2);
    expect(tarot.allFlipped.get()).toBe(true);
    expect(tarot.allRevealedDisplay.get()).toBe("Yes");

    tarot.reset();
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("idle");
  });

  it("derives the same reading for the same tx id (deterministic seed)", async () => {
    const first = createTarotServices();
    const tarotA = useTarot({ ...first, t });
    await tarotA.draw();
    const idsA = tarotA.drawn.get().map((card) => card.id);

    const second = createTarotServices();
    const tarotB = useTarot({ ...second, t });
    await tarotB.draw();
    const idsB = tarotB.drawn.get().map((card) => card.id);

    // Same deposit tx id => same deterministic three-card spread.
    expect(idsA).toEqual(idsB);
  });

  it("does not synthesize a reading when the payment service is unavailable", async () => {
    const services = createTarotServices({ rejectDeposit: true });
    const tarot = useTarot({ ...services, t });

    await expect(tarot.draw()).rejects.toThrow("Reading unavailable");

    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.hasDrawn.get()).toBe(false);
    expect(tarot.readingMode.get()).toBe("idle");
    expect(services.storageService.set).not.toHaveBeenCalled();
  });

  it("copies a complete reading via the clipboard service and reports failure when none is drawn", async () => {
    const services = createTarotServices();
    const tarot = useTarot({ ...services, t });

    // No reading yet: copyReading must not claim success or hit the clipboard.
    await expect(tarot.copyReading()).resolves.toBe(false);
    expect(services.clipboard.copy).not.toHaveBeenCalled();

    await tarot.draw();
    await expect(tarot.copyReading()).resolves.toBe(true);
    expect(services.clipboard.copy).toHaveBeenCalledTimes(1);
    expect(services.clipboard.copy).toHaveBeenCalledWith(
      expect.stringContaining("Past:"),
      "readingCopied",
    );
  });

  it("unwraps deposit responses that use { ok, data } envelopes", async () => {
    const services = createTarotServices({
      depositResult: { ok: true, data: { invocation: {}, txid: "wrapped-tx-1" } },
    });
    const tarot = useTarot({ ...services, t });

    await tarot.draw();

    expect(services.storageService.set).toHaveBeenCalledWith(
      "reading:wrapped-tx-1",
      expect.objectContaining({ readingId: "wrapped-tx-1" }),
    );
    expect(services.storageService.get).toHaveBeenCalledWith("reading:wrapped-tx-1");
    expect(tarot.readingMode.get()).toBe("oracle");
  });
});
