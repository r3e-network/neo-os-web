import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NextRouter } from "next/router";
import type { MiniAppInfo } from "../components";
import type { MiniAppLaunchContext, OperationEntry } from "../components/types";
import {
  addressToScriptHash,
  buildSharedInvokeArgs,
  isSharedModeApp,
  resolveSharedOperationRecipe,
  type SharedModeRuntimeInfo,
} from "../lib/chain";
import type { CatalogNetwork } from "../lib/miniapp-catalog";
import {
  assertWalletNetworkMatchesTarget,
  type NeoNetwork,
} from "../lib/neo-network";
import type { ResolvedMiniAppRuntime } from "../lib/miniapp-runtime";
import type { InvokeParams } from "../lib/wallet/adapters/base";
import { getWalletAdapter } from "../lib/wallet/store";
import {
  buildFrontendOperationQuery,
  buildInvokeArgs,
  frontendOperationFeedback,
  isFrontendLocalOperation,
  isHostManagedApiOperation,
  isOneGateVaultPayoutOperation,
  parseScaledDecimal,
  prepareFrontendOperationQueryValues,
  resolveAnchorOperationAppId,
  resolveNetworkOperationMethod,
} from "../lib/miniapp-detail-helpers";
import {
  buildCustomAnchorRegistrationPlan,
  parseAnchorCandidateKeys,
} from "../lib/custom-anchor";
import {
  BLOCKCHAIN_CONSTANTS,
  EXTERNAL_INTEGRATIONS,
} from "../../../apps/shared/constants";

const DAILY_CHECKIN_APP_ID = "miniapp-dailycheckin";
const DAILY_CHECKIN_FEE_FIXED8 = "100000";
const DAILY_CHECKIN_MEMO = "miniapp-dailycheckin:checkin";
const GRAVEYARD_APP_ID = "miniapp-graveyard";
const GRAVEYARD_DEFAULT_BURY_FEE_FIXED8 = "10000000";
const GRAVEYARD_DEFAULT_FORGET_FEE_FIXED8 = "100000000";
const GRAVEYARD_BURY_MEMO = "miniapp-graveyard:memory";
const GRAVEYARD_FORGET_MEMO = "miniapp-graveyard:forget";
const RED_ENVELOPE_APP_ID = "miniapp-redenvelope";
const RED_ENVELOPE_CREATE_MEMO = "miniapp-redenvelope:create";
const NEO_PAY_APP_ID = "miniapp-neo-pay";
const SELF_LOAN_APP_ID = "miniapp-self-loan";
const DEV_TIPPING_APP_ID = "miniapp-dev-tipping";
const DEV_TIPPING_TIP_MEMO = "miniapp-dev-tipping:tip";
const DEV_TIPPING_MIN_TIP_FIXED8 = 100000n;
const MEMORIAL_SHRINE_APP_ID = "miniapp-memorial-shrine";
const MEMORIAL_SHRINE_TRIBUTE_MEMO = "miniapp-memorial-shrine:tribute";
const RECOVERY_GUARDIAN_APP_ID = "miniapp-recovery-guardian";
const RECOVERY_DEFAULT_PROVIDER = "web3auth";
const RECOVERY_DEFAULT_ENCRYPTED_PARAMS = "{}";
const TIME_CAPSULE_APP_ID = "miniapp-time-capsule";
const TIME_CAPSULE_DEFAULT_SEAL_FEE_FIXED8 = "20000000";
const TIME_CAPSULE_SEAL_MEMO = "miniapp-time-capsule:bury";
const UNBREAKABLE_VAULT_APP_ID = "miniapp-unbreakablevault";
const UNBREAKABLE_VAULT_CREATE_MEMO = "miniapp-unbreakablevault:create";
const UNBREAKABLE_VAULT_ATTEMPT_MEMO = "miniapp-unbreakablevault:attempt";
const UNBREAKABLE_VAULT_INCREASE_MEMO = "miniapp-unbreakablevault:increase";
const UNBREAKABLE_VAULT_MIN_BOUNTY_FIXED8 = 100000000n;
const UNBREAKABLE_VAULT_DEFAULT_ATTEMPT_FEE_FIXED8 = "10000000";
const SELF_LOAN_COLLATERAL_MEMO = "miniapp-self-loan:collateral";
const SELF_LOAN_POOL_MEMO = "miniapp-self-loan:pool";
const SELF_LOAN_REPAY_MEMO = "miniapp-self-loan:repay";
const FUND_GAME_CREDIT_MEMO_BY_APP: Record<string, string> = {
  "miniapp-fogplay": "miniapp-fogplay:bet",
};
const FIXED8_DECIMALS = 100000000n;
const DAY_MS = 86_400_000;
const SECOND_EPOCH_THRESHOLD = 1_000_000_000_000n;
const MEMORIAL_SHRINE_OFFERING_COSTS_FIXED8: Record<string, string> = {
  "1": "1000000",
  "2": "2000000",
  "3": "3000000",
  "4": "5000000",
  "5": "10000000",
  "6": "50000000",
};

type NeoReadStackItem = {
  type?: string;
  value?: unknown;
};

type NeoReadResponse = {
  error?: { message?: string };
  result?: {
    state?: string;
    exception?: string;
    stack?: NeoReadStackItem[];
  };
};

type HostApiJson = Record<string, unknown>;

function base64FromBytes(bytes: number[]): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

function hash160ToLittleEndianBase64(hash: string): string {
  const hex = hash.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error("Oracle callback contract hash is invalid.");
  }
  const bytes = hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes.reverse());
}

function formatFixed8Amount(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  const whole = absolute / FIXED8_DECIMALS;
  const fraction = (absolute % FIXED8_DECIMALS)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function firstNonEmptyValue(
  values: Record<string, string>,
  names: string[],
): string {
  for (const name of names) {
    const value = String(values[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function positiveWholeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  const value = firstNonEmptyValue(values, names);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return value;
}

function integerRangeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  min: number,
  max: number,
): string {
  const value = firstNonEmptyValue(values, names);
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function optionalIntegerRangeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  min: number,
  max: number,
  fallback = "0",
): string {
  const value = firstNonEmptyValue(values, names);
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function optionalPositiveWholeValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string | null {
  const value = firstNonEmptyValue(values, names);
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return value;
}

function optionalPositiveFixed8Value(
  values: Record<string, string>,
  names: string[],
  label: string,
): string | null {
  const value = firstNonEmptyValue(values, names);
  if (!value) return null;
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`${label} must be a positive GAS value.`);
  }
  const scaled = parseScaledDecimal(value, 8, label);
  return BigInt(scaled) > 0n ? scaled : null;
}

function normalizedSha256HashValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  const value = firstNonEmptyValue(values, names).replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 64-character SHA-256 hex string.`);
  }
  return value.toLowerCase();
}

function normalizedSha256Hash(values: Record<string, string>, names: string[]): string {
  return normalizedSha256HashValue(values, names, "Content hash");
}

function hexToBase64(hex: string): string {
  const normalized = hex.replace(/^0x/i, "");
  const bytes = normalized.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes);
}

function utf8Bytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === "%" && i + 2 < encoded.length) {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

function utf8ToBase64(value: string): string {
  return base64FromBytes(utf8Bytes(value));
}

function booleanOperationValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  fallback = false,
): boolean {
  const value = firstNonEmptyValue(values, names).toLowerCase();
  if (!value) return fallback;
  if (["true", "1", "yes", "on", "public"].includes(value)) return true;
  if (["false", "0", "no", "off", "private"].includes(value)) return false;
  throw new Error(`${label} must be true or false.`);
}

function futureUnlockTimeMsValue(values: Record<string, string>): string {
  const explicitValue = firstNonEmptyValue(values, [
    "unlockTimeMs",
    "unlockTime",
    "unlockTimestamp",
  ]);
  if (explicitValue) {
    if (!/^[1-9]\d*$/.test(explicitValue)) {
      throw new Error("Unlock time must be a positive epoch timestamp.");
    }
    let unlockTime = BigInt(explicitValue);
    if (unlockTime < SECOND_EPOCH_THRESHOLD) {
      unlockTime *= 1000n;
    }
    if (unlockTime <= BigInt(Date.now())) {
      throw new Error("Unlock time must be in the future.");
    }
    return unlockTime.toString();
  }

  const unlockDays = Number(
    integerRangeValue(values, ["unlockDays", "days"], "Lock duration", 1, 3650),
  );
  return Math.floor(Date.now() + unlockDays * DAY_MS).toString();
}

function optionalVaultReceiptId(
  values: Record<string, string>,
  targetNetwork: NeoNetwork,
): string | null {
  const receiptId = optionalPositiveWholeValue(
    values,
    ["receiptId", "paymentReceiptId"],
    "Payment receipt ID",
  );
  if (targetNetwork === "mainnet" && !receiptId) {
    throw new Error(
      "Mainnet Unbreakable Vault operations require a payment receipt ID. Use testnet for the direct funded flow or enter an existing payment receipt ID.",
    );
  }
  return receiptId;
}

function buildInvokeArgsWithoutParams(
  operation: OperationEntry,
  values: Record<string, string>,
  walletAddress: string,
  excludedParamNames: string[],
): Array<{ type: string; value: unknown }> {
  const excluded = new Set(excludedParamNames);
  return buildInvokeArgs(
    (operation.params ?? []).filter((param) => !excluded.has(param.name)),
    values,
    walletAddress,
  );
}

function stackInteger(item: NeoReadStackItem | undefined, label: string): bigint {
  if (!item || item.type !== "Integer") {
    throw new Error(`${label} did not return an integer.`);
  }
  try {
    return BigInt(String(item.value ?? "0"));
  } catch {
    throw new Error(`${label} returned an invalid integer.`);
  }
}

async function readNeoInteger({
  contractHash,
  method,
  params,
  network,
  label,
}: {
  contractHash: string;
  method: string;
  params: Array<{ type: string; value: string }>;
  network: NeoNetwork;
  label: string;
}): Promise<bigint> {
  const response = await fetch("/api/rpc/neo-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractHash, method, params, network }),
    signal: AbortSignal.timeout(10000),
  });
  const body = (await response.json().catch(() => ({}))) as NeoReadResponse;
  if (!response.ok) {
    throw new Error(`${label} lookup failed with status ${response.status}.`);
  }
  if (body.error?.message) {
    throw new Error(`${label} lookup failed: ${body.error.message}`);
  }
  if (body.result?.state !== "HALT") {
    throw new Error(
      body.result?.exception || `${label} lookup failed on-chain.`,
    );
  }
  return stackInteger(body.result.stack?.[0], label);
}

function cleanValue(
  values: Record<string, string>,
  names: string[],
  fallback = "",
): string {
  const value = firstNonEmptyValue(values, names);
  return value || fallback;
}

function boundedTextValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  maxLength: number,
  required = false,
): string {
  const value = cleanValue(values, names).trim();
  if (required && !value) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

function normalizeHostHash160Value(value: string, label: string): string {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${label} is required.`);
  const hash = raw.startsWith("0x")
    ? raw.toLowerCase()
    : addressToScriptHash(raw);
  if (!/^0x[0-9a-f]{40}$/.test(hash)) {
    throw new Error(`${label} must be a Neo N3 address or 0x-prefixed Hash160.`);
  }
  return hash;
}

function hash160OperationValue(
  values: Record<string, string>,
  names: string[],
  label: string,
  walletAddress: string,
): string {
  const value = firstNonEmptyValue(values, names);
  return normalizeHostHash160Value(
    value === "$wallet" ? walletAddress : value,
    label,
  );
}

function accountIdByteArrayValue(
  values: Record<string, string>,
  names: string[],
  label: string,
): string {
  return normalizeHostHash160Value(firstNonEmptyValue(values, names), label);
}

function recoveryExpiresAtText(values: Record<string, string>): string {
  const minutes = Number(
    integerRangeValue(
      values,
      ["expiryMinutes", "recoveryExpiryMinutes", "expiresInMinutes"],
      "Ticket expiry minutes",
      5,
      1440,
    ),
  );
  return String(Math.floor(Date.now() / 1000) + minutes * 60);
}

function recoveryProviderValue(values: Record<string, string>): string {
  const provider =
    cleanValue(values, ["provider", "recoveryProvider"], RECOVERY_DEFAULT_PROVIDER).trim() ||
    RECOVERY_DEFAULT_PROVIDER;
  if (!/^[a-z0-9_-]{2,32}$/i.test(provider)) {
    throw new Error(
      "Recovery provider must be 2-32 letters, numbers, dashes, or underscores.",
    );
  }
  return provider;
}

function recoveryEncryptedParamsValue(values: Record<string, string>): string {
  const params =
    cleanValue(
      values,
      ["encryptedParams", "encryptedSubject", "subjectParams"],
      RECOVERY_DEFAULT_ENCRYPTED_PARAMS,
    ).trim() || RECOVERY_DEFAULT_ENCRYPTED_PARAMS;
  if (params.length > 4096) {
    throw new Error("Encrypted params must be 4096 characters or fewer.");
  }
  return params;
}

function asJsonRecord(value: unknown): HostApiJson {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as HostApiJson)
    : {};
}

function bodyMessage(body: HostApiJson, fallback: string): string {
  const error = asJsonRecord(body.error);
  const candidates = [
    error.message,
    body.message,
    body.error,
    body.reason,
    body.status,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return fallback;
}

async function readApiJson(
  response: Response,
  fallback: string,
): Promise<HostApiJson> {
  const text = await response.text();
  if (!text) return {};
  try {
    return asJsonRecord(JSON.parse(text));
  } catch {
    return { message: text };
  }
}

function hostApiErrorCode(body: HostApiJson): string {
  const error = asJsonRecord(body.error);
  const code = error.code ?? body.code;
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function formatHostApiFailure(
  url: string,
  status: number,
  body: HostApiJson,
  fallback: string,
): string {
  const message = bodyMessage(body, fallback);
  const code = hostApiErrorCode(body);
  const normalized = `${message} ${code}`.toLowerCase();
  const isForbiddenFunction =
    status === 403 &&
    (code === "FORBIDDEN" ||
      normalized.includes("function not allowed") ||
      normalized.includes("not allowed"));

  if (url.includes("gas-sponsor-check") && isForbiddenFunction) {
    return "Sponsorship service is not enabled in this environment. Configure the AA sponsorship backend before checking sponsorship.";
  }

  if (url.includes("gas-sponsor-request") && isForbiddenFunction) {
    return "Sponsorship service is not enabled in this environment. Configure the AA sponsorship backend before requesting sponsor gas.";
  }

  if (
    url.includes("/api/aa/relay") &&
    (normalized.includes("aa_relay_url") ||
      (normalized.includes("relay") && normalized.includes("not configured")))
  ) {
    return "AA relay service is not configured in this environment. Configure AA_RELAY_URL before submitting relay payloads.";
  }

  return message;
}

async function fetchHostApiJson(
  url: string,
  init: RequestInit,
  fallback: string,
): Promise<HostApiJson> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10000),
  });
  const body = await readApiJson(response, fallback);
  if (!response.ok) {
    throw new Error(formatHostApiFailure(url, response.status, body, fallback));
  }
  return body;
}

function requireRelayAddress(values: Record<string, string>): string {
  const aaAddress = cleanValue(values, [
    "aaAddress",
    "aa",
    "account",
    "accountAddress",
    "sender",
  ]).trim();
  if (!aaAddress) {
    throw new Error("AA Address is required.");
  }
  return aaAddress;
}

function relayDappId(values: Record<string, string>): string {
  return cleanValue(
    values,
    ["dappId", "dapp", "paymaster", "paymasterDappId", "paymaster_dapp_id"],
    "miniapp-aa-relay-console",
  );
}

function parseRelayPayload(values: Record<string, string>): HostApiJson {
  const raw = cleanValue(values, [
    "payloadJson",
    "payload",
    "calldata",
    "metaInvocation",
  ]);
  if (!raw) {
    throw new Error("Relay Payload JSON is required.");
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Relay Payload JSON must be an object.");
    }
    return parsed as HostApiJson;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Relay Payload JSON is invalid.");
    }
    throw error;
  }
}

function formatSponsorCheckFeedback(body: HostApiJson): string {
  const eligible = body.eligible === true;
  const remaining = String(body.remaining ?? body.gas_balance ?? "").trim();
  if (eligible) {
    return remaining
      ? `Sponsorship available. Remaining quota: ${remaining} GAS.`
      : "Sponsorship available for this AA address.";
  }
  const status = String(body.status ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  return reason
    ? `Sponsorship checked: ${reason}`
    : `Sponsorship checked: ${status || "not eligible"}.`;
}

function formatSponsorRequestFeedback(body: HostApiJson): string {
  const status = String(body.status ?? "").trim();
  const requestId = String(body.request_id ?? body.requestId ?? "").trim();
  const txHash = String(body.tx_hash ?? body.txHash ?? "").trim();
  if (txHash) return `Sponsorship request submitted: ${txHash}`;
  if (requestId) return `Sponsorship request ${status || "submitted"}: ${requestId}`;
  return `Sponsorship request ${status || "submitted"}.`;
}

function formatRelayFeedback(body: HostApiJson): string {
  const txid = String(body.txid ?? body.txHash ?? body.tx_hash ?? "").trim();
  if (txid) return `AA relay submitted: ${txid}`;
  const status = String(body.status ?? "").trim().toLowerCase();
  const requestId = String(
    body.request_id ?? body.requestId ?? body.id ?? "",
  ).trim();
  if (["accepted", "pending", "queued"].includes(status)) {
    return requestId
      ? `AA relay ${status}: ${requestId}`
      : `AA relay ${status}.`;
  }
  const reason = String(body.reason ?? body.error ?? body.message ?? "").trim();
  throw new Error(
    reason
      ? `AA relay not submitted: ${reason}`
      : "AA relay response did not include a transaction id or accepted status.",
  );
}

async function invokeAARelayHostApiOperation(
  method: string,
  values: Record<string, string>,
  network: NeoNetwork,
): Promise<string> {
  const aaAddress = requireRelayAddress(values);
  const dappId = relayDappId(values);

  if (method === "checkSponsor") {
    const query = new URLSearchParams({
      aaAddress,
      dappId,
      network,
    });
    const body = await fetchHostApiJson(
      `/api/rpc/gas-sponsor-check?${query.toString()}`,
      { method: "GET" },
      "Sponsorship check failed.",
    );
    return formatSponsorCheckFeedback(body);
  }

  if (method === "requestSponsor") {
    const sponsorAmount = cleanValue(
      values,
      ["sponsorAmount", "sponsorGas", "gas", "amount", "budget"],
      "0.1",
    );
    if (!/^\d+(?:\.\d+)?$/.test(sponsorAmount) || Number(sponsorAmount) <= 0) {
      throw new Error("Sponsor Amount must be a positive GAS value.");
    }
    const body = await fetchHostApiJson(
      "/api/rpc/gas-sponsor-request",
      {
        method: "POST",
        body: JSON.stringify({
          amount: sponsorAmount,
          aaAddress,
          dappId,
          network,
          paymaster: { dapp_id: dappId, network },
        }),
      },
      "Sponsorship request failed.",
    );
    return formatSponsorRequestFeedback(body);
  }

  if (method === "submitRelay") {
    const payload = parseRelayPayload(values);
    const body = await fetchHostApiJson(
      "/api/aa/relay",
      {
        method: "POST",
        body: JSON.stringify({
          aaAddress,
          ...payload,
          ...(!payload.paymaster && dappId
            ? { paymaster: { dapp_id: dappId, network } }
            : {}),
        }),
      },
      "AA relay submission failed.",
    );
    return formatRelayFeedback(body);
  }

  throw new Error("AA relay host operation is not configured.");
}

export type MiniAppInvokeFeedback = {
  type: "success" | "error";
  message: string;
};

type UseMiniAppDetailInvokeParams = {
  app: MiniAppInfo | null;
  appSupportsTargetNetwork: boolean;
  directContractHash: string | null;
  launchContext: MiniAppLaunchContext;
  networkAvailabilityReason: string | null;
  resolvedRuntime: ResolvedMiniAppRuntime | null;
  router: NextRouter;
  setInvokeFeedback: Dispatch<SetStateAction<MiniAppInvokeFeedback | null>>;
  sharedRuntime?: SharedModeRuntimeInfo | null;
  targetCatalogNetwork: CatalogNetwork | null;
  targetNetwork: NeoNetwork;
  walletAddress: string | null;
  walletConnected: boolean;
  walletNetwork: NeoNetwork | null;
};

export function useMiniAppDetailInvoke({
  app,
  appSupportsTargetNetwork,
  directContractHash,
  launchContext,
  networkAvailabilityReason,
  resolvedRuntime,
  router,
  setInvokeFeedback,
  sharedRuntime,
  targetCatalogNetwork,
  targetNetwork,
  walletAddress,
  walletConnected,
  walletNetwork,
}: UseMiniAppDetailInvokeParams) {
  return useCallback(
    async (operation: OperationEntry, values: Record<string, string>) => {
      setInvokeFeedback(null);
      try {
        if (!app) {
          throw new Error("MiniApp is unavailable. Return to the catalog and try again.");
        }

        if (isFrontendLocalOperation(operation.method)) {
          const frontendValues = prepareFrontendOperationQueryValues(
            app.app_id,
            operation,
            values,
          );
          const query = buildFrontendOperationQuery(
            router.query,
            operation.method,
            frontendValues,
            targetCatalogNetwork,
          );
          await router.replace(
            { pathname: router.pathname, query },
            undefined,
            { shallow: true },
          );
          setInvokeFeedback({
            type: "success",
            message: frontendOperationFeedback(operation.method),
          });
          return;
        }

        if (isHostManagedApiOperation(app.app_id, operation.method)) {
          if (!appSupportsTargetNetwork) {
            throw new Error(
              networkAvailabilityReason ||
                "MiniApp is not enabled on the selected network.",
            );
          }
          const message = await invokeAARelayHostApiOperation(
            operation.method,
            values,
            targetNetwork,
          );
          setInvokeFeedback({ type: "success", message });
          return;
        }

        if (!walletConnected || !walletAddress) {
          throw new Error("Connect wallet before sending transactions.");
        }
        assertWalletNetworkMatchesTarget(walletNetwork, targetNetwork);
        if (!appSupportsTargetNetwork) {
          throw new Error(
            networkAvailabilityReason ||
              "MiniApp is not enabled on the selected network.",
          );
        }

        if (isOneGateVaultPayoutOperation(operation)) {
          const claimKey = String(values.claimKey || values.key || "").trim();
          if (!claimKey) throw new Error("Claim key is required.");
          const poolId = String(
            values.poolId || values.pool || values.campaignId || "",
          ).trim();
          const oneGateAppId = String(
            values.oneGateAppId ||
              values.oneGateId ||
              values.onegateAppId ||
              "",
          ).trim();
          const miniappId = String(values.appId || app.app_id).trim();
          const response = await fetch("/api/onegate-vault/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              claimKey,
              address: walletAddress,
              network: targetNetwork,
              poolId: poolId || undefined,
              oneGateAppId: oneGateAppId || undefined,
              appId: miniappId || undefined,
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message =
              typeof body?.error?.message === "string"
                ? body.error.message
                : "OneGate Vault claim failed.";
            throw new Error(message);
          }
          const txid = String(body.txHash || body.tx_hash || "");
          const amount = String(body.amount || "");
          const luckPercent = String(body.luckPercent || "");
          const paid = String(body.status || "") === "paid";
          setInvokeFeedback({
            type: "success",
            message:
              paid && amount && txid
                ? `Reward paid: ${amount} GAS${luckPercent ? ` · luck beat ${luckPercent}%` : ""} (${txid})`
                : "Reward payout submitted. Waiting for chain confirmation.",
          });
          return;
        }

        if (
          app.app_id === DEV_TIPPING_APP_ID &&
          operation.method === "sendTip"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Dev Tipping contract is not configured for this network.",
            );
          }

          const devId = positiveWholeValue(
            values,
            ["devId", "developerId", "id"],
            "Developer ID",
          );
          const amount = optionalPositiveFixed8Value(
            values,
            ["amount", "tipAmount"],
            "Tip amount",
          );
          if (!amount || BigInt(amount) < DEV_TIPPING_MIN_TIP_FIXED8) {
            throw new Error("Minimum tip is 0.001 GAS.");
          }

          const message = cleanValue(values, ["message", "note"]).trim();
          if (message.length > 280) {
            throw new Error("Message must be 280 characters or fewer.");
          }
          const tipperName =
            cleanValue(values, ["tipperName", "from", "name"]).trim() ||
            "Neo supporter";
          if (tipperName.length > 64) {
            throw new Error("Tipper name must be 64 characters or fewer.");
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded tip transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: amount },
                  { type: "String", value: DEV_TIPPING_TIP_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "tip",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Integer", value: devId },
                  { type: "Integer", value: amount },
                  { type: "String", value: message },
                  { type: "String", value: tipperName },
                ],
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Tip sent: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === MEMORIAL_SHRINE_APP_ID &&
          operation.method === "createMemorial"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Memorial Shrine contract is not configured for this network.",
            );
          }

          const name = boundedTextValue(
            values,
            ["name", "memorialName", "deceasedName"],
            "Memorial name",
            96,
            true,
          );
          const photoHash = boundedTextValue(
            values,
            ["photoHash", "photo", "image"],
            "Photo hash",
            160,
          );
          const relationship = boundedTextValue(
            values,
            ["relationship", "relation"],
            "Relationship",
            64,
          );
          const birthYear = optionalIntegerRangeValue(
            values,
            ["birthYear", "birth"],
            "Birth year",
            0,
            9999,
          );
          const deathYear = optionalIntegerRangeValue(
            values,
            ["deathYear", "death"],
            "Death year",
            0,
            9999,
          );
          const biography = boundedTextValue(
            values,
            ["biography", "bio"],
            "Biography",
            600,
          );
          const obituary = boundedTextValue(
            values,
            ["obituary"],
            "Obituary",
            600,
          );

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const result = await adapter.invoke({
            scriptHash: targetHash,
            operation: "createMemorial",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "String", value: name },
              { type: "String", value: photoHash },
              { type: "String", value: relationship },
              { type: "Integer", value: birthYear },
              { type: "Integer", value: deathYear },
              { type: "String", value: biography },
              { type: "String", value: obituary },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Memorial created: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === MEMORIAL_SHRINE_APP_ID &&
          operation.method === "payTribute"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Memorial Shrine contract is not configured for this network.",
            );
          }

          const memorialId = positiveWholeValue(
            values,
            ["memorialId", "id"],
            "Memorial ID",
          );
          const offeringType = integerRangeValue(
            values,
            ["offeringType", "offering"],
            "Offering",
            1,
            6,
          );
          const amount = MEMORIAL_SHRINE_OFFERING_COSTS_FIXED8[offeringType];
          if (!amount) {
            throw new Error("Offering is not configured.");
          }
          const message = boundedTextValue(
            values,
            ["message", "tributeMessage", "note"],
            "Tribute message",
            280,
          );
          const receiptId = optionalPositiveWholeValue(
            values,
            ["receiptId", "paymentReceiptId"],
            "Payment receipt ID",
          );

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (targetNetwork === "mainnet") {
            if (!receiptId) {
              throw new Error(
                "Mainnet Memorial Shrine tribute requires a payment receipt ID. Use testnet for the direct funded flow or enter an existing payment receipt ID.",
              );
            }
            const result = await adapter.invoke({
              scriptHash: targetHash,
              operation: "payTribute",
              args: [
                { type: "Hash160", value: walletAddress },
                { type: "Integer", value: memorialId },
                { type: "Integer", value: offeringType },
                { type: "String", value: message },
                { type: "Integer", value: receiptId },
              ],
              signers: [{ account: walletAddress, scopes: 1 }],
            });
            setInvokeFeedback({
              type: "success",
              message: `Tribute paid: ${result.txid}`,
            });
            return;
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded tribute transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: amount },
                  {
                    type: "String",
                    value: `${MEMORIAL_SHRINE_TRIBUTE_MEMO}:${memorialId}:${offeringType}`,
                  },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "payTribute",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Integer", value: memorialId },
                  { type: "Integer", value: offeringType },
                  { type: "String", value: message },
                ],
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Tribute paid: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === RECOVERY_GUARDIAN_APP_ID &&
          operation.method === "requestRecoveryTicket"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Recovery Guardian verifier is not configured for this network.",
            );
          }

          const accountId = accountIdByteArrayValue(
            values,
            ["accountId", "account", "accountAddress"],
            "AA account ID",
          );
          const newOwner = hash160OperationValue(
            values,
            ["newOwner", "owner", "recoveryNewOwner"],
            "New owner",
            walletAddress,
          );
          const walletHash = normalizeHostHash160Value(
            walletAddress,
            "Connected wallet",
          );
          if (newOwner !== walletHash) {
            throw new Error(
              "New owner must match the connected wallet for the verifier witness check.",
            );
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const result = await adapter.invoke({
            scriptHash: targetHash,
            operation: "requestRecoveryTicket",
            args: [
              { type: "ByteArray", value: accountId },
              { type: "String", value: recoveryProviderValue(values) },
              { type: "Hash160", value: newOwner },
              { type: "String", value: recoveryExpiresAtText(values) },
              { type: "String", value: recoveryEncryptedParamsValue(values) },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Recovery ticket requested: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === RECOVERY_GUARDIAN_APP_ID &&
          (operation.method === "cancelRecovery" ||
            operation.method === "finalizeRecovery")
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Recovery Guardian verifier is not configured for this network.",
            );
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const result = await adapter.invoke({
            scriptHash: targetHash,
            operation: operation.method,
            args: [
              {
                type: "ByteArray",
                value: accountIdByteArrayValue(
                  values,
                  ["accountId", "account", "accountAddress"],
                  "AA account ID",
                ),
              },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message:
              operation.method === "cancelRecovery"
                ? `Recovery cancelled: ${result.txid}`
                : `Recovery finalized: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === TIME_CAPSULE_APP_ID &&
          operation.method === "sealCapsule"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Time Capsule contract is not configured for this network.",
            );
          }

          const contentHash = normalizedSha256Hash(values, [
            "contentHash",
            "messageHash",
            "hash",
          ]);
          const title = cleanValue(values, ["title", "capsuleTitle"]).trim();
          if (!title) {
            throw new Error("Capsule title is required.");
          }
          if (title.length > 100) {
            throw new Error("Capsule title must be 100 characters or fewer.");
          }
          const unlockTimeMs = futureUnlockTimeMsValue(values);
          const isPublic = booleanOperationValue(
            values,
            ["isPublic", "public", "visibility"],
            "Public visibility",
            false,
          );
          const category = integerRangeValue(
            values,
            ["category"],
            "Category",
            1,
            5,
          );
          const feeAmount =
            optionalPositiveFixed8Value(
              values,
              ["sealFeeGas", "feeGas", "amount"],
              "Seal fee",
            ) ?? TIME_CAPSULE_DEFAULT_SEAL_FEE_FIXED8;

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded capsule transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: feeAmount },
                  { type: "String", value: TIME_CAPSULE_SEAL_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "bury",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "String", value: contentHash },
                  { type: "String", value: title },
                  { type: "Integer", value: unlockTimeMs },
                  { type: "Boolean", value: isPublic },
                  { type: "Integer", value: category },
                ],
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Capsule sealed: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === UNBREAKABLE_VAULT_APP_ID &&
          operation.method === "createVault"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Unbreakable Vault contract is not configured for this network.",
            );
          }

          const bountyAmount = optionalPositiveFixed8Value(
            values,
            ["bountyGas", "bounty", "amount"],
            "Bounty",
          );
          if (
            !bountyAmount ||
            BigInt(bountyAmount) < UNBREAKABLE_VAULT_MIN_BOUNTY_FIXED8
          ) {
            throw new Error("Minimum vault bounty is 1 GAS.");
          }
          const secretHash = normalizedSha256HashValue(
            values,
            ["secretHash", "hash"],
            "Secret hash",
          );
          const title = cleanValue(values, ["title", "vaultTitle"]).trim();
          if (!title) {
            throw new Error("Vault title is required.");
          }
          if (title.length > 100) {
            throw new Error("Vault title must be 100 characters or fewer.");
          }
          const description = cleanValue(values, [
            "description",
            "vaultDescription",
            "hint",
          ]).trim();
          if (description.length > 300) {
            throw new Error("Vault description must be 300 characters or fewer.");
          }
          const difficulty = integerRangeValue(
            values,
            ["difficulty"],
            "Difficulty",
            1,
            3,
          );
          const receiptId = optionalVaultReceiptId(values, targetNetwork);
          const createVaultArgs: Array<{ type: string; value: unknown }> = [
            { type: "Hash160", value: walletAddress },
            { type: "ByteArray", value: hexToBase64(secretHash) },
            { type: "Integer", value: bountyAmount },
            { type: "Integer", value: difficulty },
            { type: "String", value: title },
            { type: "String", value: description },
          ];
          if (receiptId) {
            createVaultArgs.push({ type: "Integer", value: receiptId });
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded vault transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: bountyAmount },
                  { type: "String", value: UNBREAKABLE_VAULT_CREATE_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "createVault",
                args: createVaultArgs,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Vault created: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === UNBREAKABLE_VAULT_APP_ID &&
          operation.method === "attemptBreak"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Unbreakable Vault contract is not configured for this network.",
            );
          }

          const vaultId = positiveWholeValue(
            values,
            ["vaultId", "id"],
            "Vault ID",
          );
          const secret = cleanValue(values, [
            "secret",
            "attemptSecret",
            "guess",
          ]).trim();
          if (!secret) {
            throw new Error("Break secret is required.");
          }
          const feeAmount =
            optionalPositiveFixed8Value(
              values,
              ["attemptFeeGas", "feeGas", "amount"],
              "Attempt fee",
            ) ?? UNBREAKABLE_VAULT_DEFAULT_ATTEMPT_FEE_FIXED8;
          const receiptId = optionalVaultReceiptId(values, targetNetwork);
          const attemptArgs: Array<{ type: string; value: unknown }> = [
            { type: "Integer", value: vaultId },
            { type: "Hash160", value: walletAddress },
            { type: "ByteArray", value: utf8ToBase64(secret) },
          ];
          if (receiptId) {
            attemptArgs.push({ type: "Integer", value: receiptId });
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded break attempt. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: feeAmount },
                  { type: "String", value: UNBREAKABLE_VAULT_ATTEMPT_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "attemptBreak",
                args: attemptArgs,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Break attempt submitted: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === UNBREAKABLE_VAULT_APP_ID &&
          operation.method === "increaseBounty"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Unbreakable Vault contract is not configured for this network.",
            );
          }

          const vaultId = positiveWholeValue(
            values,
            ["vaultId", "id"],
            "Vault ID",
          );
          const amount = optionalPositiveFixed8Value(
            values,
            ["bountyGas", "amount", "topupGas"],
            "Bounty top-up",
          );
          if (!amount) {
            throw new Error("Bounty top-up must be a positive GAS value.");
          }
          const receiptId = optionalVaultReceiptId(values, targetNetwork);
          const increaseArgs: Array<{ type: string; value: unknown }> = [
            { type: "Integer", value: vaultId },
            { type: "Integer", value: amount },
          ];
          if (receiptId) {
            increaseArgs.push({ type: "Integer", value: receiptId });
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded bounty increase. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: amount },
                  { type: "String", value: UNBREAKABLE_VAULT_INCREASE_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "increaseBounty",
                args: increaseArgs,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Bounty increased: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === UNBREAKABLE_VAULT_APP_ID &&
          operation.method === "claimExpiredVault"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Unbreakable Vault contract is not configured for this network.",
            );
          }

          const vaultId = positiveWholeValue(
            values,
            ["vaultId", "id"],
            "Vault ID",
          );
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const result = await adapter.invoke({
            scriptHash: targetHash,
            operation: "claimExpiredVault",
            args: [{ type: "Integer", value: vaultId }],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Expired vault claimed: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "fundOracleRequestFee") {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Game contract is not configured for this network.",
            );
          }
          const oracleHash =
            EXTERNAL_INTEGRATIONS[targetNetwork].contracts.morpheusOracle;
          if (!oracleHash) {
            throw new Error(
              "Morpheus Oracle contract is not configured for this network.",
            );
          }
          const [requestFee, feeCredit] = await Promise.all([
            readNeoInteger({
              contractHash: oracleHash,
              method: "requestFee",
              params: [],
              network: targetNetwork,
              label: "Oracle request fee",
            }),
            readNeoInteger({
              contractHash: oracleHash,
              method: "feeCreditOf",
              params: [{ type: "Hash160", value: targetHash }],
              network: targetNetwork,
              label: "Oracle fee credit",
            }),
          ]);
          const missingFee = requestFee > feeCredit ? requestFee - feeCredit : 0n;
          if (missingFee <= 0n) {
            setInvokeFeedback({
              type: "success",
              message: "Oracle request fee is already funded.",
            });
            return;
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: oracleHash },
              { type: "Integer", value: missingFee.toString() },
              {
                type: "ByteArray",
                value: hash160ToLittleEndianBase64(targetHash),
              },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Oracle fee funded: ${result.txid} (${formatFixed8Amount(missingFee)} GAS)`,
          });
          return;
        }

        if (operation.method === "fundGameCredit") {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Game contract is not configured for this network.",
            );
          }
          const amountText = String(values.amount || "").trim();
          if (!/^\d+(?:\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
            throw new Error("Funding amount must be a positive GAS value.");
          }
          const amount = parseScaledDecimal(amountText, 8, "Funding amount");
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: targetHash },
              { type: "Integer", value: amount },
              {
                type: "String",
                value:
                  FUND_GAME_CREDIT_MEMO_BY_APP[app.app_id] ||
                  `${app.app_id}:credit`,
              },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Game credit funded: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === RED_ENVELOPE_APP_ID &&
          operation.method === "createEnvelope"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Red Envelope contract is not configured for this network.",
            );
          }
          const amountText = String(values.amount || "").trim();
          if (!/^\d+(?:\.\d+)?$/.test(amountText) || Number(amountText) <= 0) {
            throw new Error("Envelope amount must be a positive GAS value.");
          }
          const packetCount = String(values.packetCount || "").trim();
          if (!/^[1-9]\d*$/.test(packetCount)) {
            throw new Error("Recipients must be a positive integer.");
          }
          const expirySeconds = String(
            values.expirySeconds || values.expiry || "",
          ).trim();
          if (!/^[1-9]\d*$/.test(expirySeconds)) {
            throw new Error("Expiry must be a positive number of seconds.");
          }
          const amount = parseScaledDecimal(
            amountText,
            8,
            "Envelope amount",
          );
          const expiryMs = (BigInt(expirySeconds) * 1000n).toString();
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded create transaction. Open in OneGate or NeoLine.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            { ...values, expirySeconds: expiryMs },
            walletAddress,
          );
          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: amount },
                  { type: "String", value: RED_ENVELOPE_CREATE_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: resolveNetworkOperationMethod(
                  app.app_id,
                  operation.method,
                  targetNetwork,
                ),
                args,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Envelope created: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === NEO_PAY_APP_ID &&
          operation.method === "createStream"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "NeoPay contract is not configured for this network.",
            );
          }

          const totalAmountText = String(values.totalAmount || "").trim();
          if (!/^\d+(?:\.\d+)?$/.test(totalAmountText) || Number(totalAmountText) <= 0) {
            throw new Error("Total GAS must be a positive value.");
          }
          const rateAmountText = String(values.rateAmount || "").trim();
          if (!/^\d+(?:\.\d+)?$/.test(rateAmountText) || Number(rateAmountText) <= 0) {
            throw new Error("Daily release must be a positive GAS value.");
          }
          const intervalSeconds = String(values.intervalSeconds || "").trim();
          if (!/^[1-9]\d*$/.test(intervalSeconds)) {
            throw new Error("Interval must be a positive number of seconds.");
          }

          const totalAmount = parseScaledDecimal(
            totalAmountText,
            8,
            "Total GAS",
          );
          const rateAmount = parseScaledDecimal(
            rateAmountText,
            8,
            "Daily release",
          );
          if (BigInt(rateAmount) > BigInt(totalAmount)) {
            throw new Error("Daily release cannot exceed total GAS.");
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded stream transaction. Open in OneGate or NeoLine.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            {
              ...values,
              creator: "$wallet",
              asset: BLOCKCHAIN_CONSTANTS.GAS_HASH,
              totalAmount: totalAmountText,
              rateAmount: rateAmountText,
              title: String(values.title || "NeoPay stream").trim(),
              notes: String(values.notes || "").trim(),
            },
            walletAddress,
          );
          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: totalAmount },
                  { type: "String", value: `stream:GAS:${totalAmount}` },
                ],
              },
              {
                scriptHash: targetHash,
                operation: resolveNetworkOperationMethod(
                  app.app_id,
                  operation.method,
                  targetNetwork,
                ),
                args,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Stream created: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === SELF_LOAN_APP_ID &&
          operation.method === "createLoan"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "SelfLoan contract is not configured for this network.",
            );
          }

          const collateralNeo = positiveWholeValue(
            values,
            ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
            "Collateral NEO",
          );
          const ltvTier = integerRangeValue(
            values,
            ["ltvTier", "tier"],
            "LTV tier",
            1,
            3,
          );
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (targetNetwork === "mainnet") {
            const result = await adapter.invoke({
              scriptHash: targetHash,
              operation: "createLoan",
              args: buildInvokeArgs(
                [
                  {
                    name: "borrower",
                    type: "hash160",
                    required: true,
                    default_value: "$wallet",
                  },
                  {
                    name: "neoAmount",
                    type: "integer",
                    required: true,
                  },
                  {
                    name: "ltvTier",
                    type: "integer",
                    required: true,
                  },
                ],
                { borrower: "$wallet", neoAmount: collateralNeo, ltvTier },
                walletAddress,
              ),
              signers: [{ account: walletAddress, scopes: 1 }],
            });
            setInvokeFeedback({
              type: "success",
              message: `Loan created: ${result.txid}`,
            });
            return;
          }

          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded loan transaction. Open in OneGate or NeoLine.",
            );
          }

          const liquidityTopup = optionalPositiveFixed8Value(
            values,
            ["poolTopupGas", "liquidityTopupGas"],
            "Liquidity top-up",
          );
          const borrowerArg = buildInvokeArgs(
            [
              {
                name: "borrower",
                type: "hash160",
                required: true,
                default_value: "$wallet",
              },
            ],
            { borrower: "$wallet" },
            walletAddress,
          )[0];
          const args = [
            { type: "String", value: SELF_LOAN_APP_ID },
            borrowerArg,
            { type: "Integer", value: ltvTier },
          ];
          const invocations = [];
          if (liquidityTopup) {
            invocations.push({
              scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
              operation: "transfer",
              args: [
                { type: "Hash160", value: walletAddress },
                { type: "Hash160", value: targetHash },
                { type: "Integer", value: liquidityTopup },
                { type: "String", value: SELF_LOAN_POOL_MEMO },
              ],
            });
          }
          invocations.push(
            {
              scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
              operation: "transfer",
              args: [
                { type: "Hash160", value: walletAddress },
                { type: "Hash160", value: targetHash },
                { type: "Integer", value: collateralNeo },
                { type: "String", value: SELF_LOAN_COLLATERAL_MEMO },
              ],
            },
            {
              scriptHash: targetHash,
              operation: "createLoan",
              args,
            },
          );
          const result = await adapter.invokeMultiple(invocations, [
            { account: walletAddress, scopes: 1 },
          ]);
          setInvokeFeedback({
            type: "success",
            message: `Loan created: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === SELF_LOAN_APP_ID &&
          operation.method === "repayLoan"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "SelfLoan contract is not configured for this network.",
            );
          }
          const repayGas = optionalPositiveFixed8Value(
            values,
            ["repayGas", "amount", "repayAmount"],
            "Repay amount",
          );
          if (!repayGas) {
            throw new Error("Repay amount must be a positive GAS value.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (targetNetwork === "mainnet") {
            const loanId = positiveWholeValue(values, ["loanId"], "Loan ID");
            const result = await adapter.invoke({
              scriptHash: targetHash,
              operation: "repayDebt",
              args: buildInvokeArgs(
                [
                  { name: "loanId", type: "integer", required: true },
                  {
                    name: "payer",
                    type: "hash160",
                    required: true,
                    default_value: "$wallet",
                  },
                  { name: "amount", type: "amount", required: true, scale: 8 },
                ],
                { loanId, payer: "$wallet", amount: formatFixed8Amount(BigInt(repayGas)) },
                walletAddress,
              ),
              signers: [{ account: walletAddress, scopes: 1 }],
            });
            setInvokeFeedback({
              type: "success",
              message: `Loan repayment submitted: ${result.txid}`,
            });
            return;
          }

          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded repayment transaction. Open in OneGate or NeoLine.",
            );
          }
          const args = buildInvokeArgsWithoutParams(
            operation,
            { ...values, appId: SELF_LOAN_APP_ID },
            walletAddress,
            ["repayGas", "amount", "repayAmount"],
          );
          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: repayGas },
                  { type: "String", value: SELF_LOAN_REPAY_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "repayLoan",
                args,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Loan repayment submitted: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === SELF_LOAN_APP_ID &&
          operation.method === "addCollateral"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "SelfLoan contract is not configured for this network.",
            );
          }
          const collateralNeo = positiveWholeValue(
            values,
            ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
            "Collateral NEO",
          );
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (targetNetwork === "mainnet") {
            const loanId = positiveWholeValue(values, ["loanId"], "Loan ID");
            const result = await adapter.invoke({
              scriptHash: targetHash,
              operation: "addCollateral",
              args: buildInvokeArgs(
                [
                  { name: "loanId", type: "integer", required: true },
                  {
                    name: "depositor",
                    type: "hash160",
                    required: true,
                    default_value: "$wallet",
                  },
                  {
                    name: "neoAmount",
                    type: "integer",
                    required: true,
                  },
                ],
                { loanId, depositor: "$wallet", neoAmount: collateralNeo },
                walletAddress,
              ),
              signers: [{ account: walletAddress, scopes: 1 }],
            });
            setInvokeFeedback({
              type: "success",
              message: `Collateral added: ${result.txid}`,
            });
            return;
          }

          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required collateral transaction. Open in OneGate or NeoLine.",
            );
          }
          const args = buildInvokeArgsWithoutParams(
            operation,
            { ...values, appId: SELF_LOAN_APP_ID },
            walletAddress,
            ["collateralNeo", "collateralAmount", "neoAmount", "amount"],
          );
          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: collateralNeo },
                  { type: "String", value: SELF_LOAN_COLLATERAL_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "addCollateral",
                args,
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Collateral added: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === GRAVEYARD_APP_ID &&
          operation.method === "buryMemory"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Graveyard contract is not configured for this network.",
            );
          }

          const contentHash = normalizedSha256Hash(values, [
            "contentHash",
            "assetHash",
            "hash",
          ]);
          const memoryType = integerRangeValue(
            values,
            ["memoryType", "type"],
            "Memory type",
            1,
            5,
          );
          const feeAmount =
            optionalPositiveFixed8Value(
              values,
              ["feeGas", "amount", "buryFeeGas"],
              "Burial fee",
            ) ?? GRAVEYARD_DEFAULT_BURY_FEE_FIXED8;
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded burial transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: feeAmount },
                  { type: "String", value: GRAVEYARD_BURY_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "buryMemory",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "String", value: contentHash },
                  { type: "Integer", value: memoryType },
                ],
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Memory buried: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === GRAVEYARD_APP_ID &&
          operation.method === "forgetMemory"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Graveyard contract is not configured for this network.",
            );
          }

          const memoryId = positiveWholeValue(
            values,
            ["memoryId", "id"],
            "Memory ID",
          );
          const feeAmount =
            optionalPositiveFixed8Value(
              values,
              ["feeGas", "amount", "forgetFeeGas"],
              "Forgetting fee",
            ) ?? GRAVEYARD_DEFAULT_FORGET_FEE_FIXED8;
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required funded forgetting transaction. Open in OneGate or NeoLine.",
            );
          }

          const result = await adapter.invokeMultiple(
            [
              {
                scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
                operation: "transfer",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Hash160", value: targetHash },
                  { type: "Integer", value: feeAmount },
                  { type: "String", value: GRAVEYARD_FORGET_MEMO },
                ],
              },
              {
                scriptHash: targetHash,
                operation: "forgetMemory",
                args: [
                  { type: "Hash160", value: walletAddress },
                  { type: "Integer", value: memoryId },
                ],
              },
            ],
            [{ account: walletAddress, scopes: 1 }],
          );
          setInvokeFeedback({
            type: "success",
            message: `Memory forgotten: ${result.txid}`,
          });
          return;
        }

        if (
          app.app_id === DAILY_CHECKIN_APP_ID &&
          operation.method === "checkIn"
        ) {
          const targetHash =
            resolvedRuntime?.mode === "platform"
              ? resolvedRuntime.contractHash
              : directContractHash;
          if (!targetHash) {
            throw new Error(
              "Daily Check-in contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: targetHash },
              { type: "Integer", value: DAILY_CHECKIN_FEE_FIXED8 },
              { type: "String", value: DAILY_CHECKIN_MEMO },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Check-in transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "registerCustomAnchor") {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required NEP-21 batch transaction. Open in OneGate or NeoLine.",
            );
          }
          const aaCoreHash =
            EXTERNAL_INTEGRATIONS[targetNetwork].contracts.aaCore;
          const candidateKeys = parseAnchorCandidateKeys(
            values.candidates || "",
          );
          const plan = buildCustomAnchorRegistrationPlan({
            anchorContractHash: resolvedRuntime.contractHash,
            aaCoreHash,
            ownerAddress: walletAddress,
            slug: values.slug || "",
            nonce: values.nonce || "",
            mode: values.mode || "trust",
            candidateKeys,
          });
          const result = await adapter.invokeMultiple(plan.invocations, [
            { account: walletAddress, scopes: 1 },
          ]);
          setInvokeFeedback({
            type: "success",
            message: `Custom Anchor registered: ${plan.appId} (${result.txid})`,
          });
          return;
        }

        const anchorOperationAppId = resolveAnchorOperationAppId(
          app.app_id,
          values,
          launchContext,
        );

        if (operation.method === "stakeNeo" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: resolvedRuntime.contractHash },
              { type: "Integer", value: amount },
              { type: "String", value: `stake:${anchorOperationAppId}` },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Stake transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "withdrawNeo" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "withdraw",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
              { type: "Integer", value: amount },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Redeem transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "claimRewards" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "claimRewards",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Claim transaction submitted: ${result.txid}`,
          });
          return;
        }

        let txid: string;
        if (resolvedRuntime?.mode === "platform") {
          if (!resolvedRuntime.writesEnabled || !resolvedRuntime.contractHash) {
            throw new Error(
              resolvedRuntime.disabledReason ||
                "Platform runtime is not available on the selected network.",
            );
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );
          const chainOperation = resolveNetworkOperationMethod(
            app.app_id,
            operation.method,
            targetNetwork,
          );
          const invokePayload: InvokeParams = {
            scriptHash: resolvedRuntime.contractHash,
            operation: chainOperation,
            args,
          };
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
          const result = await adapter.invoke(invokePayload);
          txid = result.txid;
        } else if (sharedRuntime && isSharedModeApp(app)) {
          const sharedOperation = resolveSharedOperationRecipe(
            app,
            operation.method,
          );
          if (!sharedOperation) {
            throw new Error(
              "Shared runtime operation is not configured for this miniapp.",
            );
          }
          const targetModule = sharedRuntime.modules.find(
            (module) => module.binding === sharedOperation.binding,
          );
          if (!targetModule?.contractHash) {
            throw new Error(
              `Shared module binding "${sharedOperation.binding}" is unavailable.`,
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (walletAddress.startsWith("0x")) {
            throw new Error(
              "Shared runtime invoke currently supports Neo N3 wallets only.",
            );
          }

          const args = buildSharedInvokeArgs(
            sharedOperation,
            values,
            sharedRuntime,
            walletAddress,
          );
          const invokePayload: InvokeParams = {
            scriptHash: targetModule.contractHash,
            operation: sharedOperation.method,
            args,
          };
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
          const result = await adapter.invoke(invokePayload);
          txid = result.txid;
        } else {
          if (!directContractHash) {
            throw new Error(
              "Contract hash is not configured for this miniapp.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );

          // Neo N3 execution only; embedded EVM auth is not a transaction path here.
          {
            const adapter = getWalletAdapter();
            if (!adapter) {
              throw new Error(
                "Wallet adapter unavailable. Reconnect wallet and try again.",
              );
            }

            const invokePayload: InvokeParams = {
              scriptHash: directContractHash,
              operation: resolveNetworkOperationMethod(
                app.app_id,
                operation.method,
                targetNetwork,
              ),
              args,
            };

            if (walletAddress) {
              invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
            }

            const result = await adapter.invoke(invokePayload);
            txid = result.txid;
          }
        }

        setInvokeFeedback({
          type: "success",
          message: `Transaction submitted: ${txid}`,
        });
      } catch (invokeError) {
        const message =
          invokeError instanceof Error
            ? invokeError.message
            : "Operation failed";
        setInvokeFeedback({
          type: "error",
          message,
        });
        throw invokeError;
      }
    },
    [
      app,
      appSupportsTargetNetwork,
      directContractHash,
      networkAvailabilityReason,
      resolvedRuntime,
      router,
      sharedRuntime,
      targetCatalogNetwork,
      targetNetwork,
      walletAddress,
      walletConnected,
      walletNetwork,
    ],
  );
}
