import { describe, expect, it, vi } from "vitest";

import { useLastSurvivor } from "../../last-survivor/src/composables/useLastSurvivor";
import type { BadgeProxy } from "../services/os/BadgeProxy";
import type { GameProxy } from "../services/os/GameProxy";
import type { LeaderboardProxy } from "../services/os/LeaderboardProxy";
import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { StorageProxy } from "../services/os/StorageProxy";

function t(key: string) {
  const messages: Record<string, string> = {
    activeRound: "Active",
    inactiveRound: "Rollover ready",
    keyPurchaseUnavailable:
      "Key purchase services are not configured in this environment yet.",
    notAvailable: "Unavailable",
    roundStateUnavailable:
      "The countdown service is not available in this environment yet.",
    tokenGas: "GAS",
  };
  return messages[key] ?? key;
}

function services(overrides: {
  game?: Partial<GameProxy>;
  payment?: Partial<PaymentProxy>;
  storage?: Partial<StorageProxy>;
  leaderboard?: Partial<LeaderboardProxy>;
  badge?: Partial<BadgeProxy>;
} = {}) {
  return {
    gameService: {
      getPoolState: vi.fn(async () => ({
        poolId: "current",
        appId: "miniapp-last-survivor",
        status: "open",
        playerCount: 1,
        totalBets: "2",
        roundId: 4,
        active: true,
        lastBuyer: "",
        totalKeys: 3,
        remainingTime: 3600,
      })),
      placeBet: vi.fn(),
      ...overrides.game,
    } as unknown as GameProxy,
    paymentService: {
      deposit: vi.fn(),
      ...overrides.payment,
    } as unknown as PaymentProxy,
    storageService: {
      get: vi.fn(async () => "0"),
      list: vi.fn(async () => ({})),
      ...overrides.storage,
    } as unknown as StorageProxy,
    leaderboardService: {
      get: vi.fn(async () => []),
      ...overrides.leaderboard,
    } as unknown as LeaderboardProxy,
    badgeService: {
      award: vi.fn(async () => undefined),
      ...overrides.badge,
    } as unknown as BadgeProxy,
  };
}

describe("useLastSurvivor", () => {
  it("keeps the game workspace usable when round state service is unavailable", async () => {
    const app = useLastSurvivor({
      ...services({
        game: {
          getPoolState: vi.fn(async () => {
            throw new Error("OS service error (os-game-status): Not Found");
          }),
        },
      }),
      t,
    });

    await expect(app.loadAll()).resolves.toBeUndefined();
    expect(app.roundDataAvailable.get()).toBe(false);
    expect(app.isRoundActive.get()).toBe(false);
    expect(app.serviceNotice.get()).toBe(
      "The countdown service is not available in this environment yet.",
    );
    expect(app.history.get()).toEqual([]);
  });

  it("treats an open round as buyable and clears service notices", async () => {
    const app = useLastSurvivor({ ...services(), t });

    await app.loadAll();

    expect(app.roundDataAvailable.get()).toBe(true);
    expect(app.isRoundActive.get()).toBe(true);
    expect(app.serviceNotice.get()).toBe("");
    expect(app.roundStatusDisplay.get()).toBe("Active");
  });

  it("normalizes payment boundary failures during key purchase", async () => {
    const app = useLastSurvivor({
      ...services({
        payment: {
          deposit: vi.fn(async () => {
            throw new Error("OS service error (os-payment-deposit): Not Found");
          }),
        },
      }),
      t,
    });

    app.roundDataAvailable.set(true);
    app.isRoundActive.set(true);
    app.roundId.set(4);

    await expect(app.buyKeys("1")).rejects.toThrow(
      "Key purchase services are not configured in this environment yet.",
    );
  });
});
