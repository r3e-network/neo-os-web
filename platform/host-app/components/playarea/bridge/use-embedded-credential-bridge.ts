import { CREDENTIAL_BRIDGE } from "@shared/protocol/host-bridges";
import React, { useEffect } from "react";

export const CREDENTIAL_BRIDGE_REQUEST = CREDENTIAL_BRIDGE.REQUEST;
export const CREDENTIAL_BRIDGE_RESPONSE = CREDENTIAL_BRIDGE.RESPONSE;
export const CREDENTIAL_BRIDGE_PROTOCOL_VERSION = CREDENTIAL_BRIDGE.PROTOCOL_VERSION;
// The single first-party app allowed to receive the host gateway credential
// (audit fix C-4 follow-up). Automation Copilot lost its app-scoped
// allow-same-origin sandbox grant — the storage read it used for the signed-in
// session is dead by design — so the host now hands the credential to exactly
// this canonical app id over the postMessage bridge. This is intentionally NOT
// a generic token faucet: extending it to another app requires adding an
// explicit entry here plus a scope the host recognizes.
export const CREDENTIAL_BRIDGE_SUPPORTED_APP_ID = CREDENTIAL_BRIDGE.SUPPORTED_APP_ID;
// The only credential scope the bridge serves. The scope names what the
// credential is for (the /api/edge automation gateway), so a future request
// for any other capability fails closed instead of receiving the session JWT.
export const CREDENTIAL_BRIDGE_SCOPE = "automation-gateway";

interface CredentialBridgeRequest {
  type?: unknown;
  version?: unknown;
  requestId?: unknown;
  appId?: unknown;
  scope?: unknown;
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{8,96}$/i.test(value);
}

// Reads the host's own session credential exactly like the host fetch client
// does (sessionStorage `sb-access-token`, localStorage `neo_miniapp_auth_jwt`
// mirror written by lib/auth/store.ts). Runs in the host window — never inside
// the sandboxed miniapp document.
function readHostRuntimeValue(keys: string[]): string {
  if (typeof window === "undefined") return "";
  const stores: Storage[] = [];
  try {
    if (window.sessionStorage) stores.push(window.sessionStorage);
  } catch {
    // ignore unavailable storage
  }
  try {
    if (window.localStorage) stores.push(window.localStorage);
  } catch {
    // ignore unavailable storage
  }
  for (const store of stores) {
    for (const key of keys) {
      try {
        const value = store.getItem(key)?.trim();
        if (value) return value;
      } catch {
        // ignore unreadable storage
      }
    }
  }
  return "";
}

/**
 * Host side of the credential bridge for the first-party Automation Copilot.
 *
 * Audit fix C-4 restored the opaque-origin sandbox on every miniapp iframe, so
 * the copilot's gateway client can no longer read the host session token from
 * same-origin storage. This hook delivers that credential over the existing
 * host<->miniapp postMessage pattern instead, with the same security boundary
 * as the storage bridge: the hook only mounts for the canonical copilot app
 * id, the sender must be that exact iframe's contentWindow, and — because the
 * sandbox omits allow-same-origin — the message origin must be the literal
 * "null" opaque origin. Delivery is read-only (the miniapp can never write a
 * credential into the host) and mirrors the header preference of the gateway
 * client: the API key is only shared when no session token exists.
 */
export function useEmbeddedCredentialBridge({
  appId,
  iframeRef,
}: {
  appId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
  useEffect(() => {
    if (appId !== CREDENTIAL_BRIDGE_SUPPORTED_APP_ID) return undefined;

    const onMessage = (event: MessageEvent): void => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;
      // Sandboxed documents without allow-same-origin have the literal null
      // origin. Reject any other sender even if a test or browser quirk reuses
      // a WindowProxy.
      if (event.origin !== "null") return;
      const request = event.data as CredentialBridgeRequest | null;
      if (
        !request
        || request.type !== CREDENTIAL_BRIDGE_REQUEST
        || request.version !== CREDENTIAL_BRIDGE_PROTOCOL_VERSION
        || request.appId !== CREDENTIAL_BRIDGE_SUPPORTED_APP_ID
        || request.scope !== CREDENTIAL_BRIDGE_SCOPE
        || !validRequestId(request.requestId)
      ) return;

      const token = readHostRuntimeValue([
        "sb-access-token",
        "neo_miniapp_auth_jwt",
      ]);
      // Only expose the API key when there is no session token; the gateway
      // client sends X-API-Key only in that case, so sharing both would leak
      // a credential the copilot never uses.
      const apiKey = token ? "" : readHostRuntimeValue(["neo_miniapp_api_key"]);

      // The opaque origin cannot be named by any targetOrigin string, so the
      // reply uses "*" — safe because it targets the exact window reference.
      frameWindow.postMessage({
        type: CREDENTIAL_BRIDGE_RESPONSE,
        version: CREDENTIAL_BRIDGE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        token,
        apiKey,
      }, "*");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId, iframeRef]);
}
