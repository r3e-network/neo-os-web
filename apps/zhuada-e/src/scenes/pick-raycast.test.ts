/**
 * pick-raycast.test.ts — regression guard for the tap-to-pick path.
 *
 * The original ship-blocker: item visuals are composed THREE.Groups
 * (models.ts), but the scene raycast was non-recursive (`intersectObjects(
 * groups, false)`), and Group.raycast is a no-op — so 100% of taps missed and
 * the game was unplayable. These tests raycast a REAL built model Group the
 * exact way ZhuaDaScene does (same camera framing, same pickItemAt helper)
 * and pin down:
 *   1. non-recursive raycasts against Group roots can never hit (the bug),
 *   2. pickItemAt (recursive + parent backtrack) resolves the owning item,
 *   3. the nearest item wins when two overlap along the ray (occlusion),
 *   4. a hit on a deeply nested child Mesh backtracks to the right root.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildModelMesh } from "./models";
import { pickItemAt, resolveItemRoot } from "./pick";
import { ITEM_DEFS } from "../logic/engine-zhuada";

// Mirror ZhuaDaScene.mount's camera framing (SCENE_W/H 400x580, BOX_HEIGHT 4.2).
const BOX_HEIGHT = 4.2;

function makeSceneCamera(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 400 / 580, 0.1, 100);
  camera.position.set(0, BOX_HEIGHT + 4.6, BOX_HEIGHT + 5.2);
  camera.lookAt(0, BOX_HEIGHT * 0.35, 0);
  camera.updateMatrixWorld(true);
  return { scene, camera };
}

/** Build an item visual exactly like ZhuaDaScene.spawnNext does. */
function spawnItem(scene: THREE.Scene, kindIdx: number, pos: THREE.Vector3): THREE.Group {
  const def = ITEM_DEFS[kindIdx] ?? ITEM_DEFS[0]!;
  const group = buildModelMesh(def.model, def.color); // default scale 0.62
  group.position.copy(pos);
  scene.add(group);
  return group;
}

/** Raycast through the world-space point `target` (screen tap → NDC → ray),
 * with the same matrix refresh ZhuaDaScene.onPointerDown performs. */
function raycastThrough(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
): THREE.Raycaster {
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  const ndc = target.clone().project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return raycaster;
}

describe("tap-to-pick raycast (composed Group models)", () => {
  it("documents the original bug: a non-recursive raycast against Group roots never hits", () => {
    const { scene, camera } = makeSceneCamera();
    const itemPos = new THREE.Vector3(0.4, 1.0, 0.2);
    const group = spawnItem(scene, 0, itemPos);
    const raycaster = raycastThrough(scene, camera, itemPos);

    // THREE.Group.raycast is a no-op → the pre-fix call shape returns nothing
    // even for a dead-center tap. If this ever starts hitting, the model
    // composition changed and the pick path must be re-audited.
    expect(raycaster.intersectObjects([group], false)).toHaveLength(0);
  });

  it("pickItemAt resolves a dead-center tap to the owning item", () => {
    const { scene, camera } = makeSceneCamera();
    const itemPos = new THREE.Vector3(0.4, 1.0, 0.2);
    const group = spawnItem(scene, 0, itemPos);
    const visual = { id: 7, kind: 0 };
    const roots = new Map<THREE.Object3D, typeof visual>([[group, visual]]);

    const picked = pickItemAt(raycastThrough(scene, camera, itemPos), roots);
    expect(picked).toBe(visual);
  });

  it("resolves every one of the 12 item models (each is a multi-mesh Group)", () => {
    for (let kind = 0; kind < ITEM_DEFS.length; kind += 1) {
      const { scene, camera } = makeSceneCamera();
      const itemPos = new THREE.Vector3(0, 1.0, 0);
      const group = spawnItem(scene, kind, itemPos);
      const visual = { id: 100 + kind, kind };
      const roots = new Map<THREE.Object3D, typeof visual>([[group, visual]]);

      const picked = pickItemAt(raycastThrough(scene, camera, itemPos), roots);
      expect(picked, `model kind ${kind} (${ITEM_DEFS[kind]!.model})`).toBe(visual);
    }
  });

  it("nearest item wins when two items overlap along the same ray (occlusion)", () => {
    const { scene, camera } = makeSceneCamera();
    const frontPos = new THREE.Vector3(0, 1.2, 0.5);
    // Place the second item BEHIND the first along the exact camera→front ray.
    const dir = frontPos.clone().sub(camera.position).normalize();
    const backPos = frontPos.clone().add(dir.multiplyScalar(2.5));

    const front = spawnItem(scene, 1, frontPos);
    const back = spawnItem(scene, 2, backPos);
    const frontVisual = { id: 1, kind: 1 };
    const backVisual = { id: 2, kind: 2 };
    const roots = new Map<THREE.Object3D, { id: number; kind: number }>([
      [front, frontVisual],
      [back, backVisual],
    ]);

    const picked = pickItemAt(raycastThrough(scene, camera, frontPos), roots);
    expect(picked).toBe(frontVisual);
  });

  it("resolveItemRoot backtracks a deeply nested child Mesh to its item root", () => {
    const { scene, camera } = makeSceneCamera();
    const itemPos = new THREE.Vector3(-0.6, 1.0, -0.3);
    // Tomato: leafCrown() nests Meshes one Group deeper than the body.
    const group = spawnItem(scene, 0, itemPos);
    const visual = { id: 42, kind: 0 };
    const roots = new Map<THREE.Object3D, typeof visual>([[group, visual]]);

    let nested: THREE.Mesh | null = null;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.parent !== group) nested = mesh;
    });
    expect(nested, "tomato model should have a nested (grand)child mesh").not.toBeNull();
    expect(resolveItemRoot(nested, roots)).toBe(visual);

    // And an object outside every registered root resolves to null.
    expect(resolveItemRoot(camera, roots)).toBeNull();
  });

  it("pickItemAt returns null for a tap that misses every item", () => {
    const { scene, camera } = makeSceneCamera();
    const group = spawnItem(scene, 3, new THREE.Vector3(0, 1.0, 0));
    const visual = { id: 9, kind: 3 };
    const roots = new Map<THREE.Object3D, typeof visual>([[group, visual]]);

    // Aim far off to the side (world x = 40 is way outside the pen).
    const miss = pickItemAt(raycastThrough(scene, camera, new THREE.Vector3(40, 1, 0)), roots);
    expect(miss).toBeNull();
    expect(pickItemAt(raycastThrough(scene, camera, new THREE.Vector3(0, 1, 0)), new Map())).toBeNull();
  });
});
