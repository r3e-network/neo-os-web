/**
 * pick.ts — raycast pick resolution for composed item models.
 *
 * Item visuals are THREE.Groups (see models.ts): several primitive Meshes
 * composed under one Group root. `THREE.Group.raycast` is a no-op, so a
 * correct pick MUST (a) intersect recursively so the child Meshes are tested,
 * and (b) backtrack the hit child up its parent chain to the owning item
 * root. This module owns exactly that logic so ZhuaDaScene and the vitest
 * regression suite exercise the same code path.
 */

import * as THREE from "three";

/**
 * Walk a raycast hit object (possibly a nested child Mesh) up its parent
 * chain until it matches one of the registered item roots. Returns the value
 * mapped to that root, or null when the hit belongs to no registered item.
 */
export function resolveItemRoot<T>(
  object: THREE.Object3D | null,
  roots: ReadonlyMap<THREE.Object3D, T>,
): T | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const owner = roots.get(current);
    if (owner !== undefined) return owner;
    current = current.parent;
  }
  return null;
}

/**
 * Pick the nearest item under `raycaster`. `roots` maps each item's Group
 * root to its owning record. Recursive intersection keeps three.js's
 * nearest-first ordering, so a fully occluded item can never steal the pick
 * from the one in front of it.
 */
export function pickItemAt<T>(
  raycaster: THREE.Raycaster,
  roots: ReadonlyMap<THREE.Object3D, T>,
): T | null {
  if (roots.size === 0) return null;
  const hits = raycaster.intersectObjects([...roots.keys()], true);
  if (hits.length === 0) return null;
  // Interaction proxies are intentionally larger than some hollow models.
  // Their invisible surface must never sit in front of a genuinely rendered
  // mesh from another item and make a tap select an object the player cannot
  // see. Prefer the nearest visible authored surface; use a proxy only when
  // the ray passed through a real hole and hit no rendered surface at all.
  const visibleHit = hits.find((hit) => !hit.object.userData.interactionProxy);
  return resolveItemRoot((visibleHit ?? hits[0]!).object, roots);
}

/**
 * Forgiving screen-space fallback for thin or fast-moving models. Exact mesh
 * raycasts remain authoritative; this is used only when the pointer lands in
 * the small visual gap around an item. A slight depth penalty favors the item
 * closest to the camera when projected centres overlap.
 */
export function pickItemNearPointer<T>(
  camera: THREE.Camera,
  roots: ReadonlyMap<THREE.Object3D, T>,
  pointerNdc: THREE.Vector2,
  viewport: { width: number; height: number },
  radiusPx: number,
): T | null {
  if (roots.size === 0 || viewport.width <= 0 || viewport.height <= 0 || radiusPx <= 0) return null;

  const world = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const radiusSq = radiusPx * radiusPx;
  let best: { value: T; score: number } | null = null;

  for (const [root, value] of roots) {
    root.getWorldPosition(world);
    projected.copy(world).project(camera);
    if (projected.z < -1 || projected.z > 1) continue;

    const dx = (projected.x - pointerNdc.x) * viewport.width * 0.5;
    const dy = (projected.y - pointerNdc.y) * viewport.height * 0.5;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > radiusSq) continue;

    const depth01 = (projected.z + 1) * 0.5;
    const score = distanceSq + depth01 * radiusSq * 0.12;
    if (!best || score < best.score) best = { value, score };
  }

  return best?.value ?? null;
}
