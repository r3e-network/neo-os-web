import { addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { buildMiniAppUrl } from "@shared/utils/miniapp-routes";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";

export const CERTIFICATE_LIMITS = {
  templateName: 60,
  issuerName: 60,
  category: 32,
  description: 240,
  recipientName: 60,
  achievement: 120,
  memo: 160,
} as const;

/**
 * `none` means there is no connected-wallet dataset to load. `failed` is kept
 * separate so an unreadable RPC can never be rendered as a genuine zero
 * balance or an empty credential wallet.
 */
export type CertificateDataSource = "chain" | "partial" | "cache" | "none" | "failed";

export type CertificateTransactionState = "halt" | "fault" | "unknown";

export interface CertificateTransactionOutcome {
  state: CertificateTransactionState;
  event: unknown | null;
}

export const CERTIFICATE_CANONICAL_ORIGIN = "https://neomini.app";
// Age changes the guidance, never the replay lock. An unknown transaction can
// still have executed even when every index/RPC path is temporarily unavailable.
export const PENDING_CERTIFICATE_STALE_MS = 24 * 60 * 60 * 1_000;
const NEO_TXID_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export type PendingCertificateKind =
  | "create-template"
  | "update-template"
  | "issue-certificate"
  | "toggle-template"
  | "revoke-certificate";

export interface PendingCertificateOperation {
  /**
   * Version 1 receipts predate full metadata binding. They remain readable so
   * an in-flight transaction from the previous frontend is never discarded.
   * Every new write uses version 2 and binds every user-authored field that
   * must be present in the authoritative contract readback.
   */
  version: 1 | 2;
  kind: PendingCertificateKind;
  txid: string;
  eventName: "TemplateCreated" | "CertificateIssued" | "TemplateUpdated" | "CertificateRevoked";
  network: string;
  contractHash: string;
  issuer: string;
  createdAt: number;
  templateId?: string;
  tokenId?: string;
  recipient?: string;
  recipientName?: string;
  achievement?: string;
  memo?: string;
  targetActive?: boolean;
  templateName?: string;
  templateIssuerName?: string;
  templateCategory?: string;
  templateMaxSupply?: string;
  templateDescription?: string;
}

export function normalizeNeoHash(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    return /^0x0{40}$/i.test(raw) ? "" : raw.toLowerCase();
  }
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-fA-F]{40}$/.test(converted) && !/^0x0{40}$/i.test(converted)
    ? converted.toLowerCase()
    : "";
}

export function isValidNeoRecipient(value: unknown): boolean {
  return Boolean(normalizeNeoHash(value));
}

export function isPositiveTemplateId(value: unknown): boolean {
  return /^[1-9]\d{0,19}$/.test(String(value ?? "").trim());
}

/**
 * Contract token ids are deterministic `<templateId>-<serial>` strings.
 */
export function isValidCertificateTokenId(value: unknown): boolean {
  const tokenId = String(value ?? "").trim();
  return /^[1-9]\d{0,19}-[1-9]\d{0,19}$/.test(tokenId);
}

export function isValidNeoTransactionId(value: unknown): boolean {
  return NEO_TXID_PATTERN.test(String(value ?? "").trim());
}

function canonicalMiniAppUrl(path: string): string {
  return new URL(path, CERTIFICATE_CANONICAL_ORIGIN).toString();
}

export function buildCertificateVerifyUrl(tokenId: string): string {
  return canonicalMiniAppUrl(
    buildMiniAppUrl("miniapp-soulbound-certificate", { verifyTokenId: tokenId }),
  );
}

export function buildCertificateIssueUrl(templateId: string): string {
  return canonicalMiniAppUrl(
    buildMiniAppUrl("miniapp-soulbound-certificate", {
      issueTemplateId: templateId,
      autoIssueDraft: "1",
    }),
  );
}

/** Read the authoritative VM outcome without treating a relayed tx as success. */
export async function readCertificateTransactionOutcome(
  network: string,
  txid: string,
  eventName: string,
  contractHash: string,
): Promise<CertificateTransactionOutcome> {
  const normalizedNetwork = String(network).trim().toLowerCase();
  const segment = normalizedNetwork.includes("testnet")
    ? "testnet"
    : normalizedNetwork.includes("mainnet")
      ? "mainnet"
      : "";
  if (!segment || !isValidNeoTransactionId(txid)) {
    return { state: "unknown", event: null };
  }
  try {
    const response = await fetchWithTimeout(`https://api.n3index.dev/${segment}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", event: null };
    const payload = await response.json() as {
      result?: {
        executions?: Array<{
          vmstate?: unknown;
          notifications?: Array<{
            contract?: unknown;
            eventname?: unknown;
            state?: { value?: unknown } | unknown;
          }>;
        }>;
      };
      error?: unknown;
    };
    if (payload.error) return { state: "unknown", event: null };
    const executions = payload.result?.executions ?? [];
    const states = executions
      .map((execution) => String(execution.vmstate ?? "").toUpperCase())
      .filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", event: null };
    }
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
      return { state: "unknown", event: null };
    }
    const wantedContract = String(contractHash ?? "").trim().toLowerCase();
    const notification = executions
      .flatMap((execution) => execution.notifications ?? [])
      .find((item) => {
        const nameMatches = String(item.eventname ?? "") === eventName;
        const itemContract = String(item.contract ?? "").trim().toLowerCase();
        return nameMatches && (!wantedContract || itemContract === wantedContract);
      });
    const rawState = notification?.state && typeof notification.state === "object" && "value" in notification.state
      ? notification.state.value
      : notification?.state;
    const event = Array.isArray(rawState)
      ? { state: rawState.map((item) => ({ value: parseStackItem(item) })) }
      : null;
    return { state: "halt", event };
  } catch {
    return { state: "unknown", event: null };
  }
}

export function isPendingCertificateOperation(value: unknown): value is PendingCertificateOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingCertificateOperation>;
  const baseValid = (
    (pending.version === 1 || pending.version === 2) &&
    ["create-template", "update-template", "issue-certificate", "toggle-template", "revoke-certificate"].includes(String(pending.kind)) &&
    isValidNeoTransactionId(pending.txid) &&
    ["TemplateCreated", "CertificateIssued", "TemplateUpdated", "CertificateRevoked"].includes(String(pending.eventName)) &&
    /(?:^|-)\b(?:mainnet|testnet)\b$/i.test(String(pending.network ?? "")) &&
    Boolean(normalizeNeoHash(pending.contractHash)) &&
    Boolean(normalizeNeoHash(pending.issuer)) &&
    Number.isFinite(pending.createdAt) &&
    Number(pending.createdAt) > 0
  );
  if (!baseValid) return false;
  const expectedEvent = pending.kind === "create-template"
    ? "TemplateCreated"
    : pending.kind === "issue-certificate"
      ? "CertificateIssued"
      : pending.kind === "revoke-certificate"
        ? "CertificateRevoked"
        : "TemplateUpdated";
  if (pending.eventName !== expectedEvent) return false;
  if (pending.kind === "create-template") {
    if (!String(pending.templateName ?? "").trim()) return false;
    // Preserve recovery for legacy version-1 receipts, which only bound the
    // issuer and template name. New version-2 receipts must carry the complete
    // template payload so success cannot be inferred from a partial readback.
    if (pending.version === 1) return true;
    const maxSupply = String(pending.templateMaxSupply ?? "").trim();
    return Boolean(
      String(pending.templateIssuerName ?? "").trim() &&
      String(pending.templateCategory ?? "").trim() &&
      typeof pending.templateDescription === "string" &&
      /^\d{1,6}$/.test(maxSupply) &&
      Number(maxSupply) > 0 &&
      Number(maxSupply) <= 100_000 &&
      String(pending.templateName ?? "").trim().length <= CERTIFICATE_LIMITS.templateName &&
      String(pending.templateIssuerName ?? "").trim().length <= CERTIFICATE_LIMITS.issuerName &&
      String(pending.templateCategory ?? "").trim().length <= CERTIFICATE_LIMITS.category &&
      pending.templateDescription.length <= CERTIFICATE_LIMITS.description
    );
  }
  if (pending.kind === "update-template") {
    const maxSupply = String(pending.templateMaxSupply ?? "").trim();
    return Boolean(
      isPositiveTemplateId(pending.templateId) &&
      String(pending.templateName ?? "").trim() &&
      String(pending.templateIssuerName ?? "").trim() &&
      String(pending.templateCategory ?? "").trim() &&
      /^\d{1,6}$/.test(maxSupply) &&
      Number(maxSupply) > 0 &&
      Number(maxSupply) <= 100_000 &&
      String(pending.templateName ?? "").trim().length <= CERTIFICATE_LIMITS.templateName &&
      String(pending.templateIssuerName ?? "").trim().length <= CERTIFICATE_LIMITS.issuerName &&
      String(pending.templateCategory ?? "").trim().length <= CERTIFICATE_LIMITS.category &&
      String(pending.templateDescription ?? "").trim().length <= CERTIFICATE_LIMITS.description
    );
  }
  if (pending.kind === "issue-certificate") {
    if (!isPositiveTemplateId(pending.templateId) || !isValidNeoRecipient(pending.recipient)) {
      return false;
    }
    if (pending.version === 1) return true;
    return Boolean(
      String(pending.recipientName ?? "").trim() &&
      String(pending.achievement ?? "").trim() &&
      typeof pending.memo === "string" &&
      String(pending.recipientName).trim().length <= CERTIFICATE_LIMITS.recipientName &&
      String(pending.achievement).trim().length <= CERTIFICATE_LIMITS.achievement &&
      pending.memo.length <= CERTIFICATE_LIMITS.memo
    );
  }
  if (pending.kind === "toggle-template") {
    return isPositiveTemplateId(pending.templateId) && typeof pending.targetActive === "boolean";
  }
  return isPositiveTemplateId(pending.templateId) && isValidCertificateTokenId(pending.tokenId);
}
