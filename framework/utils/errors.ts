/**
 * Error class hierarchy for miniapps.
 *
 * All miniapp errors extend MiniAppError, which carries a stable code,
 * an optional translated user message, and arbitrary detail payload.
 * Use `isMiniAppError()` for type narrowing and `formatErrorMessage()`
 * to render something safe for end-user UI.
 *
 * Canonical home of the classes formerly duplicated in
 * apps/shared/utils/errors.ts — shared re-exports from here so `instanceof`
 * checks resolve to a single class identity everywhere.
 */

type Translator = (key: string) => string;

export class MiniAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string,
    public details?: unknown,
    public _translator?: Translator,
    public _userMessageKey?: string,
  ) {
    super(message);
    this.name = "MiniAppError";
  }

  get translatedUserMessage(): string | undefined {
    if (this.userMessage) return this.userMessage;
    if (this._translator && this._userMessageKey) {
      return this._translator(this._userMessageKey);
    }
    return undefined;
  }
}

export class WalletConnectionError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "walletConnectionError";
    super(
      message,
      "WALLET_CONNECTION",
      translator
        ? translator(userMessageKey)
        : "Please connect your wallet to continue.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "WalletConnectionError";
  }
}

export class ContractError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "contractError";
    super(
      message,
      "CONTRACT_ERROR",
      translator
        ? translator(userMessageKey)
        : "Contract operation failed. Please try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "ContractError";
  }
}

export class TransactionError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "transactionError";
    super(
      message,
      "TRANSACTION_ERROR",
      translator
        ? translator(userMessageKey)
        : "Transaction failed. Please check your balance and try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "TransactionError";
  }
}

export class InsufficientBalanceError extends MiniAppError {
  constructor(
    required: number,
    available: number,
    symbol: string = "GAS",
    translator?: Translator,
  ) {
    const message = `Insufficient ${symbol} balance. Required: ${required}, Available: ${available}`;
    const userMessageKey = "insufficientBalanceError";
    super(
      message,
      "INSUFFICIENT_BALANCE",
      translator
        ? translator(userMessageKey)
        : `Insufficient ${symbol} balance.`,
      { required, available, symbol },
      translator,
      userMessageKey,
    );
    this.name = "InsufficientBalanceError";
  }
}

export class NetworkError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "networkError";
    super(
      message,
      "NETWORK_ERROR",
      translator
        ? translator(userMessageKey)
        : "Network error. Please check your connection and try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "NetworkError";
  }
}

export class ValidationError extends MiniAppError {
  constructor(
    message: string,
    field?: string,
    details?: unknown,
    translator?: Translator,
  ) {
    const detailsObj =
      typeof details === "object" && details !== null ? details : {};
    const userMessageKey = "validationError";
    super(
      message,
      "VALIDATION_ERROR",
      translator
        ? translator(userMessageKey)
        : "Invalid input. Please check and try again.",
      { field, ...detailsObj },
      translator,
      userMessageKey,
    );
    this.name = "ValidationError";
  }
}

export function isMiniAppError(error: unknown): error is MiniAppError {
  return error instanceof MiniAppError;
}

export function formatErrorMessage(
  error: unknown,
  defaultMessage: string = "An error occurred",
): string {
  if (isMiniAppError(error)) {
    // A MiniAppError constructed with an empty message and no user message
    // would otherwise render an empty toast, which reads as a silent failure.
    return (
      error.translatedUserMessage ||
      error.userMessage ||
      error.message ||
      defaultMessage
    );
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (
      typeof msg === "string" &&
      msg.length > 0 &&
      msg.length < 100 &&
      !msg.includes("0x") &&
      !msg.includes("http") &&
      !msg.includes("stack") &&
      // A multi-line value is treated as a raw dump; a real stack frame ("…\n
      // at fn (file:line)") is caught by this newline check, so we do NOT also
      // filter the bare substring "at " — that swallowed legitimate one-line
      // messages like "GAS supports at most 8 decimal places."
      !msg.includes("\n")
    ) {
      return msg;
    }
    return defaultMessage;
  }

  return defaultMessage;
}

/**
 * One-liner error → display-string extraction (RFC P0-4) — the exported home
 * of the `error instanceof Error ? error.message : fallback` ternary the
 * fleet hand-rolls at every `ctx.setStatus(…, "error")` site.
 *
 * Priority: `MiniAppError` user message (translated when a translator is
 * attached) > `Error.message` > string errors verbatim > `fallback`.
 *
 * Translator-free by design — chain-error family mapping (localized copy for
 * wallet/VM/RPC failures) needs the app's `t()` and lives on the framework
 * surface: prefer `app.errors.messageOf(error, fallback)` inside miniapps.
 *
 * @example
 * ```ts
 * ctx.setStatus(errorMessage(error, t("swapFailed")), "error");
 * ```
 */
export function errorMessage(error: unknown, fallback = "error"): string {
  if (isMiniAppError(error)) {
    const user = error.translatedUserMessage || error.userMessage;
    if (user) return user;
    if (error.message) return error.message;
    return fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function createStatusRef() {
  let value: { msg: string; type: "success" | "error" } | null = null;

  return {
    get value() {
      return value;
    },
    set value(newValue: { msg: string; type: "success" | "error" } | null) {
      value = newValue;
    },
    setError: (message: string) => {
      value = { msg: message, type: "error" };
    },
    setSuccess: (message: string) => {
      value = { msg: message, type: "success" };
    },
    clear: () => {
      value = null;
    },
  };
}
