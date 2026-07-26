import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type SurfaceFinish =
  | "matte"
  | "produce"
  | "glaze"
  | "ceramic"
  | "metal"
  | "wood"
  | "fabric"
  | "paper";

const FINISH: Record<SurfaceFinish, Partial<THREE.MeshPhysicalMaterialParameters>> = {
  matte: { roughness: 0.7, metalness: 0.01, clearcoat: 0.04 },
  produce: { roughness: 0.5, metalness: 0, clearcoat: 0.24, clearcoatRoughness: 0.32 },
  glaze: { roughness: 0.27, metalness: 0, clearcoat: 0.72, clearcoatRoughness: 0.16 },
  ceramic: { roughness: 0.22, metalness: 0, clearcoat: 0.82, clearcoatRoughness: 0.12 },
  metal: { roughness: 0.24, metalness: 0.72, clearcoat: 0.38, clearcoatRoughness: 0.2 },
  wood: { roughness: 0.74, metalness: 0, clearcoat: 0.06 },
  fabric: { roughness: 0.92, metalness: 0, clearcoat: 0, sheen: 0.55, sheenRoughness: 0.84 },
  paper: { roughness: 0.82, metalness: 0, clearcoat: 0 },
};

type SurfaceSkin = {
  albedoMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  normalStrength: number;
};

/**
 * Small, procedural material skins shared by every authored surface.
 *
 * The item recipes intentionally stay geometry-first so their silhouettes are
 * readable in a crowded, tumbling basket. These maps add the missing physical
 * response without painting identity stripes, logos, dots or diagonal badges
 * onto the objects. A 32px tile is enough to catch the overhead light and is
 * cheap to reuse across all 54 catalogue identities and their variants.
 */
const SURFACE_SKINS = new Map<string, SurfaceSkin>();
const SKIN_VARIANT_COUNT = 6;

const SKIN_PROFILE: Record<SurfaceFinish, {
  albedoVariation: number;
  roughnessVariation: number;
  normalStrength: number;
  grain: number;
  frequency: number;
}> = {
  matte: { albedoVariation: 0.2, roughnessVariation: 0.16, normalStrength: 0.34, grain: 0.62, frequency: 2 },
  produce: { albedoVariation: 0.19, roughnessVariation: 0.17, normalStrength: 0.31, grain: 0.68, frequency: 3 },
  glaze: { albedoVariation: 0.1, roughnessVariation: 0.08, normalStrength: 0.14, grain: 0.46, frequency: 2 },
  ceramic: { albedoVariation: 0.11, roughnessVariation: 0.09, normalStrength: 0.16, grain: 0.5, frequency: 2 },
  metal: { albedoVariation: 0.15, roughnessVariation: 0.15, normalStrength: 0.24, grain: 0.68, frequency: 5 },
  wood: { albedoVariation: 0.28, roughnessVariation: 0.24, normalStrength: 0.5, grain: 1, frequency: 3 },
  fabric: { albedoVariation: 0.23, roughnessVariation: 0.18, normalStrength: 0.48, grain: 0.94, frequency: 7 },
  paper: { albedoVariation: 0.18, roughnessVariation: 0.2, normalStrength: 0.36, grain: 0.8, frequency: 5 },
};

/**
 * Finish-specific microstructure. These are material cues, not identity marks:
 * produce gets a pebbled skin, glaze a soft orange-peel response, ceramic a
 * cloudy fired surface, metal fine brushing, wood directional grain, fabric a
 * true over-under weave and paper short crossing fibres.
 */
function materialMicrostructure(
  finish: SurfaceFinish,
  u: number,
  v: number,
  variant: number,
): number {
  const phase = variant * 0.71;
  switch (finish) {
    case "produce":
      return Math.sin((u * 29 + phase) * Math.PI * 2)
        * Math.sin((v * 31 - phase * 0.7) * Math.PI * 2) * 0.2;
    case "glaze":
      return Math.sin((u * 11 + phase) * Math.PI * 2)
        * Math.cos((v * 13 - phase) * Math.PI * 2) * 0.08;
    case "ceramic":
      return (
        Math.sin((u * 5 + phase) * Math.PI * 2)
        + Math.cos((v * 7 - phase * 0.6) * Math.PI * 2)
      ) * 0.055;
    case "metal":
      return Math.sin((v * 47 + phase) * Math.PI * 2) * 0.12;
    case "wood":
      return Math.sin(
        (u * 7 + Math.sin((v * 3 + phase) * Math.PI * 2) * 0.13 + phase) * Math.PI * 2,
      ) * 0.26;
    case "fabric":
      return (
        Math.sin((u * 22 + phase) * Math.PI * 2)
        + Math.sin((v * 22 - phase) * Math.PI * 2)
      ) * 0.14;
    case "paper":
      return (
        Math.sin((u * 37 + phase) * Math.PI * 2)
        + Math.sin((v * 41 - phase * 0.8) * Math.PI * 2)
      ) * 0.07;
    default:
      return Math.sin((u * 23 + phase) * Math.PI * 2)
        * Math.cos((v * 19 - phase) * Math.PI * 2) * 0.1;
  }
}

function skinHeight(
  finish: SurfaceFinish,
  x: number,
  y: number,
  size: number,
  variant: number,
): number {
  const profile = SKIN_PROFILE[finish];
  const phaseU = ((variant * 17) % 31) / 31;
  const phaseV = ((variant * 23) % 37) / 37;
  const u = x / size + phaseU;
  const v = y / size + phaseV;
  const broad = Math.sin((u * profile.frequency + 0.21) * Math.PI * 2)
    * Math.cos((v * profile.frequency - 0.16) * Math.PI * 2);
  const fine = Math.sin((u * (profile.frequency + 4) + 0.13) * Math.PI * 2)
    * Math.cos((v * (profile.frequency + 5) - 0.27) * Math.PI * 2);
  const cross = finish === "fabric"
    ? Math.sin(u * Math.PI * 2 * profile.frequency * 2) * 0.18
      + Math.sin(v * Math.PI * 2 * profile.frequency * 2) * 0.18
    : 0;
  const directional = finish === "wood"
    ? Math.sin((u * profile.frequency + Math.sin(v * Math.PI * 4) * 0.08) * Math.PI * 2) * 0.52
    : finish === "metal"
      ? Math.sin(v * Math.PI * profile.frequency * 6) * 0.08
    : 0;
  const smoothFinish = finish === "glaze" || finish === "ceramic";
  const microstructure = materialMicrostructure(finish, u, v, variant);
  return (
    broad * (smoothFinish ? 0.16 : 0.32)
    + fine * 0.09
    + cross
    + directional * 0.28
    + microstructure
  ) * profile.grain;
}

function skinPigment(
  finish: SurfaceFinish,
  x: number,
  y: number,
  size: number,
  variant: number,
): number {
  const profile = SKIN_PROFILE[finish];
  const phaseU = ((variant * 19) % 29) / 29;
  const phaseV = ((variant * 13) % 41) / 41;
  const u = x / size + phaseU;
  const v = y / size + phaseV;
  const cloud = Math.sin((u * profile.frequency + 0.18) * Math.PI * 2)
    * Math.cos((v * profile.frequency - 0.12) * Math.PI * 2);
  // Blend waves travelling in different directions into an organic field.
  // A single diagonal wave reads as a painted slash on tiny objects, while
  // this interference pattern reads as pigment, glaze or natural skin.
  const organic = (
    Math.sin((u * (profile.frequency + 1) + Math.sin(v * Math.PI * 2) * 0.34) * Math.PI * 2)
    + Math.cos((v * (profile.frequency + 2) + Math.sin(u * Math.PI * 2) * 0.29) * Math.PI * 2)
    + Math.sin(((u - 0.5) ** 2 + (v - 0.5) ** 2) * Math.PI * (profile.frequency + 3))
  ) / 3;
  const grain = finish === "wood"
    ? Math.sin((u * 3 + Math.sin(v * Math.PI * 4) * 0.08) * Math.PI * 2) * 0.36
    : finish === "fabric"
      ? (Math.sin(u * Math.PI * 14) + Math.sin(v * Math.PI * 14)) * 0.08
      : 0;
  const microstructure = materialMicrostructure(finish, u, v, variant);
  return (cloud * 0.44 + organic * 0.3 + grain + microstructure * 0.38) * profile.grain;
}

function skinVariantFor(color: THREE.ColorRepresentation): number {
  const hex = new THREE.Color(color).getHex();
  const mixed = Math.imul(hex ^ (hex >>> 8), 0x45d9f3b);
  return Math.abs(mixed ^ (mixed >>> 16)) % SKIN_VARIANT_COUNT;
}

function makeSurfaceSkin(
  finish: SurfaceFinish,
  color: THREE.ColorRepresentation,
): SurfaceSkin {
  const variant = skinVariantFor(color);
  const skinKey = `${finish}:${variant}`;
  const cached = SURFACE_SKINS.get(skinKey);
  if (cached) return cached;

  const size = 64;
  const profile = SKIN_PROFILE[finish];
  const albedoData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number) => skinHeight(
    finish,
    (x + size) % size,
    (y + size) % size,
    size,
    variant,
  );
  const baseRoughness = FINISH[finish].roughness ?? 0.6;
  const channel = (value: number) => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const height = skinHeight(finish, x, y, size, variant);
      const pigment = skinPigment(finish, x, y, size, variant);
      // Neutral albedo variation lets the authored colour remain the source
      // of identity while giving the surface a broad, tactile pigment/wood/
      // paper response. It is deliberately low contrast: no stripes, logos,
      // dots or diagonal marks can appear at item scale.
      const tone = THREE.MathUtils.clamp(
        0.955 + pigment * profile.albedoVariation,
        0.78,
        1,
      );
      const warm = finish === "wood" || finish === "paper";
      const cool = finish === "glaze" || finish === "ceramic" || finish === "metal";
      const pigmentLift = THREE.MathUtils.clamp(pigment, -1, 1);
      // Finish-specific channel shifts make the skin read as a real material
      // rather than a grey noise layer multiplied over a flat colour. The
      // shifts follow the surface itself (warm wood/paper fibres, cool fired
      // glaze/metal highlights and green-gold produce variation), so they
      // remain material cues instead of arbitrary identity markings.
      const red = warm
        ? 1 + pigmentLift * 0.04
        : cool
          ? 0.985 - pigmentLift * 0.012
          : 1 + pigmentLift * 0.018;
      const green = finish === "wood"
        ? 0.95 - pigmentLift * 0.025
        : finish === "produce"
          ? 1 + pigmentLift * 0.035
          : 1;
      const blue = finish === "wood"
        ? 0.84 - pigmentLift * 0.045
        : finish === "paper"
          ? 0.93 - pigmentLift * 0.018
          : cool
            ? 1 + pigmentLift * 0.03
            : 0.985;
      albedoData[index] = channel(tone * red);
      albedoData[index + 1] = channel(tone * green);
      albedoData[index + 2] = channel(tone * blue);
      albedoData[index + 3] = 255;
      const dx = sample(x + 1, y) - sample(x - 1, y);
      const dy = sample(x, y + 1) - sample(x, y - 1);
      // Encode a full tangent-space normal once, then let material.normalScale
      // own the per-finish strength. The old implementation applied the
      // strength here and again on the material, squaring it into near-flat
      // shading at mobile scale.
      const normal = new THREE.Vector3(-dx * 1.65, -dy * 1.65, 1).normalize();
      normalData[index] = Math.round((normal.x * 0.5 + 0.5) * 255);
      normalData[index + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      normalData[index + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      normalData[index + 3] = 255;

      const roughness = THREE.MathUtils.clamp(
        baseRoughness + height * profile.roughnessVariation,
        0.06,
        0.98,
      );
      const roughnessByte = Math.round(roughness * 255);
      roughnessData[index] = roughnessByte;
      roughnessData[index + 1] = roughnessByte;
      roughnessData[index + 2] = roughnessByte;
      roughnessData[index + 3] = 255;
    }
  }

  const albedoMap = new THREE.DataTexture(albedoData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  albedoMap.name = `goose-skin-albedo-${finish}-${variant}`;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  const repeat = finish === "fabric" ? 2.1 : finish === "metal" ? 1.7 : 1.2;
  albedoMap.repeat.set(repeat, repeat);
  albedoMap.needsUpdate = true;

  const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  normalMap.name = `goose-skin-normal-${finish}-${variant}`;
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(repeat, repeat);
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughnessData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  roughnessMap.name = `goose-skin-roughness-${finish}-${variant}`;
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.copy(normalMap.repeat);
  roughnessMap.needsUpdate = true;

  const skin = { albedoMap, normalMap, roughnessMap, normalStrength: profile.normalStrength };
  SURFACE_SKINS.set(skinKey, skin);
  return skin;
}

export function tint(color: THREE.ColorRepresentation, lightnessDelta = 0): number {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, lightnessDelta);
  return c.getHex();
}

export function surface(
  color: THREE.ColorRepresentation,
  finish: SurfaceFinish = "matte",
  options: Partial<THREE.MeshPhysicalMaterialParameters> = {},
): THREE.MeshPhysicalMaterial {
  const params = { ...FINISH[finish], ...options };
  if (finish === "fabric" && params.sheenColor === undefined) params.sheenColor = new THREE.Color(tint(color, 0.18));
  const skinVariant = skinVariantFor(color);
  const skin = makeSurfaceSkin(finish, color);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    ...params,
    map: params.map ?? skin.albedoMap,
    normalMap: params.normalMap ?? skin.normalMap,
    roughnessMap: params.roughnessMap ?? skin.roughnessMap,
  });
  material.normalScale.setScalar(skin.normalStrength);
  material.userData.surfaceFinish = finish;
  material.userData.surfaceSkin = `goose-skin-v5:${finish}:${skinVariant}`;
  material.userData.surfaceSkinVariant = skinVariant;
  return material;
}

export function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
): THREE.Mesh {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material | THREE.Material[],
  smoothness = 4,
): THREE.Mesh {
  return part(new RoundedBoxGeometry(width, height, depth, smoothness, radius), material);
}

export function capsule(
  radius: number,
  length: number,
  material: THREE.Material,
  axis: "x" | "y" | "z" = "y",
): THREE.Mesh {
  const mesh = part(new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 8, 18), material);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  return mesh;
}

export function lathe(
  profile: ReadonlyArray<readonly [radius: number, y: number]>,
  material: THREE.Material | THREE.Material[],
  segments = 28,
): THREE.Mesh {
  return part(
    new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments),
    material,
  );
}

export function tube(
  points: ReadonlyArray<THREE.Vector3>,
  radius: number,
  material: THREE.Material,
  tubularSegments = 24,
  radialSegments = 8,
  closed = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.clone()), closed, "catmullrom", 0.44);
  return part(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed), material);
}

export function extrudedShape(
  points: ReadonlyArray<readonly [x: number, y: number]>,
  depth: number,
  bevel: number,
  material: THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 12,
  });
  geometry.center();
  return part(geometry, material);
}

export function leaf(
  length: number,
  width: number,
  material: THREE.Material,
): THREE.Mesh {
  const points: Array<readonly [number, number]> = [
    [0, length * 0.52],
    [width * 0.52, length * 0.1],
    [width * 0.36, -length * 0.35],
    [0, -length * 0.52],
    [-width * 0.36, -length * 0.35],
    [-width * 0.52, length * 0.1],
  ];
  return extrudedShape(points, 0.055, 0.025, material);
}

/** Invisible, non-shadowing tap volume for naturally hollow silhouettes such
 * as a doughnut. It never substitutes the rendered model or physics collider;
 * it only prevents a finger aimed at a tiny visual hole from missing. */
export function interactionProxy(geometry: THREE.BufferGeometry): THREE.Mesh {
  const proxy = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    visible: false,
  }));
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  proxy.userData.interactionProxy = true;
  return proxy;
}

export function petalRing(
  count: number,
  radius: number,
  petalLength: number,
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const petal = roundedBox(petalLength, 0.11, petalLength * 0.42, petalLength * 0.18, material, 3);
    petal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    petal.rotation.y = -angle;
    group.add(petal);
  }
  return group;
}

export function finishModel(source: THREE.Group, targetMax = 1.38): THREE.Group {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetMax / longest;
  source.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  source.scale.setScalar(scale);
  const root = new THREE.Group();
  root.add(source);
  root.userData.productionModel = true;
  const shadowCandidates: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.interactionProxy) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    // Runtime items must never reveal the basket through semi-transparent
    // shells. Glass-like bottles keep their glossy tint and layered labels,
    // but are rendered as solid collectibles from every rolling angle.
    const productionMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    productionMaterials.forEach((entry) => {
      entry.transparent = false;
      entry.opacity = 1;
      entry.depthWrite = true;
      const physical = entry as THREE.MeshPhysicalMaterial;
      if (physical.isMeshPhysicalMaterial) physical.transmission = 0;
    });
    if (material) shadowCandidates.push(mesh);
  });
  // Two silhouette-defining parts are enough for grounded contact shadows.
  // Small seams, sprinkles and handles remain lit PBR geometry but no longer
  // multiply the mobile shadow pass by every detail mesh.
  shadowCandidates
    .sort((a, b) => vertexCount(b.geometry) - vertexCount(a.geometry))
    .slice(0, 2)
    .forEach((mesh) => { mesh.castShadow = true; });
  return root;
}

function vertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute("position")?.count ?? 0;
}

export function addGrooves(
  group: THREE.Group,
  axis: "x" | "y" | "z",
  count: number,
  span: number,
  radius: number,
  material: THREE.Material,
): void {
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const ring = part(new THREE.TorusGeometry(radius, 0.025, 5, 28), material);
    if (axis === "y") ring.rotation.x = Math.PI / 2;
    if (axis === "x") ring.rotation.y = Math.PI / 2;
    if (axis === "x") ring.position.x = t * span;
    if (axis === "y") ring.position.y = t * span;
    if (axis === "z") ring.position.z = t * span;
    group.add(ring);
  }
}

export function randomSprinkles(
  group: THREE.Group,
  seed: number,
  count: number,
  radius: number,
  y: number,
  palette: readonly number[],
): void {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) >>> 0;
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i += 1) {
    const a = next() * Math.PI * 2;
    const r = Math.sqrt(next()) * radius;
    const sprinkle = capsule(0.018, 0.16, surface(palette[i % palette.length]!, "glaze"), "x");
    sprinkle.position.set(Math.cos(a) * r, y + next() * 0.03, Math.sin(a) * r);
    sprinkle.rotation.y = a + next();
    group.add(sprinkle);
  }
}
