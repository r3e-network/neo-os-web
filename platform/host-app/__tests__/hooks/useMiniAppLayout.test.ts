import { renderHook, waitFor } from "@testing-library/react";
import { useMiniAppLayout } from "../../hooks/useMiniAppLayout";

describe("useMiniAppLayout", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    delete (window as unknown as { NEOLineN3?: unknown }).NEOLineN3;
    delete (window as unknown as { UnknownWalletProvider?: unknown }).UnknownWalletProvider;
  });

  it("returns override immediately", () => {
    const { result } = renderHook(() => useMiniAppLayout("mobile"));
    expect(result.current).toBe("mobile");
  });

  it("detects mobile wallet environment", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      configurable: true,
    });
    (window as unknown as { NEOLineN3: unknown }).NEOLineN3 = {};

    const { result } = renderHook(() => useMiniAppLayout());

    await waitFor(() => {
      expect(result.current).toBe("mobile");
    });
  });

  it("does not treat unknown providers as wallet environment", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      configurable: true,
    });
    (window as unknown as { UnknownWalletProvider: unknown }).UnknownWalletProvider = {};

    const { result } = renderHook(() => useMiniAppLayout());

    await waitFor(() => {
      expect(result.current).toBe("web");
    });
  });
});
