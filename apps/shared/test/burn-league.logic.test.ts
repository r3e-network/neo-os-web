import { describe, expect, it, vi } from "vitest";

import { useBurnLeague } from "../../burn-league/src/composables/useBurnLeague";
import type { BadgeProxy } from "../services/os/BadgeProxy";
import type { GameProxy } from "../services/os/GameProxy";
import type { LeaderboardProxy } from "../services/os/LeaderboardProxy";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    burnActionUnavailable:
      "Burn submission services are not configured in this environment yet.",
    burnServiceUnavailable:
      "Live burn stats are not available in this environment yet.",
    burnPreparing: `Preparing a ${params?.amount ?? ""} burn wallet confirmation.`,
    burnSubmitted: "Burn entry submitted. Refreshing the leaderboard state.",
    maxBurn: `Maximum burn is ${params?.amount ?? ""} ${params?.tokenGas ?? ""}`,
    minBurn: `Minimum burn is ${params?.amount ?? ""} ${params?.tokenGas ?? ""}`,
    tokenGas: "GAS",
  };
  return messages[key] ?? key;
}

function services(overrides: {
  game?: Partial<GameProxy>;
  leaderboard?: Partial<LeaderboardProxy>;
  badge?: Partial<BadgeProxy>;
} = {}) {
  return {
    gameService: {
      getPoolState: vi.fn(async () => ({
        poolId: "burn-league",
        appId: "miniapp-burn-league",
        status: "open",
        playerCount: 2,
        totalBets: "12",
        totalBurned: 12,
        rewardPool: 1.2,
        userBurned: 3,
        burnCount: 2,
      })),
      placeBet: vi.fn(),
      ...overrides.game,
    } as unknown as GameProxy,
    leaderboardService: {
      get: vi.fn(async () => [{ user: "NMockBurner", score: "12" }]),
      submitScore: vi.fn(),
      ...overrides.leaderboard,
    } as unknown as LeaderboardProxy,
    badgeService: {
      award: vi.fn(async () => undefined),
      updateStat: vi.fn(async () => undefined),
      ...overrides.badge,
    } as unknown as BadgeProxy,
  };
}

describe("useBurnLeague", () => {
  it("keeps the burn desk usable when live stats are unavailable", async () => {
    const app = useBurnLeague({
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
    expect(app.leagueDataAvailable.get()).toBe(false);
    expect(app.serviceNotice.get()).toBe(
      "Live burn stats are not available in this environment yet.",
    );
    expect(app.leaderboardPreview.get()).toEqual([
      { address: "NMockBurner", burned: 12, isUser: false, rank: 1 },
    ]);
  });

  it("submits burn entries through the OS game service", async () => {
    const mocks = services();
    const app = useBurnLeague({ ...mocks, t });

    await app.loadAll();
    await app.burnTokens("5");

    expect(mocks.gameService.placeBet).toHaveBeenCalledWith("burn-league", "5");
    expect(mocks.leaderboardService.submitScore).toHaveBeenCalledWith("5");
    expect(app.lastSubmittedAmount.get()).toBe("5.00 GAS");
    expect(app.actionNotice.get()).toBe(
      "Burn entry submitted. Refreshing the leaderboard state.",
    );
  });

  it("surfaces wallet-intent progress while burn submission is pending", async () => {
    let resolveBet: (() => void) | undefined;
    const app = useBurnLeague({
      ...services({
        game: {
          placeBet: vi.fn(
            () => new Promise<void>((resolve) => {
              resolveBet = resolve;
            }),
          ),
        },
      }),
      t,
    });

    const pending = app.burnTokens("5");
    expect(app.isBurning.get()).toBe(true);
    expect(app.actionNotice.get()).toBe(
      "Preparing a 5.00 GAS burn wallet confirmation.",
    );

    resolveBet?.();
    await pending;
  });

  it("normalizes burn submission boundary errors", async () => {
    const app = useBurnLeague({
      ...services({
        game: {
          placeBet: vi.fn(async () => {
            throw new Error("OS service error (os-game-bet): Not Found");
          }),
        },
      }),
      t,
    });

    await expect(app.burnTokens("2")).rejects.toThrow(
      "Burn submission services are not configured in this environment yet.",
    );
    expect(app.actionNotice.get()).toBe(
      "Burn submission services are not configured in this environment yet.",
    );
  });
});
