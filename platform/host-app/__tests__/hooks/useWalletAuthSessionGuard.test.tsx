import React from "react";
import { act, render, waitFor } from "@testing-library/react";

import { useWalletAuthSessionGuard } from "@/hooks/useWalletAuthSessionGuard";
import { useAuthStore } from "@/lib/auth/store";
import { useWalletStore } from "@/lib/wallet/store";

function WalletAuthGuardHarness() {
  useWalletAuthSessionGuard();
  return null;
}

function resetWalletState(overrides: Record<string, unknown> = {}) {
  act(() => {
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
      ...overrides,
    });
  });
}

function resetAuthState(overrides: Record<string, unknown> = {}) {
  act(() => {
    useAuthStore.setState({
      authenticated: false,
      userId: "",
      method: null,
      walletAddress: "",
      walletType: null,
      loading: false,
      error: null,
      ...overrides,
    });
  });
}

describe("useWalletAuthSessionGuard", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetWalletState();
    resetAuthState();
  });

  afterEach(() => {
    resetWalletState();
    resetAuthState();
  });

  it("clears wallet auth tokens when the external wallet disconnects", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    localStorage.setItem("neo_miniapp_auth_jwt", "wallet-jwt");
    resetWalletState({
      connected: false,
      address: "NDisconnectedButRemembered",
      provider: "onegate",
      restorePending: true,
    });
    resetAuthState({
      authenticated: true,
      userId: "wallet-user",
      method: "wallet",
      walletAddress: "NDisconnectedButRemembered",
      walletType: "external",
    });

    render(<WalletAuthGuardHarness />);

    await waitFor(() =>
      expect(useAuthStore.getState()).toMatchObject({
        authenticated: false,
        userId: "",
        method: null,
        walletAddress: "",
        walletType: null,
      }),
    );
    expect(sessionStorage.getItem("sb-access-token")).toBeNull();
    expect(localStorage.getItem("neo_miniapp_auth_jwt")).toBeNull();
  });

  it("clears wallet auth tokens when the connected account changes", async () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    localStorage.setItem("neo_miniapp_auth_jwt", "wallet-jwt");
    resetWalletState({
      connected: true,
      address: "NNewWalletAddress",
      provider: "onegate",
      network: "testnet",
    });
    resetAuthState({
      authenticated: true,
      userId: "wallet-user",
      method: "wallet",
      walletAddress: "NOldWalletAddress",
      walletType: "external",
    });

    render(<WalletAuthGuardHarness />);

    await waitFor(() =>
      expect(useAuthStore.getState()).toMatchObject({
        authenticated: false,
        walletAddress: "",
        walletType: null,
      }),
    );
    expect(sessionStorage.getItem("sb-access-token")).toBeNull();
    expect(localStorage.getItem("neo_miniapp_auth_jwt")).toBeNull();
  });

  it("does not clear a matching external wallet session", () => {
    sessionStorage.setItem("sb-access-token", "wallet-jwt");
    localStorage.setItem("neo_miniapp_auth_jwt", "wallet-jwt");
    resetWalletState({
      connected: true,
      address: "NMatchingWalletAddress",
      provider: "onegate",
      network: "testnet",
    });
    resetAuthState({
      authenticated: true,
      userId: "wallet-user",
      method: "wallet",
      walletAddress: "NMatchingWalletAddress",
      walletType: "external",
    });

    render(<WalletAuthGuardHarness />);

    expect(useAuthStore.getState()).toMatchObject({
      authenticated: true,
      walletAddress: "NMatchingWalletAddress",
      walletType: "external",
    });
    expect(sessionStorage.getItem("sb-access-token")).toBe("wallet-jwt");
    expect(localStorage.getItem("neo_miniapp_auth_jwt")).toBe("wallet-jwt");
  });

  it("does not clear social sessions when no external wallet auth is active", () => {
    resetWalletState({ connected: false, address: "" });
    resetAuthState({
      authenticated: true,
      userId: "auth0|user",
      method: "social",
      walletAddress: "NCustodialSocialWallet",
      walletType: "custodial",
    });

    render(<WalletAuthGuardHarness />);

    expect(useAuthStore.getState()).toMatchObject({
      authenticated: true,
      method: "social",
      walletAddress: "NCustodialSocialWallet",
      walletType: "custodial",
    });
  });
});
