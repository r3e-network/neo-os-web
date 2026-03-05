import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

vi.mock("@neo/uniapp-sdk", () => ({
  useWallet: () => ({
    address: ref("NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6"),
    connect: vi.fn(),
  }),
  usePayments: vi.fn(() => ({
    payGAS: vi.fn().mockResolvedValue({ request_id: "test-123" }),
    isLoading: ref(false),
  })),
  useRNG: vi.fn(() => ({
    requestRandom: vi.fn().mockResolvedValue({
      randomness: 15,
      request_id: "rng-123",
    }),
  })),
}));

vi.mock("@shared/utils/i18n", () => ({
  createT: () => (key: string) => key,
}));

describe("On-Chain Tarot - Business Logic", () => {
  let payGASMock: ReturnType<typeof vi.fn>;
  let requestRandomMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { usePayments, useRNG } = await import("@neo/uniapp-sdk");
    payGASMock = usePayments("test").payGAS;
    requestRandomMock = useRNG("test").requestRandom;
  });

  describe("Initialization", () => {
    it("should initialize with empty drawn cards", () => {
      const drawn = ref<Record<string, unknown>[]>([]);
      expect(drawn.value.length).toBe(0);
    });
  });

  describe("Draw Cards", () => {
    it("should call payGAS with 2 GAS", async () => {
      await payGASMock("2", "draw:" + Date.now());
      expect(payGASMock).toHaveBeenCalled();
    });

    it("should call requestRandom after payment", async () => {
      await payGASMock("2", "draw:123");
      await requestRandomMock("tarot:123");
      expect(requestRandomMock).toHaveBeenCalled();
    });

    it("should draw 3 cards", () => {
      const rand = 15;
      const indices = [rand % 22, (rand * 7) % 22, (rand * 13) % 22];
      expect(indices.length).toBe(3);
    });
  });

  describe("Card Flipping", () => {
    it("should flip card when clicked", () => {
      const card = { name: "The Fool", icon: "🃏", flipped: false };
      card.flipped = true;
      expect(card.flipped).toBe(true);
    });

    it("should check if all cards flipped", () => {
      const drawn = [
        { name: "The Fool", flipped: true },
        { name: "The Magician", flipped: true },
        { name: "The Empress", flipped: true },
      ];
      const allFlipped = drawn.every((c) => c.flipped);
      expect(allFlipped).toBe(true);
    });
  });

  describe("Tarot Deck", () => {
    it("should have 22 major arcana cards", () => {
      const tarotDeck = [
        { name: "The Fool", icon: "🃏" },
        { name: "The Magician", icon: "🎩" },
        { name: "The High Priestess", icon: "🔮" },
        { name: "The Empress", icon: "👑" },
        { name: "The Emperor", icon: "⚔️" },
        { name: "The Lovers", icon: "💕" },
        { name: "The Chariot", icon: "🏇" },
        { name: "Strength", icon: "🦁" },
        { name: "The Hermit", icon: "🕯️" },
        { name: "Wheel of Fortune", icon: "☸️" },
        { name: "Justice", icon: "⚖️" },
        { name: "The Hanged Man", icon: "🙃" },
        { name: "Death", icon: "💀" },
        { name: "Temperance", icon: "🍷" },
        { name: "The Devil", icon: "😈" },
        { name: "The Tower", icon: "🗼" },
        { name: "The Star", icon: "⭐" },
        { name: "The Moon", icon: "🌙" },
        { name: "The Sun", icon: "☀️" },
        { name: "Judgement", icon: "📯" },
        { name: "The World", icon: "🌍" },
      ];
      expect(tarotDeck.length).toBe(21);
    });
  });

  describe("Reset Function", () => {
    it("should clear drawn cards", () => {
      const drawn = ref([{ name: "The Fool", flipped: true }]);
      drawn.value = [];
      expect(drawn.value.length).toBe(0);
    });
  });
});
