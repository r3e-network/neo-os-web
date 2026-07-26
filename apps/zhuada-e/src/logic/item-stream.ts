import type { ItemInstance } from "./engine-zhuada";

/**
 * Initial live physics population. L2+ opens at the same 54-body ceiling used
 * by refill waves so the tray reads as a layered heap rather than a sparse
 * single sheet. Short tutorial levels still expose only their real item total.
 */
export const STREAM_INITIAL_VISIBLE = 54;
/**
 * Let the player visibly excavate two thirds of the opening layer before the
 * reservoir moves. The reference rhythm depends on seeing the pan clear and
 * feeling a short breath before the next buried layer rises.
 */
export const STREAM_REFILL_TRIGGER = 18;
/** Nine complete triples rise together as one substantial bottom-up layer. */
export const STREAM_REFILL_BATCH = 27;
/** Defensive ceiling including a refill wave (Undo may transiently add one). */
export const STREAM_VISIBLE_CEILING = 54;

export interface ItemStreamState {
  active: ItemInstance[];
  reserve: ItemInstance[];
}

export interface ItemStreamRefill extends ItemStreamState {
  activated: ItemInstance[];
}

/** Fisher-Yates without mutating the caller's array. */
function shuffled<T>(input: readonly T[], rng: () => number): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const value = result[i]!;
    result[i] = result[j]!;
    result[j] = value;
  }
  return result;
}

/** Eight broad colour families plus one neutral bucket. This is intentionally
 * coarser than identity matching: it only keeps a random opening from looking
 * like a wash of mint, cream or any other single palette family. */
function openingColorBucket(color: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.16) return 8;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / delta + 2) * 60;
  else hue = ((r - g) / delta + 4) * 60;
  return Math.floor(hue / 45) % 8;
}

function chooseOpeningTreatments(
  family: number,
  count: 1 | 2,
  itemCatalog: readonly { color: number }[],
  bucketCounts: Map<number, number>,
  rng: () => number,
): number[] {
  const candidates = shuffled([family, family + 18, family + 36], rng);
  const choices = count === 1
    ? candidates.map((kind) => [kind])
    : candidates.flatMap((left, index) => (
      candidates.slice(index + 1).map((right) => [left, right])
    ));
  let best = choices[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const choice of choices) {
    const buckets = choice.map((kind) => openingColorBucket(itemCatalog[kind]!.color));
    const uniqueInside = new Set(buckets).size;
    const newBuckets = new Set(buckets.filter((bucket) => !bucketCounts.has(bucket))).size;
    const occupancyPenalty = buckets.reduce(
      (sum, bucket) => sum + (bucketCounts.get(bucket) ?? 0),
      0,
    );
    const neutralPenalty = buckets.reduce(
      (sum, bucket) => sum + (bucket === 8 ? 1 + (bucketCounts.get(bucket) ?? 0) : 0),
      0,
    );
    const score = newBuckets * 100 + uniqueInside * 18
      - occupancyPenalty * 14 - neutralPenalty * 18;
    if (score > bestScore) {
      best = choice;
      bestScore = score;
    }
  }
  for (const kind of best) {
    const bucket = openingColorBucket(itemCatalog[kind]!.color);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }
  return best;
}

/**
 * Pick the 18 kinds represented in a 54-body opening when a level owns more
 * identities than the mobile physics window can show at once. The omitted
 * kinds remain packetized in reserve and therefore make genuinely new objects
 * surface later. Fixed band floors keep the first view full of small fillers,
 * medium anchors and substantial large pieces instead of becoming a random
 * wall of one footprint.
 *
 * The visual target is deliberately twelve authored silhouettes, not six
 * silhouettes repeated in all three colourways. Six silhouettes contribute a
 * pair of close treatments (the observation challenge), while six more
 * contribute one treatment each (the rich mixed-pile read). Small pieces are
 * deliberately dominant: fourteen logical small kinds, two medium anchors and
 * two large anchors fill the same 54 bodies with far less dead floor than the
 * old 9/3/6 split. That preserves eighteen independently matchable kinds and
 * complete-triple fairness without making the opening look like a few giant
 * props separated by empty gaps.
 */
function selectOpeningKinds(
  kindOrder: readonly number[],
  itemCatalog: readonly {
    color: number;
    sizeBand: string;
    silhouette: string;
    lookalikeFamily: string;
  }[],
  rng: () => number,
): number[] {
  if (kindOrder.length <= STREAM_INITIAL_VISIBLE / 3) return [...kindOrder];

  // Challenge levels expose six paired near-match families plus six additional
  // silhouettes. The paired identities share authored geometry and differ
  // mainly in material/icon treatment, while the singletons stop the pile from
  // reading as a handful of cloned props. Every logical identity still arrives
  // as a complete match packet. Family and treatment choice shuffle per run.
  const families = shuffled(kindOrder.filter((kind) => kind < 18), rng);
  // Eight small families, two medium anchors and two large anchors keeps the
  // top-down read dense. The exact families still shuffle per run, so this is
  // a composition guardrail rather than a fixed item order.
  const usedFamilies = new Set<string>();
  const selectedFamilies = [..."ssssssssmmll"].map((size) => {
    const matching = (kind: number) => itemCatalog[kind]!.sizeBand[0] === size;
    const novel = families.findIndex((kind) => matching(kind)
      && !usedFamilies.has(itemCatalog[kind]!.lookalikeFamily));
    const bestIndex = novel < 0 ? families.findIndex(matching) : novel;
    const selected = families.splice(bestIndex, 1)[0]!;
    usedFamilies.add(itemCatalog[selected]!.lookalikeFamily);
    return selected;
  });
  const bucketCounts = new Map<number, number>();
  const selected = selectedFamilies.flatMap((family, index) => (
    chooseOpeningTreatments(
      family,
      index < 6 ? 2 : 1,
      itemCatalog,
      bucketCounts,
      rng,
    )
  ));

  // Identity mix: paired families contribute 12 small kinds; singleton
  // families add 2 small / 2 medium / 2 large. The resulting 14/2/2 kind
  // split gives the 54-body pile 42 small gap-fillers, six medium anchors and
  // only six large pieces.
  return shuffled(selected, rng);
}

/**
 * Keep the three copies of one logical identity from entering as a clump.
 *
 * Random square coordinates frequently put a complete triple side-by-side,
 * especially when a large model owns much of the visible footprint. That
 * makes the pile look sparse and turns a match into a free visual cluster.
 * Distributing each packet across three sectors preserves the physical drop
 * and random run layout while ensuring identical objects start separated.
 */
function spreadOpeningPackets(
  items: readonly ItemInstance[],
  itemCatalog: readonly { sizeBand: string }[],
  rng: () => number,
): ItemInstance[] {
  const half = Math.max(
    2.2,
    ...items.flatMap((item) => [Math.abs(item.px), Math.abs(item.pz)]),
  );
  const byKind = new Map<number, ItemInstance[]>();
  for (const item of items) {
    const group = byKind.get(item.kind) ?? [];
    group.push(item);
    byKind.set(item.kind, group);
  }
  const spread: ItemInstance[] = [];
  for (const [kind, packet] of byKind) {
    const band = itemCatalog[kind]?.sizeBand ?? "small";
    const baseRadius = band === "large"
      ? 0.62
      : band === "medium"
        ? 0.5
        : 0.28 + rng() * 0.34;
    const phase = rng() * Math.PI * 2;
    packet.forEach((item, index) => {
      const angle = phase + index * Math.PI * 2 / packet.length + (rng() - 0.5) * 0.12;
      const radius = half * Math.min(
        0.68,
        Math.max(0.24, baseRadius + (rng() - 0.5) * 0.08),
      );
      spread.push({
        ...item,
        px: Math.cos(angle) * radius,
        pz: Math.sin(angle) * radius,
      });
    });
  }
  return shuffled(spread, rng);
}

/**
 * Turn a full logical level into shuffled complete-triple packets. Keeping the
 * stream packetized prevents a completer from being permanently stranded in
 * the reserve while its pair occupies the visible pile/tray.
 */
export function createItemStream(
  items: readonly ItemInstance[],
  rng: () => number,
  itemCatalog: readonly {
    color: number;
    sizeBand: string;
    silhouette: string;
    modelKind?: number;
    lookalikeFamily: string;
  }[],
): ItemStreamState {
  const byKind = new Map<number, ItemInstance[]>();
  for (const item of items) {
    const group = byKind.get(item.kind) ?? [];
    group.push(item);
    byKind.set(item.kind, group);
  }

  const packetsByKind = new Map<number, ItemInstance[][]>();
  for (const group of byKind.values()) {
    const randomized = shuffled(group, rng);
    const kindPackets: ItemInstance[][] = [];
    for (let i = 0; i < randomized.length; i += 3) {
      kindPackets.push(randomized.slice(i, i + 3));
    }
    packetsByKind.set(randomized[0]!.kind, shuffled(kindPackets, rng));
  }

  const kindOrder = shuffled([...packetsByKind.keys()], rng);
  const initialPacketCount = Math.min(STREAM_INITIAL_VISIBLE / 3, items.length / 3);
  const initialPackets: ItemInstance[][] = [];
  const openingKinds = selectOpeningKinds(kindOrder, itemCatalog, rng);
  // Seed one complete triple per visible kind. L2 owns 48 identities, so 18
  // appear now and thirty genuinely new kinds arrive from the deep reservoir.
  for (const kind of openingKinds) {
    initialPackets.push(packetsByKind.get(kind)!.pop()!);
  }

  // Tutorial and legacy/custom catalogs can own fewer identities than opening
  // packet slots. Add at most one extra packet per kind in randomized order;
  // production challenge levels already filled all eighteen slots above.
  if (initialPackets.length < initialPacketCount) {
    for (const kind of shuffled(kindOrder, rng)) {
      initialPackets.push(packetsByKind.get(kind)!.pop()!);
      if (initialPackets.length >= initialPacketCount) break;
    }
  }
  const initial = spreadOpeningPackets(
    shuffled(initialPackets.flat(), rng),
    itemCatalog,
    rng,
  );
  const orderedPackets = shuffled([...packetsByKind.values()].flat(), rng);
  const reserve: ItemInstance[] = [];
  // Each refill wave contains up to nine complete packets, but the twenty-seven
  // individual items are mixed so matching still requires observation rather
  // than appearing as adjacent freebies.
  for (let i = 0; i < orderedPackets.length; i += STREAM_REFILL_BATCH / 3) {
    reserve.push(...shuffled(orderedPackets.slice(i, i + STREAM_REFILL_BATCH / 3).flat(), rng));
  }
  return {
    active: initial.map((item) => ({ ...item, spawnMode: "drop" })),
    reserve,
  };
}

/**
 * Activate one bottom-up refill wave once the live physics population thins.
 * The returned arrays are new, while the caller retains authoritative control
 * of the private reserve between extracts.
 */
export function refillItemStream(
  active: readonly ItemInstance[],
  reserve: readonly ItemInstance[],
  rng: () => number,
  boxSize: number,
): ItemStreamRefill {
  if (reserve.length === 0 || active.length > STREAM_REFILL_TRIGGER) {
    return { active: [...active], reserve: [...reserve], activated: [] };
  }

  const capacity = Math.max(0, STREAM_VISIBLE_CEILING - active.length);
  const take = Math.min(STREAM_REFILL_BATCH, reserve.length, capacity);
  const half = Math.max(1, boxSize / 2 - 1.25);
  const activated = reserve.slice(0, take).map((item) => {
    // Spawn under the pile, biased toward the central 55% of the pan. Cannon
    // resolves the gentle overlap upward, producing the requested “涌现”
    // instead of another rain-from-the-sky cascade.
    const angle = rng() * Math.PI * 2;
    const radius = half * (0.12 + Math.sqrt(rng()) * 0.43);
    return {
      ...item,
      px: Math.cos(angle) * radius,
      py: 0.58 + rng() * 0.22,
      pz: Math.sin(angle) * radius,
      spawnMode: "reservoir" as const,
    };
  });

  return {
    active: [...active, ...activated],
    reserve: reserve.slice(take),
    activated,
  };
}
