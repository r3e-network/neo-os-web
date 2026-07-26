import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GAME_THEMES, themeItem } from "../logic/themes";
import { buildThemeModelMesh } from "./models";
import { disposeObject } from "./scene-resources";

const sceneSource = readFileSync(fileURLToPath(new URL("./ZhuaDaScene.ts", import.meta.url)), "utf8");
const freshModelSource = readFileSync(fileURLToPath(new URL("./fresh-market-models.ts", import.meta.url)), "utf8");
const farmModelSource = readFileSync(fileURLToPath(new URL("./farm-kitchen-models.ts", import.meta.url)), "utf8");
const nightModelSource = readFileSync(fileURLToPath(new URL("./night-market-models.ts", import.meta.url)), "utf8");

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

interface DetailLayerRecord {
  name: string;
  geometryType: string;
}

function detailLayersOf(root: THREE.Object3D): DetailLayerRecord[] {
  return productionMeshesOf(root).flatMap((mesh) => {
    const merged = mesh.userData.detailLayers as DetailLayerRecord[] | undefined;
    if (Array.isArray(merged)) return merged;
    return typeof mesh.userData.detailLayer === "string"
      ? [{ name: mesh.userData.detailLayer, geometryType: mesh.geometry.type }]
      : [];
  });
}

function countDetailLayer(root: THREE.Object3D, layer: string): number {
  return detailLayersOf(root).filter((record) => record.name === layer).length;
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

function materialColors(root: THREE.Object3D): string[] {
  return productionMeshesOf(root).flatMap((mesh) => (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  ).map((material) => (material as THREE.MeshStandardMaterial).color?.getHexString?.() ?? ""));
}

function textureChannelRange(texture: THREE.Texture, channel: 0 | 1 | 2 = 0): number {
  const data = (texture as THREE.DataTexture).image.data as Uint8Array;
  let min = 255;
  let max = 0;
  for (let index = channel; index < data.length; index += 4) {
    min = Math.min(min, data[index]!);
    max = Math.max(max, data[index]!);
  }
  return max - min;
}

describe("production model geometry cache", () => {
  it("lights physical finishes with a disposable PMREM room environment", () => {
    expect(sceneSource).toContain("RoomEnvironment");
    expect(sceneSource).toContain("pmrem.fromScene(room, 0.035)");
    expect(sceneSource).toContain("this.scene.environment = this.environmentTarget.texture");
    expect(sceneSource).toContain("this.environmentTarget?.dispose()");
  });

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
    const firstMaterial = Array.isArray(meshes[0]!.material)
      ? meshes[0]!.material[0]!
      : meshes[0]!.material;
    const materialDispose = vi.spyOn(firstMaterial, "dispose");

    disposeObject(model);

    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it("does not share geometry across catalogue entries with different colors", () => {
    const first = buildThemeModelMesh("farm-kitchen", 1, 0x123456);
    const second = buildThemeModelMesh("farm-kitchen", 1, 0x654321);
    expect(meshesOf(first)[0]!.geometry).not.toBe(meshesOf(second)[0]!.geometry);
  });

  it("keeps every production 3D item layered while merging authored parts into a mobile draw-call budget", () => {
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
        // Clean silhouettes may intentionally use only a body + one structural
        // surface after marker-line removal; the merged runtime still needs at
        // least two visible material surfaces for depth and identity.
        expect(model.userData.sourcePartCount, `${theme.id}/${kind} authored part count`).toBeGreaterThanOrEqual(2);
        expect(detailMeshes.length, `${theme.id}/${kind} merged surface count`).toBeGreaterThanOrEqual(2);
        expect(detailMeshes.length, `${theme.id}/${kind} mobile draw-call budget`).toBeLessThanOrEqual(7);
        expect(materialSignatures.size, `${theme.id}/${kind} material variety`).toBeGreaterThanOrEqual(2);
        expect(vertexCount, `${theme.id}/${kind} geometry detail`).toBeGreaterThanOrEqual(120);
        expect(shadowCasters.length, `${theme.id}/${kind} mobile shadow budget`).toBeGreaterThanOrEqual(1);
        expect(shadowCasters.length, `${theme.id}/${kind} mobile shadow budget`).toBeLessThanOrEqual(2);
      }
    }
  }, 20_000);

  it("keeps every visible production surface opaque so the basket never shows through", () => {
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const item = theme.items[kind]!;
        const model = buildThemeModelMesh(theme.id, kind, item.color);
        for (const mesh of productionMeshesOf(model)) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          expect(materials.every((material) => !material.transparent && material.opacity === 1), `${theme.id}/${kind}`).toBe(true);
          expect(materials.every((material) => material.depthWrite), `${theme.id}/${kind} depth write`).toBe(true);
        }
      }
    }
  });

  it("gives every visible surface a real material skin instead of a flat colour", () => {
    const finishes = new Set<string>();
    const finishExamples = new Map<string, THREE.MeshPhysicalMaterial>();
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const item = theme.items[kind]!;
        const model = buildThemeModelMesh(theme.id, kind, item.color);
        for (const mesh of productionMeshesOf(model)) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            const physical = material as THREE.MeshPhysicalMaterial;
            expect(physical.isMeshPhysicalMaterial, `${theme.id}/${kind} physical material`).toBe(true);
            expect(physical.map, `${theme.id}/${kind} albedo skin`).toBeTruthy();
            expect(physical.normalMap, `${theme.id}/${kind} normal skin`).toBeTruthy();
            expect(physical.roughnessMap, `${theme.id}/${kind} roughness skin`).toBeTruthy();
            expect(material.userData.surfaceSkin, `${theme.id}/${kind} skin provenance`).toMatch(/^goose-skin-v5:/);
            expect(material.userData.surfaceSkinVariant, `${theme.id}/${kind} skin variant`).toBeGreaterThanOrEqual(0);
            expect(material.userData.surfaceSkinVariant, `${theme.id}/${kind} skin variant`).toBeLessThan(6);
            finishes.add(String(material.userData.surfaceFinish));
            finishExamples.set(String(material.userData.surfaceFinish), physical);
          }
        }
      }
    }
    expect(finishes).toEqual(new Set(["matte", "produce", "glaze", "ceramic", "metal", "wood", "fabric", "paper"]));
    for (const [finish, material] of finishExamples) {
      expect(textureChannelRange(material.map!), `${finish} albedo contrast`).toBeGreaterThan(0);
      expect(textureChannelRange(material.normalMap!), `${finish} normal contrast`).toBeGreaterThan(0);
      expect(textureChannelRange(material.roughnessMap!), `${finish} roughness contrast`).toBeGreaterThan(0);
      expect(material.normalScale.x, `${finish} visible normal strength`).toBeGreaterThanOrEqual(0.05);
    }
    expect(finishExamples.get("glaze")!.normalScale.x).toBeLessThan(finishExamples.get("wood")!.normalScale.x);
    expect(finishExamples.get("ceramic")!.normalScale.x).toBeLessThan(finishExamples.get("fabric")!.normalScale.x);
    expect(finishExamples.get("produce")!.normalScale.x).toBeLessThan(finishExamples.get("wood")!.normalScale.x);
    expect(finishExamples.get("metal")!.metalness).toBeGreaterThan(0.6);
    expect(finishExamples.get("ceramic")!.clearcoat).toBeGreaterThan(0.75);
    expect(finishExamples.get("fabric")!.sheen).toBeGreaterThan(0.1);
    expect(finishExamples.get("wood")!.roughness).toBeGreaterThan(0.7);
  }, 20_000);

  it("gives every textured production surface UVs, including custom leaf panels", () => {
    for (const theme of GAME_THEMES) {
      for (let kind = 0; kind < theme.items.length; kind += 1) {
        const item = theme.items[kind]!;
        const model = buildThemeModelMesh(theme.id, kind, item.color);
        for (const mesh of productionMeshesOf(model)) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (materials.some((material) => Boolean((material as THREE.MeshPhysicalMaterial).map))) {
            expect(mesh.geometry.getAttribute("uv"), `${theme.id}/${kind} textured UV`).toBeTruthy();
          }
        }
      }
    }
  }, 20_000);

  it("derives stable but varied skins from each object's authored body colour", () => {
    const warm = buildThemeModelMesh("farm-kitchen", 17, 0xe75b45);
    const cool = buildThemeModelMesh("farm-kitchen", 17, 0x3f79d8);
    const warmAgain = buildThemeModelMesh("farm-kitchen", 17, 0xe75b45);
    const firstPhysical = (root: THREE.Object3D) => productionMeshesOf(root)
      .flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
      .find((material) => (material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) as THREE.MeshPhysicalMaterial;

    const warmMaterial = firstPhysical(warm);
    const coolMaterial = firstPhysical(cool);
    const warmAgainMaterial = firstPhysical(warmAgain);
    expect(warmMaterial.userData.surfaceSkin).toBe(warmAgainMaterial.userData.surfaceSkin);
    expect(warmMaterial.map).toBe(warmAgainMaterial.map);
    expect(warmMaterial.userData.surfaceSkin).not.toBe(coolMaterial.userData.surfaceSkin);
    expect(warmMaterial.map).not.toBe(coolMaterial.map);
  });

  it("uses organic material variation instead of a universal diagonal marker wave", () => {
    const source = readFileSync(fileURLToPath(new URL("./model-kit.ts", import.meta.url)), "utf8");
    expect(source).toContain("const organic =");
    expect(source).not.toContain("const sweep =");
  });

  it("keeps near-match colourways as full-body recolours with real size tiers", () => {
    const base = buildThemeModelMesh("farm-kitchen", 17, themeItem("farm-kitchen", 17).color);
    const warm = buildThemeModelMesh("farm-kitchen", 35, themeItem("farm-kitchen", 35).color);
    const cool = buildThemeModelMesh("farm-kitchen", 53, themeItem("farm-kitchen", 53).color);

    expect(detailLayersOf(warm).some((record) => record.name.startsWith("variant-enamel"))).toBe(false);
    expect(detailLayersOf(cool).some((record) => record.name.startsWith("variant-enamel"))).toBe(false);
    expect(warm.scale.x).toBeLessThan(base.scale.x);
    expect(cool.scale.x).toBeGreaterThan(base.scale.x);
    expect(materialColors(warm)).toContain(themeItem("farm-kitchen", 35).color.toString(16).padStart(6, "0"));
    expect(materialColors(cool)).toContain(themeItem("farm-kitchen", 53).color.toString(16).padStart(6, "0"));
  });

  it("keeps authored silhouettes free of identity-marker noise", () => {
    expect(freshModelSource).not.toContain("const slash =");
    expect(freshModelSource).not.toContain("const badge =");
    expect(freshModelSource).not.toContain("tea-tin-emblem");
    expect(farmModelSource).not.toContain("const slash =");
    expect(farmModelSource).not.toContain("const stitch =");
    expect(farmModelSource).not.toContain("const badge =");
    expect(nightModelSource).not.toContain("const stamp =");
    expect(nightModelSource).not.toContain("petalRing(4");
    expect(nightModelSource).not.toContain("const rib = capsule");
    expect(nightModelSource).not.toContain("lantern-horizontal-rib");
    expect(nightModelSource).not.toContain("lantern-meridian-rib");
    expect(nightModelSource).not.toContain("drum-face-ring");
    expect(nightModelSource).not.toContain("drum-face-center");
    expect(freshModelSource).not.toContain("const stripe =");
    expect(freshModelSource).not.toContain("const sprinkle =");
    expect(farmModelSource).not.toContain("const baseMark =");
    expect(farmModelSource).not.toContain("const labelMark =");
  });

  it("authors the kettle handle as an overhead-readable structural silhouette", () => {
    const item = themeItem("farm-kitchen", 0);
    const model = buildThemeModelMesh("farm-kitchen", 0, item.color);

    expect(countDetailLayer(model, "kettle-overhead-handle")).toBe(1);
    expect(countDetailLayer(model, "kettle-lid-ring")).toBe(1);
    expect(farmModelSource).toContain("new THREE.Vector3(0.86, 0.78, 0)");
    expect(farmModelSource).not.toContain("new THREE.Vector3(0.02, 0.96, -0.04)");
  });

  it("keeps formerly glass containers closed with a solid heel", () => {
    for (const kind of [1, 4]) {
      const item = themeItem("farm-kitchen", kind);
      const model = buildThemeModelMesh("farm-kitchen", kind, item.color);
      expect(
        detailLayersOf(model).some((record) => record.name.endsWith("heel")),
      ).toBe(true);
    }
  });

  it("fills the fresh-market pastry center instead of exposing the basket", () => {
    const item = themeItem("fresh-market", 10);
    const model = buildThemeModelMesh("fresh-market", 10, item.color);
    model.updateMatrixWorld(true);
    const visibleMeshes = productionMeshesOf(model);
    // Geometry occupancy is the contract here, independent of Three's
    // front-face-only raycast culling. Double-sided test materials let the
    // same center ray detect closed volume from the underside as the model
    // rotates in physics; a torus would still miss through its actual hole.
    visibleMeshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => { material.side = THREE.DoubleSide; });
    });
    const directions = [
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -3, 0),
      new THREE.Vector3(3, 0, 0),
      new THREE.Vector3(-3, 0, 0),
      new THREE.Vector3(0, 0, 3),
      new THREE.Vector3(0, 0, -3),
    ];

    for (const origin of directions) {
      const ray = new THREE.Raycaster(origin, origin.clone().negate().normalize());
      expect(ray.intersectObjects(visibleMeshes, false), `solid from ${origin.toArray().join(",")}`).not.toHaveLength(0);
    }
  });

  it("seals every large lathe opening that used to expose the basket", () => {
    const requiredLayers: ReadonlyArray<readonly ["farm-kitchen" | "night-market", number, string]> = [
      ["farm-kitchen", 0, "kettle-base-seal"],
      ["farm-kitchen", 9, "jug-base-seal"],
      ["night-market", 1, "bao-base-seal"],
      ["night-market", 2, "soda-bottle-heel"],
      ["night-market", 10, "bell-interior-seal"],
    ];

    for (const [themeId, kind, layer] of requiredLayers) {
      const item = themeItem(themeId, kind);
      const model = buildThemeModelMesh(themeId, kind, item.color);
      expect(countDetailLayer(model, layer), `${themeId}/${kind} ${layer}`).toBeGreaterThan(0);
    }
  });

  it("builds the zongzi from layered leaf panels without marker-like cord or vein lines", () => {
    const item = themeItem("night-market", 7);
    const model = buildThemeModelMesh("night-market", 7, item.color);
    const countLayer = (layer: string) => countDetailLayer(model, layer);

    expect(countLayer("zongzi-leaf-panel")).toBe(3);
    expect(countLayer("zongzi-leaf-vein")).toBe(0);
    expect(countLayer("zongzi-fold")).toBe(0);
    expect(countLayer("zongzi-cord-wrap")).toBe(0);
    expect(countLayer("zongzi-cord-tail")).toBe(0);
    expect(model.userData.sourcePartCount).toBeGreaterThanOrEqual(4);
  });

  it("keeps the first-run night-market models faithful to their approved item art", () => {
    const lanternItem = themeItem("night-market", 0);
    const lantern = buildThemeModelMesh("night-market", 0, lanternItem.color);
    const lanternLayers = detailLayersOf(lantern);
    const countLanternLayer = (layer: string) => countDetailLayer(lantern, layer);

    expect(countLanternLayer("lantern-round-body")).toBe(1);
    expect(
      lanternLayers.find((record) => record.name === "lantern-round-body")?.geometryType,
    ).toBe("SphereGeometry");
    expect(countLanternLayer("lantern-cap")).toBe(2);
    expect(countLanternLayer("lantern-horizontal-rib")).toBe(0);
    expect(countLanternLayer("lantern-meridian-rib")).toBe(0);
    expect(countLanternLayer("lantern-tassel")).toBe(4);

    const bottleItem = themeItem("night-market", 2);
    const bottle = buildThemeModelMesh("night-market", 2, bottleItem.color);
    const countBottleLayer = (layer: string) => countDetailLayer(bottle, layer);

    expect(countBottleLayer("soda-bottle-body")).toBe(1);
    expect(countBottleLayer("soda-bottle-heel")).toBe(1);
    expect(countBottleLayer("soda-bottle-crown-tab")).toBe(10);
    expect(countBottleLayer("soda-bottle-bubble")).toBe(9);

    const bounds = new THREE.Box3().setFromObject(bottle);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(size.x * 1.25);
  });

  it("keeps rolling night-market circular faces recognizable without painted markers", () => {
    const mooncakeItem = themeItem("night-market", 3);
    const mooncake = buildThemeModelMesh("night-market", 3, mooncakeItem.color);
    expect(countDetailLayer(mooncake, "mooncake-bottom-ring")).toBe(0);
    expect(countDetailLayer(mooncake, "mooncake-bottom-stamp")).toBe(0);
    expect(countDetailLayer(mooncake, "mooncake-bottom-medallion")).toBe(0);
    expect(countDetailLayer(mooncake, "mooncake-bottom-face")).toBe(1);

    const drumItem = themeItem("night-market", 5);
    const drum = buildThemeModelMesh("night-market", 5, drumItem.color);
    const countDrumLayer = (layer: string) => countDetailLayer(drum, layer);

    expect(countDrumLayer("drum-face-ring")).toBe(0);
    expect(countDrumLayer("drum-face-center")).toBe(0);
    expect(countDrumLayer("drum-face-cross")).toBe(0);

    const zongziItem = themeItem("night-market", 7);
    const zongzi = buildThemeModelMesh("night-market", 7, zongziItem.color);
    expect(countDetailLayer(zongzi, "zongzi-cord-cross")).toBe(0);

    const lotusItem = themeItem("night-market", 16);
    const lotus = buildThemeModelMesh("night-market", 16, lotusItem.color);
    expect(countDetailLayer(lotus, "lotus-base-rosette")).toBe(0);
    expect(countDetailLayer(lotus, "lotus-base-heart")).toBe(0);

    const luckyCat = buildThemeModelMesh("night-market", 14, themeItem("night-market", 14).color);
    expect(countDetailLayer(luckyCat, "lucky-cat-stamp")).toBe(0);
  });

  it("keeps fresh-market packages and cut food readable from both tumble faces", () => {
    const countLayer = (kind: number, layer: string): number => {
      const item = themeItem("fresh-market", kind);
      return countDetailLayer(
        buildThemeModelMesh("fresh-market", kind, item.color),
        layer,
      );
    };

    expect(countLayer(6, "tea-tin-label")).toBe(2);
    expect(countLayer(6, "tea-tin-emblem")).toBe(0);
    expect(countLayer(13, "watermelon-pale-rind")).toBe(2);
    expect(countLayer(13, "watermelon-flesh-face")).toBe(2);
    expect(countLayer(13, "watermelon-seed")).toBe(6);
    expect(countLayer(14, "honey-label")).toBe(0);
    expect(countLayer(15, "cheese-face")).toBe(2);
    expect(countLayer(15, "cheese-dimple")).toBe(8);
    expect(countLayer(17, "juice-label")).toBe(0);
  });

  it("keeps farm-kitchen silhouettes clean after physics rolls them over", () => {
    const countLayer = (kind: number, layer: string): number => {
      const item = themeItem("farm-kitchen", kind);
      return countDetailLayer(
        buildThemeModelMesh("farm-kitchen", kind, item.color),
        layer,
      );
    };

    expect(countLayer(0, "kettle-base-medallion")).toBe(0);
    expect(countLayer(1, "bottle-label")).toBe(4);
    expect(countLayer(1, "bottle-neck")).toBe(1);
    expect(countLayer(1, "bottle-cap-crown")).toBe(1);
    expect(countLayer(1, "bottle-cap-seal")).toBe(1);
    expect(countLayer(2, "bowl-base-ring")).toBe(1);
    expect(countLayer(4, "jam-label")).toBe(2);
    expect(countLayer(11, "mug-base-mark")).toBe(0);
    expect(countLayer(13, "pot-base-seal")).toBe(1);
    expect(countLayer(13, "pot-base-medallion")).toBe(0);
  });
});
