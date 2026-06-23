import React, { useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  HOST_WALLET_BRIDGE_STATE,
  useEmbeddedWalletBridge,
  type EmbeddedWalletBridgeErrorDetail,
} from "../../components/playarea/PlayAreaShared";

const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
const WALLET_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const WALLET_ACCOUNT_HASH = "0x1234567890abcdef1234567890abcdef12345678";
const TARGET_CONTRACT = "0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b";
// The production sandbox value from EmbeddedDappSurface (audit fix C-4: no
// allow-same-origin), which gives the miniapp document an opaque origin so its
// postMessage events arrive at the host with origin "null".
const PRODUCTION_SANDBOX =
  "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

const mockWalletState: {
  connected: boolean;
  address: string;
  accountHash: string;
  publicKey: string;
  network: "mainnet" | "testnet" | null;
} = {
  connected: true,
  address: WALLET_ADDRESS,
  accountHash: WALLET_ACCOUNT_HASH,
  publicKey: "02abcdef",
  network: "testnet",
};
const mockWalletListeners = new Set<
  (
    state: typeof mockWalletState,
    previousState: typeof mockWalletState,
  ) => void
>();

const mockAdapter = {
  invoke: jest.fn(),
  invokeMultiple: jest.fn(),
  getBalance: jest.fn(),
  getNetwork: jest.fn(),
  signMessage: jest.fn(),
  send: jest.fn(),
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: {
    getState: () => mockWalletState,
    setState: (next: Partial<typeof mockWalletState>) => {
      const previous = { ...mockWalletState };
      Object.assign(mockWalletState, next);
      mockWalletListeners.forEach((listener) =>
        listener(mockWalletState, previous),
      );
    },
    subscribe: (
      listener: (
        state: typeof mockWalletState,
        previousState: typeof mockWalletState,
      ) => void,
    ) => {
      mockWalletListeners.add(listener);
      return () => mockWalletListeners.delete(listener);
    },
  },
  getWalletAdapter: () => mockAdapter,
}));

function BridgeHarness({
  frame,
  network = "testnet",
}: {
  frame: HTMLIFrameElement;
  network?: "mainnet" | "testnet";
}) {
  const iframeRef = useRef<HTMLIFrameElement>(frame);
  useEmbeddedWalletBridge({ appId: "miniapp-demo", iframeRef, network });
  return null;
}

function createBridgeFrame(sandbox: string | null) {
  const frame = document.createElement("iframe");
  if (sandbox !== null) frame.setAttribute("sandbox", sandbox);
  frame.src = "/miniapps/demo/index.html?network=testnet&source=embed";
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow;
  if (!frameWindow) throw new Error("jsdom did not create an iframe contentWindow");
  const postSpy = jest
    .spyOn(frameWindow, "postMessage")
    .mockImplementation(() => undefined);
  return { frame, frameWindow, postSpy };
}

function dispatchBridgeMessage({
  origin,
  source,
  data,
}: {
  origin: string;
  source: unknown;
  data: unknown;
}) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      source: source as Window,
      data,
    }),
  );
}

function bridgeRequest(
  method: string,
  payload?: unknown,
  options: { protocolVersion?: number | string | null } = {},
) {
  const request: Record<string, unknown> = {
    type: HOST_WALLET_BRIDGE_REQUEST,
    id: "req-1",
    method,
    payload,
    version: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  };
  if ("protocolVersion" in options) {
    request.protocolVersion = options.protocolVersion;
  } else {
    request.protocolVersion = HOST_WALLET_BRIDGE_PROTOCOL_VERSION;
  }
  return request;
}

async function flushBridgeHandlers() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function lastReply(postSpy: jest.SpyInstance) {
  await waitFor(() =>
    expect(
      postSpy.mock.calls.some(
        ([message]) =>
          (message as Record<string, unknown>)?.type ===
          HOST_WALLET_BRIDGE_RESPONSE,
      ),
    ).toBe(true),
  );
  const call = [...postSpy.mock.calls].reverse().find(
    ([message]) =>
      (message as Record<string, unknown>)?.type ===
      HOST_WALLET_BRIDGE_RESPONSE,
  ) as [Record<string, unknown>, string];
  return { message: call[0], targetOrigin: call[1] };
}

describe("useEmbeddedWalletBridge origin gating", () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWalletState.connected = true;
    mockWalletState.address = WALLET_ADDRESS;
    mockWalletState.accountHash = WALLET_ACCOUNT_HASH;
    mockWalletState.network = "testnet";
    mockWalletListeners.clear();
    mockAdapter.getNetwork.mockReset().mockResolvedValue("testnet");
    mockAdapter.invoke.mockReset().mockResolvedValue({ txid: "0xfeed" });
    mockAdapter.send.mockReset().mockResolvedValue({ txid: "0xsent" });
    mockAdapter.signMessage.mockReset().mockResolvedValue({ signature: "0xsig" });
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("accepts origin 'null' from the sandboxed frame and replies via '*'", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    const { message, targetOrigin } = await lastReply(postSpy);
    expect(targetOrigin).toBe("*");
    expect(message).toMatchObject({
      type: HOST_WALLET_BRIDGE_RESPONSE,
      id: "req-1",
      appId: "miniapp-demo",
      ok: true,
    });
    expect(message.result).toEqual([
      expect.objectContaining({
        hash: WALLET_ACCOUNT_HASH,
        accountHash: WALLET_ACCOUNT_HASH,
        address: WALLET_ADDRESS,
      }),
    ]);
  });

  it("pushes wallet state changes to the embedded frame immediately", async () => {
    const { frame, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);
    await flushBridgeHandlers();
    postSpy.mockClear();

    const nextAccountHash = "0x2222222222222222222222222222222222222222";
    mockWalletState.publicKey = "03changed";
    jest.requireMock("@/lib/wallet/store").useWalletStore.setState({
      connected: true,
      address: "NChangedWallet",
      accountHash: nextAccountHash,
      network: "testnet",
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const call = postSpy.mock.calls[0] as [Record<string, unknown>, string];
    expect(call[1]).toBe("*");
    expect(call[0]).toMatchObject({
      type: HOST_WALLET_BRIDGE_STATE,
      appId: "miniapp-demo",
      protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
      state: {
        connected: true,
        address: "NChangedWallet",
        accountHash: nextAccountHash,
        network: 894710606,
        networkName: "testnet",
        networkVerified: true,
      },
    });
  });

  it("publishes a disconnected state immediately when the host target network changes", async () => {
    const { frame, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    const { rerender } = render(
      <BridgeHarness frame={frame} network="testnet" />,
    );
    await waitFor(() =>
      expect(
        postSpy.mock.calls.some(
          ([message]) =>
            (message as Record<string, unknown>)?.type ===
            HOST_WALLET_BRIDGE_STATE,
        ),
      ).toBe(true),
    );
    postSpy.mockClear();

    rerender(<BridgeHarness frame={frame} network="mainnet" />);

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const call = postSpy.mock.calls[0] as [Record<string, unknown>, string];
    expect(call[1]).toBe("*");
    expect(call[0]).toMatchObject({
      type: HOST_WALLET_BRIDGE_STATE,
      appId: "miniapp-demo",
      protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
      state: {
        connected: false,
        address: "",
        accountHash: "",
        network: 860833102,
        networkName: "mainnet",
        networkVerified: false,
      },
    });
  });

  it("keeps the iframe target chain stable when the wallet network is unverified", async () => {
    const { frame, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    render(<BridgeHarness frame={frame} network="testnet" />);

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const call = postSpy.mock.calls[0] as [Record<string, unknown>, string];
    expect(call[0]).toMatchObject({
      type: HOST_WALLET_BRIDGE_STATE,
      state: {
        connected: false,
        address: "",
        accountHash: "",
        network: 894710606,
        networkName: "testnet",
        networkVerified: false,
      },
    });
  });

  it("drops messages whose source is not the embedded frame window", async () => {
    const { frame, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);
    await flushBridgeHandlers();
    postSpy.mockClear();

    dispatchBridgeMessage({
      origin: "null",
      source: window,
      data: bridgeRequest("getAccounts"),
    });

    await flushBridgeHandlers();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("drops origin 'null' when the frame is not sandboxed", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(null);
    render(<BridgeHarness frame={frame} />);
    await flushBridgeHandlers();
    postSpy.mockClear();

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    await flushBridgeHandlers();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("drops origin 'null' when the sandbox includes allow-same-origin", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(
      "allow-scripts allow-same-origin",
    );
    render(<BridgeHarness frame={frame} />);
    await flushBridgeHandlers();
    postSpy.mockClear();

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    await flushBridgeHandlers();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("accepts the frame src origin for a non-sandboxed frame and replies to it", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(null);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: window.location.origin,
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    const { message, targetOrigin } = await lastReply(postSpy);
    expect(targetOrigin).toBe(window.location.origin);
    expect(message).toMatchObject({ ok: true });
  });

  it("drops a foreign origin on a non-sandboxed frame", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(null);
    render(<BridgeHarness frame={frame} />);
    await flushBridgeHandlers();
    postSpy.mockClear();

    dispatchBridgeMessage({
      origin: "https://evil.example",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    await flushBridgeHandlers();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("shows the real target contract and signer scope in the confirmation prompt", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    confirmSpy.mockReturnValue(false);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
        signers: [{ account: WALLET_ADDRESS, scopes: "CalledByEntry" }],
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const prompt = String(confirmSpy.mock.calls[0][0]);
    expect(prompt).toContain(TARGET_CONTRACT);
    expect(prompt).toContain("transfer");
    expect(prompt).toContain("CalledByEntry");
    expect(message).toMatchObject({
      ok: false,
      error: { message: "User rejected the request." },
    });
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("executes a confirmed invoke against the contract shown in the prompt", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: true, result: { txid: "0xfeed" } });
    expect(mockAdapter.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptHash: TARGET_CONTRACT,
        operation: "transfer",
      }),
    );
    const prompt = String(confirmSpy.mock.calls[0][0]);
    expect(prompt).toContain(TARGET_CONTRACT);
  });

  it("validates the wallet BEFORE prompting for confirmation (disconnected)", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.connected = false;
    mockWalletState.address = "";
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
      }),
    });

    const { message } = await lastReply(postSpy);
    // A disconnected wallet must error immediately — never ask the user to
    // approve a request that cannot succeed.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /Connect wallet/i,
    );
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("validates the wallet network BEFORE prompting for confirmation (unverified)", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    mockAdapter.getNetwork.mockResolvedValue(null);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /unverified/,
    );
  });

  it("rejects WitnessRules signers instead of silently widening the witness", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
        signers: [
          {
            account: WALLET_ADDRESS,
            scopes: "WitnessRules",
            rules: [{ action: "Allow", condition: { type: "CalledByEntry" } }],
          },
        ],
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /WitnessRules/,
    );
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("refuses invoke when the wallet network is unverified", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    mockAdapter.getNetwork.mockResolvedValue(null);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("invoke", {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /unverified/,
    );
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("refuses send when the wallet network is unverified", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    mockAdapter.getNetwork.mockResolvedValue(null);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("send", {
        asset: "GAS",
        amount: "1",
        to: WALLET_ADDRESS,
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /unverified/,
    );
    expect(mockAdapter.send).not.toHaveBeenCalled();
  });

  it("refuses signMessage when the wallet network is unverified before prompting", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    mockAdapter.getNetwork.mockResolvedValue(null);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("signMessage", { message: "authorize session" }),
    });

    const { message } = await lastReply(postSpy);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /unverified/,
    );
    expect(mockAdapter.signMessage).not.toHaveBeenCalled();
  });

  it("fresh-checks the wallet network before prompting for signMessage", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = "testnet";
    mockAdapter.getNetwork.mockResolvedValue("mainnet");
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("signMessage", { message: "authorize session" }),
    });

    const { message } = await lastReply(postSpy);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /targets testnet/,
    );
    expect(mockAdapter.signMessage).not.toHaveBeenCalled();
    expect(mockWalletState.network).toBe("mainnet");
  });

  it("still serves getAccounts when the wallet network is unverified", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockWalletState.network = null;
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: true });
  });

  it("broadcasts a host-side error event when a sensitive request is rejected", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    confirmSpy.mockReturnValue(false);
    const errorEvents: EmbeddedWalletBridgeErrorDetail[] = [];
    const onBridgeError = (event: Event) => {
      errorEvents.push(
        (event as CustomEvent<EmbeddedWalletBridgeErrorDetail>).detail,
      );
    };
    window.addEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    try {
      render(<BridgeHarness frame={frame} />);

      dispatchBridgeMessage({
        origin: "null",
        source: frameWindow,
        data: bridgeRequest("invoke", {
          invocations: [
            { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
          ],
        }),
      });

      await lastReply(postSpy);
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        appId: "miniapp-demo",
        network: "testnet",
        requestMethod: "invoke",
        message: "User rejected the request.",
        rejected: true,
      });
    } finally {
      window.removeEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    }
  });

  it("broadcasts a host-side error event when a sensitive request fails", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    mockAdapter.invoke.mockRejectedValue(new Error("Wallet exploded."));
    const errorEvents: EmbeddedWalletBridgeErrorDetail[] = [];
    const onBridgeError = (event: Event) => {
      errorEvents.push(
        (event as CustomEvent<EmbeddedWalletBridgeErrorDetail>).detail,
      );
    };
    window.addEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    try {
      render(<BridgeHarness frame={frame} />);

      dispatchBridgeMessage({
        origin: "null",
        source: frameWindow,
        data: bridgeRequest("invoke", {
          invocations: [
            { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
          ],
        }),
      });

      const { message } = await lastReply(postSpy);
      expect(message).toMatchObject({ ok: false });
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        message: "Wallet exploded.",
        rejected: false,
      });
    } finally {
      window.removeEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    }
  });

  it("does not broadcast host-side errors for failed reads", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    const errorEvents: Event[] = [];
    const onBridgeError = (event: Event) => errorEvents.push(event);
    window.addEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    try {
      render(<BridgeHarness frame={frame} />);

      dispatchBridgeMessage({
        origin: "null",
        source: frameWindow,
        // Missing invocation payload makes the read request fail.
        data: bridgeRequest("call", {}),
      });

      const { message } = await lastReply(postSpy);
      expect(message).toMatchObject({ ok: false });
      expect(errorEvents).toHaveLength(0);
    } finally {
      window.removeEventListener(HOST_WALLET_BRIDGE_ERROR, onBridgeError);
    }
  });

  it("stamps the host protocol version on every response", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts"),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: true });
    expect(message.protocolVersion).toBe(HOST_WALLET_BRIDGE_PROTOCOL_VERSION);
  });

  it("accepts a request that omits the protocol version (pre-negotiation baseline)", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      // An older miniapp built before negotiation sends no version field.
      data: bridgeRequest("getAccounts", undefined, { protocolVersion: null }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: true });
    expect(message.protocolVersion).toBe(HOST_WALLET_BRIDGE_PROTOCOL_VERSION);
  });

  it("rejects a request that declares an incompatible protocol version", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts", undefined, {
        protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION + 1,
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /Unsupported wallet bridge protocol version/,
    );
    // A version mismatch must fail closed before any wallet work happens.
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("rejects a request whose protocol version is present but malformed", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest("getAccounts", undefined, {
        protocolVersion: "garbage",
      }),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(String((message.error as { message?: string })?.message)).toMatch(
      /Unsupported wallet bridge protocol version/,
    );
  });

  it("never prompts the user when the protocol version is incompatible", async () => {
    const { frame, frameWindow, postSpy } = createBridgeFrame(PRODUCTION_SANDBOX);
    render(<BridgeHarness frame={frame} />);

    dispatchBridgeMessage({
      origin: "null",
      source: frameWindow,
      data: bridgeRequest(
        "invoke",
        {
          invocations: [
            { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
          ],
        },
        { protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION + 1 },
      ),
    });

    const { message } = await lastReply(postSpy);
    expect(message).toMatchObject({ ok: false });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });
});
