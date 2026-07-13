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

await fs.mkdir(artDir, { recursive: true });
await fs.mkdir(geeseDir, { recursive: true });

const themeAtlases = [
  ["fresh-market", "items-fresh-market-atlas.png"],
  ["farm-kitchen", "items-farm-kitchen-atlas.png"],
  ["night-market", "items-night-market-atlas.png"],
];

const ITEM_COUNT = 18;

const supplementalPalettes = {
  "fresh-market": ["#d94c52", "#63a55b", "#e5a72f", "#f2c84b", "#c86f4a", "#f0d78a"],
  "farm-kitchen": ["#b77943", "#4f83a2", "#c9894d", "#e4d1a5", "#c84f3b", "#8d6aa8"],
  "night-market": ["#3f8b78", "#d84b54", "#f2e1c2", "#e8c27a", "#e86c87", "#e8e2cf"],
};

function supplementalIconMarkup(themeId, offset) {
  const common = { stroke: "#563824", gold: "#f5be45", green: "#4f8c49", cream: "#fff2cf", red: "#c8413c" };
  const fresh = [
    `<path d="M70 154 Q150 184 230 154 L216 222 Q150 248 84 222Z" fill="url(#accent)"/><path d="M88 166 Q92 78 150 78 Q208 78 212 166" fill="none" stroke="#9a6339" stroke-width="13"/><g fill="url(#body)"><circle cx="112" cy="143" r="30"/><circle cx="151" cy="126" r="33"/><circle cx="190" cy="145" r="29"/></g><g fill="${common.cream}"><circle cx="103" cy="138" r="4"/><circle cx="145" cy="120" r="4"/><circle cx="184" cy="140" r="4"/></g><path d="M134 92l17-22 17 22-17 9z" fill="${common.green}"/>`,
    `<path d="M56 220 L150 58 L244 220Z" fill="${common.green}"/><path d="M69 211 L150 75 L231 211Z" fill="#e7efad"/><path d="M84 198 L150 92 L216 198Z" fill="url(#body)"/><g fill="#4a3028"><ellipse cx="128" cy="156" rx="6" ry="11"/><ellipse cx="171" cy="157" rx="6" ry="11"/><ellipse cx="150" cy="126" rx="6" ry="11"/></g>`,
    `<path d="M88 86 Q150 65 212 86 L205 224 Q150 246 95 224Z" fill="url(#body)"/><rect x="91" y="66" width="118" height="35" rx="12" fill="${common.gold}"/><rect x="103" y="126" width="94" height="69" rx="18" fill="${common.cream}"/><path d="M128 162h44M150 140v44" stroke="#a66a22" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M58 218 L237 218 L82 78Z" fill="url(#body)"/><path d="M58 218 L82 78 L98 97 L79 218Z" fill="#d99b29"/><g fill="#ad7422"><circle cx="116" cy="179" r="13"/><circle cx="145" cy="139" r="10"/><circle cx="181" cy="190" r="15"/><circle cx="100" cy="207" r="8"/></g>`,
    `<path d="M89 138h122l-15 106H104Z" fill="url(#body)"/><path d="M84 137q66-18 132 0" fill="none" stroke="#9e5738" stroke-width="14"/><path d="M150 142V83" stroke="${common.green}" stroke-width="10"/><path d="M149 97q-34-37-52-2 25 25 52 2M151 113q34-38 52-2-25 25-52 2" fill="${common.green}"/><g transform="translate(150 67)"><g fill="${common.cream}"><ellipse rx="16" ry="41" transform="rotate(0)"/><ellipse rx="16" ry="41" transform="rotate(60)"/><ellipse rx="16" ry="41" transform="rotate(120)"/></g><circle r="17" fill="${common.gold}"/></g>`,
    `<rect x="87" y="72" width="126" height="174" rx="15" fill="url(#body)"/><path d="M87 96l31-38h64l31 38" fill="url(#soft)"/><rect x="104" y="126" width="92" height="82" rx="17" fill="${common.cream}"/><path d="M149 190q-31-29-4-55 34 5 29 35-8 25-25 20Z" fill="${common.green}"/><path d="M185 72l17-38" stroke="${common.red}" stroke-width="9" stroke-linecap="round"/>`,
  ];
  const farm = [
    `<rect x="58" y="105" width="184" height="94" rx="45" fill="url(#body)"/><rect x="27" y="127" width="50" height="50" rx="23" fill="url(#soft)"/><rect x="223" y="127" width="50" height="50" rx="23" fill="url(#soft)"/><path d="M88 108v88M212 108v88" stroke="#754625" stroke-width="8"/>`,
    `<path d="M72 111h156l-14 116q-64 27-128 0Z" fill="url(#body)"/><ellipse cx="150" cy="108" rx="86" ry="22" fill="${common.cream}"/><path d="M98 106q52-56 104 0" fill="none" stroke="#293942" stroke-width="12"/><circle cx="150" cy="63" r="16" fill="${common.gold}"/><rect x="40" y="134" width="42" height="25" rx="10" fill="#293942"/><rect x="218" y="134" width="42" height="25" rx="10" fill="#293942"/>`,
    `<path d="M65 207Q66 82 150 72q84 10 85 135-85 38-170 0Z" fill="url(#body)"/><path d="M104 93l-20 60M150 75l-12 67M195 95l-20 58" stroke="#9a5e2f" stroke-width="10" stroke-linecap="round"/><path d="M76 204q74 25 148 0" stroke="${common.cream}" stroke-width="14"/>`,
    `<path d="M84 96h132l-9 139q-57 27-114 0Z" fill="${common.cream}"/><ellipse cx="150" cy="96" rx="70" ry="19" fill="url(#body)"/><path d="M91 136h118M91 200h118" stroke="#477fac" stroke-width="9"/><rect x="110" y="148" width="80" height="39" rx="12" fill="url(#body)"/><circle cx="150" cy="75" r="18" fill="${common.gold}"/>`,
    `<ellipse cx="147" cy="170" rx="66" ry="73" fill="url(#body)"/><circle cx="157" cy="92" r="43" fill="url(#body)"/><path d="M157 48q-18-31-31 2M157 48q0-37 17-5M170 51q20-26 28 4" fill="none" stroke="${common.red}" stroke-width="12"/><path d="M195 98l38 17-38 17Z" fill="${common.gold}"/><path d="M87 159q-42-45-51 14 31 5 56 28M88 154q-25-64-46-26" fill="none" stroke="#3f4936" stroke-width="13"/><circle cx="173" cy="89" r="5" fill="#2a2420"/>`,
    `<circle cx="143" cy="155" r="86" fill="url(#body)"/><g fill="none" stroke="url(#soft)" stroke-width="8"><ellipse cx="143" cy="155" rx="75" ry="37" transform="rotate(18 143 155)"/><ellipse cx="143" cy="155" rx="75" ry="37" transform="rotate(75 143 155)"/><ellipse cx="143" cy="155" rx="75" ry="37" transform="rotate(132 143 155)"/></g><path d="M179 102l75 122" stroke="#bd9a66" stroke-width="8" stroke-linecap="round"/>`,
  ];
  const night = [
    `<ellipse cx="137" cy="161" rx="76" ry="65" fill="url(#body)"/><path d="M205 145l55-43-28 72Z" fill="url(#body)"/><path d="M66 142q-49-35-53 23 8 51 60 18" fill="none" stroke="${common.gold}" stroke-width="13"/><ellipse cx="137" cy="91" rx="46" ry="14" fill="url(#soft)"/><circle cx="137" cy="70" r="14" fill="${common.gold}"/><path d="M114 162h46" stroke="${common.gold}" stroke-width="9"/>`,
    `<path d="M150 232L61 128Q150 36 239 128Z" fill="url(#body)"/><g stroke="${common.gold}" stroke-width="7"><path d="M150 232L61 128M150 232L94 91M150 232V66M150 232L206 91M150 232L239 128"/></g><circle cx="150" cy="232" r="17" fill="${common.gold}"/>`,
    `<ellipse cx="150" cy="175" rx="63" ry="74" fill="url(#body)"/><circle cx="150" cy="99" r="47" fill="url(#body)"/><path d="M112 67l14-35 20 31M188 67l-14-35-20 31" fill="url(#soft)"/><path d="M195 124v-71" stroke="url(#body)" stroke-width="25" stroke-linecap="round"/><circle cx="136" cy="98" r="5"/><circle cx="164" cy="98" r="5"/><circle cx="150" cy="174" r="30" fill="${common.gold}"/><path d="M140 174h20M150 164v20" stroke="${common.red}" stroke-width="6"/>`,
    `<path d="M62 128h176l-20 102q-68 35-136 0Z" fill="url(#body)"/><ellipse cx="150" cy="128" rx="88" ry="26" fill="#8b4c2d"/><g fill="none" stroke="#f1d183" stroke-width="9"><path d="M86 123q25-38 50 0t50 0 28 0"/><path d="M91 139q25-38 50 0t50 0"/></g><path d="M172 72l-34 110M203 79l-35 110" stroke="#b8893f" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M150 235Q49 203 81 126q25 30 45 19-9-47 24-87 33 40 24 87 20 11 45-19 32 77-69 109Z" fill="url(#body)"/><path d="M150 222q-50-38-26-92 26 29 26-49 26 78 26 49 24 54-26 92Z" fill="url(#soft)"/><circle cx="150" cy="172" r="24" fill="${common.gold}"/>`,
    `<rect x="88" y="51" width="124" height="198" rx="18" fill="${common.green}"/><rect x="101" y="64" width="98" height="172" rx="14" fill="url(#body)"/><g fill="none" stroke-width="8"><circle cx="132" cy="112" r="13" stroke="${common.red}"/><circle cx="168" cy="112" r="13" stroke="#2f7b5d"/><circle cx="132" cy="157" r="13" stroke="#2f7b5d"/><circle cx="168" cy="157" r="13" stroke="${common.red}"/><circle cx="150" cy="201" r="13" stroke="#2f7b5d"/></g>`,
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
    <path d="M92 58q38-25 76-9" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/>
  </svg>`);
}

// Atlases are authoring sources only. Runtime uses the cleaned transparent
// per-item files below, so remove legacy public atlases instead of shipping
// three large unused sprite sheets.
for (const [themeId] of themeAtlases) {
  await fs.rm(path.join(artDir, `items-${themeId}-atlas.webp`), { force: true });
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
  for (let kind = 12; kind < ITEM_COUNT; kind += 1) {
    await sharp(supplementalItemSvg(themeId, kind), { density: 144 })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(targetDir, `item-${String(kind).padStart(2, "0")}.webp`));
  }
}

await emitBrand("logo-master.png", "logo", 512, 512);
await emitBrand("banner-master.png", "banner", 1024, 512);

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

const collectionGeese = Array.from({ length: 6 }, (_, index) => {
  const id = String(index).padStart(2, "0");
  return [`goose-collection-${id}.png`, `goose-${id}.webp`];
});

for (const [source, output, width, height, quality] of assets) {
  await emitWebAsset(source, output, width, height, quality);
}

for (const [source, output] of collectionGeese) {
  await emitCollectionGoose(source, output);
}

for (const [themeId, source] of themeAtlases) {
  await emitItemSprites(themeId, source);
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
