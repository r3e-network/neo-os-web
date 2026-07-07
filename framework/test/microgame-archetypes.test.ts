import { describe, expect, it } from "vitest";
import {
  MICROGAME_ARCHETYPES,
  microgameArchetypeById,
  recommendedMicrogameArchetypes,
  validateMicrogameArchetype,
} from "../gamefi";

describe("GameFi microgame archetypes", () => {
  it("tracks the short-session challenge formats we want to turn into GameFi games", () => {
    expect(microgameArchetypeById("white-tile-rush")?.familiarPattern).toContain(
      "Don't Tap The White Tile",
    );
    expect(microgameArchetypeById("ten-second-stand")?.familiarPattern).toContain(
      "survival",
    );
    expect(microgameArchetypeById("piano-sprint")?.familiarPattern).toContain(
      "piano tile",
    );
    expect(microgameArchetypeById("traffic-dash")?.coreVerb).toBe("swipe");
    expect(microgameArchetypeById("memory-chain")?.verification).toContain("Replay");
    expect(microgameArchetypeById("jump-rope-rush")?.assetDirection).toContain(
      "Character poses",
    );
    expect(microgameArchetypeById("timber-chop")?.familiarPattern).toContain(
      "tree chopping",
    );
    expect(microgameArchetypeById("fruit-slice-sprint")?.coreVerb).toBe("swipe");
    expect(microgameArchetypeById("brick-blitz")?.familiarPattern).toContain(
      "brick breaker",
    );
    expect(microgameArchetypeById("lock-pin-timing")?.verification).toContain(
      "Replay",
    );
  });

  it("recommends high-fit candidates first", () => {
    const recommended = recommendedMicrogameArchetypes(4);

    expect(recommended).toHaveLength(4);
    expect(recommended.every((candidate) => candidate.gamefiFit === "high")).toBe(true);
    expect(recommended.map((candidate) => candidate.id)).toEqual([
      "white-tile-rush",
      "ten-second-stand",
      "stack-tower",
      "knife-timing",
    ]);
  });

  it("keeps every archetype game-first, verifiable, and anti-abuse aware", () => {
    expect(MICROGAME_ARCHETYPES.length).toBeGreaterThanOrEqual(14);

    for (const candidate of MICROGAME_ARCHETYPES) {
      expect(validateMicrogameArchetype(candidate), candidate.id).toEqual([]);
      expect(candidate.verification, candidate.id).toMatch(/Replay|Verify/);
      expect(candidate.assetDirection, candidate.id).not.toMatch(/placeholder|emoji|svg/i);
      expect(candidate.playSurface, candidate.id).not.toMatch(/form|questionnaire/i);
      expect(candidate.controlModel, candidate.id).not.toMatch(/textarea|select/i);
      expect(candidate.modeTemplates.length, candidate.id).toBeGreaterThan(0);
      expect(candidate.modeTemplates.every((mode) => Number(mode.entryGas) > 0)).toBe(true);
      expect(candidate.modeTemplates.every((mode) => Number(mode.rewardGas) > 0)).toBe(true);
    }
  });
});
