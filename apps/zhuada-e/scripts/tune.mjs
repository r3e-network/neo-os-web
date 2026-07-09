/**
 * tune.mjs — Monte-Carlo balance simulation for Catch the Goose (B-class).
 *
 * Mirrors the PURE rules in src/logic/engine-zhuada.ts + game-rules.ts (no
 * Three.js / physics here — we validate the LOGICAL solvability + difficulty
 * of the tray-matching mechanic under two play policies:
 *
 *   - greedyBest : a thinking player who always completes/advances a tray
 *                  triple when possible. Models the intended skilled play.
 *   - random     : a careless player who taps any item. Models worst-case.
 *
 * Output: per level → completion rate (both policies), avg picks, jam rate,
 * and a RECOMMENDED time budget (derived from greedy picks with a human
 * buffer). Used to retune LEVEL_CURVE + timeMs in game-rules.ts.
 *
 * Run: node scripts/tune.mjs
 */

const TRAY_SLOTS = 7;

// ── Pure rules (mirror of engine-zhuada.ts) ──────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateItems(spec, rng) {
  const pool = [];
  let id = 0;
  for (let k = 0; k < spec.kinds; k += 1) {
    const count = spec.perKind * 3;
    for (let i = 0; i < count; i += 1) pool.push({ id: id++, kind: k });
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool;
}

function applyExtract(slots, kind) {
  const next = slots.slice();
  const emptyIdx = next.indexOf(null);
  if (emptyIdx === -1) return { slots: next, matched: false };
  next[emptyIdx] = kind;
  const same = next.map((v, i) => (v === kind ? i : -1)).filter((i) => i !== -1);
  if (same.length >= 3) {
    for (const i of same.slice(0, 3)) next[i] = null;
    return { slots: next, matched: true };
  }
  return { slots: next, matched: false };
}

function isTrayStuck(slots) {
  if (!slots.every((s) => s !== null)) return false;
  const counts = new Map();
  for (const s of slots) if (s !== null) counts.set(s, (counts.get(s) ?? 0) + 1);
  for (const c of counts.values()) if (c >= 3) return false;
  return true;
}

// ── Play policies ─────────────────────────────────────────────────────────────
function counts(arr) {
  const m = new Map();
  for (const v of arr) if (v !== null) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function greedyPick(box, tray) {
  const trayC = counts(tray);
  const boxC = counts(box);
  // 1) complete a triple
  for (const [k, c] of trayC) if (c === 2 && (boxC.get(k) ?? 0) >= 1) return k;
  // 2) advance a pair
  for (const [k, c] of trayC) if (c === 1 && (boxC.get(k) ?? 0) >= 2) return k;
  // 3) progress the most abundant kind still in the box
  let best = -1;
  let bestC = 0;
  for (const [k, c] of boxC) if (c > bestC) { bestC = c; best = k; }
  return best;
}

function randomPick(box, rng) {
  return box[Math.floor(rng() * box.length)].kind;
}

function simulate(spec, policy, rng) {
  const box = generateItems(spec, rng).map((it) => it.kind);
  let tray = Array(TRAY_SLOTS).fill(null);
  let picks = 0;
  while (box.length > 0) {
    const kind = policy === "greedy" ? greedyPick(box, tray) : randomPick(box, rng);
    if (kind < 0) break;
    const res = applyExtract(tray, kind);
    tray = res.slots;
    const idx = box.indexOf(kind);
    box.splice(idx, 1);
    picks += 1;
    if (isTrayStuck(tray)) return { win: false, picks };
  }
  return { win: box.length === 0, picks };
}

// ── Candidate curve (kinds, perKind, boxSize) for 15 levels ───────────────────
const CURVE = [
  { kinds: 3, perKind: 2, boxSize: 9 },
  { kinds: 3, perKind: 2, boxSize: 9 },
  { kinds: 4, perKind: 2, boxSize: 9 },
  { kinds: 4, perKind: 3, boxSize: 10 },
  { kinds: 5, perKind: 3, boxSize: 10 },
  { kinds: 5, perKind: 3, boxSize: 10 },
  { kinds: 6, perKind: 3, boxSize: 11 },
  { kinds: 6, perKind: 3, boxSize: 11 },
  { kinds: 7, perKind: 4, boxSize: 12 },
  { kinds: 8, perKind: 4, boxSize: 12 },
  { kinds: 9, perKind: 4, boxSize: 12 },
  { kinds: 10, perKind: 4, boxSize: 12 },
  { kinds: 11, perKind: 4, boxSize: 12 },
  { kinds: 12, perKind: 4, boxSize: 12 },
  { kinds: 12, perKind: 4, boxSize: 12 },
];

const TRIALS = 4000;
const SEC_PER_PICK = 1.5; // human tap + think
const BUFFER_SEC = 12;

const rows = [];
let allGreedyWin = true;
for (let i = 0; i < CURVE.length; i += 1) {
  const spec = CURVE[i];
  const total = spec.kinds * spec.perKind * 3;
  let gWin = 0;
  let gPicks = 0;
  let rWin = 0;
  for (let t = 0; t < TRIALS; t += 1) {
    const rngG = makeRng((i + 1) * 100003 + t * 7 + 1);
    const g = simulate(spec, "greedy", rngG);
    if (g.win) gWin += 1;
    gPicks += g.picks;
    const rngR = makeRng((i + 1) * 911 + t * 13 + 3);
    const r = simulate(spec, "random", rngR);
    if (r.win) rWin += 1;
  }
  const gRate = gWin / TRIALS;
  const rRate = rWin / TRIALS;
  const avgPicks = gPicks / TRIALS;
  const recSec = Math.round((avgPicks * SEC_PER_PICK + BUFFER_SEC) / 5) * 5;
  if (gRate < 0.999) allGreedyWin = false;
  rows.push({
    level: i + 1,
    kinds: spec.kinds,
    perKind: spec.perKind,
    total,
    gRate,
    rRate,
    avgPicks: Math.round(avgPicks),
    recSec,
  });
}

console.log("level | kinds | perKind | items | greedyWin | randomWin | avgPicks | recTime(s)");
console.log("------+-------+---------+-------+-----------+-----------+----------+-----------");
for (const r of rows) {
  console.log(
    `${String(r.level).padStart(5)} | ${String(r.kinds).padStart(5)} | ${String(r.perKind).padStart(7)} | ${String(r.total).padStart(5)} | ${String(Math.round(r.gRate * 100)).padStart(9)}% | ${String(Math.round(r.rRate * 100)).padStart(9)}% | ${String(r.avgPicks).padStart(8)} | ${String(r.recSec).padStart(10)}`,
  );
}
console.log("\nALL_GREEDY_WIN:", allGreedyWin, "(logical solvability: every level completable by a thinking player)");

// Emit a ready-to-paste LEVEL_CURVE timeMs array.
console.log("\nRECOMMENDED timeMs (ms):");
console.log(rows.map((r) => `${r.recSec * 1000}`).join(", "));
