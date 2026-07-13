import { describe, expect, it } from "vitest";
import { GAME_THEMES } from "../logic/themes";
import { SURFACE_PHYSICS, physicsProfileOf } from "./physics-profiles";

describe("production item physics profiles", () => {
  it("gives every one of the 54 theme objects an explicit positive-mass collider", () => {
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const profile = physicsProfileOf(theme.id, kind);
        expect(profile.mass, `${theme.id}/${kind} mass`).toBeGreaterThan(0);
        expect(profile.visualScale, `${theme.id}/${kind} visual scale`).toBeGreaterThan(0.5);
        expect(profile.sizeMultiplier, `${theme.id}/${kind} size multiplier`).toBeGreaterThanOrEqual(0.7);
        expect(profile.sizeMultiplier, `${theme.id}/${kind} size multiplier`).toBeLessThanOrEqual(1.2);
        expect(profile.shapes.length, `${theme.id}/${kind} collider count`).toBeGreaterThan(0);
        expect(SURFACE_PHYSICS[profile.surface]).toBeDefined();
      }
    }
  });

  it("varies mass, friction families and compound geometry inside each theme", () => {
    for (const theme of GAME_THEMES) {
      const profiles = theme.items.map((_, kind) => physicsProfileOf(theme.id, kind));
      const masses = profiles.map((profile) => profile.mass);
      const scales = profiles.map((profile) => profile.visualScale);
      expect(Math.max(...masses) - Math.min(...masses), `${theme.id} mass range`).toBeGreaterThan(0.45);
      expect(Math.max(...scales) - Math.min(...scales), `${theme.id} visible size range`).toBeGreaterThan(0.44);
      expect(scales.filter((scale) => scale < 0.8).length, `${theme.id} small objects`).toBeGreaterThanOrEqual(2);
      expect(scales.filter((scale) => scale > 1.05).length, `${theme.id} large objects`).toBeGreaterThanOrEqual(2);
      expect(new Set(profiles.map((profile) => profile.surface)).size, `${theme.id} surface variety`).toBeGreaterThanOrEqual(4);
      expect(profiles.some((profile) => profile.shapes.length > 1), `${theme.id} compound colliders`).toBe(true);
    }
  });

  it("keeps bounce and friction inside stable mobile-pile bounds", () => {
    for (const values of Object.values(SURFACE_PHYSICS)) {
      expect(values.friction).toBeGreaterThanOrEqual(0.18);
      expect(values.friction).toBeLessThanOrEqual(0.8);
      expect(values.restitution).toBeGreaterThanOrEqual(0);
      expect(values.restitution).toBeLessThanOrEqual(0.2);
    }
  });
});
