import * as THREE from "three";
import {
  capsule,
  extrudedShape,
  finishModel,
  lathe,
  leaf,
  part,
  roundedBox,
  surface,
  tint,
  tube,
} from "./model-kit";

type Material = THREE.MeshPhysicalMaterial;

function sphere(
  radius: number,
  material: THREE.Material,
  widthSegments = 16,
  heightSegments = 12,
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

function horizontalRing(
  radius: number,
  thickness: number,
  material: THREE.Material,
  tubularSegments = 22,
): THREE.Mesh {
  const ring = part(new THREE.TorusGeometry(radius, thickness, 7, tubularSegments), material);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function palette(color: number): {
  base: Material;
  light: Material;
  dark: Material;
  cream: Material;
  blue: Material;
} {
  return {
    base: surface(color, "glaze"),
    light: surface(tint(color, 0.13), "glaze"),
    dark: surface(tint(color, -0.2), "matte"),
    cream: surface(0xfff1cf, "ceramic"),
    blue: surface(0x3e79ad, "glaze"),
  };
}

function buildKettle(color: number): THREE.Group {
  const group = new THREE.Group();
  const p = palette(color);
  const blackMetal = surface(0x2f2b2b, "metal");

  group.add(lathe([
    [0.42, -0.58], [0.61, -0.52], [0.7, -0.24], [0.68, 0.18],
    [0.56, 0.4], [0.38, 0.46], [0.33, 0.52],
  ], p.base, 22));

  const base = horizontalRing(0.55, 0.055, blackMetal);
  base.position.y = -0.54;
  group.add(base);

  const lid = cylinder(0.39, 0.44, 0.11, p.light, 20);
  lid.position.y = 0.49;
  group.add(lid);

  const knob = sphere(0.12, blackMetal, 12, 8);
  knob.scale.set(1.25, 0.75, 1.25);
  knob.position.y = 0.61;
  group.add(knob);

  const spout = tube([
    new THREE.Vector3(-0.5, 0.03, 0),
    new THREE.Vector3(-0.76, 0.14, 0),
    new THREE.Vector3(-0.98, 0.38, 0),
  ], 0.115, p.base, 16, 7);
  group.add(spout);

  const spoutLip = cylinder(0.14, 0.14, 0.075, blackMetal, 14);
  spoutLip.rotation.z = Math.PI / 2.7;
  spoutLip.position.set(-0.98, 0.39, 0);
  group.add(spoutLip);

  const handle = tube([
    new THREE.Vector3(-0.42, 0.38, -0.04),
    new THREE.Vector3(-0.25, 0.82, -0.04),
    new THREE.Vector3(0.02, 0.96, -0.04),
    new THREE.Vector3(0.42, 0.4, -0.04),
  ], 0.075, blackMetal, 18, 7);
  group.add(handle);
  return finishModel(group);
}

function buildMilkBottle(color: number): THREE.Group {
  const group = new THREE.Group();
  const glass = surface(0xd9eff0, "glaze", {
    transparent: true,
    opacity: 0.64,
    transmission: 0.05,
    depthWrite: true,
    side: THREE.DoubleSide,
    thickness: 0.08,
    ior: 1.35,
  });
  const thickGlass = surface(0xcde7e7, "glaze", {
    transparent: true,
    opacity: 0.86,
    transmission: 0.02,
    depthWrite: true,
    side: THREE.DoubleSide,
    thickness: 0.14,
    ior: 1.35,
  });
  const milk = surface(tint(color, 0.08), "ceramic");
  const blue = surface(0x6da3c4, "glaze");
  const cream = surface(0xfff7df, "paper");

  group.add(lathe([
    [0.38, -0.68], [0.48, -0.62], [0.49, 0.18], [0.42, 0.38],
    [0.25, 0.54], [0.23, 0.72], [0.29, 0.76],
  ], glass, 20));

  const filling = lathe([
    [0.02, -0.61], [0.34, -0.61], [0.4, -0.53], [0.41, 0.12],
    [0.36, 0.25], [0.05, 0.29],
  ], milk, 18);
  filling.userData.detailLayer = "bottle-filling";
  group.add(filling);

  // A real thick heel closes the lathed shell and keeps the bottom readable
  // through the translucent body from the game's overhead camera.
  const heel = cylinder(0.39, 0.43, 0.13, thickGlass, 22);
  heel.position.y = -0.62;
  heel.userData.detailLayer = "bottle-heel";
  group.add(heel);
  const heelRing = horizontalRing(0.4, 0.035, blue, 20);
  heelRing.position.y = -0.57;
  heelRing.userData.detailLayer = "bottle-heel-ring";
  group.add(heelRing);

  const lowerLip = horizontalRing(0.255, 0.045, blue, 18);
  lowerLip.position.y = 0.65;
  group.add(lowerLip);

  const upperLip = horizontalRing(0.29, 0.045, surface(0xf6fbf5, "ceramic"), 18);
  upperLip.position.y = 0.76;
  group.add(upperLip);

  const foilCap = cylinder(0.245, 0.265, 0.11, blue, 20);
  foilCap.position.y = 0.76;
  foilCap.userData.detailLayer = "bottle-cap";
  group.add(foilCap);

  const label = roundedBox(0.56, 0.36, 0.045, 0.08, cream, 3);
  label.position.set(0, -0.03, 0.485);
  label.userData.detailLayer = "bottle-label";
  group.add(label);
  const labelMark = roundedBox(0.17, 0.2, 0.025, 0.055, blue, 3);
  labelMark.position.set(0, -0.03, 0.52);
  labelMark.userData.detailLayer = "bottle-label-mark";
  group.add(labelMark);
  return finishModel(group);
}

function buildBowl(color: number): THREE.Group {
  const group = new THREE.Group();
  const p = palette(color);
  const inside = surface(tint(color, -0.18), "ceramic");

  group.add(lathe([
    [0.25, -0.38], [0.43, -0.33], [0.67, -0.05], [0.76, 0.3],
    [0.72, 0.39], [0.59, 0.25], [0.38, -0.04], [0.25, -0.25],
  ], p.base, 24));

  const cavity = cylinder(0.58, 0.48, 0.08, inside, 22);
  cavity.position.y = 0.29;
  group.add(cavity);

  const rim = horizontalRing(0.73, 0.055, p.cream, 24);
  rim.position.y = 0.38;
  group.add(rim);

  const foot = cylinder(0.31, 0.38, 0.14, p.dark, 18);
  foot.position.y = -0.4;
  group.add(foot);
  return finishModel(group);
}

function buildCinnamonRoll(color: number): THREE.Group {
  const group = new THREE.Group();
  const dough = surface(color, "paper");
  const cinnamon = surface(0x9a4e26, "matte");
  const icing = surface(0xffead5, "glaze");

  const bun = cylinder(0.69, 0.73, 0.38, dough, 22);
  group.add(bun);

  const side = horizontalRing(0.62, 0.055, cinnamon, 24);
  side.position.y = -0.02;
  group.add(side);

  const spiralPoints: THREE.Vector3[] = [];
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const angle = t * Math.PI * 4.25;
    const radius = 0.055 + t * 0.51;
    spiralPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.23, Math.sin(angle) * radius));
  }
  group.add(tube(spiralPoints, 0.07, cinnamon, 26, 6));

  for (const [x, z, scale] of [[-0.34, 0.27, 1], [0.39, 0.18, 0.88], [0.04, -0.43, 0.82]] as const) {
    const drop = sphere(0.16, icing, 10, 8);
    drop.scale.set(scale * 1.35, 0.42, scale);
    drop.position.set(x, 0.27, z);
    group.add(drop);
  }
  return finishModel(group);
}

function buildJamJar(color: number): THREE.Group {
  const group = new THREE.Group();
  const glass = surface(0xe8f3ef, "glaze", {
    transparent: true,
    opacity: 0.62,
    transmission: 0.04,
    depthWrite: true,
    side: THREE.DoubleSide,
    thickness: 0.08,
    ior: 1.35,
  });
  const thickGlass = surface(0xd8ece7, "glaze", {
    transparent: true,
    opacity: 0.84,
    transmission: 0.02,
    depthWrite: true,
    side: THREE.DoubleSide,
    thickness: 0.14,
    ior: 1.35,
  });
  const jam = surface(color, "glaze");
  const red = surface(0xc34b42, "fabric");
  const cream = surface(0xffedcf, "paper");

  const jar = cylinder(0.52, 0.56, 1.08, glass, 22);
  group.add(jar);

  const filling = cylinder(0.47, 0.49, 0.72, jam, 20);
  filling.position.y = -0.13;
  filling.userData.detailLayer = "jar-filling";
  group.add(filling);

  const heel = cylinder(0.48, 0.53, 0.12, thickGlass, 22);
  heel.position.y = -0.51;
  heel.userData.detailLayer = "jar-heel";
  group.add(heel);
  const heelRing = horizontalRing(0.5, 0.032, red, 22);
  heelRing.position.y = -0.47;
  heelRing.userData.detailLayer = "jar-heel-ring";
  group.add(heelRing);

  const lid = cylinder(0.58, 0.58, 0.18, red, 22);
  lid.position.y = 0.61;
  group.add(lid);

  const lidTop = cylinder(0.46, 0.46, 0.03, cream, 20);
  lidTop.position.y = 0.715;
  group.add(lidTop);

  const blankLabel = roundedBox(0.66, 0.34, 0.05, 0.08, cream, 3);
  blankLabel.position.set(0, -0.06, 0.535);
  group.add(blankLabel);
  return finishModel(group);
}

function buildSpoon(color: number): THREE.Group {
  const group = new THREE.Group();
  const wood = surface(color, "wood");
  const grain = surface(tint(color, -0.24), "wood");

  const handle = capsule(0.095, 1.28, wood, "x");
  handle.position.x = 0.24;
  group.add(handle);

  const bowl = sphere(0.44, wood, 16, 10);
  bowl.scale.set(1.16, 0.3, 0.8);
  bowl.position.set(-0.59, 0, 0);
  group.add(bowl);

  const hollow = sphere(0.31, grain, 14, 8);
  hollow.scale.set(1.12, 0.14, 0.74);
  hollow.position.set(-0.59, 0.115, 0);
  group.add(hollow);

  for (const offset of [-0.08, 0.18]) {
    const mark = capsule(0.025, 0.27, grain, "x");
    mark.position.set(offset, 0.11, 0);
    mark.rotation.y = offset < 0 ? 0.32 : -0.28;
    group.add(mark);
  }
  return finishModel(group);
}

function buildPumpkin(color: number): THREE.Group {
  const group = new THREE.Group();
  const orange = surface(color, "produce");
  const orangeLight = surface(tint(color, 0.08), "produce");
  const stemMat = surface(0x55733b, "wood");

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const lobe = sphere(0.56, i % 2 === 0 ? orange : orangeLight, 14, 10);
    lobe.scale.set(0.78, 1.12, 0.78);
    lobe.position.set(Math.cos(angle) * 0.19, 0, Math.sin(angle) * 0.19);
    group.add(lobe);
  }

  const stem = cylinder(0.1, 0.15, 0.43, stemMat, 9);
  stem.position.set(0.04, 0.72, 0);
  stem.rotation.z = -0.16;
  group.add(stem);

  const stemLeaf = leaf(0.36, 0.23, surface(0x78a24d, "produce"));
  stemLeaf.rotation.x = -Math.PI / 2;
  stemLeaf.rotation.z = 0.5;
  stemLeaf.position.set(0.24, 0.63, 0.02);
  group.add(stemLeaf);
  return finishModel(group);
}

function buildOvenMitt(color: number): THREE.Group {
  const group = new THREE.Group();
  const fabric = surface(color, "fabric");
  const trim = surface(0xffedcf, "fabric");
  const seam = surface(tint(color, -0.2), "fabric");

  const mitt = extrudedShape([
    [-0.38, -0.52], [0.31, -0.52], [0.43, -0.25], [0.42, 0.43],
    [0.28, 0.65], [0.08, 0.68], [-0.02, 0.54], [-0.09, 0.18],
    [-0.22, 0.42], [-0.4, 0.36], [-0.49, 0.12], [-0.5, -0.25],
  ], 0.22, 0.07, fabric);
  group.add(mitt);

  const cuff = roundedBox(0.9, 0.24, 0.31, 0.08, trim, 3);
  cuff.position.y = -0.55;
  group.add(cuff);

  for (const x of [-0.22, 0.22]) {
    const stitch = capsule(0.024, 0.52, seam, "y");
    stitch.position.set(x, 0.02, 0.145);
    stitch.rotation.z = x < 0 ? -0.16 : 0.16;
    group.add(stitch);
  }
  for (const [x, y] of [[-0.08, -0.24], [0.12, 0.18], [0.02, 0.43]] as const) {
    const tuft = sphere(0.045, trim, 8, 6);
    tuft.scale.z = 0.4;
    tuft.position.set(x, y, 0.17);
    group.add(tuft);
  }
  return finishModel(group);
}

function buildPinwheel(color: number): THREE.Group {
  const group = new THREE.Group();
  const red = surface(color, "paper");
  const cream = surface(0xfff0d1, "paper");
  const wood = surface(0xb97a43, "wood");

  const stick = capsule(0.055, 1.35, wood, "y");
  stick.position.y = -0.33;
  group.add(stick);

  for (let i = 0; i < 4; i += 1) {
    const blade = extrudedShape([
      [0.02, 0.02], [0.58, 0.1], [0.26, 0.52],
    ], 0.1, 0.035, i % 2 === 0 ? red : cream);
    blade.position.y = 0.34;
    blade.rotation.z = (i / 4) * Math.PI * 2;
    group.add(blade);
  }

  const hub = sphere(0.13, surface(0xf2ad42, "glaze"), 12, 8);
  hub.position.set(0, 0.34, 0.1);
  group.add(hub);
  return finishModel(group);
}

function buildJug(color: number): THREE.Group {
  const group = new THREE.Group();
  const ceramic = surface(color, "ceramic");
  const cream = surface(tint(color, 0.12), "ceramic");
  const blue = surface(0x477eaa, "glaze");
  const inside = surface(0x6d4a34, "matte");

  group.add(lathe([
    [0.34, -0.66], [0.52, -0.57], [0.61, -0.22], [0.57, 0.22],
    [0.42, 0.42], [0.33, 0.56], [0.34, 0.68],
  ], ceramic, 22));

  const mouth = horizontalRing(0.36, 0.055, cream, 20);
  mouth.position.y = 0.67;
  group.add(mouth);

  const opening = cylinder(0.27, 0.27, 0.035, inside, 18);
  opening.position.y = 0.69;
  group.add(opening);

  group.add(tube([
    new THREE.Vector3(0.47, 0.34, 0),
    new THREE.Vector3(0.82, 0.31, 0),
    new THREE.Vector3(0.86, -0.18, 0),
    new THREE.Vector3(0.5, -0.35, 0),
  ], 0.075, blue, 18, 7));

  const spout = tube([
    new THREE.Vector3(-0.3, 0.55, 0),
    new THREE.Vector3(-0.52, 0.67, 0),
    new THREE.Vector3(-0.67, 0.62, 0),
  ], 0.11, cream, 12, 7);
  group.add(spout);

  const band = horizontalRing(0.56, 0.035, blue, 22);
  band.position.y = -0.02;
  group.add(band);
  return finishModel(group);
}

function buildHeartCookie(color: number): THREE.Group {
  const group = new THREE.Group();
  const biscuit = surface(color, "paper");
  const icing = surface(0xffd46e, "glaze");
  const crumb = surface(tint(color, -0.16), "paper");
  const heart: ReadonlyArray<readonly [number, number]> = [
    [0, -0.67], [0.58, -0.14], [0.62, 0.27], [0.38, 0.52],
    [0.12, 0.5], [0, 0.35], [-0.12, 0.5], [-0.38, 0.52],
    [-0.62, 0.27], [-0.58, -0.14],
  ];

  const cookie = extrudedShape(heart, 0.28, 0.075, biscuit);
  cookie.rotation.x = Math.PI / 2;
  group.add(cookie);

  const icingHeart = extrudedShape(heart.map(([x, y]) => [x * 0.68, y * 0.68] as const), 0.055, 0.035, icing);
  icingHeart.rotation.x = Math.PI / 2;
  icingHeart.position.y = 0.18;
  group.add(icingHeart);

  for (const [x, z] of [[-0.25, -0.12], [0.24, -0.08], [-0.15, 0.26], [0.18, 0.24]] as const) {
    const dot = sphere(0.045, crumb, 8, 6);
    dot.scale.y = 0.45;
    dot.position.set(x, 0.225, z);
    group.add(dot);
  }
  return finishModel(group);
}

function buildMug(color: number): THREE.Group {
  const group = new THREE.Group();
  const p = palette(color);
  const inside = surface(tint(color, -0.25), "ceramic");

  const cup = cylinder(0.49, 0.45, 1.0, p.base, 22);
  group.add(cup);

  const opening = cylinder(0.39, 0.39, 0.035, inside, 20);
  opening.position.y = 0.515;
  group.add(opening);

  const rim = horizontalRing(0.48, 0.045, p.cream, 22);
  rim.position.y = 0.51;
  group.add(rim);

  const base = horizontalRing(0.4, 0.035, p.dark, 20);
  base.position.y = -0.49;
  group.add(base);

  group.add(tube([
    new THREE.Vector3(0.45, 0.28, 0),
    new THREE.Vector3(0.75, 0.25, 0),
    new THREE.Vector3(0.77, -0.18, 0),
    new THREE.Vector3(0.45, -0.25, 0),
  ], 0.075, p.cream, 18, 7));

  const badge = roundedBox(0.25, 0.34, 0.045, 0.08, p.light, 3);
  badge.position.set(0, 0.02, 0.49);
  group.add(badge);
  return finishModel(group);
}

const BUILDERS: ReadonlyArray<(color: number) => THREE.Group> = [
  buildKettle,
  buildMilkBottle,
  buildBowl,
  buildCinnamonRoll,
  buildJamJar,
  buildSpoon,
  buildPumpkin,
  buildOvenMitt,
  buildPinwheel,
  buildJug,
  buildHeartCookie,
  buildMug,
];

/** Build one production farm-kitchen object (logical kinds 0..11). */
export function buildFarmKitchenModel(kind: number, color: number): THREE.Group {
  const safeKind = Number.isFinite(kind)
    ? THREE.MathUtils.clamp(Math.floor(kind), 0, BUILDERS.length - 1)
    : 0;
  return (BUILDERS[safeKind] ?? buildKettle)(color);
}
