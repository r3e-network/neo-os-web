#!/usr/bin/env node
/*
 * Quadratic Funding matching calculator (off-chain helper).
 *
 * Usage:
 *   node scripts/quadratic-funding-matching.js --input data.json --decimals 8
 *
 * Input JSON shape:
 * {
 *   "matchingPool": "250", // optional, in asset units
 *   "projects": [
 *     { "projectId": 1, "contributions": { "N...": "10", "N...": "2.5" } }
 *   ]
 * }
 */

const fs = require("fs");

function parseArgs(argv) {
  const args = { input: "", decimals: 8 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
    } else if (token === "--decimals") {
      args.decimals = Number.parseInt(argv[i + 1] || "8", 10);
      i += 1;
    }
  }
  return args;
}

function toFixedDecimals(value, decimals) {
  if (!Number.isFinite(decimals) || decimals < 0) return "0";
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("-")) return "0";
  const parts = raw.split(".");
  if (parts.length > 2) return "0";
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) return "0";
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${padded}`.replace(/^0+/, "") || "0";
  return combined;
}

function fromFixedDecimals(value, decimals) {
  const raw = String(value ?? "0");
  if (decimals <= 0) return raw;
  const negative = raw.startsWith("-");
  const cleaned = negative ? raw.slice(1) : raw;
  const padded = cleaned.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const result = frac ? `${whole}.${frac}` : whole;
  return negative ? `-${result}` : result;
}

function sqrtBigInt(value) {
  if (value < 0n) throw new Error("sqrt of negative");
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

function toBigInt(value) {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function computeMatching(input, decimals) {
  const projects = Array.isArray(input.projects) ? input.projects : [];
  const matchingPoolRaw = toBigInt(toFixedDecimals(input.matchingPool || "0", decimals));

  const results = projects.map((project) => {
    const contributions = project.contributions && typeof project.contributions === "object" ? project.contributions : {};
    let total = 0n;
    let sumSqrt = 0n;

    Object.values(contributions).forEach((amount) => {
      const raw = toBigInt(toFixedDecimals(amount, decimals));
      if (raw <= 0n) return;
      total += raw;
      sumSqrt += sqrtBigInt(raw);
    });

    const matchRaw = sumSqrt * sumSqrt - total;
    return {
      projectId: Number.parseInt(String(project.projectId || 0), 10),
      totalRaw: total,
      matchRaw: matchRaw > 0n ? matchRaw : 0n,
    };
  });

  const totalMatchRaw = results.reduce((acc, item) => acc + item.matchRaw, 0n);
  const pool = matchingPoolRaw;

  const scaled = results.map((item) => {
    if (pool === 0n || totalMatchRaw === 0n) {
      return { ...item, scaledMatchRaw: 0n };
    }
    const scaled = item.matchRaw * pool / totalMatchRaw;
    return { ...item, scaledMatchRaw: scaled };
  });

  return {
    decimals,
    matchingPoolRaw: pool.toString(),
    totalMatchRaw: totalMatchRaw.toString(),
    projectIds: scaled.map((item) => item.projectId).filter((id) => Number.isFinite(id) && id > 0),
    matchedAmountsRaw: scaled.map((item) => item.scaledMatchRaw.toString()),
    projects: scaled.map((item) => ({
      projectId: item.projectId,
      totalRaw: item.totalRaw.toString(),
      matchRaw: item.matchRaw.toString(),
      scaledMatchRaw: item.scaledMatchRaw.toString(),
      scaledMatch: fromFixedDecimals(item.scaledMatchRaw.toString(), decimals),
    })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Usage: node scripts/quadratic-funding-matching.js --input data.json --decimals 8");
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(args.input, "utf-8"));
  const decimals = Number.isFinite(args.decimals) ? args.decimals : 8;
  const result = computeMatching(payload, decimals);
  console.log(JSON.stringify(result, null, 2));
}

main();
