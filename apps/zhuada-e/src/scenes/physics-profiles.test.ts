import { describe, expect, it } from "vitest";
import { GAME_THEMES } from "../logic/themes";
import { SURFACE_PHYSICS, physicsProfileOf } from "./physics-profiles";

describe("production item physics profiles", () => {
  it("gives every one of the 162 theme identities an explicit positive-mass collider", () => {
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const profile = physicsProfileOf(theme.id, kind);
        expect(profile.mass, `${theme.id}/${kind} mass`).toBeGreaterThan(0);
        expect(profile.visualScale, `${theme.id}/${kind} visual scale`).toBeGreaterThan(0.5);
        expect(profile.sizeMultiplier, `${theme.id}/${kind} size multiplier`).toBeGreaterThanOrEqual(0.62);
        expect(profile.sizeMultiplier, `${theme.id}/${kind} size multiplier`).toBeLessThanOrEqual(1.24);
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
      const colliderScales = profiles.map((profile) => profile.sizeMultiplier);
      expect(Math.max(...masses) - Math.min(...masses), `${theme.id} mass range`).toBeGreaterThan(0.45);
      expect(Math.max(...scales) - Math.min(...scales), `${theme.id} visible size range`).toBeGreaterThan(0.44);
      expect(Math.max(...scales) / Math.min(...scales), `${theme.id} visible size ratio`).toBeGreaterThan(2);
      expect(Math.max(...colliderScales) / Math.min(...colliderScales), `${theme.id} collider size ratio`).toBeGreaterThan(1.8);
      expect(scales.filter((scale) => scale < 0.8).length, `${theme.id} small objects`).toBeGreaterThanOrEqual(5);
      expect(scales.filter((scale) => scale > 1.05).length, `${theme.id} large objects`).toBeGreaterThanOrEqual(2);
      expect(new Set(profiles.map((profile) => profile.surface)).size, `${theme.id} surface variety`).toBeGreaterThanOrEqual(4);
      expect(profiles.some((profile) => profile.shapes.length > 1), `${theme.id} compound colliders`).toBe(true);
    }
  });

  it("keeps each three-treatment family physically readable without painted markers", () => {
    for (const theme of GAME_THEMES) {
      for (let baseKind = 0; baseKind < 18; baseKind += 1) {
        const scales = [baseKind, baseKind + 18, baseKind + 36]
          .map((kind) => physicsProfileOf(theme.id, kind).sizeMultiplier);
        expect(new Set(scales).size, `${theme.id}/${baseKind} size family`).toBeGreaterThanOrEqual(2);
      }
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

  it("matches the opening night-market colliders to the round lantern and necked bottle", () => {
    const lantern = physicsProfileOf("night-market", 0);
    expect(lantern.shapes.map((shape) => shape.kind)).toEqual(["sphere", "cylinder"]);

    const bottle = physicsProfileOf("night-market", 2);
    expect(bottle.surface).toBe("glaze");
    expect(bottle.shapes).toHaveLength(2);
    expect(bottle.shapes.every((shape) => shape.kind === "cylinder")).toBe(true);
  });
});
