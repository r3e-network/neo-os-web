import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { GenericPlayArea } from "../../components/playarea/PlayAreaFallbacks";
import { LastSurvivorPlayArea } from "../../components/playarea/PlayAreaCoreFlows";
import type { MiniAppInfo } from "../../components/types";

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: {
    getState: () => ({
      connected: false,
      address: "",
      accountHash: "",
      network: null,
    }),
    subscribe: jest.fn(() => () => {}),
  },
  getWalletAdapter: () => null,
}));

const baseApp: MiniAppInfo = {
  app_id: "miniapp-demo",
  name: "Demo App",
  description: "Demo description",
  icon: "D",
  category: "gaming",
  entry_url: "/miniapps/demo/index.html",
  permissions: { payments: true },
};

const baseProps = {
  stats: [],
  statsMap: {},
  activity: null,
  loading: false,
  error: null,
  contractHash: "0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b",
  network: "testnet" as const,
  launchContext: null,
  onRefresh: jest.fn(),
};

describe("GenericPlayArea focus mode", () => {
  it("keeps the live iframe as the only top-level surface and folds the wiring rows away", () => {
    render(<GenericPlayArea app={baseApp} {...baseProps} />);

    expect(
      screen.getByTestId("generic-dapp-frame-miniapp-demo"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Focus workspace")).not.toBeInTheDocument();

    // The meta-commentary rows still exist for diagnostics, but inside the
    // collapsed "Activity and details" drawer rather than as page filler.
    const primaryTask = screen.getByText("Primary task");
    const drawer = primaryTask.closest("details");
    expect(drawer).not.toBeNull();
    expect(drawer).not.toHaveAttribute("open");
    expect(drawer).toHaveTextContent("Activity and details");
    expect(screen.getByText("Network scope").closest("details")).toBe(drawer);
  });
});

describe("LastSurvivorPlayArea rollover banner", () => {
  it("renders the rollover explanation as visible text instead of a title tooltip", () => {
    render(
      <LastSurvivorPlayArea
        app={{ ...baseApp, app_id: "miniapp-last-survivor" }}
        {...baseProps}
        statsMap={{ Status: "Next Round Pending", Countdown: "Rollover Ready" }}
      />,
    );

    const banner = screen.getByTestId("last-survivor-rollover-banner");
    expect(banner).toHaveTextContent("Next round is ready to start");
    expect(banner).toHaveTextContent(
      "The lifecycle keeper settles expired rounds automatically",
    );
    expect(banner).not.toHaveAttribute("title");
  });

  it("explains the legacy mainnet deployment visibly with the long form behind a toggle", () => {
    render(
      <LastSurvivorPlayArea
        app={{ ...baseApp, app_id: "miniapp-last-survivor" }}
        {...baseProps}
        network="mainnet"
        statsMap={{ Status: "Next Round Pending", Countdown: "Rollover Ready" }}
      />,
    );

    const banner = screen.getByTestId("last-survivor-rollover-banner");
    expect(banner).toHaveTextContent(
      "needs a one-time contract update or admin restart",
    );
    expect(banner).toHaveTextContent("More about the legacy deployment");
  });
});
