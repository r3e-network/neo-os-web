/**
 * balance-frenzy.mjs — companion balance validation for the R6 Frenzy,
 * R7 goose-passive, and R4 daily-reward levers that tune.mjs does NOT cover.
 *
 * tune.mjs owns solvability / occlusion / curve-fairness gates. This script
 * owns the *feel & economy* levers that only matter once those invariants hold:
 *   1. FRENZY_TRIGGER_COMBO / FRENZY_CHARGES — is Frenzy a "climax" (occasional,
 *      skill-expressing) or "constant" (trivializing) or "dead" (never fires)?
 *   2. R7 goose passives — do the three NEW levers (volcano +1 shuffle, cloud
 *      +5% score, abyss frenzy −1) shift win-rate without breaking the
 *      solvability invariant or removing late-game tension?
 *   3. R4 daily economy — does the streak cap (5) + 7-day milestone (+3) keep
 *      powerups a welcome gift rather than a balance-breaking drip?
 *
 * Drift-proof: the level curve, scenes, and base grants are regex-extracted
 * from the TS sources, same as tune.mjs. If extraction fails the script exits 1.
 *
 * Run: node scripts/balance-frenzy.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSrc = (rel) => readFileSync(join(ROOT, rel), "utf8");

function die(msg) {
  console.error(`balance-frenzy.mjs FATAL: ${msg}`);
  process.exit(1);
}

// ── 1. Extract shipped data from the TS sources (mirror of tune.mjs) ─────────

function extractLevelCurve(src) {
  const block = src.match(/LEVEL_CURVE\s*:\s*LevelSpec\[\]\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) die("LEVEL_CURVE literal not found in game-rules.ts");
  const rows = [];
  const re = /\{\s*level:\s*(\d+),\s*kinds:\s*(\d+),\s*perKind:\s*(\d+),\s*timeMs:\s*(\d+),\s*boxSize:\s*(\d+)/g;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    rows.push({ level: Number(m[1]), kinds: Number(m[2]), perKind: Number(m[3]), timeMs: Number(m[4]), boxSize: Number(m[5]) });
  }
  if (rows.length === 0) die("no LEVEL_CURVE rows parsed");
  return rows;
}
function extractScenes(src) {
  const scenes = [];
  const re = /levels:\s*\[(\d+),\s*(\d+)\][\s\S]*?kindPool:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    scenes.push({
      first: Number(m[1]),
      last: Number(m[2]),
      kindPool: m[3].split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
    });
  }
  if (scenes.length === 0) die("no SCENES parsed");
  return scenes;
}
function extractIntConst(src, name, file) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  if (!m) die(`constant ${name} not found in ${file}`);
  return Number(m[1]);
}

const gameRulesSrc = readSrc("src/logic/game-rules.ts");
const scenesSrc = readSrc("src/logic/scenes.ts");
const engineSrc = readSrc("src/logic/engine-zhuada.ts");
const guestSrc = readSrc("src/logic/guest-engine.ts");
const streamSrc = readSrc("src/logic/item-stream.ts");

const CURVE = extractLevelCurve(gameRulesSrc);
const SCENES = extractScenes(scenesSrc);
const TRAY_SLOTS = extractIntConst(engineSrc, "TRAY_SLOTS", "engine-zhuada.ts");
const GRANT_SHUFFLE = extractIntConst(guestSrc, "GRANT_SHUFFLE", "guest-engine.ts");
const GRANT_REMOVE = extractIntConst(guestSrc, "GRANT_REMOVE", "guest-engine.ts");
const GRANT_UNDO = extractIntConst(guestSrc, "GRANT_UNDO", "guest-engine.ts");
const FRENZY_TRIGGER_COMBO = extractIntConst(guestSrc, "FRENZY_TRIGGER_COMBO", "guest-engine.ts");
const FRENZY_CHARGES = extractIntConst(guestSrc, "FRENZY_CHARGES", "guest-engine.ts");
const STREAM_INITIAL_VISIBLE = extractIntConst(streamSrc, "STREAM_INITIAL_VISIBLE", "item-stream.ts");
const STREAM_REFILL_TRIGGER = extractIntConst(streamSrc, "STREAM_REFILL_TRIGGER", "item-stream.ts");
const STREAM_REFILL_BATCH = extractIntConst(streamSrc, "STREAM_REFILL_BATCH", "item-stream.ts");
const STREAM_VISIBLE_CEILING = extractIntConst(streamSrc, "STREAM_VISIBLE_CEILING", "item-stream.ts");
const COMBO_WINDOW_MS = 2200; // COMBO_WINDOW_MS default (readTuneNum "combo", 2200)

const KIND_COUNT = 12;
function sceneOfLevel(level) {
  return SCENES.find((s) => level >= s.first && level <= s.last) ?? SCENES[SCENES.length - 1];
}

// ── 2. Pure engine (mirror of tune.mjs playTrial) ───────────────────────────

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
function generateItems(spec, kindPool, rng) {
  const pool = [];
  let id = 0;
  for (let k = 0; k < spec.kinds; k += 1) {
    const kindId = kindPool[k] ?? k;
    const count = spec.perKind * 3;
    for (let i = 0; i < count; i += 1) pool.push({ id: id++, kind: kindId });
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool;
}
function createItemStream(items, rng) {
  const byKind = new Map();
  for (const item of items) {
    const group = byKind.get(item.kind) ?? [];
    group.push(item);
    byKind.set(item.kind, group);
  }
  const packetsByKind = new Map();
  for (const group of byKind.values()) {
    for (let i = group.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = group[i];
      group[i] = group[j];
      group[j] = tmp;
    }
    const kindPackets = [];
    for (let i = 0; i < group.length; i += 3) kindPackets.push(group.slice(i, i + 3));
    packetsByKind.set(group[0].kind, kindPackets);
  }
  const kindOrder = [...packetsByKind.keys()];
  for (let i = kindOrder.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = kindOrder[i];
    kindOrder[i] = kindOrder[j];
    kindOrder[j] = tmp;
  }
  const packetTotal = [...packetsByKind.values()].reduce((sum, group) => sum + group.length, 0);
  const initialPacketCount = Math.min(STREAM_INITIAL_VISIBLE / 3, packetTotal);
  const initialPackets = [];
  while (initialPackets.length < initialPacketCount) {
    const eligible = kindOrder.filter((kind) => packetsByKind.get(kind).length > 0);
    for (let i = eligible.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = eligible[i];
      eligible[i] = eligible[j];
      eligible[j] = tmp;
    }
    if (eligible.length === 0) break;
    for (const kind of eligible) {
      initialPackets.push(packetsByKind.get(kind).pop());
      if (initialPackets.length >= initialPacketCount) break;
    }
  }
  const active = initialPackets.flat();
  for (let i = active.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = active[i];
    active[i] = active[j];
    active[j] = tmp;
  }
  const packets = [...packetsByKind.values()].flat();
  for (let i = packets.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = packets[i];
    packets[i] = packets[j];
    packets[j] = tmp;
  }
  const reserve = [];
  for (let i = 0; i < packets.length; i += STREAM_REFILL_BATCH / 3) {
    const wave = packets.slice(i, i + STREAM_REFILL_BATCH / 3).flat();
    for (let j = wave.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rng() * (j + 1));
      const tmp = wave[j];
      wave[j] = wave[k];
      wave[k] = tmp;
    }
    reserve.push(...wave);
  }
  return { active, reserve };
}
function exposedWindow(n) {
  return Math.min(n, Math.max(6, Math.round(n ** 0.72)));
}
function isTrayStuck(slots) {
  if (!slots.every((s) => s !== null)) return false;
  const c = new Map();
  for (const s of slots) c.set(s, (c.get(s) ?? 0) + 1);
  for (const n of c.values()) if (n >= 3) return false;
  return true;
}
function playTrial(spec, kindPool, rng, loadoutIn) {
  const loadout = { ...loadoutIn };
  const windowOf = (n) => (loadoutIn.fullVision ? n : exposedWindow(n));
  const stream = createItemStream(generateItems(spec, kindPool, rng), rng);
  const box = stream.active;
  const reserve = stream.reserve;
  let tray = new Array(TRAY_SLOTS).fill(null);
  const shelf = [];
  let picks = 0;
  let rescues = { shuffle: 0, remove: 0, undo: 0 };
  let lastGrab = null;
  const totalItems = box.length + reserve.length;
  const stepLimit = totalItems * 4 + 64;
  let steps = 0;
  const countsAcross = () => {
    const c = new Map();
    for (const s of tray) if (s !== null) c.set(s, (c.get(s) ?? 0) + 1);
    for (const s of shelf) c.set(s, (c.get(s) ?? 0) + 1);
    return c;
  };
  const place = (kind) => {
    const emptyIdx = tray.indexOf(null);
    if (emptyIdx === -1) return false;
    tray[emptyIdx] = kind;
    const total = countsAcross().get(kind) ?? 0;
    if (total >= 3) {
      let toClear = 3;
      for (let i = shelf.length - 1; i >= 0 && toClear > 0; i -= 1) {
        if (shelf[i] === kind) { shelf.splice(i, 1); toClear -= 1; }
      }
      for (let i = 0; i < tray.length && toClear > 0; i += 1) {
        if (tray[i] === kind) { tray[i] = null; toClear -= 1; }
      }
      return true;
    }
    return false;
  };
  const doShuffle = () => {
    const kinds = box.map((it) => it.kind);
    for (let i = kinds.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = kinds[i];
      kinds[i] = kinds[j];
      kinds[j] = tmp;
    }
    for (let i = 0; i < box.length; i += 1) box[i] = { ...box[i], kind: kinds[i] };
    for (let i = box.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = box[i];
      box[i] = box[j];
      box[j] = tmp;
    }
  };
  const refill = () => {
    if (reserve.length === 0 || box.length > STREAM_REFILL_TRIGGER) return;
    const capacity = Math.max(0, STREAM_VISIBLE_CEILING - box.length);
    const take = Math.min(STREAM_REFILL_BATCH, reserve.length, capacity);
    box.push(...reserve.splice(0, take));
  };
  const greedyDecide = () => {
    const n = box.length;
    const from = n - windowOf(n);
    const trayC = countsAcross();
    const empty = tray.filter((s) => s === null).length;
    const exp = new Map();
    for (let i = from; i < n; i += 1) {
      const k = box[i].kind;
      const e = exp.get(k);
      if (e) { e.count += 1; e.topIndex = i; } else exp.set(k, { count: 1, topIndex: i });
    }
    const pickKind = (k) => ({ type: "pick", index: exp.get(k).topIndex });
    let best = null;
    for (const [k, e] of exp) {
      if ((trayC.get(k) ?? 0) === 2 && (best === null || e.count > exp.get(best).count)) best = k;
    }
    if (best !== null) return pickKind(best);
    if (empty <= 1) {
      if (loadout.undos > 0 && lastGrab !== null) return { type: "undo" };
      if (loadout.removes > 0) return { type: "remove" };
      if (loadout.shuffles > 0) return { type: "shuffle" };
    } else if (empty === 2) {
      let adv = null;
      for (const [k, e] of exp) {
        if ((trayC.get(k) ?? 0) === 1 && (adv === null || e.count > exp.get(adv).count)) adv = k;
      }
      if (adv !== null) return pickKind(adv);
      if (loadout.shuffles > 0) return { type: "shuffle" };
      if (loadout.removes > 0) return { type: "remove" };
    } else {
      let adv = null;
      for (const [k, e] of exp) {
        if ((trayC.get(k) ?? 0) === 1 && (adv === null || e.count > exp.get(adv).count)) adv = k;
      }
      if (adv !== null) return pickKind(adv);
      let start = null;
      for (const [k, e] of exp) {
        if (start === null || e.count > exp.get(start).count) start = k;
      }
      return pickKind(start);
    }
    let forced = null;
    let forcedScore = -1;
    for (const [k, e] of exp) {
      const score = (trayC.get(k) ?? 0) * 100 + e.count;
      if (score > forcedScore) { forcedScore = score; forced = k; }
    }
    return pickKind(forced);
  };
  while (box.length > 0 || reserve.length > 0) {
    refill();
    if (box.length === 0) return { win: false, picks, jam: false, rescues };
    steps += 1;
    if (steps > stepLimit) return { win: false, picks, jam: false, rescues };
    const action = greedyDecide();
    if (action.type === "shuffle") {
      loadout.shuffles -= 1; rescues.shuffle += 1; doShuffle(); lastGrab = null; continue;
    }
    if (action.type === "remove") {
      loadout.removes -= 1; rescues.remove += 1;
      let moved = 0;
      for (let i = 0; i < tray.length && moved < 3; i += 1) {
        if (tray[i] !== null) { shelf.push(tray[i]); tray[i] = null; moved += 1; }
      }
      lastGrab = null; continue;
    }
    if (action.type === "undo") {
      loadout.undos -= 1; rescues.undo += 1;
      const slot = tray.lastIndexOf(lastGrab.kind);
      if (slot !== -1) { tray[slot] = null; box.push({ id: -1, kind: lastGrab.kind }); }
      lastGrab = null; continue;
    }
    const item = box[action.index];
    box.splice(action.index, 1);
    picks += 1;
    const matched = place(item.kind);
    lastGrab = matched ? null : { kind: item.kind };
    refill();
    if (isTrayStuck(tray)) return { win: false, picks, jam: true, rescues };
  }
  return { win: true, picks, rescues };
}

// ── 3. Section 1 — Frenzy cadence model (no greedy needed) ──────────────────
// A Frenzy trigger fires when a combo chain reaches FRENZY_TRIGGER_COMBO
// consecutive matches inside COMBO_WINDOW_MS. We model the *match cadence* of
// three player archetypes and Monte-Carlo the chain breaks. A "thinking pause"
// (gap > window) breaks the chain. Result: how often Frenzy fires per level,
// and how many item-taps it saves (each charge auto-pulls 1 box item).

const ARCHE = {
  skilled: { meanGap: 0.9, pauseP: 0.15, label: "熟练(流畅)" },
  average: { meanGap: 1.6, pauseP: 0.35, label: "平均" },
  struggling: { meanGap: 2.6, pauseP: 0.60, label: "吃力" },
};
const FRENZY_USABILITY = 0.7; // fraction of charges that find a valid auto-pull

function frenzyStats(matches, triggerCombo, charges, arch) {
  // Monte-Carlo chains over this level's match count.
  let triggers = 0;
  let chainLen = 0;
  for (let i = 0; i < matches; i += 1) {
    const pause = Math.random() < arch.pauseP;
    if (pause) { chainLen = 0; continue; }
    // realistic jitter around the mean gap — stays below the window when not paused
    const gap = arch.meanGap * (0.6 + 0.8 * Math.random());
    if (gap > COMBO_WINDOW_MS / 1000) { chainLen = 0; continue; }
    chainLen += 1;
    if (chainLen >= triggerCombo) { triggers += 1; chainLen = 0; }
  }
  const savedItems = triggers * charges * FRENZY_USABILITY;
  return { triggers, savedItems };
}

console.log("════════════════════════════════════════════════════════════════════");
console.log("SECTION 1 — R6 Frenzy cadence (FRENZY_TRIGGER_COMBO=" + FRENZY_TRIGGER_COMBO + ", FRENZY_CHARGES=" + FRENZY_CHARGES + ")");
console.log("model: match cadence per archetype; pause breaks chain; each charge auto-pulls 1 item (usability " + FRENZY_USABILITY + ")");
console.log("");
console.log("level | matches | skilled trig/lev | avg trig/lev | struggle trig/lev | abyss(trigger→" + Math.max(3, FRENZY_TRIGGER_COMBO - 1) + ") avg trig/lev");
console.log("------+---------+------------------+--------------+-------------------+--------------------------------");
for (const spec of CURVE) {
  const matches = (spec.kinds * spec.perKind * 3) / 3;
  const sk = frenzyStats(matches, FRENZY_TRIGGER_COMBO, FRENZY_CHARGES, ARCHE.skilled);
  const av = frenzyStats(matches, FRENZY_TRIGGER_COMBO, FRENZY_CHARGES, ARCHE.average);
  const st = frenzyStats(matches, FRENZY_TRIGGER_COMBO, FRENZY_CHARGES, ARCHE.struggling);
  const ab = frenzyStats(matches, Math.max(3, FRENZY_TRIGGER_COMBO - 1), FRENZY_CHARGES, ARCHE.average);
  console.log(
    `${String(spec.level).padStart(5)} | ${String(matches).padStart(7)} | ${sk.triggers.toFixed(1).padStart(16)} | ${av.triggers.toFixed(1).padStart(12)} | ${st.triggers.toFixed(1).padStart(17)} | ${ab.triggers.toFixed(1).padStart(30)}`,
  );
}
console.log("\nInterpretation target: Frenzy should fire ~0× for struggling, ~1× for average, several× for skilled —");
console.log("a SKILL-EXPRESSION lever. If average fired >3×/level it would be 'constant' (trivial); if skilled <1× it is 'dead'.");

// ── 4. Section 2 — Goose-passive loadout sweep (greedy win-rate) ─────────────

const TRIALS = 1500;
console.log("\n════════════════════════════════════════════════════════════════════");
console.log("SECTION 2 — R7 goose-passive loadout sweep (greedy + occlusion, win rate)");
console.log("loadouts: base(greedyS) | +1 shuffle (volcano) | FULL COLLECTION (9 geese: +1 hint/+1 remove/+1 undo/+1 shuffle, night threshold earlier)");
console.log("");
console.log("level | baseWin | +volcano(+1shuf) | fullCollect | solveWin(full-info, must=100%)");
console.log("------+---------+------------------+-------------+-----------------------------");

const sweep = [];
let fullCollectAlwaysSolvable = true;
let fullCollectTensionPreserved = true; // greedyWin must stay <100% on late levels
for (let i = 0; i < CURVE.length; i += 1) {
  const spec = CURVE[i];
  const kindPool = sceneOfLevel(spec.level).kindPool.slice(0, spec.kinds);
  const baseLoad = { shuffles: GRANT_SHUFFLE, removes: 0, undos: 0 };
  const volcLoad = { shuffles: GRANT_SHUFFLE + 1, removes: 0, undos: 0 }; // R7 volcano
  const fullLoad = { shuffles: GRANT_SHUFFLE + 1, removes: GRANT_REMOVE + 1, undos: GRANT_UNDO + 1 }; // R7 + R3 win-affecting
  let baseWin = 0, volcWin = 0, fullWin = 0, solveWin = 0;
  for (let t = 0; t < TRIALS; t += 1) {
    if (playTrial(spec, kindPool, makeRng((i + 1) * 100003 + t * 7 + 1), baseLoad).win) baseWin += 1;
    if (playTrial(spec, kindPool, makeRng((i + 1) * 200003 + t * 7 + 2), volcLoad).win) volcWin += 1;
    if (playTrial(spec, kindPool, makeRng((i + 1) * 300003 + t * 7 + 3), fullLoad).win) fullWin += 1;
    if (playTrial(spec, kindPool, makeRng((i + 1) * 33301 + t * 11 + 7), { shuffles: 0, removes: 0, undos: 0, fullVision: true }).win) solveWin += 1;
  }
  const bW = baseWin / TRIALS, vW = volcWin / TRIALS, fW = fullWin / TRIALS, sW = solveWin / TRIALS;
  if (sW < 0.999) fullCollectAlwaysSolvable = false;
  if (spec.level >= 16 && fW >= 0.999) fullCollectTensionPreserved = false;
  sweep.push({ level: spec.level, bW, vW, fW, sW });
  console.log(
    `${String(spec.level).padStart(5)} | ${(bW * 100).toFixed(1).padStart(6)}% | ${(vW * 100).toFixed(1).padStart(15)}% | ${(fW * 100).toFixed(1).padStart(11)}% | ${(sW * 100).toFixed(1).padStart(27)}%`,
  );
}
console.log("\nR7 volcano (+1 shuffle): avg win-rate uplift vs base = " +
  (sweep.reduce((s, r) => s + (r.vW - r.bW), 0) / sweep.length * 100).toFixed(1) + "pp");
console.log("Full collection: avg win-rate vs base = " +
  (sweep.reduce((s, r) => s + (r.fW - r.bW), 0) / sweep.length * 100).toFixed(1) + "pp");
console.log("Full-collection solvability invariant (solveWin=100%): " + (fullCollectAlwaysSolvable ? "HOLD ✅" : "BROKEN ❌"));
console.log("Late-game tension preserved (fullCollect greedyWin<100% @L16+): " + (fullCollectTensionPreserved ? "YES ✅" : "LOST ❌ (too easy)"));

// ── 5. Section 3 — R4 daily economy solvency ─────────────────────────────────

console.log("\n════════════════════════════════════════════════════════════════════");
console.log("SECTION 3 — R4 daily economy solvency");
const DAILY_BASE = { shuffle: 1, hint: 1, remove: 1, undo: 1, addTime: 0 };
const DAILY_STREAK_BONUS_PER_2 = 1;
const DAILY_STREAK_BONUS_CAP = 5;
const DAILY_MILESTONE_BONUS = 3;
const DAILY_MILESTONE_EVERY = 7;
function dailyGrants(streak) {
  const per = Math.min(DAILY_STREAK_BONUS_CAP, Math.floor((streak - 1) / 2) * DAILY_STREAK_BONUS_PER_2);
  const milestone = streak % DAILY_MILESTONE_EVERY === 0;
  return {
    shuffle: DAILY_BASE.shuffle + per + (milestone ? DAILY_MILESTONE_BONUS : 0),
    hint: DAILY_BASE.hint + per + (milestone ? DAILY_MILESTONE_BONUS : 0),
    remove: DAILY_BASE.remove + per + (milestone ? DAILY_MILESTONE_BONUS : 0),
    undo: DAILY_BASE.undo + per + (milestone ? DAILY_MILESTONE_BONUS : 0),
    addTime: DAILY_BASE.addTime + per + (milestone ? DAILY_MILESTONE_BONUS : 0),
  };
}
// Modeled NEED: a player gets cornered roughly in proportion to pile depth &
// variety. shuffle need grows with kinds; remove/undo need grows with error rate.
const NEED = {
  skilled: { shufflePerItem: 0.02, errorPerItem: 0.01 },
  average: { shufflePerItem: 0.05, errorPerItem: 0.04 },
  struggling: { shufflePerItem: 0.09, errorPerItem: 0.09 },
};
function needFor(spec, arch) {
  const items = spec.kinds * spec.perKind * 3;
  const varietyFactor = spec.kinds / 12;
  return {
    shuffle: items * NEED[arch].shufflePerItem * (0.6 + 0.4 * varietyFactor),
    rescue: items * NEED[arch].errorPerItem, // remove+undo combined
  };
}
console.log("grants@streak=1 (base only):", JSON.stringify(dailyGrants(1)));
console.log("grants@streak=11 (cap hit):", JSON.stringify(dailyGrants(11)));
console.log("grants@streak=14 (cap+milestone):", JSON.stringify(dailyGrants(14)));
console.log("");
console.log("deficit check (need − grant; >0 = short, must rely on skill/retries):");
let worstDeficit = { arch: "", level: 0, val: -1e9 };
for (const arch of ["skilled", "average", "struggling"]) {
  let maxShufDef = -1e9, maxResDef = -1e9;
  for (const spec of CURVE) {
    const g = dailyGrants(11); // worst-case sustained streak (capped)
    const need = needFor(spec, arch);
    const shufDef = need.shuffle - g.shuffle;
    const resDef = need.rescue - (g.remove + g.undo);
    maxShufDef = Math.max(maxShufDef, shufDef);
    maxResDef = Math.max(maxResDef, resDef);
    if (shufDef > worstDeficit.val) worstDeficit = { arch, level: spec.level, val: shufDef };
  }
  console.log(`  ${arch.padEnd(10)} maxShuffleDeficit=${maxShufDef.toFixed(1)}  maxRescueDeficit=${maxResDef.toFixed(1)}`);
}
console.log("\nSolvency interpretation: deficits should be BOUNDED (player tops up via milestone refunds");
console.log("+ goose passives, and logical solvability is independent of powerups). A runaway negative");
console.log("deficit for 'average' at cap would mean the streak cap is too low (starvation).");
console.log("Note: grants are PER-DAY and stack with in-run milestone refunds (tune.mjs §milestone),");
console.log("so real per-run supply is grants + refunds; this section isolates the daily gift only.");

const ok =
  fullCollectAlwaysSolvable &&
  fullCollectTensionPreserved;
console.log("\n════════════════════════════════════════════════════════════════════");
console.log(ok ? "COMPANION CHECKS PASS ✅" : "COMPANION CHECKS FAIL ❌");
process.exit(ok ? 0 : 1);
