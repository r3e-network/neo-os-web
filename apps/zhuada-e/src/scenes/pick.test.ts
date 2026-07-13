import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { pickItemNearPointer, resolveItemRoot } from "./pick";

function camera(): THREE.PerspectiveCamera {
  const result = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  result.position.set(0, 0, 10);
  result.lookAt(0, 0, 0);
  result.updateMatrixWorld(true);
  result.updateProjectionMatrix();
  return result;
}

describe("composed item picking", () => {
  it("resolves a child mesh back to its registered item root", () => {
    const root = new THREE.Group();
    const child = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    root.add(child);
    expect(resolveItemRoot(child, new Map([[root, "item"]]))).toBe("item");
  });

  it("forgives a small miss around a thin model but rejects distant taps", () => {
    const root = new THREE.Group();
    root.position.set(0.42, 0, 0);
    root.updateMatrixWorld(true);
    const roots = new Map([[root, "thin-item"]]);
    const view = camera();
    const centre = root.position.clone().project(view);
    const nearMiss = new THREE.Vector2(centre.x + 0.045, centre.y);

    expect(pickItemNearPointer(view, roots, nearMiss, { width: 400, height: 400 }, 24))
      .toBe("thin-item");
    expect(pickItemNearPointer(view, roots, new THREE.Vector2(-0.8, -0.8), { width: 400, height: 400 }, 24))
      .toBeNull();
  });

  it("prefers the front item when projected centres overlap", () => {
    const back = new THREE.Group();
    const front = new THREE.Group();
    back.position.set(0, 0, 0);
    front.position.set(0, 0, 2);
    back.updateMatrixWorld(true);
    front.updateMatrixWorld(true);

    expect(pickItemNearPointer(
      camera(),
      new Map<THREE.Object3D, string>([[back, "back"], [front, "front"]]),
      new THREE.Vector2(0, 0),
      { width: 400, height: 400 },
      24,
    )).toBe("front");
  });
});
