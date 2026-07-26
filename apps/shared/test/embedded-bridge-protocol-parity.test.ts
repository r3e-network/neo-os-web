import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Parity guard for the two app-scoped host<->iframe postMessage bridges added
// by the audit fix C-4 follow-ups. Each bridge's two ends live in separate npm
// workspaces with no shared dependency, so each end declares its own copy of
// the wire constants with only cross-referencing comments:
//
//   credential bridge (host gateway credential for Automation Copilot)
//     host   : platform/host-app/components/playarea/bridge/use-embedded-credential-bridge.ts
//     client : apps/automation-copilot/src/automationGateway.ts
//
//   storage bridge (device-local persistence for allowlisted first-party apps)
//     host   : platform/host-app/components/playarea/bridge/use-embedded-storage-bridge.ts
//     client : apps/forever-album/src/utils/album-store.ts
//     client : apps/zhuada-e/src/logic/game-storage.ts — that module keeps its
//              constants private and the app is frozen, so this test greps the
//              file's source for the host-exported literals instead of
//              importing them (read-only; still no literal duplicated here).
//
// Mirrors wallet-sdk-bridge-protocol-parity.test.ts so protocol drift on any
// side becomes a test failure instead of a silent runtime mismatch.

import {
  CREDENTIAL_BRIDGE_REQUEST as HOST_CREDENTIAL_REQUEST,
  CREDENTIAL_BRIDGE_RESPONSE as HOST_CREDENTIAL_RESPONSE,
  CREDENTIAL_BRIDGE_PROTOCOL_VERSION as HOST_CREDENTIAL_VERSION,
  CREDENTIAL_BRIDGE_SUPPORTED_APP_ID as HOST_CREDENTIAL_APP_ID,
  CREDENTIAL_BRIDGE_SCOPE as HOST_CREDENTIAL_SCOPE,
} from "../../../platform/host-app/components/playarea/bridge/use-embedded-credential-bridge";
import {
  CREDENTIAL_BRIDGE_REQUEST as COPILOT_CREDENTIAL_REQUEST,
  CREDENTIAL_BRIDGE_RESPONSE as COPILOT_CREDENTIAL_RESPONSE,
  CREDENTIAL_BRIDGE_PROTOCOL_VERSION as COPILOT_CREDENTIAL_VERSION,
  CREDENTIAL_BRIDGE_APP_ID as COPILOT_CREDENTIAL_APP_ID,
  CREDENTIAL_BRIDGE_SCOPE as COPILOT_CREDENTIAL_SCOPE,
} from "../../automation-copilot/src/automationGateway";
import {
  STORAGE_REQUEST as HOST_STORAGE_REQUEST,
  STORAGE_RESPONSE as HOST_STORAGE_RESPONSE,
  STORAGE_PROTOCOL_VERSION as HOST_STORAGE_VERSION,
  SUPPORTED_APPS as HOST_STORAGE_SUPPORTED_APPS,
} from "../../../platform/host-app/components/playarea/bridge/use-embedded-storage-bridge";
import {
  EMBEDDED_STORAGE_REQUEST as ALBUM_STORAGE_REQUEST,
  EMBEDDED_STORAGE_RESPONSE as ALBUM_STORAGE_RESPONSE,
  EMBEDDED_STORAGE_PROTOCOL_VERSION as ALBUM_STORAGE_VERSION,
} from "../utils/embedded-storage-client";
import { ALBUM_APP_ID, ALBUM_KEY_PREFIX } from "../../forever-album/src/utils/album-store";

const currentDir = dirname(fileURLToPath(import.meta.url));
const gameStoragePath = resolve(
  currentDir,
  "../../zhuada-e/src/logic/game-storage.ts",
);

describe("credential-bridge protocol parity (host <-> automation copilot)", () => {
  it("uses identical message-type strings on both sides", () => {
    expect(COPILOT_CREDENTIAL_REQUEST).toBe(HOST_CREDENTIAL_REQUEST);
    expect(COPILOT_CREDENTIAL_RESPONSE).toBe(HOST_CREDENTIAL_RESPONSE);
    // Request and response are distinct messages under one protocol namespace.
    expect(HOST_CREDENTIAL_RESPONSE).not.toBe(HOST_CREDENTIAL_REQUEST);
    expect(HOST_CREDENTIAL_RESPONSE.split(":")[0]).toBe(
      HOST_CREDENTIAL_REQUEST.split(":")[0],
    );
  });

  it("declares the same PROTOCOL_VERSION on both sides", () => {
    expect(COPILOT_CREDENTIAL_VERSION).toBe(HOST_CREDENTIAL_VERSION);
    // A concrete pin so an unintended bump fails loudly.
    expect(HOST_CREDENTIAL_VERSION).toBe(1);
  });

  it("agrees on the single allowlisted app id and credential scope", () => {
    // The host hands the gateway credential to exactly this canonical app id
    // and scope (audit fix C-4 follow-up); a mismatch on either side makes
    // the bridge fail closed and the copilot run unauthenticated.
    expect(COPILOT_CREDENTIAL_APP_ID).toBe(HOST_CREDENTIAL_APP_ID);
    expect(COPILOT_CREDENTIAL_SCOPE).toBe(HOST_CREDENTIAL_SCOPE);
    expect(HOST_CREDENTIAL_APP_ID.startsWith("miniapp-")).toBe(true);
  });
});

describe("storage-bridge protocol parity (host <-> forever-album)", () => {
  it("uses identical message-type strings and PROTOCOL_VERSION on both sides", () => {
    expect(ALBUM_STORAGE_REQUEST).toBe(HOST_STORAGE_REQUEST);
    expect(ALBUM_STORAGE_RESPONSE).toBe(HOST_STORAGE_RESPONSE);
    expect(ALBUM_STORAGE_VERSION).toBe(HOST_STORAGE_VERSION);
    expect(HOST_STORAGE_VERSION).toBe(1);
  });

  it("keeps the album's allowlist entry aligned with the app-side constants", () => {
    const config = HOST_STORAGE_SUPPORTED_APPS[ALBUM_APP_ID];
    expect(config).toBeDefined();
    expect(config.appKeyPrefix).toBe(ALBUM_KEY_PREFIX);
    // hostKeyPrefix must stay empty: the host stores the exact
    // "forever-album:…" keys the pop-out window and pre-C-4 embeds already
    // use, so no existing device-local album is orphaned.
    expect(config.hostKeyPrefix).toBe("");
  });
});

describe("storage-bridge protocol parity (host <-> zhuada-e, source-text check)", () => {
  const source = readFileSync(gameStoragePath, "utf8");
  // The goose game's storage client keeps its wire constants module-private
  // and the app directory is frozen, so parity is asserted against the file's
  // source text using only the host-exported values (JSON.stringify yields
  // the exact double-quoted literal as it appears in the TypeScript source).
  const zhuadaEntry = Object.entries(HOST_STORAGE_SUPPORTED_APPS).find(
    ([appId]) => appId !== ALBUM_APP_ID && source.includes(JSON.stringify(appId)),
  );

  it("declares its app id in the host allowlist", () => {
    expect(zhuadaEntry).toBeDefined();
  });

  it("sends the host's request type and hydrates on the host's response type", () => {
    expect(source).toContain(JSON.stringify(HOST_STORAGE_REQUEST));
    expect(source).toContain(JSON.stringify(HOST_STORAGE_RESPONSE));
  });

  it("sends the host's protocol version (inlined as a literal)", () => {
    expect(source).toContain(`version: ${HOST_STORAGE_VERSION}`);
  });

  it("namespaces its keys with the allowlisted app prefix", () => {
    const [, config] = zhuadaEntry!;
    // The hydrate filter (key.startsWith) pins the prefix in source.
    expect(source).toContain(JSON.stringify(config.appKeyPrefix));
  });
});

describe("storage-bridge allowlist invariants", () => {
  it("namespaces every allowlisted app by its own canonical id", () => {
    const entries = Object.entries(HOST_STORAGE_SUPPORTED_APPS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [appId, config] of entries) {
      expect(appId.startsWith("miniapp-")).toBe(true);
      // Wire keys must carry the app's own namespace derived from its id, so
      // no app can ever read or write another app's (or the host's) keys.
      expect(config.appKeyPrefix).toBe(`${appId.slice("miniapp-".length)}:`);
      expect(config.maxValueLength).toBeGreaterThan(0);
    }
  });
});
