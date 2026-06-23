/**
 * EdgeClient — Standardized HTTP client for OS service edge functions.
 * Acts as the "Binder" transport layer between miniapp and OS services.
 */
import { useWallet } from "../../utils/wallet-sdk";
import {
  fetchWithTimeout,
  HttpResponseError,
  isTransientFetchError,
} from "../../utils/fetch-timeout";
import { retryAsync } from "../../utils/async-utils";
import type {
  ContractArg,
  InvokeParams,
  InvokeResult,
  WalletSigner,
} from "../../utils/wallet-sdk-types";

/** Whole-request deadline for an OS edge call (unchanged from the prior inline value). */
const EDGE_TIMEOUT_MS = 30000;
/** Bounded retry for transient OS-edge blips; deterministic 4xx are not retried. */
const EDGE_RETRY_ATTEMPTS = 3;
const EDGE_RETRY_BASE_DELAY_MS = 400;
const EDGE_RETRY_MAX_DELAY_MS = 2000;

type RecordLike = Record<string, unknown>;
type InvocationIntent = {
  scriptHash: string;
  operation: string;
  args: ContractArg[];
  signers?: WalletSigner[];
};

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArgs(value: unknown): ContractArg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => ({
      type: stringValue(entry.type) || "String",
      value: entry.value,
    }));
}

const SENDER_PLACEHOLDERS = new Set([
  "sender",
  "{{sender}}",
  "{sender}",
  "0x0000000000000000000000000000000000000000",
  "",
]);

function isSenderPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return SENDER_PLACEHOLDERS.has(value.trim().toLowerCase());
}

function resolveSenderArg(arg: ContractArg, walletAddress: string): ContractArg {
  if (
    String(arg.type).toLowerCase() === "hash160" &&
    isSenderPlaceholder(arg.value)
  ) {
    return { ...arg, value: walletAddress };
  }
  if (String(arg.type).toLowerCase() === "array" && Array.isArray(arg.value)) {
    return {
      ...arg,
      value: normalizeArgs(arg.value).map((entry) =>
        resolveSenderArg(entry, walletAddress),
      ),
    };
  }
  return arg;
}

function resolveInvocationIntent(value: unknown): InvocationIntent | null {
  if (!isRecord(value)) return null;
  const container = isRecord(value.invocation) ? value.invocation : value;
  const scriptHash =
    stringValue(container.scriptHash) ||
    stringValue(container.script_hash) ||
    stringValue(container.contractHash) ||
    stringValue(container.contract_hash) ||
    stringValue(container.contract);
  const operation =
    stringValue(container.operation) || stringValue(container.method);
  if (!scriptHash || !operation) return null;

  const signers = Array.isArray(container.signers)
    ? (container.signers.filter(isRecord) as unknown as WalletSigner[])
    : undefined;

  return {
    scriptHash,
    operation,
    args: normalizeArgs(container.args ?? container.params),
    signers,
  };
}

function withSender(
  intent: InvocationIntent,
  walletAddress: string,
): InvokeParams {
  return {
    scriptHash: intent.scriptHash,
    operation: intent.operation,
    args: intent.args.map((arg) => resolveSenderArg(arg, walletAddress)),
    signers:
      intent.signers && intent.signers.length > 0
        ? intent.signers
        : [{ account: walletAddress, scopes: 1 }],
  };
}

export class EdgeClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private authToken: string | null = null;

  constructor(appId: string, baseUrl?: string) {
    this.appId = appId;
    this.baseUrl =
      baseUrl ??
      ((typeof import.meta !== "undefined" && import.meta.env?.VITE_EDGE_URL) ||
        "/api/edge");
  }

  setAuthToken(token: string | null | undefined): void {
    this.authToken = token?.trim() || null;
  }

  async call<T = unknown>(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const body = { appId: this.appId, ...params };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authToken = this.authToken ?? this.readRuntimeAuthToken();
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // Fetch + parse the HTTP response. This is the only retried unit: it is a
    // read of the edge's reply, idempotent to re-issue. The wallet-intent
    // submission below (which may sign/broadcast) is deliberately OUTSIDE the
    // retry so a transient HTTP blip never re-pops a signing request.
    //
    // Bound each attempt so a slow/dead gateway (stalled DNS, hung server)
    // cannot freeze the miniapp indefinitely. A transient OS-edge blip (timeout,
    // network drop, 429, 5xx) is retried with bounded backoff via retryAsync;
    // a deterministic 4xx (bad request, auth) fails fast — re-issuing it would
    // only waste time and mask the real error.
    const data = await retryAsync(
      async () => {
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs: EDGE_TIMEOUT_MS,
        });

        if (!res.ok) {
          const error = await res
            .json()
            .catch(() => ({ message: res.statusText }));
          throw new HttpResponseError(
            `OS service error (${endpoint}): ${error.message || res.statusText}`,
            res.status,
          );
        }

        // A 2xx with a non-JSON body (e.g. an HTML gateway page) must not throw
        // an uncaught SyntaxError — fall back to an empty object so the shape
        // checks below treat it as a plain payload, mirroring the error-path
        // .catch().
        const payload = await res.json().catch(() => ({}));
        if (
          payload &&
          typeof payload === "object" &&
          "ok" in payload &&
          (payload as { ok?: unknown }).ok === true &&
          "data" in payload
        ) {
          return (payload as { data: T }).data;
        }
        return payload as T;
      },
      {
        maxAttempts: EDGE_RETRY_ATTEMPTS,
        baseDelayMs: EDGE_RETRY_BASE_DELAY_MS,
        maxDelayMs: EDGE_RETRY_MAX_DELAY_MS,
        shouldRetry: isTransientFetchError,
      },
    );

    return this.submitWalletIntentIfPresent(data);
  }

  /**
   * Audit fix E-1 / H-3: signing requires explicit user confirmation.
   *
   * Previously this method auto-signed any invocation-shaped response from
   * any OS edge endpoint with no confirmation. A malicious or buggy miniapp
   * could craft a flow that popped a sign request the user never asked for.
   *
   * The new behavior asks the wallet adapter to render a confirmation modal
   * via `wallet.invokeWithConfirmation(intent, { context })`. If the wallet
   * adapter does not yet implement that method, we fall back to throwing —
   * better to surface a clear error than to auto-sign. The host-app's
   * wallet store should implement `invokeWithConfirmation` to display the
   * intent (contract hash, method, args, signers) and await user click.
   *
   * The legacy auto-sign path is gated behind the explicit caller flag
   * `OSMiniAppAutoSign=true` (window global) which only the host can set,
   * not miniapps. This preserves a controlled escape hatch for trusted
   * flows (e.g. the host's own UI calling its own SDK) while denying the
   * default-auto-sign exploit path.
   */
  private async submitWalletIntentIfPresent<T>(payload: T): Promise<T> {
    const intent = resolveInvocationIntent(payload);
    if (!intent) return payload;

    const wallet = useWallet();
    if (!wallet.address.value) await wallet.connect();
    const walletAddress = wallet.address.value;
    if (!walletAddress) {
      throw new Error("Wallet address is required to submit OS invocation intent.");
    }

    const invokeWithConfirmation = (wallet as unknown as {
      invokeWithConfirmation?: (params: InvokeParams, ctx?: Record<string, unknown>) => Promise<InvokeResult>;
    }).invokeWithConfirmation;
    const allowLegacyAutoSign =
      typeof window !== "undefined" &&
      (window as unknown as { OSMiniAppAutoSign?: boolean }).OSMiniAppAutoSign === true;

    let result: InvokeResult;
    const params = withSender(intent, walletAddress);
    if (typeof invokeWithConfirmation === "function") {
      result = await invokeWithConfirmation(params, {
        endpoint: "os-binder",
        appId: this.appId,
      });
    } else if (allowLegacyAutoSign) {
      result = await wallet.invokeContract(params);
    } else {
      throw new Error(
        "Wallet adapter must implement `invokeWithConfirmation` to sign OS-binder intents. " +
          "Auto-signing without explicit user confirmation has been disabled (audit fix E-1/H-3).",
      );
    }
    if (!isRecord(payload)) return result as T;
    return {
      ...payload,
      txid: result.txid ?? result.tx,
      tx: result.tx ?? result.txid,
    } as T;
  }

  private readRuntimeAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    const keys = ["sb-access-token", "neo_miniapp_auth_jwt"];
    const stores: Storage[] = [];
    try {
      if (window.sessionStorage) stores.push(window.sessionStorage);
    } catch (_err) {
      // Ignore unavailable storage.
    }
    try {
      if (window.localStorage) stores.push(window.localStorage);
    } catch (_err) {
      // Ignore unavailable storage.
    }
    for (const store of stores) {
      for (const key of keys) {
        try {
          const value = store.getItem(key)?.trim();
          if (value) return value;
        } catch (_err) {
          // Storage may be unavailable in sandboxed embeds; callers can still set an explicit token.
        }
      }
    }
    return null;
  }
}
