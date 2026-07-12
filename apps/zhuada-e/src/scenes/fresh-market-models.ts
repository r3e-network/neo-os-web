import * as THREE from "three";

import {
  capsule,
  extrudedShape,
  finishModel,
  lathe,
  leaf,
  part,
  petalRing,
  roundedBox,
  surface,
  tint,
  tube,
} from "./model-kit";

type Builder = (color: number) => THREE.Group;

const CREAM = 0xfff4d6;
const DARK_GREEN = 0x36592f;
const LEAF_GREEN = 0x6f9f43;
const WOOD = 0x80502d;
const GOLD = 0xe1ac45;
const RED = 0xd94a3c;
const BLUE = 0x327da0;

function sphere(
  radius: number,
  material: THREE.Material,
  widthSegments = 18,
  heightSegments = 13,
): THREE.Mesh {
  return part(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material);
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  segments = 18,
): THREE.Mesh {
  return part(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
}

function horizontalRing(radius: number, thickness: number, material: THREE.Material): THREE.Mesh {
  const ring = part(new THREE.TorusGeometry(radius, thickness, 7, 24), material);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function buildApple(color: number): THREE.Group {
  const group = new THREE.Group();
  const skin = surface(color, "produce", { clearcoat: 0.38 });
  const stemMat = surface(WOOD, "wood");
  const leafMat = surface(LEAF_GREEN, "produce");

  group.add(lathe([
    [0, -0.66], [0.32, -0.7], [0.66, -0.5], [0.75, -0.08],
    [0.69, 0.35], [0.52, 0.61], [0.2, 0.66], [0.07, 0.57], [0, 0.57],
  ], skin, 24));

  const stem = capsule(0.055, 0.48, stemMat);
  stem.position.set(0.03, 0.82, 0);
  stem.rotation.z = -0.14;
  group.add(stem);

  const crownLeaf = leaf(0.45, 0.27, leafMat);
  crownLeaf.rotation.x = -Math.PI / 2;
  crownLeaf.rotation.z = -0.62;
  crownLeaf.position.set(0.24, 0.75, 0.02);
  group.add(crownLeaf);
  return finishModel(group);
}

function buildOrange(color: number): THREE.Group {
  const group = new THREE.Group();
  const peel = surface(color, "produce", { roughness: 0.45, clearcoat: 0.34 });
  const calyx = surface(DARK_GREEN, "produce");

  const body = sphere(0.72, peel, 20, 15);
  body.scale.y = 0.96;
  group.add(body);

  const petals = petalRing(5, 0.13, 0.22, calyx);
  petals.position.y = 0.7;
  group.add(petals);
  const button = cylinder(0.07, 0.1, 0.18, calyx, 10);
  button.position.y = 0.78;
  group.add(button);
  return finishModel(group);
}

function buildLemon(color: number): THREE.Group {
  const group = new THREE.Group();
  const peel = surface(color, "produce", { clearcoat: 0.28 });
  const tip = surface(tint(color, -0.12), "produce");
  const leafMat = surface(LEAF_GREEN, "produce");

  const body = lathe([
    [0, -0.82], [0.32, -0.68], [0.53, -0.32], [0.57, 0],
    [0.53, 0.32], [0.32, 0.68], [0, 0.82],
  ], peel, 24);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  const blossom = sphere(0.09, tip, 10, 7);
  blossom.position.x = -0.83;
  group.add(blossom);
  const stem = cylinder(0.055, 0.08, 0.2, leafMat, 9);
  stem.rotation.z = Math.PI / 2;
  stem.position.x = 0.85;
  group.add(stem);
  const lemonLeaf = leaf(0.38, 0.22, leafMat);
  lemonLeaf.rotation.set(-Math.PI / 2, 0.18, 0.62);
  lemonLeaf.position.set(0.63, 0.18, 0);
  group.add(lemonLeaf);
  return finishModel(group);
}

function buildMushroom(color: number): THREE.Group {
  const group = new THREE.Group();
  const capMat = surface(color, "produce", { roughness: 0.52, clearcoat: 0.16 });
  const capDark = surface(tint(color, -0.18), "matte");
  const stalkMat = surface(CREAM, "matte", { roughness: 0.82 });

  const stalk = lathe([
    [0.23, -0.7], [0.34, -0.62], [0.3, 0.12], [0.22, 0.42], [0, 0.48],
  ], stalkMat, 18);
  group.add(stalk);

  const cap = lathe([
    [0, 0.2], [0.36, 0.18], [0.68, 0.02], [0.82, -0.24],
    [0.76, -0.34], [0.28, -0.3], [0, -0.27],
  ], capMat, 24);
  cap.position.y = 0.48;
  group.add(cap);

  const gills = horizontalRing(0.55, 0.045, capDark);
  gills.position.y = 0.18;
  group.add(gills);
  for (const [x, z, scale] of [[-0.3, 0.25, 1], [0.22, 0.34, 0.8], [0.38, -0.16, 0.72]] as const) {
    const spot = sphere(0.08, stalkMat, 9, 7);
    spot.scale.set(scale, 0.42, scale);
    spot.position.set(x, 0.71, z);
    group.add(spot);
  }
  return finishModel(group);
}

function buildBaguette(color: number): THREE.Group {
  const group = new THREE.Group();
  const crust = surface(color, "paper", { roughness: 0.58, clearcoat: 0.12 });
  const toasted = surface(tint(color, -0.22), "matte");
  const crumb = surface(tint(color, 0.18), "paper");

  const loaf = capsule(0.31, 1.72, crust, "x");
  loaf.scale.z = 0.82;
  group.add(loaf);
  for (const x of [-0.46, 0, 0.46]) {
    const cut = capsule(0.035, 0.44, toasted, "z");
    cut.position.set(x, 0.285, 0);
    cut.rotation.y = -0.38;
    group.add(cut);
    const inner = capsule(0.018, 0.31, crumb, "z");
    inner.position.set(x - 0.01, 0.314, 0);
    inner.rotation.y = -0.38;
    group.add(inner);
  }
  return finishModel(group);
}

function buildCup(color: number): THREE.Group {
  const group = new THREE.Group();
  const ceramic = surface(color, "ceramic");
  const inside = surface(tint(color, -0.22), "ceramic");
  const accent = surface(LEAF_GREEN, "glaze");

  group.add(lathe([
    [0, -0.56], [0.38, -0.56], [0.45, -0.45], [0.49, 0.5],
    [0.43, 0.58], [0.35, 0.45], [0.32, -0.42], [0, -0.42],
  ], ceramic, 24));
  const opening = cylinder(0.34, 0.34, 0.035, inside, 20);
  opening.position.y = 0.54;
  group.add(opening);
  const rim = horizontalRing(0.44, 0.045, accent);
  rim.position.y = 0.56;
  group.add(rim);
  group.add(tube([
    new THREE.Vector3(0.45, 0.3, 0),
    new THREE.Vector3(0.72, 0.28, 0),
    new THREE.Vector3(0.75, -0.2, 0),
    new THREE.Vector3(0.46, -0.3, 0),
  ], 0.07, ceramic, 18, 7));

  const emblem = leaf(0.28, 0.16, accent);
  emblem.position.set(0, 0.02, 0.48);
  emblem.rotation.z = -0.5;
  group.add(emblem);
  return finishModel(group);
}

function buildTeaTin(color: number): THREE.Group {
  const group = new THREE.Group();
  const enamel = surface(tint(color, 0.1), "metal", { metalness: 0.3, roughness: 0.34 });
  const dark = surface(tint(color, 0.18), "metal", { metalness: 0.24, roughness: 0.36 });
  const gold = surface(GOLD, "metal");
  const emblemMat = surface(0xdfe9a7, "glaze");

  const base = roundedBox(1.16, 0.92, 0.82, 0.14, enamel, 4);
  base.position.y = -0.08;
  group.add(base);
  const lid = roundedBox(1.22, 0.18, 0.88, 0.14, dark, 4);
  lid.position.y = 0.49;
  group.add(lid);
  for (const z of [-0.43, 0.43]) {
    const trim = roundedBox(1.05, 0.045, 0.04, 0.015, gold, 2);
    trim.position.set(0, 0.58, z);
    group.add(trim);
  }
  for (const x of [-0.59, 0.59]) {
    const trim = roundedBox(0.04, 0.045, 0.75, 0.015, gold, 2);
    trim.position.set(x, 0.58, 0);
    group.add(trim);
  }
  for (const [x, rotation] of [[-0.14, -0.56], [0.14, 0.56]] as const) {
    const mark = leaf(0.32, 0.16, emblemMat);
    mark.position.set(x, -0.02, 0.43);
    mark.rotation.z = rotation;
    group.add(mark);
  }
  return finishModel(group);
}

function buildToyBoat(color: number): THREE.Group {
  const group = new THREE.Group();
  const hullMat = surface(color || BLUE, "glaze");
  const deckMat = surface(0xb87943, "wood");
  const mastMat = surface(WOOD, "wood");
  const sailRed = surface(RED, "fabric");
  const sailCream = surface(CREAM, "fabric");

  const hull = extrudedShape([
    [-0.82, 0.18], [0.62, 0.18], [0.84, 0.34], [0.56, -0.18], [-0.5, -0.3],
  ], 0.56, 0.08, hullMat);
  hull.position.y = -0.24;
  group.add(hull);
  const deck = roundedBox(1.18, 0.12, 0.46, 0.08, deckMat, 3);
  deck.position.y = 0.02;
  group.add(deck);
  const stripe = roundedBox(1.22, 0.075, 0.58, 0.04, sailCream, 2);
  stripe.position.y = -0.12;
  group.add(stripe);
  const mast = capsule(0.045, 1.2, mastMat);
  mast.position.set(0.05, 0.55, 0.03);
  group.add(mast);

  const largeSail = extrudedShape([[0, 0], [0, 0.85], [0.58, 0.04]], 0.075, 0.025, sailRed);
  largeSail.position.set(0.35, 0.65, 0.03);
  group.add(largeSail);
  const smallSail = extrudedShape([[0, 0], [0, 0.66], [-0.38, 0.04]], 0.07, 0.022, sailCream);
  smallSail.position.set(-0.17, 0.58, 0.03);
  group.add(smallSail);
  return finishModel(group);
}

function buildCandy(color: number): THREE.Group {
  const group = new THREE.Group();
  const candy = surface(color, "glaze", { clearcoat: 0.88, clearcoatRoughness: 0.1 });
  const wrapper = surface(tint(color, 0.12), "paper");
  const twist = surface(tint(color, -0.18), "glaze");

  const center = capsule(0.36, 0.86, candy, "x");
  group.add(center);
  const left = extrudedShape([[0.02, 0], [-0.42, 0.33], [-0.36, -0.32]], 0.22, 0.055, wrapper);
  left.position.x = -0.61;
  group.add(left);
  const right = extrudedShape([[-0.02, 0], [0.42, 0.33], [0.36, -0.32]], 0.22, 0.055, wrapper);
  right.position.x = 0.61;
  group.add(right);
  for (const x of [-0.42, 0.42]) {
    const band = part(new THREE.TorusGeometry(0.25, 0.035, 6, 18), twist);
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    group.add(band);
  }
  const glint = capsule(0.025, 0.3, surface(0xfff2f5, "glaze"), "x");
  glint.position.set(-0.08, 0.22, 0.27);
  group.add(glint);
  return finishModel(group);
}

function buildPear(color: number): THREE.Group {
  const group = new THREE.Group();
  const skin = surface(color, "produce", { clearcoat: 0.3 });
  const stemMat = surface(WOOD, "wood");
  const leafMat = surface(DARK_GREEN, "produce");

  group.add(lathe([
    [0, -0.72], [0.38, -0.72], [0.66, -0.45], [0.68, -0.1],
    [0.5, 0.28], [0.28, 0.48], [0.18, 0.68], [0, 0.72],
  ], skin, 24));
  const stem = capsule(0.05, 0.45, stemMat);
  stem.position.set(0.03, 0.88, 0);
  stem.rotation.z = -0.12;
  group.add(stem);
  const pearLeaf = leaf(0.38, 0.22, leafMat);
  pearLeaf.rotation.x = -Math.PI / 2;
  pearLeaf.rotation.z = -0.72;
  pearLeaf.position.set(0.24, 0.79, 0);
  group.add(pearLeaf);
  const blush = sphere(0.09, surface(tint(color, 0.16), "glaze"), 9, 7);
  blush.scale.set(1.5, 0.45, 1);
  blush.position.set(-0.25, 0.02, 0.57);
  group.add(blush);
  return finishModel(group);
}

function buildDonut(color: number): THREE.Group {
  const group = new THREE.Group();
  const dough = surface(color, "paper", { roughness: 0.56 });
  const icing = surface(0xf09ab5, "glaze", { clearcoat: 0.7 });
  const dark = surface(tint(color, -0.2), "matte");

  const body = part(new THREE.TorusGeometry(0.48, 0.25, 12, 28), dough);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const glaze = part(new THREE.TorusGeometry(0.48, 0.21, 10, 28), icing);
  glaze.rotation.x = Math.PI / 2;
  glaze.scale.y = 0.74;
  glaze.position.y = 0.12;
  group.add(glaze);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + 0.18;
    const sprinkle = capsule(0.018, 0.16, i % 2 === 0 ? dark : surface(0xfff0a8, "glaze"), "x");
    sprinkle.position.set(Math.cos(angle) * 0.48, 0.31, Math.sin(angle) * 0.48);
    sprinkle.rotation.y = angle + 0.7;
    group.add(sprinkle);
  }
  return finishModel(group);
}

function buildEgg(color: number): THREE.Group {
  const group = new THREE.Group();
  const shell = surface(color, "produce", { roughness: 0.42, clearcoat: 0.16 });
  const speckle = surface(tint(color, -0.16), "matte");
  const shine = surface(0xffffff, "glaze", { clearcoat: 0.9 });

  group.add(lathe([
    [0, -0.73], [0.36, -0.66], [0.55, -0.32], [0.57, 0.02],
    [0.48, 0.38], [0.28, 0.68], [0, 0.8],
  ], shell, 24));
  for (const [x, y] of [[-0.2, -0.05], [0.18, -0.25], [0.1, 0.22]] as const) {
    const dot = sphere(0.035, speckle, 8, 6);
    dot.scale.z = 0.42;
    dot.position.set(x, y, 0.53);
    group.add(dot);
  }
  const highlight = sphere(0.09, shine, 10, 7);
  highlight.scale.set(0.55, 1.6, 0.35);
  highlight.position.set(-0.19, 0.25, 0.48);
  group.add(highlight);
  return finishModel(group);
}

const BUILDERS: readonly Builder[] = [
  buildApple,
  buildOrange,
  buildLemon,
  buildMushroom,
  buildBaguette,
  buildCup,
  buildTeaTin,
  buildToyBoat,
  buildCandy,
  buildPear,
  buildDonut,
  buildEgg,
];

/** Build one original, fully modeled Fresh Market object (logical kinds 0..11). */
export function buildFreshMarketModel(kind: number, color: number): THREE.Group {
  const safeKind = Math.max(0, Math.min(BUILDERS.length - 1, Math.floor(kind)));
  return BUILDERS[safeKind]!(color);
}
