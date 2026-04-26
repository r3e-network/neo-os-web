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
  useWalletStore: jest.fn(),
}));

const { useWalletStore } = jest.requireMock("../../lib/wallet/store") as {
  useWalletStore: jest.Mock;
};

describe("LeaderboardPageClient", () => {
  it("passes the connected wallet address to the leaderboard widget", () => {
    useWalletStore.mockReturnValue({ address: "Nf8TestWalletAddress" });

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-wallet",
      "Nf8TestWalletAddress",
    );
  });

  it("renders safely when no wallet is connected", () => {
    useWalletStore.mockReturnValue({ address: "" });

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-wallet",
      "",
    );
  });
});
