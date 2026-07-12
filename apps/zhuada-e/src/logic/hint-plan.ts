/**
 * Hint planning — pure, render-free logic for the smart hint (R5).
 *
 * Given the current tray + shelf contents and the items still in the box,
 * decide which *kind* is the most useful to surface and how many of that kind
 * are still needed from the box to complete (or advance) a triple. Returning
 * the deficit lets the scene light up the whole near-triple group instead of a
 * single item, so the hint rescues rather than just points.
 *
 * Kept free of THREE.js / scene state so it can be unit-tested in isolation.
 */

export interface HintPlan {
  /** The kind to surface, or -1 if there is nothing to hint. */
  kind: number;
  /** Copies of `kind` still reachable in the box to finish the triple. */
  needFromBox: number;
}

/**
 * @param tray   current tray slot kinds (null = empty)
 * @param shelf  current side-shelf slot kinds (null = empty)
 * @param items  items still in the box; only `kind` is read
 */
export function computeHintPlan(
  tray: (number | null)[],
  shelf: (number | null)[],
  items: { kind: number }[],
): HintPlan {
  const boxCounts = new Map<number, number>();
  for (const it of items) boxCounts.set(it.kind, (boxCounts.get(it.kind) ?? 0) + 1);
  const trayCounts = new Map<number, number>();
  for (const k of [...tray, ...shelf]) {
    if (k !== null) trayCounts.set(k, (trayCounts.get(k) ?? 0) + 1);
  }
  // 1) a kind with 2 across tray/shelf and >=1 active completes a triple now
  for (const [k, c] of trayCounts) if (c === 2 && (boxCounts.get(k) ?? 0) >= 1) return { kind: k, needFromBox: 1 };
  // 2) a kind with 1 in tray and >=2 in box builds toward a triple
  for (const [k, c] of trayCounts) if (c === 1 && (boxCounts.get(k) ?? 0) >= 2) return { kind: k, needFromBox: 2 };
  // 3) otherwise surface the most common kind still in the box, need all 3
  let best = -1;
  let bestC = 0;
  for (const [k, c] of boxCounts) if (c > bestC) { bestC = c; best = k; }
  return { kind: best, needFromBox: 3 };
}
