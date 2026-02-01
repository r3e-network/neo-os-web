/**
 * Wallet Store Tests
 */

import { useWalletStore } from "@/lib/wallet/store";

// Mock Supabase
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  isSupabaseConfigured: true,
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Wallet Store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have initial state", () => {
    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.address).toBe("");
    expect(state.provider).toBeNull();
    expect(state.error).toBeNull();
    expect(state.chainId).toBe("neo-n3-mainnet");
  });

  it("should set chain ID", () => {
    useWalletStore.getState().setChainId("neo-n3-testnet");
    expect(useWalletStore.getState().chainId).toBe("neo-n3-testnet");
  });

  it("should clear error", () => {
    // Set error by simulating a failed connection
    useWalletStore.setState({ error: "Connection failed" });
    expect(useWalletStore.getState().error).toBe("Connection failed");
    
    useWalletStore.getState().clearError();
    expect(useWalletStore.getState().error).toBeNull();
  });

  it("should set custom RPC URL", () => {
    useWalletStore.getState().setCustomRpcUrl("neo-n3-testnet", "https://custom.rpc.io");
    expect(useWalletStore.getState().networkConfig.customRpcUrls["neo-n3-testnet"]).toBe("https://custom.rpc.io");
  });

  it("should get active RPC URL", () => {
    const state = useWalletStore.getState();
    // Reset to default chain to get default RPC
    state.setChainId("neo-n3-mainnet");
    const rpcUrl = state.getActiveRpcUrl();
    expect(typeof rpcUrl).toBe("string");
    expect(rpcUrl.length).toBeGreaterThan(0);
  });

  it("should disconnect", () => {
    // Set connected state
    useWalletStore.setState({ 
      connected: true, 
      address: "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
      provider: "neoline"
    });
    
    useWalletStore.getState().disconnect();
    
    expect(useWalletStore.getState().connected).toBe(false);
    expect(useWalletStore.getState().address).toBe("");
    expect(useWalletStore.getState().provider).toBeNull();
  });
});
