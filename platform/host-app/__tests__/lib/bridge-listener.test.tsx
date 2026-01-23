import React from "react";
import { createBridgeListener } from "@/lib/bridge/useBridgeListener";

jest.mock("@/lib/bridge/handler", () => ({
  handleBridgeMessage: jest.fn(async () => ({ ok: true })),
}));

import { handleBridgeMessage } from "@/lib/bridge/handler";

describe("useBridgeListener", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ignores messages not from the iframe contentWindow", async () => {
    const iframeRef = { current: document.createElement("iframe") } as React.RefObject<HTMLIFrameElement>;
    const iframeWindow = { postMessage: jest.fn() } as unknown as Window;
    Object.defineProperty(iframeRef.current!, "contentWindow", { value: iframeWindow });

    const sendResponse = jest.fn();
    const listener = createBridgeListener(iframeRef, sendResponse);

    const otherWindow = { postMessage: jest.fn() } as unknown as Window;
    const event = new MessageEvent("message", {
      data: { id: "1", type: "MULTICHAIN_GET_CHAINS" },
      source: otherWindow,
      origin: "https://evil.example",
    });

    await listener(event);

    expect(handleBridgeMessage).not.toHaveBeenCalled();
  });

  it("responds to iframe messages using the event origin", async () => {
    const iframeRef = { current: document.createElement("iframe") } as React.RefObject<HTMLIFrameElement>;
    const iframeWindow = { postMessage: jest.fn() } as unknown as Window;
    Object.defineProperty(iframeRef.current!, "contentWindow", { value: iframeWindow });

    const sendResponse = jest.fn();
    const listener = createBridgeListener(iframeRef, sendResponse);

    const event = new MessageEvent("message", {
      data: { id: "1", type: "MULTICHAIN_GET_CHAINS" },
      source: iframeWindow,
      origin: "https://trusted.example",
    });

    await listener(event);

    expect(handleBridgeMessage).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true }, "https://trusted.example", iframeWindow);
  });
});
