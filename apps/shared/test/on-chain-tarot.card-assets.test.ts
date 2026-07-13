import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

const cardsDir = path.join(repoRoot(), "apps/on-chain-tarot/public/cards");
const tarotDataFile = path.join(
  repoRoot(),
  "apps/on-chain-tarot/src/data/tarot-data.ts",
);
const generatorFile = path.join(
  repoRoot(),
  "apps/on-chain-tarot/scripts/generate-neo-tarot-deck.mjs",
);
const cardBackSourceFile = path.join(
  repoRoot(),
  "apps/on-chain-tarot/scripts/assets/neo-tarot-card-back.png",
);
const cardFrontFrameSourceFile = path.join(
  repoRoot(),
  "apps/on-chain-tarot/scripts/assets/neo-tarot-card-front-frame.png",
);

function isJpeg(file: string): boolean {
  const bytes = readFileSync(file);
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

function isPng(file: string): boolean {
  const bytes = readFileSync(file);
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isWebp(file: string): boolean {
  const bytes = readFileSync(file);
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

describe("On-Chain Tarot card assets", () => {
  it("ships a complete real-image 78-card deck plus a matching back", () => {
    const index = JSON.parse(
      readFileSync(path.join(cardsDir, "index.json"), "utf8"),
    ) as Array<{
      id: number;
      image: string;
      name: string;
      suit: string;
      source: string;
      license: string;
      style: string;
    }>;

    expect(index).toHaveLength(78);
    expect(new Set(index.map((card) => card.id)).size).toBe(78);
    expect(existsSync(path.join(cardsDir, "back.webp"))).toBe(true);
    expect(isWebp(path.join(cardsDir, "back.webp"))).toBe(true);
    // The P3 redesign replaced the heavy photographic back with a deliberately
    // light, programmatically generated back (scripts/generate-card-back.mjs:
    // SVG -> sharp -> WebP, original artwork, still 825x1425 — verified valid
    // WebP with correct portrait dimensions). It is ~32KB rather than ~289KB.
    // The floor now only guards against an empty/placeholder/corrupt asset
    // rather than pinning the old heavy-art byte weight.
    expect(statSync(path.join(cardsDir, "back.webp")).size).toBeGreaterThan(8_000);

    for (const card of index) {
      expect(card.image).toMatch(/^\.\/cards\/\d{2}-[a-z0-9-]+\.webp$/);
      expect(card.source).toContain("metabismuth/tarot-json");
      expect(card.license).toContain("Rider-Waite-Smith");
      expect(card.style).toBe("Neo Tarot illuminated Art Nouveau card with integrated Rider-Waite-Smith oracle panel");
      const file = path.join(cardsDir, path.basename(card.image));
      expect(existsSync(file), `${card.name} is missing its card image`).toBe(true);
      expect(isWebp(file), `${card.name} must be a valid WebP`).toBe(true);
      expect(statSync(file).size, `${card.name} image is unexpectedly tiny`).toBeGreaterThan(150_000);
    }
  });

  it("uses Neo-framed Rider-Waite-Smith card files instead of procedural SVG cards", () => {
    const files = readdirSync(cardsDir);
    const webpFiles = files.filter((file) => file.endsWith(".webp"));

    expect(webpFiles).toHaveLength(79);
    expect(files.filter((file) => file.endsWith(".svg"))).toHaveLength(0);

    expect(existsSync(cardBackSourceFile)).toBe(true);
    expect(isPng(cardBackSourceFile)).toBe(true);
    expect(statSync(cardBackSourceFile).size).toBeGreaterThan(2_500_000);
    expect(existsSync(cardFrontFrameSourceFile)).toBe(true);
    expect(isPng(cardFrontFrameSourceFile)).toBe(true);
    expect(statSync(cardFrontFrameSourceFile).size).toBeGreaterThan(2_000_000);

    const tarotData = readFileSync(tarotDataFile, "utf8");
    expect(tarotData).toContain('export const TAROT_CARD_BACK = "./cards/back.webp"');
    expect(tarotData).not.toContain(".svg");

    const generator = readFileSync(generatorFile, "utf8");
    expect(generator).toContain("assets/neo-tarot-card-back.png");
    expect(generator).toContain("assets/neo-tarot-card-front-frame.png");
    expect(generator).toContain("generateNeoCardBack");
    expect(generator).toContain("SOURCE_ART_CROP");
    expect(generator).toContain("buildArtPanelBackingSvg");
    expect(generator).toContain("buildArtTreatmentSvg");
    expect(generator).toContain("CARD_ART_RADIUS");
    expect(generator).not.toContain("buildNeoCardFrontSvg");

    const attribution = readFileSync(path.join(cardsDir, "ATTRIBUTION.md"), "utf8");
    expect(attribution).toContain("metabismuth/tarot-json");
    expect(attribution).toContain("Rider-Waite-Smith");
    expect(attribution).toContain("neo-tarot-card-front-frame.png");
    expect(attribution).toContain("cropped to remove the original title strip and outer scan border");
    expect(attribution).toContain("dark jade and antique-gold Art Nouveau Neo N3 card background");
    expect(attribution).toContain("integrated parchment oracle panel");
    expect(attribution).toContain("soft rounded masking");
    expect(attribution).toContain("warm vintage grading");
    expect(attribution).toContain("inner gold rules");
    expect(attribution).toContain("sun and moon medallions");
    expect(attribution).toContain("Neo cube crest");
    expect(attribution).toContain("original Neo Tarot artwork");
    expect(attribution).toContain("neo-tarot-card-back.png");
    expect(attribution).toContain("dark jade illustrated tarot back");
    expect(attribution).toContain("antique gold foil");
    expect(attribution).toContain("integrated Neo/N3 cube crest");
    expect(attribution).toContain("sun and moon oracle medallions");
    expect(attribution).toContain("node constellations");
    expect(attribution).toContain("woven into ornament");
  });
});
