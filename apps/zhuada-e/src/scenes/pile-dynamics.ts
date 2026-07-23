import { Body, Vec3, type Body as CannonBody } from "cannon-es";
import type { ItemPhysicsProfile } from "./physics-profiles";

const LOCAL_UP = new Vec3(0, 1, 0);
const worldAxis = new Vec3();
const SIDE_REST_TIP_SPEED = 0.48;
const SUPPORT_WAKE_MARGIN = 0.42;
const SUPPORT_BELOW_MARGIN = 0.24;

export interface LivePileBody {
  body: CannonBody;
  profile: ItemPhysicsProfile;
  seed: number;
}

/**
 * Approximate the authored collider's local extents. Models whose longest
 * dimension is local Y should normally lie on their side in a crowded top-view
 * pile; leaving them perfectly upright hides their silhouette and makes the
 * pile look artificially arranged.
 */
export function prefersSideRest(profile: ItemPhysicsProfile): boolean {
  let xExtent = 0;
  let yExtent = 0;
  let zExtent = 0;

  for (const shape of profile.shapes) {
    const [ox, oy, oz] = shape.offset ?? [0, 0, 0];
    if (shape.kind === "sphere") {
      xExtent = Math.max(xExtent, Math.abs(ox) + shape.radius);
      yExtent = Math.max(yExtent, Math.abs(oy) + shape.radius);
      zExtent = Math.max(zExtent, Math.abs(oz) + shape.radius);
    } else if (shape.kind === "box") {
      xExtent = Math.max(xExtent, Math.abs(ox) + shape.half[0]);
      yExtent = Math.max(yExtent, Math.abs(oy) + shape.half[1]);
      zExtent = Math.max(zExtent, Math.abs(oz) + shape.half[2]);
    } else {
      const radius = Math.max(shape.radiusTop, shape.radiusBottom);
      xExtent = Math.max(xExtent, Math.abs(ox) + radius);
      yExtent = Math.max(yExtent, Math.abs(oy) + shape.height / 2);
      zExtent = Math.max(zExtent, Math.abs(oz) + radius);
    }
  }

  return yExtent > Math.max(xExtent, zExtent) * 1.04;
}

/**
 * Stable spawn rotation derived from the run seed. Tall cans, bottles and
 * skewers start mostly side-on instead of occasionally landing balanced on a
 * tiny end cap; round and squat items retain the fully random tumble.
 */
export function initialPileEuler(
  profile: ItemPhysicsProfile,
  unitX: number,
  unitY: number,
  unitZ: number,
): readonly [x: number, y: number, z: number] {
  if (!prefersSideRest(profile)) {
    return [unitX * Math.PI, unitY * Math.PI, unitZ * Math.PI];
  }
  return [
    Math.PI / 2 + (unitX - 0.5) * 0.42,
    unitY * Math.PI * 2,
    (unitZ - 0.5) * 0.24,
  ];
}

/**
 * Removing a body does not wake Cannon bodies that were sleeping on top of it.
 * Re-activate the nearby support column so gravity and contacts can rebuild the
 * changed chain without making the complete basket tremble on every pick.
 * Upright elongated pieces receive a tiny deterministic tip; this only breaks
 * an implausibly perfect end-cap balance and never launches a body or overrides
 * the solver.
 */
export function resettlePileAfterSupportRemoval(
  bodies: Iterable<LivePileBody>,
  removedBody: CannonBody,
): { woken: number; tipped: number } {
  let woken = 0;
  let tipped = 0;

  for (const entry of bodies) {
    const { body, profile, seed } = entry;
    if (body === removedBody || body.mass <= 0 || body.world == null) continue;

    // Waking every body after every tap makes the whole basket shiver and
    // spends solver work on objects whose support chain did not change. A
    // removed body's bounding sphere is deliberately conservative: nearby
    // sleepers above (or just beside) the gap wake and gravity propagates the
    // contact change through the real pile, while distant settled clusters
    // remain visually still.
    const dx = body.position.x - removedBody.position.x;
    const dz = body.position.z - removedBody.position.z;
    const dy = body.position.y - removedBody.position.y;
    const wakeRadius = Math.max(0.24, body.boundingRadius)
      + Math.max(0.24, removedBody.boundingRadius)
      + SUPPORT_WAKE_MARGIN;
    if (dy < -SUPPORT_BELOW_MARGIN || dx * dx + dz * dz > wakeRadius * wakeRadius) continue;

    if (body.sleepState !== Body.AWAKE) woken += 1;
    body.wakeUp();

    if (tipUprightSideRestBody(body, profile, seed)) tipped += 1;
  }

  return { woken, tipped };
}

/**
 * A freshly streamed can can occasionally land perfectly on its cap after the
 * previous extraction has already settled. Check this again only when Cannon
 * wants to put the body to sleep, keeping normal tumbling solver-driven while
 * preventing a long object from freezing end-on indefinitely.
 */
export function tipUprightSideRestBody(
  body: CannonBody,
  profile: ItemPhysicsProfile,
  seed: number,
): boolean {
  if (!prefersSideRest(profile) || body.mass <= 0 || body.world == null) return false;
  body.quaternion.vmult(LOCAL_UP, worldAxis);
  // Past roughly 34° from the floor the top cap dominates the top-view
  // silhouette and the object reads as "standing" rather than lying in a pile.
  if (Math.abs(worldAxis.y) < 0.56) return false;

  const angle = ((seed + 1) * 2.399963229728653) % (Math.PI * 2);
  body.angularVelocity.x += Math.cos(angle) * SIDE_REST_TIP_SPEED;
  body.angularVelocity.z += Math.sin(angle) * SIDE_REST_TIP_SPEED;
  body.wakeUp();
  return true;
}
