import * as THREE from "three";

function disposeMaterial(
  mat: THREE.Material | THREE.Material[] | undefined,
  disposed: Set<THREE.Material>,
): void {
  if (!mat) return;
  const materials = Array.isArray(mat) ? mat : [mat];
  materials.forEach((material) => {
    if (disposed.has(material)) return;
    disposed.add(material);
    material.dispose();
  });
}

/**
 * Dispose every per-instance GPU resource under `root`. Item visuals and tray
 * minis are composed Groups, so disposal must traverse. Cached model geometry
 * and cached sprite textures carry `sharedAsset`; those resources deliberately
 * outlive one scene instance and must remain valid for later stream waves.
 */
export function disposeObject(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      if (
        mesh.geometry
        && !mesh.geometry.userData.sharedAsset
        && !disposedGeometries.has(mesh.geometry)
      ) {
        disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      disposeMaterial(mesh.material, disposedMaterials);
      return;
    }
    const sprite = object as THREE.Sprite;
    if (sprite.isSprite) {
      const map = sprite.material.map;
      if (map && !map.userData.sharedAsset && !disposedTextures.has(map)) {
        disposedTextures.add(map);
        map.dispose();
      }
      disposeMaterial(sprite.material, disposedMaterials);
    }
  });
}
