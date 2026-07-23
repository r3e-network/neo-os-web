/**
 * useFlashloanCore — Domain logic for the Flash Loan miniapp.
 *
 * Wired against the DEPLOYED MiniAppFlashLoan contract (verified live on both
 * networks, mainnet 0xb5d8fb0d / testnet 0xde8e595d). Its ABI is appId-free:
 *   - requestLoan(borrower, amount, callbackContract, callbackMethod) -> Integer
 *   - getLoanDetails(loanId) -> Map   /   getLoan(loanId) -> Array
 *   - getPlatformStats() -> Map  (totalLoans/totalBorrowed/totalFees/poolBalance/
 *     minLoan/maxLoan/feeBasisPoints/loanCooldownSeconds/maxDailyLoans/...)
 *   - getPoolBalance() -> Integer  /  getFlashLoanConstants() -> Map
 *   - getBorrowerEligibility(borrower) -> Map (cooldownRemaining/dailyLoansRemaining)
 *   - deposit(depositor, amount, receiptId)  /  withdraw(provider, amount)
 *   - getProviderStatsDetails(provider) -> Map
 *
 * The contract is frozen; this module adapts to it. A read failure raises a
 * serviceNotice and preserves the last good snapshot rather than presenting
 * fabricated zeros as fact.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type {
  FrameworkBadgeSurface,
  MiniAppFramework,
} from "@shared/react";
import type { ContractArg } from "@shared/services/ChainService";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";
import {
  formatAddress,
  formatGas,
  fromFixed8,
  toSafeNumber,
} from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBool } from "@shared/utils/parsers";
import {
  FLASHLOAN_APP_ID,
  assertFlashloanRecoveryStorage,
  flashloanAccountsMatch,
  isConfiguredFlashloanAccount,
  normalizeFlashloanContract,
  normalizeFlashloanTxid,
  readFlashloanPaymentOutcome,
  readFlashloanTransactionOutcome,
  requireCanonicalFlashloanContext,
  requireWritableFlashloanContext,
  type FlashloanChainContext,
  type FlashloanEventName,
  type FlashloanNetwork,
  type FlashloanTransactionOutcome,
} from "./flashloanSafety";

const FLASH_FEE_BPS = 9;
const DEPOSIT_MEMO = `${FLASHLOAN_APP_ID}:deposit`;
const PENDING_REQUEST_KEY = "pending-request";
const PENDING_LIQUIDITY_KEY = "pending-liquidity";
const PENDING_SCHEMA = 2;
const RECOVERY_REVIEW_AFTER_MS = 10 * 60 * 1000;
const MAX_RECOVERY_EVENTS = 100;
const DEFAULT_CONTRACT_STATS = {
  minLoan: 1,
  minLoanFixed8: "100000000",
  maxLoan: 100_000,
  maxLoanFixed8: "10000000000000",
  feeBasisPoints: FLASH_FEE_BPS,
  cooldownMs: 300_000,
  maxDailyLoans: 10,
  // Percent of each loan fee paid to liquidity providers (the rest is protocol
  // revenue). Read from the contract; default mirrors the deployed constant.
  providerFeeShare: 80,
};

type LoanStatus = "pending" | "success" | "failed";

type LoanDetails = {
  id: string;
  borrower: string;
  amount: string;
  fee: string;
  callbackContract: string;
  callbackMethod: string;
  timestamp: string;
  status: LoanStatus;
};

type ExecutedLoan = {
  id: number;
  amount: string;
  fee: string;
  status: LoanStatus;
  timestamp: string;
};

type FlashContractStats = typeof DEFAULT_CONTRACT_STATS;

type FlashLoanRequestResult = {
  loanId?: string;
  txid: string;
  amount: string;
  fee: string;
  borrower: string;
  callbackContract: string;
  callbackMethod: string;
};

type ProviderStats = {
  currentBalance: number;
  currentBalanceFixed8: string;
  totalDeposited: number;
  totalDepositedFixed8: string;
  totalFeesEarned: number;
  totalFeesEarnedFixed8: string;
};

type DepositCapability = {
  status: "checking" | "ready" | "unavailable";
  reason: "" | "payment-hub-unavailable" | "chain-unavailable";
};

type WriteCapability = {
  status: "checking" | "ready" | "blocked";
  reason: "" | "wallet-disconnected" | "chain-context-mismatch" | "chain-unavailable";
};

type FlashWriteOperation = "request" | "deposit" | "resume" | "withdraw" | "connect";

type ContractHealth = {
  status: "checking" | "ready" | "paused" | "unavailable";
  checkedAt: number;
};

type BorrowerEligibility = {
  verified: boolean;
  canBorrow: boolean;
  maxAvailableLoan: number;
  maxAvailableLoanFixed8: string;
  cooldownRemaining: number;
  dailyLoansRemaining: number;
};

type PendingRequest = {
  schema: typeof PENDING_SCHEMA;
  network: "mainnet" | "testnet";
  txid: string;
  borrower: string;
  callbackContract: string;
  callbackMethod: string;
  amountFixed8: string;
  feeFixed8: string;
  baselineTotalLoans: number;
  baselinePoolFixed8: string;
  contractHash: string;
  submittedAt: number;
};

type PendingRecovery<TRecord = PendingRequest> = {
  status: "none" | "pending" | "manual-review" | "context-mismatch" | "fault" | "resume" | "confirmed";
  record?: TRecord;
  loanId?: string;
};

type PendingLiquidity = {
  schema: typeof PENDING_SCHEMA;
  network: "mainnet" | "testnet";
  /** Target-contract transaction. Empty while only the prepaid transfer exists. */
  txid: string;
  /** Testnet prepaid GAS transfer. Never interpreted as a completed LP deposit. */
  paymentTxid: string;
  kind: "deposit" | "withdraw";
  providerHash: string;
  amountFixed8: string;
  baselineBalanceFixed8: string;
  /** Optional for backward-compatible recovery of schema-2 records. */
  baselineTotalDepositedFixed8?: string;
  /** Optional for backward-compatible recovery of schema-2 records. */
  baselineTotalWithdrawnFixed8?: string;
  contractHash: string;
  submittedAt: number;
};

export class FlashloanVerificationError extends Error {
  readonly code: "EVENT_MISMATCH" | "READBACK_MISMATCH";

  constructor(message: string, code: "EVENT_MISMATCH" | "READBACK_MISMATCH") {
    super(message);
    this.name = "FlashloanVerificationError";
    this.code = code;
  }
}

const EMPTY_PROVIDER_STATS: ProviderStats = {
  currentBalance: 0,
  currentBalanceFixed8: "0",
  totalDeposited: 0,
  totalDepositedFixed8: "0",
  totalFeesEarned: 0,
  totalFeesEarnedFixed8: "0",
};

const EMPTY_DEPOSIT_CAPABILITY: DepositCapability = {
  status: "checking",
  reason: "",
};

const EMPTY_WRITE_CAPABILITY: WriteCapability = {
  status: "checking",
  reason: "wallet-disconnected",
};

const EMPTY_ELIGIBILITY: BorrowerEligibility = {
  verified: false,
  canBorrow: false,
  maxAvailableLoan: 0,
  maxAvailableLoanFixed8: "0",
  cooldownRemaining: 0,
  dailyLoansRemaining: 0,
};

function isTxid(value: unknown): value is string {
  return Boolean(normalizeFlashloanTxid(value));
}

function isContractHash(value: unknown): value is string {
  return Boolean(normalizeFlashloanContract(value));
}

function isPositiveIntegerString(value: unknown): value is string {
  return /^[1-9]\d*$/.test(String(value ?? ""));
}

function isCallbackMethod(value: unknown): value is string {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(String(value ?? ""));
}

function isPendingRequest(value: unknown): value is PendingRequest {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingRequest>;
  return Boolean(
    record.schema === PENDING_SCHEMA
    && (record.network === "mainnet" || record.network === "testnet")
    && isTxid(record.txid)
    && isConfiguredFlashloanAccount(record.borrower)
    && isConfiguredFlashloanAccount(record.callbackContract)
    && isCallbackMethod(record.callbackMethod)
    && isPositiveIntegerString(record.amountFixed8)
    && /^\d+$/.test(String(record.feeFixed8 ?? ""))
    && Number.isSafeInteger(record.baselineTotalLoans)
    && Number(record.baselineTotalLoans) >= 0
    && /^\d+$/.test(String(record.baselinePoolFixed8 ?? ""))
    && Number.isSafeInteger(record.submittedAt)
    && Number(record.submittedAt) > 0
    && Number(record.submittedAt) <= Date.now() + 300_000
    && isContractHash(record.contractHash),
  );
}

function isPendingLiquidity(value: unknown): value is PendingLiquidity {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingLiquidity>;
  return Boolean(
    record.schema === PENDING_SCHEMA
    && (record.network === "mainnet" || record.network === "testnet")
    && (record.kind === "deposit" || record.kind === "withdraw")
    && isConfiguredFlashloanAccount(record.providerHash)
    && isPositiveIntegerString(record.amountFixed8)
    && /^\d+$/.test(String(record.baselineBalanceFixed8 ?? ""))
    && (
      record.baselineTotalDepositedFixed8 === undefined
      || /^\d+$/.test(String(record.baselineTotalDepositedFixed8))
    )
    && (
      record.baselineTotalWithdrawnFixed8 === undefined
      || /^\d+$/.test(String(record.baselineTotalWithdrawnFixed8))
    )
    && Number.isSafeInteger(record.submittedAt)
    && Number(record.submittedAt) > 0
    && Number(record.submittedAt) <= Date.now() + 300_000
    && isContractHash(record.contractHash)
    && (record.txid === "" || isTxid(record.txid))
    && (record.paymentTxid === "" || isTxid(record.paymentTxid))
    && Boolean(record.txid || record.paymentTxid),
  );
}

export interface UseFlashloanCoreOptions {
  /** MiniApp framework SDK from ctx.framework (chain reads/invokes + arg builders) */
  app: MiniAppFramework;
  /** Platform badge surface from ctx.framework */
  badgeService: Pick<FrameworkBadgeSurface, "award">;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Launch network (mainnet requires an explicit deposit receipt id) */
  network?: MiniAppLaunchNetwork | null;
  /** Test seam for read-only application-log verification. */
  transactionOutcomeReader?: (
    network: FlashloanNetwork,
    txid: string,
    eventName: FlashloanEventName,
    contractHash: string,
  ) => Promise<FlashloanTransactionOutcome>;
  /** Test seam for validating a prepaid testnet GAS transfer. */
  paymentOutcomeReader?: typeof readFlashloanPaymentOutcome;
}

export function useFlashloanCore({
  app,
  badgeService,
  t,
  network,
  transactionOutcomeReader = readFlashloanTransactionOutcome,
  paymentOutcomeReader = readFlashloanPaymentOutcome,
}: UseFlashloanCoreOptions) {
  // The manifest default is mainnet. A missing launch query must never fall
  // into the testnet-only two-argument deposit ABI by accident.
  const effectiveNetwork: FlashloanNetwork = network === "testnet" ? "testnet" : "mainnet";
  const isMainnet = effectiveNetwork === "mainnet";
  const requestStorageKey = `${PENDING_REQUEST_KEY}:${effectiveNetwork}`;
  const liquidityStorageKey = `${PENDING_LIQUIDITY_KEY}:${effectiveNetwork}`;

  const poolBalance = createObservable(0);
  const poolBalanceFixed8 = createObservable("0");
  const loanDetails = createObservable<LoanDetails | null>(null);
  const stats = createObservable({
    totalLoans: 0,
    totalVolume: 0,
    totalVolumeFixed8: "0",
    totalFees: 0,
    totalFeesFixed8: "0",
  });
  const contractStats = createObservable<FlashContractStats>(DEFAULT_CONTRACT_STATS);
  const recentLoans = createObservable<ExecutedLoan[]>([]);
  const lastRequest = createObservable<FlashLoanRequestResult | null>(null);
  const providerStats = createObservable<ProviderStats>(EMPTY_PROVIDER_STATS);
  const depositCapability = createObservable<DepositCapability>(EMPTY_DEPOSIT_CAPABILITY);
  const writeCapability = createObservable<WriteCapability>(EMPTY_WRITE_CAPABILITY);
  const contractHealth = createObservable<ContractHealth>({ status: "checking", checkedAt: 0 });
  const borrowerEligibility = createObservable<BorrowerEligibility>(EMPTY_ELIGIBILITY);
  const isLoading = createObservable(false);
  const isLookupLoading = createObservable(false);
  const writeOperation = createObservable<FlashWriteOperation | "">("");
  const validationError = createObservable<string | null>(null);
  const serviceNotice = createObservable("");
  const address = createObservable("");
  let storedPendingRequest: PendingRequest | null = null;
  try {
    const stored = app.storage.local.get<PendingRequest>(requestStorageKey, null);
    if (isPendingRequest(stored)) storedPendingRequest = stored;
    else if (stored) app.storage.local.delete(requestStorageKey);
  } catch {
    storedPendingRequest = null;
  }
  const pendingRequest = createObservable<PendingRequest | null>(
    isPendingRequest(storedPendingRequest) ? storedPendingRequest : null,
  );
  const pendingRequestTxid = createDerived(
    () => pendingRequest.get()?.txid ?? "",
    [pendingRequest],
  );
  let storedPendingLiquidity: PendingLiquidity | null = null;
  try {
    const stored = app.storage.local.get<PendingLiquidity>(liquidityStorageKey, null);
    if (isPendingLiquidity(stored)) storedPendingLiquidity = stored;
    else if (stored) app.storage.local.delete(liquidityStorageKey);
  } catch {
    storedPendingLiquidity = null;
  }
  const pendingLiquidity = createObservable<PendingLiquidity | null>(
    isPendingLiquidity(storedPendingLiquidity) ? storedPendingLiquidity : null,
  );
  const pendingLiquidityTxid = createDerived(
    () => pendingLiquidity.get()?.txid || pendingLiquidity.get()?.paymentTxid || "",
    [pendingLiquidity],
  );
  const liquidityRecoveryState = createObservable<PendingRecovery["status"]>("none");
  const pendingLiquidityStage = createDerived(
    () => {
      const record = pendingLiquidity.get();
      if (!record) return "";
      const recoveryState = liquidityRecoveryState.get();
      if (recoveryState === "resume") return "resume";
      if (recoveryState === "manual-review" || recoveryState === "context-mismatch") {
        return "manual-review";
      }
      if (record.kind === "deposit" && record.paymentTxid && !record.txid) {
        return "payment-pending";
      }
      return Date.now() - record.submittedAt >= RECOVERY_REVIEW_AFTER_MS
        ? "manual-review"
        : "confirming";
    },
    [pendingLiquidity, liquidityRecoveryState],
  );
  const pendingLiquidityAmount = createDerived(
    () => fixed8DisplaySafe(pendingLiquidity.get()?.amountFixed8),
    [pendingLiquidity],
  );

  const refreshRecoveryRecords = () => {
    try {
      const storedRequest = app.storage.local.get<PendingRequest>(requestStorageKey, null);
      if (storedRequest !== null) {
        if (!isPendingRequest(storedRequest)) throw new Error("invalid request recovery record");
        const current = pendingRequest.get();
        if (current && JSON.stringify(current) !== JSON.stringify(storedRequest)) {
          throw new Error("conflicting request recovery record");
        }
        pendingRequest.set(storedRequest);
      }

      const storedLiquidity = app.storage.local.get<PendingLiquidity>(liquidityStorageKey, null);
      if (storedLiquidity !== null) {
        if (!isPendingLiquidity(storedLiquidity)) throw new Error("invalid liquidity recovery record");
        const current = pendingLiquidity.get();
        if (current && JSON.stringify(current) !== JSON.stringify(storedLiquidity)) {
          throw new Error("conflicting liquidity recovery record");
        }
        pendingLiquidity.set(storedLiquidity);
      }
      assertFlashloanRecoveryStorage(app, t);
    } catch {
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  let activeWriteOperation: FlashWriteOperation | null = null;
  let loadDataEpoch = 0;
  let lookupEpoch = 0;

  const withFinancialWrite = async <T>(
    operation: FlashWriteOperation,
    action: () => Promise<T>,
  ): Promise<T> => {
    if (activeWriteOperation) throw new Error(t("actionInProgress"));
    activeWriteOperation = operation;
    writeOperation.set(operation);
    isLoading.set(true);
    try {
      if (operation !== "connect") refreshRecoveryRecords();
      return await action();
    } finally {
      if (activeWriteOperation === operation) activeWriteOperation = null;
      if (writeOperation.get() === operation) writeOperation.set("");
      isLoading.set(false);
    }
  };

  // -- Helpers --------------------------------------------------------------

  const toNumber = toSafeNumber;

  function fixed8DisplaySafe(value: unknown): string {
    return /^\d+$/.test(String(value ?? "")) ? formatGas(String(value), 4) : "";
  }

  const normalizeHash160Input = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const withoutPrefix = trimmed.replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{40}$/.test(withoutPrefix)) {
      return `0x${withoutPrefix.toLowerCase()}`;
    }
    // Raw RPC/N3Index ByteString values can be base64-encoded UInt160 bytes.
    // Neo displays script hashes in reverse byte order, so normalize that form
    // before falling back to address decoding.
    if (/^[A-Za-z0-9+/]{27}=$/.test(trimmed) && typeof atob === "function") {
      try {
        const decoded = atob(trimmed);
        if (decoded.length === 20) {
          return `0x${Array.from(decoded, (char) => char.charCodeAt(0))
            .reverse()
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")}`;
        }
      } catch {
        /* continue with Neo address parsing */
      }
    }
    return addressToScriptHash(trimmed);
  };

  const fixed8ToDisplay = (value: unknown, decimals = 4) => formatGas(String(value ?? "0"), decimals);

  const fixed8ToDecimal = (value: unknown) => fromFixed8(String(value ?? "0"));

  const estimateFeeFixed8 = (amount: string) => {
    const raw = BigInt(parseGasAmountFixed8(amount) ?? "0");
    const feeBps = contractStats.get().feeBasisPoints || FLASH_FEE_BPS;
    return ((raw * BigInt(feeBps)) / 10_000n).toString();
  };

  // GAS→base-unit scaling uses the framework's null-on-invalid scaler (S6):
  // app.amount.parseGasToFixed8 returns null on invalid/over-precision/zero
  // input — same semantics as the retired parsePositiveFixed8 hand-roll — so
  // the null-based validators (validateLoanRequest / validateLiquidityAmount)
  // keep surfacing localized t(...) messages. app.amount.gasToFixed8 must NOT
  // be used here: it throws a non-localized message on invalid input.
  const parseGasAmountFixed8 = (amount: string): string | null =>
    app.amount.parseGasToFixed8(amount);

  const formatTimestamp = (value: unknown) => {
    const ts = toNumber(value);
    if (!ts) return t("notAvailable");
    const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
    return new Intl.DateTimeFormat(undefined).format(new Date(ms));
  };

  const asRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  };

  const strictUnsigned = (value: unknown, field: string): bigint => {
    const raw = String(value ?? "");
    if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${field} chain value`);
    return BigInt(raw);
  };

  const strictSafeInteger = (value: unknown, field: string): number => {
    const raw = strictUnsigned(value, field);
    if (raw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} exceeds safe range`);
    return Number(raw);
  };

  const strictBoolean = (value: unknown, field: string): boolean => {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    throw new Error(`Invalid ${field} chain value`);
  };

  const rawEventTxid = (entry: unknown): unknown => {
    if (!entry || typeof entry !== "object") return "";
    const event = entry as Record<string, unknown>;
    return event.tx_hash ?? event.txid ?? event.tx ?? event.hash ?? "";
  };

  const eventTxid = (entry: unknown): string => {
    return normalizeFlashloanTxid(rawEventTxid(entry));
  };

  const revalidateWriteContext = async (
    expected: FlashloanChainContext,
  ): Promise<FlashloanChainContext> => {
    const current = await requireWritableFlashloanContext(app, effectiveNetwork, t);
    if (current.contractHash !== expected.contractHash || current.network !== expected.network) {
      throw new Error(t("chainContextMismatch"));
    }
    return current;
  };

  const assertWalletSnapshot = (expectedWallet: string) => {
    const activeWallet = app.chain.address.get();
    if (!activeWallet || !flashloanAccountsMatch(activeWallet, expectedWallet)) {
      throw new Error(t("walletContextChanged"));
    }
  };

  const assertExactTransactionIdentity = (
    callbackTxid: string,
    resultTxid: unknown,
    callbackConflict = false,
  ): string => {
    const normalizedResult = normalizeFlashloanTxid(resultTxid);
    if (
      callbackConflict
      || (callbackTxid && normalizedResult && callbackTxid !== normalizedResult)
    ) {
      serviceNotice.set(t("transactionIdMismatch"));
      throw new Error(t("transactionIdMismatch"));
    }
    return normalizedResult;
  };

  const eventSlot = (entry: unknown, index: number): unknown => {
    const canonical = app.chain.eventValue(entry, index);
    if (canonical !== undefined) return canonical;
    if (!entry || typeof entry !== "object") return undefined;
    const state = (entry as { state?: unknown }).state;
    const nested = state && typeof state === "object"
      ? (state as { value?: unknown }).value
      : undefined;
    if (!Array.isArray(nested)) return undefined;
    const item = nested[index];
    return item && typeof item === "object" && "value" in item
      ? (item as { value?: unknown }).value
      : item;
  };

  const verificationError = (
    key: "eventMismatch" | "readbackMismatch",
  ) => new FlashloanVerificationError(
    t(key),
    key === "eventMismatch" ? "EVENT_MISMATCH" : "READBACK_MISMATCH",
  );

  const matchingEvent = async (
    eventName: string,
    txid: string,
    immediate?: unknown,
  ): Promise<unknown | null> => {
    const normalizedTxid = txid.toLowerCase();
    if (immediate) {
      const immediateRawTxid = String(rawEventTxid(immediate) ?? "").trim();
      const immediateTxid = eventTxid(immediate);
      // ChainService only returns an event after polling by this txid. Some
      // adapters omit tx_hash from the event envelope, so the immediate event
      // inherits the exact transaction binding from the invoke result.
      if (!immediateRawTxid || immediateTxid === normalizedTxid) return immediate;
      throw verificationError("eventMismatch");
    }
    const events = await app.chain.events(eventName, { limit: MAX_RECOVERY_EVENTS });
    return events.find((entry) => eventTxid(entry) === normalizedTxid) ?? null;
  };

  // The deployed contract exposes both getLoanDetails (Map) and getLoan (Array).
  // We read the Map form (named fields) for clarity, but stay tolerant of an
  // Array payload so a legacy node response still parses.
  const normalizeLoanPayload = (raw: unknown): Record<string, unknown> => {
    if (Array.isArray(raw)) {
      return {
        borrower: raw[0],
        amount: raw[1],
        fee: raw[2],
        callbackContract: raw[3],
        callbackMethod: raw[4],
        timestamp: raw[5],
        executed: raw[6],
        success: raw[7],
      };
    }
    return asRecord(raw);
  };

  const buildLoanDetails = (raw: unknown, loanId: number): LoanDetails | null => {
    const parsed = normalizeLoanPayload(raw);
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) return null;

    const emptyRecord = !String(parsed.borrower ?? "").trim()
      && !String(parsed.callbackContract ?? "").trim()
      && !String(parsed.callbackMethod ?? "").trim()
      && [parsed.amount, parsed.fee, parsed.timestamp].every((value) => (
        /^0*$/.test(String(value ?? "").trim())
      ));
    if (emptyRecord) return null;

    const borrower = normalizeHash160Input(String(parsed.borrower || ""));
    const amount = strictUnsigned(parsed.amount, "loan amount").toString();
    const fee = strictUnsigned(parsed.fee, "loan fee").toString();
    const callbackContract = normalizeHash160Input(String(parsed.callbackContract || ""));
    const callbackMethod = String(parsed.callbackMethod || "");
    const timestamp = strictSafeInteger(parsed.timestamp, "loan timestamp");
    const executed = strictBoolean(parsed.executed, "loan executed");
    const success = strictBoolean(parsed.success, "loan success");
    if (
      !isConfiguredFlashloanAccount(borrower)
      || !isConfiguredFlashloanAccount(callbackContract)
      || !isCallbackMethod(callbackMethod)
      || timestamp <= 0
    ) throw new Error("Flash-loan record is invalid");

    const statusValue: LoanStatus = executed ? (success ? "success" : "failed") : "pending";

    return {
      id: String(loanId),
      borrower: formatAddress(borrower) || t("notAvailable"),
      amount: fixed8ToDisplay(amount),
      fee: fixed8ToDisplay(fee),
      callbackContract: formatAddress(callbackContract) || t("notAvailable"),
      callbackMethod: callbackMethod || t("notAvailable"),
      timestamp: formatTimestamp(timestamp),
      status: statusValue,
    };
  };

  const persistPendingRequest = (record: PendingRequest | null) => {
    if (record) {
      pendingRequest.set(record);
      app.storage.local.set(requestStorageKey, record);
      const stored = app.storage.local.get<PendingRequest | null>(requestStorageKey, null);
      if (!isPendingRequest(stored) || JSON.stringify(stored) !== JSON.stringify(record)) {
        throw new Error(t("recoveryStorageUnavailable"));
      }
    } else {
      const existing = pendingRequest.get();
      app.storage.local.delete(requestStorageKey);
      if (app.storage.local.get(requestStorageKey, null) !== null) {
        pendingRequest.set(existing);
        throw new Error(t("recoveryStorageUnavailable"));
      }
      pendingRequest.set(null);
    }
  };

  const setLastRequestFromPending = (record: PendingRequest, loanId?: string) => {
    lastRequest.set({
      ...(loanId ? { loanId } : {}),
      txid: record.txid,
      amount: fixed8ToDisplay(record.amountFixed8),
      fee: fixed8ToDisplay(record.feeFixed8),
      borrower: formatAddress(record.borrower),
      callbackContract: formatAddress(record.callbackContract),
      callbackMethod: record.callbackMethod,
    });
  };

  const loanRecordMatches = (rawValue: unknown, record: PendingRequest): boolean => {
    const raw = normalizeLoanPayload(rawValue);
    return flashloanAccountsMatch(raw.borrower, record.borrower)
      && flashloanAccountsMatch(raw.callbackContract, record.callbackContract)
      && String(raw.amount ?? "0") === record.amountFixed8
      && String(raw.fee ?? "0") === record.feeFixed8
      && String(raw.callbackMethod ?? "") === record.callbackMethod
      && parseBool(raw.executed)
      && parseBool(raw.success);
  };

  const loanEventMatches = (
    event: unknown,
    record: PendingRequest,
    loanId: string,
  ): boolean => {
    const eventLoanId = String(eventSlot(event, 0) ?? "");
    const eventBorrower = eventSlot(event, 1);
    const eventAmount = String(eventSlot(event, 2) ?? "");
    const eventFee = String(eventSlot(event, 3) ?? "");
    const eventSuccess = parseBool(eventSlot(event, 4));
    return eventLoanId === loanId
      && flashloanAccountsMatch(eventBorrower, record.borrower)
      && eventAmount === record.amountFixed8
      && eventFee === record.feeFixed8
      && eventSuccess;
  };

  const verifyPendingLoan = async (
    record: PendingRequest,
    immediateEvent?: unknown,
  ): Promise<string | null> => {
    const event = await matchingEvent("LoanExecuted", record.txid, immediateEvent);
    if (!event) return null;
    const loanId = String(eventSlot(event, 0) ?? "");
    if (!/^[1-9]\d*$/.test(loanId)) throw verificationError("eventMismatch");
    const loanNumber = Number(loanId);
    if (!Number.isSafeInteger(loanNumber) || loanNumber <= record.baselineTotalLoans) {
      throw verificationError("eventMismatch");
    }
    if (!loanEventMatches(event, record, loanId)) throw verificationError("eventMismatch");
    const loan = await app.chain.readRaw("getLoanDetails", loanArgs(loanNumber), { cache: false });
    if (!loanRecordMatches(loan, record)) throw verificationError("readbackMismatch");

    // A fresh, structurally validated pool snapshot is part of confirmation.
    // The event + loan record bind the exact transaction; the pool read proves
    // the contract is still reachable and is never replaced with local maths.
    const rawStats = asRecord(await app.chain.readRaw("getPlatformStats", [], { cache: false }));
    const totalLoans = strictSafeInteger(rawStats.totalLoans, "totalLoans");
    if (totalLoans < loanNumber) throw verificationError("readbackMismatch");
    const pool = strictUnsigned(rawStats.poolBalance, "poolBalance");
    const fee = strictUnsigned(eventSlot(event, 3), "loan fee");
    if (pool < fee) throw verificationError("readbackMismatch");
    const eligibility = await readBorrowerEligibility(record.borrower);
    if (!eligibility.verified) throw verificationError("readbackMismatch");
    return loanId;
  };

  const recoverPendingRequest = async (): Promise<PendingRecovery> => {
    const record = pendingRequest.get();
    if (!record) return { status: "none" };
    const needsReview = Date.now() - record.submittedAt >= RECOVERY_REVIEW_AFTER_MS;
    const currentContract = normalizeFlashloanContract(app.chain.contractAddress.get());
    if (
      record.network !== effectiveNetwork
      || !currentContract
      || currentContract !== normalizeFlashloanContract(record.contractHash)
    ) {
      return { status: "context-mismatch", record };
    }
    const activeWallet = address.get();
    if (activeWallet && !flashloanAccountsMatch(activeWallet, record.borrower)) {
      return { status: "context-mismatch", record };
    }

    try {
      let loanId = await verifyPendingLoan(record);
      if (!loanId) {
        const outcome = await transactionOutcomeReader(
          record.network,
          record.txid,
          "LoanExecuted",
          record.contractHash,
        );
        if (outcome.state === "fault") {
          persistPendingRequest(null);
          return { status: "fault", record };
        }
        if (outcome.event) loanId = await verifyPendingLoan(record, outcome.event);
        if (!loanId && outcome.state === "halt") {
          return { status: "manual-review", record };
        }
      }
      if (loanId) {
        persistPendingRequest(null);
        setLastRequestFromPending(record, loanId);
        return { status: "confirmed", record, loanId };
      }
      return { status: needsReview ? "manual-review" : "pending", record };
    } catch (error) {
      if (error instanceof FlashloanVerificationError) {
        return { status: "manual-review", record };
      }
      return { status: needsReview ? "manual-review" : "pending", record };
    }
  };

  const persistPendingLiquidity = (record: PendingLiquidity | null) => {
    if (record) {
      pendingLiquidity.set(record);
      app.storage.local.set(liquidityStorageKey, record);
      const stored = app.storage.local.get<PendingLiquidity | null>(liquidityStorageKey, null);
      if (!isPendingLiquidity(stored) || JSON.stringify(stored) !== JSON.stringify(record)) {
        throw new Error(t("recoveryStorageUnavailable"));
      }
    } else {
      const existing = pendingLiquidity.get();
      app.storage.local.delete(liquidityStorageKey);
      if (app.storage.local.get(liquidityStorageKey, null) !== null) {
        pendingLiquidity.set(existing);
        throw new Error(t("recoveryStorageUnavailable"));
      }
      pendingLiquidity.set(null);
    }
  };

  const readProviderStatsFixed8 = async (providerHash: string): Promise<{
    currentBalance: bigint;
    totalDeposited: bigint;
    totalWithdrawn: bigint;
    totalFeesEarned: bigint;
  }> => {
    const raw = asRecord(
      await app.chain.readRaw(
        "getProviderStatsDetails",
        [app.chain.arg.hash160(providerHash)],
        { cache: false },
      ),
    );
    return {
      currentBalance: strictUnsigned(raw.currentBalance, "provider currentBalance"),
      totalDeposited: strictUnsigned(raw.totalDeposited, "provider totalDeposited"),
      totalWithdrawn: strictUnsigned(raw.totalWithdrawn, "provider totalWithdrawn"),
      totalFeesEarned: strictUnsigned(raw.totalFeesEarned, "provider totalFeesEarned"),
    };
  };

  const liquidityEventMatches = (
    event: unknown,
    record: PendingLiquidity,
  ): boolean => {
    const provider = eventSlot(event, 0);
    const amount = String(eventSlot(event, 1) ?? "");
    const newBalance = String(eventSlot(event, 2) ?? "");
    return flashloanAccountsMatch(provider, record.providerHash)
      && amount === record.amountFixed8
      && /^\d+$/.test(newBalance);
  };

  const liquidityMutationConfirmed = async (
    record: PendingLiquidity,
    immediateEvent?: unknown,
  ): Promise<boolean> => {
    if (!record.txid) return false;
    const eventName = record.kind === "deposit" ? "LiquidityDeposited" : "LiquidityWithdrawn";
    const event = await matchingEvent(eventName, record.txid, immediateEvent);
    if (!event) return false;
    if (!liquidityEventMatches(event, record)) throw verificationError("eventMismatch");

    const eventBalance = strictUnsigned(eventSlot(event, 2), "provider event balance");
    const provider = await readProviderStatsFixed8(record.providerHash);
    const rawStats = asRecord(await app.chain.readRaw("getPlatformStats", [], { cache: false }));
    strictUnsigned(rawStats.poolBalance, "poolBalance");
    const amount = BigInt(record.amountFixed8);
    const baseline = BigInt(record.baselineBalanceFixed8);
    if (record.kind === "deposit") {
      // The deployed event's third slot is lifetime totalDeposited, not the
      // current withdrawable balance. Readback may have moved again later, but
      // its lifetime total cannot contradict the transaction-bound event.
      const baselineDeposited = record.baselineTotalDepositedFixed8 === undefined
        ? null
        : BigInt(record.baselineTotalDepositedFixed8);
      if (
        eventBalance < amount
        || (baselineDeposited !== null && eventBalance < baselineDeposited + amount)
        || provider.totalDeposited < eventBalance
      ) {
        throw verificationError("readbackMismatch");
      }
    } else {
      if (baseline < amount || eventBalance !== baseline - amount) {
        throw verificationError("eventMismatch");
      }
      const baselineWithdrawn = record.baselineTotalWithdrawnFixed8 === undefined
        ? 0n
        : BigInt(record.baselineTotalWithdrawnFixed8);
      if (provider.totalWithdrawn < baselineWithdrawn + amount) {
        throw verificationError("readbackMismatch");
      }
    }
    return true;
  };

  const recoverPendingLiquidity = async (): Promise<PendingRecovery<PendingLiquidity>> => {
    const record = pendingLiquidity.get();
    if (!record) return { status: "none" };
    const needsReview = Date.now() - record.submittedAt >= RECOVERY_REVIEW_AFTER_MS;
    const currentContract = normalizeFlashloanContract(app.chain.contractAddress.get());
    if (
      record.network !== effectiveNetwork
      || !currentContract
      || currentContract !== normalizeFlashloanContract(record.contractHash)
    ) {
      return { status: "context-mismatch", record };
    }
    const activeWallet = address.get();
    if (activeWallet && !flashloanAccountsMatch(activeWallet, record.providerHash)) {
      return { status: "context-mismatch", record };
    }
    if (record.kind === "deposit" && record.paymentTxid && !record.txid) {
      const payment = await paymentOutcomeReader(record);
      if (payment.state === "fault") {
        persistPendingLiquidity(null);
        return { status: "fault", record };
      }
      if (payment.state === "halt" && payment.event) return { status: "resume", record };
      if (payment.state === "halt") return { status: "manual-review", record };
      return { status: needsReview ? "manual-review" : "pending", record };
    }
    try {
      if (await liquidityMutationConfirmed(record)) {
        persistPendingLiquidity(null);
        return { status: "confirmed" };
      }
      if (record.txid) {
        const eventName = record.kind === "deposit" ? "LiquidityDeposited" : "LiquidityWithdrawn";
        const outcome = await transactionOutcomeReader(
          record.network,
          record.txid,
          eventName,
          record.contractHash,
        );
        if (outcome.state === "fault") {
          if (record.kind === "deposit" && record.network === "testnet" && record.paymentTxid) {
            persistPendingLiquidity({ ...record, txid: "" });
            return { status: "resume", record: { ...record, txid: "" } };
          }
          persistPendingLiquidity(null);
          return { status: "fault", record };
        }
        if (outcome.event && await liquidityMutationConfirmed(record, outcome.event)) {
          persistPendingLiquidity(null);
          return { status: "confirmed", record };
        }
        if (outcome.state === "halt") return { status: "manual-review", record };
      }
      return { status: needsReview ? "manual-review" : "pending" };
    } catch (error) {
      if (error instanceof FlashloanVerificationError) {
        return { status: "manual-review", record };
      }
      return { status: needsReview ? "manual-review" : "pending" };
    }
  };

  const blockOnOtherPendingRequest = async () => {
    const recovery = await recoverPendingRequest();
    if (recovery.status === "none") return;
    if (recovery.status === "confirmed") {
      serviceNotice.set(t("loanRecovered"));
      throw new Error(t("recoveredActionNotReplayed"));
    }
    if (recovery.status === "fault") {
      serviceNotice.set(t("loanTransactionFault"));
      throw new Error(t("loanTransactionFault"));
    }
    if (recovery.status === "context-mismatch") {
      serviceNotice.set(t("pendingContextMismatch"));
      throw new Error(t("pendingContextMismatch"));
    }
    serviceNotice.set(t("otherFinancialActionPending"));
    throw new Error(t("otherFinancialActionPending"));
  };

  const blockOnOtherPendingLiquidity = async () => {
    const recovery = await recoverPendingLiquidity();
    liquidityRecoveryState.set(recovery.status);
    if (recovery.status === "none") return;
    if (recovery.status === "confirmed") {
      serviceNotice.set(t("liquidityRecovered"));
      throw new Error(t("recoveredActionNotReplayed"));
    }
    if (recovery.status === "fault") {
      serviceNotice.set(t("liquidityTransactionFault"));
      throw new Error(t("liquidityTransactionFault"));
    }
    if (recovery.status === "resume") {
      serviceNotice.set(t("liquidityResumeRequired"));
      throw new Error(t("liquidityResumeRequired"));
    }
    if (recovery.status === "context-mismatch") {
      serviceNotice.set(t("pendingContextMismatch"));
      throw new Error(t("pendingContextMismatch"));
    }
    serviceNotice.set(t("otherFinancialActionPending"));
    throw new Error(t("otherFinancialActionPending"));
  };

  const validateLoanId = (id: string): string | null => {
    const trimmed = id.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      return t("invalidLoanId");
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) return t("invalidLoanId");
    return null;
  };

  const validateLoanRequest = (data: {
    amount: string;
    callbackContract: string;
    callbackMethod: string;
  }): string | null => {
    const amountFixed8 = parseGasAmountFixed8(data.amount);
    if (!amountFixed8) {
      return t("invalidLoanAmount");
    }
    const amountRaw = BigInt(amountFixed8);
    const { minLoan, minLoanFixed8, maxLoan, maxLoanFixed8 } = contractStats.get();
    if (amountRaw < BigInt(minLoanFixed8)) {
      return t("loanAmountBelowMin", { min: minLoan.toLocaleString() });
    }
    if (amountRaw > BigInt(maxLoanFixed8)) {
      return t("loanAmountAboveMax", { max: maxLoan.toLocaleString() });
    }
    if (!data.callbackContract || data.callbackContract.trim().length < 34) {
      return t("invalidCallbackContract");
    }
    if (!isConfiguredFlashloanAccount(normalizeHash160Input(data.callbackContract))) {
      return t("invalidCallbackContract");
    }
    if (!isCallbackMethod(data.callbackMethod)) {
      return t("invalidCallbackMethod");
    }
    return null;
  };

  const validateLiquidityAmount = (amount: string): string | null => {
    if (!parseGasAmountFixed8(amount)) {
      return t("invalidLiquidityAmount");
    }
    return null;
  };

  const loanArgs = (loanId: number): ContractArg[] => [
    app.chain.arg.integer(loanId) as ContractArg,
  ];

  // -- Data loading (via FlashLoan contract) --------------------------------

  const applyPlatformStats = (rawStats: Record<string, unknown>, commit = true) => {
    const totalLoans = strictSafeInteger(rawStats.totalLoans, "totalLoans");
    const totalBorrowed = strictUnsigned(rawStats.totalBorrowed, "totalBorrowed");
    const totalFeesRaw = strictUnsigned(rawStats.totalFees, "totalFees");
    const poolRaw = strictUnsigned(rawStats.poolBalance, "poolBalance");
    const minLoanRaw = strictUnsigned(rawStats.minLoan, "minLoan");
    const maxLoanRaw = strictUnsigned(rawStats.maxLoan, "maxLoan");
    const feeBasisPoints = strictSafeInteger(
      rawStats.feeBasisPoints ?? rawStats.feesBasisPoints,
      "feeBasisPoints",
    );
    const cooldownSeconds = strictSafeInteger(rawStats.loanCooldownSeconds, "loanCooldownSeconds");
    const maxDailyLoans = strictSafeInteger(rawStats.maxDailyLoans, "maxDailyLoans");
    const providerFeeShare = strictSafeInteger(rawStats.providerFeeShare, "providerFeeShare");
    if (
      minLoanRaw <= 0n
      || maxLoanRaw < minLoanRaw
      || feeBasisPoints <= 0
      || feeBasisPoints > 10_000
      || maxDailyLoans <= 0
      || providerFeeShare < 0
      || providerFeeShare > 100
    ) {
      throw new Error("Flash-loan contract parameters are invalid");
    }

    const totalVolume = fixed8ToDecimal(totalBorrowed);
    const totalFees = fixed8ToDecimal(totalFeesRaw);
    const pool = fixed8ToDecimal(poolRaw);

    if (commit) {
      poolBalance.set(pool);
      poolBalanceFixed8.set(poolRaw.toString());
      stats.set({
        totalLoans,
        totalVolume,
        totalVolumeFixed8: totalBorrowed.toString(),
        totalFees,
        totalFeesFixed8: totalFeesRaw.toString(),
      });
      contractStats.set({
        minLoan: fixed8ToDecimal(minLoanRaw),
        minLoanFixed8: minLoanRaw.toString(),
        maxLoan: fixed8ToDecimal(maxLoanRaw),
        maxLoanFixed8: maxLoanRaw.toString(),
        feeBasisPoints,
        cooldownMs: cooldownSeconds * 1000,
        maxDailyLoans,
        providerFeeShare,
      });
    }

    return { totalLoans, poolRaw };
  };

  const loadRecentLoans = async (
    totalLoans: number,
    shouldCommit: () => boolean = () => true,
  ) => {
    const start = Math.max(1, totalLoans - 4);
    const ids: number[] = [];
    for (let id = totalLoans; id >= start; id -= 1) ids.push(id);

    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          return buildLoanDetails(
            await app.chain.readRaw("getLoanDetails", loanArgs(id), {
              cache: true,
              cacheTtlMs: 30_000,
            }),
            id,
          );
        } catch {
          return null;
        }
      }),
    );

    const loans: ExecutedLoan[] = [];
    ids.forEach((id, index) => {
      const entry = entries[index];
      if (!entry) return;
      loans.push({
        id,
        amount: entry.amount,
        fee: entry.fee,
        status: entry.status,
        timestamp: entry.timestamp,
      });
    });
    if (shouldCommit()) recentLoans.set(loans);
  };

  const loadLoanStats = async (
    cache = true,
    shouldCommit: () => boolean = () => true,
  ) => {
    const context = requireCanonicalFlashloanContext(
      app,
      effectiveNetwork,
      t("chainContextMismatch"),
    );
    const statsPromise = app.chain.readRaw("getPlatformStats", [], {
        cache,
        cacheTtlMs: 30_000,
        scriptHash: context.contractHash,
      });
    const pausedPromise = app.chain.readRaw("isPaused", [], {
      cache: false,
      scriptHash: context.contractHash,
    });
    const paymentHubPromise = isMainnet
      ? app.chain.readRaw("paymentHub", [], {
          cache: false,
          scriptHash: context.contractHash,
        }).then((value) => ({ reachable: true, value })).catch(() => ({ reachable: false, value: null }))
      : Promise.resolve({ reachable: true, value: "testnet-prepaid" });
    const [rawStatsValue, pausedValue, paymentHub] = await Promise.all([
      statsPromise,
      pausedPromise,
      paymentHubPromise,
    ]);
    const rawStats = asRecord(rawStatsValue);
    const paused = strictBoolean(pausedValue, "paused");
    const commit = shouldCommit();
    const snapshot = applyPlatformStats(rawStats, commit);
    if (commit) {
      if (!isMainnet || isConfiguredFlashloanAccount(paymentHub.value)) {
        depositCapability.set({ status: "ready", reason: "" });
      } else {
        depositCapability.set({
          status: "unavailable",
          reason: paymentHub.reachable ? "payment-hub-unavailable" : "chain-unavailable",
        });
      }
      contractHealth.set({ status: paused ? "paused" : "ready", checkedAt: Date.now() });
    }
    if (cache) await loadRecentLoans(snapshot.totalLoans, shouldCommit);
    return { ...snapshot, paused };
  };

  const readBorrowerEligibility = async (
    borrower: string,
    shouldCommit: () => boolean = () => true,
  ): Promise<BorrowerEligibility> => {
    const borrowerHash = normalizeHash160Input(borrower);
    if (!borrowerHash) throw new Error(t("walletRequired"));
    const raw = asRecord(
      await app.chain.readRaw(
        "getBorrowerEligibility",
        [app.chain.arg.hash160(borrowerHash)],
        { cache: false },
      ),
    );
    const maxAvailableLoan = strictUnsigned(raw.maxAvailableLoan, "maxAvailableLoan");
    const eligibility: BorrowerEligibility = {
      verified: true,
      canBorrow: strictBoolean(raw.canBorrow, "canBorrow"),
      maxAvailableLoan: fixed8ToDecimal(maxAvailableLoan),
      maxAvailableLoanFixed8: maxAvailableLoan.toString(),
      cooldownRemaining: strictSafeInteger(raw.cooldownRemaining, "cooldownRemaining"),
      dailyLoansRemaining: strictSafeInteger(raw.dailyLoansRemaining, "dailyLoansRemaining"),
    };
    if (
      shouldCommit()
      && flashloanAccountsMatch(address.get(), borrowerHash)
    ) {
      borrowerEligibility.set(eligibility);
    }
    return eligibility;
  };

  const loadProviderStats = async (
    expectedAddress = address.get(),
    shouldCommit: () => boolean = () => true,
  ) => {
    const addr = expectedAddress;
    if (!addr) {
      if (shouldCommit()) providerStats.set(EMPTY_PROVIDER_STATS);
      return;
    }
    const providerHash = normalizeHash160Input(addr);
    if (!providerHash) {
      if (shouldCommit()) providerStats.set(EMPTY_PROVIDER_STATS);
      return;
    }
    const raw = await readProviderStatsFixed8(providerHash);
    if (shouldCommit() && flashloanAccountsMatch(address.get(), providerHash)) {
      providerStats.set({
        currentBalance: fixed8ToDecimal(raw.currentBalance),
        currentBalanceFixed8: raw.currentBalance.toString(),
        totalDeposited: fixed8ToDecimal(raw.totalDeposited),
        totalDepositedFixed8: raw.totalDeposited.toString(),
        totalFeesEarned: fixed8ToDecimal(raw.totalFeesEarned),
        totalFeesEarnedFixed8: raw.totalFeesEarned.toString(),
      });
    }
  };

  const refreshWriteCapability = async (
    expectedAddress = address.get(),
    shouldCommit: () => boolean = () => true,
  ) => {
    if (!expectedAddress) {
      if (shouldCommit()) {
        writeCapability.set({ status: "checking", reason: "wallet-disconnected" });
      }
      return;
    }
    try {
      await requireWritableFlashloanContext(app, effectiveNetwork, t);
      if (shouldCommit() && flashloanAccountsMatch(address.get(), expectedAddress)) {
        writeCapability.set({ status: "ready", reason: "" });
      }
    } catch {
      if (shouldCommit() && flashloanAccountsMatch(address.get(), expectedAddress)) {
        writeCapability.set({ status: "blocked", reason: "chain-context-mismatch" });
      }
    }
  };

  const loadData = async () => {
    const epoch = ++loadDataEpoch;
    const shouldCommit = () => epoch === loadDataEpoch;
    try {
      await loadLoanStats(true, shouldCommit);
      if (!shouldCommit()) return;
      const currentAddress = address.get();
      let walletDataUnavailable = false;
      if (!currentAddress) {
        borrowerEligibility.set(EMPTY_ELIGIBILITY);
      }
      // Wallet-scoped reads and wallet-network detection are independent. Keep
      // the pool desk responsive by resolving them in parallel after the shared
      // contract snapshot is known.
      await Promise.all([
        loadProviderStats(currentAddress, shouldCommit).catch(() => {
          walletDataUnavailable = true;
          if (shouldCommit() && flashloanAccountsMatch(address.get(), currentAddress)) {
            providerStats.set(EMPTY_PROVIDER_STATS);
          }
        }),
        currentAddress
          ? readBorrowerEligibility(currentAddress, shouldCommit).catch(() => {
              walletDataUnavailable = true;
              if (shouldCommit() && flashloanAccountsMatch(address.get(), currentAddress)) {
                borrowerEligibility.set(EMPTY_ELIGIBILITY);
              }
            })
          : Promise.resolve(),
        refreshWriteCapability(currentAddress, shouldCommit),
      ]);
      if (!shouldCommit()) return;
      serviceNotice.set(walletDataUnavailable ? t("walletDataUnavailable") : "");
    } catch (e) {
      if (!shouldCommit()) return;
      // Preserve the last good snapshot — never present zeros as fact.
      console.warn(
        "[useFlashloanCore] loadData failed:",
        e instanceof Error ? e.message : String(e),
      );
      contractHealth.set({ status: "unavailable", checkedAt: Date.now() });
      depositCapability.set({ status: "unavailable", reason: "chain-unavailable" });
      writeCapability.set({ status: "blocked", reason: "chain-unavailable" });
      borrowerEligibility.set(EMPTY_ELIGIBILITY);
      serviceNotice.set(t("statsUnavailable"));
    }

    if (!shouldCommit()) return;

    const recovery = await recoverPendingRequest();
    if (!shouldCommit()) return;
    if (recovery.status === "pending") serviceNotice.set(t("loanConfirmationPending"));
    if (recovery.status === "confirmed") serviceNotice.set(t("loanRecovered"));
    if (recovery.status === "manual-review") serviceNotice.set(t("loanConfirmationReview"));
    if (recovery.status === "context-mismatch") serviceNotice.set(t("pendingContextMismatch"));
    if (recovery.status === "fault") serviceNotice.set(t("loanTransactionFault"));
    const liquidityRecovery = await recoverPendingLiquidity();
    if (!shouldCommit()) return;
    liquidityRecoveryState.set(liquidityRecovery.status);
    if (liquidityRecovery.status === "pending") serviceNotice.set(t("liquidityConfirmationPending"));
    if (liquidityRecovery.status === "resume") serviceNotice.set(t("liquidityResumeRequired"));
    if (liquidityRecovery.status === "confirmed") serviceNotice.set(t("liquidityRecovered"));
    if (liquidityRecovery.status === "manual-review") serviceNotice.set(t("liquidityConfirmationReview"));
    if (liquidityRecovery.status === "context-mismatch") serviceNotice.set(t("pendingContextMismatch"));
    if (liquidityRecovery.status === "fault") serviceNotice.set(t("liquidityTransactionFault"));
  };

  // -- Actions (via FlashLoan contract) -------------------------------------

  /**
   * Look up a loan by ID through getLoanDetails(loanId).
   */
  const lookupLoan = async (loanIdValue: string) => {
    const validation = validateLoanId(loanIdValue);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    const loanId = Number(loanIdValue);
    const epoch = ++lookupEpoch;
    isLookupLoading.set(true);

    try {
      const parsed = await app.chain.readRaw("getLoanDetails", loanArgs(loanId));
      if (epoch !== lookupEpoch) return;
      const details = buildLoanDetails(parsed, loanId);
      if (!details) {
        loanDetails.set(null);
        throw new Error(t("loanNotFound"));
      }

      loanDetails.set(details);
    } catch (error) {
      if (epoch !== lookupEpoch) return;
      throw error;
    } finally {
      if (epoch === lookupEpoch) isLookupLoading.set(false);
    }
  };

  /**
   * Request a flash loan through the deployed dynamic callback ABI:
   * requestLoan(borrower, amount, callbackContract, callbackMethod).
   *
   * The lender calls callbackMethod(borrower, amount, fee, loanId). This is
   * not ERC-3156 and the callback name is not universally fixed. Testnet's
   * deployed harness is verified with `execute`; mainnet has no bundled sample
   * callback and therefore requires an explicit method from the user.
   */
  const requestLoanImpl = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
    const validation = validateLoanRequest(data);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    await blockOnOtherPendingLiquidity();
    const recovery = await recoverPendingRequest();
    if (recovery.status === "confirmed" && recovery.record) {
      serviceNotice.set(t("loanRecovered"));
      throw new Error(t("recoveredActionNotReplayed"));
    }
    if (recovery.status === "pending" || recovery.status === "manual-review") {
      serviceNotice.set(t("loanConfirmationPending"));
      throw new Error(recovery.status === "manual-review"
        ? t("loanConfirmationReview")
        : t("loanConfirmationPending"));
    }
    if (recovery.status === "context-mismatch") {
      serviceNotice.set(t("pendingContextMismatch"));
      throw new Error(t("pendingContextMismatch"));
    }
    if (recovery.status === "fault") {
      serviceNotice.set(t("loanTransactionFault"));
      throw new Error(t("loanTransactionFault"));
    }

    isLoading.set(true);

    try {
      const contextBeforeWallet = await requireWritableFlashloanContext(app, effectiveNetwork, t);
      assertFlashloanRecoveryStorage(app, t);
      const borrower = await app.chain.ensureWallet();
      const context = await revalidateWriteContext(contextBeforeWallet);
      assertWalletSnapshot(borrower);
      const callbackContract = normalizeHash160Input(data.callbackContract);
      if (!isConfiguredFlashloanAccount(callbackContract)) {
        throw new Error(t("invalidCallbackContract"));
      }
      const amountFixed8 = parseGasAmountFixed8(data.amount);
      if (!amountFixed8) throw new Error(t("invalidLoanAmount"));
      address.set(borrower);

      let liveSnapshot: Awaited<ReturnType<typeof loadLoanStats>>;
      let eligibility: BorrowerEligibility;
      try {
        liveSnapshot = await loadLoanStats(false);
        eligibility = await readBorrowerEligibility(borrower);
      } catch {
        throw new Error(t("statsUnavailable"));
      }
      if (liveSnapshot.paused) throw new Error(t("contractPaused"));
      if (BigInt(amountFixed8) > liveSnapshot.poolRaw) {
        throw new Error(t("loanExceedsPool", { pool: fixed8ToDisplay(liveSnapshot.poolRaw) }));
      }
      if (!eligibility.canBorrow || eligibility.cooldownRemaining > 0) {
        throw new Error(t("borrowerCooldown", { seconds: eligibility.cooldownRemaining }));
      }
      if (eligibility.dailyLoansRemaining <= 0) throw new Error(t("dailyLimitReached"));
      if (BigInt(amountFixed8) > BigInt(eligibility.maxAvailableLoanFixed8)) {
        throw new Error(t("loanExceedsEligibility", { max: eligibility.maxAvailableLoan }));
      }
      const feeFixed8 = estimateFeeFixed8(data.amount);

      const contractHash = context.contractHash;

      const pendingBase: Omit<PendingRequest, "txid"> = {
        schema: PENDING_SCHEMA,
        network: effectiveNetwork,
        borrower,
        callbackContract,
        callbackMethod: data.callbackMethod,
        amountFixed8,
        feeFixed8,
        baselineTotalLoans: liveSnapshot.totalLoans,
        baselinePoolFixed8: liveSnapshot.poolRaw.toString(),
        contractHash,
        submittedAt: Date.now(),
      };

      // Both wallet addresses and already-normalized script hashes use the
      // canonical Hash160 builder so wallet adapters receive one ABI shape.
      let broadcastTxid = "";
      let broadcastTxidConflict = false;
      const onTransactionSent = (txid: string) => {
        const normalized = normalizeFlashloanTxid(txid);
        if (!normalized) return;
        if (broadcastTxid && broadcastTxid !== normalized) {
          broadcastTxidConflict = true;
          return;
        }
        if (!broadcastTxid) {
          broadcastTxid = normalized;
          persistPendingRequest({ ...pendingBase, txid: normalized });
        }
      };

      await revalidateWriteContext(context);
      assertWalletSnapshot(borrower);

      let result;
      try {
        result = await app.chain.invoke(
          "requestLoan",
          [
            app.chain.arg.hash160(borrower),
            app.chain.arg.integer(amountFixed8),
            app.chain.arg.hash160(callbackContract),
            app.chain.arg.string(data.callbackMethod),
          ],
          {
            waitForEvent: "LoanExecuted",
            waitTimeoutMs: 30_000,
            onTransactionSent,
          },
        );
      } catch (error) {
        if (pendingRequest.get()) {
          serviceNotice.set(t("loanConfirmationPending"));
          throw new Error(t("loanConfirmationPending"));
        }
        throw error;
      }

      const resultTxid = assertExactTransactionIdentity(
        broadcastTxid,
        result.txid,
        broadcastTxidConflict,
      );
      if (!resultTxid) {
        if (pendingRequest.get()) {
          serviceNotice.set(t("loanConfirmationPending"));
          throw new Error(t("loanConfirmationPending"));
        }
        throw new Error(t("loanRequestUnavailable"));
      }
      const submittedRequest: PendingRequest = pendingRequest.get() ?? {
        ...pendingBase,
        txid: resultTxid,
      };
      if (!pendingRequest.get()) persistPendingRequest(submittedRequest);

      if (result.success === false) {
        const outcome = await transactionOutcomeReader(
          submittedRequest.network,
          submittedRequest.txid,
          "LoanExecuted",
          submittedRequest.contractHash,
        );
        if (outcome.state === "fault") {
          persistPendingRequest(null);
          serviceNotice.set(t("loanTransactionFault"));
          throw new Error(t("loanTransactionFault"));
        }
        serviceNotice.set(t("loanConfirmationPending"));
        throw new Error(t("loanConfirmationPending"));
      }

      let confirmedLoanId: string | null = null;
      try {
        confirmedLoanId = await verifyPendingLoan(
          submittedRequest,
          result.verified === true ? result.event : undefined,
        );
        if (!confirmedLoanId) {
          confirmedLoanId = await app.chain.waitForState(
            () => verifyPendingLoan(submittedRequest),
            (loanId) => Boolean(loanId),
            { attempts: 4, firstDelayMs: 4_000, delayMs: 5_000 },
          );
        }
      } catch (error) {
        if (error instanceof FlashloanVerificationError) {
          serviceNotice.set(error.message);
          throw error;
        }
        serviceNotice.set(t("loanConfirmationPending"));
        throw new Error(t("loanConfirmationPending"));
      }
      if (!confirmedLoanId) {
        serviceNotice.set(t("loanConfirmationPending"));
        throw new Error(t("loanConfirmationPending"));
      }

      persistPendingRequest(null);
      lastRequest.set({
        loanId: confirmedLoanId,
        txid: resultTxid,
        amount: fixed8ToDisplay(amountFixed8),
        fee: fixed8ToDisplay(feeFixed8),
        borrower: formatAddress(borrower),
        callbackContract: formatAddress(callbackContract),
        callbackMethod: data.callbackMethod,
      });

      // Award first-loan badge (fire-and-forget)
      if (stats.get().totalLoans === 0) {
        badgeService.award("first-flashloan", borrower).catch(() => {});
      }

      await loadData();
      return { ...result, verified: true };
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Provide liquidity to the pool via deposit(depositor, amount, receiptId).
   *
   * On testnet the GAS is bundled with the call through invokeWithPayment (the
   * memo creates the credit the contract consumes). On mainnet the host wallet
   * cannot bundle a settled prepaid transfer, so the caller pre-transfers GAS
   * with the deposit memo and supplies the resulting receipt id.
   */
  const confirmLiquidityResult = async (
    record: PendingLiquidity,
    immediateEvent?: unknown,
  ): Promise<boolean> => {
    let confirmed = false;
    try {
      confirmed = await liquidityMutationConfirmed(record, immediateEvent);
    } catch (error) {
      if (error instanceof FlashloanVerificationError) {
        serviceNotice.set(error.message);
        throw error;
      }
    }
    if (!confirmed) {
      try {
        confirmed = Boolean(await app.chain.waitForState(
          () => liquidityMutationConfirmed(record),
          (value) => value,
          { attempts: 4, firstDelayMs: 4_000, delayMs: 5_000 },
        ));
      } catch (error) {
        if (error instanceof FlashloanVerificationError) {
          serviceNotice.set(error.message);
          throw error;
        }
      }
    }
    return confirmed;
  };

  const provideLiquidityImpl = async (amount: string, receiptId?: string) => {
    const validation = validateLiquidityAmount(amount);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);
    await blockOnOtherPendingRequest();
    const recovery = await recoverPendingLiquidity();
    liquidityRecoveryState.set(recovery.status);
    if (recovery.status === "confirmed") {
      await loadData();
      serviceNotice.set(t("liquidityRecovered"));
      throw new Error(t("recoveredActionNotReplayed"));
    }
    if (recovery.status === "resume") {
      serviceNotice.set(t("liquidityResumeRequired"));
      throw new Error(t("liquidityResumeRequired"));
    }
    if (recovery.status === "pending") {
      serviceNotice.set(t("liquidityConfirmationPending"));
      throw new Error(t("liquidityConfirmationPending"));
    }
    if (recovery.status === "manual-review") {
      serviceNotice.set(t("liquidityConfirmationReview"));
      throw new Error(t("liquidityConfirmationReview"));
    }
    if (recovery.status === "context-mismatch") {
      serviceNotice.set(t("pendingContextMismatch"));
      throw new Error(t("pendingContextMismatch"));
    }
    if (recovery.status === "fault") {
      serviceNotice.set(t("liquidityTransactionFault"));
      throw new Error(t("liquidityTransactionFault"));
    }
    const mainnetReceiptId = String(receiptId ?? "").trim();

    isLoading.set(true);
    try {
      const contextBeforeWallet = await requireWritableFlashloanContext(app, effectiveNetwork, t);
      assertFlashloanRecoveryStorage(app, t);
      const liveSnapshot = await loadLoanStats(false).catch(() => {
        throw new Error(t("statsUnavailable"));
      });
      if (liveSnapshot.paused) throw new Error(t("contractPaused"));
      if (depositCapability.get().status !== "ready") {
        throw new Error(t(
          depositCapability.get().reason === "payment-hub-unavailable"
            ? "paymentHubUnavailable"
            : "statsUnavailable",
        ));
      }
      if (isMainnet && !/^[1-9]\d*$/.test(mainnetReceiptId)) {
        throw new Error(t("receiptIdRequired"));
      }
      const provider = await app.chain.ensureWallet();
      const context = await revalidateWriteContext(contextBeforeWallet);
      assertWalletSnapshot(provider);
      address.set(provider);
      const providerHash = normalizeHash160Input(provider);
      if (!providerHash) throw new Error(t("walletRequired"));
      const amountFixed8 = parseGasAmountFixed8(amount);
      if (!amountFixed8) throw new Error(t("invalidLiquidityAmount"));
      const baselineProvider = await readProviderStatsFixed8(providerHash).catch(() => {
        throw new Error(t("statsUnavailable"));
      });
      const contractHash = context.contractHash;
      const pendingBase: Omit<PendingLiquidity, "txid"> = {
        schema: PENDING_SCHEMA,
        network: effectiveNetwork,
        paymentTxid: "",
        kind: "deposit",
        providerHash,
        amountFixed8,
        baselineBalanceFixed8: baselineProvider.currentBalance.toString(),
        baselineTotalDepositedFixed8: baselineProvider.totalDeposited.toString(),
        baselineTotalWithdrawnFixed8: baselineProvider.totalWithdrawn.toString(),
        contractHash,
        submittedAt: Date.now(),
      };
      let paymentTxid = "";
      let paymentTxidConflict = false;
      let actionTxid = "";
      let actionTxidConflict = false;
      const onTransactionSent = (txid: string) => {
        const normalized = normalizeFlashloanTxid(txid);
        if (!normalized) return;
        if (actionTxid && actionTxid !== normalized) {
          actionTxidConflict = true;
          return;
        }
        if (!actionTxid) {
          actionTxid = normalized;
          persistPendingLiquidity({
            ...pendingBase,
            paymentTxid: paymentTxid || pendingLiquidity.get()?.paymentTxid || "",
            txid: normalized,
          });
        }
      };

      await revalidateWriteContext(context);
      assertWalletSnapshot(provider);

      let result: Awaited<ReturnType<typeof app.chain.invoke>>;
      try {
        if (isMainnet) {
          // Mainnet receipt-id deposit lane (S3): the GAS was pre-transferred
          // with the deposit memo; receiptPay appends the receipt id as the
          // trailing Integer argument. notify:'silent' — the action wrapper in
          // main.tsx owns the liquidityDeposited/error toasts.
          result = await app.funds.receiptPay({
            operation: "deposit",
            args: [
              app.chain.arg.hash160(provider),
              app.chain.arg.integer(amountFixed8),
            ],
            receiptId: mainnetReceiptId,
            notify: "silent",
            waitForEvent: "LiquidityDeposited",
            waitTimeoutMs: 30_000,
            onTransactionSent,
          });
        } else {
          result = await app.chain.invokeWithPayment(
            amountFixed8,
            DEPOSIT_MEMO,
            "deposit",
            [
              app.chain.arg.hash160(provider),
              app.chain.arg.integer(amountFixed8),
            ],
            {
              waitForEvent: "LiquidityDeposited",
              waitTimeoutMs: 30_000,
              onPaymentSent: (txid) => {
                const normalized = normalizeFlashloanTxid(txid);
                if (!normalized) return;
                if (paymentTxid && paymentTxid !== normalized) {
                  paymentTxidConflict = true;
                  return;
                }
                if (!paymentTxid) {
                  paymentTxid = normalized;
                  persistPendingLiquidity({
                    ...pendingBase,
                    paymentTxid: normalized,
                    txid: "",
                  });
                }
              },
              onTransactionSent,
            },
          );
        }
      } catch (error) {
        if (!isMainnet && error && typeof error === "object") {
          const depositTxid = normalizeFlashloanTxid(
            (error as { depositTxid?: unknown }).depositTxid,
          );
          if (depositTxid && paymentTxid && depositTxid !== paymentTxid) {
            paymentTxidConflict = true;
          } else if (depositTxid && !pendingLiquidity.get()) {
            paymentTxid = depositTxid;
            persistPendingLiquidity({
              ...pendingBase,
              paymentTxid: depositTxid,
              txid: "",
            });
          }
        }
        if (paymentTxidConflict || actionTxidConflict) {
          serviceNotice.set(t("transactionIdMismatch"));
          throw new Error(t("transactionIdMismatch"));
        }
        const pending = pendingLiquidity.get();
        if (pending?.paymentTxid && !pending.txid) {
          const payment = await paymentOutcomeReader(pending);
          if (payment.state === "fault") {
            persistPendingLiquidity(null);
            serviceNotice.set(t("liquidityTransactionFault"));
            throw new Error(t("liquidityTransactionFault"));
          }
          if (payment.state === "halt" && payment.event) {
            liquidityRecoveryState.set("resume");
            serviceNotice.set(t("liquidityResumeRequired"));
            throw new Error(t("liquidityResumeRequired"));
          }
          liquidityRecoveryState.set("pending");
          serviceNotice.set(t("liquidityPaymentPending"));
          throw new Error(t("liquidityPaymentPending"));
        }
        if (pending?.txid) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        throw error;
      }

      const resultTxid = assertExactTransactionIdentity(
        actionTxid,
        result.txid,
        actionTxidConflict || paymentTxidConflict,
      );
      if (!resultTxid) {
        const pending = pendingLiquidity.get();
        if (pending?.paymentTxid) {
          liquidityRecoveryState.set("pending");
          serviceNotice.set(t("liquidityPaymentPending"));
          throw new Error(t("liquidityPaymentPending"));
        }
        if (pending?.txid) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        throw new Error(t("liquidityActionUnavailable"));
      }
      const submitted = pendingLiquidity.get() ?? {
        ...pendingBase,
        paymentTxid,
        txid: resultTxid,
      };
      if (!pendingLiquidity.get()) persistPendingLiquidity(submitted);
      if (result.success === false) {
        const outcome = await transactionOutcomeReader(
          submitted.network,
          submitted.txid,
          "LiquidityDeposited",
          submitted.contractHash,
        );
        if (outcome.state === "fault") {
          if (submitted.network === "testnet" && submitted.paymentTxid) {
            const paymentOnly = { ...submitted, txid: "" };
            persistPendingLiquidity(paymentOnly);
            const payment = await paymentOutcomeReader(paymentOnly);
            if (payment.state === "halt" && payment.event) {
              liquidityRecoveryState.set("resume");
              serviceNotice.set(t("liquidityResumeRequired"));
              throw new Error(t("liquidityResumeRequired"));
            }
            liquidityRecoveryState.set("pending");
            serviceNotice.set(t("liquidityPaymentPending"));
            throw new Error(t("liquidityPaymentPending"));
          }
          persistPendingLiquidity(null);
          throw new Error(t("liquidityTransactionFault"));
        }
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }
      if (!await confirmLiquidityResult(submitted, result.verified === true ? result.event : undefined)) {
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }

      persistPendingLiquidity(null);

      await loadData();
      return { ...result, verified: true };
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Finalize a testnet deposit after the GAS transfer was broadcast but the
   * two-argument deposit call failed or the app refreshed. This path never
   * sends another payment.
   */
  const resumePendingLiquidityImpl = async () => {
    const record = pendingLiquidity.get();
    if (
      !record
      || record.kind !== "deposit"
      || record.network !== "testnet"
      || !record.paymentTxid
      || record.txid
    ) {
      throw new Error(t("liquidityResumeUnavailable"));
    }
    await blockOnOtherPendingRequest();
    isLoading.set(true);
    try {
      const contextBeforeWallet = await requireWritableFlashloanContext(app, effectiveNetwork, t);
      if (contextBeforeWallet.contractHash !== normalizeFlashloanContract(record.contractHash)) {
        throw new Error(t("pendingContextMismatch"));
      }
      assertFlashloanRecoveryStorage(app, t);
      const payment = await paymentOutcomeReader(record);
      if (payment.state === "fault") {
        persistPendingLiquidity(null);
        liquidityRecoveryState.set("fault");
        throw new Error(t("liquidityTransactionFault"));
      }
      if (payment.state !== "halt" || !payment.event) {
        liquidityRecoveryState.set(payment.state === "halt" ? "manual-review" : "pending");
        throw new Error(t(payment.state === "halt"
          ? "liquidityConfirmationReview"
          : "liquidityPaymentPending"));
      }
      const liveSnapshot = await loadLoanStats(false).catch(() => {
        throw new Error(t("statsUnavailable"));
      });
      if (liveSnapshot.paused) throw new Error(t("contractPaused"));
      const wallet = await app.chain.ensureWallet();
      const context = await revalidateWriteContext(contextBeforeWallet);
      assertWalletSnapshot(wallet);
      if (!flashloanAccountsMatch(wallet, record.providerHash)) {
        throw new Error(t("recoveryWalletMismatch"));
      }
      address.set(wallet);
      await revalidateWriteContext(context);
      assertWalletSnapshot(wallet);
      let actionTxid = "";
      let actionTxidConflict = false;
      let result;
      try {
        result = await app.chain.invoke(
          "deposit",
          [
            app.chain.arg.hash160(record.providerHash),
            app.chain.arg.integer(record.amountFixed8),
          ],
          {
            waitForEvent: "LiquidityDeposited",
            waitTimeoutMs: 30_000,
            onTransactionSent: (txid) => {
              const normalized = normalizeFlashloanTxid(txid);
              if (!normalized) return;
              if (actionTxid && actionTxid !== normalized) {
                actionTxidConflict = true;
                return;
              }
              if (!actionTxid) {
                actionTxid = normalized;
                persistPendingLiquidity({ ...record, txid: normalized });
              }
            },
          },
        );
      } catch {
        if (actionTxidConflict) {
          serviceNotice.set(t("transactionIdMismatch"));
          throw new Error(t("transactionIdMismatch"));
        }
        if (pendingLiquidity.get()?.txid) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        serviceNotice.set(t("liquidityResumeRequired"));
        throw new Error(t("liquidityResumeRequired"));
      }
      const resultTxid = assertExactTransactionIdentity(
        actionTxid,
        result.txid,
        actionTxidConflict,
      );
      if (!resultTxid) {
        if (pendingLiquidity.get()?.txid) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        serviceNotice.set(t("liquidityResumeRequired"));
        throw new Error(t("liquidityResumeRequired"));
      }
      const submitted = pendingLiquidity.get() ?? {
        ...record,
        txid: resultTxid,
      };
      if (!pendingLiquidity.get()) persistPendingLiquidity(submitted);
      if (result.success === false) {
        const outcome = await transactionOutcomeReader(
          submitted.network,
          submitted.txid,
          "LiquidityDeposited",
          submitted.contractHash,
        );
        if (outcome.state === "fault") {
          persistPendingLiquidity({ ...submitted, txid: "" });
          liquidityRecoveryState.set("resume");
          serviceNotice.set(t("liquidityResumeRequired"));
          throw new Error(t("liquidityResumeRequired"));
        }
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }
      if (!await confirmLiquidityResult(submitted, result.verified === true ? result.event : undefined)) {
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }
      persistPendingLiquidity(null);
      await loadData();
      return { ...result, verified: true };
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Withdraw previously deposited liquidity via withdraw(provider, amount).
   * A provider can only withdraw up to what they deposited (enforced on-chain).
   */
  const withdrawLiquidityImpl = async (amount: string) => {
    const validation = validateLiquidityAmount(amount);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    await blockOnOtherPendingRequest();
    const recovery = await recoverPendingLiquidity();
    liquidityRecoveryState.set(recovery.status);
    if (recovery.status === "confirmed") {
      await loadData();
      serviceNotice.set(t("liquidityRecovered"));
      throw new Error(t("recoveredActionNotReplayed"));
    }
    if (recovery.status === "resume") {
      serviceNotice.set(t("liquidityResumeRequired"));
      throw new Error(t("liquidityResumeRequired"));
    }
    if (recovery.status === "pending") {
      serviceNotice.set(t("liquidityConfirmationPending"));
      throw new Error(t("liquidityConfirmationPending"));
    }
    if (recovery.status === "manual-review") {
      serviceNotice.set(t("liquidityConfirmationReview"));
      throw new Error(t("liquidityConfirmationReview"));
    }
    if (recovery.status === "context-mismatch") {
      serviceNotice.set(t("pendingContextMismatch"));
      throw new Error(t("pendingContextMismatch"));
    }
    if (recovery.status === "fault") {
      serviceNotice.set(t("liquidityTransactionFault"));
      throw new Error(t("liquidityTransactionFault"));
    }

    isLoading.set(true);
    try {
      const contextBeforeWallet = await requireWritableFlashloanContext(app, effectiveNetwork, t);
      assertFlashloanRecoveryStorage(app, t);
      const liveSnapshot = await loadLoanStats(false).catch(() => {
        throw new Error(t("statsUnavailable"));
      });
      if (liveSnapshot.paused) throw new Error(t("contractPaused"));
      const provider = await app.chain.ensureWallet();
      const context = await revalidateWriteContext(contextBeforeWallet);
      assertWalletSnapshot(provider);
      address.set(provider);
      const providerHash = normalizeHash160Input(provider);
      if (!providerHash) throw new Error(t("walletRequired"));
      const amountFixed8 = parseGasAmountFixed8(amount);
      if (!amountFixed8) throw new Error(t("invalidLiquidityAmount"));
      const baselineProvider = await readProviderStatsFixed8(providerHash).catch(() => {
        throw new Error(t("statsUnavailable"));
      });
      const baselineBalance = baselineProvider.currentBalance;
      if (BigInt(amountFixed8) > baselineBalance) {
        throw new Error(t("withdrawExceedsBalance"));
      }
      const contractHash = context.contractHash;
      const pendingBase: Omit<PendingLiquidity, "txid"> = {
        schema: PENDING_SCHEMA,
        network: effectiveNetwork,
        paymentTxid: "",
        kind: "withdraw",
        providerHash,
        amountFixed8,
        baselineBalanceFixed8: baselineBalance.toString(),
        baselineTotalDepositedFixed8: baselineProvider.totalDeposited.toString(),
        baselineTotalWithdrawnFixed8: baselineProvider.totalWithdrawn.toString(),
        contractHash,
        submittedAt: Date.now(),
      };

      await revalidateWriteContext(context);
      assertWalletSnapshot(provider);
      let actionTxid = "";
      let actionTxidConflict = false;
      let result;
      try {
        result = await app.chain.invoke(
          "withdraw",
          [
            app.chain.arg.hash160(provider),
            app.chain.arg.integer(amountFixed8),
          ],
          {
            waitForEvent: "LiquidityWithdrawn",
            waitTimeoutMs: 30_000,
            onTransactionSent: (txid) => {
              const normalized = normalizeFlashloanTxid(txid);
              if (!normalized) return;
              if (actionTxid && actionTxid !== normalized) {
                actionTxidConflict = true;
                return;
              }
              if (!actionTxid) {
                actionTxid = normalized;
                persistPendingLiquidity({ ...pendingBase, txid: normalized });
              }
            },
          },
        );
      } catch (error) {
        if (actionTxidConflict) {
          serviceNotice.set(t("transactionIdMismatch"));
          throw new Error(t("transactionIdMismatch"));
        }
        if (pendingLiquidity.get()) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        throw error;
      }

      const resultTxid = assertExactTransactionIdentity(
        actionTxid,
        result.txid,
        actionTxidConflict,
      );
      if (!resultTxid) {
        if (pendingLiquidity.get()) {
          serviceNotice.set(t("liquidityConfirmationPending"));
          throw new Error(t("liquidityConfirmationPending"));
        }
        throw new Error(t("liquidityActionUnavailable"));
      }
      const submitted = pendingLiquidity.get() ?? {
        ...pendingBase,
        txid: resultTxid,
      };
      if (!pendingLiquidity.get()) persistPendingLiquidity(submitted);
      if (result.success === false) {
        const outcome = await transactionOutcomeReader(
          submitted.network,
          submitted.txid,
          "LiquidityWithdrawn",
          submitted.contractHash,
        );
        if (outcome.state === "fault") {
          persistPendingLiquidity(null);
          serviceNotice.set(t("liquidityTransactionFault"));
          throw new Error(t("liquidityTransactionFault"));
        }
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }
      if (!await confirmLiquidityResult(submitted, result.verified === true ? result.event : undefined)) {
        serviceNotice.set(t("liquidityConfirmationPending"));
        throw new Error(t("liquidityConfirmationPending"));
      }

      persistPendingLiquidity(null);

      await loadData();
      return { ...result, verified: true };
    } finally {
      isLoading.set(false);
    }
  };

  const requestLoan = (data: {
    amount: string;
    callbackContract: string;
    callbackMethod: string;
  }) => withFinancialWrite("request", () => requestLoanImpl(data));
  const provideLiquidity = (amount: string, receiptId?: string) => (
    withFinancialWrite("deposit", () => provideLiquidityImpl(amount, receiptId))
  );
  const resumePendingLiquidity = () => (
    withFinancialWrite("resume", () => resumePendingLiquidityImpl())
  );
  const withdrawLiquidity = (amount: string) => (
    withFinancialWrite("withdraw", () => withdrawLiquidityImpl(amount))
  );

  return {
    // State
    address,
    poolBalance,
    poolBalanceFixed8,
    loanDetails,
    stats,
    contractStats,
    recentLoans,
    lastRequest,
    providerStats,
    depositCapability,
    writeCapability,
    contractHealth,
    borrowerEligibility,
    isLoading,
    isLookupLoading,
    writeOperation,
    validationError,
    serviceNotice,
    pendingRequestTxid,
    pendingLiquidityTxid,
    pendingLiquidityStage,
    pendingLiquidityAmount,

    // Methods
    connect: () => withFinancialWrite("connect", async () => {
      const connected = await app.chain.ensureWallet();
      address.set(connected);
      return connected;
    }),
    loadData,
    lookupLoan,
    requestLoan,
    provideLiquidity,
    resumePendingLiquidity,
    withdrawLiquidity,

    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => {
      if (normalizeHash160Input(address.get()) !== normalizeHash160Input(addr)) {
        borrowerEligibility.set(EMPTY_ELIGIBILITY);
        providerStats.set(EMPTY_PROVIDER_STATS);
        writeCapability.set(addr
          ? { status: "checking", reason: "" }
          : { status: "checking", reason: "wallet-disconnected" });
      }
      address.set(addr);
    },
  };
}

export type UseFlashloanCoreReturn = ReturnType<typeof useFlashloanCore>;
