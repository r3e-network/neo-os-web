import React, { useEffect } from "react";

import type {
  BridgeRecord,
  BridgeRequest,
  EmbeddedWalletBridgeErrorDetail,
} from "./types";
import { asBridgeString, buildEmbeddedWalletBridgeResultDetail, isBridgeRecord } from "./normalizers";
import {
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_REQUEST,
  HOST_WALLET_BRIDGE_RESPONSE,
  HOST_WALLET_BRIDGE_RESULT,
} from "./events";
import {
  SENSITIVE_BRIDGE_METHODS,
  confirmSensitiveBridgeOperation,
  handleEmbeddedWalletBridgeRequest,
  requireBridgeWallet,
} from "./request-handler";

export function useEmbeddedWalletBridge({
  appId,
  iframeRef,
  network,
}: {
  appId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  network: "mainnet" | "testnet";
}) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      const frameWindow = frame?.contentWindow;
      // Identity check: the message must originate from this exact embedded frame's window.
      if (!frameWindow || event.source !== frameWindow) return;

      // Audit fix (origin hardening): additionally allowlist the sender origin against the
      // frame's own src origin. Miniapps are first-party (served same-origin), so a legitimate
      // message's origin equals the frame origin — except when the frame is sandboxed without
      // allow-same-origin (audit fix C-4): such documents carry an opaque origin and their
      // messages arrive with origin "null". In that case the window-identity check above
      // remains the security boundary and only the literal "null" origin is accepted.
      let expectedOrigin = window.location.origin;
      try {
        expectedOrigin = new URL(frame!.src, window.location.href).origin;
      } catch {
        expectedOrigin = window.location.origin;
      }
      const sandboxTokens = frame!.getAttribute("sandbox");
      const frameHasOpaqueOrigin =
        sandboxTokens !== null &&
        !sandboxTokens
          .split(/\s+/)
          .some((token) => token.toLowerCase() === "allow-same-origin");
      if (frameHasOpaqueOrigin) {
        if (event.origin !== "null") return;
      } else if (event.origin !== expectedOrigin) {
        return;
      }

      const data = event.data as BridgeRequest;
      if (!isBridgeRecord(data) || data.type !== HOST_WALLET_BRIDGE_REQUEST) return;
      const id = asBridgeString(data.id);
      const method = asBridgeString(data.method);
      if (!id || !method) return;

      const reply = (response: BridgeRecord) => {
        // Sandboxed frames have an opaque origin that no targetOrigin string can name,
        // so the reply must use "*" — safe because it targets the exact window reference,
        // not a broadcast. Non-sandboxed frames keep the strict origin so a response
        // carrying a signature/txid cannot leak if the frame is ever navigated cross-origin.
        frameWindow.postMessage(
          {
            type: HOST_WALLET_BRIDGE_RESPONSE,
            id,
            appId,
            ...response,
          },
          frameHasOpaqueOrigin ? "*" : expectedOrigin,
        );
      };

      const dispatchBridgeError = (message: string, rejected: boolean) => {
        const detail: EmbeddedWalletBridgeErrorDetail = {
          appId,
          network,
          requestMethod: method,
          message,
          rejected,
          at: new Date().toISOString(),
        };
        window.dispatchEvent(
          new CustomEvent(HOST_WALLET_BRIDGE_ERROR, { detail }),
        );
      };

      // Audit fix (confirmation hardening): require explicit user approval before any signing
      // or fund-moving wallet operation requested by the embedded miniapp.
      if (SENSITIVE_BRIDGE_METHODS.has(method)) {
        // Validate the wallet/network BEFORE prompting — a disconnected or
        // wrong-network wallet should error immediately instead of asking the
        // user to approve a request that can never succeed. `invoke`/`send`
        // additionally require a verified (non-null) wallet network.
        try {
          requireBridgeWallet(network, {
            requireVerifiedNetwork: method === "invoke" || method === "send",
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          dispatchBridgeError(message, false);
          reply({ ok: false, error: { message } });
          return;
        }

        if (!confirmSensitiveBridgeOperation(appId, method, data.payload)) {
          dispatchBridgeError("User rejected the request.", true);
          reply({
            ok: false,
            error: { message: "User rejected the request." },
          });
          return;
        }
      }

      void handleEmbeddedWalletBridgeRequest(method, data.payload, network)
        .then((result) => {
          const detail = buildEmbeddedWalletBridgeResultDetail({
            appId,
            network,
            requestMethod: method,
            payload: data.payload,
            result,
          });
          if (detail.txid) {
            window.dispatchEvent(
              new CustomEvent(HOST_WALLET_BRIDGE_RESULT, { detail }),
            );
          }
          reply({ ok: true, result });
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          // Only sensitive (signing / fund-moving) failures get the host-side
          // notice; read failures stay scoped to the miniapp's own UI.
          if (SENSITIVE_BRIDGE_METHODS.has(method)) {
            dispatchBridgeError(message, false);
          }
          reply({ ok: false, error: { message } });
        });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId, iframeRef, network]);
}
