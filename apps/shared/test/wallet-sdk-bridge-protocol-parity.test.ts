import { describe, expect, it } from "vitest";

// Parity guard for the host<->iframe wallet-bridge protocol.
//
// The two ends of the bridge live in separate npm workspaces with no shared
// dependency, so each declares its own copy of the protocol constants:
//   - host shell : platform/host-app/components/playarea/bridge/events.ts
//   - iframe SDK : platform/sdk/src/nep21-provider.ts
//                  (re-exported to miniapps via apps/shared/utils/nep21-provider.ts)
//
// This test asserts the two copies are byte-for-byte identical so they can
// never silently drift, mirroring the morpheus-registry sync parity tests.
import {
  HOST_WALLET_BRIDGE_REQUEST as HOST_REQUEST,
  HOST_WALLET_BRIDGE_RESPONSE as HOST_RESPONSE,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION as HOST_VERSION,
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS as HOST_COMPAT,
  isCompatibleBridgeProtocolVersion as hostIsCompatible,
} from "../../../platform/host-app/components/playarea/bridge/events";
import {
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION as SDK_VERSION,
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS as SDK_COMPAT,
  isCompatibleBridgeProtocolVersion as sdkIsCompatible,
  normalizeBridgeProtocolVersion,
} from "../utils/nep21-provider";

// The canonical wire strings the iframe SDK emits/expects. These mirror the
// host-side string constants (the SDK keeps them module-private), so we pin
// them here and assert the host exports match.
const SDK_REQUEST = "neo-miniapp-wallet-bridge:request";
const SDK_RESPONSE = "neo-miniapp-wallet-bridge:response";

describe("wallet-bridge protocol parity (host <-> iframe SDK)", () => {
  it("uses identical message-type strings on both sides", () => {
    expect(HOST_REQUEST).toBe(SDK_REQUEST);
    expect(HOST_RESPONSE).toBe(SDK_RESPONSE);
  });

  it("declares the same PROTOCOL_VERSION on both sides", () => {
    expect(HOST_VERSION).toBe(SDK_VERSION);
    // A concrete pin so an unintended bump fails loudly.
    expect(HOST_VERSION).toBe(1);
  });

  it("declares the same compatible-version set on both sides", () => {
    expect([...HOST_COMPAT]).toEqual([...SDK_COMPAT]);
    expect([...HOST_COMPAT]).toContain(HOST_VERSION);
  });

  it("negotiates versions identically on both sides", () => {
    const cases = [undefined, null, 1, 2, 0, Number.NaN, -1];
    for (const value of cases) {
      expect(hostIsCompatible(value)).toBe(sdkIsCompatible(value));
    }
    // The shared baseline contract: a missing version is the current protocol.
    expect(hostIsCompatible(undefined)).toBe(true);
    expect(sdkIsCompatible(undefined)).toBe(true);
    // The current version is accepted; an unknown future version is not.
    expect(hostIsCompatible(HOST_VERSION)).toBe(true);
    expect(sdkIsCompatible(HOST_VERSION)).toBe(true);
    expect(hostIsCompatible(HOST_VERSION + 1)).toBe(false);
    expect(sdkIsCompatible(SDK_VERSION + 1)).toBe(false);
  });

  it("normalizes the version field consistently (missing = baseline)", () => {
    expect(normalizeBridgeProtocolVersion(undefined)).toBeUndefined();
    expect(normalizeBridgeProtocolVersion(null)).toBeUndefined();
    expect(normalizeBridgeProtocolVersion(1)).toBe(1);
    expect(normalizeBridgeProtocolVersion("1")).toBe(1);
    // A present-but-garbage version coerces to NaN so it fails the compat check.
    expect(Number.isNaN(normalizeBridgeProtocolVersion("nope") as number)).toBe(
      true,
    );
    expect(Number.isNaN(normalizeBridgeProtocolVersion(1.5) as number)).toBe(
      true,
    );
  });
});
