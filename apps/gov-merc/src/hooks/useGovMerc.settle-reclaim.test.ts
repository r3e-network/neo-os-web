import { describe, expect, it, vi } from "vitest";

import { useGovMerc } from "./useGovMerc";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
// settlementWinner returns the winner as a Hash160 in chain (LE 0x) byte order —
// exactly addressToScriptHash(address). The winner-exclusion guard must match
// this against the base58 wallet address (it previously string-compared and
// never matched, leaving the winner a phantom "reclaimable" row).
const ALICE_HASH = addressToScriptHash(ALICE);

const t = (key: string) => key;

interface Fixture {
  /** highestBid(currentEpoch) value in base units. */
  highestBid?: string;
  /** When set, settlementWinner(prevEpoch) returns this winner hash. */
  prevWinner?: string;
  /** bidOf(prevEpoch, alice) value. */
  aliceBid?: string;
}

function makeChain(f: Fixture) {
  const listEvents = vi.fn(async (): Promise<unknown[]> => []); // events feed degraded/empty

  const read = vi.fn(async (op: string, args?: ContractArg[]): Promise<unknown> => {
    switch (op) {
      case "totalStaked":
        return "100";
      case "currentEpoch":
        return "5";
      case "epochDeadline":
        return "0";
      case "epochDuration":
        return "300000";
      case "highestBid":
        return f.highestBid ?? "0";
      case "stakeOf":
        return "10";
      case "pendingRewards":
        return "0";
      case "gasCreditOf":
        return "0";
      case "settlementWinner": {
        // The reclaim scan walks prior epochs; only the matched prev epoch wins.
        return f.prevWinner ?? "0x0000000000000000000000000000000000000000";
      }
      case "settlementAmount":
        return "0";
      case "bidOf": {
        // alice bid on the prev epoch (epoch 4) when aliceBid is set.
        const epoch = (args?.[0] as { value?: string } | undefined)?.value;
        return epoch === "4" ? (f.aliceBid ?? "0") : "0";
      }
      default:
        return "0";
    }
  });

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke: vi.fn(async (): Promise<TxResult> => ({ txid: "0xtx", success: true })),
    read,
    listEvents,
  } as unknown as ChainService;
  return { chain };
}

/** Wrap a mock chain in the MiniApp framework the hook now takes. */
function makeApp(chain: ChainService) {
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-gov-merc" },
  );
  return useGovMerc({ app: framework, t });
}

describe("useGovMerc — settle gate reads highestBid, not only events", () => {
  it("reports a live bid from highestBid even when the events feed is empty", async () => {
    const { chain } = makeChain({ highestBid: "500000000" }); // 5 GAS
    const app = makeApp(chain);
    app.setAddress(ALICE);
    await app.loadData();

    // The event-derived leaderboard is empty (listEvents returns []), but the
    // contract read proves the epoch is settleable.
    expect(app.bids.get().length).toBe(0);
    expect(app.hasLiveBid.get()).toBe(true);
    // The top bid is surfaced as whole GAS (÷1e8) for the "Current top bid" stat.
    expect(app.highestBid.get()).toBe(5);
  });

  it("reports no live bid when highestBid is zero", async () => {
    const { chain } = makeChain({ highestBid: "0" });
    const app = makeApp(chain);
    app.setAddress(ALICE);
    await app.loadData();
    expect(app.hasLiveBid.get()).toBe(false);
    expect(app.highestBid.get()).toBe(0);
  });
});

describe("useGovMerc — winner-exclusion guard matches the LE hash winner", () => {
  it("excludes the connected wallet from reclaimables when it won (hash == its address)", async () => {
    // Alice bid on epoch 4 AND won it (settlementWinner returns her LE hash).
    const { chain } = makeChain({ prevWinner: ALICE_HASH, aliceBid: "300000000" });
    const app = makeApp(chain);
    app.setAddress(ALICE);
    await app.loadData();

    // The winner cannot reclaim — the row must be excluded (previously a phantom
    // reclaimable that reverted on-chain with "winner cannot reclaim").
    expect(app.reclaimableBids.get().some((b) => b.epoch === 4)).toBe(false);
  });

  it("keeps a genuine losing bid reclaimable", async () => {
    const otherWinner = addressToScriptHash("NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP");
    const { chain } = makeChain({ prevWinner: otherWinner, aliceBid: "300000000" });
    const app = makeApp(chain);
    app.setAddress(ALICE);
    await app.loadData();

    // Alice lost epoch 4 but bid — her bid is reclaimable.
    expect(app.reclaimableBids.get().some((b) => b.epoch === 4)).toBe(true);
  });
});
