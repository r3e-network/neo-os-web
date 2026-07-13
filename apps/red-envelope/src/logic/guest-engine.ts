/**
 * Guest (free / local) engine for Red Envelope — a purely LOCAL packet game.
 *
 * Guest mode turns the red envelope into a stakes-free single-player game: the
 * player creates a bundle of packets (a total split into N random shares rolled
 * with the Web-Crypto RNG — the local analog of the on-chain random split), then
 * opens the packets one by one to reveal a random amount each time and rack up a
 * "luck" score. The engine drives the SAME observables the frozen Phaser scene
 * reads (envelopes / pools / claims / openingId / luckyMessage / isLoading /
 * lastCreatedEnvelopeId) so the scene reacts identically to the gamefi flow — no
 * scene changes needed.
 *
 * It NEVER makes a chain, oracle, or reward call: no app.chain / app.oracle /
 * app.funds / app.game.reward. The random split runs entirely on-device. The
 * running luck score is best-effort submitted to the OFF-CHAIN guest leaderboard
 * (app.mode.guestLeaderboard) and read back for a local board. The framework
 * guest guard therefore never fires in normal guest play.
 */
import { gasToBaseUnits } from "@shared/utils/amounts";
import { fromFixed8 } from "@shared/utils/format";
import type { EnvelopeItem, ClaimItem } from "../composables/useRedEnvelope";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";

/** One row of the local (off-chain) luck board. */
export interface GuestBoardRow {
  user: string;
  score: number;
}

/** Form shape the create action carries (all strings from the scene). */
export interface GuestCreateForm {
  amount?: string;
  count?: string;
  expiryHours?: string;
}

export interface GuestEngineDeps {
  // Scene-facing observables (same keys the gamefi flow drives).
  envelopes: Obs<EnvelopeItem[]>;
  pools: Obs<EnvelopeItem[]>;
  claims: Obs<ClaimItem[]>;
  isLoading: Obs<boolean>;
  luckyMessage: Obs<{ amount: number; from: string } | null>;
  openingId: Obs<string | null>;
  prepaidCredit: Obs<number>;
  lastCreatedEnvelopeId: Obs<string>;
  // Guest-only stat observables surfaced to the PlayArea.
  guestBest: Obs<number>;
  guestTotal: Obs<number>;
  guestOpened: Obs<number>;
  guestBoard: Obs<GuestBoardRow[]>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  /** Create a local envelope: split `amount` into `count` random packets. */
  createEnvelope(form: GuestCreateForm): void;
  /** Open one random packet from a local envelope and reveal the amount. */
  claimEnvelope(envelopeId: string): void;
  /** Clear a local envelope (guest analog of reclaim — no chain). */
  reclaimEnvelope(envelopeId: string): void;
  /** Guest has no prepaid credit — surface a local notice. */
  withdrawCredit(): void;
  /** Guest envelopes are local-only — no share link exists. */
  shareEnvelope(envelopeId: string): void;
  /** Reload the off-chain guest board into the guest board observable. */
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby, seed a starter envelope + load the board. */
  enter(): Promise<void>;
  /** Cancel pending local work when leaving guest mode. */
  leave(): void;
  /** Release timers and prevent post-unmount observable writes. */
  destroy(): void;
}

/** 0.01 GAS in base units — the contract's per-packet minimum, mirrored here. */
const MIN_PER_PACKET_BASE = 1_000_000n;
const MAX_PACKETS = 100;
/** A short local latency so the busy / opening states render like the round-trip. */
const LOCAL_LATENCY_MS = 320;
/** Board scores are stored as centi-GAS integers to keep the board clean. */
const SCORE_SCALE = 100;
/** Starter local envelope seeded on entering guest so claim mode is playable. */
const STARTER_TOTAL_GAS = 1;
const STARTER_PACKETS = 8;

/** Uniform random bigint in [0, maxExclusive) via Web-Crypto with rejection. */
function randomBigInt(maxExclusive: bigint): bigint {
  if (maxExclusive <= 1n) return 0n;
  const bits = maxExclusive.toString(2).length;
  const byteLength = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;
  const buffer = new Uint8Array(byteLength);
  const webCrypto = globalThis.crypto;
  const fill = (): void => {
    if (webCrypto?.getRandomValues) {
      webCrypto.getRandomValues(buffer);
    } else {
      for (let i = 0; i < byteLength; i += 1) buffer[i] = Math.floor(Math.random() * 256);
    }
  };
  for (let attempt = 0; attempt < 32; attempt += 1) {
    fill();
    let value = 0n;
    for (const byte of buffer) value = (value << 8n) | BigInt(byte);
    value &= mask;
    if (value < maxExclusive) return value;
  }
  // Extremely unlikely fallback — biased but bounded, never a hard failure.
  let value = 0n;
  for (const byte of buffer) value = (value << 8n) | BigInt(byte);
  return value % maxExclusive;
}

/**
 * Split `totalBase` (base units) into `count` random packets, each at least
 * MIN_PER_PACKET_BASE, summing exactly to the total — the same "leave a minimum
 * for every remaining packet" scheme the on-chain contract uses, but rolled
 * locally with the Web-Crypto RNG. Result order is already shuffled by the draw.
 */
function splitPackets(totalBase: bigint, count: number): bigint[] {
  const packets: bigint[] = [];
  let remaining = totalBase;
  for (let i = 0; i < count - 1; i += 1) {
    const packetsLeft = BigInt(count - i);
    const maxForThis = remaining - (packetsLeft - 1n) * MIN_PER_PACKET_BASE;
    const range = maxForThis - MIN_PER_PACKET_BASE;
    let amount = MIN_PER_PACKET_BASE;
    if (range > 0n) amount = MIN_PER_PACKET_BASE + randomBigInt(range + 1n);
    packets.push(amount);
    remaining -= amount;
  }
  packets.push(remaining);
  return packets;
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    envelopes,
    pools,
    claims,
    isLoading,
    luckyMessage,
    openingId,
    prepaidCredit,
    lastCreatedEnvelopeId,
    guestBest,
    guestTotal,
    guestOpened,
    guestBoard,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Remaining packet amounts (base units) per local envelope id — the source of
  // truth an open draws from, kept off the observable to avoid float drift.
  const packetsById = new Map<string, bigint[]>();
  let sequence = 0;
  let generation = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const cancelScheduled = (): void => {
    generation += 1;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    isLoading.set(false);
    openingId.set(null);
  };

  const schedule = (callback: () => void): void => {
    const scheduledGeneration = generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (scheduledGeneration !== generation) return;
      callback();
    }, LOCAL_LATENCY_MS);
    timers.add(timer);
  };

  const toBase = (gas: number): bigint => gasToBaseUnits(String(gas));
  const round4 = (value: number): number => Math.round(value * 10000) / 10000;

  const nextId = (): string => {
    sequence += 1;
    return `guest-${sequence}`;
  };

  const syncPools = (list: EnvelopeItem[]): void => {
    pools.set(list.filter((item) => item.active && item.canOpen));
  };

  const buildEnvelope = (id: string, totalBase: bigint, packets: bigint[]): EnvelopeItem => {
    const remainingBase = packets.reduce((sum, packet) => sum + packet, 0n);
    return {
      id,
      type: "lucky",
      creator: "local",
      from: t("guestLocalSender"),
      totalAmount: fromFixed8(totalBase),
      packetCount: packets.length,
      openedCount: 0,
      remainingAmount: fromFixed8(remainingBase),
      remainingPackets: packets.length,
      minNeoRequired: 0,
      minHoldSeconds: 0,
      active: true,
      expired: false,
      depleted: false,
      canOpen: true,
      reclaimable: false,
      currentHolder: "local",
      ready: true,
      bestLuckAddress: "",
      bestLuckAmount: 0,
      message: "",
      expiryTime: 0,
      parentEnvelopeId: "",
    };
  };

  const submitScore = async (score: number): Promise<void> => {
    if (!(score > 0)) return;
    try {
      await guestLeaderboard.submit(Math.round(score * SCORE_SCALE));
    } catch {
      /* wallet optional / board unreachable — guest scores are best-effort */
    }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    const requestedGeneration = generation;
    try {
      const rows = await guestLeaderboard.get(50);
      if (requestedGeneration !== generation) return;
      const board: GuestBoardRow[] = rows
        .map((row) => ({ user: row.user, score: (Number(row.score) || 0) / SCORE_SCALE }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      guestBoard.set(board);
    } catch {
      if (requestedGeneration !== generation) return;
      guestBoard.set([]);
    }
  };

  const seedEnvelope = (totalGas: number, count: number): EnvelopeItem => {
    const id = nextId();
    const packets = splitPackets(toBase(totalGas), count);
    packetsById.set(id, packets);
    return buildEnvelope(id, toBase(totalGas), packets);
  };

  return {
    createEnvelope(form: GuestCreateForm): void {
      if (isLoading.get() || openingId.get()) {
        setStatus(t("operationBusy"), "info");
        return;
      }
      const amount = Number(form.amount ?? "");
      const count = Math.max(1, Math.min(MAX_PACKETS, Math.floor(Number(form.count ?? "1")) || 1));
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus(t("invalidAmount"), "error");
        return;
      }
      const totalBase = toBase(amount);
      if (totalBase < BigInt(count) * MIN_PER_PACKET_BASE) {
        setStatus(t("invalidPerPacket"), "error");
        return;
      }
      isLoading.set(true);
      lastCreatedEnvelopeId.set("");
      luckyMessage.set(null);
      schedule(() => {
        const id = nextId();
        const packets = splitPackets(totalBase, count);
        packetsById.set(id, packets);
        const envelope = buildEnvelope(id, totalBase, packets);
        const list = [envelope, ...envelopes.get()];
        envelopes.set(list);
        syncPools(list);
        lastCreatedEnvelopeId.set(id);
        isLoading.set(false);
        setStatus(t("guestEnvelopeReady", { count }), "success");
      });
    },

    claimEnvelope(envelopeId: string): void {
      if (openingId.get() || isLoading.get()) {
        setStatus(t("operationBusy"), "info");
        return;
      }
      const id = String(envelopeId ?? "").trim();
      const list = envelopes.get();
      const envelope = list.find((item) => item.id === id && item.canOpen);
      const packets = packetsById.get(id);
      if (!envelope || !packets || packets.length === 0) {
        setStatus(t("guestNoEnvelope"), "info");
        return;
      }
      openingId.set(id);
      luckyMessage.set(null);
      schedule(() => {
        const drawIndex = Number(randomBigInt(BigInt(packets.length)));
        const [drawnBase] = packets.splice(drawIndex, 1);
        const amount = round4(fromFixed8(drawnBase ?? 0n));
        const remainingBase = packets.reduce((sum, packet) => sum + packet, 0n);
        const remainingPackets = packets.length;
        const depleted = remainingPackets <= 0;
        const updated: EnvelopeItem = {
          ...envelope,
          openedCount: envelope.packetCount - remainingPackets,
          remainingPackets,
          remainingAmount: fromFixed8(remainingBase),
          depleted,
          active: !depleted,
          canOpen: !depleted,
          ready: !depleted,
          bestLuckAmount: Math.max(envelope.bestLuckAmount ?? 0, amount),
        };
        const nextList = list.map((item) => (item.id === id ? updated : item));
        envelopes.set(nextList);
        syncPools(nextList);

        const opened = guestOpened.get() + 1;
        const total = round4(guestTotal.get() + amount);
        guestOpened.set(opened);
        guestTotal.set(total);
        if (amount > guestBest.get()) guestBest.set(amount);

        const claim: ClaimItem = {
          id: `${id}:local:${opened}`,
          poolId: id,
          holder: t("guestLocalSender"),
          amount,
          opened: true,
          message: "",
        };
        claims.set([claim, ...claims.get()]);

        luckyMessage.set({ amount: Number(amount.toFixed(4)), from: `#${id}` });
        openingId.set(null);
        setStatus(t("guestGrabbed", { amount: amount.toFixed(4) }), "success");

        void (async () => {
          await submitScore(total);
          await refreshLeaderboard();
        })();
      });
    },

    reclaimEnvelope(envelopeId: string): void {
      if (openingId.get() || isLoading.get()) {
        setStatus(t("operationBusy"), "info");
        return;
      }
      const id = String(envelopeId ?? "").trim();
      if (!id) return;
      packetsById.delete(id);
      const next = envelopes.get().filter((item) => item.id !== id);
      envelopes.set(next);
      syncPools(next);
      if (lastCreatedEnvelopeId.get() === id) lastCreatedEnvelopeId.set("");
      setStatus(t("guestReclaimed"), "info");
    },

    withdrawCredit(): void {
      setStatus(t("guestNoCredit"), "info");
    },

    shareEnvelope(_envelopeId: string): void {
      setStatus(t("guestShareLocal"), "info");
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      cancelScheduled();
      packetsById.clear();
      sequence = 0;
      isLoading.set(false);
      openingId.set(null);
      luckyMessage.set(null);
      lastCreatedEnvelopeId.set("");
      // Zero every on-chain-only surface so a prior gamefi mount-time read never
      // bleeds into the guest view.
      prepaidCredit.set(0);
      guestBest.set(0);
      guestTotal.set(0);
      guestOpened.set(0);
      claims.set([]);
      // Seed one starter local envelope so the default claim panel is instantly
      // playable — the player can open its packets right away.
      const starter = seedEnvelope(STARTER_TOTAL_GAS, STARTER_PACKETS);
      envelopes.set([starter]);
      syncPools([starter]);
      await refreshLeaderboard();
    },

    leave(): void {
      cancelScheduled();
      luckyMessage.set(null);
    },

    destroy(): void {
      cancelScheduled();
      packetsById.clear();
    },
  };
}
