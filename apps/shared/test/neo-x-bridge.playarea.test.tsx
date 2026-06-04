import React from "react";
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
    emptyPayloadHint: "Use the workspace to prepare an asset or message bridge handoff.",
    notAvailable: "Not available",
    statusReady: "Ready",
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
  it("prepares an asset bridge handoff from the visible workspace", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.change(screen.getByLabelText("Destination address"), {
      target: { value: RECIPIENT },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare asset handoff" }));

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
      target: { value: "{\"event\":\"settled\"}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare message intent" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareMessageBridge", {
        direction: "n3-to-neox",
        targetContract: TARGET,
        method: "onCrossChainMessage",
        payload: "{\"event\":\"settled\"}",
        gasLimit: "250000",
      });
    });
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
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("0.1");
    expect((screen.getByLabelText("Destination address") as HTMLInputElement).value).toBe(
      N3_RECIPIENT,
    );
  });
});
