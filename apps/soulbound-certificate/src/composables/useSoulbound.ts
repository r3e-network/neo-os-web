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
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import type { CertificateItem, TemplateItem } from "../types";

type ContractArg = {
  type: string;
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
    options?: { waitForEvent?: string; waitTimeoutMs?: number },
  ) => Promise<TxResult>;
  read: (
    operation: string,
    args?: ContractArg[],
    options?: unknown,
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

function txidFrom(result: TxResult | null | undefined): string {
  return stringValue(result?.txid);
}

function eventValue(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (!Array.isArray(state)) return undefined;
  const item = state[index];
  if (item && typeof item === "object" && "value" in item) {
    return (item as { value?: unknown }).value;
  }
  return item;
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
  const isRefreshing = createObservable(false);
  const isRefreshingCertificates = createObservable(false);
  const isCreatingTemplate = createObservable(false);
  const isIssuing = createObservable(false);
  const isVerifying = createObservable(false);
  const isRevoking = createObservable(false);
  const togglingId = createObservable<string | null>(null);
  const isLoading = createObservable(false);
  const lastTxid = createObservable("");
  const lastError = createObservable("");
  const lastSuccess = createObservable("");

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
    lastError.set(error instanceof Error ? error.message : t(fallbackKey));
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
    try {
      await loadCertificatesFromStorage();
    } catch {
      certificates.set([]);
    } finally {
      isRefreshingCertificates.set(false);
    }
  };

  const connectWallet = async () => {
    const wallet = await chain.ensureWallet();
    address.set(wallet);
    lastSuccess.set(t("walletConnected"));
    await Promise.all([refreshTemplates(), refreshCertificates()]);
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

  const verifyCertificate = async (form: Partial<VerifyCertificateForm> | string) => {
    if (isVerifying.get()) return null;
    const tokenId =
      typeof form === "string" ? stringValue(form) : stringValue(form.tokenId);
    if (!tokenId) throw new Error(t("invalidTokenId"));
    isVerifying.set(true);
    lastError.set("");
    try {
      const details = await chain.read("getCertificateDetails", [
        { type: "ByteArray", value: tokenId },
      ]);
      const record = asRecord(details);
      const cert = record ? certificateFromRecord(record) : null;
      if (!cert) throw new Error(t("certificateNotFound"));
      verifiedCertificate.set(cert);
      lastTxid.set("");
      lastSuccess.set(t("certificateValid"));
      return cert;
    } catch (error) {
      verifiedCertificate.set(null);
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
          { type: "ByteArray", value: tokenId },
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

  const openIssueModal = (template: unknown) => {
    eventBus.emit("soulbound:selectTemplate", template);
  };

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

  const shareIssueLink = async (template: unknown) => {
    const tpl = template as { id: string };
    try {
      const url = buildMiniAppUrl("miniapp-soulbound-certificate", {
        issueTemplateId: tpl.id,
        autoIssueDraft: "1",
      });
      if (navigator.share) {
        await navigator.share({
          title: t("issueCertificate"),
          text: tpl.id,
          url,
        });
        eventBus.emit("soulbound:linkShared", {
          action: t("issueLinkShared"),
        });
        return;
      }
      await copyIssueLink(template);
    } catch (error) {
      if (error instanceof Error && /abort|cancel/i.test(error.message)) return;
      await copyIssueLink(template);
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
    address,
    isRefreshing,
    isRefreshingCertificates,
    isCreatingTemplate,
    isIssuing,
    isVerifying,
    isRevoking,
    togglingId,
    isLoading,
    lastTxid,
    lastError,
    lastSuccess,
    templatesCount,
    certificatesCount,
    activeTemplatesCount,
    refreshTemplates,
    refreshCertificates,
    connectWallet,
    createTemplate,
    issueCertificate,
    openIssueModal,
    toggleTemplate,
    verifyCertificate,
    revokeCertificate,
    copyIssueLink,
    shareIssueLink,
    loadAll,
  };
}

export type UseSoulboundReturn = ReturnType<typeof useSoulbound>;
