/**
 * useSoulbound - domain logic for the Soulbound Certificate miniapp.
 *
 * The app keeps OS storage as a read fallback, but write flows use the
 * dedicated MiniAppSoulboundCertificate contract so the frontend can issue,
 * activate/deactivate, verify, and revoke real NEP-11 soulbound certificates.
 */

import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ClipboardService } from "@shared/services";
import { buildMiniAppUrl } from "@shared/utils/miniapp-routes";
import { getLaunchParam, readMiniAppLaunchContext } from "@shared/utils/launch-params";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash, parseHash160 } from "@shared/utils/neo";
import { parseBigInt, parseBool, encodeTokenId } from "@shared/utils/parsers";
import type { CertificateItem, TemplateItem } from "../types";
import { formatErrorMessage } from "@shared/utils/errorHandling";

type ContractArg = {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean;
};

type TxResult = {
  txid?: string;
  event?: unknown;
};

type ChainLike = {
  address?: Observable<string | null> | Observable<string>;
  ensureWallet: () => Promise<string>;
  invoke: (
    operation: string,
    args: ContractArg[],
    options?: { waitForEvent?: string; waitTimeoutMs?: number; scriptHash?: string },
  ) => Promise<TxResult>;
  read: (
    operation: string,
    args?: ContractArg[],
    options?: { scriptHash?: string; cache?: boolean; cacheTtlMs?: number },
  ) => Promise<unknown>;
};

export interface CreateTemplateForm {
  name: string;
  issuerName: string;
  category: string;
  maxSupply: string;
  description: string;
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
  nftService: NFTProxy;
  storageService: StorageProxy;
  badgeService: BadgeProxy;
  clipboard: ClipboardService;
  eventBus: { emit: (event: string, payload?: unknown) => void };
  chain: ChainLike;
  t: (key: string, params?: Record<string, string | number>) => string;
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

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHash160(value: unknown): string {
  const raw = stringValue(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return raw;
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-fA-F]{40}$/.test(converted) ? converted : "";
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

function txidFrom(result: TxResult | null | undefined): string {
  return stringValue(result?.txid);
}

function templateFromRecord(record: Record<string, unknown>): TemplateItem | null {
  const id = stringValue(record.id ?? record.templateId);
  if (!id) return null;
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
  if (!tokenId) return null;
  return {
    tokenId,
    templateId: stringValue(record.templateId),
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
  nftService,
  storageService,
  badgeService,
  clipboard,
  eventBus,
  chain,
  t,
}: UseSoulboundOptions) {
  const templates = createObservable<TemplateItem[]>([]);
  const certificates = createObservable<CertificateItem[]>([]);
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
  const isIssuing = createObservable(false);
  const isVerifying = createObservable(false);
  const isRevoking = createObservable(false);
  const togglingId = createObservable<string | null>(null);
  const isLoading = createObservable(false);
  const lastTxid = createObservable("");
  const lastError = createObservable("");
  const lastSuccess = createObservable("");

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
    () => templates.get().filter((tpl) => tpl.active).length,
    [templates],
  );

  const connectedAddress = () =>
    stringValue(chain.address?.get?.()) || stringValue(address.get());

  const ensureIssuer = async () => {
    const wallet = await chain.ensureWallet();
    const issuer = normalizeHash160(wallet) || wallet;
    address.set(wallet);
    return issuer;
  };

  const setSuccess = (messageKey: string, result?: TxResult | null) => {
    lastError.set("");
    lastSuccess.set(t(messageKey));
    lastTxid.set(txidFrom(result));
  };

  const setFailure = (error: unknown, fallbackKey: string) => {
    lastSuccess.set("");
    lastTxid.set("");
    lastError.set(formatErrorMessage(error, t(fallbackKey)));
  };

  const loadTemplatesFromStorage = async () => {
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
  };

  const loadCertificatesFromStorage = async () => {
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
    const ownerHash = normalizeHash160(owner);
    if (!ownerHash) {
      certificates.set([]);
      return;
    }

    // Short-circuit: a wallet with no soulbound balance holds nothing to scan.
    const rawBalance = await chain.read("balanceOf", [
      { type: "Hash160", value: ownerHash },
    ]);
    const balance = parseBigInt(rawBalance);
    if (balance <= 0n) {
      certificates.set([]);
      return;
    }

    const totalTemplates = Number(
      parseBigInt(await chain.read("totalTemplates")),
    );
    const templateCount = Number.isFinite(totalTemplates)
      ? Math.min(totalTemplates, CERT_SCAN_TEMPLATE_LIMIT)
      : 0;
    if (templateCount <= 0) {
      certificates.set([]);
      return;
    }

    // Resolve every template's issued count so the serial range is known.
    const templateIds = Array.from({ length: templateCount }, (_v, i) => i + 1);
    const issuedCounts = await Promise.all(
      templateIds.map(async (templateId) => {
        const record = asRecord(
          await chain
            .read("getTemplateDetails", [{ type: "Integer", value: String(templateId) }])
            .catch(() => null),
        );
        const issued = record ? Number(parseBigInt(record.issued)) : 0;
        return { templateId, issued: Number.isFinite(issued) ? issued : 0 };
      }),
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
    const wanted = Number(balance);
    for (const tokenId of candidateTokenIds) {
      const rawOwner = await chain
        .read("ownerOf", [{ type: "ByteArray", value: encodeTokenId(tokenId) }])
        .catch(() => null);
      if (parseHash160(rawOwner) === ownerHash) {
        ownedTokenIds.push(tokenId);
        if (Number.isFinite(wanted) && wanted > 0 && ownedTokenIds.length >= wanted) {
          break;
        }
      }
    }

    if (ownedTokenIds.length === 0) {
      certificates.set([]);
      return;
    }

    // Best-effort per-token detail reads: one unreadable token must not abort
    // the whole list, so settle every promise and keep the resolvable ones.
    const settled = await Promise.allSettled(
      ownedTokenIds.map((tokenId) =>
        chain.read("getCertificateDetails", [
          { type: "ByteArray", value: encodeTokenId(tokenId) },
        ]),
      ),
    );
    const items: CertificateItem[] = [];
    for (const outcome of settled) {
      if (outcome.status !== "fulfilled") continue;
      const record = asRecord(outcome.value);
      const item = record ? certificateFromRecord(record) : null;
      if (item) items.push(item);
    }
    items.sort((a, b) => b.issuedTime - a.issuedTime);
    certificates.set(items);
  };

  const loadTemplatesFromChain = async (issuer: string) => {
    const rawIds = await chain.read("getIssuerTemplates", [
      { type: "Hash160", value: issuer },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "20" },
    ]);
    const ids = Array.isArray(rawIds) ? rawIds : [];
    const details = await Promise.all(
      ids.map((id) =>
        chain.read("getTemplateDetails", [
          { type: "Integer", value: stringValue(id) },
        ]),
      ),
    );
    const items = details
      .map(asRecord)
      .map((record) => (record ? templateFromRecord(record) : null))
      .filter((item): item is TemplateItem => Boolean(item));
    templates.set(items);
  };

  const refreshTemplates = async () => {
    isRefreshing.set(true);
    lastError.set("");
    const issuer = normalizeHash160(connectedAddress());
    try {
      if (issuer) {
        await loadTemplatesFromChain(issuer);
      } else {
        await loadTemplatesFromStorage().catch(() => templates.set([]));
      }
    } catch (error) {
      if (issuer) setFailure(error, "loadFailed");
      await loadTemplatesFromStorage().catch(() => templates.set([]));
    } finally {
      isRefreshing.set(false);
    }
  };

  const refreshCertificates = async () => {
    isRefreshingCertificates.set(true);
    const owner = normalizeHash160(connectedAddress());
    try {
      if (owner) {
        // Prefer an on-chain read so the issuer/recipient can see their own
        // certificates without depending on the indexer-populated storage
        // namespace; fall back to storage when the chain path is unavailable.
        await loadCertificatesFromChain(owner).catch(async () => {
          await loadCertificatesFromStorage().catch(() => certificates.set([]));
        });
      } else {
        await loadCertificatesFromStorage().catch(() => certificates.set([]));
      }
    } catch {
      certificates.set([]);
    } finally {
      isRefreshingCertificates.set(false);
    }
  };

  const connectWallet = async () => {
    if (isConnecting.get()) return;
    isConnecting.set(true);
    try {
      const wallet = await chain.ensureWallet();
      address.set(wallet);
      lastSuccess.set(t("walletConnected"));
      await Promise.all([refreshTemplates(), refreshCertificates()]);
    } finally {
      isConnecting.set(false);
    }
  };

  const createTemplate = async (form: Partial<CreateTemplateForm>) => {
    if (isCreatingTemplate.get()) return null;
    const next = normalizeTemplateForm(form);
    if (!next.name) throw new Error(t("nameRequired"));
    if (!next.issuerName) throw new Error(t("issuerNameRequired"));
    if (!next.category) throw new Error(t("categoryRequired"));
    if (!Number.isInteger(next.maxSupply) || next.maxSupply <= 0 || next.maxSupply > 100000) {
      throw new Error(t("invalidSupply"));
    }
    isCreatingTemplate.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const result = await chain.invoke(
        "createTemplate",
        [
          { type: "Hash160", value: issuer },
          { type: "String", value: next.name },
          { type: "String", value: next.issuerName },
          { type: "String", value: next.category },
          { type: "Integer", value: String(next.maxSupply) },
          { type: "String", value: next.description },
        ],
        { waitForEvent: "TemplateCreated", waitTimeoutMs: 30_000 },
      );
      setSuccess("templateCreated", result);
      await refreshTemplates();
      badgeService.award("certificate-issuer", "").catch(() => {});
      return result;
    } catch (error) {
      setFailure(error, "createTemplateFailed");
      throw error;
    } finally {
      isCreatingTemplate.set(false);
    }
  };

  const issueCertificate = async (form: Partial<IssueCertificateForm>) => {
    if (isIssuing.get()) return null;
    const next = normalizeIssueForm(form);
    if (!next.templateId) throw new Error(t("templateIdRequired"));
    const recipient = normalizeHash160(next.recipient);
    if (!recipient) throw new Error(t("invalidRecipient"));
    if (!next.recipientName) throw new Error(t("recipientNameRequired"));
    if (!next.achievement) throw new Error(t("achievementRequired"));
    isIssuing.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const result = await chain.invoke(
        "issueCertificate",
        [
          { type: "Hash160", value: issuer },
          { type: "Hash160", value: recipient },
          { type: "Integer", value: next.templateId },
          { type: "String", value: next.recipientName },
          { type: "String", value: next.achievement },
          { type: "String", value: next.memo },
        ],
        { waitForEvent: "CertificateIssued", waitTimeoutMs: 30_000 },
      );
      const tokenId = stringValue(eventValue(result.event, 0));
      if (tokenId) {
        await verifyCertificate({ tokenId }).catch(() => undefined);
      }
      setSuccess("issuedSuccess", result);
      await Promise.all([refreshTemplates(), refreshCertificates()]);
      return result;
    } catch (error) {
      setFailure(error, "issueFailed");
      throw error;
    } finally {
      isIssuing.set(false);
    }
  };

  const toggleTemplate = async (template: unknown) => {
    const tpl = template as TemplateItem;
    if (!tpl?.id || togglingId.get()) return null;
    togglingId.set(tpl.id);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const result = await chain.invoke(
        "setTemplateActive",
        [
          { type: "Hash160", value: issuer },
          { type: "Integer", value: tpl.id },
          { type: "Boolean", value: !tpl.active },
        ],
        { waitForEvent: "TemplateUpdated", waitTimeoutMs: 30_000 },
      );
      setSuccess("templateUpdated", result);
      await refreshTemplates();
      return result;
    } catch (error) {
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
    const template = templates.get().find((tpl) => tpl.id === cert.templateId);
    let issuerHash = template ? toDisplayHash(template.issuer) : "";
    if (!issuerHash) {
      const record = asRecord(
        await chain
          .read("getTemplateDetails", [{ type: "Integer", value: cert.templateId }])
          .catch(() => null),
      );
      issuerHash = record ? toDisplayHash(record.issuer) : "";
    }
    return Boolean(issuerHash) && issuerHash === me;
  };

  const verifyCertificate = async (form: Partial<VerifyCertificateForm> | string) => {
    if (isVerifying.get()) return null;
    const tokenId =
      typeof form === "string" ? stringValue(form) : stringValue(form.tokenId);
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isVerifying.set(true);
    lastError.set("");
    try {
      const details = await chain.read("getCertificateDetails", [
        { type: "ByteArray", value: encodeTokenId(tokenId) },
      ]);
      const record = asRecord(details);
      const cert = record ? certificateFromRecord(record) : null;
      if (!cert) throw new Error(t("certificateNotFound"));
      verifiedCertificate.set(cert);
      lastTxid.set("");
      // Resolve whether the connected wallet is the template issuer so only it
      // sees the Revoke action (the contract rejects everyone else).
      verifiedIsIssuer.set(await resolveIsIssuer(cert));
      // Reflect the actual revocation status in the status strip so a verifier
      // is never told a revoked credential is "Valid" while the detail card
      // simultaneously renders a red "Revoked" badge.
      lastSuccess.set(t(cert.revoked ? "certificateRevoked" : "certificateValid"));
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
    const tokenId =
      typeof form === "string" ? stringValue(form) : stringValue(form.tokenId);
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isRevoking.set(true);
    lastError.set("");
    try {
      const issuer = await ensureIssuer();
      const result = await chain.invoke(
        "revokeCertificate",
        [
          { type: "Hash160", value: issuer },
          { type: "ByteArray", value: encodeTokenId(tokenId) },
        ],
        { waitForEvent: "CertificateRevoked", waitTimeoutMs: 30_000 },
      );
      await verifyCertificate({ tokenId }).catch(() => undefined);
      await refreshCertificates();
      setSuccess("revokeSuccess", result);
      return result;
    } catch (error) {
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
    const url = buildMiniAppUrl("miniapp-soulbound-certificate", {
      issueTemplateId: tpl.id,
      autoIssueDraft: "1",
    });
    const ok = await clipboard.copy(url, "issueLinkCopied");
    if (ok) {
      eventBus.emit("soulbound:linkCopied", { action: t("issueLinkCopied") });
    }
  };

  // Recipient-facing link: a permissionless verify deep-link (?verifyTokenId=…)
  // that opens the Verify panel prefilled. Unlike the issue link this is a real
  // hand-off — anyone can verify a certificate by token id — so it is the link
  // shared WITH a counterparty (the issue-only flow would revert for them).
  const buildVerifyLink = (tokenId: string) =>
    buildMiniAppUrl("miniapp-soulbound-certificate", {
      verifyTokenId: tokenId,
    });

  const copyVerifyLink = async (tokenId: unknown) => {
    const id = stringValue(tokenId);
    if (!id) return;
    const ok = await clipboard.copy(buildVerifyLink(id), "verifyLinkCopied");
    if (ok) {
      eventBus.emit("soulbound:verifyLinkCopied", {
        action: t("verifyLinkCopied"),
      });
    }
  };

  const shareVerifyLink = async (tokenId: unknown) => {
    const id = stringValue(tokenId);
    if (!id) return;
    const url = buildVerifyLink(id);
    try {
      if (navigator.share) {
        await navigator.share({ title: t("verifyTab"), text: id, url });
        eventBus.emit("soulbound:verifyLinkShared", {
          action: t("verifyLinkShared"),
        });
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
      await Promise.all([refreshTemplates(), refreshCertificates()]);
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
    verifiedCertificate,
    verifiedIsIssuer,
    address,
    isRefreshing,
    isRefreshingCertificates,
    isConnecting,
    isCreatingTemplate,
    isIssuing,
    isVerifying,
    isRevoking,
    togglingId,
    isLoading,
    lastTxid,
    lastError,
    lastSuccess,
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
    issueCertificate,
    toggleTemplate,
    verifyCertificate,
    revokeCertificate,
    copyIssueLink,
    copyVerifyLink,
    shareVerifyLink,
    loadAll,
  };
}

export type UseSoulboundReturn = ReturnType<typeof useSoulbound>;
