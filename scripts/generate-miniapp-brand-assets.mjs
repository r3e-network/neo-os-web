#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const apps = [
  {
    slug: "gas-lucky-pool",
    name: "OneGate Vault",
    subtitle: "Scan, claim, and settle bounded GAS rewards",
    accent: "#16D982",
    secondary: "#F4C84A",
    dark: "#052017",
    pale: "#F2FFF7",
    motif: "vault",
    chips: ["OneGate QR", "1 claim / pool", "Bounded GAS"],
  },
  {
    slug: "asset-factory",
    name: "Asset Factory",
    subtitle: "Launch audited NEP-17 token templates",
    accent: "#14D990",
    secondary: "#2AB8FF",
    dark: "#061927",
    pale: "#F1FFF8",
    motif: "asset",
    chips: ["NEP-17", "On-chain template", "Issuer controls"],
  },
  {
    slug: "nft-factory",
    name: "NFT Factory",
    subtitle: "Create polished NEP-11 collections from templates",
    accent: "#15D98B",
    secondary: "#B76CFF",
    dark: "#101324",
    pale: "#F8F5FF",
    motif: "nft",
    chips: ["NEP-11", "Metadata", "Collection"],
  },
  {
    slug: "miniapp-factory",
    name: "MiniApp Factory",
    subtitle: "Package launch-ready Neo MiniApps",
    accent: "#18D986",
    secondary: "#FF8A50",
    dark: "#101B16",
    pale: "#FFF8F3",
    motif: "miniapp",
    chips: ["Manifest", "OneGate link", "Catalog"],
  },
  {
    slug: "neo-pay-shared-example",
    name: "NeoPay Shared Runtime",
    titleLines: ["NeoPay Shared", "Runtime"],
    subtitle: "Compose reusable payment stream modules",
    accent: "#18D986",
    secondary: "#46A6FF",
    dark: "#071A24",
    pale: "#F2FAFF",
    motif: "pay",
    chips: ["Stream", "Funding vault", "Shared module"],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeAsset(relativePath, content) {
  const target = path.join(repoRoot, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, `${content.trim()}\n`);
  console.log(`[brand-assets] wrote ${relativePath}`);
}

function writeBinary(relativePath, content) {
  const target = path.join(repoRoot, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content);
  console.log(`[brand-assets] wrote ${relativePath}`);
}

function logoMotif(app) {
  switch (app.motif) {
    case "vault":
      return `
        <rect x="142" y="176" width="228" height="184" rx="40" fill="url(#panel)" stroke="#FFFFFF" stroke-opacity=".42" stroke-width="8"/>
        <path d="M186 176v-28c0-48 31-82 70-82s70 34 70 82v28" fill="none" stroke="#EAFDF3" stroke-width="24" stroke-linecap="round"/>
        <circle cx="256" cy="268" r="58" fill="url(#coin)" stroke="#FFF5B8" stroke-width="8"/>
        <path d="M239 287c8 10 21 16 39 16 23 0 39-11 39-29 0-20-20-26-42-31-16-4-24-8-24-17 0-8 8-14 21-14 13 0 23 6 29 17l25-13c-10-20-29-31-54-31-28 0-49 16-49 42 0 23 20 31 43 37 18 5 24 8 24 16 0 7-7 12-20 12-16 0-27-7-34-20l-26 11Z" fill="${app.dark}"/>
        <path d="M122 122h52v52h-52v-52Zm236 0h32v32h-32v-32Zm42 210h52v52h-52v-52Zm-284 226 36-54 36 54h-72Z" fill="#FFFFFF" fill-opacity=".75"/>`;
    case "asset":
      return `
        <rect x="116" y="116" width="280" height="280" rx="52" fill="url(#panel)" stroke="#FFFFFF" stroke-opacity=".42" stroke-width="8"/>
        <rect x="168" y="162" width="176" height="54" rx="16" fill="#FFFFFF"/>
        <rect x="168" y="242" width="74" height="98" rx="18" fill="#FFFFFF" fill-opacity=".9"/>
        <rect x="270" y="242" width="74" height="98" rx="18" fill="#FFFFFF" fill-opacity=".76"/>
        <path d="M150 374h212" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="20" stroke-linecap="round"/>
        <circle cx="374" cy="138" r="40" fill="url(#coin)" stroke="#FFFFFF" stroke-opacity=".72" stroke-width="6"/>
        <path d="M374 114v48M350 138h48" stroke="${app.dark}" stroke-width="12" stroke-linecap="round"/>`;
    case "nft":
      return `
        <rect x="128" y="106" width="256" height="300" rx="44" fill="url(#panel)" stroke="#FFFFFF" stroke-opacity=".44" stroke-width="8"/>
        <path d="M184 174h144v144H184V174Z" fill="#FFFFFF" fill-opacity=".92"/>
        <path d="m256 188 64 54-64 64-64-64 64-54Z" fill="url(#coin)"/>
        <path d="M213 248h86M225 338h62" stroke="#FFFFFF" stroke-opacity=".86" stroke-width="18" stroke-linecap="round"/>
        <circle cx="360" cy="146" r="42" fill="${app.secondary}" fill-opacity=".82"/>
        <path d="M344 146h32M360 130v32" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>`;
    case "miniapp":
      return `
        <rect x="118" y="124" width="116" height="116" rx="30" fill="#FFFFFF" fill-opacity=".9"/>
        <rect x="278" y="124" width="116" height="116" rx="30" fill="url(#coin)"/>
        <rect x="118" y="280" width="116" height="116" rx="30" fill="url(#panel)"/>
        <rect x="278" y="280" width="116" height="116" rx="30" fill="#FFFFFF" fill-opacity=".82"/>
        <path d="M234 182h44M176 240v40M336 240v40M234 338h44" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="16" stroke-linecap="round"/>
        <path d="M160 182h32M176 166v32M320 338h32M336 322v32" stroke="${app.dark}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="256" cy="256" r="34" fill="${app.dark}" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="8"/>`;
    case "pay":
      return `
        <rect x="104" y="142" width="304" height="228" rx="42" fill="url(#panel)" stroke="#FFFFFF" stroke-opacity=".44" stroke-width="8"/>
        <rect x="146" y="196" width="126" height="22" rx="11" fill="#FFFFFF"/>
        <rect x="146" y="248" width="220" height="28" rx="14" fill="#FFFFFF" fill-opacity=".78"/>
        <rect x="146" y="306" width="72" height="28" rx="14" fill="#FFFFFF" fill-opacity=".62"/>
        <circle cx="344" cy="198" r="56" fill="url(#coin)" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="6"/>
        <path d="M318 198h52M344 172v52" stroke="${app.dark}" stroke-width="14" stroke-linecap="round"/>
        <path d="M104 408c70-35 143-35 220 0" stroke="${app.secondary}" stroke-width="18" stroke-linecap="round" fill="none"/>`;
    default:
      return "";
  }
}

function bannerMotif(app) {
  switch (app.motif) {
    case "vault":
      return `
        <g transform="translate(940 98)">
          <rect width="360" height="360" rx="52" fill="#F8FFF9"/>
          <g fill="${app.dark}">
            <rect x="44" y="44" width="80" height="80" rx="14"/>
            <rect x="236" y="44" width="80" height="80" rx="14"/>
            <rect x="44" y="236" width="80" height="80" rx="14"/>
            <rect x="154" y="44" width="42" height="42" rx="9"/>
            <rect x="154" y="118" width="72" height="34" rx="9"/>
            <rect x="236" y="160" width="42" height="72" rx="9"/>
            <rect x="154" y="236" width="42" height="80" rx="9"/>
            <rect x="216" y="256" width="100" height="34" rx="9"/>
            <rect x="44" y="154" width="72" height="42" rx="9"/>
            <rect x="118" y="216" width="42" height="42" rx="9"/>
          </g>
          <circle cx="180" cy="180" r="72" fill="url(#coin)" stroke="#FFF7BF" stroke-width="8"/>
          <text x="137" y="201" fill="${app.dark}" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="900">GAS</text>
        </g>`;
    case "asset":
      return `
        <g transform="translate(786 82)">
          <rect width="416" height="316" rx="44" fill="#F7FFF9"/>
          <rect x="52" y="54" width="174" height="56" rx="18" fill="url(#panel)"/>
          <rect x="52" y="146" width="78" height="112" rx="20" fill="url(#panel)" fill-opacity=".92"/>
          <rect x="158" y="146" width="78" height="112" rx="20" fill="${app.secondary}" fill-opacity=".88"/>
          <path d="M270 154h84M270 198h60M270 242h98" stroke="${app.dark}" stroke-width="18" stroke-linecap="round"/>
          <circle cx="340" cy="82" r="48" fill="url(#coin)"/>
        </g>`;
    case "nft":
      return `
        <g transform="translate(790 54)">
          <rect x="86" y="16" width="250" height="330" rx="42" fill="#FFFFFF" opacity=".86"/>
          <rect x="30" y="72" width="250" height="330" rx="42" fill="#FFFFFF"/>
          <path d="M88 142h134v134H88V142Z" fill="url(#panel)"/>
          <path d="m155 154 58 52-58 58-58-58 58-52Z" fill="url(#coin)"/>
          <path d="M85 322h138M85 356h96" stroke="${app.dark}" stroke-width="18" stroke-linecap="round"/>
          <circle cx="312" cy="110" r="48" fill="${app.secondary}"/>
        </g>`;
    case "miniapp":
      return `
        <g transform="translate(794 80)">
          <rect width="410" height="320" rx="44" fill="#FFFFFF" opacity=".9"/>
          <rect x="52" y="56" width="96" height="96" rx="24" fill="url(#panel)"/>
          <rect x="184" y="56" width="96" height="96" rx="24" fill="url(#coin)"/>
          <rect x="52" y="188" width="96" height="96" rx="24" fill="${app.secondary}"/>
          <rect x="184" y="188" width="96" height="96" rx="24" fill="${app.dark}" fill-opacity=".92"/>
          <path d="M148 104h36M100 152v36M148 236h36M280 104h58M280 236h62" stroke="${app.dark}" stroke-width="14" stroke-linecap="round"/>
          <circle cx="166" cy="170" r="28" fill="${app.dark}"/>
        </g>`;
    case "pay":
      return `
        <g transform="translate(772 96)">
          <rect width="448" height="280" rx="48" fill="#FFFFFF" opacity=".92"/>
          <rect x="52" y="62" width="190" height="26" rx="13" fill="url(#panel)"/>
          <rect x="52" y="126" width="318" height="36" rx="18" fill="${app.dark}" fill-opacity=".12"/>
          <rect x="52" y="198" width="110" height="36" rx="18" fill="${app.secondary}" fill-opacity=".35"/>
          <path d="M212 216c66-58 126-58 182 0" stroke="url(#panel)" stroke-width="18" stroke-linecap="round" fill="none"/>
          <circle cx="354" cy="78" r="56" fill="url(#coin)"/>
        </g>`;
    default:
      return "";
  }
}

function logoSVG(app) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${escapeXML(app.name)} logo">
  <defs>
    <linearGradient id="bg" x1="72" y1="42" x2="448" y2="470" gradientUnits="userSpaceOnUse">
      <stop stop-color="${app.accent}"/>
      <stop offset=".58" stop-color="${app.secondary}"/>
      <stop offset="1" stop-color="${app.dark}"/>
    </linearGradient>
    <linearGradient id="panel" x1="112" y1="90" x2="392" y2="412" gradientUnits="userSpaceOnUse">
      <stop stop-color="${app.pale}"/>
      <stop offset="1" stop-color="${app.accent}"/>
    </linearGradient>
    <linearGradient id="coin" x1="154" y1="140" x2="372" y2="386" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF7C2"/>
      <stop offset=".48" stop-color="${app.secondary}"/>
      <stop offset="1" stop-color="${app.dark}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="${app.dark}"/>
  <rect x="34" y="34" width="444" height="444" rx="86" fill="url(#bg)"/>
  <path d="M76 360c84 62 217 84 327 10 74-50 75-149 9-218C341 78 209 70 136 136 76 191 52 290 76 360Z" fill="${app.dark}" opacity=".22"/>
  <path d="M92 94h112M318 420h104" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="18" stroke-linecap="round"/>
  ${logoMotif(app)}
</svg>`;
}

function chip(x, y, text, app) {
  return `
    <rect x="${x}" y="${y}" width="${Math.max(144, text.length * 13 + 54)}" height="52" rx="16" fill="#FFFFFF" fill-opacity=".12" stroke="#FFFFFF" stroke-opacity=".22"/>
    <text x="${x + 27}" y="${y + 34}" fill="${app.pale}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800">${escapeXML(text)}</text>`;
}

function subtitleLines(text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 38 && lines.length < 2) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = candidate;
    }
  }
  return lines;
}

function titleText(app, baseY, fontSize, lineHeight) {
  const lines = app.titleLines || [app.name];
  return lines
    .map((line, index) => {
      const y = baseY + index * lineHeight;
      return `<text x="164" y="${y}" fill="#F8FFF9" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="900">${escapeXML(line)}</text>`;
    })
    .join("\n  ");
}

function subtitleText(app, baseY) {
  return subtitleLines(app.subtitle)
    .map((line, index) => {
      const y = baseY + index * 38;
      return `<text x="168" y="${y}" fill="${app.pale}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="650" opacity=".88">${escapeXML(line)}</text>`;
    })
    .join("\n  ");
}

function bannerSVG(app) {
  const titleLinesForLayout = app.titleLines || [app.name];
  const titleIsWrapped = titleLinesForLayout.length > 1;
  const titleY = titleIsWrapped ? 214 : 244;
  const titleFontSize = titleIsWrapped ? 58 : 68;
  const titleLineHeight = titleIsWrapped ? 62 : 76;
  const subtitleY = titleIsWrapped ? 334 : 306;
  const chipY = titleIsWrapped ? 424 : 374;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 640" role="img" aria-label="${escapeXML(app.name)} banner">
  <defs>
    <linearGradient id="surface" x1="0" y1="0" x2="1440" y2="640" gradientUnits="userSpaceOnUse">
      <stop stop-color="${app.dark}"/>
      <stop offset=".54" stop-color="#0B2C22"/>
      <stop offset="1" stop-color="${app.pale}"/>
    </linearGradient>
    <linearGradient id="panel" x1="180" y1="96" x2="1040" y2="560" gradientUnits="userSpaceOnUse">
      <stop stop-color="${app.accent}"/>
      <stop offset="1" stop-color="${app.secondary}"/>
    </linearGradient>
    <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#FFF7C2"/>
      <stop offset=".54" stop-color="${app.secondary}"/>
      <stop offset="1" stop-color="${app.dark}"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="640" fill="url(#surface)"/>
  <path d="M0 516c188-62 326-70 488-24 190 54 352 68 540-16 154-68 284-72 412-18v182H0V516Z" fill="${app.dark}" opacity=".62"/>
  <circle cx="1124" cy="16" r="286" fill="${app.secondary}" opacity=".16"/>
  <circle cx="1010" cy="564" r="242" fill="${app.accent}" opacity=".14"/>
  <rect x="104" y="108" width="690" height="416" rx="46" fill="#FFFFFF" fill-opacity=".08" stroke="#FFFFFF" stroke-opacity=".2"/>
  <path d="M104 478c142-44 274-42 396 6 113 44 211 39 294-13v53H104v-46Z" fill="#FFFFFF" opacity=".06"/>
  ${titleText(app, titleY, titleFontSize, titleLineHeight)}
  ${subtitleText(app, subtitleY)}
  ${chip(168, chipY, app.chips[0], app)}
  ${chip(168 + Math.max(144, app.chips[0].length * 13 + 54) + 18, chipY, app.chips[1], app)}
  ${chip(168, chipY + 70, app.chips[2], app)}
  ${bannerMotif(app)}
</svg>`;
}

async function writeOptimizedRasters(app, logo, banner) {
  const base = `platform/host-app/public/miniapp-assets/${app.slug}`;
  const logoImage = sharp(Buffer.from(logo)).resize(512, 512, { fit: "cover" });
  const bannerImage = sharp(Buffer.from(banner)).resize(1440, 640, { fit: "cover" });

  writeBinary(`${base}/logo.jpg`, await logoImage.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer());
  writeBinary(`${base}/logo.webp`, await logoImage.clone().webp({ quality: 84 }).toBuffer());
  writeBinary(`${base}/logo.avif`, await logoImage.clone().avif({ quality: 70, effort: 6 }).toBuffer());
  writeBinary(`${base}/banner.jpg`, await bannerImage.clone().jpeg({ quality: 86, mozjpeg: true }).toBuffer());
  writeBinary(`${base}/banner.webp`, await bannerImage.clone().webp({ quality: 80 }).toBuffer());
  writeBinary(`${base}/banner.avif`, await bannerImage.clone().avif({ quality: 64, effort: 6 }).toBuffer());
}

for (const app of apps) {
  const logo = logoSVG(app);
  const banner = bannerSVG(app);
  const targets = [
    `apps/${app.slug}/public`,
    `platform/host-app/public/miniapp-assets/${app.slug}`,
    `platform/host-app/public/miniapps/${app.slug}`,
  ];

  for (const target of targets) {
    const absolute = path.join(repoRoot, target);
    if (!fs.existsSync(path.dirname(absolute)) && !target.startsWith("apps/")) continue;
    writeAsset(`${target}/logo.svg`, logo);
    writeAsset(`${target}/banner.svg`, banner);
  }
  await writeOptimizedRasters(app, logo, banner);
}
