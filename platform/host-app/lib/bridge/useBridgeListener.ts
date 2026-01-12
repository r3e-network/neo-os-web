/**
 * useBridgeListener Hook
 *
 * React hook to listen for messages from miniapp iframes.
 */

import { useEffect, useCallback } from "react";
import { handleBridgeMessage } from "./handler";
import type { BridgeMessage } from "./types";

export function useBridgeListener(iframeRef: React.RefObject<HTMLIFrameElement>) {
  const sendResponse = useCallback(
    (response: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(response, "*");
    },
    [iframeRef],
  );

  useEffect(() => {
    const listener = async (event: MessageEvent) => {
      // Validate message source
      if (!event.data?.id || !event.data?.type) return;
      if (!event.data.type.startsWith("MULTICHAIN_")) return;

      const message = event.data as BridgeMessage;
      const response = await handleBridgeMessage(message);
      sendResponse(response);
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [sendResponse]);
}
