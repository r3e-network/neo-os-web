import { describe, expect, it } from "vitest";
import {
  localizeTarotCard,
  normalizeTarotLocale,
  TAROT_DECK,
} from "./tarot-data";

describe("tarot card localization", () => {
  it("covers all 78 immutable card ids in English and Simplified Chinese", () => {
    expect(TAROT_DECK).toHaveLength(78);
    expect(TAROT_DECK.map((card) => card.id)).toEqual(
      Array.from({ length: 78 }, (_value, index) => index),
    );

    TAROT_DECK.forEach((card) => {
      const en = localizeTarotCard(card, "en");
      const zh = localizeTarotCard(card, "zh-CN");

      expect(en.name).toBe(card.name);
      expect(en.keywords).toHaveLength(2);
      expect(zh.name).not.toBe(card.name);
      expect(zh.name).toMatch(/[\u3400-\u9fff]/);
      expect(zh.keywords).toHaveLength(2);
      expect(zh.keywords?.every((keyword) => /[\u3400-\u9fff]/.test(keyword))).toBe(true);

      // Presentation locale must never change contract identity or asset URLs.
      expect(zh.id).toBe(card.id);
      expect(zh.image).toBe(card.image);
      expect(zh.backImage).toBe(card.backImage);
    });
  });

  it("switches an already-localized card back to canonical English by id", () => {
    const canonical = TAROT_DECK[47]!;
    const zh = localizeTarotCard(canonical, "zh");
    const enAgain = localizeTarotCard(zh, "en-US");

    expect(zh).toMatchObject({ id: 47, name: "圣杯骑士", suitLabel: "圣杯" });
    expect(enAgain).toMatchObject({
      id: 47,
      name: "Knight of Cups",
      suitLabel: "Cups",
      keywords: ["Feeling", "Minor Arcana"],
    });
    expect(enAgain.image).toBe(canonical.image);
  });

  it("normalizes locale codes rather than translated display strings", () => {
    expect(normalizeTarotLocale("zh")).toBe("zh");
    expect(normalizeTarotLocale("zh_CN")).toBe("zh");
    expect(normalizeTarotLocale("en-US")).toBe("en");
    expect(normalizeTarotLocale("ja")).toBe("en");
  });
});
