import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GAME_THEMES, themeItem } from "../logic/themes";
import { buildThemeModelMesh } from "./models";
import { disposeObject } from "./scene-resources";

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });
  return meshes;
}

function productionMeshesOf(root: THREE.Object3D): THREE.Mesh[] {
  return meshesOf(root).filter((mesh) => !mesh.userData.interactionProxy);
}

function materialSignature(material: THREE.Material): string {
  const physical = material as THREE.MeshPhysicalMaterial;
  return [
    material.type,
    physical.color?.getHexString?.() ?? "no-color",
    Number(physical.roughness ?? 0).toFixed(2),
    Number(physical.metalness ?? 0).toFixed(2),
    Number(physical.clearcoat ?? 0).toFixed(2),
    material.transparent ? "transparent" : "opaque",
  ].join(":");
}

describe("production model geometry cache", () => {
  it("shares immutable geometry but keeps every instance material isolated", () => {
    const item = themeItem("fresh-market", 0);
    const first = buildThemeModelMesh("fresh-market", 0, item.color);
    const second = buildThemeModelMesh("fresh-market", 0, item.color);
    const firstMeshes = meshesOf(first);
    const secondMeshes = meshesOf(second);

    expect(first).not.toBe(second);
    expect(firstMeshes.length).toBeGreaterThan(1);
    expect(secondMeshes).toHaveLength(firstMeshes.length);
    firstMeshes.forEach((mesh, index) => {
      const peer = secondMeshes[index]!;
      expect(mesh.geometry).toBe(peer.geometry);
      expect(mesh.geometry.userData.sharedAsset).toBe(true);
      expect(mesh.material).not.toBe(peer.material);
    });

    const firstLit = firstMeshes.find((mesh) => (
      mesh.material as THREE.MeshPhysicalMaterial
    ).isMeshPhysicalMaterial)!;
    const secondLit = secondMeshes[firstMeshes.indexOf(firstLit)]!;
    const firstMaterial = firstLit.material as THREE.MeshPhysicalMaterial;
    const secondMaterial = secondLit.material as THREE.MeshPhysicalMaterial;
    firstMaterial.emissive.setHex(0xff00ff);
    firstMaterial.emissiveIntensity = 0.9;
    expect(secondMaterial.emissive.getHex()).not.toBe(firstMaterial.emissive.getHex());
    expect(secondMaterial.emissiveIntensity).not.toBe(firstMaterial.emissiveIntensity);
  });

  it("disposes per-instance materials without disposing shared geometry", () => {
    const item = themeItem("farm-kitchen", 0);
    const model = buildThemeModelMesh("farm-kitchen", 0, item.color);
    const meshes = meshesOf(model);
    const geometryDispose = vi.spyOn(meshes[0]!.geometry, "dispose");
    const materialCounts = new Map<THREE.Material, number>();
    meshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
      });
    });
    const sharedWithinInstance = [...materialCounts].find(([, count]) => count > 1)?.[0];
    expect(sharedWithinInstance).toBeDefined();
    const materialDispose = vi.spyOn(sharedWithinInstance!, "dispose");

    disposeObject(model);

    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it("does not share geometry across catalogue entries with different colors", () => {
    const first = buildThemeModelMesh("farm-kitchen", 1, 0x123456);
    const second = buildThemeModelMesh("farm-kitchen", 1, 0x654321);
    expect(meshesOf(first)[0]!.geometry).not.toBe(meshesOf(second)[0]!.geometry);
  });

  it("keeps every production 3D item as a layered multi-material mesh with a pick proxy", () => {
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const item = theme.items[kind]!;
        const model = buildThemeModelMesh(theme.id, kind, item.color);
        const allMeshes = meshesOf(model);
        const detailMeshes = productionMeshesOf(model);
        const materialSignatures = new Set(
          detailMeshes.flatMap((mesh) => (
            Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          ).map(materialSignature)),
        );
        const vertexCount = detailMeshes.reduce((sum, mesh) => (
          sum + (mesh.geometry.getAttribute("position")?.count ?? 0)
        ), 0);
        const shadowCasters = detailMeshes.filter((mesh) => mesh.castShadow);

        expect(allMeshes.filter((mesh) => mesh.userData.interactionProxy), `${theme.id}/${kind} pick proxy`).toHaveLength(1);
        expect(detailMeshes.length, `${theme.id}/${kind} detail mesh count`).toBeGreaterThanOrEqual(3);
        expect(materialSignatures.size, `${theme.id}/${kind} material variety`).toBeGreaterThanOrEqual(2);
        expect(vertexCount, `${theme.id}/${kind} geometry detail`).toBeGreaterThanOrEqual(120);
        expect(shadowCasters.length, `${theme.id}/${kind} mobile shadow budget`).toBeGreaterThanOrEqual(1);
        expect(shadowCasters.length, `${theme.id}/${kind} mobile shadow budget`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("keeps translucent containers closed with a depth-writing solid heel", () => {
    for (const kind of [1, 4]) {
      const item = themeItem("farm-kitchen", kind);
      const model = buildThemeModelMesh("farm-kitchen", kind, item.color);
      const meshes = meshesOf(model);
      const translucent = meshes.filter((mesh) => {
        const material = mesh.material as THREE.Material;
        return material.transparent;
      });
      const heel = meshes.find((mesh) => String(mesh.userData.detailLayer).endsWith("heel"));

      expect(translucent.length).toBeGreaterThan(0);
      expect(translucent.every((mesh) => (mesh.material as THREE.Material).depthWrite)).toBe(true);
      expect(heel).toBeDefined();
    }
  });

  it("builds the zongzi from overlapping leaf panels, veins, folds and tied cord", () => {
    const item = themeItem("night-market", 7);
    const model = buildThemeModelMesh("night-market", 7, item.color);
    const meshes = meshesOf(model);
    const countLayer = (layer: string) => meshes.filter((mesh) => mesh.userData.detailLayer === layer).length;

    expect(countLayer("zongzi-leaf-panel")).toBe(3);
    expect(countLayer("zongzi-leaf-vein")).toBe(3);
    expect(countLayer("zongzi-fold")).toBe(3);
    expect(countLayer("zongzi-cord-wrap")).toBe(2);
    expect(countLayer("zongzi-cord-tail")).toBe(2);
    expect(meshes.length).toBeGreaterThanOrEqual(15);
  });
});
