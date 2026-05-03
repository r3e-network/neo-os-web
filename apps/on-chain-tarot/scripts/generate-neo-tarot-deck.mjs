import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/cards");
const CARD_WIDTH = 744;
const CARD_HEIGHT = 1040;

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
  {
    id: "wands",
    title: "Wands",
    baseId: 22,
    mark: "W",
    accent: "#ffb454",
    accent2: "#ff6b35",
    keyword: "Will",
  },
  {
    id: "cups",
    title: "Cups",
    baseId: 36,
    mark: "C",
    accent: "#4fd8ff",
    accent2: "#5f7cff",
    keyword: "Feeling",
  },
  {
    id: "swords",
    title: "Swords",
    baseId: 50,
    mark: "S",
    accent: "#d6efff",
    accent2: "#00d9ff",
    keyword: "Mind",
  },
  {
    id: "pentacles",
    title: "Pentacles",
    baseId: 64,
    mark: "P",
    accent: "#9cff6a",
    accent2: "#00e599",
    keyword: "Matter",
  },
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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
    slug: `${String(id).padStart(2, "0")}-${slugify(name)}`,
  }));

  const minor = SUITS.flatMap((suit) =>
    RANKS.map(([rank, roman, rankKeyword], index) => {
      const id = suit.baseId + index;
      const name = `${rank} of ${suit.title}`;
      return {
        id,
        name,
        suit: suit.id,
        number: index + 1,
        roman,
        keyword: `${rankKeyword} ${suit.keyword}`,
        meaning: suit.keyword,
        slug: `${String(id).padStart(2, "0")}-${slugify(name)}`,
      };
    }),
  );

  return [...major, ...minor];
}

function suitTheme(card) {
  if (card.suit === "major") {
    return {
      accent: "#00e599",
      accent2: "#00d9ff",
      accent3: "#9d7cff",
      label: "Major Arcana",
      mark: "N",
    };
  }
  const suit = SUITS.find((item) => item.id === card.suit);
  return {
    accent: suit.accent,
    accent2: suit.accent2,
    accent3: "#00e599",
    label: suit.title,
    mark: suit.mark,
  };
}

function defs(theme, id) {
  return `
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="744" y2="1040" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07111c"/>
      <stop offset="0.42" stop-color="#0b1f2d"/>
      <stop offset="1" stop-color="#110b22"/>
    </linearGradient>
    <radialGradient id="aura-${id}" cx="50%" cy="38%" r="58%">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.28"/>
      <stop offset="0.42" stop-color="${theme.accent2}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#02070c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="line-${id}" x1="96" y1="92" x2="648" y2="948" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${theme.accent}"/>
      <stop offset="0.55" stop-color="${theme.accent2}"/>
      <stop offset="1" stop-color="${theme.accent3}"/>
    </linearGradient>
    <filter id="glow-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0 0 0 0 0 0.9 0 0 0 0 0.65 0 0 0 .72 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="grid-${id}" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${theme.accent2}" stroke-opacity="0.08" stroke-width="1"/>
      <circle cx="0" cy="0" r="2" fill="${theme.accent}" fill-opacity="0.15"/>
    </pattern>
  </defs>`;
}

function neoShield(x, y, scale = 1, opacity = 1) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    <path d="M0 12L42 0l42 12v48c0 31-20 52-42 64C20 112 0 91 0 60V12Z" fill="url(#neo-shield-fill)" stroke="#00e599" stroke-opacity="0.82" stroke-width="2"/>
    <path d="M42 18l23 8v31c0 16-9 29-23 38-14-9-23-22-23-38V26l23-8Z" fill="#07111c" stroke="#00d9ff" stroke-opacity="0.38" stroke-width="2"/>
    <path d="M30 76V35l24 47V41" fill="none" stroke="#00e599" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function cardFrame(theme, id) {
  return `
  <rect x="24" y="24" width="696" height="992" rx="44" fill="url(#bg-${id})"/>
  <rect x="24" y="24" width="696" height="992" rx="44" fill="url(#aura-${id})"/>
  <rect x="58" y="58" width="628" height="924" rx="32" fill="none" stroke="url(#line-${id})" stroke-width="4"/>
  <rect x="78" y="78" width="588" height="884" rx="24" fill="url(#grid-${id})" opacity="0.72"/>
  <path d="M132 130H280M464 130h148M132 910h148M464 910h148" stroke="url(#line-${id})" stroke-width="3" stroke-linecap="round"/>
  <circle cx="372" cy="520" r="286" fill="none" stroke="${theme.accent2}" stroke-opacity="0.11" stroke-width="2"/>
  <circle cx="372" cy="520" r="210" fill="none" stroke="${theme.accent}" stroke-opacity="0.13" stroke-width="2"/>
  <circle cx="372" cy="520" r="128" fill="none" stroke="${theme.accent2}" stroke-opacity="0.12" stroke-width="2"/>
  <linearGradient id="neo-shield-fill" x1="0" y1="0" x2="84" y2="124" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#00e599"/>
    <stop offset="1" stop-color="#00a66a"/>
  </linearGradient>`;
}

function cornerLabels(card, theme) {
  const rank = escapeXml(card.roman);
  return `
  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#f7fbff">
    <text x="112" y="128" font-size="34" font-weight="800" letter-spacing="0">${rank}</text>
    <text x="632" y="930" font-size="34" font-weight="800" text-anchor="end" letter-spacing="0">${rank}</text>
    <text x="372" y="124" font-size="19" font-weight="800" text-anchor="middle" fill="${theme.accent}" letter-spacing="4">NEO TAROT</text>
    <text x="372" y="904" font-size="17" font-weight="700" text-anchor="middle" fill="#98a9b8" letter-spacing="2">${escapeXml(theme.label.toUpperCase())}</text>
  </g>`;
}

function orbitNodes(theme) {
  const points = [
    [372, 232],
    [552, 338],
    [552, 702],
    [372, 808],
    [192, 702],
    [192, 338],
  ];
  return `
  <g filter="url(#glow-card)" opacity="0.95">
    ${points
      .map(
        ([x, y], index) => `
    <circle cx="${x}" cy="${y}" r="${index % 2 ? 7 : 9}" fill="${index % 2 ? theme.accent2 : theme.accent}"/>
    <path d="M${x} ${y}L372 520" stroke="${index % 2 ? theme.accent2 : theme.accent}" stroke-opacity="0.26" stroke-width="2"/>`,
      )
      .join("")}
  </g>`;
}

function majorGlyph(card, theme) {
  const glyphs = [
    `<path d="M332 392c42-58 124-30 118 42-5 60-70 72-103 29-26-34-9-82 35-85" fill="none" stroke="${theme.accent}" stroke-width="14" stroke-linecap="round"/><path d="M293 653c88-20 158-78 206-166" stroke="${theme.accent2}" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M268 424h208M372 320v400M304 664h136" stroke="${theme.accent}" stroke-width="14" stroke-linecap="round"/><circle cx="372" cy="320" r="38" fill="none" stroke="${theme.accent2}" stroke-width="10"/>`,
    `<path d="M288 680c46-72 122-72 168 0M300 392c32-48 112-48 144 0" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M312 412v186M432 412v186" stroke="${theme.accent2}" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M372 318c94 88 126 164 0 294-126-130-94-206 0-294Z" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M272 654c64-32 136-32 200 0" stroke="${theme.accent2}" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M286 666V388h172v278M260 666h224" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M316 434h112v86H316z" fill="none" stroke="${theme.accent2}" stroke-width="10"/>`,
    `<path d="M260 670h224M296 670V438l76-84 76 84v232" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M326 476h92M326 540h92" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M278 430c52-86 146-28 94 52-52-80 42-138 94-52 40 66-36 150-94 202-58-52-134-136-94-202Z" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M372 314v346" stroke="${theme.accent2}" stroke-width="8" stroke-linecap="round" stroke-opacity="0.7"/>`,
    `<path d="M254 646h236l-30-164H284l-30 164Z" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linejoin="round"/><path d="M312 482l60-122 60 122M304 682h136" stroke="${theme.accent2}" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M282 524c58-90 122-90 180 0-58 90-122 90-180 0Z" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M320 620c34 46 70 46 104 0M330 428c28-38 56-38 84 0" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M372 332v328M302 492h140M278 660h188" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><circle cx="372" cy="300" r="42" fill="none" stroke="${theme.accent2}" stroke-width="10"/>`,
    `<circle cx="372" cy="520" r="152" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M372 368v304M220 520h304M264 412l216 216M480 412L264 628" stroke="${theme.accent2}" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M252 436h240M284 436l88-84 88 84M372 436v220M300 656h144" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M276 502l-54 102h108l-54-102ZM468 502l-54 102h108l-54-102Z" fill="none" stroke="${theme.accent2}" stroke-width="8"/>`,
    `<path d="M372 332v252M312 430h120M288 584h168" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M342 668c52 28 86-2 70-56" fill="none" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M286 642c88-82 142-174 172-292M308 350c52 18 100 18 144 0M280 678h184" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M290 450c86 16 136 58 150 126" fill="none" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M278 434c74-78 114 80 188 0M278 606c74-78 114 80 188 0" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M372 336v336" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M278 658c16-116 172-116 188 0M312 476c28-64 92-64 120 0M266 534h212" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M318 408l54-76 54 76" fill="none" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M292 688V352h160v336M252 688h240" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M320 352l104 336M424 352L320 688" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M252 596l74-54 46-142 46 142 74 54-92 4-28 92-28-92-92-4Z" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linejoin="round"/><circle cx="372" cy="364" r="34" fill="none" stroke="${theme.accent2}" stroke-width="10"/>`,
    `<path d="M236 580c76-126 196-126 272 0" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M270 636c66-64 138-64 204 0M330 400c42-58 102-58 144 0" fill="none" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<circle cx="372" cy="492" r="106" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M252 664h240M372 286v96M372 602v96M266 492h96M382 492h96" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M256 634c72-108 160-108 232 0M296 436c26-58 126-58 152 0M372 326v304" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M302 514h140" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>`,
    `<circle cx="372" cy="520" r="152" fill="none" stroke="${theme.accent}" stroke-width="12"/><path d="M260 520h224M372 408v224" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/><path d="M306 416c44 40 88 40 132 0M306 624c44-40 88-40 132 0" fill="none" stroke="${theme.accent}" stroke-width="10" stroke-linecap="round"/>`,
  ];

  return `<g class="major-glyph" filter="url(#glow-card)">${glyphs[card.id] ?? glyphs[0]}</g>`;
}

function pipShape(suit, theme, x, y, size = 1, rotate = 0) {
  const transform = `translate(${x} ${y}) rotate(${rotate}) scale(${size})`;
  if (suit === "wands") {
    return `<g transform="${transform}"><path d="M-8 72L18-72" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><path d="M-2 28c44-10 68-36 74-76M2-4c-42 4-66-16-78-56" fill="none" stroke="${theme.accent2}" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (suit === "cups") {
    return `<g transform="${transform}"><path d="M-54-40c0 76 24 112 54 112S54 36 54-40H-54Z" fill="none" stroke="${theme.accent}" stroke-width="10" stroke-linejoin="round"/><path d="M-30 80h60M0 72v52M-50 124h100" stroke="${theme.accent2}" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (suit === "swords") {
    return `<g transform="${transform}"><path d="M0-92V78" stroke="${theme.accent}" stroke-width="10" stroke-linecap="round"/><path d="M-42 8h84M-18 78h36M0-112l26 28H-26L0-112Z" fill="none" stroke="${theme.accent2}" stroke-width="8" stroke-linejoin="round"/></g>`;
  }
  return `<g transform="${transform}"><path d="M0-80l76 55-29 89h-94l-29-89L0-80Z" fill="none" stroke="${theme.accent}" stroke-width="10" stroke-linejoin="round"/><circle cx="0" cy="0" r="44" fill="none" stroke="${theme.accent2}" stroke-width="8"/><path d="M0-80V64M-68-24h136M-42 58L42-58M42 58L-42-58" stroke="${theme.accent}" stroke-opacity="0.48" stroke-width="6" stroke-linecap="round"/></g>`;
}

function pipPositions(count) {
  const layouts = {
    1: [[372, 520, 1.35, 0]],
    2: [[372, 392, 1, 0], [372, 648, 1, 180]],
    3: [[372, 348, 0.92, 0], [372, 520, 0.98, 0], [372, 692, 0.92, 180]],
    4: [[292, 384, 0.88, 0], [452, 384, 0.88, 0], [292, 656, 0.88, 180], [452, 656, 0.88, 180]],
    5: [[292, 372, 0.8, 0], [452, 372, 0.8, 0], [372, 520, 0.92, 0], [292, 668, 0.8, 180], [452, 668, 0.8, 180]],
    6: [[292, 342, 0.75, 0], [452, 342, 0.75, 0], [292, 520, 0.75, 0], [452, 520, 0.75, 0], [292, 698, 0.75, 180], [452, 698, 0.75, 180]],
    7: [[292, 336, 0.7, 0], [452, 336, 0.7, 0], [372, 432, 0.72, 0], [292, 540, 0.7, 0], [452, 540, 0.7, 0], [292, 704, 0.7, 180], [452, 704, 0.7, 180]],
    8: [[292, 322, 0.66, 0], [452, 322, 0.66, 0], [292, 454, 0.66, 0], [452, 454, 0.66, 0], [292, 586, 0.66, 180], [452, 586, 0.66, 180], [292, 718, 0.66, 180], [452, 718, 0.66, 180]],
    9: [[292, 316, 0.62, 0], [452, 316, 0.62, 0], [372, 392, 0.62, 0], [292, 482, 0.62, 0], [452, 482, 0.62, 0], [372, 560, 0.62, 180], [292, 724, 0.62, 180], [452, 724, 0.62, 180], [372, 650, 0.62, 180]],
    10: [[282, 310, 0.58, 0], [462, 310, 0.58, 0], [282, 430, 0.58, 0], [462, 430, 0.58, 0], [372, 492, 0.6, 0], [372, 548, 0.6, 180], [282, 610, 0.58, 180], [462, 610, 0.58, 180], [282, 730, 0.58, 180], [462, 730, 0.58, 180]],
  };
  return layouts[count] ?? layouts[1];
}

function minorGlyph(card, theme) {
  if (card.number <= 10) {
    return `<g filter="url(#glow-card)">${pipPositions(card.number).map(([x, y, size, rotate]) => pipShape(card.suit, theme, x, y, size, rotate)).join("")}</g>`;
  }

  const rank = card.roman;
  const suitMark = theme.mark;
  return `
  <g filter="url(#glow-card)">
    <path d="M276 672c20-136 172-136 192 0" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/>
    <path d="M304 426c24-88 112-112 136 0 18 84-28 142-68 172-40-30-86-88-68-172Z" fill="none" stroke="${theme.accent2}" stroke-width="12" stroke-linejoin="round"/>
    <circle cx="372" cy="520" r="116" fill="none" stroke="${theme.accent}" stroke-width="8" stroke-opacity="0.65"/>
    <text x="372" y="536" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui" font-size="78" font-weight="900" fill="#f7fbff" letter-spacing="0">${escapeXml(rank)}</text>
    <text x="372" y="610" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui" font-size="34" font-weight="800" fill="${theme.accent}" letter-spacing="4">${escapeXml(suitMark)}</text>
  </g>
  <g opacity="0.78">
    ${pipShape(card.suit, theme, 210, 458, 0.46, -16)}
    ${pipShape(card.suit, theme, 534, 458, 0.46, 16)}
  </g>`;
}

function titleBlock(card, theme) {
  const name = escapeXml(card.name);
  const keyword = escapeXml(card.keyword);
  const meaning = escapeXml(card.meaning);
  const titleSize = card.name.length > 18 ? 28 : card.name.length > 14 ? 32 : 38;
  return `
  <g font-family="Georgia, Times New Roman, serif">
    <path d="M126 792h492l38 42-38 42H126l-38-42 38-42Z" fill="#070b10" fill-opacity="0.91" stroke="url(#gold-line)" stroke-width="3"/>
    <path d="M150 808h444M150 860h444" stroke="${theme.accent}" stroke-opacity="0.18" stroke-width="2"/>
    <text x="372" y="846" text-anchor="middle" font-size="${titleSize}" font-weight="800" fill="#f8e2a4" letter-spacing="3">${name.toUpperCase()}</text>
  </g>
  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    <text x="372" y="912" text-anchor="middle" font-size="15" font-weight="900" fill="${theme.accent}" letter-spacing="4">${keyword.toUpperCase()}</text>
    <text x="372" y="944" text-anchor="middle" font-size="12" font-weight="800" fill="#8fa4b3" letter-spacing="3">${meaning.toUpperCase()} ON NEO</text>
  </g>`;
}

function premiumDefs(theme, id) {
  return `
  <defs>
    <linearGradient id="card-bg-${id}" x1="0" y1="0" x2="744" y2="1040" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#02070c"/>
      <stop offset="0.42" stop-color="#0a1b23"/>
      <stop offset="1" stop-color="#090713"/>
    </linearGradient>
    <linearGradient id="scene-sky-${id}" x1="0" y1="130" x2="0" y2="790" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#e9d79f"/>
      <stop offset="0.14" stop-color="${theme.accent2}"/>
      <stop offset="0.45" stop-color="#123443"/>
      <stop offset="1" stop-color="#071018"/>
    </linearGradient>
    <radialGradient id="scene-aura-${id}" cx="50%" cy="33%" r="62%">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.54"/>
      <stop offset="0.36" stop-color="${theme.accent2}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#03070c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orb-${id}" cx="50%" cy="35%" r="58%">
      <stop offset="0" stop-color="#fff8ce"/>
      <stop offset="0.35" stop-color="${theme.accent}"/>
      <stop offset="1" stop-color="${theme.accent2}" stop-opacity="0.26"/>
    </radialGradient>
    <linearGradient id="gold-line" x1="68" y1="68" x2="676" y2="968" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff0b9"/>
      <stop offset="0.28" stop-color="#c8953f"/>
      <stop offset="0.54" stop-color="#fff4bf"/>
      <stop offset="0.78" stop-color="#a87327"/>
      <stop offset="1" stop-color="#f9da83"/>
    </linearGradient>
    <linearGradient id="foil-${id}" x1="130" y1="140" x2="610" y2="780" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.92"/>
      <stop offset="0.42" stop-color="${theme.accent2}" stop-opacity="0.94"/>
      <stop offset="1" stop-color="#f4c76b" stop-opacity="0.86"/>
    </linearGradient>
    <filter id="soft-glow-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0 0 0 0 0 0.9 0 0 0 0 0.68 0 0 0 .68 0"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="paper-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${cardSeed(id)}" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer>
      <feBlend mode="soft-light" in2="SourceGraphic"/>
    </filter>
    <clipPath id="scene-clip-${id}">
      <rect x="88" y="126" width="568" height="640" rx="28"/>
    </clipPath>
  </defs>`;
}

function cardSeed(id) {
  return (Number(String(id).replace(/\D/g, "")) || 1) + 17;
}

function premiumFrame(card, theme, id) {
  const rank = escapeXml(card.roman);
  return `
  <rect width="744" height="1040" rx="54" fill="#010307"/>
  <rect x="18" y="18" width="708" height="1004" rx="46" fill="url(#card-bg-${id})"/>
  <rect x="18" y="18" width="708" height="1004" rx="46" fill="url(#scene-aura-${id})" opacity="0.28"/>
  <rect x="44" y="44" width="656" height="952" rx="36" fill="none" stroke="url(#gold-line)" stroke-width="4"/>
  <rect x="62" y="62" width="620" height="916" rx="28" fill="none" stroke="${theme.accent}" stroke-opacity="0.36" stroke-width="2"/>
  <path d="M110 92h166l22 22h148l22-22h166M110 948h166l22-22h148l22 22h166" stroke="url(#gold-line)" stroke-width="2.6" fill="none"/>
  <path d="M91 156V87h70M653 156V87h-70M91 884v69h70M653 884v69h-70" stroke="url(#gold-line)" stroke-width="3" fill="none"/>
  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    <text x="112" y="118" font-size="30" font-weight="900" fill="#f8e2a4" letter-spacing="0">${rank}</text>
    <text x="632" y="924" font-size="30" font-weight="900" text-anchor="end" fill="#f8e2a4" letter-spacing="0">${rank}</text>
    <text x="372" y="96" font-size="22" font-weight="900" text-anchor="middle" fill="#f8e2a4" letter-spacing="7">NEO TAROT</text>
  </g>
  <circle cx="110" cy="110" r="12" fill="${theme.accent}" opacity="0.72"/>
  <circle cx="634" cy="110" r="12" fill="${theme.accent2}" opacity="0.72"/>
  <circle cx="110" cy="930" r="12" fill="${theme.accent2}" opacity="0.72"/>
  <circle cx="634" cy="930" r="12" fill="${theme.accent}" opacity="0.72"/>
  <linearGradient id="neo-shield-fill" x1="0" y1="0" x2="84" y2="124" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#00e599"/>
    <stop offset="1" stop-color="#00a66a"/>
  </linearGradient>
  ${neoShield(330, 108, 1, 0.95)}`;
}

function stars(theme, seed = 0) {
  const nodes = Array.from({ length: 20 }, (_, index) => {
    const x = 116 + ((index * 97 + seed * 31) % 500);
    const y = 164 + ((index * 53 + seed * 29) % 430);
    const r = index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 2;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${index % 2 ? theme.accent2 : "#fff7cf"}" opacity="${index % 4 === 0 ? 0.88 : 0.54}"/>`;
  }).join("");
  const lines = Array.from({ length: 10 }, (_, index) => {
    const x1 = 116 + ((index * 97 + seed * 31) % 500);
    const y1 = 164 + ((index * 53 + seed * 29) % 430);
    const x2 = 116 + (((index + 3) * 97 + seed * 31) % 500);
    const y2 = 164 + (((index + 3) * 53 + seed * 29) % 430);
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${theme.accent2}" stroke-opacity="0.18" stroke-width="1.4"/>`;
  }).join("");
  return `<g>${lines}${nodes}</g>`;
}

function skyline(theme, variant = 0) {
  const towers = Array.from({ length: 12 }, (_, index) => {
    const x = 92 + index * 48;
    const h = 74 + ((index * 31 + variant * 19) % 142);
    const y = 742 - h;
    return `<path d="M${x} 742V${y}h${24 + (index % 3) * 8}v${h}Z" fill="#041018" opacity="0.76" stroke="${theme.accent2}" stroke-opacity="0.24"/><path d="M${x + 6} ${y + 20}h20M${x + 6} ${y + 46}h20" stroke="${theme.accent}" stroke-opacity="0.32"/>`;
  }).join("");
  return `<g>${towers}<path d="M88 742h568" stroke="${theme.accent}" stroke-opacity="0.24" stroke-width="3"/></g>`;
}

function landscape(theme, variant = 0) {
  return `
  <path d="M88 710c74-92 132-104 212-34 74-90 132-120 220-18 42-42 82-44 136 12v96H88Z" fill="#06151c" opacity="0.88"/>
  <path d="M88 688c86-82 142-88 216-28 80-104 158-126 252-18 34-28 62-34 100-8" fill="none" stroke="${theme.accent2}" stroke-opacity="0.34" stroke-width="3"/>
  <path d="M88 764c132-62 252-72 360-30 74 28 142 28 208-10" fill="none" stroke="${theme.accent}" stroke-opacity="0.34" stroke-width="4"/>
  <path d="M118 768c128-38 240-34 336 12 66 30 124 28 172-4" fill="none" stroke="#f8e2a4" stroke-opacity="0.16" stroke-width="2"/>
  <circle cx="${510 - variant * 7}" cy="${246 + (variant % 5) * 18}" r="${48 + (variant % 3) * 12}" fill="${theme.accent}" opacity="0.16"/>`;
}

function robedFigure(theme, x, y, scale = 1, opts = {}) {
  const crown = opts.crown ? `<path d="M-34-112l18-32 16 28 22-36 18 36 16-28 18 32" fill="none" stroke="#f8e2a4" stroke-width="6" stroke-linejoin="round"/>` : "";
  const staff = opts.staff ? `<path d="M70-42v180" stroke="url(#gold-line)" stroke-width="8" stroke-linecap="round"/><circle cx="70" cy="-58" r="18" fill="${theme.accent}" opacity="0.86"/>` : "";
  const sword = opts.sword ? `<path d="M66-74V110M36 0h60M66-108l22 30H44l22-30Z" fill="none" stroke="${theme.accent2}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  const cup = opts.cup ? `<path d="M48-24c0 44 14 66 42 66s42-22 42-66H48ZM70 50h40M90 42v40M52 84h76" fill="none" stroke="${theme.accent2}" stroke-width="6" stroke-linecap="round"/>` : "";
  return `
  <g transform="translate(${x} ${y}) scale(${scale})" filter="url(#soft-glow-${opts.seed ?? "card-0"})">
    <path d="M-72 174c18-130 28-208 72-250 44 42 54 120 72 250Z" fill="#07131c" stroke="url(#gold-line)" stroke-width="4"/>
    <path d="M-42 166c10-82 18-146 42-194 24 48 32 112 42 194Z" fill="${theme.accent}" opacity="0.2"/>
    <circle cx="0" cy="-96" r="42" fill="#0d2027" stroke="#f8e2a4" stroke-width="5"/>
    <path d="M-62-10c-56 30-84 72-104 128M62-10c56 30 84 72 104 128" fill="none" stroke="${theme.accent2}" stroke-width="10" stroke-linecap="round"/>
    ${crown}${staff}${sword}${cup}
  </g>`;
}

function drone(theme, x, y, scale = 1) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <circle cx="0" cy="0" r="30" fill="#07131c" stroke="${theme.accent2}" stroke-width="5"/>
    <circle cx="-8" cy="-4" r="4" fill="${theme.accent}"/><circle cx="8" cy="-4" r="4" fill="${theme.accent}"/>
    <path d="M-50 0h-34M50 0h34M0-50v-34M0 50v34" stroke="url(#gold-line)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="-92" cy="0" r="11" fill="${theme.accent}"/><circle cx="92" cy="0" r="11" fill="${theme.accent2}"/>
    <circle cx="0" cy="-92" r="11" fill="${theme.accent}"/><circle cx="0" cy="92" r="11" fill="${theme.accent2}"/>
  </g>`;
}

function suitPip(suit, theme, x, y, scale = 1, opacity = 1) {
  return `<g opacity="${opacity}">${pipShape(suit, theme, x, y, scale, 0)}</g>`;
}

function majorCommercialScene(card, theme, id) {
  const sceneId = card.id;
  const common = `${stars(theme, sceneId)}${landscape(theme, sceneId)}${skyline(theme, sceneId)}`;
  const figure = (opts = {}) => robedFigure(theme, 372, 560, 1.08, { ...opts, seed: id });
  const symbols = [
    `${figure({})}${drone(theme, 520, 310, 0.8)}<path d="M220 742l108-86 104 86" fill="none" stroke="url(#gold-line)" stroke-width="8"/>`,
    `${figure({ staff: true })}<rect x="238" y="628" width="268" height="54" rx="18" fill="#070b10" stroke="url(#gold-line)" stroke-width="4"/>${suitPip("wands", theme, 286, 632, 0.34)}${suitPip("cups", theme, 348, 632, 0.3)}${suitPip("swords", theme, 416, 632, 0.3)}${suitPip("pentacles", theme, 482, 632, 0.28)}`,
    `<path d="M214 728V266h70v462M460 728V266h70v462" fill="#07131c" stroke="url(#gold-line)" stroke-width="5"/>${figure({})}<path d="M268 312h208M278 682h188" stroke="${theme.accent2}" stroke-width="5"/>`,
    `${figure({ crown: true, cup: true })}<path d="M170 712c80-90 316-90 404 0" fill="none" stroke="${theme.accent}" stroke-width="12" stroke-linecap="round"/><circle cx="232" cy="630" r="22" fill="${theme.accent}" opacity="0.62"/><circle cx="510" cy="630" r="22" fill="${theme.accent2}" opacity="0.62"/>`,
    `${figure({ crown: true, sword: true })}<path d="M214 714V424h316v290M248 424l124-102 124 102" fill="none" stroke="url(#gold-line)" stroke-width="8"/>`,
    `${figure({ staff: true })}<path d="M224 708h296M270 708V432l102-106 102 106v276" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M312 510h120M312 580h120" stroke="${theme.accent2}" stroke-width="6"/>`,
    `${robedFigure(theme, 304, 576, 0.82, { seed: id })}${robedFigure(theme, 440, 576, 0.82, { seed: id })}<path d="M220 430c84-92 220-92 304 0" fill="none" stroke="${theme.accent}" stroke-width="10"/><path d="M372 286v410" stroke="url(#gold-line)" stroke-width="5"/>`,
    `<path d="M190 670h364l-46-188H236l-46 188Z" fill="#07131c" stroke="url(#gold-line)" stroke-width="7"/><path d="M298 482l74-142 74 142" stroke="${theme.accent2}" stroke-width="8" fill="none"/>${drone(theme, 260, 604, 0.6)}${drone(theme, 484, 604, 0.6)}`,
    `${figure({})}<path d="M226 548c92-128 200-128 292 0-92 128-200 128-292 0Z" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M292 660c54 50 106 50 160 0" stroke="${theme.accent2}" stroke-width="8" fill="none"/>`,
    `${figure({ staff: true })}<circle cx="372" cy="276" r="58" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M372 334v360M288 508h168" stroke="${theme.accent2}" stroke-width="6"/>`,
    `<circle cx="372" cy="510" r="174" fill="#07131c" fill-opacity="0.54" stroke="url(#gold-line)" stroke-width="8"/><path d="M372 336v348M198 510h348M248 386l248 248M496 386L248 634" stroke="${theme.accent2}" stroke-width="5"/>${drone(theme, 372, 510, 0.72)}`,
    `${figure({ sword: true })}<path d="M226 486l-70 126h140l-70-126ZM518 486l-70 126h140l-70-126Z" fill="none" stroke="url(#gold-line)" stroke-width="6"/><path d="M224 460h296" stroke="${theme.accent2}" stroke-width="7"/>`,
    `<path d="M372 280v330M292 390h160M254 612h236" stroke="url(#gold-line)" stroke-width="9" stroke-linecap="round"/><circle cx="372" cy="716" r="42" fill="${theme.accent}" opacity="0.44"/>`,
    `${figure({})}<path d="M224 698c122-92 212-216 270-382" stroke="url(#gold-line)" stroke-width="8" fill="none"/><path d="M250 342c84 42 166 42 246 0M252 470c112 0 192 52 238 156" stroke="${theme.accent2}" stroke-width="7" fill="none"/>`,
    `${figure({ cup: true })}<path d="M220 428c104-92 200 92 304 0M220 610c104-92 200 92 304 0" stroke="${theme.accent2}" stroke-width="8" fill="none"/><path d="M372 320v388" stroke="url(#gold-line)" stroke-width="6"/>`,
    `${figure({})}<path d="M220 702c42-150 262-150 304 0M282 444c42-88 138-88 180 0" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M316 382l56-82 56 82" fill="none" stroke="${theme.accent2}" stroke-width="8"/>`,
    `<path d="M280 718V270h184v448M228 718h288" fill="#07131c" stroke="url(#gold-line)" stroke-width="8"/><path d="M306 292l130 402M438 292L306 694" stroke="${theme.accent2}" stroke-width="7"/>${drone(theme, 372, 502, 0.58)}`,
    `${figure({})}<path d="M234 560l88-66 50-170 50 170 88 66-108 8-30 108-30-108-108-8Z" fill="none" stroke="url(#gold-line)" stroke-width="8"/><circle cx="372" cy="300" r="40" fill="${theme.accent}" opacity="0.5"/>`,
    `<path d="M160 592c128-154 296-154 424 0" fill="none" stroke="url(#gold-line)" stroke-width="9"/><path d="M214 662c108-78 208-78 316 0M294 386c62-72 154-72 216 0" fill="none" stroke="${theme.accent2}" stroke-width="7"/>${drone(theme, 372, 480, 0.62)}`,
    `<circle cx="372" cy="486" r="122" fill="url(#orb-${id})" opacity="0.62"/><path d="M202 704h340M372 286v126M372 594v126M238 486h100M406 486h100" stroke="url(#gold-line)" stroke-width="8"/>`,
    `${figure({ staff: true })}<path d="M210 660c110-130 214-130 324 0M292 414c40-76 120-76 160 0" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M292 526h160" stroke="${theme.accent2}" stroke-width="8"/>`,
    `<circle cx="372" cy="514" r="170" fill="none" stroke="url(#gold-line)" stroke-width="8"/><path d="M206 514h332M372 348v332" stroke="${theme.accent2}" stroke-width="7"/><path d="M286 392c58 46 114 46 172 0M286 636c58-46 114-46 172 0" fill="none" stroke="${theme.accent}" stroke-width="8"/>${drone(theme, 372, 514, 0.58)}`,
  ];
  return `${common}${symbols[sceneId] ?? symbols[0]}`;
}

function minorCommercialScene(card, theme, id) {
  const count = Math.min(card.number, 10);
  const base = `${stars(theme, card.id)}${landscape(theme, card.id)}${skyline(theme, card.id)}`;
  if (card.number > 10) {
    const rankOpts = {
      11: { staff: card.suit === "wands", cup: card.suit === "cups", sword: card.suit === "swords" },
      12: { staff: card.suit === "wands", sword: card.suit === "swords" },
      13: { crown: true, cup: card.suit === "cups" },
      14: { crown: true, staff: card.suit === "wands", sword: card.suit === "swords" },
    }[card.number] ?? {};
    return `${base}${robedFigure(theme, 372, 560, 1.08, { ...rankOpts, seed: id })}${suitPip(card.suit, theme, 222, 560, 0.46, 0.74)}${suitPip(card.suit, theme, 522, 560, 0.46, 0.74)}`;
  }
  return `${base}<g filter="url(#soft-glow-${id})">${pipPositions(count).map(([x, y, size, rotate]) => pipShape(card.suit, theme, x, y, size * 0.86, rotate)).join("")}</g>`;
}

function commercialScene(card, theme, id) {
  return `
  <g clip-path="url(#scene-clip-${id})" filter="url(#paper-${id})">
    <rect x="88" y="126" width="568" height="640" rx="28" fill="url(#scene-sky-${id})"/>
    <rect x="88" y="126" width="568" height="640" rx="28" fill="url(#scene-aura-${id})"/>
    <path d="M88 126h568v640H88Z" fill="#000" opacity="0.08"/>
    ${card.suit === "major" ? majorCommercialScene(card, theme, id) : minorCommercialScene(card, theme, id)}
  </g>
  <rect x="88" y="126" width="568" height="640" rx="28" fill="none" stroke="url(#gold-line)" stroke-width="4"/>
  <rect x="104" y="142" width="536" height="608" rx="20" fill="none" stroke="${theme.accent}" stroke-opacity="0.28" stroke-width="2"/>`;
}

function cardSvg(card) {
  const theme = suitTheme(card);
  const id = `card-${card.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(card.name)} - Neo Tarot</title>
  <desc id="desc">A premium Neo styled tarot card for ${escapeXml(card.name)}.</desc>
  ${premiumDefs(theme, id)}
  ${premiumFrame(card, theme, id)}
  ${commercialScene(card, theme, id)}
  ${titleBlock(card, theme)}
  <text x="372" y="976" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui" font-size="11" font-weight="900" fill="#5a7485" letter-spacing="5">ORACLE VERIFIED READING</text>
</svg>
`;
}

function backSvg() {
  const theme = { accent: "#00e599", accent2: "#00d9ff", accent3: "#9d7cff", label: "Neo Tarot" };
  const id = "card-back";
  const card = { id: 78, roman: "N", name: "Neo Tarot", suit: "major" };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="title desc">
  <title id="title">Neo Tarot Card Back</title>
  <desc id="desc">Premium Neo Tarot card back with a black gold frame, Neo shield, oracle orbit, and circuit stars.</desc>
  ${premiumDefs(theme, id)}
  ${premiumFrame(card, theme, id)}
  <g clip-path="url(#scene-clip-${id})" filter="url(#paper-${id})">
    <rect x="88" y="126" width="568" height="640" rx="28" fill="url(#scene-sky-${id})"/>
    <rect x="88" y="126" width="568" height="640" rx="28" fill="url(#scene-aura-${id})"/>
    ${stars(theme, 78)}
    ${landscape(theme, 4)}
    ${skyline(theme, 9)}
    <g filter="url(#soft-glow-${id})">
      <circle cx="372" cy="480" r="214" fill="#02080d" fill-opacity="0.4" stroke="url(#gold-line)" stroke-width="8"/>
      <circle cx="372" cy="480" r="154" fill="none" stroke="${theme.accent2}" stroke-opacity="0.5" stroke-width="5"/>
      <circle cx="372" cy="480" r="96" fill="url(#orb-${id})" opacity="0.28"/>
      <path d="M372 238v484M130 480h484M200 308l344 344M544 308 200 652" stroke="${theme.accent2}" stroke-width="3" stroke-opacity="0.22"/>
      <path d="M218 480c96-136 212-136 308 0-96 136-212 136-308 0Z" fill="none" stroke="${theme.accent}" stroke-width="5" stroke-opacity="0.64"/>
      ${neoShield(256, 338, 2.78, 1)}
      ${drone(theme, 372, 228, 0.58)}
      ${drone(theme, 184, 480, 0.5)}
      ${drone(theme, 560, 480, 0.5)}
    </g>
  </g>
  <rect x="88" y="126" width="568" height="640" rx="28" fill="none" stroke="url(#gold-line)" stroke-width="4"/>
  <rect x="104" y="142" width="536" height="608" rx="20" fill="none" stroke="${theme.accent}" stroke-opacity="0.28" stroke-width="2"/>
  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">
    <text x="372" y="852" text-anchor="middle" font-size="30" font-weight="900" fill="#f8e2a4" letter-spacing="7">NEO TAROT</text>
    <text x="372" y="896" text-anchor="middle" font-size="15" font-weight="900" fill="${theme.accent}" letter-spacing="5">ORACLE VERIFIED DECK</text>
    <text x="372" y="938" text-anchor="middle" font-size="12" font-weight="800" fill="#8fa4b3" letter-spacing="3">78 COMMERCIAL ARCANA CARDS</text>
  </g>
</svg>
`;
}

async function main() {
  const deck = buildDeck();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  await writeFile(path.join(OUT_DIR, "back.svg"), backSvg(), "utf8");

  const index = [];
  for (const card of deck) {
    const filename = `${card.slug}.svg`;
    await writeFile(path.join(OUT_DIR, filename), cardSvg(card), "utf8");
    index.push({
      id: card.id,
      name: card.name,
      suit: card.suit,
      number: card.number,
      keyword: card.keyword,
      meaning: card.meaning,
      image: `./cards/${filename}`,
    });
  }

  await writeFile(path.join(OUT_DIR, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Generated ${deck.length} Neo Tarot cards in ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
