/** @jest-environment node */

import { handleBridgeMessage } from "@/lib/bridge/handler";
import type { BridgeMessage, MessageType } from "@/lib/bridge/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetChains = jest.fn(() => [
  { id: "neo-n3", name: "Neo N3", type: "neo", icon: "/neo.svg", isTestnet: false },
  { id: "neo-n3-testnet", name: "Neo N3 TestNet", type: "neo", icon: "/neo.svg", isTestnet: true },
]);
const mockGetChain = jest.fn((id: string) =>
  id === "neo-n3" ? { id: "neo-n3", name: "Neo N3", type: "neo", rpcUrls: ["https://rpc.neo.org"] } : null,
);

jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChains: mockGetChains,
    getChain: mockGetChain,
  }),
}));

const mockWalletState = {
  chainId: "neo-n3" as string | null,
  address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  publicKey: "03abc",
  connected: true,
  balance: { native: "10", tokens: [] },
  connect: jest.fn(),
  disconnect: jest.fn(),
  switchChain: jest.fn(),
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: { getState: () => mockWalletState },
}));

jest.mock("@/lib/chains/rpc-functions", () => ({
  getTransactionLogMultiChain: jest.fn(),
  invokeRead: jest.fn(() => ({ stack: [{ value: "42" }] })),
  getChainRpcUrl: jest.fn(() => "https://rpc.neo.org"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msg(type: MessageType, payload?: unknown): BridgeMessage {
  return { id: `test-${Date.now()}`, type, payload };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bridge Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletState.connected = true;
    mockWalletState.chainId = "neo-n3";
    mockWalletState.address = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
  });

  describe("message routing", () => {
    it("returns UNKNOWN_TYPE for unrecognized message types", async () => {
      const result = await handleBridgeMessage(msg("INVALID_TYPE" as MessageType));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("UNKNOWN_TYPE");
      expect(result.error?.message).toContain("Unknown message type");
    });

    it("preserves message id in response", async () => {
      const m = { id: "msg-123", type: "MULTICHAIN_GET_CHAINS" as MessageType };
      const result = await handleBridgeMessage(m);
      expect(result.id).toBe("msg-123");
    });

    it("returns success:true for valid handler", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_CHAINS"));
      expect(result.success).toBe(true);
    });
  });

  describe("MULTICHAIN_GET_CHAINS", () => {
    it("returns chain list with expected fields", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_CHAINS"));
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      const chains = result.data as Array<Record<string, unknown>>;
      expect(chains.length).toBe(2);
      expect(chains[0]).toHaveProperty("id");
      expect(chains[0]).toHaveProperty("name");
      expect(chains[0]).toHaveProperty("isTestnet");
    });
  });

  describe("MULTICHAIN_GET_ACTIVE_CHAIN", () => {
    it("returns active chain when connected", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_ACTIVE_CHAIN"));
      expect(result.success).toBe(true);
      expect(mockGetChain).toHaveBeenCalledWith("neo-n3");
    });

    it("returns null when no chain selected", async () => {
      mockWalletState.chainId = null;
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_ACTIVE_CHAIN"));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("MULTICHAIN_CONNECT", () => {
    it("throws when chainId is missing", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_CONNECT", {}));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("HANDLER_ERROR");
      expect(result.error?.message).toContain("chainId is required");
    });

    it("throws for unknown chain", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_CONNECT", { chainId: "unknown-chain" }));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Unknown chain");
    });

    it("throws for unsupported provider", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_CONNECT", { chainId: "neo-n3", provider: "metamask" }));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Unsupported provider");
    });
  });

  describe("MULTICHAIN_DISCONNECT", () => {
    it("calls disconnect on wallet store", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_DISCONNECT"));
      expect(result.success).toBe(true);
      expect(mockWalletState.disconnect).toHaveBeenCalled();
    });
  });

  describe("MULTICHAIN_GET_ACCOUNT", () => {
    it("returns account info when connected", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_ACCOUNT", { chainId: "neo-n3" }));
      expect(result.success).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data.address).toBe("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");
      expect(data.chainId).toBe("neo-n3");
    });

    it("returns null when not connected", async () => {
      mockWalletState.connected = false;
      const result = await handleBridgeMessage(msg("MULTICHAIN_GET_ACCOUNT", {}));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("MULTICHAIN_SEND_TX", () => {
    it("rejects with not-supported error", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_SEND_TX", { chainId: "neo-n3", to: "NAddr" }));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("not supported");
    });

    it("validates required fields", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_SEND_TX", {}));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("required");
    });
  });

  describe("MULTICHAIN_READ_CONTRACT", () => {
    it("invokes read and returns result", async () => {
      const { invokeRead } = require("@/lib/chains/rpc-functions");
      const result = await handleBridgeMessage(
        msg("MULTICHAIN_READ_CONTRACT", {
          chainId: "neo-n3",
          contractAddress: "0xabc",
          method: "balanceOf",
          args: ["NAddr"],
        }),
      );
      expect(result.success).toBe(true);
      expect(invokeRead).toHaveBeenCalledWith("0xabc", "balanceOf", ["NAddr"], "neo-n3");
      const data = result.data as Record<string, unknown>;
      expect(data.chainId).toBe("neo-n3");
    });

    it("validates required fields", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_READ_CONTRACT", { chainId: "neo-n3" }));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("required");
    });
  });

  describe("MULTICHAIN_CALL_CONTRACT", () => {
    it("rejects with not-supported error", async () => {
      const result = await handleBridgeMessage(
        msg("MULTICHAIN_CALL_CONTRACT", {
          chainId: "neo-n3",
          contractAddress: "0xabc",
          method: "transfer",
        }),
      );
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("not supported");
    });
  });

  describe("MULTICHAIN_SUBSCRIBE / UNSUBSCRIBE", () => {
    it("subscribe rejects with not-supported", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_SUBSCRIBE"));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("not supported");
    });

    it("unsubscribe succeeds silently", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_UNSUBSCRIBE"));
      expect(result.success).toBe(true);
    });
  });

  describe("MULTICHAIN_EVENT", () => {
    it("returns null (no-op handler)", async () => {
      const result = await handleBridgeMessage(msg("MULTICHAIN_EVENT"));
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("error handling", () => {
    it("wraps handler exceptions in HANDLER_ERROR", async () => {
      mockWalletState.switchChain.mockRejectedValueOnce(new Error("RPC timeout"));
      const result = await handleBridgeMessage(msg("MULTICHAIN_SWITCH_CHAIN", { chainId: "neo-n3" }));
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("HANDLER_ERROR");
      expect(result.error?.message).toBe("RPC timeout");
    });

    it("handles non-Error throws gracefully", async () => {
      mockWalletState.switchChain.mockRejectedValueOnce("string error");
      const result = await handleBridgeMessage(msg("MULTICHAIN_SWITCH_CHAIN", { chainId: "neo-n3" }));
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("Unknown error");
    });
  });
});
