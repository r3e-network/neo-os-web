/**
 * useBridgeListener Hook
 *
 * React hook to listen for messages from miniapp iframes.
 */

import { useEffect, useCallback } from "react";
import { handleBridgeMessage } from "./handler";
import type { BridgeMessage } from "./types";

export function createBridgeListener(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  sendResponse: (response: unknown, origin: string, source: MessageEventSource | null) => void,
) {
  return async (event: MessageEvent) => {
    // Validate message source
    if (!event.data?.id || !event.data?.type) return;
    if (!event.data.type.startsWith("MULTICHAIN_")) return;
    const expectedSource = iframeRef.current?.contentWindow;
    if (!expectedSource || event.source !== expectedSource) return;

    const message = event.data as BridgeMessage;
    const response = await handleBridgeMessage(message, {
      source: event.source,
      origin: event.origin,
    });
    sendResponse(response, event.origin, event.source);
  };
}

export function useBridgeListener(iframeRef: React.RefObject<HTMLIFrameElement>) {
  const sendResponse = useCallback(
    (response: unknown, origin: string, source: MessageEventSource | null) => {
      const target = iframeRef.current?.contentWindow;
      if (!target || !source || source !== target) return;
      const targetOrigin = origin && origin !== "null" ? origin : "*";
      target.postMessage(response, targetOrigin);
    },
    [iframeRef],
  );

  useEffect(() => {
    const listener = createBridgeListener(iframeRef, sendResponse);

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [iframeRef, sendResponse]);
}
