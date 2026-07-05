import dns from "node:dns";
import { execFile } from "node:child_process";
import { mkdir, rm, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first");

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/cards");
const TMP_DIR = `${OUT_DIR}.tmp`;
const TAROT_JSON_REPO = "https://github.com/metabismuth/tarot-json";
const TAROT_JSON_RAW = "https://raw.githubusercontent.com/metabismuth/tarot-json/master/cards";
const CARD_BACK_WIDTH = 825;
const CARD_BACK_HEIGHT = 1425;
const CARD_FRONT_WIDTH = 825;
const CARD_FRONT_HEIGHT = 1425;
const CARD_ART_X = 143;
const CARD_ART_Y = 296;
const CARD_ART_WIDTH = 540;
const CARD_ART_HEIGHT = 830;
const CARD_ART_RADIUS = 32;
const ART_PANEL_PAD = 18;
const ART_PANEL_X = CARD_ART_X - ART_PANEL_PAD;
const ART_PANEL_Y = CARD_ART_Y - ART_PANEL_PAD;
const ART_PANEL_WIDTH = CARD_ART_WIDTH + ART_PANEL_PAD * 2;
const ART_PANEL_HEIGHT = CARD_ART_HEIGHT + ART_PANEL_PAD * 2;
const SOURCE_ART_CROP = { left: 10, top: 10, width: 330, height: 505 };
const CARD_BACK_SOURCE = path.resolve(__dirname, "assets/neo-tarot-card-back.png");
const CARD_FRONT_FRAME_SOURCE = path.resolve(__dirname, "assets/neo-tarot-card-front-frame.png");

const MAJOR_ARCANA = [
  ["The Fool", "0", "Spark", "Leap"],
  ["The Magician", "I", "Protocol", "Intent"],
  ["The High Priestess", "II", "Oracle", "Signal"],
  ["The Empress", "III", "Growth", "Creation"],
  ["The Emperor", "IV", "Order", "Governance"],
  ["The Hierophant", "V", "Canon", "Trust"],
  ["The Lovers", "VI", "Bridge", "Choice"],
  ["The Chariot", "VII", "Vector", "Will"],
  ["Strength", "VIII", "Courage", "Grace"],
  ["The Hermit", "IX", "Beacon", "Inquiry"],
  ["Wheel of Fortune", "X", "Cycle", "Chance"],
  ["Justice", "XI", "Ledger", "Balance"],
  ["The Hanged Man", "XII", "Pause", "Perspective"],
  ["Death", "XIII", "Release", "Renewal"],
  ["Temperance", "XIV", "Flow", "Alchemy"],
  ["The Devil", "XV", "Shadow", "Attachment"],
  ["The Tower", "XVI", "Break", "Truth"],
  ["The Star", "XVII", "Hope", "Guidance"],
  ["The Moon", "XVIII", "Dream", "Mystery"],
  ["The Sun", "XIX", "Radiance", "Joy"],
  ["Judgement", "XX", "Awakening", "Call"],
  ["The World", "XXI", "Network", "Completion"],
];

const SUITS = [
  { id: "wands", title: "Wands", baseId: 22, keyword: "Will", sourcePrefix: "w" },
  { id: "cups", title: "Cups", baseId: 36, keyword: "Feeling", sourcePrefix: "c" },
  { id: "swords", title: "Swords", baseId: 50, keyword: "Mind", sourcePrefix: "s" },
  { id: "pentacles", title: "Pentacles", baseId: 64, keyword: "Matter", sourcePrefix: "p" },
];

const RANKS = [
  ["Ace", "A", "Seed"],
  ["Two", "II", "Pair"],
  ["Three", "III", "Build"],
  ["Four", "IV", "Base"],
  ["Five", "V", "Tension"],
  ["Six", "VI", "Harmony"],
  ["Seven", "VII", "Test"],
  ["Eight", "VIII", "Motion"],
  ["Nine", "IX", "Mastery"],
  ["Ten", "X", "Harvest"],
  ["Page", "P", "Message"],
  ["Knight", "N", "Quest"],
  ["Queen", "Q", "Sovereign"],
  ["King", "K", "Command"],
];

const SUIT_STYLES = {
  major: {
    label: "Major Arcana",
    top: "#053a35",
    field: "#0a554b",
    accent: "#21d6a5",
    gold: "#efd37b",
    glow: "#bfffe5",
  },
  wands: {
    label: "Wands",
    top: "#3d1f11",
    field: "#8b451c",
    accent: "#f5a623",
    gold: "#ffe1a1",
    glow: "#ffe2a3",
  },
  cups: {
    label: "Cups",
    top: "#123353",
    field: "#256f9b",
    accent: "#40c3f7",
    gold: "#dff5ff",
    glow: "#c6f4ff",
  },
  swords: {
    label: "Swords",
    top: "#172033",
    field: "#465a78",
    accent: "#a9c3e8",
    gold: "#eef4ff",
    glow: "#dcecff",
  },
  pentacles: {
    label: "Pentacles",
    top: "#17351f",
    field: "#4f7c36",
    accent: "#9fe05f",
    gold: "#f6e78a",
    glow: "#e9ffd0",
  },
};

function slugify(value) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildArtMaskSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" viewBox="0 0 ${CARD_ART_WIDTH} ${CARD_ART_HEIGHT}">
  <rect width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" rx="${CARD_ART_RADIUS}" ry="${CARD_ART_RADIUS}" fill="#ffffff"/>
</svg>`;
}

function buildArtPanelBackingSvg(card) {
  const style = SUIT_STYLES[card.suit] ?? SUIT_STYLES.major;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_FRONT_WIDTH}" height="${CARD_FRONT_HEIGHT}" viewBox="0 0 ${CARD_FRONT_WIDTH} ${CARD_FRONT_HEIGHT}">
  <defs>
    <linearGradient id="parchment" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff2cf"/>
      <stop offset=".52" stop-color="#ead49a"/>
      <stop offset="1" stop-color="#c9a969"/>
    </linearGradient>
    <filter id="paperGrain" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".018 .032" numOctaves="3" seed="${card.id + 17}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .22"/>
      </feComponentTransfer>
    </filter>
    <filter id="panelShadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#06110f" flood-opacity=".3"/>
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#fff8dd" flood-opacity=".6"/>
    </filter>
  </defs>
  <g filter="url(#panelShadow)">
    <rect x="${ART_PANEL_X}" y="${ART_PANEL_Y}" width="${ART_PANEL_WIDTH}" height="${ART_PANEL_HEIGHT}" rx="46" ry="46" fill="url(#parchment)" stroke="${style.gold}" stroke-width="8" stroke-opacity=".82"/>
    <rect x="${ART_PANEL_X + 9}" y="${ART_PANEL_Y + 9}" width="${ART_PANEL_WIDTH - 18}" height="${ART_PANEL_HEIGHT - 18}" rx="37" ry="37" fill="none" stroke="${style.top}" stroke-width="2" stroke-opacity=".26"/>
    <rect x="${ART_PANEL_X + 14}" y="${ART_PANEL_Y + 14}" width="${ART_PANEL_WIDTH - 28}" height="${ART_PANEL_HEIGHT - 28}" rx="32" ry="32" filter="url(#paperGrain)" opacity=".3"/>
  </g>
</svg>`;
}

function buildArtTreatmentSvg(card) {
  const style = SUIT_STYLES[card.suit] ?? SUIT_STYLES.major;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" viewBox="0 0 ${CARD_ART_WIDTH} ${CARD_ART_HEIGHT}">
  <defs>
    <linearGradient id="warmWash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff0bc" stop-opacity=".18"/>
      <stop offset=".5" stop-color="#f4d997" stop-opacity=".08"/>
      <stop offset="1" stop-color="#5b3b18" stop-opacity=".18"/>
    </linearGradient>
    <radialGradient id="vignette" cx=".5" cy=".42" r=".78">
      <stop offset=".6" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#071915" stop-opacity=".24"/>
    </radialGradient>
    <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".28"/>
      <stop offset=".34" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".12"/>
    </linearGradient>
    <filter id="softInner" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#05120f" flood-opacity=".26"/>
    </filter>
  </defs>
  <rect width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" rx="${CARD_ART_RADIUS}" ry="${CARD_ART_RADIUS}" fill="url(#warmWash)"/>
  <g opacity=".14" stroke="${style.gold}" stroke-width="2.2" stroke-linecap="round" fill="none">
    <path d="M52 88 C136 50 214 78 280 146 S432 236 488 178"/>
    <path d="M58 704 C148 654 232 694 304 756 S432 814 492 746"/>
    <path d="M78 144 L178 206 L278 158 L384 226 L474 168"/>
    <path d="M72 640 L188 582 L294 648 L408 594 L480 660"/>
  </g>
  <g opacity=".22" fill="${style.accent}" stroke="${style.gold}" stroke-width="2">
    <circle cx="78" cy="144" r="5"/>
    <circle cx="178" cy="206" r="4"/>
    <circle cx="278" cy="158" r="5"/>
    <circle cx="384" cy="226" r="4"/>
    <circle cx="474" cy="168" r="5"/>
    <circle cx="72" cy="640" r="5"/>
    <circle cx="188" cy="582" r="4"/>
    <circle cx="294" cy="648" r="5"/>
    <circle cx="408" cy="594" r="4"/>
    <circle cx="480" cy="660" r="5"/>
  </g>
  <rect width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" rx="${CARD_ART_RADIUS}" ry="${CARD_ART_RADIUS}" fill="url(#vignette)"/>
  <rect width="${CARD_ART_WIDTH}" height="${CARD_ART_HEIGHT}" rx="${CARD_ART_RADIUS}" ry="${CARD_ART_RADIUS}" fill="url(#glint)"/>
  <rect x="8" y="8" width="${CARD_ART_WIDTH - 16}" height="${CARD_ART_HEIGHT - 16}" rx="${CARD_ART_RADIUS - 8}" ry="${CARD_ART_RADIUS - 8}" fill="none" stroke="${style.gold}" stroke-width="6" stroke-opacity=".68" filter="url(#softInner)"/>
  <rect x="20" y="20" width="${CARD_ART_WIDTH - 40}" height="${CARD_ART_HEIGHT - 40}" rx="${CARD_ART_RADIUS - 15}" ry="${CARD_ART_RADIUS - 15}" fill="none" stroke="#fff7dd" stroke-width="2" stroke-opacity=".6"/>
</svg>`;
}

function buildDeck() {
  const major = MAJOR_ARCANA.map(([name, roman, keyword, meaning], id) => ({
    id,
    name,
    suit: "major",
    number: id,
    roman,
    keyword,
    meaning,
    sourceFile: `m${String(id).padStart(2, "0")}.webp`,
    slug: `${String(id).padStart(2, "0")}-${slugify(name)}`,
  }));

  const minor = SUITS.flatMap((suit) =>
    RANKS.map(([rank, roman, rankKeyword], index) => {
      const id = suit.baseId + index;
      const name = `${rank} of ${suit.title}`;
      const sourceNumber = String(index + 1).padStart(2, "0");
      return {
        id,
        name,
        suit: suit.id,
        number: index + 1,
        roman,
        keyword: `${rankKeyword} ${suit.keyword}`,
        meaning: suit.keyword,
        sourceFile: `${suit.sourcePrefix}${sourceNumber}.webp`,
        slug: `${String(id).padStart(2, "0")}-${slugify(name)}`,
      };
    }),
  );

  return [...major, ...minor];
}

async function downloadFile(url, filename) {
  const output = path.join(TMP_DIR, filename);

  await execFileAsync("curl", [
    "-L",
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "5",
    "--retry-delay",
    "1",
    "--connect-timeout",
    "20",
    "--max-time",
    "90",
    "--user-agent",
    "neo-miniapps-platform tarot asset importer",
    "--output",
    output,
    url,
  ]);

  const fileStat = await stat(output);
  if (fileStat.size < 1024) {
    throw new Error(`Downloaded asset is unexpectedly small: ${filename}`);
  }
}

function buildNeoCardTextOverlaySvg(card) {
  const style = SUIT_STYLES[card.suit] ?? SUIT_STYLES.major;
  const title = escapeXml(card.name.toUpperCase());
  const roman = escapeXml(card.roman);
  const suit = escapeXml(style.label.toUpperCase());
  const keyword = String(card.keyword);
  const meaningLine = keyword.toLowerCase().includes(String(card.meaning).toLowerCase())
    ? keyword
    : `${keyword} / ${card.meaning}`;
  const meaning = escapeXml(meaningLine.toUpperCase());

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_FRONT_WIDTH}" height="${CARD_FRONT_HEIGHT}" viewBox="0 0 ${CARD_FRONT_WIDTH} ${CARD_FRONT_HEIGHT}">
  <defs>
    <filter id="inkShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#fff8df" flood-opacity=".68"/>
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#06110f" flood-opacity=".2"/>
    </filter>
    <filter id="goldLift" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#fff5cf" flood-opacity=".72"/>
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#06110f" flood-opacity=".22"/>
    </filter>
  </defs>
  <g filter="url(#inkShadow)" font-family="Georgia, Times New Roman, serif" text-rendering="geometricPrecision">
    <text x="342" y="200" text-anchor="middle" fill="${style.top}" font-size="15" font-weight="700" letter-spacing="3.6">${suit}</text>
    <text x="412.5" y="222" text-anchor="middle" fill="${style.field}" font-family="Inter, Avenir Next, Arial, sans-serif" font-size="9.5" font-weight="900" letter-spacing="4">NEO N3 ORACLE</text>
    <text x="602" y="203" text-anchor="end" fill="${style.top}" font-size="25" font-weight="700" letter-spacing="1">${roman}</text>

    <text x="412.5" y="1226" text-anchor="middle" fill="${style.top}" font-size="27" font-weight="700" letter-spacing="2.2">${title}</text>
    <text x="412.5" y="1260" text-anchor="middle" fill="${style.field}" font-family="Inter, Avenir Next, Arial, sans-serif" font-size="10.5" font-weight="900" letter-spacing="3.4">${meaning}</text>
    <g filter="url(#goldLift)" opacity=".9">
      <path d="M330 1288 H496" stroke="${style.gold}" stroke-width="3" stroke-linecap="round"/>
      <path d="M402 1288 L412.5 1278 L423 1288 L412.5 1298 Z" fill="${style.accent}" stroke="${style.gold}" stroke-width="2"/>
    </g>
  </g>
</svg>`;
}

async function generateNeoCardFront(sourcePath, card, filename) {
  await stat(CARD_FRONT_FRAME_SOURCE);

  const frame = await sharp(CARD_FRONT_FRAME_SOURCE)
    .resize({
      width: CARD_FRONT_WIDTH,
      height: CARD_FRONT_HEIGHT,
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();

  const artMask = await sharp(Buffer.from(buildArtMaskSvg())).png().toBuffer();
  const artTreatment = await sharp(Buffer.from(buildArtTreatmentSvg(card))).png().toBuffer();
  const artPanelBacking = await sharp(Buffer.from(buildArtPanelBackingSvg(card))).png().toBuffer();

  const baseArt = await sharp(sourcePath)
    .extract(SOURCE_ART_CROP)
    .resize({
      width: CARD_ART_WIDTH,
      height: CARD_ART_HEIGHT,
      fit: "cover",
      position: "center",
    })
    .modulate({
      brightness: 1.035,
      saturation: 0.82,
    })
    .gamma(1.04)
    .sharpen({ sigma: 0.28 })
    .png()
    .toBuffer();

  const framedArt = await sharp(baseArt)
    .composite([
      { input: artTreatment, left: 0, top: 0 },
      { input: artMask, left: 0, top: 0, blend: "dest-in" },
    ])
    .png()
    .toBuffer();

  const textOverlay = await sharp(Buffer.from(buildNeoCardTextOverlaySvg(card))).png().toBuffer();

  await sharp(frame)
    .composite([
      { input: artPanelBacking, left: 0, top: 0 },
      { input: framedArt, left: CARD_ART_X, top: CARD_ART_Y },
      { input: textOverlay, left: 0, top: 0 },
    ])
    .jpeg({
      quality: 88,
      mozjpeg: true,
      chromaSubsampling: "4:2:0",
    })
    .toFile(path.join(TMP_DIR, filename));
}

async function generateNeoCardBack() {
  await stat(CARD_BACK_SOURCE);

  await sharp(CARD_BACK_SOURCE)
    .resize({
      width: CARD_BACK_WIDTH,
      height: CARD_BACK_HEIGHT,
      fit: "cover",
      position: "center",
    })
    .jpeg({
      quality: 91,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    })
    .toFile(path.join(TMP_DIR, "back.webp"));
}

async function main() {
  const deck = buildDeck();

  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });

  await generateNeoCardBack();

  const index = [];
  for (const card of deck) {
    const filename = `${card.slug}.webp`;
    const sourceFile = `${card.slug}.source.jpg`;
    await downloadFile(`${TAROT_JSON_RAW}/${card.sourceFile}`, sourceFile);
    await generateNeoCardFront(path.join(TMP_DIR, sourceFile), card, filename);
    await rm(path.join(TMP_DIR, sourceFile), { force: true });
    index.push({
      id: card.id,
      name: card.name,
      suit: card.suit,
      number: card.number,
      keyword: card.keyword,
      meaning: card.meaning,
      image: `./cards/${filename}`,
      source: `${TAROT_JSON_REPO}/tree/master/cards/${card.sourceFile}`,
      license: "MIT repository metadata; Rider-Waite-Smith card scans referenced by source repository",
      style: "Neo Tarot illuminated Art Nouveau card with integrated Rider-Waite-Smith oracle panel",
    });
  }

  await writeFile(path.join(TMP_DIR, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(TMP_DIR, "ATTRIBUTION.md"),
      `# On-Chain Tarot Card Art\n\n` +
      `Card fronts combine scanned Rider-Waite-Smith tarot imagery from the [metabismuth/tarot-json](${TAROT_JSON_REPO}) project with the original illustrated Neo Tarot front template [neo-tarot-card-front-frame.png](../../scripts/assets/neo-tarot-card-front-frame.png). Each source scan is cropped to remove the original title strip and outer scan border, then color-matched into a unified dark jade and antique-gold Art Nouveau Neo N3 card background. The front generator builds an integrated parchment oracle panel with soft rounded masking, warm vintage grading, inner gold rules, subtle node constellations, sun and moon medallions, a refined Neo cube crest, and one consistent collectible deck finish.\n\n` +
      `The card back is original Neo Tarot artwork stored as [neo-tarot-card-back.png](../../scripts/assets/neo-tarot-card-back.png) and exported by the generator as \`back.webp\`: a dark jade illustrated tarot back with antique gold foil, an integrated Neo/N3 cube crest, sun and moon oracle medallions, subtle node constellations woven into ornament, and a collectible deck finish that stays legible in the miniapp's small card slots.\n\n` +
      `Local filenames and source URLs are recorded in [index.json](./index.json). This attribution note is not legal advice.\n`,
    "utf8",
  );

  await rm(OUT_DIR, { recursive: true, force: true });
  await rename(TMP_DIR, OUT_DIR);
  console.log(`Imported and Neo-framed ${deck.length} Rider-Waite-Smith tarot card fronts plus back art`);
}

main().catch(async (error) => {
  await rm(TMP_DIR, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
