#!/usr/bin/env node
import fs from "fs";
import path from "path";
import sharp from "sharp";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const inventoryPath = path.join(repoRoot, "docs/reports/miniapp-playarea-functionality-latest.json");
const reportPath = path.join(repoRoot, "docs/reports/miniapp-logo-system-latest.json");
const contactSheetSvgPath = "/tmp/neo-miniapp-logo-system-contact-sheet.svg";
const contactSheetPngPath = "/tmp/neo-miniapp-logo-system-contact-sheet.png";

const references = [
  "https://neo.org/logo",
  "https://neo.org/images/presskit/Neo%20Brand%20Manual%20V1.2.pdf",
  "https://onegate.space/",
  "https://neoline.io/en/",
  "https://chain.link/brand-assets",
];

const officialBrandAssetSlugs = new Set([
  "candidate-vote",
  "council-governance",
  "gas-lucky-pool",
  "gov-merc",
  "secret-vote",
  "voting",
]);

const palettes = {
  tools: ["#00AF92", "#1262E5", "#EAF7FF", "#092A33"],
  utility: ["#00AF92", "#3A69D8", "#EEF8F5", "#17323A"],
  data: ["#1262E5", "#00AF92", "#EEF5FF", "#11284A"],
  governance: ["#00AF92", "#3F4AD8", "#F2F5FF", "#15333B"],
  finance: ["#00AF92", "#1262E5", "#EDFAF6", "#0F303A"],
  defi: ["#1262E5", "#00AF92", "#ECF7FF", "#102C44"],
  social: ["#00AF92", "#D95C35", "#FFF5F0", "#28363C"],
  games: ["#F0B90B", "#00AF92", "#FFF8E7", "#293336"],
  nft: ["#00AF92", "#6250D8", "#F5F2FF", "#1B343B"],
  other: ["#00AF92", "#2F7D73", "#F2F7F6", "#24383F"],
};

const motifBySlug = {
  "aa-account-lab": "account",
  "aa-market-hub": "market",
  "aa-permissions-lab": "key",
  "aa-relay-console": "relay",
  "aa-session-key-lab": "session",
  "asset-factory": "factory",
  "automation-copilot": "bot",
  "breakup-contract": "heart",
  "burn-league": "flame",
  "council-governance": "governance",
  "custom-anchor": "anchor",
  "daily-checkin": "calendar",
  "dev-tipping": "tip",
  "dice-game": "dice",
  "event-ticket-pass": "ticket",
  explorer: "explorer",
  flashloan: "flash",
  fogplay: "coin",
  "forever-album": "album",
  "gas-lucky-pool": "vault",
  "gas-sponsor": "gas",
  gasbox: "box",
  "gov-merc": "governance",
  graveyard: "grave",
  "last-survivor": "timer",
  "memorial-shrine": "shrine",
  "milestone-escrow": "escrow",
  "miniapp-factory": "factory",
  "neo-convert": "convert",
  "neo-multisig": "multisig",
  "neo-ns": "domain",
  "neo-pay": "pay",
  "neo-pay-shared-example": "pay",
  "neo-sign-anything": "sign",
  "neo-swap": "swap",
  "neo-treasury": "treasury",
  "neo-x-bridge": "bridge",
  "neodid-passport": "identity",
  "nft-factory": "nft",
  "on-chain-tarot": "tarot",
  "oracle-compute-lab": "compute",
  "oracle-http-console": "network",
  "oracle-neodid-console": "identity",
  "oracle-price-console": "price",
  "oracle-seal-console": "seal",
  "oracle-vrf-console": "random",
  "private-transfer": "private",
  profitanchor: "anchor",
  "profitanchor-admin": "anchor",
  "quadratic-funding": "funding",
  "recovery-guardian": "guardian",
  "red-envelope": "envelope",
  "self-loan": "loan",
  "soulbound-certificate": "certificate",
  "time-capsule": "capsule",
  "timestamp-proof": "timestamp",
  trustanchor: "anchor",
  "trustanchor-admin": "anchor",
  "unbreakable-vault": "vault",
  "wallet-health": "wallet",
};

const codeBySlug = {
  "aa-account-lab": "AA",
  "aa-market-hub": "AM",
  "aa-permissions-lab": "AP",
  "aa-relay-console": "AR",
  "aa-session-key-lab": "AS",
  "asset-factory": "AF",
  "automation-copilot": "AC",
  "breakup-contract": "BC",
  "burn-league": "BL",
  "council-governance": "CG",
  "custom-anchor": "CA",
  "daily-checkin": "DC",
  "dev-tipping": "DT",
  "dice-game": "DG",
  "event-ticket-pass": "ET",
  explorer: "EX",
  flashloan: "FL",
  fogplay: "FP",
  "forever-album": "FA",
  "gas-lucky-pool": "OG",
  "gas-sponsor": "GS",
  gasbox: "GB",
  "gov-merc": "GM",
  graveyard: "GY",
  "last-survivor": "LS",
  "memorial-shrine": "MS",
  "milestone-escrow": "ME",
  "miniapp-factory": "MF",
  "neo-convert": "NC",
  "neo-multisig": "NM",
  "neo-ns": "N.",
  "neo-pay": "NP",
  "neo-pay-shared-example": "N+",
  "neo-sign-anything": "SA",
  "neo-swap": "NS",
  "neo-treasury": "NT",
  "neo-x-bridge": "NX",
  "neodid-passport": "ID",
  "nft-factory": "NF",
  "on-chain-tarot": "OT",
  "oracle-compute-lab": "OC",
  "oracle-http-console": "OH",
  "oracle-neodid-console": "OI",
  "oracle-price-console": "OP",
  "oracle-seal-console": "OS",
  "oracle-vrf-console": "OV",
  "private-transfer": "PT",
  profitanchor: "PA",
  "profitanchor-admin": "P+",
  "quadratic-funding": "QF",
  "recovery-guardian": "RG",
  "red-envelope": "RE",
  "self-loan": "SL",
  "soulbound-certificate": "SC",
  "time-capsule": "TC",
  "timestamp-proof": "TP",
  trustanchor: "TA",
  "trustanchor-admin": "T+",
  "unbreakable-vault": "UV",
  "wallet-health": "WH",
};

function readInventory() {
  const data = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  return data.rows
    .filter((row) => row?.slug && row?.name)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      category: row.category || "other",
      motif: motifBySlug[row.slug] || inferMotif(row),
    }));
}

function inferMotif(row) {
  const slug = String(row.slug || "");
  if (slug.startsWith("aa-")) return "account";
  if (slug.includes("oracle")) return "network";
  if (slug.includes("anchor")) return "anchor";
  if (slug.includes("factory")) return "factory";
  if (slug.includes("vault")) return "vault";
  if (slug.includes("pay")) return "pay";
  if (slug.includes("swap")) return "swap";
  if (slug.includes("governance") || slug.includes("gov")) return "governance";
  return "spark";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function palette(app) {
  const [primary, secondary, paper, ink] = palettes[app.category] || palettes.other;
  return { primary, secondary, paper, ink };
}

function categoryLabel(category) {
  const labels = {
    tools: "TOOLS",
    utility: "UTILITY",
    data: "DATA",
    governance: "GOVERNANCE",
    finance: "FINANCE",
    defi: "DEFI",
    social: "SOCIAL",
    games: "GAMES",
    nft: "NFT",
  };
  return labels[category] || "MINIAPP";
}

function appCode(app) {
  if (codeBySlug[app.slug]) return codeBySlug[app.slug];
  const words = app.name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "N";
}

function hashSlug(slug) {
  return [...slug].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 7), 0);
}

function brandShape(app, options = {}) {
  const id = options.id || "markClip";
  const fill = options.fill || "url(#bg)";
  const variant = hashSlug(app.slug) % 7;
  const shapes = [
    {
      frame: `<rect x="72" y="82" width="368" height="348" rx="112" fill="${fill}"/>`,
      clip: `<rect x="72" y="82" width="368" height="348" rx="112"/>`,
    },
    {
      frame: `<circle cx="256" cy="256" r="184" fill="${fill}"/>`,
      clip: `<circle cx="256" cy="256" r="184"/>`,
    },
    {
      frame: `<path d="M256 62l164 92v204L256 450 92 358V154L256 62Z" fill="${fill}"/>`,
      clip: `<path d="M256 62l164 92v204L256 450 92 358V154L256 62Z"/>`,
    },
    {
      frame: `<path d="M92 430V232C92 132 164 72 256 72s164 60 164 160v198H92Z" fill="${fill}"/>`,
      clip: `<path d="M92 430V232C92 132 164 72 256 72s164 60 164 160v198H92Z"/>`,
    },
    {
      frame: `<path d="M256 62l170 72v140c0 94-68 156-170 182C154 430 86 368 86 274V134l170-72Z" fill="${fill}"/>`,
      clip: `<path d="M256 62l170 72v140c0 94-68 156-170 182C154 430 86 368 86 274V134l170-72Z"/>`,
    },
    {
      frame: `<path d="M116 142c14-38 54-58 100-58h178c36 0 58 34 42 70l-46 214c-12 38-52 62-94 62H118c-40 0-62-38-42-74l40-214Z" fill="${fill}"/>`,
      clip: `<path d="M116 142c14-38 54-58 100-58h178c36 0 58 34 42 70l-46 214c-12 38-52 62-94 62H118c-40 0-62-38-42-74l40-214Z"/>`,
    },
    {
      frame: `<path d="M116 214c0-74 60-134 134-134h12c74 0 134 60 134 134v146c0 40-32 72-72 72H188c-40 0-72-32-72-72V214Z" fill="${fill}"/>`,
      clip: `<path d="M116 214c0-74 60-134 134-134h12c74 0 134 60 134 134v146c0 40-32 72-72 72H188c-40 0-72-32-72-72V214Z"/>`,
    },
  ];
  const shape = shapes[variant];
  return {
    frame: shape.frame,
    clip: `<clipPath id="${id}">${shape.clip}</clipPath>`,
  };
}

function motifField(motif, p) {
  const a = p.primary;
  const b = p.secondary;
  const paper = "#FFFFFF";
  switch (motif) {
    case "coin":
      return `<circle cx="338" cy="160" r="112" fill="${paper}" opacity=".18"/><circle cx="178" cy="364" r="92" fill="${b}" opacity=".22"/><path d="M102 272c102-66 206-66 308 0-102 72-206 72-308 0Z" fill="${paper}" opacity=".14"/>`;
    case "tarot":
      return `<path d="M160 118h80c20 0 36 16 36 36v218c0 20-16 36-36 36h-80c-20 0-36-16-36-36V154c0-20 16-36 36-36Z" fill="${paper}" opacity=".18" transform="rotate(-10 200 263)"/><path d="M278 112h84c20 0 36 16 36 36v220c0 20-16 36-36 36h-84c-20 0-36-16-36-36V148c0-20 16-36 36-36Z" fill="${paper}" opacity=".22" transform="rotate(9 320 258)"/><path d="M256 160l30 72 72 30-72 30-30 72-30-72-72-30 72-30 30-72Z" fill="${b}" opacity=".64"/>`;
    case "governance":
      return `<path d="M92 230l164-120 164 120H92Z" fill="${paper}" opacity=".18"/><rect x="116" y="254" width="280" height="34" rx="17" fill="${paper}" opacity=".20"/><rect x="146" y="304" width="42" height="116" rx="21" fill="${paper}" opacity=".18"/><rect x="236" y="304" width="42" height="116" rx="21" fill="${paper}" opacity=".22"/><rect x="326" y="304" width="42" height="116" rx="21" fill="${paper}" opacity=".18"/>`;
    case "anchor":
      return `<circle cx="256" cy="166" r="86" fill="${paper}" opacity=".16"/><path d="M236 92h40v278c74-14 118-62 124-144h-72v-56h142v56c0 134-94 218-214 218S42 360 42 226v-56h142v56h-72c6 82 50 130 124 144V92Z" fill="${paper}" opacity=".16"/>`;
    case "vault":
      return `<rect x="86" y="164" width="340" height="236" rx="78" fill="${paper}" opacity=".18"/><circle cx="256" cy="282" r="94" fill="${b}" opacity=".34"/><circle cx="256" cy="282" r="34" fill="${paper}" opacity=".42"/>`;
    case "network":
      return `<circle cx="256" cy="256" r="156" fill="${paper}" opacity=".15"/><path d="M108 256h296M256 108c62 50 92 98 92 148s-30 98-92 148c-62-50-92-98-92-148s30-98 92-148Z" fill="none" stroke="${paper}" stroke-width="34" opacity=".17" stroke-linecap="round"/>`;
    case "price":
      return `<rect x="96" y="118" width="320" height="276" rx="82" fill="${paper}" opacity=".14"/><path d="M130 330l86-94 64 58 108-142 48 38-150 190-64-58-50 56-42-48Z" fill="${paper}" opacity=".34"/>`;
    case "swap":
    case "convert":
    case "bridge":
      return `<path d="M86 196h270l-70-70h92l100 100-100 100h-92l70-70H86v-60Z" fill="${paper}" opacity=".20"/><path d="M426 322H156l70 70h-92L34 292l100-100h92l-70 70h270v60Z" fill="${b}" opacity=".36"/>`;
    case "factory":
      return `<rect x="98" y="98" width="126" height="126" rx="38" fill="${paper}" opacity=".18"/><rect x="288" y="98" width="126" height="126" rx="38" fill="${paper}" opacity=".14"/><rect x="98" y="288" width="126" height="126" rx="38" fill="${paper}" opacity=".14"/><rect x="288" y="288" width="126" height="126" rx="38" fill="${paper}" opacity=".22"/>`;
    case "flame":
    case "gas":
      return `<path d="M256 76c86 100 132 172 132 244 0 86-56 138-132 138s-132-52-132-138c0-72 46-144 132-244Z" fill="${paper}" opacity=".18"/><path d="M210 320c22 44 70 62 114 24 36-32 16-84-18-124 4 48-46 70-96 100Z" fill="${b}" opacity=".38"/>`;
    case "heart":
      return `<path d="M256 412S92 322 92 200c0-70 46-116 108-116 28 0 48 10 64 30 16-20 36-30 64-30 62 0 108 46 108 116 0 122-164 212-164 212h-16Z" fill="${paper}" opacity=".18"/>`;
    case "dice":
    case "random":
      return `<rect x="92" y="92" width="328" height="328" rx="88" fill="${paper}" opacity=".16"/><circle cx="184" cy="184" r="28" fill="${paper}" opacity=".35"/><circle cx="328" cy="184" r="28" fill="${paper}" opacity=".30"/><circle cx="256" cy="256" r="28" fill="${b}" opacity=".55"/><circle cx="184" cy="328" r="28" fill="${paper}" opacity=".30"/><circle cx="328" cy="328" r="28" fill="${paper}" opacity=".35"/>`;
    case "wallet":
    case "pay":
      return `<rect x="86" y="166" width="340" height="208" rx="76" fill="${paper}" opacity=".18"/><rect x="306" y="224" width="112" height="92" rx="46" fill="${b}" opacity=".38"/><circle cx="354" cy="270" r="18" fill="${paper}" opacity=".65"/>`;
    case "identity":
    case "certificate":
      return `<rect x="98" y="112" width="316" height="288" rx="82" fill="${paper}" opacity=".16"/><circle cx="200" cy="220" r="54" fill="${paper}" opacity=".30"/><path d="M122 354c18-70 64-106 136-106s118 36 136 106H122Z" fill="${paper}" opacity=".18"/>`;
    case "envelope":
      return `<rect x="72" y="156" width="368" height="248" rx="84" fill="${paper}" opacity=".18"/><path d="M72 202l184 130 184-130v76L256 408 72 278v-76Z" fill="${paper}" opacity=".22"/>`;
    case "capsule":
      return `<path d="M144 330l186-186c44-44 112-44 156 0s44 112 0 156L300 486c-44 44-112 44-156 0s-44-112 0-156Z" fill="${paper}" opacity=".17" transform="translate(-58 -58)"/>`;
    case "timestamp":
    case "timer":
      return `<circle cx="256" cy="256" r="154" fill="${paper}" opacity=".17"/><path d="M256 116v144l96 70" fill="none" stroke="${paper}" stroke-width="42" opacity=".22" stroke-linecap="round"/>`;
    default:
      return `<circle cx="360" cy="132" r="120" fill="${paper}" opacity=".15"/><circle cx="146" cy="378" r="142" fill="${b}" opacity=".18"/><path d="M90 274c110-78 222-78 332 0-110 84-222 84-332 0Z" fill="${paper}" opacity=".13"/>`;
  }
}

function wordmarkSvg(app, x, y, options = {}) {
  const p = palette(app);
  const code = appCode(app);
  const size = options.size || (code.length > 2 ? 132 : 156);
  const letterSpacing = code.length > 2 ? -8 : -10;
  const shadow = options.shadow ? `filter="url(#letterShadow)"` : "";
  return `<text x="${x}" y="${y}" text-anchor="middle" ${shadow} fill="#FFFFFF" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${size}" font-weight="900" letter-spacing="${letterSpacing}">${esc(code)}</text>
  <path d="M${x - 72} ${y + 34}c42 22 102 22 144 0" fill="none" stroke="${p.secondary}" stroke-width="16" stroke-linecap="round" opacity=".9"/>`;
}

function logoSvg(app) {
  const p = palette(app);
  const title = `${app.name} logo`;
  const shape = brandShape(app);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="bg" x1="42" y1="28" x2="456" y2="478" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.primary}"/>
      <stop offset=".58" stop-color="${p.secondary}"/>
      <stop offset="1" stop-color="${p.ink}"/>
    </linearGradient>
    <radialGradient id="wash" cx="34%" cy="22%" r="76%">
      <stop stop-color="#FFFFFF" stop-opacity=".34"/>
      <stop offset=".64" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="outerShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="${p.ink}" flood-opacity=".16"/>
    </filter>
    <filter id="letterShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="${p.ink}" flood-opacity=".22"/>
    </filter>
    ${shape.clip}
  </defs>
  <rect width="512" height="512" fill="${p.paper}"/>
  <circle cx="406" cy="98" r="104" fill="#FFFFFF" opacity=".5"/>
  <circle cx="112" cy="426" r="140" fill="${p.primary}" opacity=".08"/>
  <g filter="url(#outerShadow)">
    <g clip-path="url(#markClip)">
      ${shape.frame}
      <rect x="48" y="48" width="416" height="416" fill="url(#wash)"/>
      ${motifField(app.motif, p)}
    </g>
    ${wordmarkSvg(app, 256, 300, { shadow: true })}
  </g>
</svg>`;
}

function bannerSvg(app) {
  const p = palette(app);
  const label = categoryLabel(app.category);
  const code = appCode(app);
  const wordSize = code.length > 2 ? 126 : 148;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 640" role="img" aria-label="${esc(app.name)} banner">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1440" y2="640" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.paper}"/>
      <stop offset=".58" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="${p.paper}"/>
    </linearGradient>
    <linearGradient id="bg" x1="42" y1="28" x2="456" y2="478" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.primary}"/>
      <stop offset=".58" stop-color="${p.secondary}"/>
      <stop offset="1" stop-color="${p.ink}"/>
    </linearGradient>
    <radialGradient id="wash" cx="34%" cy="22%" r="76%">
      <stop stop-color="#FFFFFF" stop-opacity=".34"/>
      <stop offset=".64" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="outerShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="${p.ink}" flood-opacity=".16"/>
    </filter>
    <filter id="letterShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="${p.ink}" flood-opacity=".22"/>
    </filter>
  </defs>
  <rect width="1440" height="640" fill="url(#page)"/>
  <circle cx="1256" cy="88" r="178" fill="${p.primary}" opacity=".07"/>
  <circle cx="116" cy="560" r="210" fill="${p.secondary}" opacity=".06"/>
  <g transform="translate(104 116)">
    <text x="0" y="34" fill="${p.primary}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="850" letter-spacing="4">${esc(label)}</text>
    <text x="0" y="134" fill="${p.ink}" font-family="Inter, Arial, sans-serif" font-size="78" font-weight="900">${esc(app.name)}</text>
    <text x="2" y="194" fill="${p.ink}" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="650" opacity=".68">Neo MiniApp</text>
    <g transform="translate(0 268)">
      <rect x="0" y="0" width="176" height="52" rx="26" fill="${p.primary}" opacity=".14"/>
      <text x="32" y="34" fill="${p.ink}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850">ONEGATE</text>
      <rect x="198" y="0" width="148" height="52" rx="26" fill="${p.secondary}" opacity=".12"/>
      <text x="234" y="34" fill="${p.ink}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850">NEP-21</text>
      <rect x="368" y="0" width="154" height="52" rx="26" fill="#FFFFFF" stroke="${p.primary}" stroke-opacity=".22" stroke-width="2"/>
      <text x="406" y="34" fill="${p.ink}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850">TESTNET</text>
    </g>
  </g>
  <g transform="translate(842 76)" filter="url(#outerShadow)">
    <rect x="0" y="0" width="420" height="420" rx="128" fill="url(#bg)"/>
    <rect x="0" y="0" width="420" height="420" rx="128" fill="url(#wash)"/>
    <g transform="translate(-46 -46)">
      ${motifField(app.motif, p)}
    </g>
    <text x="210" y="250" text-anchor="middle" filter="url(#letterShadow)" fill="#FFFFFF" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${wordSize}" font-weight="900" letter-spacing="-10">${esc(code)}</text>
    <path d="M138 286c42 22 102 22 144 0" fill="none" stroke="${p.secondary}" stroke-width="16" stroke-linecap="round" opacity=".9"/>
  </g>
</svg>`;
}

async function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

async function writeRasters(basePath, logo, banner, options = {}) {
  const { includePng = false, modern = true } = options;
  const logoImage = sharp(Buffer.from(logo)).resize(512, 512, { fit: "cover" });
  const bannerImage = sharp(Buffer.from(banner)).resize(1440, 640, { fit: "cover" });
  fs.writeFileSync(`${basePath}/logo.jpg`, await logoImage.clone().jpeg({ quality: 92, mozjpeg: true }).toBuffer());
  if (modern) {
    fs.writeFileSync(`${basePath}/logo.webp`, await logoImage.clone().webp({ quality: 90 }).toBuffer());
    fs.writeFileSync(`${basePath}/logo.avif`, await logoImage.clone().avif({ quality: 74, effort: 2 }).toBuffer());
  }
  if (includePng) {
    fs.writeFileSync(`${basePath}/logo.png`, await logoImage.clone().png({ compressionLevel: 9 }).toBuffer());
  }
  fs.writeFileSync(`${basePath}/banner.jpg`, await bannerImage.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer());
  if (modern) {
    fs.writeFileSync(`${basePath}/banner.webp`, await bannerImage.clone().webp({ quality: 86 }).toBuffer());
    fs.writeFileSync(`${basePath}/banner.avif`, await bannerImage.clone().avif({ quality: 70, effort: 2 }).toBuffer());
  }
}

async function writeAssetSet(app, logo, banner) {
  if (officialBrandAssetSlugs.has(app.slug)) return;

  const targets = [
    {
      path: path.join(repoRoot, "platform/host-app/public/miniapps", app.slug),
      modern: true,
    },
    {
      path: path.join(repoRoot, "platform/host-app/public/miniapp-assets", app.slug),
      modern: true,
    },
    {
      path: path.join(repoRoot, "apps", app.slug, "public"),
      modern: true,
    },
  ];
  const includePng = app.slug === "gas-lucky-pool";
  for (const target of targets) {
    ensureDir(target.path);
    await writeText(path.join(target.path, "logo.svg"), logo);
    await writeText(path.join(target.path, "banner.svg"), banner);
    await writeRasters(target.path, logo, banner, {
      includePng,
      modern: target.modern,
    });
  }
}

async function buildContactSheet(apps) {
  const cols = 6;
  const cellW = 300;
  const cellH = 246;
  const width = cols * cellW;
  const rows = Math.ceil(apps.length / cols);
  const height = rows * cellH + 70;
  const images = [];

  for (const app of apps) {
    const officialSvg = path.join(repoRoot, "platform/host-app/public/miniapps", app.slug, "logo.svg");
    const source = officialBrandAssetSlugs.has(app.slug) && fs.existsSync(officialSvg)
      ? officialSvg
      : Buffer.from(logoSvg(app));
    const png = await sharp(source).resize(116, 116, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    }).png().toBuffer();
    images.push(`data:image/png;base64,${png.toString("base64")}`);
  }

  const cells = apps
    .map((app, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * cellW;
      const y = 70 + row * cellH;
      return `<g transform="translate(${x} ${y})">
        <rect x="18" y="12" width="264" height="210" rx="30" fill="#FFFFFF" stroke="#DCE8EA"/>
        <image href="${images[index]}" x="92" y="26" width="116" height="116"/>
        <text x="150" y="176" text-anchor="middle" fill="#17252D" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850">${esc(app.name)}</text>
        <text x="150" y="202" text-anchor="middle" fill="#65747A" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700">${esc(app.slug)}</text>
      </g>`;
    })
    .join("\n");

  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#F5FAF8"/>
    <text x="42" y="44" fill="#17252D" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="900">Neo MiniApp Logo System - monogram brand set</text>
    ${cells}
  </svg>`;
  fs.writeFileSync(contactSheetSvgPath, sheet);
  fs.writeFileSync(contactSheetPngPath, await sharp(Buffer.from(sheet)).png().toBuffer());
}

async function main() {
  const apps = readInventory();
  const generatedAt = new Date().toISOString();
  const rows = [];

  for (const app of apps) {
    const logo = logoSvg(app);
    const banner = bannerSvg(app);
    await writeAssetSet(app, logo, banner);
    rows.push({
      slug: app.slug,
      name: app.name,
      category: app.category,
      motif: app.motif,
      code: appCode(app),
      logo: `/miniapps/${app.slug}/logo.jpg`,
      banner: `/miniapps/${app.slug}/banner.jpg`,
      svg: `/miniapps/${app.slug}/logo.svg`,
      officialBrandAsset: officialBrandAssetSlugs.has(app.slug) || undefined,
    });
  }

  await buildContactSheet(apps);
  const report = {
    generatedAt,
    total: rows.length,
    style: {
      principles: [
        "brand-first monograms, not generic outline icons",
        "business metaphors are abstract texture fields, not literal small pictograms",
        "light Neo ecosystem surfaces and saturated app-icon marks instead of large black blocks",
        "Neo green and Chainlink blue are anchors; category accents are restrained",
        "each app has a short readable code for 32px recognition",
        "SVG source plus JPG/WebP/AVIF runtime assets",
      ],
      references,
    },
    contactSheet: {
      svg: contactSheetSvgPath,
      png: contactSheetPngPath,
    },
    rows,
  };
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Generated ${rows.length} miniapp logo systems.`);
  console.log(`Contact sheet: ${contactSheetPngPath}`);
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
