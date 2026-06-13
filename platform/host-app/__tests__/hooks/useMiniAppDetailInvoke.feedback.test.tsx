import { act, renderHook } from "@testing-library/react";
import { useMiniAppDetailInvoke } from "../../hooks/useMiniAppDetailInvoke";
import { getWalletAdapter } from "../../lib/wallet/store";

jest.mock("../../lib/wallet/store", () => ({
  getWalletAdapter: jest.fn(),
}));

describe("useMiniAppDetailInvoke structured success feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the txid alongside the message for direct contract writes", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xgenerictx" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/miniapp-generic-demo",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-generic-demo" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b",
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: null,
        router: router as never,
        setInvokeFeedback,
        sharedRuntime: null,
        targetCatalogNetwork: "neo-n3-testnet" as never,
        targetNetwork: "testnet",
        walletAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        walletConnected: true,
        walletNetwork: "testnet",
      }),
    );

    await act(async () => {
      await result.current(
        { name: "Frobnicate", method: "frobnicate", params: [] } as never,
        {},
      );
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Transaction submitted.",
      txid: "0xgenerictx",
    });
  });
});
