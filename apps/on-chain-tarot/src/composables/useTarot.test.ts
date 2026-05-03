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

function createTarotServices(options?: {
  betResult?: unknown;
  getResult?: unknown;
  listResult?: unknown;
  rejectBet?: boolean;
}) {
  const gameService = {
    placeBet: vi.fn(async () => {
      if (options?.rejectBet) throw new Error("oracle unavailable");
      return options?.betResult ?? { readingId: "reading-1" };
    }),
  };
  const storageService = {
    get: vi.fn(async () => options?.getResult ?? { status: "completed", cards: [0, 22, 77] }),
    list: vi.fn(async () => options?.listResult ?? {}),
  };
  const badgeService = {
    award: vi.fn(async () => undefined),
  };

  return {
    gameService: gameService as unknown as UseTarotOptions["gameService"],
    storageService: storageService as unknown as UseTarotOptions["storageService"],
    badgeService: badgeService as unknown as UseTarotOptions["badgeService"],
  };
}

describe("useTarot", () => {
  it("draws a valid three-card oracle reading and supports reveal/reset", async () => {
    const services = createTarotServices();
    const tarot = useTarot({ ...services, t });

    tarot.question.set("What should I focus on?");
    await tarot.draw();

    expect(services.gameService.placeBet).toHaveBeenCalledWith("tarot", "What should I focus on?");
    expect(services.storageService.get).toHaveBeenCalledWith("reading:reading-1");
    expect(tarot.drawn.get().map((card) => card.id)).toEqual([0, 22, 77]);
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
    expect(tarot.getReading()).toContain("Past: The Fool");

    tarot.reset();
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("idle");
  });

  it("falls back to a playable local preview when the oracle service is unavailable", async () => {
    const services = createTarotServices({ rejectBet: true });
    const tarot = useTarot({ ...services, t });

    await tarot.draw();

    const ids = tarot.drawn.get().map((card) => card.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => Number.isInteger(id) && id >= 0 && id < 78)).toBe(true);
    expect(tarot.hasDrawn.get()).toBe(true);
    expect(tarot.readingMode.get()).toBe("preview");
  });

  it("unwraps edge responses that use { ok, data } envelopes", async () => {
    const services = createTarotServices({
      betResult: { ok: true, data: { reading_id: "wrapped-1" } },
      getResult: { ok: true, data: { status: "completed", cards: [3, 36, 50] } },
    });
    const tarot = useTarot({ ...services, t });

    await tarot.draw();

    expect(services.storageService.get).toHaveBeenCalledWith("reading:wrapped-1");
    expect(tarot.drawn.get().map((card) => card.name)).toEqual([
      "The Empress",
      "Ace of Cups",
      "Ace of Swords",
    ]);
    expect(tarot.readingMode.get()).toBe("oracle");
  });
});
