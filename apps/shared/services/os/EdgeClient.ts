/**
 * EdgeClient — Standardized HTTP client for OS service edge functions.
 * Acts as the "Binder" transport layer between miniapp and OS services.
 */
import { useWallet } from "../../utils/wallet-sdk";
import type {
  ContractArg,
  InvokeParams,
  InvokeResult,
  WalletSigner,
} from "../../utils/wallet-sdk-types";

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
    args: intent.args.map((arg) => ({
      ...arg,
      value: arg.value === "SENDER" ? walletAddress : arg.value,
    })),
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

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: res.statusText }));
      throw new Error(
        `OS service error (${endpoint}): ${error.message || res.statusText}`,
      );
    }

    const payload = await res.json();
    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      (payload as { ok?: unknown }).ok === true &&
      "data" in payload
    ) {
      return this.submitWalletIntentIfPresent((payload as { data: T }).data);
    }
    return this.submitWalletIntentIfPresent(payload as T);
  }

  private async submitWalletIntentIfPresent<T>(payload: T): Promise<T> {
    const intent = resolveInvocationIntent(payload);
    if (!intent) return payload;

    const wallet = useWallet();
    if (!wallet.address.value) await wallet.connect();
    const walletAddress = wallet.address.value;
    if (!walletAddress) {
      throw new Error("Wallet address is required to submit OS invocation intent.");
    }

    const result: InvokeResult = await wallet.invokeContract(
      withSender(intent, walletAddress),
    );
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
