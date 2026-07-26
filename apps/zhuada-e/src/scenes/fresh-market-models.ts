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
  const end = surface(tint(color, 0.12), "paper", { roughness: 0.68 });

  const loaf = capsule(0.31, 1.72, crust, "x");
  loaf.scale.z = 0.82;
  group.add(loaf);
  // Two broad, slightly lighter end faces give the loaf real volume after a
  // tumble. They are part of the bread silhouette, not painted identity
  // slashes, so the object stays clean in a dense pile.
  for (const x of [-0.86, 0.86]) {
    const endFace = part(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18), end);
    endFace.rotation.z = Math.PI / 2;
    endFace.position.x = x;
    group.add(endFace);
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

  // The cup is identified by its tall silhouette, handle and broad colour
  // block. Avoid a small diagonal badge on the face: at pile scale it reads as
  // an arbitrary identity slash rather than part of the cup.
  return finishModel(group);
}

function buildTeaTin(color: number): THREE.Group {
  const group = new THREE.Group();
  const enamel = surface(tint(color, 0.1), "metal", { metalness: 0.3, roughness: 0.34 });
  const dark = surface(tint(color, 0.18), "metal", { metalness: 0.24, roughness: 0.36 });
  const label = surface(CREAM, "paper");

  const base = roundedBox(1.16, 0.92, 0.82, 0.14, enamel, 4);
  base.position.y = -0.08;
  group.add(base);
  const lid = roundedBox(1.22, 0.18, 0.88, 0.14, dark, 4);
  lid.position.y = 0.49;
  group.add(lid);
  // The tin tumbles freely, so both broad faces keep the same broad colour
  // panel. There is no tiny emblem or diagonal identity stroke on top.
  for (const facing of [-1, 1] as const) {
    const panel = roundedBox(0.72, 0.5, 0.045, 0.11, label, 4);
    panel.position.set(0, -0.04, facing * 0.43);
    panel.rotation.y = facing < 0 ? Math.PI : 0;
    panel.userData.detailLayer = "tea-tin-label";
    group.add(panel);
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

  const center = capsule(0.36, 0.86, candy, "x");
  group.add(center);
  const left = extrudedShape([[0.02, 0], [-0.42, 0.33], [-0.36, -0.32]], 0.22, 0.055, wrapper);
  left.position.x = -0.61;
  group.add(left);
  const right = extrudedShape([[-0.02, 0], [0.42, 0.33], [0.36, -0.32]], 0.22, 0.055, wrapper);
  right.position.x = 0.61;
  group.add(right);
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
  return finishModel(group);
}

function buildDonut(color: number): THREE.Group {
  const group = new THREE.Group();
  const dough = surface(color, "paper", { roughness: 0.56 });
  const icing = surface(0xf09ab5, "glaze", { clearcoat: 0.7 });

  // Filled doughnut / soft pastry: the previous torus exposed the basket
  // through its center from both face-on and rolled angles, reading as a
  // missing texture. A closed, pillowy body keeps the pastry silhouette while
  // a raised icing cap and center rosette preserve its visual identity.
  const body = sphere(0.7, dough, 24, 18);
  body.scale.set(1, 0.48, 1);
  group.add(body);

  const glaze = sphere(0.62, icing, 22, 16);
  glaze.scale.set(0.96, 0.2, 0.96);
  glaze.position.y = 0.31;
  group.add(glaze);

  // A broad lower pastry edge gives the filled bun a readable layered volume
  // after it rolls, without adding sprinkles, seams or identity marks.
  const underside = sphere(0.64, surface(tint(color, -0.08), "paper"), 22, 14);
  underside.scale.set(0.96, 0.13, 0.96);
  underside.position.y = -0.28;
  group.add(underside);

  return finishModel(group);
}

function buildEgg(color: number): THREE.Group {
  const group = new THREE.Group();
  const shell = surface(color, "produce", { roughness: 0.42, clearcoat: 0.16 });
  const shine = surface(0xffffff, "glaze", { clearcoat: 0.9 });

  group.add(lathe([
    [0, -0.73], [0.36, -0.66], [0.55, -0.32], [0.57, 0.02],
    [0.48, 0.38], [0.28, 0.68], [0, 0.8],
  ], shell, 24));
  const underside = sphere(0.45, surface(tint(color, -0.06), "produce"), 18, 12);
  underside.scale.set(1.08, 0.42, 1.08);
  underside.position.y = -0.42;
  group.add(underside);
  const highlight = sphere(0.09, shine, 10, 7);
  highlight.scale.set(0.55, 1.6, 0.35);
  highlight.position.set(-0.19, 0.25, 0.48);
  group.add(highlight);
  return finishModel(group);
}

function buildStrawberryBasket(color: number): THREE.Group {
  const group = new THREE.Group();
  const berry = surface(color, "produce", { clearcoat: 0.42 });
  const leafMat = surface(LEAF_GREEN, "produce");
  const wicker = surface(0xa86c39, "wood");
  const basket = roundedBox(1.25, 0.36, 0.9, 0.18, wicker, 4);
  basket.position.y = -0.42;
  group.add(basket);
  group.add(tube([
    new THREE.Vector3(-0.48, -0.28, 0),
    new THREE.Vector3(-0.42, 0.52, 0),
    new THREE.Vector3(0.42, 0.52, 0),
    new THREE.Vector3(0.48, -0.28, 0),
  ], 0.06, wicker, 20, 7));
  ([[-0.36, 0.03, 0.14], [0.02, 0.11, -0.1], [0.35, -0.02, 0.16], [0.14, -0.04, 0.3]] as const).forEach(([x, y, z]) => {
    const fruit = sphere(0.28, berry);
    fruit.scale.y = 1.14;
    fruit.position.set(x, y, z);
    group.add(fruit);
    const crown = petalRing(5, 0.095, 0.13, leafMat);
    crown.position.set(x, y + 0.3, z);
    group.add(crown);
  });
  return finishModel(group);
}

function buildWatermelonSlice(color: number): THREE.Group {
  const group = new THREE.Group();
  const rind = surface(tint(color, -0.2), "produce");
  const paleRind = surface(0xd8e89a, "produce");
  const flesh = surface(0xf46b68, "produce", { clearcoat: 0.34 });
  const seedMat = surface(0x4a2e2b, "matte");
  const triangle: ReadonlyArray<readonly [number, number]> = [[-0.76, -0.42], [0.76, -0.42], [0, 0.67]];
  const base = extrudedShape(triangle, 0.48, 0.06, rind);
  group.add(base);
  // Build two shallow, genuinely layered cut faces instead of pushing one
  // oversized insert through the whole wedge. Both sides now keep pale rind,
  // red flesh and seeds after the slice rolls, while the green outer wall
  // remains visible around the perimeter.
  for (const facing of [-1, 1] as const) {
    const inner = extrudedShape(
      [[-0.66, -0.32], [0.66, -0.32], [0, 0.59]],
      0.035,
      0.025,
      paleRind,
    );
    inner.position.z = facing * 0.265;
    inner.userData.detailLayer = "watermelon-pale-rind";
    group.add(inner);
    const face = extrudedShape(
      [[-0.58, -0.23], [0.58, -0.23], [0, 0.51]],
      0.035,
      0.02,
      flesh,
    );
    face.position.z = facing * 0.302;
    face.userData.detailLayer = "watermelon-flesh-face";
    group.add(face);
    ([[-0.24, -0.03], [0.22, -0.04], [0, 0.22]] as const).forEach(([x, y]) => {
      const pip = sphere(0.055, seedMat, 9, 6);
      pip.scale.set(0.56, 1, 0.25);
      pip.position.set(x, y, facing * 0.34);
      pip.userData.detailLayer = "watermelon-seed";
      group.add(pip);
    });
  }
  return finishModel(group);
}

function buildHoneyJar(color: number): THREE.Group {
  const group = new THREE.Group();
  const honey = surface(color, "glaze", { clearcoat: 0.88, roughness: 0.22 });
  const lidMat = surface(GOLD, "metal");
  group.add(lathe([[0.34, -0.66], [0.52, -0.54], [0.56, 0.36], [0.43, 0.53], [0.36, 0.6]], honey, 26));
  const heel = cylinder(0.42, 0.48, 0.1, surface(tint(color, -0.08), "glaze"), 22);
  heel.position.y = -0.62;
  group.add(heel);
  const lid = cylinder(0.43, 0.43, 0.18, lidMat, 24);
  lid.position.y = 0.64;
  group.add(lid);
  return finishModel(group);
}

function buildPicnicCheese(color: number): THREE.Group {
  const group = new THREE.Group();
  const cheese = surface(color, "produce", { roughness: 0.4 });
  const rind = surface(tint(color, -0.14), "matte");
  const hole = surface(0xb77822, "matte");
  const wedge: ReadonlyArray<readonly [number, number]> = [[-0.72, -0.46], [0.72, -0.46], [-0.54, 0.5]];
  group.add(extrudedShape(wedge, 0.72, 0.08, rind));
  for (const facing of [-1, 1] as const) {
    const center = extrudedShape(
      [[-0.61, -0.36], [0.6, -0.36], [-0.47, 0.4]],
      0.045,
      0.035,
      cheese,
    );
    center.position.z = facing * 0.39;
    center.userData.detailLayer = "cheese-face";
    group.add(center);
    ([[-0.32, -0.05], [0.08, -0.19], [-0.18, 0.24], [0.35, -0.28]] as const).forEach(([x, y], index) => {
      const dimple = sphere(index % 2 ? 0.08 : 0.11, hole, 12, 8);
      dimple.scale.z = 0.22;
      dimple.position.set(x, y, facing * 0.435);
      dimple.userData.detailLayer = "cheese-dimple";
      group.add(dimple);
    });
  }
  return finishModel(group);
}

function buildDaisyPot(color: number): THREE.Group {
  const group = new THREE.Group();
  const ceramic = surface(color, "ceramic");
  const dark = surface(tint(color, -0.2), "ceramic");
  const soil = surface(0x5b3825, "matte");
  const green = surface(LEAF_GREEN, "produce");
  const petal = surface(0xfff8df, "glaze");
  const centerMat = surface(0xf2bd3c, "produce");
  group.add(lathe([[0.34, -0.62], [0.48, -0.58], [0.56, 0.18], [0.61, 0.3]], ceramic, 24));
  const rim = horizontalRing(0.58, 0.07, dark);
  rim.position.y = 0.29;
  group.add(rim);
  const soilDisk = cylinder(0.5, 0.5, 0.08, soil, 20);
  soilDisk.position.y = 0.31;
  group.add(soilDisk);
  const stem = capsule(0.045, 0.72, green);
  stem.position.set(0, 0.67, 0);
  group.add(stem);
  for (const [x, y, angle] of [[-0.18, 0.62, -0.7], [0.2, 0.78, 0.74]] as const) {
    const sprout = leaf(0.38, 0.22, green);
    sprout.rotation.set(-Math.PI / 2, 0, angle);
    sprout.position.set(x, y, 0);
    group.add(sprout);
  }
  const bloom = petalRing(8, 0.23, 0.3, petal);
  bloom.position.y = 1.05;
  group.add(bloom);
  const heart = sphere(0.15, centerMat);
  heart.position.y = 1.06;
  group.add(heart);
  return finishModel(group);
}

function buildPearJuice(color: number): THREE.Group {
  const group = new THREE.Group();
  const carton = surface(color, "paper");
  const fold = surface(tint(color, -0.12), "paper");
  const strawMat = surface(0xe46f6a, "paper");
  group.add(roundedBox(0.86, 1.2, 0.64, 0.1, carton, 4));
  const roofLeft = roundedBox(0.46, 0.28, 0.66, 0.06, fold, 3);
  roofLeft.position.set(-0.19, 0.68, 0);
  roofLeft.rotation.z = -0.48;
  group.add(roofLeft);
  const roofRight = roofLeft.clone();
  roofRight.position.x = 0.19;
  roofRight.rotation.z = 0.48;
  group.add(roofRight);
  const straw = capsule(0.035, 0.72, strawMat);
  straw.position.set(0.25, 0.84, 0.08);
  straw.rotation.z = -0.18;
  group.add(straw);
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
  buildStrawberryBasket,
  buildWatermelonSlice,
  buildHoneyJar,
  buildPicnicCheese,
  buildDaisyPot,
  buildPearJuice,
];

/** Build one original, fully modeled Fresh Market base recipe (authored kinds 0..17). */
export function buildFreshMarketModel(kind: number, color: number): THREE.Group {
  const safeKind = Math.max(0, Math.min(BUILDERS.length - 1, Math.floor(kind)));
  return BUILDERS[safeKind]!(color);
}
