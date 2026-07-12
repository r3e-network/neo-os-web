import React, { useEffect } from "react";

const STORAGE_REQUEST = "neo-miniapp-storage:request";
const STORAGE_RESPONSE = "neo-miniapp-storage:response";
const STORAGE_PROTOCOL_VERSION = 1;
const MAX_KEY_LENGTH = 160;

interface EmbeddedStorageAppConfig {
  /** Every wire key must start with this app namespace. */
  appKeyPrefix: string;
  /** Host localStorage prefix prepended to the wire key. */
  hostKeyPrefix: string;
  /** Per-write value ceiling for this app's payloads. */
  maxValueLength: number;
}

/**
 * Per-app allowlist for the local storage bridge. This is intentionally NOT a
 * generic storage faucet: an app only gets a lane by adding an explicit entry
 * here, every wire key must carry the app's own namespace, and the hook only
 * mounts for the exact iframe whose appId matches.
 *
 * - miniapp-zhuada-e: fire-and-forget goose game saves; host keys are
 *   double-namespaced (bridge prefix + game prefix) as defense in depth.
 * - miniapp-forever-album (audit fix C-4 follow-up): the album lost the
 *   allow-same-origin grant that let its embedded iframe write host-origin
 *   localStorage directly, so its device-local photo persistence now flows
 *   over this bridge. hostKeyPrefix is empty on purpose: the host stores the
 *   exact "forever-album:…" keys the pop-out window and pre-C-4 embeds
 *   already use, so one wallet keeps one album across every runtime mode and
 *   no existing device-local album is orphaned. validKey still confines the
 *   embed to that first-party namespace — no host session or wallet key
 *   lives under "forever-album:". Albums are large (multi-photo envelopes),
 *   hence the higher value ceiling.
 */
const SUPPORTED_APPS: Readonly<Record<string, EmbeddedStorageAppConfig>> = {
  "miniapp-zhuada-e": {
    appKeyPrefix: "zhuada-e:",
    hostKeyPrefix: "neo-miniapp-storage:miniapp-zhuada-e:",
    maxValueLength: 1_000_000,
  },
  "miniapp-forever-album": {
    appKeyPrefix: "forever-album:",
    hostKeyPrefix: "",
    maxValueLength: 5_000_000,
  },
};

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

function validKey(value: unknown, config: EmbeddedStorageAppConfig): value is string {
  return typeof value === "string"
    && value.startsWith(config.appKeyPrefix)
    && value.length <= MAX_KEY_LENGTH;
}

function isQuotaExceeded(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return candidate.name === "QuotaExceededError"
    || /quota/i.test(String(candidate.message ?? ""));
}

/**
 * Local-only persistence for allowlisted first-party miniapps inside the
 * host's opaque-origin sandbox. The source-window check is the security
 * boundary; no wallet/session keys are exposed and every key is confined to
 * the requesting app's own namespace. Quota failures are reported distinctly
 * so apps with precious data (the photo album) can surface "storage full"
 * instead of silently dropping a write.
 */
export function useEmbeddedStorageBridge({
  appId,
  iframeRef,
}: {
  appId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}) {
  useEffect(() => {
    const config = SUPPORTED_APPS[appId];
    if (!config) return undefined;

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
        || request.appId !== appId
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
            if (!hostKey?.startsWith(config.hostKeyPrefix)) continue;
            const appKey = hostKey.slice(config.hostKeyPrefix.length);
            if (!validKey(appKey, config)) continue;
            const value = window.localStorage.getItem(hostKey);
            if (value !== null) values[appKey] = value;
          }
          reply(true, { values });
          return;
        }
        if (!validKey(request.key, config)) {
          reply(false, { error: "invalid-key" });
          return;
        }
        const hostKey = `${config.hostKeyPrefix}${request.key}`;
        if (request.op === "get") {
          reply(true, { value: window.localStorage.getItem(hostKey) });
          return;
        }
        if (request.op === "set") {
          if (typeof request.value !== "string" || request.value.length > config.maxValueLength) {
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
      } catch (error) {
        reply(false, {
          error: isQuotaExceeded(error) ? "quota-exceeded" : "storage-unavailable",
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId, iframeRef]);
}
