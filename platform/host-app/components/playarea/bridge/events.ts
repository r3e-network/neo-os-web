export const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
export const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
export const HOST_WALLET_BRIDGE_RESULT =
  "neo-miniapp-wallet-bridge:result";
// Host-side notice lane for rejected/failed sensitive bridge requests. The
// error is always posted back to the iframe, but if the miniapp swallows it
// the user who just dismissed the approval prompt would otherwise see no
// acknowledgment that nothing was submitted.
export const HOST_WALLET_BRIDGE_ERROR = "neo-miniapp-wallet-bridge:error";

// Versioned protocol contract for the host<->iframe wallet bridge.
//
// The host shell (this module) and the embedded miniapp SDK
// (platform/sdk/src/nep21-provider.ts) live in separate npm workspaces with no
// shared dependency, so they cannot import a single constant. Instead each side
// declares an identical copy of these values, and a parity test
// (platform/host-app/__tests__/components/playarea-bridge.protocol-parity.test.ts)
// asserts they never drift. Bump PROTOCOL_VERSION on any breaking change to the
// envelope shape and add the previous version to COMPATIBLE_PROTOCOL_VERSIONS
// only while it stays wire-compatible.
export const HOST_WALLET_BRIDGE_PROTOCOL_VERSION = 1;

// Versions this host accepts on an incoming request envelope. A request whose
// declared version is absent is treated as the baseline (current) version for
// backward compatibility with miniapps built before negotiation existed.
export const HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS: readonly number[] =
  [HOST_WALLET_BRIDGE_PROTOCOL_VERSION];

export function isCompatibleBridgeProtocolVersion(
  version: number | null | undefined,
): boolean {
  // A missing version is the pre-negotiation baseline: treat it as the current
  // protocol so older miniapps keep working unchanged.
  if (version === null || version === undefined) return true;
  return HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS.includes(version);
}
