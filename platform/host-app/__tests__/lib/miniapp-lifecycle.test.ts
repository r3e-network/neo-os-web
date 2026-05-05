import type { MiniAppInfo } from "@/components/types";
import {
  buildCountdownLifecycleInvoke,
  classifyCountdownLifecycle,
  findCountdownLifecycleApps,
} from "@/lib/miniapp-lifecycle";

const countdownApp = {
  app_id: "miniapp-countdown-a",
  name: "Countdown A",
  description: "Countdown game",
  icon: "timer",
  category: "gaming",
  entry_url: "mf://manifest?app=miniapp-countdown-a",
  permissions: {},
  manifest: {
    runtime: {
      mode: "platform",
      modules: [
        {
          binding: "countdown-auction",
          platform: "PlatformGame",
          appId: "miniapp-countdown-a",
          moduleType: 1,
          networks: {
            "neo-n3-testnet": {
              contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
              registered: true,
            },
          },
          operations: {
            buy_keys: "buyCountdownKeys",
            rollover: "checkAndEndCountdownRound",
            status: "getCountdownStatus",
          },
        },
      ],
    },
  },
} satisfies MiniAppInfo;

const coinFlipApp = {
  ...countdownApp,
  app_id: "miniapp-coinflip",
  manifest: {
    runtime: {
      mode: "platform",
      modules: [
        {
          binding: "coin-flip",
          platform: "PlatformGame",
          appId: "miniapp-coinflip",
          moduleType: 2,
          networks: {
            "neo-n3-testnet": {
              contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
              registered: true,
            },
          },
        },
      ],
    },
  },
} satisfies MiniAppInfo;

describe("miniapp lifecycle automation", () => {
  it("discovers every registered countdown-auction runtime for a network", () => {
    expect(findCountdownLifecycleApps([countdownApp, coinFlipApp], "testnet")).toEqual([
      {
        appId: "miniapp-countdown-a",
        contractHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
        network: "testnet",
        statusMethod: "getCountdownStatus",
        maintenanceMethod: "checkAndEndCountdownRound",
      },
    ]);
  });

  it.each([
    [{ roundId: 0, active: false }, "start_needed"],
    [{ roundId: 7, active: true, status: "ending", remainingTime: 0 }, "rollover_needed"],
    [{ roundId: 7, active: false, settled: true }, "rollover_needed"],
    [{ roundId: 7, active: true, status: "active", remainingTime: 42 }, "healthy"],
  ] as const)("classifies countdown state %j as %s", (state, expected) => {
    expect(classifyCountdownLifecycle(state).action).toBe(expected);
  });

  it("builds the generic PlatformGame lifecycle invoke for countdown games", () => {
    expect(buildCountdownLifecycleInvoke(findCountdownLifecycleApps([countdownApp], "testnet")[0])).toEqual({
      scriptHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
      operation: "checkAndEndCountdownRound",
      args: [{ type: "String", value: "miniapp-countdown-a" }],
    });
  });
});
