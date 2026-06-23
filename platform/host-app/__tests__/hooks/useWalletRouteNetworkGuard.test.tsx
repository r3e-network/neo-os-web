import React from "react";
import { render, waitFor } from "@testing-library/react";

import { useWalletRouteNetworkGuard } from "@/hooks/useWalletRouteNetworkGuard";
import { useWalletStore } from "@/lib/wallet/store";

type ProviderListener = () => void;

function makeProvider() {
  return {
    network: 894710606,
    getAccounts: jest.fn(),
    getBalance: jest.fn(async () => ({ amount: "1" })),
    authenticate: jest.fn(),
    signMessage: jest.fn(),
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn((_event: string, _listener: ProviderListener) => {}),
    removeListener: jest.fn(),
  };
}

function RouteGuardHarness({ routeKey }: { routeKey: string }) {
  useWalletRouteNetworkGuard(routeKey);
  return null;
}

describe("useWalletRouteNetworkGuard", () => {
  const provider = makeProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    provider.network = 894710606;
    window.history.replaceState({}, "", "/miniapps/demo?network=testnet");
    localStorage.clear();
    provider.getAccounts.mockResolvedValue([
      { hash: "0xaccount", address: "NRouteGuardAddress", isDefault: true },
    ]);
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };
    useWalletStore.setState({
      connected: false,
      address: "",
      accountHash: "",
      publicKey: "",
      network: null,
      provider: null,
      balance: null,
      loading: false,
      error: null,
      restorePending: false,
    });
  });

  afterEach(() => {
    useWalletStore.getState().disconnect();
    delete process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK;
  });

  it("disconnects immediately when a route changes to a different target network", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await useWalletStore.getState().connect("nep21");
      expect(useWalletStore.getState()).toMatchObject({
        connected: true,
        network: "testnet",
      });
      const balanceReadsAfterConnect = provider.getBalance.mock.calls.length;

      const { rerender } = render(
        <RouteGuardHarness routeKey="/miniapps/demo?network=testnet" />,
      );
      await waitFor(() =>
        expect(provider.getBalance.mock.calls.length).toBeGreaterThan(
          balanceReadsAfterConnect,
        ),
      );
      const balanceReadsAfterInitialGuard = provider.getBalance.mock.calls.length;

      window.history.replaceState({}, "", "/miniapps/demo?network=mainnet");
      rerender(<RouteGuardHarness routeKey="/miniapps/demo?network=mainnet" />);

      await waitFor(() =>
        expect(useWalletStore.getState()).toMatchObject({
          connected: false,
          address: "",
          network: null,
          provider: null,
          balance: null,
          error: expect.stringMatching(/targets Neo N3 Mainnet/),
        }),
      );
      expect(provider.getBalance).toHaveBeenCalledTimes(
        balanceReadsAfterInitialGuard,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[wallet-store] refreshBalance failed:",
        expect.stringMatching(/targets Neo N3 Mainnet/),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
