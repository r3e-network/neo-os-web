/**
 * useSoulbound - domain logic for the Soulbound Certificate miniapp.
 *
 * The app keeps OS storage as a read fallback, but write flows use the
 * dedicated MiniAppSoulboundCertificate contract (reached through the MiniApp
 * framework SDK, ctx.framework) so the frontend can issue, activate/deactivate,
 * verify, and revoke real NEP-11 soulbound certificates.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type {
  FrameworkBadgeSurface,
  FrameworkClipboardSurface,
  FrameworkRemoteStorageSurface,
  MiniAppFramework,
} from "@shared/react";
import { getLaunchParam, readMiniAppLaunchContext } from "@shared/utils/launch-params";
import { eventValue } from "@shared/utils/chain-events";
import { parseHash160 } from "@shared/utils/neo";
import { parseBigInt, parseBool, encodeTokenId } from "@shared/utils/parsers";
import { getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants/rpc";
import type { CertificateItem, TemplateItem } from "../types";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import {
  CERTIFICATE_LIMITS,
  PENDING_CERTIFICATE_STALE_MS,
  buildCertificateIssueUrl,
  buildCertificateVerifyUrl,
  isPendingCertificateOperation,
  isPositiveTemplateId,
  isValidCertificateTokenId,
  isValidNeoTransactionId,
  normalizeNeoHash,
  readCertificateTransactionOutcome,
  type CertificateDataSource,
  type CertificateTransactionOutcome,
  type PendingCertificateKind,
  type PendingCertificateOperation,
} from "../certificate-safety";

type TxResult = {
  txid?: string;
  event?: unknown;
  success?: boolean;
  verified?: boolean;
};

export interface CreateTemplateForm {
  name: string;
  issuerName: string;
  category: string;
  maxSupply: string;
  description: string;
}

export interface UpdateTemplateForm extends CreateTemplateForm {
  templateId: string;
}

export interface IssueCertificateForm {
  templateId: string;
  recipient: string;
  recipientName: string;
  achievement: string;
  memo: string;
}

export interface VerifyCertificateForm {
  tokenId: string;
}

export interface RevokeCertificateForm {
  tokenId: string;
}

export interface UseSoulboundOptions {
  storageService: FrameworkRemoteStorageSurface;
  badgeService: Pick<FrameworkBadgeSurface, "award">;
  /** Copy-with-toast surface (app.clipboard). */
  clipboard: FrameworkClipboardSurface;
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Test seam for authoritative RPC application-log reconciliation. */
  transactionOutcomeReader?: (
    network: string,
    txid: string,
    eventName: string,
    contractHash: string,
  ) => Promise<CertificateTransactionOutcome>;
}

interface StoredTemplate {
  id: string;
  issuer: string;
  name: string;
  issuerName: string;
  category: string;
  maxSupply: number | string;
  issued: number | string;
  description: string;
  active: boolean;
}

interface StoredCertificate {
  tokenId: string;
  templateId: string;
  owner: string;
  templateName: string;
  issuerName: string;
  category: string;
  description: string;
  recipientName: string;
  achievement: string;
  memo: string;
  issuedTime: number;
  revoked: boolean;
  revokedTime: number;
}

const TEMPLATE_PAGE_SIZE = 50;
const TEMPLATE_LIST_LIMIT = 500;
const APP_ID = "miniapp-soulbound-certificate";
// Keep the key byte-for-byte compatible with the previous app.state.persisted
// record so in-flight version-1 receipts survive this production hardening.
const PENDING_CERTIFICATE_STORAGE_KEY = "state/pendingOperation";
const RECOVERY_STORAGE_PROBE_KEY = "state/pendingOperationProbe";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function explicitNeoNetwork(value: unknown): "mainnet" | "testnet" | "" {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

function unsignedChainInteger(
  value: unknown,
  errorMessage: string,
): bigint {
  const normalized = stringValue(value);
  if (!/^\d+$/.test(normalized)) throw new Error(errorMessage);
  return BigInt(normalized);
}

// framework-exempt: false-not-throw semantics are load-bearing here — this is
// the fail-closed VALIDITY/COMPARISON half of the old dual-use helper (empty
// string on invalid input drives localized rejections and issuer-witness
// gating); app.chain.arg.hash160 throws, so it must never replace these sites.
// The ARG-BUILDING half migrated onto app.chain.arg.hash160 (plan §3.6).
function normalizeHash160(value: unknown): string {
  return normalizeNeoHash(value);
}

/**
 * Normalize a chain-derived Hash160 (a ByteString that parseStackItem renders as
 * little-endian "0x<hex>", or already in 0x display form) to the big-endian 0x
 * display form so it can be compared with normalizeHash160(address).
 */
function toDisplayHash(value: unknown): string {
  const display = parseHash160(value);
  if (display) return display;
  // Fallback for a base58 address or an already-display 0x hash.
  return normalizeHash160(value);
}

function hashValueMatches(value: unknown, expected: unknown): boolean {
  const wanted = normalizeHash160(expected);
  if (!wanted) return false;
  const direct = normalizeHash160(value);
  const rpcDisplay = toDisplayHash(value).toLowerCase();
  return direct === wanted || rpcDisplay === wanted;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}

function assertTextLimit(
  value: string,
  max: number,
  messageKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (value.length > max) throw new Error(t(messageKey, { max }));
}

function txidFrom(result: TxResult | null | undefined): string {
  return stringValue(result?.txid);
}

function isStandaloneLocalDevRoot(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const { hostname, pathname, port } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  return isLocalHost && port !== "" && pathname === "/";
}

function templateFromRecord(record: Record<string, unknown>): TemplateItem | null {
  const id = stringValue(record.id ?? record.templateId);
  if (!isPositiveTemplateId(id)) return null;
  return {
    id,
    issuer: stringValue(record.issuer),
    name: stringValue(record.name),
    issuerName: stringValue(record.issuerName),
    category: stringValue(record.category),
    maxSupply: parseBigInt(record.maxSupply),
    issued: parseBigInt(record.issued),
    description: stringValue(record.description),
    active: parseBool(record.active ?? record.status === "active"),
  };
}

function certificateFromRecord(
  record: Record<string, unknown>,
): CertificateItem | null {
  const tokenId = stringValue(record.tokenId);
  const templateId = stringValue(record.templateId);
  if (!isValidCertificateTokenId(tokenId) || !isPositiveTemplateId(templateId)) return null;
  return {
    tokenId,
    templateId,
    owner: stringValue(record.owner),
    templateName: stringValue(record.templateName),
    issuerName: stringValue(record.issuerName),
    category: stringValue(record.category),
    description: stringValue(record.description),
    recipientName: stringValue(record.recipientName),
    achievement: stringValue(record.achievement),
    memo: stringValue(record.memo),
    issuedTime: Number(record.issuedTime || 0),
    revoked: parseBool(record.revoked),
    revokedTime: Number(record.revokedTime || 0),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeTemplateForm(form: Partial<CreateTemplateForm>) {
  const name = stringValue(form.name);
  const issuerName = stringValue(form.issuerName);
  const category = stringValue(form.category);
  const maxSupply = Number(stringValue(form.maxSupply));
  const description = stringValue(form.description);
  return { name, issuerName, category, maxSupply, description };
}

function normalizeIssueForm(form: Partial<IssueCertificateForm>) {
  return {
    templateId: stringValue(form.templateId),
    recipient: stringValue(form.recipient),
    recipientName: stringValue(form.recipientName),
    achievement: stringValue(form.achievement),
    memo: stringValue(form.memo),
  };
}

export function useSoulbound({
  storageService,
  badgeService,
  clipboard,
  app,
  t,
  transactionOutcomeReader = readCertificateTransactionOutcome,
}: UseSoulboundOptions) {
  const templates = createObservable<TemplateItem[]>([]);
  const certificates = createObservable<CertificateItem[]>([]);
  const templatesSource = createObservable<CertificateDataSource>("none");
  const certificatesSource = createObservable<CertificateDataSource>("none");
  const verifiedCertificate = createObservable<CertificateItem | null>(null);
  // True only when the connected wallet issued the verified certificate's
  // template. RevokeCertificate asserts the issuer witness + template ownership
  // on-chain, so this gates the destructive Revoke action to the one wallet the
  // contract will actually accept (everyone else gets a hidden button instead
  // of a wallet prompt that reverts with "not issuer").
  const verifiedIsIssuer = createObservable(false);
  const isRefreshing = createObservable(false);
  const isRefreshingCertificates = createObservable(false);
  const isConnecting = createObservable(false);
  const isCreatingTemplate = createObservable(false);
  const isUpdatingTemplate = createObservable(false);
  const isIssuing = createObservable(false);
  const isVerifying = createObservable(false);
  const isRevoking = createObservable(false);
  const isRecovering = createObservable(false);
  const togglingId = createObservable<string | null>(null);
  const isLoading = createObservable(false);
  const lastTxid = createObservable("");
  const lastError = createObservable("");
  const lastSuccess = createObservable("");
  const lastNotice = createObservable("");
  const recoveryStorageAvailable = createObservable(false);

  /**
   * A wallet write is allowed only when the exact recovery receipt can survive
   * a reload. The framework's local adapter intentionally degrades to no-op
   * when storage is unavailable, so a set/get/delete round-trip is required;
   * checking for the API shape alone would report a false positive.
   */
  const probeRecoveryStorage = () => {
    const marker = `soulbound:${Date.now()}:${Math.random()}`;
    let available = false;
    try {
      app.storage.local.set(RECOVERY_STORAGE_PROBE_KEY, marker);
      available = app.storage.local.get<string>(RECOVERY_STORAGE_PROBE_KEY, "") === marker;
    } catch {
      available = false;
    } finally {
      try {
        app.storage.local.delete(RECOVERY_STORAGE_PROBE_KEY);
      } catch {
        available = false;
      }
    }
    recoveryStorageAvailable.set(available);
    return available;
  };

  const readStoredPendingOperation = (): PendingCertificateOperation | null => {
    try {
      const stored = app.storage.local.get<unknown>(PENDING_CERTIFICATE_STORAGE_KEY, null);
      if (stored === null) return null;
      if (isPendingCertificateOperation(stored)) return stored;
      app.storage.local.delete(PENDING_CERTIFICATE_STORAGE_KEY);
      return null;
    } catch {
      recoveryStorageAvailable.set(false);
      return null;
    }
  };

  const pendingOperation = createObservable<PendingCertificateOperation | null>(
    probeRecoveryStorage() ? readStoredPendingOperation() : null,
  );

  const requireRecoveryStorage = () => {
    if (!probeRecoveryStorage()) throw new Error(t("recoveryStorageUnavailable"));
  };

  const refreshRecoveryStorage = () => {
    if (!probeRecoveryStorage()) return false;
    const pending = pendingOperation.get();
    try {
      // A broadcast may have reached the wallet immediately before durable
      // storage failed. Persist that exact in-memory receipt as soon as storage
      // returns; proving an unrelated probe key is not enough to make recovery
      // reload-safe again.
      if (pending) writePendingOperation(pending);
      if (lastError.get() === t("recoveryStorageUnavailable")) {
        lastError.set("");
      }
      return true;
    } catch {
      recoveryStorageAvailable.set(false);
      lastError.set(t("recoveryStorageUnavailable"));
      return false;
    }
  };

  const writePendingOperation = (next: PendingCertificateOperation | null) => {
    requireRecoveryStorage();
    try {
      if (next) {
        app.storage.local.set(PENDING_CERTIFICATE_STORAGE_KEY, next);
        const stored = app.storage.local.get<unknown>(PENDING_CERTIFICATE_STORAGE_KEY, null);
        if (
          !isPendingCertificateOperation(stored) ||
          JSON.stringify(stored) !== JSON.stringify(next)
        ) {
          throw new Error(t("recoveryStorageUnavailable"));
        }
      } else {
        app.storage.local.delete(PENDING_CERTIFICATE_STORAGE_KEY);
        if (app.storage.local.get<unknown>(PENDING_CERTIFICATE_STORAGE_KEY, null) !== null) {
          throw new Error(t("recoveryStorageUnavailable"));
        }
      }
      recoveryStorageAvailable.set(true);
      pendingOperation.set(next);
    } catch {
      recoveryStorageAvailable.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
  };

  const restorePendingOperation = () => {
    if (!probeRecoveryStorage()) return pendingOperation.get();
    const stored = readStoredPendingOperation();
    if (!pendingOperation.get() && stored) pendingOperation.set(stored);
    return pendingOperation.get();
  };

  // Read side of the Copy/Share Issue Link deep-link feature. When a recipient
  // opens a copied/shared link (…?issueTemplateId=7&autoIssueDraft=1), surface
  // the requested template id and draft flag so the Issue panel can preselect
  // the template instead of dropping the user on the default app state.
  const launchContext = readMiniAppLaunchContext("miniapp-soulbound-certificate");
  const deepLinkTemplateId = createObservable(
    getLaunchParam(launchContext, ["issueTemplateId", "templateId"]),
  );
  const deepLinkAutoIssue = createObservable(
    /^(1|true|yes)$/i.test(getLaunchParam(launchContext, "autoIssueDraft")),
  );
  // Recipient-facing verify deep-link (?verifyTokenId=…). Permissionless, so any
  // counterparty who opens the link lands on the Verify panel prefilled.
  const deepLinkVerifyTokenId = createObservable(
    getLaunchParam(launchContext, "verifyTokenId"),
  );

  // Allow the view to mark the deep-link as consumed so the prefill is applied
  // once and the user can freely edit the template id afterwards.
  const consumeDeepLink = () => {
    deepLinkTemplateId.set("");
    deepLinkAutoIssue.set(false);
  };

  const consumeVerifyDeepLink = () => {
    deepLinkVerifyTokenId.set("");
  };

  const address = createObservable("");
  const templatesCount = createDerived(() => templates.get().length, [templates]);
  const certificatesCount = createDerived(() => certificates.get().length, [certificates]);
  const activeTemplatesCount = createDerived(
    () => templatesSource.get() === "chain" ? templates.get().filter((tpl) => tpl.active).length : 0,
    [templates, templatesSource],
  );

  const connectedAddress = () =>
    stringValue(app.chain.address?.get?.()) || stringValue(address.get());

  const ensureIssuer = async () => {
    const wallet = await app.chain.ensureWallet();
    address.set(wallet);
    // ARG-BUILDING half of the old dual-use normalizeHash160: the wallet
    // address is only ever fed to app.chain.arg.hash160, which performs the
    // same address→Hash160 conversion — no pre-normalization needed.
    return wallet;
  };

  const currentChainContext = async () => {
    const launchNetwork = stringValue(app.platform.launch.network).toLowerCase();
    let detectedNetwork = "";
    try {
      detectedNetwork = stringValue(await app.chain.detectNetwork?.()).toLowerCase();
    } catch {
      // The signed launch network remains the best available recovery boundary.
    }
    const launchLane = explicitNeoNetwork(launchNetwork);
    const detectedLane = explicitNeoNetwork(detectedNetwork);
    const launchIsSpecific = Boolean(launchLane);
    const detectedIsGeneric = detectedNetwork === "neo-n3";
    const detectedIsIncompatible = Boolean(
      detectedNetwork && !detectedIsGeneric && !detectedLane,
    );
    const networkMismatch = Boolean(
      detectedIsIncompatible ||
      (launchLane && detectedLane && launchLane !== detectedLane),
    );
    const network = launchIsSpecific && detectedIsGeneric
      ? launchNetwork
      : detectedNetwork || launchNetwork || "unknown";
    return {
      network,
      networkMismatch,
      contractHash: stringValue(app.chain.contractAddress?.get?.()).toLowerCase(),
    };
  };

  /**
   * Reads and writes are only authoritative when the framework is bound to the
   * canonical contract for the explicit launch network. This prevents a valid
   * looking record from another deployment (or a generic/unknown network) from
   * being presented as a verified certificate.
   */
  const requireCanonicalChainContext = async () => {
    const context = await currentChainContext();
    const hasSpecificNetwork = /(?:mainnet|testnet)/.test(context.network);
    const configuredContract = context.contractHash.toLowerCase();
    const expectedContract = hasSpecificNetwork
      ? getMiniAppContractHash(APP_ID, resolveNeoNetwork(context.network)).toLowerCase()
      : "";
    if (
      context.networkMismatch ||
      !hasSpecificNetwork ||
      !/^0x[0-9a-f]{40}$/.test(configuredContract) ||
      /^0x0{40}$/.test(configuredContract) ||
      !expectedContract ||
      configuredContract !== expectedContract
    ) {
      throw new Error(t("chainContextMismatch"));
    }
    return context;
  };

  const preparePending = async (
    kind: PendingCertificateKind,
    eventName: PendingCertificateOperation["eventName"],
    issuer: string,
    details: Partial<PendingCertificateOperation> = {},
  ): Promise<Omit<PendingCertificateOperation, "txid">> => {
    // Prove recovery storage before the wallet is ever asked to sign. A write
    // without a reload-safe receipt would make a later retry ambiguous.
    requireRecoveryStorage();
    const context = await requireCanonicalChainContext();
    return {
      version: 2,
      kind,
      eventName,
      issuer: normalizeHash160(issuer),
      network: context.network,
      contractHash: context.contractHash,
      createdAt: Date.now(),
      ...details,
    };
  };

  const persistBroadcast = (
    draft: Omit<PendingCertificateOperation, "txid">,
    txid: string,
  ) => {
    const normalizedTxid = stringValue(txid);
    if (!isValidNeoTransactionId(normalizedTxid)) return;
    const record = { ...draft, txid: normalizedTxid } as PendingCertificateOperation;
    try {
      writePendingOperation(record);
    } catch (error) {
      // The transaction is already broadcast at this point. Preserve the lock
      // in memory and expose the storage fault; never make a duplicate signature
      // available merely because durable storage became unavailable mid-flight.
      pendingOperation.set(record);
      recoveryStorageAvailable.set(false);
      throw error;
    }
    lastTxid.set(normalizedTxid);
    lastError.set("");
    lastSuccess.set("");
    lastNotice.set(t("transactionPending"));
  };

  const requirePendingReceipt = (
    draft: Omit<PendingCertificateOperation, "txid">,
    result: TxResult | null | undefined,
  ) => {
    if (!pendingOperation.get() && txidFrom(result)) {
      persistBroadcast(draft, txidFrom(result));
    }
    const pending = pendingOperation.get();
    if (!pending) throw new Error(t("transactionReceiptMissing"));
    return pending;
  };

  const assertNoPendingWrite = () => {
    if (pendingOperation.get()) throw new Error(t("pendingBlocksWrites"));
  };

  const setSuccess = (messageKey: string, result?: TxResult | null) => {
    lastError.set("");
    lastNotice.set("");
    lastSuccess.set(t(messageKey));
    lastTxid.set(txidFrom(result));
  };

  const setFailure = (error: unknown, fallbackKey: string) => {
    lastSuccess.set("");
    const pending = pendingOperation.get();
    if (!pending) {
      lastNotice.set("");
      lastTxid.set("");
    }
    const formatted = formatErrorMessage(error, t(fallbackKey));
    lastError.set(/contract address not configured/i.test(formatted) ? t("contractMissing") : formatted);
  };

  const setPendingNotice = (messageKey = "transactionPending") => {
    lastError.set("");
    lastSuccess.set("");
    lastNotice.set(t(messageKey));
    const pending = pendingOperation.get();
    if (pending) lastTxid.set(pending.txid);
  };

  const loadTemplatesFromStorage = async () => {
    if (isStandaloneLocalDevRoot()) {
      templates.set([]);
      templatesSource.set("none");
      return;
    }
    const templateMap = await storageService.list("templates:", 20);
    const items: TemplateItem[] = [];
    if (templateMap && typeof templateMap === "object") {
      for (const [, value] of Object.entries(templateMap)) {
        const stored = value as StoredTemplate;
        const item = templateFromRecord(stored as unknown as Record<string, unknown>);
        if (item) items.push(item);
      }
    }
    templates.set(items);
    templatesSource.set(items.length > 0 ? "cache" : "none");
  };

  const loadCertificatesFromStorage = async () => {
    if (isStandaloneLocalDevRoot()) {
      certificates.set([]);
      certificatesSource.set("none");
      return;
    }
    const certMap = await storageService.list("certificates:", 50);
    const items: CertificateItem[] = [];
    if (certMap && typeof certMap === "object") {
      for (const [, value] of Object.entries(certMap)) {
        const stored = value as StoredCertificate;
        const item = certificateFromRecord(stored as unknown as Record<string, unknown>);
        if (item) items.push(item);
      }
    }
    certificates.set(items);
    certificatesSource.set(items.length > 0 ? "cache" : "none");
  };

  // Upper bound on how many templates/serials the recipient-side scan walks in
  // one pass, so the "My Certificates" reconstruction can never fan out into an
  // unbounded number of RPC reads on a large registry.
  const CERT_SCAN_TEMPLATE_LIMIT = 200;
  const CERT_SCAN_SERIAL_LIMIT = 500;

  /**
   * Load the certificates a wallet HOLDS.
   *
   * NEP-11 `tokensOf(owner)` returns a session iterator (InteropInterface), and
   * the public RPC has iterator traversal disabled, so the iterator can never be
   * enumerated from the browser — the old read returned an empty list for every
   * holder. Token ids are deterministic instead: the contract mints them as
   * "<templateId>-<serial>" with serial 1..issued (BuildTokenId), so the holdings
   * can be reconstructed without the iterator:
   *   1. balanceOf(owner) — short-circuit holders with zero certificates.
   *   2. Walk template ids 1..totalTemplates, read getTemplateDetails for each
   *      issued count.
   *   3. For every minted serial, ownerOf("<templateId>-<serial>") is a single
   *      Map/value read (no iterator); keep the ones owned by this wallet.
   *   4. getCertificateDetails for each owned token id.
   */
  const loadCertificatesFromChain = async (owner: string) => {
    await requireCanonicalChainContext();
    const ownerHash = normalizeHash160(owner);
    if (!ownerHash) {
      certificates.set([]);
      certificatesSource.set("none");
      return;
    }

    // Short-circuit: a wallet with no soulbound balance holds nothing to scan.
    const rawBalance = await app.chain.readRaw("balanceOf", [
      app.chain.arg.hash160(ownerHash),
    ]);
    const balance = unsignedChainInteger(rawBalance, t("certificateLoadFailed"));
    if (balance <= 0n) {
      certificates.set([]);
      certificatesSource.set("chain");
      return;
    }

    const totalTemplates = Number(unsignedChainInteger(
      await app.chain.readRaw("totalTemplates"),
      t("certificateLoadFailed"),
    ));
    const templateCount = Number.isFinite(totalTemplates)
      ? Math.min(totalTemplates, CERT_SCAN_TEMPLATE_LIMIT)
      : 0;
    if (templateCount <= 0) {
      certificates.set([]);
      certificatesSource.set("partial");
      return;
    }

    // Resolve every template's issued count so the serial range is known.
    const templateIds = Array.from({ length: templateCount }, (_v, i) => i + 1);
    const issuedCounts = await mapWithConcurrency(
      templateIds,
      8,
      async (templateId) => {
        const record = asRecord(
          await app.chain
            .readRaw("getTemplateDetails", [app.chain.arg.integer(templateId)])
            .catch(() => null),
        );
        const issued = record ? Number(parseBigInt(record.issued)) : 0;
        return { templateId, issued: Number.isFinite(issued) ? issued : 0 };
      },
    );

    // Build the candidate token ids ("<templateId>-<serial>") capped overall.
    const candidateTokenIds: string[] = [];
    for (const { templateId, issued } of issuedCounts) {
      for (let serial = 1; serial <= issued; serial += 1) {
        candidateTokenIds.push(`${templateId}-${serial}`);
        if (candidateTokenIds.length >= CERT_SCAN_SERIAL_LIMIT) break;
      }
      if (candidateTokenIds.length >= CERT_SCAN_SERIAL_LIMIT) break;
    }

    // Filter to the wallet's own tokens via single-item ownerOf reads, then stop
    // as soon as every held certificate is found (balance is exact).
    const ownedTokenIds: string[] = [];
    const wanted = balance > BigInt(Number.MAX_SAFE_INTEGER)
      ? Number.MAX_SAFE_INTEGER
      : Number(balance);
    for (let offset = 0; offset < candidateTokenIds.length; offset += 8) {
      const batch = candidateTokenIds.slice(offset, offset + 8);
      const owners = await Promise.all(
        batch.map((tokenId) =>
          app.chain
            .readRaw("ownerOf", [app.chain.arg.byteArray(encodeTokenId(tokenId))])
            .catch(() => null),
        ),
      );
      for (let index = 0; index < batch.length; index += 1) {
        if (hashValueMatches(owners[index], ownerHash)) ownedTokenIds.push(batch[index]!);
      }
      if (Number.isFinite(wanted) && wanted > 0 && ownedTokenIds.length >= wanted) {
        ownedTokenIds.splice(wanted);
        break;
      }
    }

    if (ownedTokenIds.length === 0) {
      certificates.set([]);
      certificatesSource.set("partial");
      return;
    }

    // Best-effort per-token detail reads: one unreadable token must not abort
    // the whole list, so settle every promise and keep the resolvable ones.
    const details = await mapWithConcurrency(ownedTokenIds, 8, (tokenId) =>
      app.chain
        .readRaw("getCertificateDetails", [
          app.chain.arg.byteArray(encodeTokenId(tokenId)),
        ])
        .catch(() => null),
    );
    const items: CertificateItem[] = [];
    for (const value of details) {
      const record = asRecord(value);
      const item = record ? certificateFromRecord(record) : null;
      if (item) items.push(item);
    }
    items.sort((a, b) => b.issuedTime - a.issuedTime);
    certificates.set(items);
    // `balanceOf` is exact. Only label this list authoritative when every held
    // token was found and decoded; bounded global scans otherwise stay visibly
    // partial instead of presenting a false empty/complete chain result.
    certificatesSource.set(items.length === wanted ? "chain" : "partial");
  };

  const loadTemplatesFromChain = async (issuer: string) => {
    await requireCanonicalChainContext();
    const issuerArg = app.chain.arg.hash160(issuer);
    const rawCount = await app.chain.readRaw("getIssuerTemplateCount", [issuerArg]);
    if (!/^\d+$/.test(stringValue(rawCount))) {
      throw new Error(t("loadFailed"));
    }
    const totalCount = parseBigInt(rawCount);
    const boundedCount = totalCount > BigInt(TEMPLATE_LIST_LIMIT)
      ? TEMPLATE_LIST_LIMIT
      : Math.max(0, Number(totalCount));
    const ids: unknown[] = [];

    while (ids.length < boundedCount) {
      const requested = Math.min(TEMPLATE_PAGE_SIZE, boundedCount - ids.length);
      const rawPage = await app.chain.readRaw("getIssuerTemplates", [
        issuerArg,
        app.chain.arg.integer(String(ids.length)),
        app.chain.arg.integer(String(requested)),
      ]);
      const page = Array.isArray(rawPage) ? rawPage : [];
      ids.push(...page.slice(0, requested));
      // A short page contradicts the authoritative count. Preserve the chain
      // items we did receive, but never label the list complete.
      if (page.length < requested) break;
    }

    const details = await mapWithConcurrency(ids, 8, (id) =>
      app.chain.readRaw("getTemplateDetails", [
        app.chain.arg.integer(stringValue(id)),
      ]).catch(() => null),
    );
    const items = details
      .map(asRecord)
      .map((record) => (record ? templateFromRecord(record) : null))
      .filter((item): item is TemplateItem => Boolean(item));
    templates.set(items);
    const complete = totalCount <= BigInt(TEMPLATE_LIST_LIMIT)
      && ids.length === Number(totalCount)
      && items.length === ids.length;
    templatesSource.set(complete ? "chain" : "partial");
  };

  const refreshTemplates = async () => {
    isRefreshing.set(true);
    lastError.set("");
    if (!pendingOperation.get()) lastNotice.set("");
    const issuer = normalizeHash160(connectedAddress());
    try {
      if (issuer) {
        await loadTemplatesFromChain(issuer);
      } else {
        await loadTemplatesFromStorage().catch(() => {
          templates.set([]);
          templatesSource.set("none");
        });
      }
    } catch (error) {
      await loadTemplatesFromStorage().catch(() => {
        templates.set([]);
        templatesSource.set("none");
      });
      if (issuer && templatesSource.get() === "cache" && !pendingOperation.get()) {
        lastNotice.set(t("cachedDataNotice"));
      } else if (issuer) {
        templates.set([]);
        templatesSource.set("failed");
        setFailure(error, "loadFailed");
      }
    } finally {
      isRefreshing.set(false);
    }
  };

  const refreshCertificates = async () => {
    isRefreshingCertificates.set(true);
    lastError.set("");
    if (!pendingOperation.get()) lastNotice.set("");
    const owner = normalizeHash160(connectedAddress());
    try {
      if (owner) {
        // Prefer an on-chain read so the issuer/recipient can see their own
        // certificates without depending on the indexer-populated storage
        // namespace; fall back to storage when the chain path is unavailable.
        try {
          await loadCertificatesFromChain(owner);
        } catch (error) {
          await loadCertificatesFromStorage().catch(() => {
            certificates.set([]);
            certificatesSource.set("none");
          });
          if (certificatesSource.get() === "cache") {
            if (!pendingOperation.get()) lastNotice.set(t("cachedDataNotice"));
          } else {
            certificates.set([]);
            certificatesSource.set("failed");
            setFailure(error, "certificateLoadFailed");
          }
        }
      } else {
        await loadCertificatesFromStorage().catch(() => {
          certificates.set([]);
          certificatesSource.set("none");
        });
      }
    } catch (error) {
      certificates.set([]);
      certificatesSource.set(owner ? "failed" : "none");
      if (owner) setFailure(error, "certificateLoadFailed");
    } finally {
      isRefreshingCertificates.set(false);
    }
  };

  const connectWallet = async () => {
    if (isConnecting.get()) return;
    isConnecting.set(true);
    try {
      const wallet = await app.chain.ensureWallet();
      address.set(wallet);
      lastSuccess.set(t("walletConnected"));
      await Promise.all([refreshTemplates(), refreshCertificates()]);
    } catch (error) {
      setFailure(error, "walletConnectionFailed");
      throw error;
    } finally {
      isConnecting.set(false);
    }
  };

  const readTemplateRecord = async (templateId: string) =>
    asRecord(
      await app.chain.readRaw("getTemplateDetails", [
        app.chain.arg.integer(templateId),
      ]),
    );

  const readCertificateRecord = async (tokenId: string) =>
    asRecord(
      await app.chain.readRaw("getCertificateDetails", [
        app.chain.arg.byteArray(encodeTokenId(tokenId)),
      ]),
    );

  const requireTemplateForIssuer = async (templateId: string, issuer: string) => {
    const record = await readTemplateRecord(templateId);
    const item = record ? templateFromRecord(record) : null;
    if (!item || item.id !== templateId) throw new Error(t("templateNotFound"));
    if (!hashValueMatches(record?.issuer, issuer)) throw new Error(t("issuerMismatch"));
    return item;
  };

  const pendingContextMatches = async (pending: PendingCertificateOperation) => {
    try {
      const current = await requireCanonicalChainContext();
      const pendingLane = explicitNeoNetwork(pending.network);
      const currentLane = explicitNeoNetwork(current.network);
      const currentIssuer = normalizeHash160(connectedAddress());
      return Boolean(
        pendingLane &&
        currentLane &&
        pendingLane === currentLane &&
        pending.contractHash.toLowerCase() === current.contractHash.toLowerCase() &&
        currentIssuer &&
        currentIssuer === pending.issuer.toLowerCase(),
      );
    } catch {
      return false;
    }
  };

  const confirmPendingReadback = async (
    pending: PendingCertificateOperation,
    event: unknown,
  ): Promise<boolean> => {
    if (!event) return false;

    if (pending.kind === "create-template") {
      const templateId = stringValue(eventValue(event, 0));
      if (!isPositiveTemplateId(templateId)) return false;
      if (!hashValueMatches(eventValue(event, 1), pending.issuer)) return false;
      if (pending.templateName && stringValue(eventValue(event, 2)) !== pending.templateName) return false;
      const record = await readTemplateRecord(templateId);
      const item = record ? templateFromRecord(record) : null;
      if (!item || item.id !== templateId) return false;
      if (!hashValueMatches(record?.issuer, pending.issuer)) return false;
      if (pending.templateName && item.name !== pending.templateName) return false;
      // Version-2 receipts bind every submitted template field. Version 1 is
      // retained only as a compatibility lane for transactions already pending
      // before this release.
      if (
        pending.version === 2 && (
          item.issuerName !== pending.templateIssuerName ||
          item.category !== pending.templateCategory ||
          item.maxSupply !== BigInt(String(pending.templateMaxSupply)) ||
          item.description !== stringValue(pending.templateDescription)
        )
      ) return false;
      writePendingOperation({ ...pending, templateId });
      return true;
    }

    if (pending.kind === "issue-certificate") {
      const tokenId = stringValue(eventValue(event, 0));
      const templateId = stringValue(eventValue(event, 1));
      if (!tokenId || templateId !== pending.templateId) return false;
      if (!hashValueMatches(eventValue(event, 2), pending.recipient)) return false;
      writePendingOperation({ ...pending, tokenId });
      const record = await readCertificateRecord(tokenId);
      const cert = record ? certificateFromRecord(record) : null;
      return Boolean(
        cert &&
        cert.tokenId === tokenId &&
        cert.templateId === pending.templateId &&
        hashValueMatches(record?.owner, pending.recipient) &&
        (pending.version === 1 || (
          cert.recipientName === pending.recipientName &&
          cert.achievement === pending.achievement &&
          cert.memo === pending.memo
        )),
      );
    }

    if (pending.kind === "update-template") {
      if (stringValue(eventValue(event, 0)) !== pending.templateId) return false;
      const record = await readTemplateRecord(String(pending.templateId));
      const item = record ? templateFromRecord(record) : null;
      return Boolean(
        item &&
        item.id === pending.templateId &&
        hashValueMatches(record?.issuer, pending.issuer) &&
        item.name === pending.templateName &&
        item.issuerName === pending.templateIssuerName &&
        item.category === pending.templateCategory &&
        item.maxSupply === BigInt(String(pending.templateMaxSupply)) &&
        item.description === stringValue(pending.templateDescription),
      );
    }

    if (pending.kind === "toggle-template") {
      if (stringValue(eventValue(event, 0)) !== pending.templateId) return false;
      const record = await readTemplateRecord(String(pending.templateId));
      return Boolean(
        record &&
        stringValue(record.id ?? record.templateId) === pending.templateId &&
        parseBool(record.active) === pending.targetActive &&
        hashValueMatches(record.issuer, pending.issuer),
      );
    }

    if (!pending.tokenId) return false;
    const eventTokenId = stringValue(eventValue(event, 0));
    const eventTemplateId = stringValue(eventValue(event, 1));
    if (
      eventTokenId !== pending.tokenId ||
      eventTemplateId !== pending.templateId ||
      !hashValueMatches(eventValue(event, 2), pending.issuer)
    ) return false;
    const record = await readCertificateRecord(pending.tokenId);
    const cert = record ? certificateFromRecord(record) : null;
    if (
      !cert ||
      cert.tokenId !== pending.tokenId ||
      cert.templateId !== pending.templateId ||
      !cert.revoked
    ) return false;
    const template = await readTemplateRecord(cert.templateId);
    return Boolean(template && hashValueMatches(template.issuer, pending.issuer));
  };

  const successKeyForPending = (kind: PendingCertificateKind) => {
    if (kind === "create-template") return "templateCreated";
    if (kind === "update-template") return "templateUpdated";
    if (kind === "issue-certificate") return "issuedSuccess";
    if (kind === "toggle-template") return "templateUpdated";
    return "revokeSuccess";
  };

  const finalizePending = async (
    pending: PendingCertificateOperation,
    event: unknown,
  ): Promise<boolean> => {
    try {
      if (!(await confirmPendingReadback(pending, event))) {
        setPendingNotice("pendingReadback");
        return false;
      }
      const resolved = pendingOperation.get() ?? pending;
      writePendingOperation(null);
      if (resolved.kind === "issue-certificate" && resolved.tokenId) {
        await verifyCertificate({ tokenId: resolved.tokenId }).catch(() => undefined);
      }
      if (resolved.kind === "revoke-certificate" && resolved.tokenId) {
        await verifyCertificate({ tokenId: resolved.tokenId }).catch(() => undefined);
      }
      if (resolved.kind === "create-template" || resolved.kind === "update-template" || resolved.kind === "toggle-template" || resolved.kind === "issue-certificate") {
        await refreshTemplates();
      }
      if (resolved.kind === "issue-certificate" || resolved.kind === "revoke-certificate") {
        await refreshCertificates();
      }
      setSuccess(successKeyForPending(resolved.kind), { txid: resolved.txid });
      if (resolved.kind === "create-template") {
        badgeService.award("certificate-issuer", "").catch(() => {});
      }
      return true;
    } catch {
      setPendingNotice("pendingReadback");
      return false;
    }
  };

  const recoverPendingOperation = async (
    timeoutMs = 30_000,
    allowExpiry = true,
    reconcileVmState = true,
  ) => {
    const pending = pendingOperation.get();
    if (!pending || isRecovering.get()) return false;
    isRecovering.set(true);
    try {
      if (!(await pendingContextMatches(pending))) {
        setPendingNotice("pendingContextMismatch");
        return false;
      }
      let event: unknown = null;
      try {
        event = await app.events.waitFor(pending.txid, pending.eventName, timeoutMs);
      } catch {
        // Event-index transport failures still fall through to the authoritative
        // application log reader; the receipt remains durable if both lag.
      }
      if (!event) {
        let outcome: CertificateTransactionOutcome = { state: "unknown", event: null };
        if (reconcileVmState) {
          try {
            outcome = await transactionOutcomeReader(
              pending.network,
              pending.txid,
              pending.eventName,
              pending.contractHash,
            );
          } catch {
            // A transient RPC failure is unknown, never failure or success.
          }
        }
        if (outcome.event) {
          return await finalizePending(pending, outcome.event);
        }
        if (outcome.state === "fault") {
          writePendingOperation(null);
          lastSuccess.set("");
          lastNotice.set("");
          lastError.set(t("transactionFaulted"));
          lastTxid.set(pending.txid);
          return false;
        }
        if (outcome.state === "halt") {
          setPendingNotice("pendingEventMissing");
          return false;
        }
        if (
          allowExpiry &&
          Date.now() - pending.createdAt >= PENDING_CERTIFICATE_STALE_MS
        ) {
          // Time alone cannot prove that a transaction failed. Keep the exact
          // receipt locked and give the user long-running recovery guidance;
          // only a mined FAULT or exact event + readback may release it.
          setPendingNotice("pendingLongRunning");
          return false;
        }
        setPendingNotice("transactionPending");
        return false;
      }
      return await finalizePending(pending, event);
    } catch (error) {
      // Recovery is a read/reconcile action. Transport or storage faults must
      // leave the durable lock intact and return control to the UI instead of
      // becoming an unhandled action rejection.
      lastSuccess.set("");
      lastNotice.set("");
      lastError.set(formatErrorMessage(error, t("pendingRecoveryFailed")));
      lastTxid.set(pending.txid);
      return false;
    } finally {
      isRecovering.set(false);
    }
  };

  const createTemplate = async (form: Partial<CreateTemplateForm>) => {
    if (isCreatingTemplate.get()) return null;
    assertNoPendingWrite();
    const next = normalizeTemplateForm(form);
    if (!next.name) throw new Error(t("nameRequired"));
    if (!next.issuerName) throw new Error(t("issuerNameRequired"));
    if (!next.category) throw new Error(t("categoryRequired"));
    assertTextLimit(next.name, CERTIFICATE_LIMITS.templateName, "templateNameTooLong", t);
    assertTextLimit(next.issuerName, CERTIFICATE_LIMITS.issuerName, "issuerNameTooLong", t);
    assertTextLimit(next.category, CERTIFICATE_LIMITS.category, "categoryTooLong", t);
    assertTextLimit(next.description, CERTIFICATE_LIMITS.description, "descriptionTooLong", t);
    if (!Number.isInteger(next.maxSupply) || next.maxSupply <= 0 || next.maxSupply > 100000) {
      throw new Error(t("invalidSupply"));
    }
    isCreatingTemplate.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const pendingDraft = await preparePending(
        "create-template",
        "TemplateCreated",
        issuer,
        {
          templateName: next.name,
          templateIssuerName: next.issuerName,
          templateCategory: next.category,
          templateMaxSupply: String(next.maxSupply),
          templateDescription: next.description,
        },
      );
      const result = await app.chain.invoke(
        "createTemplate",
        [
          app.chain.arg.hash160(issuer),
          app.chain.arg.string(next.name),
          app.chain.arg.string(next.issuerName),
          app.chain.arg.string(next.category),
          app.chain.arg.integer(next.maxSupply),
          app.chain.arg.string(next.description),
        ],
        {
          waitForEvent: "TemplateCreated",
          waitTimeoutMs: 30_000,
          onTransactionSent: (txid) => persistBroadcast(pendingDraft, txid),
        },
      );
      const pending = requirePendingReceipt(pendingDraft, result);
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
      } else {
        setPendingNotice();
      }
      return result;
    } catch (error) {
      if (pendingOperation.get()) {
        setPendingNotice();
        return null;
      }
      setFailure(error, "createTemplateFailed");
      throw error;
    } finally {
      isCreatingTemplate.set(false);
    }
  };

  const updateTemplate = async (form: Partial<UpdateTemplateForm>) => {
    if (isUpdatingTemplate.get()) return null;
    assertNoPendingWrite();
    const templateId = stringValue(form.templateId);
    const next = normalizeTemplateForm(form);
    if (!isPositiveTemplateId(templateId)) throw new Error(t("invalidTemplateId"));
    if (!next.name) throw new Error(t("nameRequired"));
    if (!next.issuerName) throw new Error(t("issuerNameRequired"));
    if (!next.category) throw new Error(t("categoryRequired"));
    assertTextLimit(next.name, CERTIFICATE_LIMITS.templateName, "templateNameTooLong", t);
    assertTextLimit(next.issuerName, CERTIFICATE_LIMITS.issuerName, "issuerNameTooLong", t);
    assertTextLimit(next.category, CERTIFICATE_LIMITS.category, "categoryTooLong", t);
    assertTextLimit(next.description, CERTIFICATE_LIMITS.description, "descriptionTooLong", t);
    if (!Number.isInteger(next.maxSupply) || next.maxSupply <= 0 || next.maxSupply > 100000) {
      throw new Error(t("invalidSupply"));
    }

    isUpdatingTemplate.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const current = await requireTemplateForIssuer(templateId, issuer);
      if (BigInt(next.maxSupply) < current.issued) throw new Error(t("supplyBelowIssued"));
      if (
        current.name === next.name &&
        current.issuerName === next.issuerName &&
        current.category === next.category &&
        current.maxSupply === BigInt(next.maxSupply) &&
        current.description === next.description
      ) {
        throw new Error(t("templateUnchanged"));
      }
      const pendingDraft = await preparePending(
        "update-template",
        "TemplateUpdated",
        issuer,
        {
          templateId,
          templateName: next.name,
          templateIssuerName: next.issuerName,
          templateCategory: next.category,
          templateMaxSupply: String(next.maxSupply),
          templateDescription: next.description,
        },
      );
      const result = await app.chain.invoke(
        "updateTemplate",
        [
          app.chain.arg.hash160(issuer),
          app.chain.arg.integer(templateId),
          app.chain.arg.string(next.name),
          app.chain.arg.string(next.issuerName),
          app.chain.arg.string(next.category),
          app.chain.arg.integer(next.maxSupply),
          app.chain.arg.string(next.description),
        ],
        {
          waitForEvent: "TemplateUpdated",
          waitTimeoutMs: 30_000,
          onTransactionSent: (txid) => persistBroadcast(pendingDraft, txid),
        },
      );
      const pending = requirePendingReceipt(pendingDraft, result);
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
      } else {
        setPendingNotice();
      }
      return result;
    } catch (error) {
      if (pendingOperation.get()) {
        setPendingNotice();
        return null;
      }
      setFailure(error, "templateUpdateFailed");
      throw error;
    } finally {
      isUpdatingTemplate.set(false);
    }
  };

  const issueCertificate = async (form: Partial<IssueCertificateForm>) => {
    if (isIssuing.get()) return null;
    assertNoPendingWrite();
    const next = normalizeIssueForm(form);
    if (!isPositiveTemplateId(next.templateId)) throw new Error(t("invalidTemplateId"));
    const recipient = normalizeHash160(next.recipient);
    if (!recipient) throw new Error(t("invalidRecipient"));
    if (!next.recipientName) throw new Error(t("recipientNameRequired"));
    if (!next.achievement) throw new Error(t("achievementRequired"));
    assertTextLimit(next.recipientName, CERTIFICATE_LIMITS.recipientName, "recipientNameTooLong", t);
    assertTextLimit(next.achievement, CERTIFICATE_LIMITS.achievement, "achievementTooLong", t);
    assertTextLimit(next.memo, CERTIFICATE_LIMITS.memo, "memoTooLong", t);
    isIssuing.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const template = await requireTemplateForIssuer(next.templateId, issuer);
      if (!template.active) throw new Error(t("templateInactive"));
      if (template.issued >= template.maxSupply) throw new Error(t("soldOut"));
      const pendingDraft = await preparePending(
        "issue-certificate",
        "CertificateIssued",
        issuer,
        {
          templateId: next.templateId,
          recipient,
          recipientName: next.recipientName,
          achievement: next.achievement,
          memo: next.memo,
        },
      );
      const result = await app.chain.invoke(
        "issueCertificate",
        [
          app.chain.arg.hash160(issuer),
          app.chain.arg.hash160(recipient),
          app.chain.arg.integer(next.templateId),
          app.chain.arg.string(next.recipientName),
          app.chain.arg.string(next.achievement),
          app.chain.arg.string(next.memo),
        ],
        {
          waitForEvent: "CertificateIssued",
          waitTimeoutMs: 30_000,
          onTransactionSent: (txid) => persistBroadcast(pendingDraft, txid),
        },
      );
      const pending = requirePendingReceipt(pendingDraft, result);
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
      } else {
        setPendingNotice();
      }
      return result;
    } catch (error) {
      if (pendingOperation.get()) {
        setPendingNotice();
        return null;
      }
      setFailure(error, "issueFailed");
      throw error;
    } finally {
      isIssuing.set(false);
    }
  };

  const toggleTemplate = async (template: unknown) => {
    const tpl = template as TemplateItem;
    if (!tpl?.id || togglingId.get()) return null;
    assertNoPendingWrite();
    if (!isPositiveTemplateId(tpl.id)) throw new Error(t("invalidTemplateId"));
    togglingId.set(tpl.id);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const authoritative = await requireTemplateForIssuer(tpl.id, issuer);
      const targetActive = !authoritative.active;
      const pendingDraft = await preparePending(
        "toggle-template",
        "TemplateUpdated",
        issuer,
        { templateId: tpl.id, targetActive },
      );
      const result = await app.chain.invoke(
        "setTemplateActive",
        [
          app.chain.arg.hash160(issuer),
          app.chain.arg.integer(tpl.id),
          app.chain.arg.boolean(targetActive),
        ],
        {
          waitForEvent: "TemplateUpdated",
          waitTimeoutMs: 30_000,
          onTransactionSent: (txid) => persistBroadcast(pendingDraft, txid),
        },
      );
      const pending = requirePendingReceipt(pendingDraft, result);
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
      } else {
        setPendingNotice();
      }
      return result;
    } catch (error) {
      if (pendingOperation.get()) {
        setPendingNotice();
        return null;
      }
      setFailure(error, "templateUpdateFailed");
      throw error;
    } finally {
      togglingId.set(null);
    }
  };

  /**
   * Whether the connected wallet issued the certificate's template. The on-chain
   * issuer field arrives in any of several shapes (display 0x hash, raw LE hash,
   * base58 address), so normalize both sides to the 0x display form before
   * comparing. Returns false when the wallet is disconnected or the template
   * issuer can't be resolved (fail closed — never offer an action that reverts).
   */
  const resolveIsIssuer = async (cert: CertificateItem): Promise<boolean> => {
    const me = normalizeHash160(connectedAddress());
    if (!me || !cert.templateId) return false;
    // The template's `issuer` arrives as a raw stack item (a ByteString that
    // parseStackItem renders as little-endian "0x<hex>"), so normalize it to the
    // 0x display form with parseHash160 (which reverses to big-endian) before
    // comparing — normalizeHash160 would keep the little-endian bytes and never
    // match the connected address.
    const record = asRecord(
      await app.chain
        .readRaw("getTemplateDetails", [app.chain.arg.integer(cert.templateId)])
        .catch(() => null),
    );
    return Boolean(record && hashValueMatches(record.issuer, me));
  };

  const verifyCertificate = async (form: Partial<VerifyCertificateForm> | string) => {
    if (isVerifying.get()) return null;
    const tokenId =
      typeof form === "string" ? stringValue(form) : stringValue(form.tokenId);
    if (!isValidCertificateTokenId(tokenId)) throw new Error(t("invalidTokenId"));
    isVerifying.set(true);
    lastError.set("");
    try {
      await requireCanonicalChainContext();
      const details = await app.chain.readRaw("getCertificateDetails", [
        app.chain.arg.byteArray(encodeTokenId(tokenId)),
      ]);
      const record = asRecord(details);
      const cert = record ? certificateFromRecord(record) : null;
      if (!cert || cert.tokenId !== tokenId) throw new Error(t("certificateNotFound"));
      const [owner, templateRecord] = await Promise.all([
        app.chain.readRaw("ownerOf", [
          app.chain.arg.byteArray(encodeTokenId(tokenId)),
        ]),
        readTemplateRecord(cert.templateId),
      ]);
      const template = templateRecord ? templateFromRecord(templateRecord) : null;
      if (
        !template ||
        template.id !== cert.templateId ||
        !hashValueMatches(owner, record?.owner)
      ) {
        throw new Error(t("certificateNotFound"));
      }
      verifiedCertificate.set(cert);
      if (!pendingOperation.get()) lastTxid.set("");
      // Resolve whether the connected wallet is the template issuer so only it
      // sees the Revoke action (the contract rejects everyone else).
      verifiedIsIssuer.set(await resolveIsIssuer(cert));
      // Reflect the actual revocation status in the status strip so a verifier
      // is never told a revoked credential is "Valid" while the detail card
      // simultaneously renders a red "Revoked" badge.
      if (pendingOperation.get()) {
        setPendingNotice();
      } else {
        lastNotice.set("");
        lastSuccess.set(t(cert.revoked ? "certificateRevoked" : "certificateValid"));
      }
      return cert;
    } catch (error) {
      verifiedCertificate.set(null);
      verifiedIsIssuer.set(false);
      setFailure(error, "verifyFailed");
      throw error;
    } finally {
      isVerifying.set(false);
    }
  };

  const revokeCertificate = async (form: Partial<RevokeCertificateForm> | string) => {
    if (isRevoking.get()) return null;
    assertNoPendingWrite();
    const tokenId =
      typeof form === "string" ? stringValue(form) : stringValue(form.tokenId);
    if (!isValidCertificateTokenId(tokenId)) throw new Error(t("invalidTokenId"));
    isRevoking.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const certRecord = await readCertificateRecord(tokenId);
      const cert = certRecord ? certificateFromRecord(certRecord) : null;
      if (!cert || cert.tokenId !== tokenId) throw new Error(t("certificateNotFound"));
      if (cert.revoked) throw new Error(t("alreadyRevoked"));
      if (!isPositiveTemplateId(cert.templateId)) throw new Error(t("templateNotFound"));
      await requireTemplateForIssuer(cert.templateId, issuer);
      const pendingDraft = await preparePending(
        "revoke-certificate",
        "CertificateRevoked",
        issuer,
        { templateId: cert.templateId, tokenId },
      );
      const result = await app.chain.invoke(
        "revokeCertificate",
        [
          app.chain.arg.hash160(issuer),
          app.chain.arg.byteArray(encodeTokenId(tokenId)),
        ],
        {
          waitForEvent: "CertificateRevoked",
          waitTimeoutMs: 30_000,
          onTransactionSent: (txid) => persistBroadcast(pendingDraft, txid),
        },
      );
      const pending = requirePendingReceipt(pendingDraft, result);
      if (result.verified === true && result.event && pending) {
        await finalizePending(pending, result.event);
      } else {
        setPendingNotice();
      }
      return result;
    } catch (error) {
      if (pendingOperation.get()) {
        setPendingNotice();
        return null;
      }
      setFailure(error, "revokeFailed");
      throw error;
    } finally {
      isRevoking.set(false);
    }
  };

  // Issuer-side shortcut: copy a link that reopens the Issue panel preset to this
  // template. Only the template creator's wallet can sign IssueCertificate, so
  // this is framed as an issuing bookmark for the issuer, never a hand-off.
  const copyIssueLink = async (template: unknown) => {
    const tpl = template as { id: string };
    const url = buildCertificateIssueUrl(tpl.id);
    await clipboard.copy(url, { successKey: "issueLinkCopied" });
  };

  // Recipient-facing link: a permissionless verify deep-link (?verifyTokenId=…)
  // that opens the Verify panel prefilled. Unlike the issue link this is a real
  // hand-off — anyone can verify a certificate by token id — so it is the link
  // shared WITH a counterparty (the issue-only flow would revert for them).
  const buildVerifyLink = (tokenId: string) => buildCertificateVerifyUrl(tokenId);

  const copyVerifyLink = async (tokenId: unknown) => {
    const id = stringValue(tokenId);
    if (!id) return;
    await clipboard.copy(buildVerifyLink(id), { successKey: "verifyLinkCopied" });
  };

  const shareVerifyLink = async (tokenId: unknown) => {
    const id = stringValue(tokenId);
    if (!id) return;
    const url = buildVerifyLink(id);
    try {
      if (navigator.share) {
        await navigator.share({ title: t("verifyTab"), text: id, url });
        return;
      }
      await copyVerifyLink(id);
    } catch (error) {
      if (error instanceof Error && /abort|cancel/i.test(error.message)) return;
      await copyVerifyLink(id);
    }
  };

  const loadAll = async () => {
    isLoading.set(true);
    try {
      restorePendingOperation();
      // A credential verification is bound to one exact network + contract.
      // Lifecycle reloads (including host network changes) must discard that
      // proof before any new chain data is accepted.
      verifiedCertificate.set(null);
      verifiedIsIssuer.set(false);
      await Promise.all([refreshTemplates(), refreshCertificates()]);
      if (pendingOperation.get()) {
        setPendingNotice();
        await recoverPendingOperation(1_500, false, false);
      }
      if (templates.get().length > 0) {
        badgeService.award("certificate-issuer", "").catch(() => {});
      }
    } finally {
      isLoading.set(false);
    }
  };

  return {
    templates,
    certificates,
    templatesSource,
    certificatesSource,
    verifiedCertificate,
    verifiedIsIssuer,
    address,
    isRefreshing,
    isRefreshingCertificates,
    isConnecting,
    isCreatingTemplate,
    isUpdatingTemplate,
    isIssuing,
    isVerifying,
    isRevoking,
    isRecovering,
    togglingId,
    isLoading,
    lastTxid,
    lastError,
    lastSuccess,
    lastNotice,
    pendingOperation,
    recoveryStorageAvailable,
    deepLinkTemplateId,
    deepLinkAutoIssue,
    deepLinkVerifyTokenId,
    consumeDeepLink,
    consumeVerifyDeepLink,
    templatesCount,
    certificatesCount,
    activeTemplatesCount,
    refreshTemplates,
    refreshCertificates,
    connectWallet,
    createTemplate,
    updateTemplate,
    issueCertificate,
    toggleTemplate,
    verifyCertificate,
    revokeCertificate,
    copyIssueLink,
    copyVerifyLink,
    shareVerifyLink,
    recoverPendingOperation,
    refreshRecoveryStorage,
    loadAll,
  };
}

export type UseSoulboundReturn = ReturnType<typeof useSoulbound>;
