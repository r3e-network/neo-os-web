#!/usr/bin/env node
/**
 * Optimize the approved, original ImageGen masters into production web assets.
 * Source PNGs live outside public/ so Vite does not ship the multi-megabyte
 * masters; every runtime file below is reproducible from art-src/.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(appDir, "art-src");
const publicDir = path.join(appDir, "public");
const artDir = path.join(publicDir, "art");
const geeseDir = path.join(artDir, "geese");
const variantsOnly = process.argv.includes("--variants-only");

await fs.mkdir(artDir, { recursive: true });
await fs.mkdir(geeseDir, { recursive: true });

const themeAtlases = [
  ["fresh-market", "items-fresh-market-atlas.png"],
  ["farm-kitchen", "items-farm-kitchen-atlas.png"],
  ["night-market", "items-night-market-atlas.png"],
];

const BASE_ITEM_COUNT = 18;
const ITEM_COUNT = 54;

const supplementalPalettes = {
  "fresh-market": ["#d94c52", "#63a55b", "#e5a72f", "#f2c84b", "#c86f4a", "#f0d78a"],
  "farm-kitchen": ["#b77943", "#4f83a2", "#c9894d", "#e4d1a5", "#c84f3b", "#8d6aa8"],
  "night-market": ["#3f8b78", "#d84b54", "#f2e1c2", "#e8c27a", "#e86c87", "#e8e2cf"],
};

function supplementalIconMarkup(themeId, offset) {
  const common = { gold: "#f5be45", green: "#4f8c49", cream: "#fff2cf", red: "#c8413c", dark: "#563824" };
  const fresh = [
    `<path d="M66 168Q150 190 234 168L218 230Q150 258 82 230Z" fill="url(#accent)"/><g fill="url(#body)"><circle cx="111" cy="145" r="34"/><circle cx="151" cy="126" r="38"/><circle cx="191" cy="145" r="34"/></g><path d="M150 92q-12-28-29-6l18 18Z" fill="${common.green}"/>`,
    `<path d="M58 224L150 58l92 166Z" fill="${common.green}"/><path d="M73 214L150 76l77 138Z" fill="#e7efad"/><path d="M88 202L150 94l62 108Z" fill="url(#body)"/>`,
    `<path d="M88 90Q150 66 212 90L204 228Q150 252 96 228Z" fill="url(#body)"/><rect x="88" y="70" width="124" height="34" rx="14" fill="${common.gold}"/><path d="M106 129h88v65h-88Z" fill="${common.cream}"/>`,
    `<path d="M58 224L238 224L83 72Z" fill="url(#body)"/><path d="M58 224L83 72L102 96L80 224Z" fill="#d99b29"/>`,
    `<path d="M88 142h124l-16 104H104Z" fill="url(#body)"/><path d="M150 142V82" stroke="${common.green}" stroke-width="12"/><path d="M150 94Q115 67 100 102Q124 126 150 108Q176 126 200 102Q185 67 150 94Z" fill="${common.green}"/><circle cx="150" cy="62" r="18" fill="${common.gold}"/>`,
    `<rect x="88" y="72" width="124" height="176" rx="16" fill="url(#body)"/><path d="M88 98L119 58h62l31 40Z" fill="url(#soft)"/><rect x="104" y="128" width="92" height="82" rx="17" fill="${common.cream}"/><path d="M185 72L202 34" stroke="${common.red}" stroke-width="10" stroke-linecap="round"/>`,
  ];
  const farm = [
    `<g fill="url(#body)"><rect x="34" y="124" width="232" height="42" rx="20"/><rect x="58" y="100" width="184" height="90" rx="44"/></g><circle cx="62" cy="145" r="22" fill="url(#soft)"/><circle cx="238" cy="145" r="22" fill="url(#soft)"/>`,
    `<path d="M72 112h156l-14 116q-64 27-128 0Z" fill="url(#body)"/><ellipse cx="150" cy="108" rx="86" ry="22" fill="${common.cream}"/><path d="M98 106q52-56 104 0" fill="none" stroke="#293942" stroke-width="12"/><circle cx="150" cy="63" r="16" fill="${common.gold}"/>`,
    `<path d="M65 207Q66 82 150 72q84 10 85 135-85 38-170 0Z" fill="url(#body)"/><path d="M76 204q74 25 148 0" stroke="${common.cream}" stroke-width="14"/>`,
    `<path d="M84 96h132l-9 139q-57 27-114 0Z" fill="${common.cream}"/><ellipse cx="150" cy="96" rx="70" ry="19" fill="url(#body)"/><rect x="110" y="148" width="80" height="39" rx="12" fill="url(#body)"/>`,
    `<ellipse cx="147" cy="170" rx="66" ry="73" fill="url(#body)"/><circle cx="157" cy="92" r="43" fill="url(#body)"/><path d="M195 98l38 17-38 17Z" fill="${common.gold}"/><path d="M87 159q-42-45-51 14 31 5 56 28M88 154q-25-64-46-26" fill="none" stroke="#3f4936" stroke-width="13"/>`,
    `<circle cx="143" cy="151" r="82" fill="url(#body)"/><path d="M83 127Q143 75 204 126Q143 100 83 127Z" fill="url(#soft)"/><path d="M68 165Q143 112 218 164Q143 139 68 165Z" fill="url(#soft)"/><path d="M83 199Q143 158 203 198Q143 181 83 199Z" fill="url(#soft)"/><path d="M193 202Q249 210 240 252Q211 239 185 220Z" fill="url(#body)"/>`,
  ];
  const night = [
    `<path d="M83 126Q83 213 150 232Q217 213 217 126Q150 151 83 126Z" fill="url(#body)"/><ellipse cx="150" cy="124" rx="68" ry="20" fill="${common.cream}"/><path d="M211 136Q268 105 259 161Q247 179 213 170Z" fill="url(#body)"/><path d="M94 129Q42 112 43 174Q48 220 108 205" fill="none" stroke="${common.gold}" stroke-width="17"/><rect x="119" y="88" width="62" height="18" rx="9" fill="${common.gold}"/><circle cx="150" cy="74" r="14" fill="${common.gold}"/>`,
    `<path d="M150 232L64 132Q150 42 236 132Z" fill="url(#body)"/><path d="M150 232L150 68" stroke="${common.gold}" stroke-width="9"/><circle cx="150" cy="232" r="17" fill="${common.gold}"/>`,
    `<ellipse cx="150" cy="176" rx="63" ry="74" fill="url(#body)"/><circle cx="150" cy="98" r="47" fill="url(#body)"/><path d="M112 67l14-35 20 31M188 67l-14-35-20 31" fill="url(#soft)"/><path d="M195 124v-71" stroke="url(#body)" stroke-width="25" stroke-linecap="round"/><circle cx="136" cy="98" r="5"/><circle cx="164" cy="98" r="5"/><ellipse cx="150" cy="178" rx="27" ry="20" fill="${common.gold}"/>`,
    `<path d="M62 130h176l-20 101q-68 35-136 0Z" fill="url(#body)"/><ellipse cx="150" cy="128" rx="88" ry="26" fill="#8b4c2d"/><path d="M100 144Q150 112 200 144" fill="none" stroke="#f1d183" stroke-width="11"/>`,
    `<path d="M150 235Q49 203 81 126q25 30 45 19-9-47 24-87 33 40 24 87 20 11 45-19 32 77-69 109Z" fill="url(#body)"/><path d="M150 222Q123 196 150 170Q177 196 150 222Z" fill="url(#soft)"/><circle cx="150" cy="168" r="22" fill="${common.gold}"/>`,
    `<rect x="88" y="51" width="124" height="198" rx="18" fill="${common.green}"/><rect x="101" y="64" width="98" height="172" rx="14" fill="url(#body)"/><path d="M121 90h58v122h-58Z" fill="${common.cream}"/>`,
  ];
  return (themeId === "fresh-market" ? fresh : themeId === "farm-kitchen" ? farm : night)[offset];
}

function supplementalItemSvg(themeId, kind) {
  const offset = kind - 12;
  const body = supplementalPalettes[themeId][offset];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".38"/><stop offset=".28" stop-color="${body}"/><stop offset="1" stop-color="${body}" stop-opacity=".76"/></linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f2c37c"/><stop offset="1" stop-color="#986036"/></linearGradient>
      <linearGradient id="soft" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7df"/><stop offset="1" stop-color="${body}"/></linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#322016" flood-opacity=".34"/></filter>
    </defs>
    <g filter="url(#shadow)" stroke="#563824" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${supplementalIconMarkup(themeId, offset)}</g>
  </svg>`);
}

function rgbToHsl(red, green, blue) {
  red /= 255;
  green /= 255;
  blue /= 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }
  return [hue, saturation, lightness];
}

function hueToRgb(p, q, hue) {
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) return [lightness * 255, lightness * 255, lightness * 255];
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255,
  ];
}

function hueDistanceDegrees(left, right) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

function variantTreatment(baseHue, baseLightness, baseKind, variant) {
  const anchor = (baseKind * 137.508 + 24) % 360;
  const firstHue = hueDistanceDegrees(anchor, baseHue) < 75
    ? (anchor + 180) % 360
    : anchor;
  const secondCandidates = [(firstHue + 120) % 360, (firstHue + 240) % 360];
  const secondHue = secondCandidates.reduce((best, candidate) => (
    hueDistanceDegrees(candidate, baseHue) > hueDistanceDegrees(best, baseHue)
      ? candidate
      : best
  ));
  return variant === 1
    ? {
        hue: firstHue / 360,
        saturation: 0.68 + (baseKind % 3) * 0.05,
        lightness: baseLightness > 0.68 ? 0.5 : 0.59,
      }
    : {
        hue: secondHue / 360,
        saturation: 0.66 + ((baseKind + 1) % 3) * 0.05,
        lightness: baseLightness > 0.68 ? 0.43 : 0.54,
      };
}

function applyColorTreatment(data, info, variant, themeId, baseKind) {
  // Most bodies tolerate a generous hue family so gradients recolour as one
  // continuous skin. Candied fruit needs a tighter family because its wooden
  // skewer is deliberately close to the authored red/orange body hue.
  const bodyHueTolerance = themeId === "farm-kitchen" && baseKind === 4
    ? 0.22
    : themeId === "night-market" && baseKind === 0
      ? 0.06
    : themeId === "night-market" && baseKind === 4
      ? 0.08
      : 0.11;
  const neutralBodyMaxLightness = themeId === "night-market" && baseKind === 17 ? 1 : 0.94;
  let red = 0;
  let green = 0;
  let blue = 0;
  let visible = 0;
  let saturated = 0;
  const hueWeights = new Float64Array(36);
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] < 32) continue;
    red += data[offset];
    green += data[offset + 1];
    blue += data[offset + 2];
    visible += 1;
    const [hue, saturation, lightness] = rgbToHsl(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    // Ignore very dark outlines and tiny bright highlights when deciding
    // which authored colour owns the main body. Their saturation can be high
    // enough to outweigh a broad pastel surface even though their area is
    // small (the frying pan used to be classified by its brown rim).
    if (saturation >= 0.24 && lightness >= 0.25 && lightness <= 0.88) {
      hueWeights[Math.min(hueWeights.length - 1, Math.floor(hue * hueWeights.length))]
        += 0.75 + data[offset + 3] / 255;
      saturated += 1;
    }
  }
  let dominantBin = 0;
  for (let index = 1; index < hueWeights.length; index += 1) {
    if (hueWeights[index] > hueWeights[dominantBin]) dominantBin = index;
  }
  const [averageHue, , averageLightness] = rgbToHsl(red / visible, green / visible, blue / visible);
  const baseHue = saturated >= visible * 0.12
    ? (dominantBin + 0.5) / hueWeights.length
    : averageHue;
  // The night-market framed cake has a broad cream centre surrounded by a
  // saturated border. Area, not border saturation, defines its colour identity.
  const neutralBody = saturated < visible * 0.12
    || (themeId === "night-market" && baseKind === 17);
  const hueDistance = (left, right) => {
    const distance = Math.abs(left - right);
    return Math.min(distance, 1 - distance);
  };
  let bodyLightness = 0;
  let bodyWeight = 0;
  if (!neutralBody) {
    for (let offset = 0; offset < data.length; offset += info.channels) {
      if (data[offset + 3] < 32) continue;
      const [hue, saturation, lightness] = rgbToHsl(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      if (saturation < 0.24 || hueDistance(hue, baseHue) > bodyHueTolerance) continue;
      const weight = saturation * (0.6 + data[offset + 3] / 255);
      bodyLightness += lightness * weight;
      bodyWeight += weight;
    }
  }
  const baseLightness = bodyWeight > 0 ? bodyLightness / bodyWeight : averageLightness;
  // Keep raster thumbnails on the same family-distributed colour treatment as
  // the 3D material resolver in logic/themes.ts. This avoids a random opening
  // collapsing into one purple/mint palette while preserving the icon's own
  // highlights, shadows and structural accents.
  const treatment = variantTreatment(baseHue * 360, baseLightness, baseKind, variant);
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] < 16) continue;
    const [sourceHue, sourceSaturation, sourceLightness] = rgbToHsl(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    const belongsToBody = neutralBody
      ? sourceLightness >= 0.17
        && sourceLightness <= neutralBodyMaxLightness
        && sourceSaturation < 0.48
      : sourceSaturation >= 0.12
        && sourceLightness >= 0.25
        && sourceLightness <= Math.min(0.93, baseLightness + 0.38)
        && hueDistance(sourceHue, baseHue) <= bodyHueTolerance;
    // Keep structural materials stable. Brass rims, ceramic faces, wooden
    // handles, cream labels and dark outlines are what make the 30px tray
    // chip read as the same physical model after it tumbles into the tray.
    if (!belongsToBody) continue;
    // Preserve the source illustration's local highlight/shadow relationship
    // around its own average hue. Adding the raw hue directly made warm red
    // accents pull the entire variant back toward red, defeating the large
    // green/purple colour block promised by the 3D material resolver.
    const rawHueDelta = sourceHue - baseHue;
    const relativeHue = rawHueDelta > 0.5
      ? rawHueDelta - 1
      : rawHueDelta < -0.5
        ? rawHueDelta + 1
        : rawHueDelta;
    const [nextRed, nextGreen, nextBlue] = hslToRgb(
      (treatment.hue + relativeHue * 0.28 + 1) % 1,
      Math.min(1, Math.max(0.35, treatment.saturation * 0.78 + sourceSaturation * 0.22)),
      Math.min(1, Math.max(0.06, treatment.lightness + (sourceLightness - baseLightness) * 0.78)),
    );
    data[offset] = Math.round(nextRed);
    data[offset + 1] = Math.round(nextGreen);
    data[offset + 2] = Math.round(nextBlue);
  }
  return data;
}

async function emitVariantSprites(themeId) {
  const targetDir = path.join(artDir, "items", themeId);
  for (let kind = BASE_ITEM_COUNT; kind < ITEM_COUNT; kind += 1) {
    const baseKind = kind % BASE_ITEM_COUNT;
    const variant = Math.floor(kind / BASE_ITEM_COUNT);
    const baseFile = path.join(targetDir, `item-${String(baseKind).padStart(2, "0")}.webp`);
    const { data, info } = await sharp(baseFile)
      .modulate({ hue: 0, saturation: 1, brightness: 1 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    await sharp(applyColorTreatment(data, info, variant, themeId, baseKind), { raw: info })
      .webp({ quality: 92, alphaQuality: 100, effort: 3 })
      .toFile(path.join(targetDir, `item-${String(kind).padStart(2, "0")}.webp`));
  }
}

// Atlases are authoring sources only. Runtime uses the cleaned transparent
// per-item files below, so remove legacy public atlases instead of shipping
// three large unused sprite sheets.
if (!variantsOnly) {
  for (const [themeId] of themeAtlases) {
    await fs.rm(path.join(artDir, `items-${themeId}-atlas.webp`), { force: true });
  }
}

async function emitBrand(sourceName, base, width, height) {
  const source = sharp(path.join(sourceDir, sourceName)).resize(width, height, {
    fit: "cover",
    position: "centre",
  });
  await source.clone().png({ compressionLevel: 9, palette: true }).toFile(path.join(publicDir, `${base}.png`));
  await source.clone().webp({ quality: 86, smartSubsample: true }).toFile(path.join(publicDir, `${base}.webp`));
  await source.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(publicDir, `${base}.avif`));
}

async function emitWebAsset(sourceName, outputName, width, height, quality = 80) {
  await sharp(path.join(sourceDir, sourceName))
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality, smartSubsample: true, effort: 6 })
    .toFile(path.join(artDir, outputName));
}

async function emitCollectionGoose(sourceName, outputName) {
  await sharp(path.join(sourceDir, sourceName))
    .resize(512, 512, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 })
    .toFile(path.join(geeseDir, outputName));
}

/** Remove only the pale atlas background connected to a tile's outer edge.
 * The dark cartoon outline protects cream/white objects (egg, cup, bun) from
 * being keyed out, unlike a global color-distance mask. */
function removeConnectedBackground(data, width, height) {
  const total = width * height;
  const corner = 12;
  let r = 0;
  let g = 0;
  let b = 0;
  let samples = 0;
  const sampleBlock = (x0, y0) => {
    for (let y = y0; y < y0 + corner; y += 1) {
      for (let x = x0; x < x0 + corner; x += 1) {
        const p = (y * width + x) * 4;
        r += data[p];
        g += data[p + 1];
        b += data[p + 2];
        samples += 1;
      }
    }
  };
  sampleBlock(0, 0);
  sampleBlock(width - corner, 0);
  sampleBlock(0, height - corner);
  sampleBlock(width - corner, height - corner);
  const bg = [r / samples, g / samples, b / samples];
  const toleranceSq = 44 * 44;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const canRemove = (index) => {
    const p = index * 4;
    const dr = data[p] - bg[0];
    const dg = data[p + 1] - bg[1];
    const db = data[p + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= toleranceSq;
  };
  const enqueue = (index) => {
    if (visited[index] || !canRemove(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  for (let i = 0; i < total; i += 1) {
    if (visited[i]) data[i * 4 + 3] = 0;
  }
  return data;
}

/** Image generators can let a neighboring cell graze an atlas boundary. Keep
 * the dominant centered object (plus a nearby detached baked shadow) and drop
 * disconnected edge debris before the tile becomes a runtime texture. */
function removeDisconnectedDebris(data, width, height) {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  const components = [];
  for (let seed = 0; seed < total; seed += 1) {
    if (labels[seed] !== -1 || data[seed * 4 + 3] < 12) continue;
    const id = components.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    labels[seed] = id;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const visit = (next) => {
        if (labels[next] !== -1 || data[next * 4 + 3] < 12) return;
        labels[next] = id;
        queue[tail++] = next;
      };
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    components.push({ count, minX, minY, maxX, maxY });
  }
  if (components.length <= 1) return data;
  let mainId = 0;
  for (let i = 1; i < components.length; i += 1) {
    if (components[i].count > components[mainId].count) mainId = i;
  }
  const main = components[mainId];
  const gap = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
  const keep = new Uint8Array(components.length);
  keep[mainId] = 1;
  components.forEach((component, id) => {
    if (id === mainId || component.count < 36) return;
    const dx = gap(main.minX, main.maxX, component.minX, component.maxX);
    const dy = gap(main.minY, main.maxY, component.minY, component.maxY);
    const touchesEdge = component.minX <= 1 || component.minY <= 1
      || component.maxX >= width - 2 || component.maxY >= height - 2;
    if (!touchesEdge && Math.hypot(dx, dy) <= 24) keep[id] = 1;
  });
  for (let i = 0; i < total; i += 1) {
    if (labels[i] >= 0 && !keep[labels[i]]) data[i * 4 + 3] = 0;
  }
  return data;
}

async function emitItemSprites(themeId, sourceName) {
  const normalized = await sharp(path.join(sourceDir, sourceName))
    .resize(1200, 900, { fit: "fill" })
    .png()
    .toBuffer();
  const targetDir = path.join(artDir, "items", themeId);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  for (let kind = 0; kind < 12; kind += 1) {
    const col = kind % 4;
    const row = Math.floor(kind / 4);
    const { data, info } = await sharp(normalized)
      .extract({ left: col * 300, top: row * 300, width: 300, height: 300 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeConnectedBackground(data, info.width, info.height);
    removeDisconnectedDebris(data, info.width, info.height);
    await sharp(data, { raw: info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(targetDir, `item-${String(kind).padStart(2, "0")}.webp`));
  }
  for (let kind = 12; kind < BASE_ITEM_COUNT; kind += 1) {
    await sharp(supplementalItemSvg(themeId, kind), { density: 144 })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(targetDir, `item-${String(kind).padStart(2, "0")}.webp`));
  }
}

const assets = [
  ["theme-fresh-market.png", "theme-fresh-market.webp", 768, 1152, 78],
  ["theme-farm-kitchen.png", "theme-farm-kitchen.webp", 768, 1152, 78],
  ["theme-night-market.png", "theme-night-market.webp", 768, 1152, 80],
  ["mascot-fresh-market.png", "mascot-fresh-market.webp", 512, 512, 86],
  ["mascot-farm-kitchen.png", "mascot-farm-kitchen.webp", 512, 512, 86],
  ["mascot-night-market.png", "mascot-night-market.webp", 512, 512, 88],
  ["container-fresh-market.png", "container-fresh-market.webp", 1024, 1024, 86],
  ["container-farm-kitchen.png", "container-farm-kitchen.webp", 1024, 1024, 86],
  ["container-night-market.png", "container-night-market.webp", 1024, 1024, 88],
];

const collectionGeese = Array.from({ length: 9 }, (_, index) => {
  const id = String(index).padStart(2, "0");
  return [`goose-collection-${id}.png`, `goose-${id}.webp`];
});

if (!variantsOnly) {
  await emitBrand("logo-master.png", "logo", 512, 512);
  await emitBrand("banner-master.png", "banner", 1024, 512);
  for (const [source, output, width, height, quality] of assets) {
    await emitWebAsset(source, output, width, height, quality);
  }
  for (const [source, output] of collectionGeese) {
    await emitCollectionGoose(source, output);
  }
  for (const [themeId, source] of themeAtlases) {
    await emitItemSprites(themeId, source);
  }
}

for (const [themeId] of themeAtlases) {
  await emitVariantSprites(themeId);
}

for (const file of [
  "logo.png", "logo.webp", "logo.avif",
  "banner.png", "banner.webp", "banner.avif",
  ...assets.map(([, output]) => path.join("art", output)),
  ...collectionGeese.map(([, output]) => path.join("art", "geese", output)),
  ...themeAtlases.flatMap(([themeId]) => Array.from(
    { length: ITEM_COUNT },
    (_, kind) => path.join("art", "items", themeId, `item-${String(kind).padStart(2, "0")}.webp`),
  )),
]) {
  const stat = await fs.stat(path.join(publicDir, file));
  console.log(`${file}\t${stat.size} bytes`);
}
