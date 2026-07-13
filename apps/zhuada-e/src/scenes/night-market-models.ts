import * as THREE from "three";

import {
  addGrooves,
  capsule,
  extrudedShape,
  finishModel,
  lathe,
  part,
  petalRing,
  roundedBox,
  surface,
  tint,
  tube,
} from "./model-kit";

type Builder = (color: number) => THREE.Group;

const GOLD = 0xf6b83f;
const DEEP_GOLD = 0xa96718;
const CREAM = 0xfff1cf;
const DARK = 0x211b26;
const BAMBOO = 0xc8953c;
const TWINE = 0xe1b96d;

function triangularLeafPanel(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
  ], 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return part(geometry, material);
}

function buildLantern(color: number): THREE.Group {
  const group = new THREE.Group();
  const paper = surface(color, "paper", { clearcoat: 0.18, clearcoatRoughness: 0.46 });
  const metal = surface(GOLD, "metal");

  group.add(lathe([
    [0.3, -0.58],
    [0.54, -0.45],
    [0.66, -0.12],
    [0.66, 0.12],
    [0.54, 0.45],
    [0.3, 0.58],
  ], paper, 32));

  const top = part(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 24), metal);
  top.position.y = 0.63;
  group.add(top);
  const bottom = part(new THREE.CylinderGeometry(0.34, 0.3, 0.14, 24), metal);
  bottom.position.y = -0.63;
  group.add(bottom);

  addGrooves(group, "y", 3, 0.62, 0.64, surface(tint(color, -0.18), "paper"));

  const handlePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const angle = Math.PI - (i / 8) * Math.PI;
    handlePoints.push(new THREE.Vector3(Math.cos(angle) * 0.34, 0.72 + Math.sin(angle) * 0.36, 0));
  }
  group.add(tube(handlePoints, 0.045, metal, 20, 7));

  const tassel = capsule(0.055, 0.42, metal);
  tassel.position.y = -0.9;
  group.add(tassel);
  return finishModel(group);
}

function buildBao(color: number): THREE.Group {
  const group = new THREE.Group();
  const dough = surface(color || CREAM, "matte", { roughness: 0.6, clearcoat: 0.08 });
  const crease = surface(tint(color || CREAM, -0.12), "matte", { roughness: 0.78 });

  const body = lathe([
    [0.14, -0.68],
    [0.52, -0.62],
    [0.72, -0.3],
    [0.76, 0.08],
    [0.62, 0.42],
    [0.3, 0.62],
    [0.1, 0.68],
  ], dough, 30);
  body.scale.y = 0.86;
  group.add(body);

  // Close the small polar opening left by the lathe profile. When the bun
  // rolled onto its side, that opening previously exposed the bamboo basket
  // and looked like a missing-texture hole.
  const baseSeal = part(new THREE.SphereGeometry(0.18, 14, 10), dough);
  baseSeal.scale.set(1, 0.42, 1);
  baseSeal.position.y = -0.59;
  baseSeal.userData.detailLayer = "bao-base-seal";
  group.add(baseSeal);

  const knot = part(new THREE.SphereGeometry(0.18, 16, 12), dough);
  knot.scale.y = 0.62;
  knot.position.y = 0.64;
  group.add(knot);

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    group.add(tube([
      new THREE.Vector3(Math.cos(angle) * 0.08, 0.62, Math.sin(angle) * 0.08),
      new THREE.Vector3(Math.cos(angle) * 0.34, 0.48, Math.sin(angle) * 0.34),
      new THREE.Vector3(Math.cos(angle) * 0.58, 0.22, Math.sin(angle) * 0.58),
    ], 0.026, crease, 10, 5));
  }
  return finishModel(group);
}

function buildSodaCan(color: number): THREE.Group {
  const group = new THREE.Group();
  const can = surface(color, "metal", { metalness: 0.48, roughness: 0.2, clearcoat: 0.7 });
  const aluminum = surface(0xe8eef1, "metal", { metalness: 0.82, roughness: 0.18 });
  const accent = surface(tint(color, 0.2), "glaze");

  group.add(lathe([
    [0.42, -0.76],
    [0.49, -0.68],
    [0.51, -0.56],
    [0.51, 0.56],
    [0.48, 0.68],
    [0.4, 0.76],
  ], can, 30));

  const top = part(new THREE.CylinderGeometry(0.41, 0.41, 0.055, 28), aluminum);
  top.position.y = 0.77;
  group.add(top);
  const bottomSeal = part(new THREE.CylinderGeometry(0.4, 0.4, 0.055, 28), aluminum);
  bottomSeal.position.y = -0.765;
  bottomSeal.userData.detailLayer = "can-bottom-seal";
  group.add(bottomSeal);
  const bottom = part(new THREE.TorusGeometry(0.43, 0.035, 7, 28), aluminum);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -0.74;
  group.add(bottom);

  const pull = part(new THREE.TorusGeometry(0.13, 0.025, 7, 20), aluminum);
  pull.scale.x = 0.65;
  pull.rotation.x = Math.PI / 2;
  pull.position.set(0.08, 0.815, 0);
  group.add(pull);

  for (let i = 0; i < 3; i += 1) {
    const bubble = part(new THREE.SphereGeometry(0.055 + i * 0.01, 10, 8), accent);
    bubble.position.set(0.38 - i * 0.08, -0.28 + i * 0.32, 0.34);
    group.add(bubble);
  }
  return finishModel(group);
}

function buildMooncake(color: number): THREE.Group {
  const group = new THREE.Group();
  const pastry = surface(color, "glaze", { roughness: 0.38, clearcoat: 0.3 });
  const toasted = surface(tint(color, -0.18), "matte", { roughness: 0.66 });
  const highlight = surface(tint(color, 0.16), "glaze");

  group.add(part(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 24), pastry));
  const top = part(new THREE.CylinderGeometry(0.62, 0.68, 0.08, 24), toasted);
  top.position.y = 0.3;
  group.add(top);

  const petals = petalRing(8, 0.32, 0.34, highlight);
  petals.position.y = 0.38;
  group.add(petals);
  const center = part(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18), toasted);
  center.position.y = 0.43;
  group.add(center);
  return finishModel(group);
}

function buildTanghulu(color: number): THREE.Group {
  const group = new THREE.Group();
  const berry = surface(color, "glaze", { clearcoat: 0.92, clearcoatRoughness: 0.08 });
  const shine = surface(0xffd6b0, "glaze", { emissive: 0x4f120b, emissiveIntensity: 0.08 });
  const wood = surface(BAMBOO, "wood");

  const stick = capsule(0.055, 2.2, wood);
  stick.position.y = -0.18;
  group.add(stick);
  for (let i = 0; i < 4; i += 1) {
    const y = -0.48 + i * 0.46;
    const fruit = part(new THREE.SphereGeometry(0.31, 18, 14), berry);
    fruit.position.y = y;
    group.add(fruit);
    if (i === 1 || i === 3) {
      const glint = part(new THREE.SphereGeometry(0.055, 9, 7), shine);
      glint.position.set(-0.12, y + 0.12, 0.26);
      group.add(glint);
    }
  }
  return finishModel(group);
}

function buildDrum(color: number): THREE.Group {
  const group = new THREE.Group();
  const lacquer = surface(color, "glaze", { clearcoat: 0.62, roughness: 0.28 });
  const hide = surface(0xf0cc92, "fabric", { sheen: 0.16 });
  const brass = surface(GOLD, "metal");

  group.add(part(new THREE.CylinderGeometry(0.62, 0.62, 0.82, 24), lacquer));
  for (const y of [-0.44, 0.44]) {
    const skin = part(new THREE.CylinderGeometry(0.64, 0.64, 0.07, 24), hide);
    skin.position.y = y;
    group.add(skin);
    const rim = part(new THREE.TorusGeometry(0.62, 0.045, 7, 24), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + Math.sign(y) * 0.035;
    group.add(rim);
  }
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const stud = part(new THREE.SphereGeometry(0.07, 10, 8), brass);
    stud.position.set(Math.cos(angle) * 0.62, 0.22, Math.sin(angle) * 0.62);
    group.add(stud);
  }
  return finishModel(group);
}

function buildBambooCup(color: number): THREE.Group {
  const group = new THREE.Group();
  const wood = surface(color || BAMBOO, "wood", { roughness: 0.58, clearcoat: 0.14 });
  const band = surface(tint(color || BAMBOO, -0.22), "wood");

  group.add(lathe([
    [0, -0.72],
    [0.45, -0.72],
    [0.5, -0.6],
    [0.52, 0.67],
    [0.48, 0.76],
    [0.36, 0.72],
    [0.35, -0.56],
    [0, -0.56],
  ], wood, 24));

  for (const y of [-0.55, 0.04, 0.68]) {
    const ring = part(new THREE.TorusGeometry(0.51, 0.045, 7, 24), band);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }
  const seam = capsule(0.025, 1.2, band);
  seam.position.set(0, 0.02, 0.51);
  group.add(seam);
  return finishModel(group);
}

function buildZongzi(color: number): THREE.Group {
  const group = new THREE.Group();
  const leafCore = surface(tint(color, -0.04), "produce", {
    roughness: 0.82,
    emissive: tint(color, -0.22),
    emissiveIntensity: 0.16,
  });
  const leafMats = [
    surface(tint(color, 0.16), "produce", { roughness: 0.72, clearcoat: 0.08, emissive: tint(color, -0.18), emissiveIntensity: 0.14, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }),
    surface(tint(color, 0.07), "produce", { roughness: 0.76, clearcoat: 0.06, emissive: tint(color, -0.18), emissiveIntensity: 0.14, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }),
    surface(tint(color, -0.02), "produce", { roughness: 0.8, clearcoat: 0.04, emissive: tint(color, -0.2), emissiveIntensity: 0.16, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }),
  ] as const;
  const seamMat = surface(tint(color, -0.26), "matte", { roughness: 0.9 });
  const foldMat = surface(tint(color, 0.2), "produce", {
    roughness: 0.7,
    emissive: tint(color, -0.16),
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  const cord = surface(TWINE, "fabric", { sheen: 0.12 });

  const parcel = part(new THREE.ConeGeometry(0.66, 1.12, 3), leafCore);
  parcel.rotation.y = Math.PI / 6;
  parcel.userData.detailLayer = "zongzi-core";
  group.add(parcel);

  const apex = new THREE.Vector3(0, 0.66, 0);
  const base = Array.from({ length: 3 }, (_, index) => {
    const angle = Math.PI / 6 + (index / 3) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 0.8, -0.64, Math.sin(angle) * 0.8);
  });

  for (let index = 0; index < 3; index += 1) {
    const left = base[index]!;
    const right = base[(index + 1) % 3]!;
    const normal = right.clone().sub(apex).cross(left.clone().sub(apex)).normalize();
    const centroid = apex.clone().add(left).add(right).multiplyScalar(1 / 3);
    if (normal.x * centroid.x + normal.z * centroid.z < 0) normal.negate();
    const lift = normal.clone().multiplyScalar(0.045);
    const panelA = apex.clone().add(lift);
    const panelB = left.clone().add(lift);
    const panelC = right.clone().add(lift);
    const panel = triangularLeafPanel(panelA, panelB, panelC, leafMats[index]!);
    panel.userData.detailLayer = "zongzi-leaf-panel";
    group.add(panel);

    const midBase = panelB.clone().lerp(panelC, 0.5);
    const vein = tube([
      midBase.clone().lerp(panelA, 0.12).add(normal.clone().multiplyScalar(0.018)),
      midBase.clone().lerp(panelA, 0.5).add(normal.clone().multiplyScalar(0.024)),
      midBase.clone().lerp(panelA, 0.86).add(normal.clone().multiplyScalar(0.018)),
    ], 0.024, seamMat, 9, 5);
    vein.userData.detailLayer = "zongzi-leaf-vein";
    group.add(vein);

    const foldLeft = panelA.clone().lerp(panelB, 0.26);
    const foldRight = panelA.clone().lerp(panelC, 0.3);
    const foldBase = foldLeft.clone().lerp(foldRight, 0.5).lerp(midBase, 0.14);
    const fold = triangularLeafPanel(
      panelA.clone().add(normal.clone().multiplyScalar(0.025)),
      foldLeft.add(normal.clone().multiplyScalar(0.034)),
      foldBase.add(normal.clone().multiplyScalar(0.045)),
      foldMat,
    );
    fold.userData.detailLayer = "zongzi-fold";
    group.add(fold);
  }

  for (const [y, tilt] of [[-0.15, 0.16], [0.18, -0.22]] as const) {
    const tie = part(new THREE.TorusGeometry(0.49 - y * 0.14, 0.043, 7, 28), cord);
    tie.rotation.x = Math.PI / 2;
    tie.rotation.z = tilt;
    tie.scale.z = 0.82;
    tie.position.y = y;
    tie.userData.detailLayer = "zongzi-cord-wrap";
    group.add(tie);
  }

  const crossCord = tube([
    new THREE.Vector3(-0.44, -0.36, 0.34),
    new THREE.Vector3(-0.2, 0.02, 0.54),
    new THREE.Vector3(0.12, 0.34, 0.48),
    new THREE.Vector3(0.36, 0.46, 0.2),
  ], 0.038, cord, 14, 6);
  crossCord.userData.detailLayer = "zongzi-cord-cross";
  group.add(crossCord);

  const knot = part(new THREE.SphereGeometry(0.105, 12, 9), cord);
  knot.position.set(0.08, 0.22, 0.55);
  knot.scale.set(1.25, 0.75, 0.9);
  knot.userData.detailLayer = "zongzi-knot";
  group.add(knot);

  for (const [x, lean] of [[0.02, -0.16], [0.17, 0.14]] as const) {
    const tail = tube([
      new THREE.Vector3(0.08, 0.2, 0.55),
      new THREE.Vector3(x, -0.04, 0.6),
      new THREE.Vector3(x + lean, -0.31, 0.42),
    ], 0.027, cord, 10, 5);
    tail.userData.detailLayer = "zongzi-cord-tail";
    group.add(tail);
  }
  return finishModel(group);
}

function buildFishCharm(color: number): THREE.Group {
  const group = new THREE.Group();
  const enamel = surface(color, "glaze", { clearcoat: 0.82, clearcoatRoughness: 0.12 });
  const trim = surface(GOLD, "metal");
  const eyeMat = surface(DARK, "glaze");

  group.add(extrudedShape([
    [0.82, 0],
    [0.46, 0.34],
    [-0.2, 0.32],
    [-0.6, 0.58],
    [-0.54, 0.16],
    [-0.94, 0],
    [-0.54, -0.16],
    [-0.6, -0.58],
    [-0.2, -0.32],
    [0.46, -0.34],
  ], 0.18, 0.045, enamel));

  for (const z of [-0.14, 0.14]) {
    const eye = part(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
    eye.position.set(0.4, 0.09, z);
    group.add(eye);
  }
  const loop = part(new THREE.TorusGeometry(0.17, 0.035, 7, 20), trim);
  loop.position.set(-0.92, 0.38, 0);
  group.add(loop);
  for (let i = -1; i <= 1; i += 1) {
    const tassel = capsule(0.025, 0.42, trim);
    tassel.position.set(-0.91 + i * 0.07, -0.55, 0);
    tassel.rotation.z = i * 0.12;
    group.add(tassel);
  }
  return finishModel(group);
}

function buildBowl(color: number): THREE.Group {
  const group = new THREE.Group();
  const ceramic = surface(color || CREAM, "ceramic");
  const glaze = surface(GOLD, "glaze", { clearcoat: 0.86 });

  group.add(lathe([
    [0, -0.52],
    [0.28, -0.52],
    [0.52, -0.36],
    [0.72, 0.18],
    [0.75, 0.38],
    [0.67, 0.43],
    [0.62, 0.31],
    [0.47, -0.24],
    [0.24, -0.4],
    [0, -0.4],
  ], ceramic, 32));
  const rim = part(new THREE.TorusGeometry(0.71, 0.035, 7, 28), glaze);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  group.add(rim);
  const foot = part(new THREE.CylinderGeometry(0.3, 0.34, 0.14, 24), ceramic);
  foot.position.y = -0.54;
  group.add(foot);
  const footLine = part(new THREE.TorusGeometry(0.32, 0.025, 6, 24), glaze);
  footLine.rotation.x = Math.PI / 2;
  footLine.position.y = -0.6;
  group.add(footLine);
  return finishModel(group);
}

function buildBell(color: number): THREE.Group {
  const group = new THREE.Group();
  const metal = surface(color || GOLD, "metal", { metalness: 0.78, roughness: 0.2 });
  const darkMetal = surface(DEEP_GOLD, "metal", { metalness: 0.7, roughness: 0.34 });

  group.add(lathe([
    [0.18, 0.58],
    [0.25, 0.48],
    [0.31, 0.1],
    [0.48, -0.32],
    [0.7, -0.53],
    [0.74, -0.62],
  ], metal, 32));
  const rim = part(new THREE.TorusGeometry(0.7, 0.055, 8, 28), darkMetal);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.58;
  group.add(rim);

  // The bell keeps a dark recessed mouth instead of a literal through-hole.
  // This preserves depth and the clapper silhouette while preventing the
  // basket weave from appearing inside the object as it tumbles.
  const interiorSeal = part(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 28), darkMetal);
  interiorSeal.position.y = -0.555;
  interiorSeal.userData.detailLayer = "bell-interior-seal";
  group.add(interiorSeal);

  const handle = lathe([
    [0.16, -0.2],
    [0.22, -0.05],
    [0.15, 0.25],
    [0.1, 0.42],
  ], metal, 20);
  handle.position.y = 0.72;
  group.add(handle);
  const knob = part(new THREE.SphereGeometry(0.16, 14, 10), darkMetal);
  knob.position.y = 1.15;
  group.add(knob);

  const clapperStem = capsule(0.035, 0.62, darkMetal);
  clapperStem.position.y = -0.48;
  group.add(clapperStem);
  const clapper = part(new THREE.SphereGeometry(0.13, 12, 9), darkMetal);
  clapper.position.y = -0.82;
  group.add(clapper);
  return finishModel(group);
}

function buildPastryTin(color: number): THREE.Group {
  const group = new THREE.Group();
  const enamel = surface(color, "metal", { metalness: 0.46, roughness: 0.27, clearcoat: 0.5 });
  const gold = surface(GOLD, "metal");
  const lightGold = surface(0xffd87a, "glaze");

  const base = roundedBox(1.36, 0.52, 1.05, 0.16, enamel, 5);
  base.position.y = -0.08;
  group.add(base);
  const lid = roundedBox(1.42, 0.17, 1.1, 0.17, enamel, 5);
  lid.position.y = 0.3;
  group.add(lid);

  for (const z of [-0.52, 0.52]) {
    const edge = roundedBox(1.22, 0.06, 0.045, 0.02, gold, 2);
    edge.position.set(0, 0.4, z);
    group.add(edge);
  }
  for (const x of [-0.68, 0.68]) {
    const edge = roundedBox(0.045, 0.06, 0.92, 0.02, gold, 2);
    edge.position.set(x, 0.4, 0);
    group.add(edge);
  }

  const emblem = petalRing(4, 0.18, 0.28, lightGold);
  emblem.position.y = 0.43;
  group.add(emblem);
  return finishModel(group);
}

function buildJadeTeapot(color: number): THREE.Group {
  const group = new THREE.Group();
  const jade = surface(color, "ceramic", { clearcoat: 0.9 });
  const pale = surface(tint(color, 0.18), "ceramic");
  const gold = surface(GOLD, "metal");
  group.add(lathe([
    [0.26, -0.58], [0.55, -0.5], [0.67, -0.1], [0.58, 0.34], [0.35, 0.48],
  ], jade, 28));
  const lid = part(new THREE.CylinderGeometry(0.38, 0.43, 0.13, 24), pale);
  lid.position.y = 0.48;
  group.add(lid);
  const knob = part(new THREE.SphereGeometry(0.13, 14, 10), gold);
  knob.position.y = 0.64;
  group.add(knob);
  const spout = part(new THREE.ConeGeometry(0.21, 0.75, 18), jade);
  spout.rotation.z = -Math.PI / 2 + 0.24;
  spout.position.set(0.61, 0.1, 0);
  group.add(spout);
  group.add(tube([
    new THREE.Vector3(-0.5, 0.24, 0),
    new THREE.Vector3(-0.83, 0.36, 0),
    new THREE.Vector3(-0.86, -0.24, 0),
    new THREE.Vector3(-0.48, -0.32, 0),
  ], 0.075, gold, 20, 8));
  const seal = petalRing(4, 0.14, 0.22, gold);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, -0.05, 0.62);
  group.add(seal);
  return finishModel(group);
}

function buildFestivalFan(color: number): THREE.Group {
  const group = new THREE.Group();
  const paper = surface(color, "paper", { clearcoat: 0.14 });
  const gold = surface(GOLD, "metal");
  const bamboo = surface(BAMBOO, "wood");
  for (let i = 0; i < 7; i += 1) {
    const angle = -0.72 + i * 0.24;
    const panel = extrudedShape([[-0.11, -0.58], [0.11, -0.58], [0.27, 0.65], [-0.27, 0.65]], 0.055, 0.025, i % 2 ? surface(tint(color, 0.08), "paper") : paper);
    panel.position.y = 0.22;
    panel.rotation.z = angle;
    group.add(panel);
    const rib = capsule(0.025, 1.25, bamboo);
    rib.position.y = 0.16;
    rib.rotation.z = angle;
    rib.position.x = Math.sin(-angle) * 0.05;
    group.add(rib);
  }
  const pivot = part(new THREE.SphereGeometry(0.13, 14, 10), gold);
  pivot.position.y = -0.43;
  group.add(pivot);
  const tassel = tube([
    new THREE.Vector3(0, -0.52, 0),
    new THREE.Vector3(0.2, -0.72, 0),
    new THREE.Vector3(0.12, -0.92, 0),
  ], 0.035, gold, 14, 6);
  group.add(tassel);
  return finishModel(group);
}

function buildLuckyCat(color: number): THREE.Group {
  const group = new THREE.Group();
  const fur = surface(color, "ceramic");
  const red = surface(0xd6483f, "glaze");
  const gold = surface(GOLD, "metal");
  const dark = surface(DARK, "matte");
  const body = part(new THREE.SphereGeometry(0.52, 22, 16), fur);
  body.scale.set(0.82, 1.15, 0.74);
  body.position.y = -0.16;
  group.add(body);
  const head = part(new THREE.SphereGeometry(0.38, 20, 14), fur);
  head.position.y = 0.48;
  group.add(head);
  for (const x of [-0.22, 0.22]) {
    const ear = part(new THREE.ConeGeometry(0.15, 0.34, 4), x < 0 ? red : fur);
    ear.position.set(x, 0.82, 0);
    ear.rotation.z = x < 0 ? -0.15 : 0.15;
    group.add(ear);
    const eye = part(new THREE.SphereGeometry(0.035, 9, 6), dark);
    eye.position.set(x * 0.55, 0.54, 0.34);
    group.add(eye);
  }
  const raisedPaw = capsule(0.12, 0.82, fur);
  raisedPaw.position.set(0.47, 0.27, 0.04);
  raisedPaw.rotation.z = -0.18;
  group.add(raisedPaw);
  const collar = part(new THREE.TorusGeometry(0.34, 0.055, 8, 24), red);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.16;
  group.add(collar);
  const coin = part(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 20), gold);
  coin.rotation.x = Math.PI / 2;
  coin.position.set(0, -0.22, 0.48);
  group.add(coin);
  const stamp = roundedBox(0.1, 0.24, 0.045, 0.025, red, 2);
  stamp.position.set(0, -0.22, 0.54);
  group.add(stamp);
  return finishModel(group);
}

function buildNoodleBowl(color: number): THREE.Group {
  const group = new THREE.Group();
  const bowl = surface(color, "ceramic");
  const rimMat = surface(0xc6473b, "glaze");
  const broth = surface(0x8c4e25, "glaze");
  const noodle = surface(0xf4d184, "produce");
  const bamboo = surface(BAMBOO, "wood");
  group.add(lathe([[0.3, -0.55], [0.58, -0.48], [0.72, 0.25], [0.7, 0.34]], bowl, 28));
  const rim = part(new THREE.TorusGeometry(0.69, 0.055, 8, 26), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.34;
  group.add(rim);
  const soup = part(new THREE.CylinderGeometry(0.63, 0.63, 0.055, 24), broth);
  soup.position.y = 0.33;
  group.add(soup);
  for (let i = 0; i < 5; i += 1) {
    const curl = part(new THREE.TorusGeometry(0.22 + i * 0.04, 0.025, 6, 28), noodle);
    curl.rotation.x = Math.PI / 2;
    curl.position.set((i - 2) * 0.06, 0.38 + i * 0.006, 0);
    group.add(curl);
  }
  for (const x of [-0.11, 0.11]) {
    const stick = capsule(0.022, 1.35, bamboo);
    stick.position.set(x, 0.56, 0.04);
    stick.rotation.z = -0.36;
    group.add(stick);
  }
  return finishModel(group);
}

function buildLotusLamp(color: number): THREE.Group {
  const group = new THREE.Group();
  const outer = surface(color, "paper", { emissive: tint(color, -0.14), emissiveIntensity: 0.12 });
  const inner = surface(tint(color, 0.18), "glaze", { emissive: tint(color, 0.05), emissiveIntensity: 0.16 });
  const gold = surface(GOLD, "metal");
  const base = part(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 22), gold);
  base.position.y = -0.55;
  group.add(base);
  const lower = petalRing(10, 0.43, 0.46, outer);
  lower.position.y = -0.25;
  group.add(lower);
  const upper = petalRing(8, 0.28, 0.4, inner);
  upper.position.y = 0.03;
  upper.rotation.y = Math.PI / 8;
  group.add(upper);
  const heart = part(new THREE.SphereGeometry(0.24, 16, 12), inner);
  heart.position.y = 0.17;
  group.add(heart);
  const finial = capsule(0.045, 0.62, gold);
  finial.position.y = 0.52;
  group.add(finial);
  return finishModel(group);
}

function buildMahjongTile(color: number): THREE.Group {
  const group = new THREE.Group();
  const ivory = surface(color, "ceramic");
  const jade = surface(0x4e9874, "glaze");
  const red = surface(0xc43d36, "glaze");
  const dark = surface(0x24493d, "matte");
  const tile = roundedBox(0.9, 1.25, 0.46, 0.12, jade, 5);
  group.add(tile);
  const face = roundedBox(0.78, 1.1, 0.12, 0.09, ivory, 5);
  face.position.z = 0.23;
  group.add(face);
  const frame = roundedBox(0.6, 0.85, 0.04, 0.08, surface(tint(color, -0.04), "ceramic"), 4);
  frame.position.z = 0.31;
  group.add(frame);
  [[-0.18, 0.25, red], [0.18, 0.25, dark], [-0.18, -0.08, dark], [0.18, -0.08, red], [0, -0.36, dark]].forEach(([x, y, material]) => {
    const dot = part(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 14), material as THREE.Material);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(x as number, y as number, 0.36);
    group.add(dot);
  });
  return finishModel(group);
}

const BUILDERS: readonly Builder[] = [
  buildLantern,
  buildBao,
  buildSodaCan,
  buildMooncake,
  buildTanghulu,
  buildDrum,
  buildBambooCup,
  buildZongzi,
  buildFishCharm,
  buildBowl,
  buildBell,
  buildPastryTin,
  buildJadeTeapot,
  buildFestivalFan,
  buildLuckyCat,
  buildNoodleBowl,
  buildLotusLamp,
  buildMahjongTile,
];

/** Build one original, fully modeled Lantern Night object (logical kinds 0..17). */
export function buildNightMarketModel(kind: number, color: number): THREE.Group {
  const safeKind = Math.max(0, Math.min(BUILDERS.length - 1, Math.floor(kind)));
  return BUILDERS[safeKind]!(color);
}
