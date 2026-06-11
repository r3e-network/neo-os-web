import type { NeoNetwork } from "../neo-network";
import { cleanValue } from "./values";

type HostApiJson = Record<string, unknown>;

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

async function readApiJson(response: Response): Promise<HostApiJson> {
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
  const body = await readApiJson(response);
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

export async function invokeAARelayHostApiOperation(
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
