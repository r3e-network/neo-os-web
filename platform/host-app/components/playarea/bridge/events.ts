export const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
export const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
export const HOST_WALLET_BRIDGE_RESULT =
  "neo-miniapp-wallet-bridge:result";
// Host-side notice lane for rejected/failed sensitive bridge requests. The
// error is always posted back to the iframe, but if the miniapp swallows it
// the user who just dismissed the approval prompt would otherwise see no
// acknowledgment that nothing was submitted.
export const HOST_WALLET_BRIDGE_ERROR = "neo-miniapp-wallet-bridge:error";
