/**
 * Neo N3 Bridge Message Types
 *
 * Message types for communication between host and miniapp SDK.
 */

export type MessageType =
  | "MULTICHAIN_GET_CHAINS"
  | "MULTICHAIN_GET_ACTIVE_CHAIN"
  | "MULTICHAIN_SWITCH_CHAIN"
  | "MULTICHAIN_CONNECT"
  | "MULTICHAIN_DISCONNECT"
  | "MULTICHAIN_GET_ACCOUNT"
  | "MULTICHAIN_SEND_TX"
  | "MULTICHAIN_WAIT_TX"
  | "MULTICHAIN_CALL_CONTRACT"
  | "MULTICHAIN_READ_CONTRACT"
  | "MULTICHAIN_SUBSCRIBE"
  | "MULTICHAIN_UNSUBSCRIBE"
  | "MULTICHAIN_GET_BALANCE"
  | "MULTICHAIN_EVENT";

export interface BridgeMessage<T = unknown> {
  id: string;
  type: MessageType;
  payload?: T;
  source?: string;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
