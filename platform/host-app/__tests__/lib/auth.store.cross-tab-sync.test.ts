export {};

const mockConnect = jest.fn(async () => undefined);
const mockWalletState = {
  connected: true,
  address: "NUserAddress",
  publicKey: "03userpub",
  connect: mockConnect,
  disconnect: jest.fn(),
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: {
    getState: () => mockWalletState,
  },
  getWalletAdapter: () => null,
}));

describe("auth store cross-tab sync", () => {
  const AUTH_JWT_KEY = "neo_miniapp_auth_jwt";

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockWalletState.connected = true;
    mockWalletState.address = "NUserAddress";
  });

  function dispatchAuthJwtStorageEvent(
    newValue: string | null,
    oldValue: string | null,
  ) {
    // jsdom does not emit the cross-tab `storage` event, so simulate what
    // another tab would observe when the wallet JWT is cleared.
    const event = new StorageEvent("storage", {
      key: AUTH_JWT_KEY,
      newValue,
      oldValue,
      storageArea: localStorage,
      url: window.location.href,
    });
    window.dispatchEvent(event);
  }

  it("drops the wallet-bound auth session when another tab logs out AND this tab has no per-tab token", () => {
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      userId: "wallet-user",
      method: "wallet",
      walletAddress: "NUserAddress",
      walletType: "external",
    });
    localStorage.setItem(AUTH_JWT_KEY, "wallet-jwt");
    // This tab has no per-tab access token (e.g. session restored from the
    // shared JWT only), so a cross-tab logout truly ends its session.
    sessionStorage.removeItem("sb-access-token");

    // Another tab cleared the shared wallet JWT.
    dispatchAuthJwtStorageEvent(null, "wallet-jwt");

    expect(useAuthStore.getState()).toMatchObject({
      authenticated: false,
      userId: "",
      method: null,
      walletAddress: "",
      walletType: null,
    });
  });

  it("keeps an independently-authenticated tab live when another tab logs out", () => {
    // Each tab mints its OWN wallet JWT during login and keeps it in its own
    // sessionStorage. A logout in tab A clears the shared localStorage JWT but
    // must NOT tear down tab B's still-valid per-tab session.
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      userId: "wallet-user-b",
      method: "wallet",
      walletAddress: "NUserAddressB",
      walletType: "external",
    });
    localStorage.setItem(AUTH_JWT_KEY, "wallet-jwt-b");
    sessionStorage.setItem("sb-access-token", "wallet-jwt-b");

    // Tab A (a different wallet session) logged out and cleared the shared key.
    dispatchAuthJwtStorageEvent(null, "wallet-jwt-a");

    expect(useAuthStore.getState()).toMatchObject({
      authenticated: true,
      userId: "wallet-user-b",
      method: "wallet",
      walletAddress: "NUserAddressB",
      walletType: "external",
    });
    // This tab's own token is untouched.
    expect(sessionStorage.getItem("sb-access-token")).toBe("wallet-jwt-b");
  });

  it("keeps a dev-key (WIF) tab live when an external-wallet tab logs out", () => {
    // Regression for the WIF × external-wallet cross-tab collision: a WIF login
    // sets method=wallet/walletType=external too, so without the per-tab token
    // guard a logout in an external-wallet tab would wrongly kill the WIF tab.
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      userId: "wif-user",
      method: "wallet",
      walletAddress: "NWifAddress",
      walletType: "external",
    });
    localStorage.setItem(AUTH_JWT_KEY, "wif-jwt");
    sessionStorage.setItem("sb-access-token", "wif-jwt");

    dispatchAuthJwtStorageEvent(null, "external-wallet-jwt");

    expect(useAuthStore.getState()).toMatchObject({
      authenticated: true,
      method: "wallet",
      walletAddress: "NWifAddress",
      walletType: "external",
    });
  });

  it("preserves a social session across a cross-tab wallet logout", () => {
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      userId: "auth0|social-user",
      method: "social",
      walletAddress: "NCustodialWallet",
      walletType: "custodial",
    });

    dispatchAuthJwtStorageEvent(null, "wallet-jwt");

    // A social login is not bound to the wallet JWT; leave it alone.
    expect(useAuthStore.getState()).toMatchObject({
      authenticated: true,
      userId: "auth0|social-user",
      method: "social",
    });
  });

  it("ignores storage events for unrelated keys", () => {
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      method: "wallet",
      walletAddress: "NUserAddress",
      walletType: "external",
    });

    const event = new StorageEvent("storage", {
      key: "unrelated-key",
      newValue: "x",
      oldValue: null,
      storageArea: localStorage,
      url: window.location.href,
    });
    window.dispatchEvent(event);

    expect(useAuthStore.getState().authenticated).toBe(true);
  });

  it("does not react when the JWT is merely refreshed (newValue present)", () => {
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    useAuthStore.setState({
      authenticated: true,
      method: "wallet",
      walletAddress: "NUserAddress",
      walletType: "external",
    });

    dispatchAuthJwtStorageEvent("fresh-jwt", "old-jwt");

    expect(useAuthStore.getState().authenticated).toBe(true);
  });
});
