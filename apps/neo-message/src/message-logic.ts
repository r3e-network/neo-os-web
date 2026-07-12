/**
 * Neo Message — pure logic + contract constants.
 *
 * Neo Message is an EVM (Neo X) miniapp backed by MiniAppMessageEVM + the
 * Morpheus confidential oracle. Two delivery modes:
 *   - recipient-only (unlockTime == 0): ciphertext stored on-chain; only the
 *     designated recipient can decrypt, via the oracle recipient-reveal lane
 *     (a wallet signature proves they are the recipient). Plaintext never
 *     touches the chain.
 *   - time-locked (unlockTime > 0): after the unlock time anyone may trigger a
 *     reveal; the oracle decrypts and posts the plaintext on-chain (public).
 */

export const MESSAGE_EVM_ADDRESS = "0xd1906192c2308ae416aCDa96238cA846EBB83f15";
export const NEO_X_MAINNET = "neo-x-mainnet";
export const NEO_X_CHAIN_ID = 47763;
export const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000";
export const MAX_MAILBOX_IDS = 10_000;

// Function selectors / event topics for MiniAppMessageEVM (keccak-derived).
export const SELECTORS = {
  sendMessage: "0x0759f73a", // sendMessage(address,bytes,uint64)
  requestReveal: "0x40261cdd", // requestReveal(uint256)
  getMessage: "0x86f79edb", // getMessage(uint256)
  inboxOf: "0x6d9e384b", // inboxOf(address)
  outboxOf: "0x802c8fa0", // outboxOf(address)
} as const;

export const TOPICS = {
  MessageSent: "0xbfc188edcb4ff04f2c14b0b4132afabbe9331f5e5efbd145e74a6320f826990c",
  RevealRequested: "0xec2bedc14866982d53087454a5e736f7cebf41a32290e8288c3ebe7d6813bfeb",
  MessageRevealed: "0x4d803256eec63a0f802df58b9226bcb3c388d709c2f14afa2f02e8ed8128ab67",
} as const;

export const MAX_BODY_LENGTH = 2000;

export type LockMode = "recipient" | "timed";

export interface ComposeForm {
  recipient?: string;
  body?: string;
  lockMode?: LockMode;
  revealDate?: string; // datetime-local value, e.g. "2026-06-09T14:30"
  publicRevealAcknowledged?: boolean;
}

export type MessageView = {
  id: string;
  sender: string;
  recipient: string;
  unlockTime: number;
  sentAt: number;
  revealed: boolean;
  plaintext: string;
  timeLocked: boolean;
};

/** Loose EVM address check (0x + 40 hex). */
export function isEvmAddress(value: string | undefined | null): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/** A real recipient address. The zero address can never open a private note. */
export function isMessageRecipient(value: string | undefined | null): boolean {
  return isEvmAddress(value) && String(value).trim().toLowerCase() !== ZERO_EVM_ADDRESS;
}

/** Neo Message has a verified deployment on Neo X mainnet only. */
export function isSupportedMessageNetwork(network: string | undefined | null): boolean {
  return network === NEO_X_MAINNET;
}

export function addressesEqual(a?: string | null, b?: string | null): boolean {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.length === 42 &&
    b.length === 42 &&
    a.toLowerCase() === b.toLowerCase()
  );
}

/**
 * Strict ABI decoder for inboxOf/outboxOf. A missing contract or truncated RPC
 * response must fail instead of becoming an empty mailbox.
 */
export function decodeMessageIds(returnHex: string): bigint[] {
  const hex = String(returnHex ?? "").replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 128 || hex.length % 64 !== 0) {
    throw new Error("message id list returned invalid ABI data");
  }

  const offset = BigInt(`0x${hex.slice(0, 64)}`);
  if (offset !== 32n) {
    throw new Error("message id list returned an unexpected ABI offset");
  }
  const length = BigInt(`0x${hex.slice(64, 128)}`);
  // The UI only fetches a bounded newest page, but reject absurd allocations
  // before converting a hostile or corrupt length word to Number.
  if (length > BigInt(MAX_MAILBOX_IDS)) {
    throw new Error("message id list is too large");
  }
  const count = Number(length);
  const requiredLength = 128 + count * 64;
  if (hex.length !== requiredLength) {
    throw new Error("message id list returned non-canonical ABI data");
  }

  const ids: bigint[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = 128 + index * 64;
    ids.push(BigInt(`0x${hex.slice(start, start + 64)}`));
  }
  return ids;
}

/**
 * Canonical statement the recipient signs for a recipient-only reveal. MUST be
 * byte-identical to the worker's buildRevealStatement (message-reveal.js).
 */
export function buildRevealStatement(
  chainId: number,
  contract: string,
  messageId: string,
  issuedAt: number,
): string {
  return [
    "Morpheus Neo Message",
    "Recipient reveal request",
    `chain: ${Number(chainId)}`,
    `contract: ${String(contract).toLowerCase()}`,
    `message: ${String(messageId)}`,
    `issued: ${Number(issuedAt)}`,
  ].join("\n");
}

export interface ComposeValidation {
  ok: boolean;
  error?: string;
  unlockTime?: number;
}

/**
 * Validate a compose form and compute the on-chain unlockTime (0 for
 * recipient-only). nowMs lets tests pin the clock.
 */
export function validateCompose(form: ComposeForm, nowMs: number = Date.now()): ComposeValidation {
  const recipient = String(form.recipient ?? "").trim();
  const rawBody = String(form.body ?? "");
  const body = rawBody.trim();
  const mode: LockMode = form.lockMode === "timed" ? "timed" : "recipient";

  if (!isMessageRecipient(recipient)) {
    return { ok: false, error: "invalidRecipient" };
  }
  if (body.length === 0) {
    return { ok: false, error: "emptyBody" };
  }
  if (rawBody.length > MAX_BODY_LENGTH) {
    return { ok: false, error: "bodyTooLong" };
  }
  if (mode === "recipient") {
    return { ok: true, unlockTime: 0 };
  }
  const revealMs = Date.parse(String(form.revealDate ?? ""));
  if (!Number.isFinite(revealMs)) {
    return { ok: false, error: "invalidRevealDate" };
  }
  if (revealMs <= nowMs) {
    return { ok: false, error: "revealDateInPast" };
  }
  return { ok: true, unlockTime: Math.floor(revealMs / 1000) };
}

export type MessageDisplayStatus = "recipient" | "locked" | "unlockable" | "revealed";

/** Lifecycle status for an inbox/outbox row. nowSec lets tests pin the clock. */
export function messageStatus(
  message: Pick<MessageView, "unlockTime" | "revealed">,
  nowSec: number = Math.floor(Date.now() / 1000),
): MessageDisplayStatus {
  if (message.revealed) return "revealed";
  if (!message.unlockTime || message.unlockTime === 0) return "recipient";
  if (nowSec >= message.unlockTime) return "unlockable";
  return "locked";
}

/** Human-friendly unlock label; "" for recipient-only. */
export function formatUnlock(unlockTime: number): string {
  if (!unlockTime || unlockTime === 0) return "";
  return new Date(unlockTime * 1000).toLocaleString();
}

export function shortAddress(addr: string | undefined | null): string {
  const a = String(addr ?? "");
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Whether the Send action is blocked pending an explicit public-reveal
 * acknowledgement. Time-locked messages post their plaintext on-chain publicly,
 * so the user must acknowledge that before sending; recipient-only messages
 * never become public and need no acknowledgement. Pure so it can be unit-tested.
 */
export function needsPublicRevealAck(lockMode: LockMode | undefined, acknowledged: boolean): boolean {
  return lockMode === "timed" && !acknowledged;
}
