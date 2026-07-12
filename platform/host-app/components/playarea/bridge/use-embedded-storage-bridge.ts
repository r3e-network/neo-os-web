import React, { useEffect } from "react";

const STORAGE_REQUEST = "neo-miniapp-storage:request";
const STORAGE_RESPONSE = "neo-miniapp-storage:response";
const STORAGE_PROTOCOL_VERSION = 1;
const SUPPORTED_APP_ID = "miniapp-zhuada-e";
const APP_KEY_PREFIX = "zhuada-e:";
const HOST_KEY_PREFIX = `neo-miniapp-storage:${SUPPORTED_APP_ID}:`;
const MAX_VALUE_LENGTH = 1_000_000;

interface StorageRequest {
  type?: unknown;
  version?: unknown;
  requestId?: unknown;
  appId?: unknown;
  op?: unknown;
  key?: unknown;
  value?: unknown;
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{8,96}$/i.test(value);
}

function validKey(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith(APP_KEY_PREFIX)
    && value.length <= 160;
}

/**
 * Local-only persistence for the trusted goose game inside the host's
 * opaque-origin sandbox. The source-window check is the security boundary;
 * no wallet/session keys are exposed and every game key is namespaced twice.
 */
export function useEmbeddedStorageBridge({
  appId,
  iframeRef,
}: {
  appId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
  useEffect(() => {
    if (appId !== SUPPORTED_APP_ID) return undefined;

    const onMessage = (event: MessageEvent): void => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;
      // Sandboxed documents without allow-same-origin have the literal null
      // origin. Reject any other sender even if a test or browser quirk reuses
      // a WindowProxy.
      if (event.origin !== "null") return;
      const request = event.data as StorageRequest | null;
      if (
        !request
        || request.type !== STORAGE_REQUEST
        || request.version !== STORAGE_PROTOCOL_VERSION
        || request.appId !== SUPPORTED_APP_ID
        || !validRequestId(request.requestId)
      ) return;

      const reply = (ok: boolean, extra: Record<string, unknown> = {}): void => {
        frameWindow.postMessage({
          type: STORAGE_RESPONSE,
          version: STORAGE_PROTOCOL_VERSION,
          requestId: request.requestId,
          ok,
          ...extra,
        }, "*");
      };

      try {
        if (request.op === "getAll") {
          const values: Record<string, string> = {};
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const hostKey = window.localStorage.key(index);
            if (!hostKey?.startsWith(HOST_KEY_PREFIX)) continue;
            const appKey = hostKey.slice(HOST_KEY_PREFIX.length);
            if (!validKey(appKey)) continue;
            const value = window.localStorage.getItem(hostKey);
            if (value !== null) values[appKey] = value;
          }
          reply(true, { values });
          return;
        }
        if (!validKey(request.key)) {
          reply(false, { error: "invalid-key" });
          return;
        }
        const hostKey = `${HOST_KEY_PREFIX}${request.key}`;
        if (request.op === "set") {
          if (typeof request.value !== "string" || request.value.length > MAX_VALUE_LENGTH) {
            reply(false, { error: "invalid-value" });
            return;
          }
          window.localStorage.setItem(hostKey, request.value);
          reply(true);
          return;
        }
        if (request.op === "remove") {
          window.localStorage.removeItem(hostKey);
          reply(true);
          return;
        }
        reply(false, { error: "invalid-operation" });
      } catch {
        reply(false, { error: "storage-unavailable" });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId, iframeRef]);
}
