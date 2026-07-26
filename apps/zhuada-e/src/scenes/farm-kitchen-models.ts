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
  const handleEnamel = surface(tint(color, -0.24), "metal", {
    metalness: 0.34,
    clearcoat: 0.52,
  });

  group.add(lathe([
    [0.42, -0.58], [0.61, -0.52], [0.7, -0.24], [0.68, 0.18],
    [0.56, 0.4], [0.38, 0.46], [0.33, 0.52],
  ], p.base, 22));

  const base = horizontalRing(0.55, 0.055, blackMetal);
  base.position.y = -0.54;
  group.add(base);
  const baseSeal = cylinder(0.53, 0.53, 0.07, p.base, 22);
  baseSeal.position.y = -0.57;
  baseSeal.userData.detailLayer = "kettle-base-seal";
  group.add(baseSeal);

  // The kettle is read almost entirely from above. A pale lid field and a
  // coloured enamel ring keep it identifiable as cookware even when the body
  // treatment is green or purple rather than the authored red.
  const lid = cylinder(0.4, 0.45, 0.11, p.cream, 20);
  lid.position.y = 0.49;
  group.add(lid);
  const lidRing = horizontalRing(0.38, 0.045, p.light, 22);
  lidRing.position.y = 0.56;
  lidRing.userData.detailLayer = "kettle-lid-ring";
  group.add(lidRing);

  const knob = sphere(0.12, blackMetal, 12, 8);
  knob.scale.set(1.25, 0.75, 1.25);
  knob.position.y = 0.61;
  group.add(knob);

  // Author the spout and handle in the X/Z footprint rather than as vertical
  // side-view lines. They remain real three-dimensional kettle parts, but now
  // retain their silhouette in the game's fixed overhead camera instead of
  // looking like arbitrary black slashes painted over a round fruit.
  const spout = tube([
    new THREE.Vector3(-0.48, 0.08, 0),
    new THREE.Vector3(-0.7, 0.13, 0.04),
    new THREE.Vector3(-0.9, 0.18, 0.17),
    new THREE.Vector3(-1.07, 0.22, 0.3),
  ], 0.12, p.light, 18, 8);
  group.add(spout);

  const spoutLip = cylinder(0.14, 0.14, 0.075, blackMetal, 14);
  spoutLip.rotation.z = Math.PI / 2;
  spoutLip.rotation.y = -0.55;
  spoutLip.position.set(-1.08, 0.23, 0.31);
  group.add(spoutLip);

  const handle = tube([
    new THREE.Vector3(0.4, 0.28, -0.34),
    new THREE.Vector3(0.64, 0.54, -0.58),
    new THREE.Vector3(0.86, 0.78, 0),
    new THREE.Vector3(0.64, 0.54, 0.58),
    new THREE.Vector3(0.4, 0.28, 0.34),
  ], 0.085, handleEnamel, 24, 8);
  handle.userData.detailLayer = "kettle-overhead-handle";
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

  // A bottle must still read as a bottle when Cannon leaves it cap-down. The
  // old short lip became a flat circular disc from the overhead camera; a
  // raised neck, cap crown and contrasting cap seal preserve the vertical
  // silhouette and give the viewer three unmistakable orientation cues.
  const neck = cylinder(0.2, 0.235, 0.22, thickGlass, 20);
  neck.position.y = 0.88;
  neck.userData.detailLayer = "bottle-neck";
  group.add(neck);
  const capCrown = cylinder(0.235, 0.235, 0.12, blue, 20);
  capCrown.position.y = 1.04;
  capCrown.userData.detailLayer = "bottle-cap-crown";
  group.add(capCrown);
  const capSeal = cylinder(0.16, 0.16, 0.035, cream, 18);
  capSeal.position.y = 1.115;
  capSeal.userData.detailLayer = "bottle-cap-seal";
  group.add(capSeal);

  // Wrap the large label around all four sides. A bottle tumbling in the pan
  // should never show an unmarked white/blue disc simply because its front
  // label rotated away from the camera.
  for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    const label = roundedBox(0.56, 0.36, 0.045, 0.08, cream, 3);
    label.position.set(Math.sin(angle) * 0.485, -0.03, Math.cos(angle) * 0.485);
    label.rotation.y = angle;
    label.userData.detailLayer = "bottle-label";
    group.add(label);
  }
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
  const baseSeal = cylinder(0.25, 0.25, 0.025, p.cream, 18);
  baseSeal.position.y = -0.48;
  baseSeal.userData.detailLayer = "bowl-base-seal";
  group.add(baseSeal);
  const baseRing = horizontalRing(0.16, 0.025, p.blue, 18);
  baseRing.position.y = -0.498;
  baseRing.userData.detailLayer = "bowl-base-ring";
  group.add(baseRing);
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

  for (const facing of [-1, 1] as const) {
    const label = roundedBox(0.66, 0.34, 0.05, 0.08, cream, 3);
    label.position.set(0, -0.06, facing * 0.535);
    label.rotation.y = facing < 0 ? Math.PI : 0;
    label.userData.detailLayer = "jam-label";
    group.add(label);
  }
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

  const mitt = extrudedShape([
    [-0.38, -0.52], [0.31, -0.52], [0.43, -0.25], [0.42, 0.43],
    [0.28, 0.65], [0.08, 0.68], [-0.02, 0.54], [-0.09, 0.18],
    [-0.22, 0.42], [-0.4, 0.36], [-0.49, 0.12], [-0.5, -0.25],
  ], 0.22, 0.07, fabric);
  group.add(mitt);

  const cuff = roundedBox(0.9, 0.24, 0.31, 0.08, trim, 3);
  cuff.position.y = -0.55;
  group.add(cuff);

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

  const baseSeal = cylinder(0.34, 0.34, 0.07, cream, 20);
  baseSeal.position.y = -0.66;
  baseSeal.userData.detailLayer = "jug-base-seal";
  group.add(baseSeal);
  return finishModel(group);
}

function buildHeartCookie(color: number): THREE.Group {
  const group = new THREE.Group();
  const biscuit = surface(color, "paper");
  const icing = surface(0xffd46e, "glaze");
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

  return finishModel(group);
}

function buildRollingPin(color: number): THREE.Group {
  const group = new THREE.Group();
  const wood = surface(color, "wood");
  const light = surface(tint(color, 0.14), "wood");
  const dark = surface(tint(color, -0.2), "wood");
  const roller = cylinder(0.38, 0.38, 1.45, wood, 24);
  roller.rotation.z = Math.PI / 2;
  group.add(roller);
  for (const x of [-0.94, 0.94]) {
    const axle = cylinder(0.15, 0.15, 0.48, dark, 18);
    axle.rotation.z = Math.PI / 2;
    axle.position.x = x;
    group.add(axle);
    const grip = capsule(0.19, 0.56, light, "x");
    grip.position.x = x + Math.sign(x) * 0.27;
    group.add(grip);
  }
  return finishModel(group);
}

function buildCookingPot(color: number): THREE.Group {
  const group = new THREE.Group();
  const enamel = surface(color, "metal", { metalness: 0.38, clearcoat: 0.62 });
  const cream = surface(0xfff1cf, "ceramic");
  const dark = surface(0x2d3235, "metal");
  group.add(lathe([[0.48, -0.52], [0.64, -0.44], [0.67, 0.32], [0.61, 0.42]], enamel, 26));
  const rim = horizontalRing(0.64, 0.05, cream, 24);
  rim.position.y = 0.42;
  group.add(rim);
  const lid = cylinder(0.57, 0.62, 0.14, cream, 24);
  lid.position.y = 0.5;
  group.add(lid);
  const knob = sphere(0.14, dark, 14, 10);
  knob.position.y = 0.68;
  group.add(knob);
  for (const x of [-0.78, 0.78]) {
    const handle = roundedBox(0.34, 0.15, 0.23, 0.07, dark, 3);
    handle.position.set(x, 0.14, 0);
    group.add(handle);
  }
  const baseSeal = cylinder(0.5, 0.5, 0.07, dark, 24);
  baseSeal.position.y = -0.52;
  baseSeal.userData.detailLayer = "pot-base-seal";
  group.add(baseSeal);
  return finishModel(group);
}

function buildCountryLoaf(color: number): THREE.Group {
  const group = new THREE.Group();
  const crust = surface(color, "produce", { roughness: 0.72, clearcoat: 0.08 });
  const crumb = surface(tint(color, 0.19), "paper");
  const loaf = roundedBox(1.28, 0.72, 0.86, 0.32, crust, 6);
  loaf.position.y = -0.02;
  group.add(loaf);
  const belly = roundedBox(1.08, 0.34, 0.89, 0.16, crumb, 5);
  belly.position.set(0, -0.25, 0.02);
  group.add(belly);
  for (const [x, z] of [[-0.42, 0.35], [0.18, 0.39], [0.48, -0.31]] as const) {
    const flour = sphere(0.04, crumb, 8, 6);
    flour.scale.y = 0.3;
    flour.position.set(x, 0.37, z);
    group.add(flour);
  }
  return finishModel(group);
}

function buildButterCrock(color: number): THREE.Group {
  const group = new THREE.Group();
  const ceramic = surface(color, "ceramic");
  const blue = surface(0x3e79ad, "glaze");
  const butter = surface(0xf4ce55, "produce");
  group.add(cylinder(0.54, 0.5, 0.78, ceramic, 24));
  const foot = horizontalRing(0.46, 0.045, blue, 22);
  foot.position.y = -0.4;
  group.add(foot);
  const lid = cylinder(0.57, 0.57, 0.15, blue, 24);
  lid.position.y = 0.45;
  group.add(lid);
  const knob = sphere(0.14, butter, 14, 10);
  knob.position.y = 0.64;
  group.add(knob);
  const plaque = roundedBox(0.55, 0.3, 0.045, 0.1, butter, 3);
  plaque.position.set(0, -0.03, 0.51);
  group.add(plaque);
  return finishModel(group);
}

function buildRooster(color: number): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = surface(color, "produce");
  const cream = surface(0xffe6b8, "produce");
  const red = surface(0xb8392f, "produce");
  const beak = surface(0xf1ad35, "glaze");
  const dark = surface(0x332d2a, "matte");
  const body = sphere(0.52, bodyMat, 20, 14);
  body.scale.set(0.9, 1.12, 0.78);
  body.position.y = -0.18;
  group.add(body);
  const chest = sphere(0.34, cream);
  chest.scale.z = 0.45;
  chest.position.set(0, -0.05, 0.43);
  group.add(chest);
  const head = sphere(0.3, bodyMat);
  head.position.set(0, 0.52, 0.08);
  group.add(head);
  const bill = part(new THREE.ConeGeometry(0.13, 0.35, 5), beak);
  bill.rotation.x = Math.PI / 2;
  bill.position.set(0, 0.5, 0.38);
  group.add(bill);
  for (const x of [-0.14, 0, 0.14]) {
    const comb = sphere(0.1, red, 10, 7);
    comb.position.set(x, 0.82 + (x === 0 ? 0.05 : 0), 0.04);
    group.add(comb);
  }
  for (const x of [-0.11, 0.11]) {
    const eye = sphere(0.04, dark, 9, 6);
    eye.position.set(x, 0.61, 0.28);
    group.add(eye);
  }
  for (let i = 0; i < 3; i += 1) {
    const tail = leaf(0.82 - i * 0.1, 0.28, i === 1 ? red : dark);
    tail.position.set((i - 1) * 0.12, 0.03 + i * 0.08, -0.5);
    tail.rotation.x = 0.72 + i * 0.14;
    group.add(tail);
  }
  return finishModel(group);
}

function buildYarnBall(color: number): THREE.Group {
  const group = new THREE.Group();
  const yarn = surface(color, "fabric");
  const light = surface(tint(color, 0.18), "fabric");
  group.add(sphere(0.62, yarn, 22, 16));
  for (let i = 0; i < 7; i += 1) {
    const strand = part(new THREE.TorusGeometry(0.54 - (i % 2) * 0.05, 0.025, 6, 28), i % 2 ? light : yarn);
    strand.rotation.set(i * 0.37, i * 0.52, i * 0.24);
    group.add(strand);
  }
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
  buildRollingPin,
  buildCookingPot,
  buildCountryLoaf,
  buildButterCrock,
  buildRooster,
  buildYarnBall,
];

/** Build one production farm-kitchen base recipe (authored kinds 0..17). */
export function buildFarmKitchenModel(kind: number, color: number): THREE.Group {
  const safeKind = Number.isFinite(kind)
    ? THREE.MathUtils.clamp(Math.floor(kind), 0, BUILDERS.length - 1)
    : 0;
  return (BUILDERS[safeKind] ?? buildKettle)(color);
}
