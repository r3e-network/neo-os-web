import React from "react";
import { render, screen } from "@testing-library/react";

import { LeaderboardPageClient } from "../../components/pages/LeaderboardPageClient";

jest.mock("../../components/features/gamification", () => ({
  Leaderboard: ({ currentWallet }: { currentWallet?: string }) => (
    <div data-testid="leaderboard" data-wallet={currentWallet || ""}>
      leaderboard
    </div>
  ),
}));

jest.mock("../../lib/wallet/store", () => ({
  selectConnectedWalletAddress: (state: { connected: boolean; address: string }) =>
    state.connected && state.address ? state.address : "",
  useWalletStore: jest.fn(),
}));

const { useWalletStore } = jest.requireMock("../../lib/wallet/store") as {
  useWalletStore: jest.Mock;
};

describe("LeaderboardPageClient", () => {
  it("passes the connected wallet address to the leaderboard widget", () => {
    useWalletStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ connected: true, address: "Nf8TestWalletAddress" }),
    );

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-wallet",
      "Nf8TestWalletAddress",
    );
  });

  it("renders safely when no wallet is connected", () => {
    useWalletStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ connected: false, address: "" }),
    );

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-wallet",
      "",
    );
  });

  it("does not pass a saved restore-pending address as the active wallet", () => {
    useWalletStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        connected: false,
        address: "NRestorePendingWalletAddress",
        restorePending: true,
      }),
    );

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-wallet",
      "",
    );
  });
});
