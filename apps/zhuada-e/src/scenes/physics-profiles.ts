import { themeItem, type GameThemeId } from "../logic/themes";

export type PhysicsSurface = "produce" | "ceramic" | "metal" | "wood" | "fabric" | "paper" | "glaze";

export type CollisionShapeSpec =
  | { kind: "sphere"; radius: number; offset?: readonly [number, number, number] }
  | { kind: "box"; half: readonly [number, number, number]; offset?: readonly [number, number, number]; rotation?: readonly [number, number, number] }
  | { kind: "cylinder"; radiusTop: number; radiusBottom: number; height: number; offset?: readonly [number, number, number]; rotation?: readonly [number, number, number] };

export interface ItemPhysicsProfile {
  mass: number;
  surface: PhysicsSurface;
  visualScale: number;
  /** Shared visual/collider size multiplier; keeps big and small objects honest. */
  sizeMultiplier: number;
  linearDamping: number;
  angularDamping: number;
  sleepSpeedLimit: number;
  sleepTimeLimit: number;
  /**
   * Open cookware and lidded vessels have a semantically authored top. When a
   * nearly sleeping body exposes its sealed underside to the overhead camera,
   * the pile may apply a restrained physical roll back toward this top face.
   */
  readableRest?: "upright";
  shapes: readonly CollisionShapeSpec[];
}

export interface SurfacePhysics {
  friction: number;
  restitution: number;
}

export const SURFACE_PHYSICS: Record<PhysicsSurface, SurfacePhysics> = {
  produce: { friction: 0.46, restitution: 0.1 },
  ceramic: { friction: 0.29, restitution: 0.06 },
  metal: { friction: 0.2, restitution: 0.13 },
  wood: { friction: 0.58, restitution: 0.045 },
  fabric: { friction: 0.76, restitution: 0.025 },
  paper: { friction: 0.62, restitution: 0.035 },
  glaze: { friction: 0.24, restitution: 0.17 },
};

const sphere = (radius: number, offset?: readonly [number, number, number]): CollisionShapeSpec => ({ kind: "sphere", radius, offset });
const box = (
  half: readonly [number, number, number],
  offset?: readonly [number, number, number],
  rotation?: readonly [number, number, number],
): CollisionShapeSpec => ({ kind: "box", half, offset, rotation });
const cylinder = (
  radius: number,
  height: number,
  offset?: readonly [number, number, number],
  rotation?: readonly [number, number, number],
  radiusTop = radius,
): CollisionShapeSpec => ({ kind: "cylinder", radiusTop, radiusBottom: radius, height, offset, rotation });

function profile(
  mass: number,
  surface: PhysicsSurface,
  visualScale: number,
  shapes: readonly CollisionShapeSpec[],
  damping: readonly [linear: number, angular: number] = [0.08, 0.12],
  sizeMultiplier = 1,
): ItemPhysicsProfile {
  // The reference pile reads because a tiny garnish, a medium bowl and a
  // substantial pan do not collapse into one uniform footprint. Keep the
  // extremes conservative enough for the shallow container, but allow a
  // genuine ~2x diameter spectrum (and scale the collider with the model).
  const safeSize = Math.max(0.62, Math.min(1.24, sizeMultiplier));
  return {
    // Area-weighted mass keeps larger objects substantial without making the
    // heaviest pieces impossible for the capped shake impulse to disturb.
    mass: Number((mass * safeSize * safeSize).toFixed(3)),
    surface,
    visualScale: Number((visualScale * safeSize).toFixed(3)),
    sizeMultiplier: safeSize,
    linearDamping: damping[0],
    angularDamping: damping[1],
    sleepSpeedLimit: 0.13,
    sleepTimeLimit: 0.72,
    shapes,
  };
}

function upright(profileValue: ItemPhysicsProfile): ItemPhysicsProfile {
  return { ...profileValue, readableRest: "upright" };
}

const FRESH: readonly ItemPhysicsProfile[] = [
  profile(0.62, "produce", 0.9, [sphere(0.64)], undefined, 1.22),
  profile(0.58, "produce", 0.88, [sphere(0.62)], undefined, 0.86),
  profile(0.5, "produce", 0.92, [sphere(0.46, [-0.22, 0, 0]), sphere(0.4, [0.27, 0, 0])], undefined, 0.68),
  profile(0.36, "produce", 0.86, [sphere(0.58, [0, 0.2, 0]), cylinder(0.29, 0.72, [0, -0.36, 0])], undefined, 0.88),
  profile(0.82, "paper", 1.08, [box([0.64, 0.24, 0.25]), sphere(0.25, [-0.62, 0, 0]), sphere(0.25, [0.62, 0, 0])], undefined, 1.2),
  profile(0.68, "ceramic", 0.92, [cylinder(0.48, 0.72), box([0.2, 0.27, 0.14], [0.49, 0, 0])], undefined, 0.78),
  profile(0.68, "metal", 0.66, [box([0.4, 0.4, 0.3])], [0.06, 0.1], 0.82),
  profile(0.38, "wood", 0.76, [box([0.54, 0.21, 0.29])], undefined, 1.08),
  profile(0.3, "paper", 0.98, [box([0.52, 0.26, 0.28]), sphere(0.24, [-0.53, 0, 0]), sphere(0.24, [0.53, 0, 0])], undefined, 0.62),
  profile(0.54, "produce", 0.9, [sphere(0.55, [0, -0.17, 0]), sphere(0.36, [0, 0.33, 0])], undefined, 1.18),
  profile(0.43, "glaze", 0.95, Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return sphere(0.24, [Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42]);
  }), undefined, 1),
  profile(0.48, "produce", 0.84, [sphere(0.57)], undefined, 0.68),
  profile(0.46, "produce", 0.94, [sphere(0.42), sphere(0.26, [0.28, 0.16, 0]), sphere(0.26, [-0.28, 0.16, 0])], undefined, 0.78),
  profile(0.64, "produce", 1.04, [box([0.62, 0.22, 0.42])], undefined, 1.22),
  profile(0.72, "glaze", 0.94, [cylinder(0.46, 0.78)], undefined, 0.8),
  profile(0.58, "paper", 0.98, [box([0.62, 0.28, 0.46])], undefined, 1.12),
  profile(0.68, "ceramic", 1.02, [cylinder(0.5, 0.8), sphere(0.36, [0, 0.55, 0])], undefined, 0.9),
  profile(0.62, "paper", 1, [box([0.48, 0.68, 0.34])], undefined, 0.82),
];

const FARM: readonly ItemPhysicsProfile[] = [
  upright(profile(1.12, "metal", 1.02, [sphere(0.56), box([0.2, 0.2, 0.34], [-0.58, 0.12, 0])], undefined, 1.16)),
  profile(0.78, "ceramic", 0.94, [cylinder(0.42, 1.02)], undefined, 0.84),
  upright(profile(0.62, "ceramic", 0.96, [cylinder(0.62, 0.44)], undefined, 0.92)),
  profile(0.42, "paper", 0.96, [sphere(0.58)], [0.11, 0.2], 0.7),
  profile(0.92, "glaze", 0.9, [cylinder(0.48, 0.82)], undefined, 0.8),
  profile(0.26, "wood", 1.02, [box([0.68, 0.12, 0.14]), sphere(0.24, [-0.6, 0, 0])], undefined, 0.62),
  profile(0.84, "produce", 1.02, [sphere(0.7)], [0.1, 0.18], 1.22),
  profile(0.24, "fabric", 1.04, [box([0.58, 0.16, 0.56]), sphere(0.28, [0.45, 0.16, 0])], [0.15, 0.28], 0.86),
  profile(0.48, "wood", 1, [cylinder(0.27, 0.88), box([0.65, 0.1, 0.14], [0, 0.35, 0])], undefined, 0.74),
  profile(0.8, "ceramic", 0.98, [cylinder(0.51, 0.9), box([0.19, 0.3, 0.15], [0.5, 0.06, 0])], undefined, 0.9),
  profile(0.32, "paper", 0.9, [cylinder(0.56, 0.24)], [0.14, 0.26], 0.62),
  upright(profile(0.72, "ceramic", 0.9, [cylinder(0.47, 0.72), box([0.18, 0.27, 0.14], [0.48, 0, 0])], undefined, 0.72)),
  profile(0.62, "wood", 1.08, [cylinder(0.22, 1.25, undefined, [0, 0, Math.PI / 2])], undefined, 1.2),
  upright(profile(1.05, "metal", 1.08, [cylinder(0.62, 0.55), box([0.72, 0.12, 0.18], [0, 0.12, 0])], undefined, 1.18)),
  profile(0.72, "paper", 1.06, [box([0.68, 0.38, 0.45])], undefined, 0.92),
  profile(0.74, "ceramic", 0.96, [cylinder(0.5, 0.62)], undefined, 0.74),
  profile(0.58, "wood", 1.04, [sphere(0.48, [0, -0.12, 0]), sphere(0.3, [0, 0.42, 0])], undefined, 0.82),
  profile(0.34, "fabric", 0.92, [sphere(0.62)], [0.16, 0.3], 0.68),
];

const NIGHT: readonly ItemPhysicsProfile[] = [
  profile(0.44, "paper", 1.02, [sphere(0.6), cylinder(0.2, 0.36, [0, 0.52, 0])], [0.12, 0.2], 1.16),
  profile(0.36, "paper", 0.88, [sphere(0.6)], [0.13, 0.22], 0.66),
  profile(0.76, "glaze", 0.92, [
    cylinder(0.43, 0.94, [0, -0.12, 0]),
    cylinder(0.23, 0.42, [0, 0.52, 0]),
  ], [0.05, 0.1], 0.78),
  profile(0.54, "paper", 0.94, [cylinder(0.58, 0.38)], [0.13, 0.24], 0.72),
  profile(0.48, "glaze", 1.12, [sphere(0.3, [0, -0.46, 0]), sphere(0.3), sphere(0.3, [0, 0.46, 0])], [0.08, 0.11], 1.22),
  profile(0.92, "wood", 0.98, [cylinder(0.55, 0.72)], [0.08, 0.13], 1.06),
  profile(0.5, "wood", 0.92, [cylinder(0.46, 0.82)], [0.12, 0.2], 0.7),
  profile(0.42, "paper", 0.9, [box([0.53, 0.53, 0.53], undefined, [0, Math.PI / 4, Math.PI / 4])], [0.12, 0.24], 0.88),
  profile(0.32, "paper", 1.04, [box([0.72, 0.18, 0.38])], [0.1, 0.18], 1.18),
  profile(0.68, "ceramic", 0.96, [cylinder(0.62, 0.43)], undefined, 0.8),
  profile(0.86, "metal", 0.92, [cylinder(0.54, 0.72, undefined, undefined, 0.18)], undefined, 0.76),
  profile(0.78, "metal", 0.98, [box([0.58, 0.42, 0.48])], [0.06, 0.11], 1.16),
  profile(0.82, "ceramic", 1.04, [sphere(0.52), box([0.22, 0.16, 0.28], [-0.56, 0.08, 0])], undefined, 1.08),
  profile(0.28, "paper", 1.08, [box([0.72, 0.08, 0.52])], [0.14, 0.28], 1.22),
  profile(0.56, "ceramic", 1.02, [sphere(0.46, [0, -0.12, 0]), sphere(0.32, [0, 0.42, 0])], undefined, 0.72),
  profile(0.72, "ceramic", 1.06, [cylinder(0.68, 0.42)], undefined, 1.08),
  profile(0.38, "paper", 0.98, [sphere(0.56)], [0.12, 0.22], 0.76),
  profile(0.66, "ceramic", 0.94, [box([0.5, 0.64, 0.22])], undefined, 0.82),
];

const PROFILES: Record<GameThemeId, readonly ItemPhysicsProfile[]> = {
  "fresh-market": FRESH,
  "farm-kitchen": FARM,
  "night-market": NIGHT,
};

export function physicsProfileOf(themeId: GameThemeId, kind: number): ItemPhysicsProfile {
  const profiles = PROFILES[themeId] ?? FRESH;
  const logicalKind = Math.max(0, Math.floor(kind));
  const item = themeItem(themeId, logicalKind);
  const authoredKind = item.modelKind ?? logicalKind;
  const safeKind = Math.max(0, Math.min(profiles.length - 1, authoredKind));
  const base = profiles[safeKind] ?? FRESH[0]!;
  // Each colourway is also a real size tier: compact, authored base, and
  // substantial. The collider, mass and visual scale use the same factor, so
  // a small/large variant never floats outside its physical body.
  const variantFactor = item.variantIndex === 1 ? 0.94 : item.variantIndex === 2 ? 1.16 : 1;
  if (variantFactor === 1) return base;
  const sizeMultiplier = Math.max(0.62, Math.min(1.24, base.sizeMultiplier * variantFactor));
  const ratio = sizeMultiplier / base.sizeMultiplier;
  return {
    ...base,
    mass: Number((base.mass * ratio * ratio).toFixed(3)),
    visualScale: Number((base.visualScale * ratio).toFixed(3)),
    sizeMultiplier,
  };
}
