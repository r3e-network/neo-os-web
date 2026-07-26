/**
 * tune.mjs — Monte-Carlo balance validation for Goose Basket Shuffle.
 *
 * S5 rewrite. What changed vs the v2.1 script (audit findings):
 *   1. NO MANUAL CURVE COPY — the level curve, scene kind pools, tray size and
 *      the shuffle grant are extracted from the TypeScript sources at run time
 *      (regex over the literal arrays). If extraction fails or the data breaks
 *      an invariant, the script exits non-zero instead of silently drifting.
 *   2. REAL GENERATOR OUTPUT — trials run on `{ id, kind }` item instances the
 *      way engine-zhuada.ts produces them (scene kindPool ids, counts always a
 *      multiple of 3). The old random policy read `.kind` off plain numbers,
 *      producing `undefined` self-matches and `splice(-1)` — its "randomWin
 *      100%" column was a pure artifact. Fixed here.
 *   3. NO TIMER IN THE SIMULATION — matching the parity-spec target (G1: the
 *      original has no hard countdown; tray jam is the loss condition). The
 *      script still emits a recommended time budget from greedy pick counts as
 *      a FAIRNESS FLOOR for the currently shipped timed mode, and gates that
 *      the shipped timeMs never sits below it.
 *   4. STREAM + OCCLUSION MODEL — hundreds of logical items are packetized as
 *      complete triples, but item-stream.ts exposes only 54 initially and one
 *      9-item bottom-up wave after the live pile falls to 45. Within that live
 *      physics window only E(n) = max(6, round(n^0.72)) top items are pickable
 *      (n=18 → 8 exposed, n=54 → 18), matching the shipped reservoir model.
 *   5. STRATEGY OPTIONS — policies can spend rescue moves:
 *        shuffle : re-roll kind assignment + re-pile (shipped power-up, 1/level
 *                  grant read from guest-engine.ts)
 *        remove  : bank the first 3 tray items to a side shelf that still
 *                  participates in matching (shipped parity tool "移出")
 *        undo    : return the last non-matching grab to the top of the pile
 *                  (shipped parity tool "撤回")
 *
 * Policies:
 *   random     : careless player — uniform pick among EXPOSED items, no rescues.
 *   greedy     : thinking player — complete triples > advance pairs > start the
 *                most-exposed kind, keeps free slots as a safety margin, spends
 *                rescues only when cornered. Run in four loadouts:
 *                  greedySolve  FULL VISIBILITY, no rescues — the logical
 *                               solvability proof (must be 100%: pair-in-tray ⇒
 *                               box still holds a completer, since every kind
 *                               count is a multiple of 3)
 *                  greedy0      occlusion, no rescues (structural floor)
 *                  greedyS      occlusion + shipped shuffle grant ← difficulty
 *                  greedyTrio   occlusion + shipped shuffle/remove/undo
 *
 * Output per level: solve% (full-info gate), greedyWin% (occlusion, shipped
 * loadout — the honest focused-player difficulty), randomWin%, stuckRate
 * (random jam rate), avgPicks, rescue usage, recommended timed-mode budget
 * (full clear = `items` picks × 1.5s + 12s buffer, rounded to 5s).
 *
 * GATE (exit code 1 when violated):
 *   A. greedySolve wins 100% of trials on every level — logical solvability:
 *      no level is mathematically dead (occlusion losses are skill/luck, the
 *      intended lategame pressure, not broken data).
 *   B. L1 random win ≥ 95% and its unmatched-kind ceiling stays below seven
 *      slots — the opening teaches selection/matching without a trap state.
 *   C. L2 is the intentional challenge cliff: at least 3× type variety, 8×
 *      logical depth, and +15pp random jam risk over L1.
 *   D. Difficulty rises monotonically INSIDE each scene (2pp slack):
 *      stuckRate non-decreasing AND occlusion greedyWin non-increasing.
 *   E. Scene-average difficulty rises across scenes (2pp slack), same signals.
 *   F. Shipped timeMs ≥ recommended budget on every level (timed-mode fairness).
 *
 * Run: node scripts/tune.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSrc = (rel) => readFileSync(join(ROOT, rel), "utf8");

function die(msg) {
  console.error(`tune.mjs FATAL: ${msg}`);
  process.exit(1);
}

// ── 1. Extract shipped data from the TS sources (drift-proof) ────────────────

function extractLevelCurve(src) {
  const block = src.match(/LEVEL_CURVE\s*:\s*LevelSpec\[\]\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) die("LEVEL_CURVE literal not found in game-rules.ts");
  const rows = [];
  const re = /\{\s*level:\s*(\d+),\s*kinds:\s*(\d+),\s*perKind:\s*(\d+),\s*timeMs:\s*(\d+),\s*boxSize:\s*(\d+)/g;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    rows.push({
      level: Number(m[1]),
      kinds: Number(m[2]),
      perKind: Number(m[3]),
      timeMs: Number(m[4]),
      boxSize: Number(m[5]),
    });
  }
  if (rows.length === 0) die("no LEVEL_CURVE rows parsed");
  rows.forEach((r, i) => {
    if (r.level !== i + 1) die(`LEVEL_CURVE levels not contiguous at index ${i}`);
  });
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
  if (scenes.length === 0) die("no SCENES parsed from scenes.ts");
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
const STREAM_INITIAL_VISIBLE = extractIntConst(streamSrc, "STREAM_INITIAL_VISIBLE", "item-stream.ts");
const STREAM_REFILL_TRIGGER = extractIntConst(streamSrc, "STREAM_REFILL_TRIGGER", "item-stream.ts");
const STREAM_REFILL_BATCH = extractIntConst(streamSrc, "STREAM_REFILL_BATCH", "item-stream.ts");
const STREAM_VISIBLE_CEILING = extractIntConst(streamSrc, "STREAM_VISIBLE_CEILING", "item-stream.ts");
const SCORE_PER_MATCH_DEFAULT = 10; // default of readTuneNum("score", 10, …)
const SCENE_KIND_COUNT = extractIntConst(scenesSrc, "SCENE_KIND_POOL_SIZE", "scenes.ts");
const CATALOG_KIND_COUNT = (engineSrc.match(/\{ id: \d+, name:/g) ?? []).length;

// Shipped-data invariants (fail fast — a broken catalog invalidates every row).
{
  const covered = new Array(CURVE.length + 1).fill(false);
  for (const s of SCENES) {
    if (s.kindPool.length !== SCENE_KIND_COUNT) die(`scene kindPool is not ${SCENE_KIND_COUNT} ids`);
    if (new Set(s.kindPool).size !== SCENE_KIND_COUNT) die("scene kindPool contains duplicate ids");
    if (s.kindPool.some((id) => id < 0 || id >= CATALOG_KIND_COUNT)) die("scene kindPool contains an unknown catalog id");
    for (let l = s.first; l <= s.last; l += 1) covered[l] = true;
  }
  for (let l = 1; l <= CURVE.length; l += 1) {
    if (!covered[l]) die(`level ${l} not covered by any scene`);
  }
}

function sceneOfLevel(level) {
  return SCENES.find((s) => level >= s.first && level <= s.last) ?? SCENES[SCENES.length - 1];
}

// ── 2. Pure rules (mirror of engine-zhuada.ts semantics) ────────────────────

/** mulberry32 — same RNG family as makeRng in engine-zhuada.ts. */
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

/** Real generator shape: `{ id, kind }` items, kind ids from the scene pool. */
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

/** Shipped reservoir ordering: shuffle complete-triple packets, not singles. */
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
  return {
    active,
    reserve,
  };
}

function isTrayStuck(slots) {
  if (!slots.every((s) => s !== null)) return false;
  const c = new Map();
  for (const s of slots) c.set(s, (c.get(s) ?? 0) + 1);
  for (const n of c.values()) if (n >= 3) return false;
  return true;
}

// ── 3. Occlusion model ───────────────────────────────────────────────────────
// The item array is drop-ordered (end = top of the pile). Only the exposed top
// window is pickable; removing items lets lower layers surface as n shrinks.
function exposedWindow(n) {
  return Math.min(n, Math.max(6, Math.round(n ** 0.72)));
}

// ── 4. Trial runner with rescue options ──────────────────────────────────────

/**
 * Play one level to the end (no timer — tray jam is the only loss).
 * policy: "random" | "greedy"
 * loadout: { shuffles, removes, undos, fullVision? } — rescue budget (mutated
 * on a per-trial copy) + optional full-information mode (no occlusion).
 */
function playTrial(spec, kindPool, rng, policy, loadoutIn) {
  const loadout = { ...loadoutIn };
  const windowOf = (n) => (loadout.fullVision ? n : exposedWindow(n));
  const stream = createItemStream(generateItems(spec, kindPool, rng), rng);
  const box = stream.active;
  const reserve = stream.reserve;
  let tray = new Array(TRAY_SLOTS).fill(null);
  const shelf = []; // side shelf (remove target); participates in matching
  let picks = 0;
  let rescues = { shuffle: 0, remove: 0, undo: 0 };
  let lastGrab = null; // { kind } of the last NON-matching grab (undo target)
  const totalItems = box.length + reserve.length;
  const stepLimit = totalItems * 4 + 64;
  let steps = 0;

  const countsAcross = () => {
    const c = new Map();
    for (const s of tray) if (s !== null) c.set(s, (c.get(s) ?? 0) + 1);
    for (const s of shelf) c.set(s, (c.get(s) ?? 0) + 1);
    return c;
  };

  /** Place a kind; clear a triple across tray+shelf (shelf first). */
  const place = (kind) => {
    const emptyIdx = tray.indexOf(null);
    if (emptyIdx === -1) return false;
    tray[emptyIdx] = kind;
    const total = countsAcross().get(kind) ?? 0;
    if (total >= 3) {
      let toClear = 3;
      for (let i = shelf.length - 1; i >= 0 && toClear > 0; i -= 1) {
        if (shelf[i] === kind) {
          shelf.splice(i, 1);
          toClear -= 1;
        }
      }
      for (let i = 0; i < tray.length && toClear > 0; i += 1) {
        if (tray[i] === kind) {
          tray[i] = null;
          toClear -= 1;
        }
      }
      return true;
    }
    return false;
  };

  const doShuffle = () => {
    // Re-roll the kind multiset across remaining items + re-pile (the scene
    // re-drops everything after a shuffle, so exposure re-randomizes too).
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
    // exposed kind → { count, topIndex }
    const exp = new Map();
    for (let i = from; i < n; i += 1) {
      const k = box[i].kind;
      const e = exp.get(k);
      if (e) {
        e.count += 1;
        e.topIndex = i;
      } else exp.set(k, { count: 1, topIndex: i });
    }
    const pickKind = (k) => ({ type: "pick", index: exp.get(k).topIndex });

    // 1) Complete a triple from the exposed layer.
    // NOTE: kind ids include 0 — every "unset" check below must compare against
    // null explicitly (a `!kind` truthiness check silently breaks pool slices
    // containing kind 0 and skews the whole table).
    let best = null;
    for (const [k, e] of exp) {
      if ((trayC.get(k) ?? 0) === 2 && (best === null || e.count > exp.get(best).count)) best = k;
    }
    if (best !== null) return pickKind(best);

    // 2) Cornered (0–1 free after this pick): spend a rescue move.
    if (empty <= 1) {
      if (loadout.undos > 0 && lastGrab !== null) return { type: "undo" };
      if (loadout.removes > 0) return { type: "remove" };
      if (loadout.shuffles > 0) return { type: "shuffle" };
    } else if (empty === 2) {
      // 3) Tight: only advance an existing pair-in-waiting.
      let adv = null;
      for (const [k, e] of exp) {
        if ((trayC.get(k) ?? 0) === 1 && (adv === null || e.count > exp.get(adv).count)) adv = k;
      }
      if (adv !== null) return pickKind(adv);
      if (loadout.shuffles > 0) return { type: "shuffle" };
      if (loadout.removes > 0) return { type: "remove" };
    } else {
      // 4) Comfortable: advance a single, else start the most-exposed kind.
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
    // Forced pick (no rescue left): closest-to-triple, then most exposed.
    let forced = null;
    let forcedScore = -1;
    for (const [k, e] of exp) {
      const score = (trayC.get(k) ?? 0) * 100 + e.count;
      if (score > forcedScore) {
        forcedScore = score;
        forced = k;
      }
    }
    return pickKind(forced);
  };

  while (box.length > 0 || reserve.length > 0) {
    refill();
    if (box.length === 0) return { win: false, picks, jam: false, rescues };
    steps += 1;
    if (steps > stepLimit) return { win: false, picks, jam: false, rescues };
    let action;
    if (policy === "random") {
      const n = box.length;
      const from = n - windowOf(n);
      action = { type: "pick", index: from + Math.floor(rng() * (n - from)) };
    } else {
      action = greedyDecide();
    }

    if (action.type === "shuffle") {
      loadout.shuffles -= 1;
      rescues.shuffle += 1;
      doShuffle();
      lastGrab = null;
      continue;
    }
    if (action.type === "remove") {
      loadout.removes -= 1;
      rescues.remove += 1;
      let moved = 0;
      for (let i = 0; i < tray.length && moved < 3; i += 1) {
        if (tray[i] !== null) {
          shelf.push(tray[i]);
          tray[i] = null;
          moved += 1;
        }
      }
      lastGrab = null;
      continue;
    }
    if (action.type === "undo") {
      loadout.undos -= 1;
      rescues.undo += 1;
      const slot = tray.lastIndexOf(lastGrab.kind);
      if (slot !== -1) {
        tray[slot] = null;
        box.push({ id: -1, kind: lastGrab.kind }); // back on top of the pile
      }
      lastGrab = null;
      continue;
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

// ── 5. Run the matrix ─────────────────────────────────────────────────────────

const TRIALS_MAIN = 4000; // greedyS (gate) + random (stuckRate)
const TRIALS_SIDE = 1500; // greedy0 + greedyTrio (informational)
const SEC_PER_PICK = 1.5; // human tap + think
const BUFFER_SEC = 12;
const roundTo5s = (sec) => Math.ceil(sec / 5) * 5;

const rows = [];
for (let i = 0; i < CURVE.length; i += 1) {
  const spec = CURVE[i];
  const kindPool = sceneOfLevel(spec.level).kindPool.slice(0, spec.kinds);
  const total = spec.kinds * spec.perKind * 3;

  let gWin = 0;
  let gPicks = 0;
  let gShuffles = 0;
  let rWin = 0;
  let rJam = 0;
  for (let t = 0; t < TRIALS_MAIN; t += 1) {
    const g = playTrial(spec, kindPool, makeRng((i + 1) * 100003 + t * 7 + 1), "greedy", {
      shuffles: GRANT_SHUFFLE,
      removes: 0,
      undos: 0,
    });
    if (g.win) gWin += 1;
    gPicks += g.picks;
    gShuffles += g.rescues.shuffle;
    const r = playTrial(spec, kindPool, makeRng((i + 1) * 911 + t * 13 + 3), "random", {
      shuffles: 0,
      removes: 0,
      undos: 0,
    });
    if (r.win) rWin += 1;
    else if (r.jam) rJam += 1;
  }

  let solveWin = 0;
  let g0Win = 0;
  let g3Win = 0;
  for (let t = 0; t < TRIALS_SIDE; t += 1) {
    const gs = playTrial(spec, kindPool, makeRng((i + 1) * 33301 + t * 11 + 7), "greedy", {
      shuffles: 0,
      removes: 0,
      undos: 0,
      fullVision: true,
    });
    if (gs.win) solveWin += 1;
    const g0 = playTrial(spec, kindPool, makeRng((i + 1) * 52361 + t * 17 + 5), "greedy", {
      shuffles: 0,
      removes: 0,
      undos: 0,
    });
    if (g0.win) g0Win += 1;
    const g3 = playTrial(spec, kindPool, makeRng((i + 1) * 74093 + t * 19 + 9), "greedy", {
      shuffles: GRANT_SHUFFLE,
      removes: 1,
      undos: 1,
    });
    if (g3.win) g3Win += 1;
  }

  const avgPicks = gPicks / TRIALS_MAIN;
  // Timed-mode budget must cover a WINNING run: a clear always takes exactly
  // `total` picks (every item is extracted once), so the recommendation uses
  // the full clear length — not the loss-truncated average.
  const recSec = roundTo5s(total * SEC_PER_PICK + BUFFER_SEC);
  rows.push({
    level: spec.level,
    kinds: spec.kinds,
    perKind: spec.perKind,
    total,
    solveWin: solveWin / TRIALS_SIDE,
    greedyWin: gWin / TRIALS_MAIN,
    greedy0Win: g0Win / TRIALS_SIDE,
    greedyTrioWin: g3Win / TRIALS_SIDE,
    randomWin: rWin / TRIALS_MAIN,
    stuckRate: rJam / TRIALS_MAIN,
    avgPicks: Math.round(avgPicks),
    avgShuffleUse: gShuffles / TRIALS_MAIN,
    recMs: recSec * 1000,
    shippedMs: spec.timeMs,
    ceiling: spec.kinds * spec.perKind * SCORE_PER_MATCH_DEFAULT,
  });
}

// ── 6. Report ─────────────────────────────────────────────────────────────────

const pct = (v) => `${(v * 100).toFixed(1)}%`.padStart(7);
console.log("Occlusion-aware Monte-Carlo (no timer — tray jam is the only loss)");
console.log(`trials: ${TRIALS_MAIN} main / ${TRIALS_SIDE} side · live stream ${STREAM_INITIAL_VISIBLE}→${STREAM_REFILL_TRIGGER}+${STREAM_REFILL_BATCH} (cap ${STREAM_VISIBLE_CEILING}) · exposed E(n)=max(6, n^0.72)`);
console.log("");
console.log("level | kinds | per | items | solve% | greedyWin | rndWin | stuckRate | avgPicks | shufUse | recTime | shipped");
console.log("------+-------+-----+-------+--------+-----------+--------+-----------+----------+---------+---------+--------");
for (const r of rows) {
  console.log(
    `${String(r.level).padStart(5)} | ${String(r.kinds).padStart(5)} | ${String(r.perKind).padStart(3)} | ${String(r.total).padStart(5)} | ${pct(r.solveWin).padStart(6)} | ${pct(r.greedyWin).padStart(9)} | ${pct(r.randomWin).padStart(6)} | ${pct(r.stuckRate).padStart(9)} | ${String(r.avgPicks).padStart(8)} | ${r.avgShuffleUse.toFixed(2).padStart(7)} | ${String(r.recMs / 1000 + "s").padStart(7)} | ${String(r.shippedMs / 1000 + "s").padStart(6)}`,
  );
}

console.log("\nStrategy options (win rate): rescue value per level");
console.log("level | greedy no-rescue | greedy +shuffle | greedy +shuffle+remove+undo (SHIPPED)");
for (const r of rows) {
  console.log(
    `${String(r.level).padStart(5)} | ${pct(r.greedy0Win).padStart(16)} | ${pct(r.greedyWin).padStart(25)} | ${pct(r.greedyTrioWin).padStart(30)}`,
  );
}

console.log("\nMilestone economy check (base ceiling = kinds × perKind × 10):");
console.log("level | baseCeiling | hintStep(30%) | addTimeStep(60%)");
for (const r of rows) {
  const hintStep = Math.max(20, Math.round((r.ceiling * 0.3) / 5) * 5);
  const addStep = Math.max(40, Math.round((r.ceiling * 0.6) / 5) * 5);
  console.log(
    `${String(r.level).padStart(5)} | ${String(r.ceiling).padStart(11)} | ${String(hintStep).padStart(13)} | ${String(addStep).padStart(16)}`,
  );
}

// ── 7. Gate ───────────────────────────────────────────────────────────────────

const failures = [];

// A. Full-information greedy must clear every level — logical solvability.
for (const r of rows) {
  if (r.solveWin < 0.999) failures.push(`GATE A: L${r.level} full-info greedy solve ${pct(r.solveWin).trim()} < 100%`);
}
// B. L1 is a true tutorial floor: random play almost always clears, and even
//    two buffered copies of every kind cannot occupy all seven tray slots.
if (rows[0].randomWin < 0.95) failures.push(`GATE B: L1 random win ${pct(rows[0].randomWin).trim()} < 95%`);
if (rows[0].kinds * 2 >= TRAY_SLOTS) failures.push(`GATE B: L1 can jam (${rows[0].kinds} kinds × 2 unmatched ≥ ${TRAY_SLOTS} slots)`);
// C. L2 must feel immediately and measurably harder, not like a gentle bridge.
if (rows[1].kinds < rows[0].kinds * 3 || rows[1].total < rows[0].total * 8) {
  failures.push(`GATE C: L2 cliff ${rows[0].kinds} kinds/${rows[0].total} items → ${rows[1].kinds} kinds/${rows[1].total} items is too small`);
}
if (rows[1].stuckRate < rows[0].stuckRate + 0.15) {
  failures.push(`GATE C: L2 random jam risk ${pct(rows[1].stuckRate).trim()} is not at least 15pp above L1 ${pct(rows[0].stuckRate).trim()}`);
}
// D. Difficulty rises monotonically inside each scene (2pp slack):
//    stuckRate must not fall, occlusion greedyWin must not rise.
for (const s of SCENES) {
  for (let l = s.first; l < s.last; l += 1) {
    const a = rows[l - 1];
    const b = rows[l];
    if (b.stuckRate < a.stuckRate - 0.02) {
      failures.push(`GATE D: stuckRate falls inside scene [${s.first}-${s.last}] at L${l}→L${l + 1} (${pct(a.stuckRate).trim()} → ${pct(b.stuckRate).trim()})`);
    }
    if (b.greedyWin > a.greedyWin + 0.02) {
      failures.push(`GATE D: greedyWin rises inside scene [${s.first}-${s.last}] at L${l}→L${l + 1} (${pct(a.greedyWin).trim()} → ${pct(b.greedyWin).trim()})`);
    }
  }
}
// E. Scene-average difficulty rises across scenes (2pp slack), same signals.
const sceneAvgOf = (key) =>
  SCENES.map((s) => {
    let sum = 0;
    for (let l = s.first; l <= s.last; l += 1) sum += rows[l - 1][key];
    return sum / (s.last - s.first + 1);
  });
const sceneStuck = sceneAvgOf("stuckRate");
const sceneGreedy = sceneAvgOf("greedyWin");
for (let i = 1; i < SCENES.length; i += 1) {
  if (sceneStuck[i] < sceneStuck[i - 1] - 0.02) {
    failures.push(`GATE E: scene ${i + 1} avg stuckRate ${pct(sceneStuck[i]).trim()} < scene ${i} ${pct(sceneStuck[i - 1]).trim()}`);
  }
  if (sceneGreedy[i] > sceneGreedy[i - 1] + 0.02) {
    failures.push(`GATE E: scene ${i + 1} avg greedyWin ${pct(sceneGreedy[i]).trim()} > scene ${i} ${pct(sceneGreedy[i - 1]).trim()}`);
  }
}
// F. Shipped timed-mode budget is never below the recommendation.
for (const r of rows) {
  if (r.shippedMs < r.recMs) failures.push(`GATE F: L${r.level} shipped timeMs ${r.shippedMs} < recommended ${r.recMs}`);
}

console.log("\nScene-average stuckRate :", sceneStuck.map((v) => pct(v).trim()).join(" → "));
console.log("Scene-average greedyWin :", sceneGreedy.map((v) => pct(v).trim()).join(" → "));
if (failures.length > 0) {
  console.error("\nGATE FAIL:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nALL GATES PASS ✅  (A solvability 100% · B safe L1 floor · C deliberate L2 challenge cliff · D/E monotonic difficulty · F fair clock)");
