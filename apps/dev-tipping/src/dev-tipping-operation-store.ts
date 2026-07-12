import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import type { DevTippingNetwork } from "./dev-tipping-rpc";

export type DevTippingOperationKind =
  | "deposit"
  | "tip"
  | "register"
  | "withdrawTips"
  | "withdrawCredit";

export type DevTippingReceiptStatus =
  | "pending"
  | "readback"
  | "confirmed"
  | "fault"
  | "credit"
  | "expired";

export interface TipOperationScope {
  network: DevTippingNetwork;
  contract: string;
  sender: string;
}

interface PendingOperationBase extends TipOperationScope {
  version: 2;
  kind: DevTippingOperationKind;
  eventName: "Credited" | "Tipped" | "DeveloperRegistered" | "TipsWithdrawn" | "CreditWithdrawn";
  txid: string;
  createdAt: number;
}

export interface PendingTipOperation extends PendingOperationBase {
  kind: "deposit" | "tip";
  eventName: "Credited" | "Tipped";
  devId: number;
  recipientName: string;
  recipientWallet: string;
  amountBase: string;
  anonymous: boolean;
  beforeTotalReceivedBase: string;
  beforeTipCount: string;
  beforeCreditBase: string;
  depositAmountBase: string;
}

export interface PendingRegisterOperation extends PendingOperationBase {
  kind: "register";
  eventName: "DeveloperRegistered";
  name: string;
  role: string;
}

export interface PendingWithdrawTipsOperation extends PendingOperationBase {
  kind: "withdrawTips";
  eventName: "TipsWithdrawn";
  devId: number;
  recipientName: string;
  recipientWallet: string;
  amountBase: string;
  beforeTotalReceivedBase: string;
}

export interface PendingWithdrawCreditOperation extends PendingOperationBase {
  kind: "withdrawCredit";
  eventName: "CreditWithdrawn";
  amountBase: string;
}

export type PendingDevTippingOperation =
  | PendingTipOperation
  | PendingRegisterOperation
  | PendingWithdrawTipsOperation
  | PendingWithdrawCreditOperation;

export type DevTippingReceipt = PendingDevTippingOperation & {
  status: DevTippingReceiptStatus;
  updatedAt: number;
};

export interface DevTippingLocalStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const TXID_RE = /^0x[0-9a-f]{64}$/;
const POSITIVE_INTEGER_RE = /^[1-9]\d*$/;
const NON_NEGATIVE_INTEGER_RE = /^\d+$/;
const MAX_TEXT_LENGTH = 128;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function canonicalAccount(value: unknown): string {
  const raw = text(value);
  if (/^(?:0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return normalizeScriptHash(raw);
  }
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-f]{40}$/.test(converted) ? converted : "";
}

export function normalizeTipOperationScope(
  scope: Partial<TipOperationScope> | null | undefined,
): TipOperationScope | null {
  const network = scope?.network === "mainnet" || scope?.network === "testnet"
    ? scope.network
    : null;
  const contract = normalizeScriptHash(scope?.contract ?? "");
  const sender = canonicalAccount(scope?.sender);
  return network && /^0x[0-9a-f]{40}$/.test(contract) && sender
    ? { network, contract, sender }
    : null;
}

export function tipOperationScopeMatches(
  left: Partial<TipOperationScope> | null | undefined,
  right: Partial<TipOperationScope> | null | undefined,
): boolean {
  const a = normalizeTipOperationScope(left);
  const b = normalizeTipOperationScope(right);
  return Boolean(
    a
    && b
    && a.network === b.network
    && a.contract === b.contract
    && a.sender === b.sender,
  );
}

function validBase(value: unknown, positive = false): boolean {
  return (positive ? POSITIVE_INTEGER_RE : NON_NEGATIVE_INTEGER_RE).test(String(value ?? ""));
}

function validBaseRecord(value: Partial<PendingDevTippingOperation>): boolean {
  return Boolean(
    value.version === 2
    && normalizeTipOperationScope(value)
    && TXID_RE.test(text(value.txid).toLowerCase())
    && Number.isSafeInteger(value.createdAt)
    && Number(value.createdAt) > 0,
  );
}

export function isPendingDevTippingOperation(value: unknown): value is PendingDevTippingOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingDevTippingOperation>;
  if (!validBaseRecord(pending)) return false;

  if (pending.kind === "deposit" || pending.kind === "tip") {
    return Boolean(
      pending.eventName === (pending.kind === "deposit" ? "Credited" : "Tipped")
      && Number.isSafeInteger(pending.devId)
      && Number(pending.devId) > 0
      && text(pending.recipientName)
      && text(pending.recipientName).length <= MAX_TEXT_LENGTH
      && canonicalAccount(pending.recipientWallet)
      && validBase(pending.amountBase, true)
      && validBase(pending.beforeTotalReceivedBase)
      && validBase(pending.beforeTipCount)
      && validBase(pending.beforeCreditBase)
      && validBase(pending.depositAmountBase)
      && typeof pending.anonymous === "boolean",
    );
  }

  if (pending.kind === "register") {
    return Boolean(
      pending.eventName === "DeveloperRegistered"
      && text(pending.name)
      && text(pending.name).length <= 64
      && text(pending.role).length <= 64,
    );
  }

  if (pending.kind === "withdrawTips") {
    return Boolean(
      pending.eventName === "TipsWithdrawn"
      && Number.isSafeInteger(pending.devId)
      && Number(pending.devId) > 0
      && text(pending.recipientName)
      && text(pending.recipientName).length <= MAX_TEXT_LENGTH
      && canonicalAccount(pending.recipientWallet)
      && validBase(pending.amountBase, true)
      && validBase(pending.beforeTotalReceivedBase),
    );
  }

  return Boolean(
    pending.kind === "withdrawCredit"
    && pending.eventName === "CreditWithdrawn"
    && validBase(pending.amountBase, true),
  );
}

export function isDevTippingReceipt(value: unknown): value is DevTippingReceipt {
  if (!isPendingDevTippingOperation(value)) return false;
  const receipt = value as Partial<DevTippingReceipt>;
  return Boolean(
    ["pending", "readback", "confirmed", "fault", "credit", "expired"].includes(
      String(receipt.status ?? ""),
    )
    && Number.isFinite(receipt.updatedAt)
    && Number(receipt.updatedAt) > 0,
  );
}

function scopeKey(scope: TipOperationScope): string {
  const canonical = normalizeTipOperationScope(scope);
  if (!canonical) throw new Error("Invalid Dev Tipping operation scope");
  return `${canonical.network}/${canonical.contract.slice(2)}/${canonical.sender.slice(2)}`;
}

function sameRecord(
  left: PendingDevTippingOperation | DevTippingReceipt | null,
  right: PendingDevTippingOperation | DevTippingReceipt,
): boolean {
  if (!left) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createDevTippingOperationStore(storage: DevTippingLocalStorage) {
  const pendingMemory = new Map<string, PendingDevTippingOperation>();
  const receiptMemory = new Map<string, DevTippingReceipt>();
  const pendingKey = (scope: TipOperationScope) => `dev-tipping/pending-v2/${scopeKey(scope)}`;
  const receiptKey = (scope: TipOperationScope) => `dev-tipping/receipt-v2/${scopeKey(scope)}`;

  const getPending = (scope: TipOperationScope): PendingDevTippingOperation | null => {
    const key = pendingKey(scope);
    try {
      const value = storage.get<PendingDevTippingOperation>(key, null);
      if (isPendingDevTippingOperation(value) && tipOperationScopeMatches(value, scope)) {
        pendingMemory.set(key, value);
        return value;
      }
    } catch {
      // Same-session recovery remains visible from memory.
    }
    try {
      const receipt = storage.get<DevTippingReceipt>(receiptKey(scope), null);
      if (
        isDevTippingReceipt(receipt)
        && tipOperationScopeMatches(receipt, scope)
        && ["pending", "readback", "expired"].includes(receipt.status)
      ) {
        const { status: _status, updatedAt: _updatedAt, ...pending } = receipt;
        if (isPendingDevTippingOperation(pending)) {
          pendingMemory.set(key, pending);
          return pending;
        }
      }
    } catch {
      // A receipt fallback is optional; the same-session memory guard remains.
    }
    return pendingMemory.get(key) ?? null;
  };

  return {
    canPersist(scope: TipOperationScope): boolean {
      const key = `dev-tipping/probe-v2/${scopeKey(scope)}`;
      const marker = {
        version: 2,
        nonce: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        txid: `0x${"a".repeat(64)}`,
        recipientName: "N".repeat(64),
        amountBase: "9".repeat(32),
      };
      try {
        storage.set(key, marker);
        const persisted = storage.get<typeof marker>(key, null);
        storage.delete(key);
        const removed = storage.get<unknown>(key, null);
        return JSON.stringify(persisted) === JSON.stringify(marker) && removed === null;
      } catch {
        try {
          storage.delete(key);
        } catch {
          // The caller only needs the fail-closed result.
        }
        return false;
      }
    },

    getPending,

    setPending(
      scope: TipOperationScope,
      pending: PendingDevTippingOperation,
    ): PendingDevTippingOperation {
      if (!isPendingDevTippingOperation(pending) || !tipOperationScopeMatches(pending, scope)) {
        throw new Error("Invalid Dev Tipping recovery record");
      }
      const key = pendingKey(scope);
      pendingMemory.set(key, pending);
      storage.set(key, pending);
      const persisted = storage.get<PendingDevTippingOperation>(key, null);
      if (
        !isPendingDevTippingOperation(persisted)
        || !tipOperationScopeMatches(persisted, scope)
        || !sameRecord(persisted, pending)
      ) {
        throw new Error("Dev Tipping recovery record could not be persisted");
      }
      return persisted;
    },

    clearPending(scope: TipOperationScope): boolean {
      const key = pendingKey(scope);
      try {
        storage.delete(key);
        if (storage.get<unknown>(key, null) !== null) return false;
        pendingMemory.delete(key);
        return true;
      } catch {
        return false;
      }
    },

    getReceipt(scope: TipOperationScope): DevTippingReceipt | null {
      const key = receiptKey(scope);
      try {
        const value = storage.get<DevTippingReceipt>(key, null);
        if (isDevTippingReceipt(value) && tipOperationScopeMatches(value, scope)) {
          receiptMemory.set(key, value);
          return value;
        }
      } catch {
        // Receipt history can still be shown from same-session memory.
      }
      return receiptMemory.get(key) ?? null;
    },

    setReceipt(scope: TipOperationScope, receipt: DevTippingReceipt): boolean {
      if (!isDevTippingReceipt(receipt) || !tipOperationScopeMatches(receipt, scope)) return false;
      const key = receiptKey(scope);
      receiptMemory.set(key, receipt);
      try {
        storage.set(key, receipt);
        const persisted = storage.get<DevTippingReceipt>(key, null);
        return Boolean(isDevTippingReceipt(persisted) && sameRecord(persisted, receipt));
      } catch {
        return false;
      }
    },
  };
}
