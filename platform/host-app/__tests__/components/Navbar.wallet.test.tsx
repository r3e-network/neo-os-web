import React from "react";
import { render, screen } from "@testing-library/react";

import { Navbar } from "@/components/layout/Navbar";

jest.mock("next/dynamic", () => {
  let callIndex = 0;
  return function dynamic() {
    callIndex += 1;
    if (callIndex === 1) {
      return require("@/components/features/notifications/NotificationDropdown")
        .NotificationDropdown;
    }
    return require("@/components/features/wallet").ConnectButton;
  };
});

jest.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
    query: {},
    push: jest.fn(),
  }),
}));

jest.mock("@/lib/i18n/react", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/features/notifications/NotificationDropdown", () => ({
  NotificationDropdown: ({ walletAddress }: { walletAddress?: string }) => (
    <div data-testid="notifications" data-wallet={walletAddress || ""} />
  ),
}));

jest.mock("@/components/features/wallet", () => ({
  ConnectButton: () => <div data-testid="connect-button" />,
}));

jest.mock("@/lib/wallet/store", () => ({
  selectConnectedWalletAddress: (state: { connected: boolean; address: string }) =>
    state.connected && state.address ? state.address : "",
  useWalletStore: jest.fn(),
}));

const { useWalletStore } = jest.requireMock("@/lib/wallet/store") as {
  useWalletStore: jest.Mock;
};

describe("Navbar wallet address propagation", () => {
  afterEach(() => {
    useWalletStore.mockReset();
  });

  it("does not pass restore-pending saved addresses to notifications", () => {
    useWalletStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        connected: false,
        address: "NRestorePendingWalletAddress",
        restorePending: true,
      }),
    );

    render(<Navbar />);

    expect(screen.getByTestId("notifications")).toHaveAttribute("data-wallet", "");
  });

  it("passes only the actively connected wallet address to notifications", () => {
    useWalletStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ connected: true, address: "NConnectedWalletAddress" }),
    );

    render(<Navbar />);

    expect(screen.getByTestId("notifications")).toHaveAttribute(
      "data-wallet",
      "NConnectedWalletAddress",
    );
  });
});
