import sharp from "/Users/jinghuiliao/git/r3e/neo-miniapps-platform/node_modules/sharp/lib/index.js";

// Prize wheel for the lucky pool.
// The real reward is a RANDOM 0-50 GAS drawn by the backend (see messages.ts
// "random 1-50 GAS"). So the wheel communicates the 0-50 RANGE, not three
// escalating jackpot numbers. Sectors show representative tier ceilings
// (all <= 50), and the hub states the true range "0-50".

const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 244;
const INNER_R = 60;

const SECTORS = [
  { label: "10", sub: "GAS", fill: "#1dd48e", dark: "#0c9c66" }, // low tier — jade
  { label: "25", sub: "GAS", fill: "#f6b73c", dark: "#d68910" }, // mid tier — amber
  { label: "50", sub: "GAS", fill: "#38bdf8", dark: "#0c7fb8" }, // top tier — cyan
];

const N = SECTORS.length;
const angleStep = (Math.PI * 2) / N;
const startAngle = -Math.PI / 2 - angleStep / 2;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`;

// defs
svg += `<defs>`;
svg += `<radialGradient id="rimGrad" cx="50%" cy="40%" r="60%">
  <stop offset="0%" stop-color="#ffe9a8"/>
  <stop offset="55%" stop-color="#daa520"/>
  <stop offset="100%" stop-color="#9c7415"/>
</radialGradient>`;
svg += `<radialGradient id="innerShadow" cx="50%" cy="45%" r="55%">
  <stop offset="0%" stop-color="#000" stop-opacity="0.28"/>
  <stop offset="100%" stop-color="#000" stop-opacity="0"/>
</radialGradient>`;
svg += `<radialGradient id="hub" cx="38%" cy="32%" r="65%">
  <stop offset="0%" stop-color="#fff8dc"/>
  <stop offset="55%" stop-color="#16c784"/>
  <stop offset="100%" stop-color="#0c9c66"/>
</radialGradient>`;
svg += `<filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
  <feGaussianBlur stdDeviation="2.5" result="b"/>
  <feComposite in="SourceGraphic" in2="b" operator="over"/>
</filter>`;
SECTORS.forEach((s, i) => {
  const mid = startAngle + i * angleStep + angleStep / 2;
  const gx = 50 + 32 * Math.cos(mid);
  const gy = 50 + 32 * Math.sin(mid);
  svg += `<radialGradient id="sec${i}" cx="${gx}%" cy="${gy}%" r="68%">
    <stop offset="0%" stop-color="${s.fill}"/>
    <stop offset="78%" stop-color="${s.dark}"/>
    <stop offset="100%" stop-color="${s.dark}" stop-opacity="0.92"/>
  </radialGradient>`;
});
svg += `</defs>`;

// base disc
svg += `<circle cx="${CX}" cy="${CY}" r="${OUTER_R + 4}" fill="#10241c" />`;

// sectors
for (let i = 0; i < N; i++) {
  const a1 = startAngle + i * angleStep;
  const a2 = a1 + angleStep;
  const large = angleStep > Math.PI ? 1 : 0;
  const x1 = CX + OUTER_R * Math.cos(a1);
  const y1 = CY + OUTER_R * Math.sin(a1);
  const x2 = CX + OUTER_R * Math.cos(a2);
  const y2 = CY + OUTER_R * Math.sin(a2);
  svg += `<path d="M ${CX},${CY} L ${x1},${y1} A ${OUTER_R},${OUTER_R} 0 ${large},1 ${x2},${y2} Z" fill="url(#sec${i})" stroke="#fff8dc" stroke-width="2" opacity="0.97"/>`;
}

// inner shadow + rim
svg += `<circle cx="${CX}" cy="${CY}" r="${OUTER_R - 2}" fill="url(#innerShadow)"/>`;
svg += `<circle cx="${CX}" cy="${CY}" r="${OUTER_R}" fill="none" stroke="url(#rimGrad)" stroke-width="12"/>`;
svg += `<circle cx="${CX}" cy="${CY}" r="${OUTER_R + 5}" fill="none" stroke="#9c7415" stroke-width="2" opacity="0.5"/>`;
svg += `<circle cx="${CX}" cy="${CY}" r="${OUTER_R - 8}" fill="none" stroke="#ffe9a8" stroke-width="1" opacity="0.4"/>`;

// sector labels (number + GAS) — readable at small display size
for (let i = 0; i < N; i++) {
  const mid = startAngle + i * angleStep + angleStep / 2;
  const lx = CX + (OUTER_R - 64) * Math.cos(mid);
  const ly = CY + (OUTER_R - 64) * Math.sin(mid);
  const deg = (mid * 180) / Math.PI + 90;
  svg += `<text x="${lx}" y="${ly - 4}" text-anchor="middle" transform="rotate(${deg} ${lx} ${ly})" font-family="Georgia, serif" font-size="46" font-weight="bold" fill="#fff" stroke="#5c4a0f" stroke-width="1" paint-order="stroke">${SECTORS[i].label}</text>`;
  svg += `<text x="${lx}" y="${ly + 22}" text-anchor="middle" transform="rotate(${deg} ${lx} ${ly})" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="#fff8dc" letter-spacing="1">GAS</text>`;
}

// hub — shows the TRUE reward range (random 0-50 GAS), not a fixed jackpot
svg += `<circle cx="${CX}" cy="${CY}" r="${INNER_R + 6}" fill="url(#hub)" stroke="#0c9c66" stroke-width="2"/>`;
svg += `<circle cx="${CX}" cy="${CY}" r="${INNER_R}" fill="#16c784" stroke="#fff8dc" stroke-width="1.5" opacity="0.92"/>`;
svg += `<text x="${CX}" y="${CY - 6}" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#063b27" letter-spacing="1">0-50</text>`;
svg += `<text x="${CX}" y="${CY + 18}" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-weight="bold" fill="#063b27" letter-spacing="2">GAS</text>`;

// top pointer
const ptrY = 14;
svg += `<polygon points="${CX},${ptrY - 2} ${CX - 14},${ptrY + 20} ${CX + 14},${ptrY + 20}" fill="url(#rimGrad)" stroke="#9c7415" stroke-width="1.5"/>`;
svg += `<polygon points="${CX},${ptrY + 4} ${CX - 8},${ptrY + 17} ${CX + 8},${ptrY + 17}" fill="#fff8dc" opacity="0.75"/>`;

svg += `</svg>`;

sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .webp({ quality: 95, alphaQuality: 98 })
  .toFile("/Users/jinghuiliao/git/r3e/neo-miniapps-platform/apps/gas-lucky-pool/public/wheel.webp")
  .then(() => console.log("OK: wheel.webp regenerated with prize labels"))
  .catch((e) => console.error("FAIL:", e));
