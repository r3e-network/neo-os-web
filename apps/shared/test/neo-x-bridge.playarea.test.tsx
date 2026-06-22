import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-x-bridge/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const RECIPIENT = "0x1111111111111111111111111111111111111111";
const TARGET = "0x2222222222222222222222222222222222222222";
const N3_RECIPIENT = "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke";

function t(key: string) {
  const messages: Record<string, string> = {
    emptyPayload: "No bridge intent prepared yet.",
    emptyPayloadHint:
      "Use the workspace to prepare an asset or message bridge handoff.",
    notAvailable: "Not available",
    statusReady: "Ready",
    // i18n keys consumed by the bridge console view
    direction: "Direction",
    amount: "Amount",
    destinationAddress: "Destination address",
    destinationPlaceholder: "Neo N3 or Neo X address",
    routeN3ToNeoX: "Neo N3 -> Neo X",
    routeNeoXToN3: "Neo X -> Neo N3",
    targetContract: "Target contract",
    targetMethod: "Target method",
    gasLimit: "Gas limit",
    messagePayload: "Message payload",
    messagePayloadRequired: "Enter a payload to send across the bridge.",
    operationId: "Operation ID",
    sourceTx: "Source transaction",
    bridgeKind: "Bridge type",
    assetBridge: "Asset Bridge",
    messageBridge: "Message Bridge",
    tabAsset: "Asset",
    tabMessage: "Message",
    tabTrack: "Track",
    bridgeStageAria: "Cross-chain route stage",
    bridgeStageIntent: "Intent",
    bridgeStageTarget: "Target",
    bridgeStagePreparing: "Preparing handoff",
    bridgeStageReady: "Route ready",
    bridgeStageWaiting: "Awaiting details",
    btnPrepareAsset: "Prepare asset handoff",
    btnPrepareMessage: "Prepare message intent",
    btnRefreshTracking: "Refresh tracking",
    noticeAssetReady: "Asset bridge handoff prepared.",
    noticeMessageReady: "Message bridge intent prepared.",
    noticeTrackingReady: "Bridge tracking timeline refreshed.",
    errBridgeGeneric: "Bridge handoff could not be prepared.",
    bridgeHeroImageAlt: "Cross-chain bridge route",
    routeCardTitle: "How the bridge moves GAS",
    routeAria: "Active route",
    routeSendLabel: "Send from",
    routeReceiveLabel: "Receive on",
    routeN3Wallet: "NEP-21 / NeoLine",
    routeNeoXWallet: "EVM / MetaMask",
    routeArrowAria: "moves to",
    handoffRailAria: "Bridge handoff rail",
    railSource: "Source",
    railAttest: "Attest",
    railAttestTitle: "Validator checkpoint",
    railAttestDetail: "Observed, signed, then released",
    railDestination: "Destination",
    errMessageForm:
      "Enter a valid target contract, payload, and a gas limit of at least 21000.",
    errSourceTx: "Enter a 0x-prefixed 64-character transaction hash.",
  };
  return messages[key] ?? key;
}

function baseState(): ObservableState {
  return {
    lastRoute: createObservable("Neo N3 -> Neo X"),
    lastKind: createObservable("asset"),
    lastDigest: createObservable("Not available"),
    lastStatus: createObservable("Ready"),
    lastPayload: createObservable("No bridge intent prepared yet."),
    operationsLog: createObservable([]),
    timeline: createObservable([]),
  };
}

function props(
  overrides: Partial<React.ComponentProps<typeof PlayArea>> = {},
): React.ComponentProps<typeof PlayArea> {
  return {
    t,
    state: baseState(),
    dispatch: vi.fn(async () => undefined),
    services: {
      clipboard: {
        copy: vi.fn(async () => undefined),
      },
    },
    status: null,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: {
      appId: "miniapp-neo-x-bridge",
      source: "url",
      operation: null,
      tab: null,
      network: "testnet",
      params: {},
      keys: [],
      hasParams: false,
      signature: "",
    },
    ...overrides,
  } as React.ComponentProps<typeof PlayArea>;
}

afterEach(() => cleanup());

describe("Neo X Bridge PlayArea", () => {
  it("renders a resource-led bridge route stage instead of opening on raw fields", () => {
    const { container } = render(<PlayArea {...props()} />);

    const stage = container.querySelector(".bridge-route-stage");
    expect(stage).toBeTruthy();
    expect(stage?.classList.contains("bridge-route-stage--asset")).toBe(true);
    expect(
      stage?.querySelector('.bridge-route-stage__media img[src="./bridge-route.jpg"]'),
    ).toBeTruthy();
    expect(stage?.querySelector(".bridge-route-stage__lane")).toBeTruthy();
    expect(stage?.querySelectorAll(".bridge-route-stage__packet").length).toBe(3);
    expect(screen.getByText("Awaiting details")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.change(screen.getByLabelText("Destination address"), {
      target: { value: RECIPIENT },
    });

    expect(
      container.querySelector(".bridge-route-stage--active"),
    ).toBeTruthy();
    expect(screen.getByText("Route ready")).toBeTruthy();
  });

  it("keeps the route-stage animation reduced-motion safe", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../neo-x-bridge/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes bridge-route-stage-sheen");
    expect(styles).toContain("@keyframes bridge-route-packet");
    expect(styles).toContain("@keyframes bridge-route-lane-pulse");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bridge-route-stage__packet[\s\S]*animation:\s*none/,
    );
  });

  it("prepares an asset bridge handoff from the visible workspace", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.change(screen.getByLabelText("Destination address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare asset handoff" }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge", {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: RECIPIENT,
      });
    });
  });

  it("prepares a Message Bridge intent with target, method, payload, and gas", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("tab", { name: "Message" }));
    fireEvent.change(screen.getByLabelText("Target contract"), {
      target: { value: TARGET },
    });
    fireEvent.change(screen.getByLabelText("Message payload"), {
      target: { value: '{"event":"settled"}' },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare message intent" }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareMessageBridge", {
        direction: "n3-to-neox",
        targetContract: TARGET,
        method: "onCrossChainMessage",
        payload: '{"event":"settled"}',
        gasLimit: "250000",
      });
    });
  });

  it("surfaces a required-payload error once the empty payload field is touched", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("tab", { name: "Message" }));
    const payload = screen.getByLabelText("Message payload");

    // No error before the user interacts with the field.
    expect(
      screen.queryByText("Enter a payload to send across the bridge."),
    ).toBeNull();

    fireEvent.blur(payload);

    await waitFor(() => {
      expect(
        screen.getByText("Enter a payload to send across the bridge."),
      ).toBeTruthy();
    });
    // The Prepare-message button stays disabled while the payload is empty.
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare message intent",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("turns complete launch params into the matching bridge action", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        {...props({
          dispatch,
          launchContext: {
            appId: "miniapp-neo-x-bridge",
            source: "onegate",
            operation: "bridgeAsset",
            tab: null,
            network: "testnet",
            params: {
              amount: "0.1",
              direction: "Neo X -> Neo N3",
              recipient: N3_RECIPIENT,
            },
            keys: ["amount", "direction", "recipient"],
            hasParams: true,
            signature: "amount=0.1&direction=Neo%20X%20-%3E%20Neo%20N3",
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge", {
        direction: "neox-to-n3",
        asset: "GAS",
        amount: "0.1",
        recipient: N3_RECIPIENT,
      });
    });
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
      "0.1",
    );
    expect(
      (screen.getByLabelText("Destination address") as HTMLInputElement).value,
    ).toBe(N3_RECIPIENT);
  });

  it("validates the source tx as a hash256 and disables tracking on a malformed hash", () => {
    render(<PlayArea {...props()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Track" }));
    const sourceInput = screen.getByLabelText("Source transaction");

    // A typo'd (non-hash256) value surfaces an inline error and blocks tracking.
    fireEvent.change(sourceInput, { target: { value: "0xnot-a-hash" } });
    expect(
      screen.getByText("Enter a 0x-prefixed 64-character transaction hash."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh tracking",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    // A well-formed hash256 clears the error and re-enables tracking.
    fireEvent.change(sourceInput, {
      target: { value: `0x${"a".repeat(64)}` },
    });
    expect(
      screen.queryByText("Enter a 0x-prefixed 64-character transaction hash."),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh tracking",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
