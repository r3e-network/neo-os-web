import { act, renderHook } from "@testing-library/react";
import { useMiniAppDetailInvoke } from "../../hooks/useMiniAppDetailInvoke";
import { addressToScriptHash } from "../../lib/chain";
import { getWalletAdapter } from "../../lib/wallet/store";
import {
  BLOCKCHAIN_CONSTANTS,
  EXTERNAL_INTEGRATIONS,
} from "../../../../apps/shared/constants";

jest.mock("../../lib/wallet/store", () => ({
  getWalletAdapter: jest.fn(),
}));

describe("useMiniAppDetailInvoke", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  function renderAARelayInvoke(setInvokeFeedback = jest.fn()) {
    const router = {
      pathname: "/miniapps/aa-relay-console",
      query: { network: "testnet" },
      replace: jest.fn(),
    };
    return renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-aa-relay-console" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: null,
        router: router as never,
        setInvokeFeedback,
        sharedRuntime: null,
        targetCatalogNetwork: "neo-n3-testnet" as never,
        targetNetwork: "testnet",
        walletAddress: null,
        walletConnected: false,
        walletNetwork: null,
      }),
    );
  }

  function renderUnbreakableVaultInvoke({
    directContractHash = "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
    setInvokeFeedback = jest.fn(),
    targetCatalogNetwork = "neo-n3-testnet",
    targetNetwork = "testnet",
    walletNetwork = "testnet",
  }: {
    directContractHash?: string;
    setInvokeFeedback?: jest.Mock;
    targetCatalogNetwork?: "neo-n3-mainnet" | "neo-n3-testnet";
    targetNetwork?: "mainnet" | "testnet";
    walletNetwork?: "mainnet" | "testnet";
  } = {}) {
    const router = {
      pathname: "/miniapps/unbreakable-vault",
      query: { network: targetNetwork },
      replace: jest.fn(),
    };
    return renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-unbreakablevault" } as never,
        appSupportsTargetNetwork: true,
        directContractHash,
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: null,
        router: router as never,
        setInvokeFeedback,
        sharedRuntime: null,
        targetCatalogNetwork: targetCatalogNetwork as never,
        targetNetwork,
        walletAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        walletConnected: true,
        walletNetwork,
      }),
    );
  }

  function renderMemorialShrineInvoke({
    directContractHash = "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
    setInvokeFeedback = jest.fn(),
    targetCatalogNetwork = "neo-n3-testnet",
    targetNetwork = "testnet",
    walletNetwork = "testnet",
  }: {
    directContractHash?: string;
    setInvokeFeedback?: jest.Mock;
    targetCatalogNetwork?: "neo-n3-mainnet" | "neo-n3-testnet";
    targetNetwork?: "mainnet" | "testnet";
    walletNetwork?: "mainnet" | "testnet";
  } = {}) {
    const router = {
      pathname: "/miniapps/memorial-shrine",
      query: { network: targetNetwork },
      replace: jest.fn(),
    };
    return renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-memorial-shrine" } as never,
        appSupportsTargetNetwork: true,
        directContractHash,
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: null,
        router: router as never,
        setInvokeFeedback,
        sharedRuntime: null,
        targetCatalogNetwork: targetCatalogNetwork as never,
        targetNetwork,
        walletAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        walletConnected: true,
        walletNetwork,
      }),
    );
  }

  function renderRecoveryGuardianInvoke({
    directContractHash = "0x198b3a9cec9bccc2110d19bd929b10374a9d034d",
    setInvokeFeedback = jest.fn(),
    targetCatalogNetwork = "neo-n3-testnet",
    targetNetwork = "testnet",
    walletNetwork = "testnet",
  }: {
    directContractHash?: string;
    setInvokeFeedback?: jest.Mock;
    targetCatalogNetwork?: "neo-n3-mainnet" | "neo-n3-testnet";
    targetNetwork?: "mainnet" | "testnet";
    walletNetwork?: "mainnet" | "testnet";
  } = {}) {
    const router = {
      pathname: "/miniapps/recovery-guardian",
      query: { network: targetNetwork },
      replace: jest.fn(),
    };
    return renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-recovery-guardian" } as never,
        appSupportsTargetNetwork: true,
        directContractHash,
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: null,
        router: router as never,
        setInvokeFeedback,
        sharedRuntime: null,
        targetCatalogNetwork: targetCatalogNetwork as never,
        targetNetwork,
        walletAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        walletConnected: true,
        walletNetwork,
      }),
    );
  }

  it("checks AA relay sponsorship through the host API without wallet invoke", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ eligible: true, remaining: "0.42" })),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);

    await act(async () => {
      await result.current(
        { method: "checkSponsor", name: "Check Sponsorship" } as never,
        {
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          dappId: "miniapp-aa-relay-console",
        },
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/gas-sponsor-check?aaAddress=NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu&dappId=miniapp-aa-relay-console&network=testnet",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getWalletAdapter).not.toHaveBeenCalled();
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Sponsorship available. Remaining quota: 0.42 GAS.",
    });
  });

  it("shows a user-facing message when AA sponsorship is not enabled", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "function not allowed" },
        }),
      ),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);
    const friendlyMessage =
      "Sponsorship service is not enabled in this environment. Configure the AA sponsorship backend before checking sponsorship.";
    let thrown: unknown;

    await act(async () => {
      try {
        await result.current(
          { method: "checkSponsor", name: "Check Sponsorship" } as never,
          {
            aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            dappId: "miniapp-aa-relay-console",
          },
        );
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(friendlyMessage);
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "error",
      message: friendlyMessage,
    });
  });

  it("requests AA relay sponsorship through the host API without wallet invoke", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          status: "approved",
          request_id: "sponsor-1",
          amount: "0.1",
        }),
      ),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);

    await act(async () => {
      await result.current(
        { method: "requestSponsor", name: "Request Sponsorship" } as never,
        {
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          dappId: "miniapp-aa-relay-console",
          sponsorAmount: "0.1",
        },
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rpc/gas-sponsor-request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          amount: "0.1",
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          dappId: "miniapp-aa-relay-console",
          network: "testnet",
          paymaster: {
            dapp_id: "miniapp-aa-relay-console",
            network: "testnet",
          },
        }),
      }),
    );
    expect(getWalletAdapter).not.toHaveBeenCalled();
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Sponsorship request approved: sponsor-1",
    });
  });

  it("submits AA relay payloads through the host API without wallet invoke", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ txid: "0xrelaytx" })),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);

    await act(async () => {
      await result.current(
        { method: "submitRelay", name: "Submit Relay Payload" } as never,
        {
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          dappId: "miniapp-aa-relay-console",
          payloadJson: JSON.stringify({
            metaInvocation: {
              scriptHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
            },
          }),
        },
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/aa/relay",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          metaInvocation: {
            scriptHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
          },
          paymaster: {
            dapp_id: "miniapp-aa-relay-console",
            network: "testnet",
          },
        }),
      }),
    );
    expect(getWalletAdapter).not.toHaveBeenCalled();
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "AA relay submitted: 0xrelaytx",
    });
  });

  it("shows a user-facing message when the AA relay backend is not configured", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          error: {
            message:
              "AA_RELAY_URL (or NEXT_PUBLIC_AA_RELAY_URL) not configured",
          },
        }),
      ),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);
    const friendlyMessage =
      "AA relay service is not configured in this environment. Configure AA_RELAY_URL before submitting relay payloads.";
    let thrown: unknown;

    await act(async () => {
      try {
        await result.current(
          { method: "submitRelay", name: "Submit Relay Payload" } as never,
          {
            aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            dappId: "miniapp-aa-relay-console",
            payloadJson: JSON.stringify({
              metaInvocation: {
                scriptHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
              },
            }),
          },
        );
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(friendlyMessage);
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "error",
      message: friendlyMessage,
    });
  });

  it("does not treat no-txid AA relay responses as submitted transactions", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          status: "unavailable",
          reason: "AA relay URL is not configured",
        }),
      ),
    });
    global.fetch = fetchMock as never;
    const setInvokeFeedback = jest.fn();
    const { result } = renderAARelayInvoke(setInvokeFeedback);

    await expect(
      result.current(
        { method: "submitRelay", name: "Submit Relay Payload" } as never,
        {
          aaAddress: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          dappId: "miniapp-aa-relay-console",
          payloadJson: JSON.stringify({
            metaInvocation: {
              scriptHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
            },
          }),
        },
      ),
    ).rejects.toThrow("AA relay not submitted: AA relay URL is not configured");
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "error",
      message: "AA relay not submitted: AA relay URL is not configured",
    });
  });

  it("submits Daily Check-in through the prepaid GAS transfer path", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xdailycheckintx" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/daily-checkin",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-dailycheckin" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
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
        { method: "checkIn", name: "Check In" } as never,
        {},
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      operation: "transfer",
      args: [
        {
          type: "Hash160",
          value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        },
        {
          type: "Hash160",
          value: "0xaba84da240a55410d284a656fc8dae044e6ec1a5",
        },
        { type: "Integer", value: "100000" },
        { type: "String", value: "miniapp-dailycheckin:checkin" },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Check-in transaction submitted: 0xdailycheckintx",
    });
  });

  it("funds FogPlay wager credit with the contract bet memo", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xfogfundtx" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/fogplay",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-fogplay" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
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
        {
          method: "fundGameCredit",
          name: "Fund Wager",
          params: [
            {
              name: "amount",
              type: "amount",
              label: "GAS credit",
              required: true,
              scale: 8,
            },
          ],
        } as never,
        { amount: "0.05" },
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      operation: "transfer",
      args: [
        {
          type: "Hash160",
          value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        },
        {
          type: "Hash160",
          value: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
        },
        { type: "Integer", value: "5000000" },
        { type: "String", value: "miniapp-fogplay:bet" },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Game credit funded: 0xfogfundtx",
    });
  });

  it("sends Dev Tipping tips through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xdevtiptx" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/dev-tipping",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-dev-tipping" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x389aa2c619f0cfed5b495dd8638107d20f37e086",
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
        { method: "sendTip", name: "Send Tip" } as never,
        {
          devId: "7",
          amount: "0.05",
          message: "Thanks for building",
          tipperName: "Neo supporter",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x389aa2c619f0cfed5b495dd8638107d20f37e086",
            },
            { type: "Integer", value: "5000000" },
            { type: "String", value: "miniapp-dev-tipping:tip" },
          ],
        },
        {
          scriptHash: "0x389aa2c619f0cfed5b495dd8638107d20f37e086",
          operation: "tip",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            { type: "Integer", value: "7" },
            { type: "Integer", value: "5000000" },
            { type: "String", value: "Thanks for building" },
            { type: "String", value: "Neo supporter" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Tip sent: 0xdevtiptx",
    });
  });

  it("creates Memorial Shrine records through a direct wallet invoke", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xmemorialcreate" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const { result } = renderMemorialShrineInvoke({ setInvokeFeedback });

    await act(async () => {
      await result.current(
        {
          method: "createMemorial",
          name: "Create Memorial",
        } as never,
        {
          name: "Loved one",
          photoHash: "ipfs://portrait",
          relationship: "mentor",
          birthYear: "1950",
          deathYear: "2024",
          biography: "A generous builder",
          obituary: "Always remembered",
        },
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
      operation: "createMemorial",
      args: [
        {
          type: "Hash160",
          value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        },
        { type: "String", value: "Loved one" },
        { type: "String", value: "ipfs://portrait" },
        { type: "String", value: "mentor" },
        { type: "Integer", value: "1950" },
        { type: "Integer", value: "2024" },
        { type: "String", value: "A generous builder" },
        { type: "String", value: "Always remembered" },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Memorial created: 0xmemorialcreate",
    });
  });

  it("pays Memorial Shrine tributes on testnet through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xmemorialtribute" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const { result } = renderMemorialShrineInvoke({ setInvokeFeedback });

    await act(async () => {
      await result.current(
        {
          method: "payTribute",
          name: "Pay Tribute",
        } as never,
        {
          memorialId: "42",
          offeringType: "3",
          message: "Always remembered",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
            },
            { type: "Integer", value: "3000000" },
            { type: "String", value: "miniapp-memorial-shrine:tribute:42:3" },
          ],
        },
        {
          scriptHash: "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
          operation: "payTribute",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            { type: "Integer", value: "42" },
            { type: "Integer", value: "3" },
            { type: "String", value: "Always remembered" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Tribute paid: 0xmemorialtribute",
    });
  });

  it("uses the mainnet Memorial Shrine receipt ABI for tribute payments", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xmemorialmainnet" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const { result } = renderMemorialShrineInvoke({
      directContractHash: "0xee7a548b71c69364fcb0e45a63a40f141b938e42",
      setInvokeFeedback,
      targetCatalogNetwork: "neo-n3-mainnet",
      targetNetwork: "mainnet",
      walletNetwork: "mainnet",
    });

    await act(async () => {
      await result.current(
        {
          method: "payTribute",
          name: "Pay Tribute",
        } as never,
        {
          memorialId: "42",
          offeringType: "1",
          message: "Mainnet remembrance",
          receiptId: "77",
        },
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: "0xee7a548b71c69364fcb0e45a63a40f141b938e42",
      operation: "payTribute",
      args: [
        {
          type: "Hash160",
          value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        },
        { type: "Integer", value: "42" },
        { type: "Integer", value: "1" },
        { type: "String", value: "Mainnet remembrance" },
        { type: "Integer", value: "77" },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Tribute paid: 0xmemorialmainnet",
    });
  });

  it("requests Recovery Guardian tickets against the SocialRecoveryVerifier ABI", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xrecoveryrequest" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const { result } = renderRecoveryGuardianInvoke({ setInvokeFeedback });
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const walletHash = addressToScriptHash("NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu");

    try {
      await act(async () => {
        await result.current(
          {
            method: "requestRecoveryTicket",
            name: "Request Recovery Ticket",
          } as never,
          {
            accountId: "0x1111111111111111111111111111111111111111",
            newOwner: "$wallet",
            expiryMinutes: "30",
            provider: "web3auth",
            encryptedParams: "{}",
          },
        );
      });
    } finally {
      dateNow.mockRestore();
    }

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: "0x198b3a9cec9bccc2110d19bd929b10374a9d034d",
      operation: "requestRecoveryTicket",
      args: [
        {
          type: "ByteArray",
          value: "0x1111111111111111111111111111111111111111",
        },
        { type: "String", value: "web3auth" },
        { type: "Hash160", value: walletHash },
        { type: "String", value: "1700001800" },
        { type: "String", value: "{}" },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Recovery ticket requested: 0xrecoveryrequest",
    });
  });

  it("submits Recovery Guardian finalize transactions with account ByteArray args", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xrecoveryfinalize" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const { result } = renderRecoveryGuardianInvoke({ setInvokeFeedback });

    await act(async () => {
      await result.current(
        {
          method: "finalizeRecovery",
          name: "Finalize Recovery",
        } as never,
        {
          accountId: "0x1111111111111111111111111111111111111111",
        },
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: "0x198b3a9cec9bccc2110d19bd929b10374a9d034d",
      operation: "finalizeRecovery",
      args: [
        {
          type: "ByteArray",
          value: "0x1111111111111111111111111111111111111111",
        },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Recovery finalized: 0xrecoveryfinalize",
    });
  });

  it("seals Time Capsule hashes through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xtimecapsule" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/time-capsule",
      query: { network: "testnet" },
      replace: jest.fn(),
    };
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-time-capsule" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489",
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

    const contentHash =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    try {
      await act(async () => {
        await result.current(
          {
            method: "sealCapsule",
            name: "Seal Capsule",
          } as never,
          {
            contentHash,
            title: "Future note",
            unlockDays: "30",
            isPublic: "true",
            category: "2",
          },
        );
      });
    } finally {
      dateNow.mockRestore();
    }

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489",
            },
            { type: "Integer", value: "20000000" },
            { type: "String", value: "miniapp-time-capsule:bury" },
          ],
        },
        {
          scriptHash: "0x0c6abb9ddeaceb55bb17f6d3c5a26d0814773489",
          operation: "bury",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            { type: "String", value: contentHash },
            { type: "String", value: "Future note" },
            { type: "Integer", value: "1702592000000" },
            { type: "Boolean", value: true },
            { type: "Integer", value: "2" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Capsule sealed: 0xtimecapsule",
    });
  });

  it("creates Unbreakable Vaults through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xvaultcreate" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const { result } = renderUnbreakableVaultInvoke({ setInvokeFeedback });
    const secretHash =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    await act(async () => {
      await result.current(
        {
          method: "createVault",
          name: "Create Vault",
        } as never,
        {
          secretHash,
          bountyGas: "1",
          difficulty: "2",
          title: "Crack me",
          description: "public hint",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
            },
            { type: "Integer", value: "100000000" },
            { type: "String", value: "miniapp-unbreakablevault:create" },
          ],
        },
        {
          scriptHash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
          operation: "createVault",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "ByteArray",
              value: Buffer.from(secretHash, "hex").toString("base64"),
            },
            { type: "Integer", value: "100000000" },
            { type: "Integer", value: "2" },
            { type: "String", value: "Crack me" },
            { type: "String", value: "public hint" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Vault created: 0xvaultcreate",
    });
  });

  it("appends Unbreakable Vault mainnet receipt ids for receipt-based ABI", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xvaultmainnet" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const { result } = renderUnbreakableVaultInvoke({
      directContractHash: "0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa",
      setInvokeFeedback,
      targetCatalogNetwork: "neo-n3-mainnet",
      targetNetwork: "mainnet",
      walletNetwork: "mainnet",
    });
    const secretHash =
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    await act(async () => {
      await result.current(
        {
          method: "createVault",
          name: "Create Vault",
        } as never,
        {
          secretHash,
          bountyGas: "2",
          difficulty: "3",
          title: "Mainnet receipt vault",
          receiptId: "77",
        },
      );
    });

    expect(invokeMultiple.mock.calls[0][0][1]).toEqual(
      expect.objectContaining({
        operation: "createVault",
        args: expect.arrayContaining([
          { type: "Integer", value: "77" },
        ]),
      }),
    );
    expect(invokeMultiple.mock.calls[0][0][1].args).toHaveLength(7);
  });

  it("submits Unbreakable Vault break attempts through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xvaultattempt" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const { result } = renderUnbreakableVaultInvoke({ setInvokeFeedback });

    await act(async () => {
      await result.current(
        {
          method: "attemptBreak",
          name: "Attempt Break",
        } as never,
        {
          vaultId: "42",
          secret: "open sesame",
          attemptFeeGas: "0.1",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
            },
            { type: "Integer", value: "10000000" },
            { type: "String", value: "miniapp-unbreakablevault:attempt" },
          ],
        },
        {
          scriptHash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
          operation: "attemptBreak",
          args: [
            { type: "Integer", value: "42" },
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "ByteArray",
              value: Buffer.from("open sesame", "utf8").toString("base64"),
            },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Break attempt submitted: 0xvaultattempt",
    });
  });

  it("increases and claims Unbreakable Vault bounties with the direct contract flows", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xvaulttopup" });
    const invoke = jest.fn().mockResolvedValue({ txid: "0xvaultclaim" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple, invoke });
    const setInvokeFeedback = jest.fn();
    const { result } = renderUnbreakableVaultInvoke({ setInvokeFeedback });

    await act(async () => {
      await result.current(
        {
          method: "increaseBounty",
          name: "Increase Bounty",
        } as never,
        {
          vaultId: "42",
          bountyGas: "1.5",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
            },
            { type: "Integer", value: "150000000" },
            { type: "String", value: "miniapp-unbreakablevault:increase" },
          ],
        },
        {
          scriptHash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
          operation: "increaseBounty",
          args: [
            { type: "Integer", value: "42" },
            { type: "Integer", value: "150000000" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Bounty increased: 0xvaulttopup",
    });

    await act(async () => {
      await result.current(
        {
          method: "claimExpiredVault",
          name: "Claim Expired Vault",
        } as never,
        {
          vaultId: "42",
        },
      );
    });

    expect(invoke).toHaveBeenCalledWith({
      scriptHash: "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0",
      operation: "claimExpiredVault",
      args: [{ type: "Integer", value: "42" }],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Expired vault claimed: 0xvaultclaim",
    });
  });

  it("creates Red Envelope through the funded batch transaction path", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xredcreate" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/red-envelope",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-redenvelope" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
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
        {
          method: "createEnvelope",
          name: "Create",
          params: [
            {
              name: "creator",
              type: "hash160",
              required: true,
              default_value: "$wallet",
            },
            {
              name: "amount",
              type: "amount",
              label: "Total GAS",
              required: true,
              scale: 8,
            },
            {
              name: "packetCount",
              type: "integer",
              label: "Recipients",
              required: true,
            },
            {
              name: "expirySeconds",
              type: "integer",
              label: "Lifetime (seconds)",
              required: true,
            },
          ],
        } as never,
        { amount: "0.10", packetCount: "2", expirySeconds: "86400" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
            },
            { type: "Integer", value: "10000000" },
            { type: "String", value: "miniapp-redenvelope:create" },
          ],
        },
        {
          scriptHash: "0xfa1b7240fead2a63999c02defa3aec5eb274a919",
          operation: "createEnvelope",
          args: [
            {
              type: "Hash160",
              value: "0x69aa227309f35d7196d0d9f97fc22b33613a31eb",
            },
            { type: "Integer", value: "10000000" },
            { type: "Integer", value: "2" },
            { type: "Integer", value: "86400000" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Envelope created: 0xredcreate",
    });
  });

  it("creates NeoPay streams through the funded batch transaction path", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xneopaycreate" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/neo-pay",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-neo-pay" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
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
        {
          method: "createStream",
          name: "Create Stream",
          params: [
            {
              name: "creator",
              type: "hash160",
              required: true,
              default_value: "$wallet",
            },
            {
              name: "beneficiary",
              type: "hash160",
              required: true,
            },
            {
              name: "asset",
              type: "hash160",
              required: true,
              default_value: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            },
            {
              name: "totalAmount",
              type: "amount",
              label: "Total GAS",
              required: true,
              scale: 8,
            },
            {
              name: "rateAmount",
              type: "amount",
              label: "Daily release",
              required: true,
              scale: 8,
            },
            {
              name: "intervalSeconds",
              type: "integer",
              label: "Interval (seconds)",
              required: true,
            },
            {
              name: "title",
              type: "string",
              label: "Title",
              required: true,
            },
            {
              name: "notes",
              type: "string",
              label: "Notes",
              required: false,
            },
          ],
        } as never,
        {
          beneficiary: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          totalAmount: "0.03",
          rateAmount: "0.03",
          intervalSeconds: "86400",
          title: "Testnet payroll stream",
          notes: "frontend validation",
        },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
            },
            { type: "Integer", value: "3000000" },
            { type: "String", value: "stream:GAS:3000000" },
          ],
        },
        {
          scriptHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
          operation: "createStream",
          args: [
            {
              type: "Hash160",
              value: "0x69aa227309f35d7196d0d9f97fc22b33613a31eb",
            },
            {
              type: "Hash160",
              value: "0x69aa227309f35d7196d0d9f97fc22b33613a31eb",
            },
            { type: "Hash160", value: BLOCKCHAIN_CONSTANTS.GAS_HASH },
            { type: "Integer", value: "3000000" },
            { type: "Integer", value: "3000000" },
            { type: "Integer", value: "86400" },
            { type: "String", value: "Testnet payroll stream" },
            { type: "String", value: "frontend validation" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Stream created: 0xneopaycreate",
    });
  });

  it("creates SelfLoan loans through the funded PlatformDeFi batch path", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xselfloancreate" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/self-loan",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-self-loan" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: {
          mode: "platform",
          contractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        } as never,
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
        {
          method: "createLoan",
          name: "Create Loan",
          params: [
            {
              name: "appId",
              type: "string",
              required: true,
              default_value: "miniapp-self-loan",
              hidden: true,
            },
            {
              name: "borrower",
              type: "hash160",
              required: true,
              default_value: "$wallet",
              hidden: true,
            },
            {
              name: "collateralNeo",
              type: "integer",
              required: true,
            },
            {
              name: "ltvTier",
              type: "select",
              required: true,
            },
            {
              name: "poolTopupGas",
              type: "amount",
              required: false,
              scale: 8,
            },
          ],
        } as never,
        { collateralNeo: "1", ltvTier: "1", poolTopupGas: "0.30" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x39d4584ddb0731e48e611647931993ee033bf373",
            },
            { type: "Integer", value: "30000000" },
            { type: "String", value: "miniapp-self-loan:pool" },
          ],
        },
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x39d4584ddb0731e48e611647931993ee033bf373",
            },
            { type: "Integer", value: "1" },
            { type: "String", value: "miniapp-self-loan:collateral" },
          ],
        },
        {
          scriptHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
          operation: "createLoan",
          args: [
            { type: "String", value: "miniapp-self-loan" },
            {
              type: "Hash160",
              value: "0x69aa227309f35d7196d0d9f97fc22b33613a31eb",
            },
            { type: "Integer", value: "1" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Loan created: 0xselfloancreate",
    });
  });

  it("repays SelfLoan loans through a GAS credit batch path", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xselfloanrepay" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/self-loan",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-self-loan" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: {
          mode: "platform",
          contractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        } as never,
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
        {
          method: "repayLoan",
          name: "Repay Loan",
          params: [
            {
              name: "appId",
              type: "string",
              required: true,
              default_value: "miniapp-self-loan",
              hidden: true,
            },
            { name: "loanId", type: "integer", required: true },
            {
              name: "repayGas",
              type: "amount",
              required: true,
              scale: 8,
            },
          ],
        } as never,
        { loanId: "42", repayGas: "0.25" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x39d4584ddb0731e48e611647931993ee033bf373",
            },
            { type: "Integer", value: "25000000" },
            { type: "String", value: "miniapp-self-loan:repay" },
          ],
        },
        {
          scriptHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
          operation: "repayLoan",
          args: [
            { type: "String", value: "miniapp-self-loan" },
            { type: "Integer", value: "42" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Loan repayment submitted: 0xselfloanrepay",
    });
  });

  it("adds SelfLoan collateral through a NEO credit batch path", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xselfloanadd" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/self-loan",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-self-loan" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        launchContext: {} as never,
        networkAvailabilityReason: null,
        resolvedRuntime: {
          mode: "platform",
          contractHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
        } as never,
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
        {
          method: "addCollateral",
          name: "Add Collateral",
          params: [
            {
              name: "appId",
              type: "string",
              required: true,
              default_value: "miniapp-self-loan",
              hidden: true,
            },
            { name: "loanId", type: "integer", required: true },
            {
              name: "collateralNeo",
              type: "integer",
              required: true,
            },
          ],
        } as never,
        { loanId: "42", collateralNeo: "1" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0x39d4584ddb0731e48e611647931993ee033bf373",
            },
            { type: "Integer", value: "1" },
            { type: "String", value: "miniapp-self-loan:collateral" },
          ],
        },
        {
          scriptHash: "0x39d4584ddb0731e48e611647931993ee033bf373",
          operation: "addCollateral",
          args: [
            { type: "String", value: "miniapp-self-loan" },
            { type: "Integer", value: "42" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Collateral added: 0xselfloanadd",
    });
  });

  it("buries Graveyard memory through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xgravebury" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/graveyard",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-graveyard" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
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

    const contentHash =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    await act(async () => {
      await result.current(
        {
          method: "buryMemory",
          name: "Bury Memory",
        } as never,
        { contentHash, memoryType: "3", feeGas: "0.25" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
            },
            { type: "Integer", value: "25000000" },
            { type: "String", value: "miniapp-graveyard:memory" },
          ],
        },
        {
          scriptHash: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
          operation: "buryMemory",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            { type: "String", value: contentHash },
            { type: "Integer", value: "3" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Memory buried: 0xgravebury",
    });
  });

  it("forgets Graveyard memory through a funded batch transaction", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xgraveforget" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/graveyard",
      query: { network: "testnet" },
      replace: jest.fn(),
    };

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-graveyard" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
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
        {
          method: "forgetMemory",
          name: "Forget Memory",
        } as never,
        { memoryId: "42" },
      );
    });

    expect(invokeMultiple).toHaveBeenCalledWith(
      [
        {
          scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
          operation: "transfer",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            {
              type: "Hash160",
              value: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
            },
            { type: "Integer", value: "100000000" },
            { type: "String", value: "miniapp-graveyard:forget" },
          ],
        },
        {
          scriptHash: "0xb55aa635b10a5abb5cbac169db26a38df739778e",
          operation: "forgetMemory",
          args: [
            {
              type: "Hash160",
              value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            },
            { type: "Integer", value: "42" },
          ],
        },
      ],
      [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    );
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Memory forgotten: 0xgraveforget",
    });
  });

  it("tops up the Morpheus oracle request fee for VRF games", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xoraclefeetx" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const setInvokeFeedback = jest.fn();
    const router = {
      pathname: "/miniapps/fogplay",
      query: { network: "testnet" },
      replace: jest.fn(),
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            state: "HALT",
            stack: [{ type: "Integer", value: "10000000" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            state: "HALT",
            stack: [{ type: "Integer", value: "2500000" }],
          },
        }),
      }) as never;

    const { result } = renderHook(() =>
      useMiniAppDetailInvoke({
        app: { app_id: "miniapp-fogplay" } as never,
        appSupportsTargetNetwork: true,
        directContractHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
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
        { method: "fundOracleRequestFee", name: "Fund Oracle Fee" } as never,
        {},
      );
    });

    const oracleHash =
      EXTERNAL_INTEGRATIONS.testnet.contracts.morpheusOracle;
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/rpc/neo-read",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contractHash: oracleHash,
          method: "requestFee",
          params: [],
          network: "testnet",
        }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/rpc/neo-read",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contractHash: oracleHash,
          method: "feeCreditOf",
          params: [
            {
              type: "Hash160",
              value: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
            },
          ],
          network: "testnet",
        }),
      }),
    );
    expect(invoke).toHaveBeenCalledWith({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      operation: "transfer",
      args: [
        {
          type: "Hash160",
          value: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
        },
        { type: "Hash160", value: oracleHash },
        { type: "Integer", value: "7500000" },
        {
          type: "ByteArray",
          value: Buffer.from(
            "740671b10330ef6669ab8b2724437eb8d5e7a34c",
            "hex",
          )
            .reverse()
            .toString("base64"),
        },
      ],
      signers: [
        {
          account: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
          scopes: 1,
        },
      ],
    });
    expect(setInvokeFeedback).toHaveBeenLastCalledWith({
      type: "success",
      message: "Oracle fee funded: 0xoraclefeetx (0.075 GAS)",
    });
  });
});
