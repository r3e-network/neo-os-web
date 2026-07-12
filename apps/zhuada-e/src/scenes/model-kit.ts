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
  return new THREE.MeshPhysicalMaterial({ color, ...params });
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
    if (!(material as THREE.Material | undefined)?.transparent) shadowCandidates.push(mesh);
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
