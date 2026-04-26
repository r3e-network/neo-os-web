#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  args.set(arg.slice(2), process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "true");
}

const atlasPath = args.get("atlas");

const hostAssetRoot = path.join(repoRoot, "platform/host-app/public/miniapp-assets");
const definitionRoot = path.join(repoRoot, "platform/host-app/public/miniapp-definitions");
const appsRoot = path.join(repoRoot, "apps");

const cols = 8;
const rows = 9;

const PLANNED_ATLASES = [
  {
    file: "scripts/miniapp-asset-sources/planned-atlas-01.png",
    cols: 4,
    rows: 4,
    slugs: [
      "aa-account-lab",
      "aa-market-hub",
      "aa-permissions-lab",
      "aa-relay-console",
      "aa-session-key-lab",
      "automation-copilot",
      "breakup-contract",
      "burn-league",
      "candidate-vote",
      "charity-vault",
      "coin-flip",
      "compound-capsule",
      "council-governance",
      "daily-checkin",
      "dev-tipping",
      "dice-game",
    ],
  },
  {
    file: "scripts/miniapp-asset-sources/planned-atlas-02.png",
    cols: 4,
    rows: 4,
    slugs: [
      "doomsday-clock",
      "event-ticket-pass",
      "ex-files",
      "explorer",
      "flamingo-action-center",
      "flamingo-analytics",
      "flamingo-earn",
      "flamingo-lend",
      "flamingo-swap",
      "flashloan",
      "fogplay",
      "forever-album",
      "garden-of-neo",
      "gas-sponsor",
      "gasbox",
      "gov-merc",
    ],
  },
  {
    file: "scripts/miniapp-asset-sources/planned-atlas-03.png",
    cols: 4,
    rows: 4,
    slugs: [
      "grant-share",
      "graveyard",
      "guardian-policy",
      "hall-of-fame",
      "heritage-trust",
      "last-survivor",
      "lottery",
      "masquerade-dao",
      "memorial-shrine",
      "milestone-escrow",
      "million-piece-map",
      "neo-convert",
      "neo-gacha",
      "neo-multisig",
      "neo-news-today",
      "neo-ns",
    ],
  },
  {
    file: "scripts/miniapp-asset-sources/planned-atlas-04.png",
    cols: 4,
    rows: 4,
    slugs: [
      "neo-pay",
      "neo-sign-anything",
      "neo-swap",
      "neo-treasury",
      "neoburger",
      "on-chain-tarot",
      "oracle-price-console",
      "piggy-bank",
      "prediction-market",
      "profitanchor",
      "quadratic-funding",
      "recovery-guardian",
      "red-envelope",
      "secret-vote",
      "self-loan",
      "social-karma",
    ],
  },
  {
    file: "scripts/miniapp-asset-sources/planned-atlas-05.png",
    cols: 4,
    rows: 3,
    slugs: [
      "soulbound-certificate",
      "stream-vault",
      "time-capsule",
      "timestamp-proof",
      "tipping",
      "trustanchor",
      "turtle-match",
      "unbreakable-vault",
      "voting",
      "wallet-health",
      "zk-privacy",
    ],
  },
];

const CATEGORY_BY_SLUG = {
  "coin-flip": "gaming",
  "doomsday-clock": "gaming",
  "gasbox": "gaming",
  "last-survivor": "gaming",
  lottery: "gaming",
  "neo-gacha": "gaming",
  "on-chain-tarot": "gaming",
  "turtle-match": "gaming",

  "flamingo-action-center": "defi",
  "flamingo-analytics": "defi",
  "flamingo-earn": "defi",
  "flamingo-lend": "defi",
  "flamingo-swap": "defi",
  flashloan: "defi",
  "milestone-escrow": "defi",
  "neo-pay": "defi",
  "neo-swap": "defi",
  neoburger: "defi",
  "piggy-bank": "defi",
  "prediction-market": "defi",
  profitanchor: "defi",
  "quadratic-funding": "defi",
  "self-loan": "defi",
  "stream-vault": "defi",

  "candidate-vote": "governance",
  "council-governance": "governance",
  "gov-merc": "governance",
  "grant-share": "governance",
  "masquerade-dao": "governance",
  "secret-vote": "governance",
  trustanchor: "governance",
  voting: "governance",

  "breakup-contract": "social",
  "dev-tipping": "social",
  "event-ticket-pass": "social",
  "ex-files": "social",
  "forever-album": "social",
  "hall-of-fame": "social",
  "heritage-trust": "social",
  "memorial-shrine": "social",
  "million-piece-map": "social",
  "neo-news-today": "social",
  "red-envelope": "social",
  "social-karma": "social",
  "soulbound-certificate": "social",
  "time-capsule": "social",
  tipping: "social",

  "automation-copilot": "data",
  explorer: "data",
  "oracle-price-console": "data",
  "timestamp-proof": "data",
  "zk-privacy": "data",
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function slugFromAssetUrl(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/\/miniapp-assets\/([^/?#]+)\//);
  return match ? match[1] : "";
}

function normalizeCategory(value, slug) {
  const raw = String(value || CATEGORY_BY_SLUG[slug] || "utility").toLowerCase();
  if (raw.includes("game")) return "gaming";
  if (raw.includes("defi") || raw.includes("finance")) return "defi";
  if (raw.includes("govern")) return "governance";
  if (raw.includes("social")) return "social";
  if (raw.includes("data") || raw.includes("oracle") || raw.includes("analytics")) return "data";
  return CATEGORY_BY_SLUG[slug] || "utility";
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .map((part) => (part.toLowerCase() === "aa" ? "AA" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function buildInventory() {
  const slugs = new Set();
  const metadata = new Map();

  for (const entry of fs.readdirSync(appsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    const slug = entry.name;
    slugs.add(slug);
    const manifest = readJson(path.join(appsRoot, slug, "neo-manifest.json")) || {};
    metadata.set(slug, {
      slug,
      app: true,
      name: manifest.name || titleFromSlug(slug),
      description: manifest.description || "",
      category: normalizeCategory(manifest.category, slug),
    });
  }

  if (fs.existsSync(hostAssetRoot)) {
    for (const entry of fs.readdirSync(hostAssetRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
      slugs.add(entry.name);
      if (!metadata.has(entry.name)) {
        metadata.set(entry.name, {
          slug: entry.name,
          app: false,
          name: titleFromSlug(entry.name),
          description: "",
          category: normalizeCategory("", entry.name),
        });
      }
    }
  }

  for (const file of fs.readdirSync(definitionRoot).filter((name) => name.endsWith(".json"))) {
    const full = path.join(definitionRoot, file);
    const json = readJson(full);
    if (!json) continue;
    const media = json.media || {};
    const candidates = [
      slugFromAssetUrl(media.icon),
      slugFromAssetUrl(media.logo),
      slugFromAssetUrl(media.logo_url),
      slugFromAssetUrl(media.banner),
      slugFromAssetUrl(media.banner_url),
      file.replace(/\.json$/, "").replace(/\.example$/, ""),
    ].filter(Boolean);
    const slug = candidates.find((candidate) => candidate !== "miniapp-config.schema") || "";
    if (!slug || slug === "miniapp-config.schema") continue;
    slugs.add(slug);
    const existing = metadata.get(slug) || {};
    metadata.set(slug, {
      slug,
      app: Boolean(existing.app),
      name: existing.name || json.name || titleFromSlug(slug),
      description: existing.description || json.description || "",
      category: normalizeCategory(existing.category || json.category, slug),
    });
  }

  return [...slugs]
    .filter((slug) => slug !== "miniapp-config.schema")
    .sort()
    .map((slug) => {
      const item = metadata.get(slug) || { slug, name: titleFromSlug(slug), description: "", category: "utility" };
      return { ...item, category: normalizeCategory(item.category, slug) };
    });
}

const BANNER_LAYOUTS = [
  { art: { x: 70, y: 74, w: 332, h: 332, r: 54 }, panel: { x: 420, y: 70, w: 700, h: 340, r: 42 } },
  { art: { x: 796, y: 68, w: 352, h: 352, r: 70 }, panel: { x: 50, y: 58, w: 700, h: 358, r: 34 } },
  { art: { x: 72, y: 96, w: 288, h: 288, r: 144 }, panel: { x: 398, y: 72, w: 720, h: 324, r: 160 } },
  { art: { x: 838, y: 104, w: 270, h: 270, r: 36 }, panel: { x: 64, y: 88, w: 680, h: 304, r: 24 } },
  { art: { x: 456, y: 54, w: 288, h: 288, r: 52 }, panel: { x: 56, y: 316, w: 1088, h: 118, r: 28 } },
  { art: { x: 72, y: 56, w: 366, h: 366, r: 28 }, panel: { x: 470, y: 44, w: 664, h: 386, r: 18 } },
  { art: { x: 742, y: 48, w: 386, h: 386, r: 193 }, panel: { x: 54, y: 56, w: 650, h: 360, r: 52 } },
];

function hashSlug(slug) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function bannerLayout(slug) {
  return BANNER_LAYOUTS[hashSlug(slug) % BANNER_LAYOUTS.length];
}

function bannerOverlaySvg(layout) {
  const accentX = Math.min(1120, Math.max(80, layout.panel.x + layout.panel.w - 160));
  const accentY = Math.min(400, Math.max(80, layout.panel.y + 82));
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480">
      <defs>
        <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#020617" stop-opacity="0.24"/>
          <stop offset="0.52" stop-color="#020617" stop-opacity="0.05"/>
          <stop offset="1" stop-color="#020617" stop-opacity="0.42"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.36"/>
        </filter>
      </defs>
      <rect width="1200" height="480" fill="url(#shade)"/>
      <rect x="${layout.panel.x}" y="${layout.panel.y}" width="${layout.panel.w}" height="${layout.panel.h}" rx="${layout.panel.r}" fill="#020617" opacity="0.24" filter="url(#shadow)"/>
      <rect x="${layout.panel.x + 1}" y="${layout.panel.y + 1}" width="${layout.panel.w - 2}" height="${layout.panel.h - 2}" rx="${Math.max(0, layout.panel.r - 1)}" fill="none" stroke="#ffffff" stroke-opacity="0.14"/>
      <circle cx="${accentX}" cy="${accentY}" r="150" fill="#ffffff" opacity="0.08"/>
      <path d="M${layout.panel.x + 58} ${layout.panel.y + layout.panel.h - 76} C ${layout.panel.x + 250} ${layout.panel.y + 40}, ${layout.panel.x + layout.panel.w - 260} ${layout.panel.y + layout.panel.h + 22}, ${layout.panel.x + layout.panel.w - 70} ${layout.panel.y + 96}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="3"/>
      <path d="M${layout.panel.x + 80} ${layout.panel.y + 96} H ${layout.panel.x + layout.panel.w - 90}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" stroke-linecap="round" stroke-dasharray="18 22"/>
      <circle cx="${layout.panel.x + 88}" cy="${layout.panel.y + 96}" r="9" fill="#ffffff" opacity="0.2"/>
      <circle cx="${layout.panel.x + layout.panel.w - 90}" cy="${layout.panel.y + 96}" r="9" fill="#ffffff" opacity="0.2"/>
    </svg>
  `);
}

async function tileBuffer(atlas, index, meta, sourceCols = cols, sourceRows = rows) {
  const cellCount = sourceCols * sourceRows;
  const cellIndex = index % cellCount;
  const col = cellIndex % sourceCols;
  const row = Math.floor(cellIndex / sourceCols);
  const left = Math.round((col * meta.width) / sourceCols);
  const top = Math.round((row * meta.height) / sourceRows);
  const right = Math.round(((col + 1) * meta.width) / sourceCols);
  const bottom = Math.round(((row + 1) * meta.height) / sourceRows);
  const insetX = Math.round((right - left) * 0.035);
  const insetY = Math.round((bottom - top) * 0.035);
  let tile = atlas.clone().extract({
    left: left + insetX,
    top: top + insetY,
    width: Math.max(1, right - left - insetX * 2),
    height: Math.max(1, bottom - top - insetY * 2),
  });

  if (index >= cellCount) {
    tile = tile
      .rotate((Math.floor(index / cellCount) * 90) % 360)
      .flop()
      .modulate({ brightness: 1.04, saturation: 1.1, hue: (index * 37) % 360 });
  }

  return tile.png().toBuffer();
}

async function roundedTile(tile, width, height, radius) {
  const resized = await sharp(tile).resize(width, height, { fit: "cover" }).png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`);
  return sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function tinyWrapper(kind, slug) {
  const width = kind === "logo" ? 1024 : 1200;
  const height = kind === "logo" ? 1024 : 480;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="${kind}.jpg" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/></svg>\n`;
}

async function writeAssets(item, tile, index) {
  const logo = await sharp(tile)
    .resize(1024, 1024, { fit: "cover" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const layout = bannerLayout(item.slug);
  const bannerBackground = await sharp(tile)
    .resize(1200, 480, { fit: "cover" })
    .blur(8)
    .modulate({ brightness: 0.68, saturation: 1.16 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const bannerArt = await roundedTile(tile, layout.art.w, layout.art.h, layout.art.r);
  const artShadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.art.w + 64}" height="${layout.art.h + 64}"><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#020617" flood-opacity="0.48"/></filter><rect x="32" y="32" width="${layout.art.w}" height="${layout.art.h}" rx="${layout.art.r}" fill="#000" opacity="0.65" filter="url(#s)"/></svg>`);
  const overlay = bannerOverlaySvg(layout);
  const banner = await sharp(bannerBackground)
    .composite([
      { input: artShadow, left: layout.art.x - 32, top: layout.art.y - 32 },
      { input: bannerArt, left: layout.art.x, top: layout.art.y },
      { input: overlay, left: 0, top: 0 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const hostDir = path.join(hostAssetRoot, item.slug);
  fs.mkdirSync(hostDir, { recursive: true });
  fs.writeFileSync(path.join(hostDir, "logo.jpg"), logo);
  fs.writeFileSync(path.join(hostDir, "banner.jpg"), banner);
  fs.writeFileSync(
    path.join(hostDir, "logo.webp"),
    await sharp(logo).webp({ quality: 88, effort: 5, smartSubsample: true }).toBuffer(),
  );
  fs.writeFileSync(
    path.join(hostDir, "banner.webp"),
    await sharp(banner).webp({ quality: 88, effort: 5, smartSubsample: true }).toBuffer(),
  );
  fs.writeFileSync(
    path.join(hostDir, "logo.avif"),
    await sharp(logo).avif({ quality: 68, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer(),
  );
  fs.writeFileSync(
    path.join(hostDir, "banner.avif"),
    await sharp(banner).avif({ quality: 68, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer(),
  );
  fs.writeFileSync(path.join(hostDir, "logo.svg"), tinyWrapper("logo", item.slug));
  fs.writeFileSync(path.join(hostDir, "banner.svg"), tinyWrapper("banner", item.slug));

  const appDir = path.join(appsRoot, item.slug);
  if (fs.existsSync(appDir)) {
    const publicDir = path.join(appDir, "public");
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, "logo.jpg"), logo);
    fs.writeFileSync(path.join(publicDir, "banner.jpg"), banner);
    fs.writeFileSync(
      path.join(publicDir, "logo.webp"),
      await sharp(logo).webp({ quality: 88, effort: 5, smartSubsample: true }).toBuffer(),
    );
    fs.writeFileSync(
      path.join(publicDir, "banner.webp"),
      await sharp(banner).webp({ quality: 88, effort: 5, smartSubsample: true }).toBuffer(),
    );
    fs.writeFileSync(
      path.join(publicDir, "logo.avif"),
      await sharp(logo).avif({ quality: 68, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer(),
    );
    fs.writeFileSync(
      path.join(publicDir, "banner.avif"),
      await sharp(banner).avif({ quality: 68, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer(),
    );
  }

  return { slug: item.slug, index, category: item.category, hostDir };
}

function updateAppManifests(inventoryBySlug) {
  for (const item of inventoryBySlug.values()) {
    const file = path.join(appsRoot, item.slug, "neo-manifest.json");
    const manifest = readJson(file);
    if (!manifest) continue;
    manifest.urls = { ...(manifest.urls || {}) };
    manifest.urls.icon = `/miniapps/${item.slug}/logo.jpg`;
    manifest.urls.banner = `/miniapps/${item.slug}/banner.jpg`;
    writeJson(file, manifest);
  }
}

function inferDefinitionSlug(file, json, inventoryBySlug) {
  const media = json.media || {};
  const urls = json.urls || {};
  const candidates = [
    slugFromAssetUrl(media.icon),
    slugFromAssetUrl(media.logo),
    slugFromAssetUrl(media.logo_url),
    slugFromAssetUrl(media.banner),
    slugFromAssetUrl(media.banner_url),
    slugFromAssetUrl(urls.icon),
    slugFromAssetUrl(urls.banner),
    file.replace(/\.json$/, "").replace(/\.example$/, ""),
  ].filter(Boolean);
  return candidates.find((slug) => inventoryBySlug.has(slug)) || "";
}

function updateDefinitions(inventoryBySlug) {
  for (const file of fs.readdirSync(definitionRoot).filter((name) => name.endsWith(".json"))) {
    if (file === "miniapp-config.schema.json") continue;
    const full = path.join(definitionRoot, file);
    const json = readJson(full);
    if (!json) continue;
    const slug = inferDefinitionSlug(file, json, inventoryBySlug);
    if (!slug) continue;
    json.media = { ...(json.media || {}) };
    json.media.icon = `/miniapp-assets/${slug}/logo.jpg`;
    json.media.banner = `/miniapp-assets/${slug}/banner.jpg`;
    delete json.media.logo;
    delete json.media.logo_url;
    delete json.media.banner_url;
    writeJson(full, json);
  }
}

function removeOldPlaceholders(inventoryBySlug) {
  const oldNames = ["icon.png", "logo.png", "banner.png", "icon.svg"];
  for (const slug of inventoryBySlug.keys()) {
    const hostDir = path.join(hostAssetRoot, slug);
    if (!fs.existsSync(hostDir)) continue;
    for (const name of oldNames) {
      const file = path.join(hostDir, name);
      if (fs.existsSync(file)) fs.rmSync(file);
    }
  }
}

function resolveSourceFile(file) {
  return path.isAbsolute(file) ? file : path.join(repoRoot, file);
}

function buildSourcePlan(inventory) {
  const bySlug = new Map();

  if (atlasPath) {
    for (let i = 0; i < inventory.length; i += 1) {
      bySlug.set(inventory[i].slug, { file: resolveSourceFile(atlasPath), cols, rows, index: i });
    }
    return { mode: "single-atlas", bySlug };
  }

  for (const atlas of PLANNED_ATLASES) {
    const file = resolveSourceFile(atlas.file);
    if (!fs.existsSync(file)) {
      console.error(`Missing planned source atlas: ${file}`);
      process.exit(1);
    }
    atlas.slugs.forEach((slug, index) => {
      bySlug.set(slug, { file, cols: atlas.cols, rows: atlas.rows, index });
    });
  }

  const missing = inventory.map((item) => item.slug).filter((slug) => !bySlug.has(slug));
  if (missing.length) {
    console.error(`Planned source atlas mapping is missing ${missing.length} slug(s): ${missing.join(", ")}`);
    console.error("Pass --atlas <generated-atlas.png> for one-off fallback generation.");
    process.exit(1);
  }

  return { mode: "planned-atlases", bySlug };
}

async function readSourceTile(source, cache) {
  let cached = cache.get(source.file);
  if (!cached) {
    const atlas = sharp(source.file);
    cached = { atlas, meta: await atlas.metadata() };
    cache.set(source.file, cached);
  }
  return tileBuffer(cached.atlas, source.index, cached.meta, source.cols, source.rows);
}

const inventory = buildInventory();
const sourcePlan = buildSourcePlan(inventory);
const sourceCache = new Map();
const outputs = [];
for (let i = 0; i < inventory.length; i += 1) {
  const source = sourcePlan.bySlug.get(inventory[i].slug);
  const tile = await readSourceTile(source, sourceCache);
  outputs.push(await writeAssets(inventory[i], tile, i));
}

const inventoryBySlug = new Map(inventory.map((item) => [item.slug, item]));
updateAppManifests(inventoryBySlug);
updateDefinitions(inventoryBySlug);
removeOldPlaceholders(inventoryBySlug);

console.log(JSON.stringify({ ok: true, sourceMode: sourcePlan.mode, atlas: atlasPath || null, count: outputs.length, slugs: outputs.map((out) => out.slug) }, null, 2));
