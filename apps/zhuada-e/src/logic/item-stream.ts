import type { ItemInstance } from "./engine-zhuada";

/** Initial live physics population. The rest stays in a cheap logical reserve. */
export const STREAM_INITIAL_VISIBLE = 48;
/** Refill after the player has excavated roughly two triples. */
export const STREAM_REFILL_TRIGGER = 42;
/** Three complete triples arrive together as one readable bottom-up wave. */
export const STREAM_REFILL_BATCH = 9;
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

/**
 * Turn a full logical level into shuffled complete-triple packets. Keeping the
 * stream packetized prevents a completer from being permanently stranded in
 * the reserve while its pair occupies the visible pile/tray.
 */
export function createItemStream(items: readonly ItemInstance[], rng: () => number): ItemStreamState {
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
      const packet = randomized.slice(i, i + 3);
      // `generateItems` guarantees multiples of three. Keep this defensive so
      // malformed dev input is still visible rather than silently discarded.
      if (packet.length > 0) kindPackets.push(packet);
    }
    if (kindPackets.length > 0) packetsByKind.set(randomized[0]!.kind, shuffled(kindPackets, rng));
  }

  const kindOrder = shuffled([...packetsByKind.keys()], rng);
  const packetTotal = [...packetsByKind.values()].reduce((sum, packets) => sum + packets.length, 0);
  const initialPacketCount = Math.min(STREAM_INITIAL_VISIBLE / 3, packetTotal);
  const initialPackets: ItemInstance[][] = [];
  // Seed the visible pile with one triple from every selected kind, then add
  // extra packets in randomized round-robin passes. This guarantees the rich
  // 10–12-type opening the reference establishes and prevents one boxy model
  // from dominating a random seed.
  while (initialPackets.length < initialPacketCount) {
    const eligible = shuffled(kindOrder.filter((kind) => (packetsByKind.get(kind)?.length ?? 0) > 0), rng);
    if (eligible.length === 0) break;
    for (const kind of eligible) {
      const packet = packetsByKind.get(kind)?.pop();
      if (packet) initialPackets.push(packet);
      if (initialPackets.length >= initialPacketCount) break;
    }
  }
  const initial = shuffled(initialPackets.flat(), rng);
  const orderedPackets = shuffled([...packetsByKind.values()].flat(), rng);
  const reserve: ItemInstance[] = [];
  // Each refill wave contains up to three complete packets, but the nine
  // individual items are mixed so matching still requires observation rather
  // than appearing as three adjacent freebies.
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
