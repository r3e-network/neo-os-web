import React, { useEffect } from "react";

import { useWalletStore } from "@/lib/wallet/store";

import type {
  BridgeRecord,
  BridgeRequest,
  EmbeddedWalletBridgeErrorDetail,
} from "./types";
import {
  asBridgeString,
  bridgeNetworkMagic,
  buildEmbeddedWalletBridgeResultDetail,
  isBridgeRecord,
} from "./normalizers";
import {
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS,
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  HOST_WALLET_BRIDGE_REQUEST,
  HOST_WALLET_BRIDGE_RESPONSE,
  HOST_WALLET_BRIDGE_RESULT,
  HOST_WALLET_BRIDGE_STATE,
  isCompatibleBridgeProtocolVersion,
} from "./events";
import {
  SENSITIVE_BRIDGE_METHODS,
  confirmSensitiveBridgeOperation,
  handleEmbeddedWalletBridgeRequest,
  preflightEmbeddedWalletBridgeRequest,
} from "./request-handler";

// Coerce the declared protocol version from the wire envelope. A missing field
// (pre-negotiation miniapps) yields `undefined`, which the compatibility check
// treats as the current baseline. Anything that is present but not a finite
// integer is reported as-is so the negotiation step can fail closed on it.
function normalizeBridgeProtocolVersion(
  value: unknown,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  // Present but unparseable — surface a sentinel that is never in the
  // compatible set so the request is rejected rather than silently accepted.
  return Number.NaN;
}

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
    const resolveFrameTarget = () => {
      const frame = iframeRef.current;
      const frameWindow = frame?.contentWindow;
      if (!frame || !frameWindow) return null;

      // Audit fix (origin hardening): additionally allowlist the sender origin against the
      // frame's own src origin. Miniapps are first-party (served same-origin), so a legitimate
      // message's origin equals the frame origin — except when the frame is sandboxed without
      // allow-same-origin (audit fix C-4): such documents carry an opaque origin and their
      // messages arrive with origin "null". In that case the window-identity check remains the
      // security boundary and only the literal "null" origin is accepted.
      let expectedOrigin = window.location.origin;
      try {
        expectedOrigin = new URL(frame.src, window.location.href).origin;
      } catch {
        expectedOrigin = window.location.origin;
      }
      const sandboxTokens = frame.getAttribute("sandbox");
      const frameHasOpaqueOrigin =
        sandboxTokens !== null &&
        !sandboxTokens
          .split(/\s+/)
          .some((token) => token.toLowerCase() === "allow-same-origin");

      return { frame, frameWindow, expectedOrigin, frameHasOpaqueOrigin };
    };

    const postToFrame = (message: BridgeRecord) => {
      const target = resolveFrameTarget();
      if (!target) return;
      target.frameWindow.postMessage(
        message,
        target.frameHasOpaqueOrigin ? "*" : target.expectedOrigin,
      );
    };

    const publishWalletState = (state: ReturnType<typeof useWalletStore.getState>) => {
      postToFrame({
        type: HOST_WALLET_BRIDGE_STATE,
        appId,
        protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
        state: {
          connected: Boolean(state.connected && state.address),
          address: state.connected ? state.address : "",
          accountHash: state.connected ? state.accountHash : "",
          network: state.network ? bridgeNetworkMagic(state.network) : null,
          networkName: state.network,
          networkVerified: Boolean(state.network),
        },
      });
    };

    publishWalletState(useWalletStore.getState());
    const frame = iframeRef.current;
    const publishCurrentWalletState = () =>
      publishWalletState(useWalletStore.getState());
    frame?.addEventListener("load", publishCurrentWalletState);

    const unsubscribeWalletState = useWalletStore.subscribe(
      (state, previousState) => {
        if (
          state.connected === previousState.connected &&
          state.address === previousState.address &&
          state.accountHash === previousState.accountHash &&
          state.network === previousState.network
        ) {
          return;
        }
        publishWalletState(state);
      },
    );

    const onMessage = (event: MessageEvent) => {
      const target = resolveFrameTarget();
      const frameWindow = target?.frameWindow;
      // Identity check: the message must originate from this exact embedded frame's window.
      if (!frameWindow || event.source !== frameWindow) return;

      if (target.frameHasOpaqueOrigin) {
        if (event.origin !== "null") return;
      } else if (event.origin !== target.expectedOrigin) {
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
            // Stamp the host's protocol version on every response so the
            // embedded SDK can validate/negotiate the reply lane symmetrically.
            protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
            ...response,
          },
          target.frameHasOpaqueOrigin ? "*" : target.expectedOrigin,
        );
      };

      // Protocol negotiation: reject envelopes that declare an incompatible
      // wallet-bridge version before doing any wallet work. A missing version
      // is the pre-negotiation baseline and is accepted (backward compatible);
      // a present-but-incompatible version fails closed with a clear error so
      // the miniapp can surface an "update required" message instead of having
      // a malformed request silently mishandled.
      const requestProtocolVersion = normalizeBridgeProtocolVersion(
        data.protocolVersion,
      );
      if (!isCompatibleBridgeProtocolVersion(requestProtocolVersion)) {
        reply({
          ok: false,
          error: {
            message: `Unsupported wallet bridge protocol version ${String(
              data.protocolVersion,
            )}. This host speaks version(s) ${HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS.join(
              ", ",
            )}.`,
          },
        });
        return;
      }

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

      const executeRequest = () =>
        handleEmbeddedWalletBridgeRequest(method, data.payload, network)
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

      // Audit fix (confirmation hardening): require explicit user approval before any signing
      // or fund-moving wallet operation requested by the embedded miniapp.
      if (SENSITIVE_BRIDGE_METHODS.has(method)) {
        // Validate the wallet/network BEFORE prompting — including a fresh
        // adapter.getNetwork() read — so a disconnected, wrong-network, or
        // stale-cache wallet errors immediately instead of asking the user to
        // approve a request that can never safely proceed.
        void preflightEmbeddedWalletBridgeRequest(method, network)
          .then(() => {
            if (!confirmSensitiveBridgeOperation(appId, method, data.payload)) {
              dispatchBridgeError("User rejected the request.", true);
              reply({
                ok: false,
                error: { message: "User rejected the request." },
              });
              return;
            }
            void executeRequest();
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            dispatchBridgeError(message, false);
            reply({ ok: false, error: { message } });
          });
        return;
      }

      void executeRequest();
    };

    window.addEventListener("message", onMessage);
    return () => {
      unsubscribeWalletState();
      frame?.removeEventListener("load", publishCurrentWalletState);
      window.removeEventListener("message", onMessage);
    };
  }, [appId, iframeRef, network]);
}
