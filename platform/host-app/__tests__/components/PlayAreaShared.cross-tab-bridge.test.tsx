import React, { useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  HOST_WALLET_BRIDGE_STATE,
  useEmbeddedWalletBridge,
} from "@/components/playarea/bridge";
import { useWalletStore } from "@/lib/wallet/store";

const STORAGE_KEY = "neo-wallet";
const WALLET_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const WALLET_ACCOUNT_HASH = "0x1234567890abcdef1234567890abcdef12345678";
const PRODUCTION_SANDBOX =
  "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

function BridgeHarness({
  frame,
  network = "testnet",
}: {
  frame: HTMLIFrameElement;
  network?: "mainnet" | "testnet";
}) {
  const iframeRef = useRef<HTMLIFrameElement>(frame);
  useEmbeddedWalletBridge({ appId: "cross-tab-demo", iframeRef, network });
  return null;
}

function createBridgeFrame() {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", PRODUCTION_SANDBOX);
  frame.src = "/miniapps/demo/index.html?network=testnet&source=embed";
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow;
  if (!frameWindow) throw new Error("jsdom did not create an iframe contentWindow");
  const postSpy = jest
    .spyOn(frameWindow, "postMessage")
    .mockImplementation(() => undefined);
  return { frame, postSpy };
}

function writePersisted(state: Record<string, unknown>, version = 0) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
}

/**
 * Dispatch the cross-tab `storage` event another tab would observe. jsdom does
 * not synthesize this itself.
 */
function dispatchWalletStorageEvent(previousState: Record<string, unknown>) {
  const event = new StorageEvent("storage", {
    key: STORAGE_KEY,
    newValue: localStorage.getItem(STORAGE_KEY),
    oldValue: JSON.stringify({ state: previousState, version: 0 }),
    storageArea: localStorage,
    url: window.location.href,
  });
  window.dispatchEvent(event);
}

function statePacket(call: [Record<string, unknown>, string]) {
  return call[0];
}

function lastStateMessage(postSpy: jest.SpyInstance) {
  const call = [...postSpy.mock.calls]
    .reverse()
    .find(
      ([message]) =>
        (message as Record<string, unknown>)?.type === HOST_WALLET_BRIDGE_STATE,
    ) as [Record<string, unknown>, string] | undefined;
  if (!call) throw new Error("no bridge state message was posted");
  return statePacket(call);
}

describe("cross-tab wallet state -> embedded bridge convergence", () => {
  beforeEach(() => {
    localStorage.clear();
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
    document.body.innerHTML = "";
  });

  it("republishes a connected -> disconnected transition to the miniapp when another tab logs out", async () => {
    const { frame, postSpy } = createBridgeFrame();
    // This tab is connected.
    useWalletStore.setState({
      connected: true,
      address: WALLET_ADDRESS,
      accountHash: WALLET_ACCOUNT_HASH,
      publicKey: "02abcdef",
      network: "testnet",
      provider: "onegate",
    });
    render(<BridgeHarness frame={frame} />);
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

    // Another tab wiped the persisted identity.
    writePersisted({ provider: null, address: "" });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: WALLET_ADDRESS,
      network: "testnet",
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const packet = lastStateMessage(postSpy);
    expect(packet).toMatchObject({
      type: HOST_WALLET_BRIDGE_STATE,
      appId: "cross-tab-demo",
      protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
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

  it("republishes a network change to the miniapp when another tab switches chains", async () => {
    const { frame, postSpy } = createBridgeFrame();
    useWalletStore.setState({
      connected: true,
      address: WALLET_ADDRESS,
      accountHash: WALLET_ACCOUNT_HASH,
      publicKey: "02abcdef",
      network: "testnet",
      provider: "onegate",
    });
    render(<BridgeHarness frame={frame} />);
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

    // Another tab switched the persisted wallet to mainnet. The cross-tab
    // listener drops the local connection (network no longer matches this tab's
    // testnet target) and the bridge must republish the new state.
    writePersisted({
      provider: "onegate",
      address: WALLET_ADDRESS,
      accountHash: WALLET_ACCOUNT_HASH,
      publicKey: "02abcdef",
      network: "mainnet",
    });
    dispatchWalletStorageEvent({
      provider: "onegate",
      address: WALLET_ADDRESS,
      network: "testnet",
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const packet = lastStateMessage(postSpy);
    // The wallet is no longer connected on this tab's testnet target, so the
    // bridge reports disconnected while keeping the target chain stable.
    expect(packet.state).toMatchObject({
      connected: false,
      address: "",
      accountHash: "",
      network: 894710606,
      networkName: "testnet",
      networkVerified: false,
    });
  });
});
