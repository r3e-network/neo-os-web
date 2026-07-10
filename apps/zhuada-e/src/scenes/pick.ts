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
  return resolveItemRoot(hits[0]!.object, roots);
}
