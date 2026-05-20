/**
 * Error class hierarchy for miniapps.
 *
 * All miniapp errors extend MiniAppError, which carries a stable code,
 * an optional translated user message, and arbitrary detail payload.
 * Use `isMiniAppError()` for type narrowing and `formatErrorMessage()`
 * to render something safe for end-user UI.
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
    return error.translatedUserMessage || error.userMessage || error.message;
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
      !msg.includes("\n") &&
      !msg.includes("at ")
    ) {
      return msg;
    }
    return defaultMessage;
  }

  return defaultMessage;
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
