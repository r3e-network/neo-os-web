/**
 * models.ts — original low-poly item + goose models for Goose Basket Shuffle.
 *
 * Every shape here is an original production model recipe built from composed
 * Three.js geometry. The three player-selectable themes expose 162 match
 * identities: 54 authored silhouettes plus 108 deliberate colour variants.
 * Matching transparent item renders are used by the React tray while these
 * recipes drive the physical pile. No third-party game art is reproduced.
 *
 * Each builder returns a THREE.Group so multiple sub-meshes compose into one
 * pickable object. `buildModelMesh(kind, color, scale)` is the single entry
 * used by the scene for both the box items and the tray minis.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ModelKind } from "../logic/engine-zhuada";
import type { GooseVariant } from "../logic/scenes";
import { themeOf, type GameThemeId } from "../logic/themes";
import { buildFarmKitchenModel } from "./farm-kitchen-models";
import { buildFreshMarketModel } from "./fresh-market-models";
import { buildNightMarketModel } from "./night-market-models";
import { interactionProxy } from "./model-kit";
import { physicsProfileOf } from "./physics-profiles";

/**
 * The catalogue has a fixed color for every theme/kind pair. Building those
 * detailed procedural geometries for every streamed copy is pure duplicate
 * work, so keep one immutable geometry template per rendered catalogue entry.
 * Object transforms and materials are still cloned for every live instance.
 */
const THEME_MODEL_TEMPLATES = new Map<string, THREE.Group>();

const GREEN = 0x3fa34d;
const GREEN_DARK = 0x2f7d3a;
const CREAM = 0xfdf6e3;
const BROWN = 0x7c4a23;
const ORANGE = 0xf59e0b;
const WHITE = 0xf7f7f2;
const BLACK = 0x20242a;

function mat(color: number, roughness = 0.6, metalness = 0.03): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function part(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/** Small star/calyx of leaves on top of a round item. */
function leafCrown(radius: number, color = GREEN): THREE.Group {
  const g = new THREE.Group();
  const lm = mat(color, 0.7);
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const leaf = part(new THREE.ConeGeometry(radius * 0.28, radius * 0.9, 6), lm);
    const a = (i / count) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * radius * 0.4, radius * 0.5, Math.sin(a) * radius * 0.4);
    leaf.rotation.set(Math.PI * 0.18 * Math.cos(a), a, Math.PI * 0.18 * Math.sin(a));
    g.add(leaf);
  }
  return g;
}

// ── Individual produce builders ──────────────────────────────────────────────

function buildTomato(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(1, 22, 18), mat(color, 0.5)));
  g.add(leafCrown(0.7));
  return g;
}

function buildCarrot(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.ConeGeometry(0.7, 1.9, 18), mat(color, 0.55));
  body.rotation.x = Math.PI; // point down
  body.position.y = -0.1;
  g.add(body);
  const greens = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const leaf = part(new THREE.ConeGeometry(0.16, 0.95, 6), mat(GREEN, 0.7));
    leaf.position.set((i - 1.5) * 0.18, 0.95, 0);
    leaf.rotation.z = (i - 1.5) * 0.18;
    greens.add(leaf);
  }
  g.add(greens);
  return g;
}

function buildCorn(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.62, 0.62, 1.7, 18), mat(color, 0.5)));
  const husk = mat(GREEN, 0.7);
  for (let i = 0; i < 3; i += 1) {
    const h = part(new THREE.ConeGeometry(0.5, 1.1, 8), husk);
    const a = (i / 3) * Math.PI * 2;
    h.position.set(Math.cos(a) * 0.45, -0.45, Math.sin(a) * 0.45);
    h.rotation.z = Math.cos(a) * 0.5;
    h.rotation.x = -Math.sin(a) * 0.5;
    g.add(h);
  }
  const top = part(new THREE.SphereGeometry(0.45, 12, 10), mat(color, 0.5));
  top.position.y = 0.85;
  g.add(top);
  return g;
}

function buildEggplant(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(1, 22, 18), mat(color, 0.45));
  body.scale.set(0.95, 1.35, 0.95);
  g.add(body);
  const cap = part(new THREE.ConeGeometry(0.45, 0.5, 10), mat(GREEN_DARK, 0.7));
  cap.position.y = 1.25;
  g.add(cap);
  g.add(leafCrown(0.5, GREEN_DARK));
  return g;
}

function buildApple(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(0.95, 22, 18), mat(color, 0.45)));
  const stem = part(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), mat(BROWN, 0.8));
  stem.position.y = 0.95;
  g.add(stem);
  const leaf = part(new THREE.SphereGeometry(0.28, 10, 8), mat(GREEN, 0.7));
  leaf.scale.set(1.6, 0.25, 0.8);
  leaf.position.set(0.28, 1.05, 0);
  leaf.rotation.z = -0.5;
  g.add(leaf);
  return g;
}

function buildBroccoli(color: number): THREE.Group {
  const g = new THREE.Group();
  const stalk = part(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 10), mat(CREAM, 0.8));
  stalk.position.y = -0.45;
  g.add(stalk);
  const crown = part(new THREE.IcosahedronGeometry(0.85, 1), mat(color, 0.75));
  crown.position.y = 0.45;
  g.add(crown);
  return g;
}

function buildMushroom(color: number): THREE.Group {
  const g = new THREE.Group();
  const stalk = part(new THREE.CylinderGeometry(0.42, 0.5, 0.95, 14), mat(CREAM, 0.7));
  stalk.position.y = -0.35;
  g.add(stalk);
  const cap = part(new THREE.SphereGeometry(0.95, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, 0.5));
  cap.scale.set(1, 0.8, 1);
  cap.position.y = 0.12;
  g.add(cap);
  // white spots
  const spot = mat(WHITE, 0.6);
  for (let i = 0; i < 5; i += 1) {
    const s = part(new THREE.SphereGeometry(0.12, 8, 6), spot);
    const a = (i / 5) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.5, 0.42, Math.sin(a) * 0.5);
    g.add(s);
  }
  return g;
}

function buildOnion(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(1, 20, 16), mat(color, 0.5));
  body.scale.set(0.9, 1.25, 0.9);
  g.add(body);
  const sprout = part(new THREE.ConeGeometry(0.12, 0.6, 6), mat(GREEN, 0.7));
  sprout.position.y = 1.2;
  g.add(sprout);
  return g;
}

function buildPepper(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.9, 20, 16), mat(color, 0.45));
  body.scale.set(0.85, 1.35, 0.85);
  body.rotation.z = 0.2;
  g.add(body);
  const stem = part(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 8), mat(GREEN_DARK, 0.7));
  stem.position.set(0.12, 1.1, 0);
  stem.rotation.z = -0.3;
  g.add(stem);
  return g;
}

function buildMelon(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(1, 24, 18), mat(color, 0.55)));
  const stripe = mat(GREEN_DARK, 0.6);
  for (let i = 0; i < 3; i += 1) {
    const s = part(new THREE.TorusGeometry(1.0, 0.06, 6, 28), stripe);
    s.rotation.x = Math.PI / 2;
    s.rotation.y = (i / 3) * Math.PI;
    s.position.y = 0;
    g.add(s);
  }
  return g;
}

function buildEgg(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.CapsuleGeometry(0.62, 0.95, 6, 16), mat(color, 0.4));
  body.scale.set(1, 1, 1.1);
  g.add(body);
  return g;
}

function buildFish(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.95, 22, 16), mat(color, 0.45));
  body.scale.set(1.4, 0.85, 0.7);
  g.add(body);
  const tail = part(new THREE.ConeGeometry(0.5, 0.8, 10), mat(color, 0.45));
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.25;
  tail.scale.set(1, 1, 0.5);
  g.add(tail);
  const fin = part(new THREE.ConeGeometry(0.3, 0.5, 8), mat(color, 0.45));
  fin.position.set(0, 0.6, 0);
  fin.rotation.x = Math.PI;
  g.add(fin);
  // eye
  const eyeW = part(new THREE.SphereGeometry(0.16, 10, 8), mat(WHITE, 0.3));
  eyeW.position.set(0.7, 0.18, 0.42);
  g.add(eyeW);
  const eyeB = part(new THREE.SphereGeometry(0.08, 8, 6), mat(BLACK, 0.3));
  eyeB.position.set(0.82, 0.18, 0.5);
  g.add(eyeB);
  return g;
}

const BUILDERS: Record<ModelKind, (color: number) => THREE.Group> = {
  tomato: buildTomato,
  carrot: buildCarrot,
  corn: buildCorn,
  eggplant: buildEggplant,
  apple: buildApple,
  broccoli: buildBroccoli,
  mushroom: buildMushroom,
  onion: buildOnion,
  pepper: buildPepper,
  melon: buildMelon,
  egg: buildEgg,
  fish: buildFish,
};

/** Build a composed low-poly item group. */
export function buildModelMesh(kind: ModelKind, color: number, scale = 0.62): THREE.Group {
  const g = (BUILDERS[kind] ?? buildTomato)(color);
  g.scale.setScalar(scale);
  return g;
}


/** Build one of the production physical objects for the WebGL pile.
 *
 * Every catalog entry is a real multi-surface 3D mesh. Its quaternion follows
 * the cannon body, so the player sees honest rolling, tumbling and settling —
 * no camera-facing sprites or invisible stand-in visuals. */
export function buildThemeModelMesh(
  themeId: GameThemeId,
  kind: number,
  color: number,
  scale?: number,
): THREE.Group {
  const safeKind = Math.max(0, Math.min(themeOf(themeId).items.length - 1, Math.floor(kind)));
  const authoredKind = themeOf(themeId).items[safeKind]?.modelKind ?? safeKind;
  const normalizedColor = color & 0xffffff;
  const templateKey = `${themeId}:${safeKind}:${normalizedColor}`;
  let template = THEME_MODEL_TEMPLATES.get(templateKey);
  if (!template) {
    template = themeId === "farm-kitchen"
      ? buildFarmKitchenModel(authoredKind, normalizedColor)
      : themeId === "night-market"
        ? buildNightMarketModel(authoredKind, normalizedColor)
        : buildFreshMarketModel(authoredKind, normalizedColor);
    template = mergeTemplateSurfaces(template);
    // A compact center volume makes finger input forgiving for hollow/open
    // models (cup, bowl, doughnut) without changing their visible geometry or
    // their profile-driven cannon collision shape.
    template.add(interactionProxy(new THREE.SphereGeometry(0.3, 8, 6)));
    template.userData.themeId = themeId;
    template.userData.kind = safeKind;
    // Cloned instances share these immutable buffers. The scene disposal path
    // recognizes this marker and leaves them alive for subsequent stream waves.
    template.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.userData.sharedAsset = true;
    });
    THEME_MODEL_TEMPLATES.set(templateKey, template);
  }

  const group = cloneThemeModelTemplate(template);
  group.scale.setScalar(scale ?? physicsProfileOf(themeId, safeKind).visualScale);
  return group;
}

/**
 * Flatten authored nested parts into one mesh per shared material.
 *
 * The source recipes deliberately use many small meshes to make modeling and
 * visual QA readable (a lantern can have separate ribs, caps and tassels).
 * Sending each part as a separate WebGL draw call multiplies that authoring
 * structure by the 54-body mobile pile. Baking every same-material part into a
 * template-local geometry preserves the exact silhouette, PBR materials and
 * independent item animation while cutting the typical item from 8–12 draw
 * calls to 2–6.
 */
function mergeMaterialKey(material: THREE.Material): string {
  const physical = material as THREE.MeshPhysicalMaterial;
  return [
    material.type,
    physical.color?.getHexString?.() ?? "",
    physical.roughness ?? "",
    physical.metalness ?? "",
    physical.clearcoat ?? "",
    physical.clearcoatRoughness ?? "",
    physical.sheen ?? "",
    physical.sheenRoughness ?? "",
    physical.transmission ?? "",
    physical.map?.uuid ?? "no-albedo-map",
    // Surface skins are shared by finish, but two materials with different
    // maps must never be flattened into one geometry bucket. Keep the map
    // identity in the key so a future recipe can opt into a bespoke skin
    // without losing its material response during draw-call merging.
    physical.normalMap?.uuid ?? "no-normal-map",
    physical.roughnessMap?.uuid ?? "no-roughness-map",
    material.userData.surfaceSkin ?? "no-surface-skin",
    material.transparent ? "transparent" : "opaque",
    material.opacity,
    material.side,
    material.depthWrite ? "depth" : "no-depth",
  ].join(":");
}

function mergeTemplateSurfaces(template: THREE.Group): THREE.Group {
  template.updateMatrixWorld(true);
  const rootInverse = template.matrixWorld.clone().invert();
  const sourceMeshes: THREE.Mesh[] = [];
  const surfaces = new Map<
    string,
    {
      material: THREE.Material;
      geometries: THREE.BufferGeometry[];
      castShadow: boolean;
      receiveShadow: boolean;
      detailLayers: Array<{ name: string; geometryType: string }>;
    }
  >();

  template.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.interactionProxy) return;
    // Authored item recipes currently use one material per part. Keep an
    // explicit escape hatch for a future grouped/multi-material geometry
    // instead of silently flattening its material groups incorrectly.
    if (Array.isArray(mesh.material)) return;
    sourceMeshes.push(mesh);
    const materialKey = mergeMaterialKey(mesh.material);
    const surface = surfaces.get(materialKey) ?? {
      material: mesh.material,
      geometries: [],
      castShadow: false,
      receiveShadow: false,
      detailLayers: [],
    };
    const localMatrix = rootInverse.clone().multiply(mesh.matrixWorld);
    const cloned = mesh.geometry.clone();
    const geometry = cloned.index ? cloned.toNonIndexed() : cloned;
    if (geometry !== cloned) cloned.dispose();
    geometry.applyMatrix4(localMatrix);
    surface.geometries.push(geometry);
    surface.castShadow ||= mesh.castShadow;
    surface.receiveShadow ||= mesh.receiveShadow;
    if (typeof mesh.userData.detailLayer === "string") {
      surface.detailLayers.push({
        name: mesh.userData.detailLayer,
        geometryType: mesh.geometry.type,
      });
    }
    surfaces.set(materialKey, surface);
  });

  if (sourceMeshes.length === 0 || surfaces.size === 0) return template;
  const sourcePartCount = sourceMeshes.length;
  const sourceGeometries = new Set(sourceMeshes.map((mesh) => mesh.geometry));
  template.clear();

  let surfaceIndex = 0;
  let shadowCasterCount = 0;
  const nextCastShadow = (surfaceCastShadow: boolean): boolean => {
    if (!surfaceCastShadow || shadowCasterCount >= 2) return false;
    shadowCasterCount += 1;
    return true;
  };
  for (const surface of surfaces.values()) {
    const material = surface.material;
    const merged = surface.geometries.length === 1
      ? surface.geometries[0]!
      : mergeGeometries(surface.geometries, false);
    if (!merged) {
      // Attribute layouts should match for Three primitives, but preserve a
      // correct visible model if a future custom geometry cannot be merged.
      for (const geometry of surface.geometries) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `item-surface-${surfaceIndex++}`;
        mesh.castShadow = nextCastShadow(surface.castShadow);
        mesh.receiveShadow = surface.receiveShadow;
        mesh.userData.detailLayers = surface.detailLayers;
        template.add(mesh);
      }
      continue;
    }
    if (surface.geometries.length > 1) {
      surface.geometries.forEach((geometry) => geometry.dispose());
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `item-surface-${surfaceIndex++}`;
    mesh.castShadow = nextCastShadow(surface.castShadow);
    mesh.receiveShadow = surface.receiveShadow;
    mesh.userData.detailLayers = surface.detailLayers;
    template.add(mesh);
  }

  sourceGeometries.forEach((geometry) => geometry.dispose());
  template.userData.sourcePartCount = sourcePartCount;
  template.userData.mergedSurfaceCount = template.children.length;
  return template;
}

/** Clone transforms recursively while keeping geometry buffers shared.
 *
 * Three's Object3D.clone intentionally shares both geometry and material.
 * Materials cannot be shared here: hint emissive pulses and clear-pop opacity
 * animate an individual object and must never tint its matching copies.
 */
function cloneThemeModelTemplate(template: THREE.Group): THREE.Group {
  const instance = template.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  const cloneMaterial = (material: THREE.Material): THREE.Material => {
    const cached = materials.get(material);
    if (cached) return cached;
    const clone = material.clone();
    materials.set(material, clone);
    return clone;
  };
  instance.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(cloneMaterial)
        : cloneMaterial(mesh.material);
      return;
    }
    const sprite = object as THREE.Sprite;
    if (sprite.isSprite) sprite.material = cloneMaterial(sprite.material) as THREE.SpriteMaterial;
  });
  return instance;
}

/**
 * A small original low-poly goose used for the win celebration.
 *
 * Passing a `variant` (see logic/scenes.ts) dresses the goose in that scene's
 * LIMITED-EDITION accessories — a scarf ring plus a primitive-built hat. Every
 * accessory is composed from Three.js primitives (cones/cylinders/spheres/
 * torus): these remain our own original designs.
 */
export function buildGoose(variant?: GooseVariant): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mat(variant?.body ?? WHITE, 0.5);
  const body = part(new THREE.SphereGeometry(1.1, 22, 18), bodyMat);
  body.scale.set(1.1, 0.95, 1.2);
  body.position.y = -0.2;
  g.add(body);

  const neck = part(new THREE.CylinderGeometry(0.32, 0.42, 1.4, 14), bodyMat);
  neck.position.set(0.55, 0.7, 0);
  neck.rotation.z = -0.35;
  g.add(neck);

  const head = part(new THREE.SphereGeometry(0.5, 18, 14), bodyMat);
  head.position.set(0.95, 1.45, 0);
  g.add(head);

  const beak = part(new THREE.ConeGeometry(0.22, 0.55, 10), mat(ORANGE, 0.5));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(1.5, 1.42, 0);
  g.add(beak);

  const eye = part(new THREE.SphereGeometry(0.08, 8, 6), mat(BLACK, 0.3));
  eye.position.set(1.12, 1.55, 0.28);
  g.add(eye);

  // wing
  const wing = part(new THREE.SphereGeometry(0.6, 14, 10), bodyMat);
  wing.scale.set(0.8, 0.4, 0.5);
  wing.position.set(-0.3, 0.05, 0.7);
  g.add(wing);

  if (variant) {
    // Scarf: a snug torus around the neck base, angled with the neck.
    const scarf = part(new THREE.TorusGeometry(0.42, 0.14, 10, 20), mat(variant.scarf, 0.7));
    scarf.position.set(0.62, 0.32, 0);
    scarf.rotation.x = Math.PI / 2;
    scarf.rotation.y = -0.35;
    g.add(scarf);
    const hat = buildGooseHat(variant);
    // Sit the hat on the crown of the head, tilted with the neck line.
    hat.position.set(0.9, 1.86, 0);
    hat.rotation.z = -0.12;
    g.add(hat);
  }

  return g;
}

/** Primitive-built hats for the limited-edition geese (original designs). */
function buildGooseHat(variant: GooseVariant): THREE.Group {
  const g = new THREE.Group();
  const main = mat(variant.hatColor, 0.65);
  const accent = mat(variant.hatAccent, 0.6);
  switch (variant.hat) {
    case "straw": {
      const brim = part(new THREE.CylinderGeometry(0.62, 0.66, 0.07, 18), main);
      g.add(brim);
      const crown = part(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 16), main);
      crown.position.y = 0.17;
      g.add(crown);
      const band = part(new THREE.CylinderGeometry(0.345, 0.37, 0.1, 16), accent);
      band.position.y = 0.08;
      g.add(band);
      break;
    }
    case "beret": {
      const puff = part(new THREE.SphereGeometry(0.45, 16, 12), main);
      puff.scale.set(1.15, 0.5, 1.15);
      g.add(puff);
      const stalk = part(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8), accent);
      stalk.position.y = 0.26;
      g.add(stalk);
      break;
    }
    case "cap": {
      const dome = part(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), main);
      dome.scale.set(1, 0.75, 1);
      g.add(dome);
      const band = part(new THREE.CylinderGeometry(0.43, 0.44, 0.1, 16), accent);
      band.position.y = 0.02;
      g.add(band);
      const visor = part(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), accent);
      visor.scale.set(1, 1, 0.7);
      visor.position.set(0.36, 0.02, 0);
      g.add(visor);
      break;
    }
    case "beanie": {
      const dome = part(new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), main);
      dome.scale.set(1, 0.9, 1);
      g.add(dome);
      const fold = part(new THREE.CylinderGeometry(0.46, 0.47, 0.14, 16), accent);
      fold.position.y = 0.03;
      g.add(fold);
      const pompom = part(new THREE.SphereGeometry(0.13, 10, 8), accent);
      pompom.position.y = 0.46;
      g.add(pompom);
      break;
    }
    case "party": {
      const cone = part(new THREE.ConeGeometry(0.34, 0.72, 14), main);
      cone.position.y = 0.32;
      g.add(cone);
      const brim = part(new THREE.TorusGeometry(0.32, 0.05, 8, 18), accent);
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 0.0;
      g.add(brim);
      const pompom = part(new THREE.SphereGeometry(0.11, 10, 8), accent);
      pompom.position.y = 0.72;
      g.add(pompom);
      break;
    }
  }
  return g;
}
