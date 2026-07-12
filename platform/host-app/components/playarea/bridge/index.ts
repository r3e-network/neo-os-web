export type {
  BridgeRecord,
  BridgeRequest,
  BridgeInvocation,
  BridgeSigner,
  SendCapableWalletAdapter,
  EmbeddedWalletBridgeResultDetail,
  EmbeddedWalletBridgeErrorDetail,
} from "./types";

export {
  HOST_WALLET_BRIDGE_REQUEST,
  HOST_WALLET_BRIDGE_RESPONSE,
  HOST_WALLET_BRIDGE_STATE,
  HOST_WALLET_BRIDGE_RESULT,
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS,
  isCompatibleBridgeProtocolVersion,
} from "./events";

export {
  MAINNET_MAGIC,
  TESTNET_MAGIC,
  NEO_ASSET_HASH,
  GAS_ASSET_HASH,
  isBridgeRecord,
  asBridgeString,
  bridgeNetworkMagic,
  normalizeBridgeScope,
  stringArray,
  normalizeBridgeSigners,
  invocationContractHash,
  isSenderPlaceholder,
  firstBridgeInvocation,
  bridgeResultTxId,
  bridgeInvocationMemo,
  buildEmbeddedWalletBridgeResultDetail,
  normalizeBridgeArgs,
  resolveSenderArgs,
  normalizeBridgeOperation,
  bridgeInvocationToParams,
  bridgeScopeLabel,
  describeBridgeSignerScopes,
  describeBridgeArgs,
  describeSensitiveBridgeOperation,
} from "./normalizers";

export {
  SENSITIVE_BRIDGE_METHODS,
  requireBridgeWallet,
  requireFreshBridgeWallet,
  preflightEmbeddedWalletBridgeRequest,
  confirmSensitiveBridgeOperation,
  handleEmbeddedWalletBridgeRequest,
} from "./request-handler";

export { useEmbeddedWalletBridge } from "./use-embedded-wallet-bridge";
export { useEmbeddedStorageBridge } from "./use-embedded-storage-bridge";
