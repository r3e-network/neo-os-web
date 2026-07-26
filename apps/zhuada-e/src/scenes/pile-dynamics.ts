import { Body, Vec3, type Body as CannonBody } from "cannon-es";
import type { ItemPhysicsProfile } from "./physics-profiles";

const LOCAL_UP = new Vec3(0, 1, 0);
const worldAxis = new Vec3();
const faceCorrectionAxis = new Vec3();
const SIDE_REST_TIP_SPEED = 0.48;
/**
 * Proportional gain for face/upright corrections. The actual angular velocity
 * applied is `gain * errorAngle`, clamped to the max speed. This prevents the
 * old constant-speed approach from overshooting on small errors and
 * oscillating every frame.
 */
const FACE_REST_PROPORTIONAL_GAIN = 2.4;
const FACE_REST_MAX_SPEED = 0.42;
const UPRIGHT_REST_PROPORTIONAL_GAIN = 2.2;
const UPRIGHT_REST_MAX_SPEED = 0.38;
const SUPPORT_WAKE_MARGIN = 0.42;
const SUPPORT_BELOW_MARGIN = 0.24;
/**
 * Minimum interval (ms) between settle corrections for the same body.
 * Prevents the correction from firing every frame (60fps = 16.7ms) which
 * caused perpetual micro-oscillation. A 300ms cooldown lets the solver
 * respond to the previous correction before applying the next one.
 */
const SETTLE_CORRECTION_COOLDOWN_MS = 300;

/**
 * Per-body cooldown tracker. Keyed by CannonBody.id → last correction
 * timestamp. Entries are pruned when bodies are removed from the world.
 */
const lastCorrectionAt = new Map<number, number>();

/** Call when a body is removed from the world to prevent map leaks. */
export function clearSettleCooldown(bodyId: number): void {
  lastCorrectionAt.delete(bodyId);
}

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
  const { xExtent, yExtent, zExtent } = colliderExtents(profile);
  return yExtent > Math.max(xExtent, zExtent) * 1.04;
}

function colliderExtents(profile: ItemPhysicsProfile): {
  xExtent: number;
  yExtent: number;
  zExtent: number;
} {
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

  return { xExtent, yExtent, zExtent };
}

/**
 * Thin cards, trays, wedges and wrapped packets need their broad authored face
 * readable from the overhead camera. They still tumble and collide normally;
 * this only identifies colliders whose local Y axis is materially thinner than
 * both horizontal axes.
 */
export function prefersFaceRest(profile: ItemPhysicsProfile): boolean {
  const { xExtent, yExtent, zExtent } = colliderExtents(profile);
  return yExtent < Math.min(xExtent, zExtent) * 0.68;
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
  if (profile.readableRest === "upright") {
    return [
      (unitX - 0.5) * 0.34,
      unitY * Math.PI * 2,
      (unitZ - 0.5) * 0.34,
    ];
  }
  if (prefersFaceRest(profile)) {
    return [
      (unitX - 0.5) * 0.3,
      unitY * Math.PI * 2,
      (unitZ - 0.5) * 0.3,
    ];
  }
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
 * Open bowls, mugs, pots and kettles carry semantic information on their
 * authored +Y face. Correct a nearly sleeping underside/edge view with a
 * gentle angular velocity so the real solver and neighbouring contacts still
 * decide whether the object can roll. This never snaps or locks orientation.
 *
 * Uses a proportional controller (speed ∝ error angle) with a per-body
 * cooldown to prevent the old constant-speed-per-frame oscillation.
 */
export function settleReadableUpright(
  body: CannonBody,
  profile: ItemPhysicsProfile,
  nowMs?: number,
): boolean {
  if (profile.readableRest !== "upright" || body.mass <= 0 || body.world == null) return false;
  body.quaternion.vmult(LOCAL_UP, worldAxis);
  if (worldAxis.y >= 0.72) return false;

  // Cooldown: skip if we corrected this body too recently.
  const now = nowMs ?? performance.now();
  const last = lastCorrectionAt.get(body.id) ?? 0;
  if (now - last < SETTLE_CORRECTION_COOLDOWN_MS) return false;

  worldAxis.cross(LOCAL_UP, faceCorrectionAxis);
  let length = faceCorrectionAxis.length();
  if (length < 0.001) {
    // Exactly upside-down has no unique cross-product axis. A fixed, restrained
    // roll is deterministic and lets the next solver steps choose either side.
    faceCorrectionAxis.set(1, 0, 0);
    length = 1;
  }
  // Proportional: error angle ≈ acos(worldAxis.y) mapped through the cross
  // product magnitude (sin of the angle). Scale by gain, clamp to max speed.
  const errorAngle = Math.acos(Math.min(1, Math.max(-1, worldAxis.y)));
  const speed = Math.min(UPRIGHT_REST_MAX_SPEED, UPRIGHT_REST_PROPORTIONAL_GAIN * errorAngle);
  faceCorrectionAxis.scale(speed / length, faceCorrectionAxis);
  body.angularVelocity.x += faceCorrectionAxis.x;
  body.angularVelocity.z += faceCorrectionAxis.z;
  body.wakeUp();
  lastCorrectionAt.set(body.id, now);
  return true;
}

/**
 * Give an almost-sleeping thin object one restrained correcting roll when it
 * is caught edge-on. This is a physical angular nudge, not a quaternion snap:
 * neighbouring bodies can resist it, and Shake can still overturn the object.
 *
 * Uses proportional control + cooldown (same pattern as settleReadableUpright).
 */
export function settleReadableFace(
  body: CannonBody,
  profile: ItemPhysicsProfile,
  nowMs?: number,
): boolean {
  if (!prefersFaceRest(profile) || body.mass <= 0 || body.world == null) return false;
  body.quaternion.vmult(LOCAL_UP, worldAxis);
  if (Math.abs(worldAxis.y) >= 0.72) return false;

  // Cooldown: skip if we corrected this body too recently.
  const now = nowMs ?? performance.now();
  const last = lastCorrectionAt.get(body.id) ?? 0;
  if (now - last < SETTLE_CORRECTION_COOLDOWN_MS) return false;

  worldAxis.cross(LOCAL_UP, faceCorrectionAxis);
  const length = faceCorrectionAxis.length();
  if (length < 0.001) return false;
  // Proportional: error from face-flat is acos(|worldAxis.y|).
  // At edge-on (|y|=0) error = π/2; at threshold (|y|=0.72) error ≈ 0.77 rad.
  const errorAngle = Math.acos(Math.min(1, Math.abs(worldAxis.y)));
  const speed = Math.min(FACE_REST_MAX_SPEED, FACE_REST_PROPORTIONAL_GAIN * errorAngle);
  faceCorrectionAxis.scale(speed / length, faceCorrectionAxis);
  body.angularVelocity.x += faceCorrectionAxis.x;
  body.angularVelocity.z += faceCorrectionAxis.z;
  body.wakeUp();
  lastCorrectionAt.set(body.id, now);
  return true;
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
