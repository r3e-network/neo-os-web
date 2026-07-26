import * as THREE from "three";

import {
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
  // The custom leaf plane is the only hand-authored BufferGeometry in the
  // catalogue. Give it explicit UVs so its produce albedo, normal and
  // roughness skins survive merging and remain visible on all three zongzi
  // faces instead of silently sampling one texture pixel.
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0.5, 1,
    0, 0,
    1, 0,
  ], 2));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return part(geometry, material);
}

function buildLantern(color: number): THREE.Group {
  const group = new THREE.Group();
  const paper = surface(color, "paper", {
    clearcoat: 0.24,
    clearcoatRoughness: 0.4,
    emissive: tint(color, -0.34),
    emissiveIntensity: 0.08,
  });
  const metal = surface(GOLD, "metal");

  // Use a truly closed, softly squashed sphere for the paper shell. The
  // previous open-ended lathe could still read as a thin fan when the lantern
  // tumbled end-on, even after adding surface ribs.
  const body = part(new THREE.SphereGeometry(0.68, 32, 24), paper);
  body.scale.y = 0.82;
  body.userData.detailLayer = "lantern-round-body";
  group.add(body);

  const top = part(new THREE.CylinderGeometry(0.24, 0.29, 0.16, 24), metal);
  top.position.y = 0.62;
  top.userData.detailLayer = "lantern-cap";
  group.add(top);
  const bottom = part(new THREE.CylinderGeometry(0.29, 0.24, 0.16, 24), metal);
  bottom.position.y = -0.62;
  bottom.userData.detailLayer = "lantern-cap";
  group.add(bottom);

  const handlePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const angle = Math.PI - (i / 8) * Math.PI;
    handlePoints.push(new THREE.Vector3(Math.cos(angle) * 0.32, 0.7 + Math.sin(angle) * 0.32, 0));
  }
  const handle = tube(handlePoints, 0.045, metal, 20, 7);
  handle.userData.detailLayer = "lantern-handle";
  group.add(handle);

  const tasselStem = capsule(0.045, 0.28, metal);
  tasselStem.position.y = -0.82;
  tasselStem.userData.detailLayer = "lantern-tassel";
  group.add(tasselStem);
  for (let index = -1; index <= 1; index += 1) {
    const tassel = capsule(0.025, 0.3, metal);
    tassel.position.set(index * 0.055, -1.03, 0);
    tassel.rotation.z = index * 0.08;
    tassel.userData.detailLayer = "lantern-tassel";
    group.add(tassel);
  }
  return finishModel(group);
}

function buildBao(color: number): THREE.Group {
  const group = new THREE.Group();
  const dough = surface(color || CREAM, "matte", { roughness: 0.6, clearcoat: 0.08 });

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

  const knot = part(new THREE.SphereGeometry(0.18, 16, 12), surface(tint(color || CREAM, 0.08), "matte"));
  knot.scale.y = 0.62;
  knot.position.y = 0.64;
  group.add(knot);

  return finishModel(group);
}

function buildSodaBottle(color: number): THREE.Group {
  const group = new THREE.Group();
  const glass = surface(color, "glaze", {
    roughness: 0.18,
    clearcoat: 0.94,
    clearcoatRoughness: 0.08,
    emissive: tint(color, -0.32),
    emissiveIntensity: 0.06,
  });
  const liquid = surface(tint(color, 0.12), "glaze", { clearcoat: 0.88 });
  const cap = surface(GOLD, "metal", { metalness: 0.58, roughness: 0.2 });
  const pale = surface(0xc8fff0, "glaze", { clearcoat: 0.96 });

  const body = lathe([
    [0, -0.76],
    [0.35, -0.76],
    [0.47, -0.66],
    [0.5, -0.48],
    [0.49, 0.16],
    [0.43, 0.32],
    [0.28, 0.5],
    [0.24, 0.64],
    [0.24, 0.7],
    [0, 0.7],
  ], glass, 32);
  body.userData.detailLayer = "soda-bottle-body";
  group.add(body);

  const heel = part(new THREE.CylinderGeometry(0.38, 0.42, 0.09, 28), liquid);
  heel.position.y = -0.72;
  heel.userData.detailLayer = "soda-bottle-heel";
  group.add(heel);
  const heelRing = part(new THREE.TorusGeometry(0.4, 0.025, 6, 28), pale);
  heelRing.rotation.x = Math.PI / 2;
  heelRing.position.y = -0.68;
  heelRing.userData.detailLayer = "soda-bottle-heel-ring";
  group.add(heelRing);

  const crown = part(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 24), cap);
  crown.position.y = 0.76;
  crown.userData.detailLayer = "soda-bottle-cap";
  group.add(crown);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const tab = roundedBox(0.075, 0.13, 0.045, 0.016, cap, 2);
    tab.position.set(Math.cos(angle) * 0.28, 0.73, Math.sin(angle) * 0.28);
    tab.rotation.y = -angle;
    tab.userData.detailLayer = "soda-bottle-crown-tab";
    group.add(tab);
  }

  const bubblePositions: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.24, -0.42, 0.43, 0.06],
    [0.1, -0.5, 0.46, 0.045],
    [0.28, -0.26, 0.39, 0.055],
    [-0.08, -0.12, 0.48, 0.05],
    [0.2, 0.02, 0.43, 0.042],
    [-0.26, 0.12, 0.38, 0.05],
    [0.02, 0.24, 0.39, 0.038],
    [0.22, -0.1, -0.43, 0.045],
    [-0.16, -0.3, -0.44, 0.052],
  ];
  for (const [x, y, z, radius] of bubblePositions) {
    const bubble = part(new THREE.SphereGeometry(radius, 10, 8), pale);
    bubble.position.set(x, y, z);
    bubble.userData.detailLayer = "soda-bottle-bubble";
    group.add(bubble);
  }
  return finishModel(group);
}

function buildMooncake(color: number): THREE.Group {
  const group = new THREE.Group();
  const pastry = surface(color, "glaze", { roughness: 0.38, clearcoat: 0.3 });
  const toasted = surface(tint(color, -0.18), "matte", { roughness: 0.66 });

  group.add(part(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 24), pastry));
  // A broad toasted top plane gives the mooncake a clear second colour block;
  // no stamped flower, cross or fine face lines are needed for identity.
  const top = part(new THREE.CylinderGeometry(0.62, 0.68, 0.08, 24), toasted);
  top.position.y = 0.3;
  group.add(top);

  // Physics can expose the underside as often as the ornate top. Keep a
  // shallow pastry face for volume, without decorative marker rings.
  const bottom = part(new THREE.CylinderGeometry(0.62, 0.68, 0.08, 24), toasted);
  bottom.position.y = -0.3;
  bottom.userData.detailLayer = "mooncake-bottom-face";
  group.add(bottom);
  return finishModel(group);
}

function buildTanghulu(color: number): THREE.Group {
  const group = new THREE.Group();
  const berry = surface(color, "glaze", { clearcoat: 0.92, clearcoatRoughness: 0.08 });
  const wood = surface(BAMBOO, "wood");

  const stick = capsule(0.055, 2.2, wood);
  stick.position.y = -0.18;
  group.add(stick);
  for (let i = 0; i < 4; i += 1) {
    const y = -0.48 + i * 0.46;
    const fruit = part(new THREE.SphereGeometry(0.31, 18, 14), berry);
    fruit.position.y = y;
    group.add(fruit);
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
    const facing = Math.sign(y);
    const skin = part(new THREE.CylinderGeometry(0.64, 0.64, 0.07, 24), hide);
    skin.position.y = y;
    group.add(skin);
    const rim = part(new THREE.TorusGeometry(0.62, 0.045, 7, 24), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + facing * 0.035;
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

  const opening = part(
    new THREE.CylinderGeometry(0.37, 0.37, 0.045, 20),
    surface(tint(color || BAMBOO, -0.22), "matte"),
  );
  opening.position.y = 0.68;
  group.add(opening);

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
  ] as const;

  // Keep the triangular wrapped-leaf silhouette, but subdivide its curved
  // surface so lighting gives the parcel real volume without painted veins,
  // cords or diagonal identity strokes.
  const parcel = part(new THREE.ConeGeometry(0.66, 1.12, 3, 40), leafCore);
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
    const panel = triangularLeafPanel(panelA, panelB, panelC, leafMats[index % leafMats.length]!);
    panel.userData.detailLayer = "zongzi-leaf-panel";
    group.add(panel);

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
  const lidMat = surface(tint(color, 0.08), "metal", { metalness: 0.42, roughness: 0.3, clearcoat: 0.42 });

  const base = roundedBox(1.36, 0.52, 1.05, 0.16, enamel, 5);
  base.position.y = -0.08;
  group.add(base);
  const lid = roundedBox(1.42, 0.17, 1.1, 0.17, lidMat, 5);
  lid.position.y = 0.3;
  group.add(lid);

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
  return finishModel(group);
}

function buildFestivalFan(color: number): THREE.Group {
  const group = new THREE.Group();
  const paper = surface(color, "paper", { clearcoat: 0.14 });
  const gold = surface(GOLD, "metal");
  for (let i = 0; i < 7; i += 1) {
    const angle = -0.72 + i * 0.24;
    const panel = extrudedShape([[-0.11, -0.58], [0.11, -0.58], [0.27, 0.65], [-0.27, 0.65]], 0.055, 0.025, i % 2 ? surface(tint(color, 0.08), "paper") : paper);
    panel.position.y = 0.22;
    panel.rotation.z = angle;
    group.add(panel);
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
  const tile = roundedBox(0.9, 1.25, 0.46, 0.12, jade, 5);
  group.add(tile);
  const face = roundedBox(0.78, 1.1, 0.12, 0.09, ivory, 5);
  face.position.z = 0.23;
  group.add(face);
  const frame = roundedBox(0.6, 0.85, 0.04, 0.08, surface(tint(color, -0.04), "ceramic"), 4);
  frame.position.z = 0.31;
  group.add(frame);
  return finishModel(group);
}

const BUILDERS: readonly Builder[] = [
  buildLantern,
  buildBao,
  buildSodaBottle,
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

/** Build one original, fully modeled Lantern Night base recipe (authored kinds 0..17). */
export function buildNightMarketModel(kind: number, color: number): THREE.Group {
  const safeKind = Math.max(0, Math.min(BUILDERS.length - 1, Math.floor(kind)));
  return BUILDERS[safeKind]!(color);
}
