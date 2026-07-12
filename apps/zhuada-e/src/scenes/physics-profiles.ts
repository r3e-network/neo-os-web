import type { GameThemeId } from "../logic/themes";

export type PhysicsSurface = "produce" | "ceramic" | "metal" | "wood" | "fabric" | "paper" | "glaze";

export type CollisionShapeSpec =
  | { kind: "sphere"; radius: number; offset?: readonly [number, number, number] }
  | { kind: "box"; half: readonly [number, number, number]; offset?: readonly [number, number, number]; rotation?: readonly [number, number, number] }
  | { kind: "cylinder"; radiusTop: number; radiusBottom: number; height: number; offset?: readonly [number, number, number]; rotation?: readonly [number, number, number] };

export interface ItemPhysicsProfile {
  mass: number;
  surface: PhysicsSurface;
  visualScale: number;
  linearDamping: number;
  angularDamping: number;
  sleepSpeedLimit: number;
  sleepTimeLimit: number;
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
): ItemPhysicsProfile {
  return {
    mass,
    surface,
    visualScale,
    linearDamping: damping[0],
    angularDamping: damping[1],
    sleepSpeedLimit: 0.13,
    sleepTimeLimit: 0.72,
    shapes,
  };
}

const FRESH: readonly ItemPhysicsProfile[] = [
  profile(0.62, "produce", 0.9, [sphere(0.64)]),
  profile(0.58, "produce", 0.88, [sphere(0.62)]),
  profile(0.5, "produce", 0.92, [sphere(0.46, [-0.22, 0, 0]), sphere(0.4, [0.27, 0, 0])]),
  profile(0.36, "produce", 0.86, [sphere(0.58, [0, 0.2, 0]), cylinder(0.29, 0.72, [0, -0.36, 0])]),
  profile(0.82, "paper", 1.08, [box([0.64, 0.24, 0.25]), sphere(0.25, [-0.62, 0, 0]), sphere(0.25, [0.62, 0, 0])]),
  profile(0.68, "ceramic", 0.92, [cylinder(0.48, 0.72), box([0.2, 0.27, 0.14], [0.49, 0, 0])]),
  profile(0.68, "metal", 0.66, [box([0.4, 0.4, 0.3])], [0.06, 0.1]),
  profile(0.38, "wood", 0.76, [box([0.54, 0.21, 0.29])]),
  profile(0.3, "paper", 0.98, [box([0.52, 0.26, 0.28]), sphere(0.24, [-0.53, 0, 0]), sphere(0.24, [0.53, 0, 0])]),
  profile(0.54, "produce", 0.9, [sphere(0.55, [0, -0.17, 0]), sphere(0.36, [0, 0.33, 0])]),
  profile(0.43, "glaze", 0.95, Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return sphere(0.24, [Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42]);
  })),
  profile(0.48, "produce", 0.84, [sphere(0.57)]),
];

const FARM: readonly ItemPhysicsProfile[] = [
  profile(1.12, "metal", 1.02, [sphere(0.56), box([0.2, 0.2, 0.34], [-0.58, 0.12, 0])]),
  profile(0.78, "ceramic", 0.94, [cylinder(0.42, 1.02)]),
  profile(0.62, "ceramic", 0.96, [cylinder(0.62, 0.44)]),
  profile(0.42, "paper", 0.96, [sphere(0.58)], [0.11, 0.2]),
  profile(0.92, "glaze", 0.9, [cylinder(0.48, 0.82)]),
  profile(0.26, "wood", 1.02, [box([0.68, 0.12, 0.14]), sphere(0.24, [-0.6, 0, 0])]),
  profile(0.84, "produce", 1.02, [sphere(0.7)], [0.1, 0.18]),
  profile(0.24, "fabric", 1.04, [box([0.58, 0.16, 0.56]), sphere(0.28, [0.45, 0.16, 0])], [0.15, 0.28]),
  profile(0.48, "wood", 1, [cylinder(0.27, 0.88), box([0.65, 0.1, 0.14], [0, 0.35, 0])]),
  profile(0.8, "ceramic", 0.98, [cylinder(0.51, 0.9), box([0.19, 0.3, 0.15], [0.5, 0.06, 0])]),
  profile(0.32, "paper", 0.9, [cylinder(0.56, 0.24)], [0.14, 0.26]),
  profile(0.72, "ceramic", 0.9, [cylinder(0.47, 0.72), box([0.18, 0.27, 0.14], [0.48, 0, 0])]),
];

const NIGHT: readonly ItemPhysicsProfile[] = [
  profile(0.44, "paper", 1.02, [cylinder(0.48, 0.9)], [0.12, 0.2]),
  profile(0.36, "paper", 0.88, [sphere(0.6)], [0.13, 0.22]),
  profile(0.76, "metal", 0.92, [cylinder(0.43, 0.98)], [0.05, 0.1]),
  profile(0.54, "paper", 0.94, [cylinder(0.58, 0.38)], [0.13, 0.24]),
  profile(0.48, "glaze", 1.12, [sphere(0.3, [0, -0.46, 0]), sphere(0.3), sphere(0.3, [0, 0.46, 0])], [0.08, 0.11]),
  profile(0.92, "wood", 0.98, [cylinder(0.55, 0.72)], [0.08, 0.13]),
  profile(0.5, "wood", 0.92, [cylinder(0.46, 0.82)], [0.12, 0.2]),
  profile(0.42, "paper", 0.9, [box([0.53, 0.53, 0.53], undefined, [0, Math.PI / 4, Math.PI / 4])], [0.12, 0.24]),
  profile(0.32, "paper", 1.04, [box([0.72, 0.18, 0.38])], [0.1, 0.18]),
  profile(0.68, "ceramic", 0.96, [cylinder(0.62, 0.43)]),
  profile(0.86, "metal", 0.92, [cylinder(0.54, 0.72, undefined, undefined, 0.18)]),
  profile(0.78, "metal", 0.98, [box([0.58, 0.42, 0.48])], [0.06, 0.11]),
];

const PROFILES: Record<GameThemeId, readonly ItemPhysicsProfile[]> = {
  "fresh-market": FRESH,
  "farm-kitchen": FARM,
  "night-market": NIGHT,
};

export function physicsProfileOf(themeId: GameThemeId, kind: number): ItemPhysicsProfile {
  const profiles = PROFILES[themeId] ?? FRESH;
  const safeKind = Math.max(0, Math.min(profiles.length - 1, Math.floor(kind)));
  return profiles[safeKind] ?? FRESH[0]!;
}
