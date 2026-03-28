/**
 * useSoulbound — Domain logic for the Soulbound Certificate miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { buildMiniAppLaunchUrl } from "@shared/utils/miniapp-routes";
import type { TemplateItem, CertificateItem } from "../types";

export interface UseSoulboundOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useSoulbound({ chain, eventBus, t }: UseSoulboundOptions) {
  const templates = ref<TemplateItem[]>([]);
  const certificates = ref<CertificateItem[]>([]);
  const isRefreshing = ref(false);
  const isRefreshingCertificates = ref(false);
  const togglingId = ref<string | null>(null);
  const isLoading = ref(false);

  const address = chain.address;
  const templatesCount = computed(() => templates.value.length);
  const certificatesCount = computed(() => certificates.value.length);
  const activeTemplatesCount = computed(() => templates.value.filter((tpl) => tpl.active).length);

  const parseBigInt = (value: unknown) => { try { return BigInt(String(value ?? "0")); } catch { return 0n; } };
  const parseBool = (value: unknown) => value === true || value === "true" || value === 1 || value === "1";

  const parseTemplate = (raw: Record<string, unknown>, id: string): TemplateItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id, issuer: String(raw.issuer || ""), name: String(raw.name || ""), issuerName: String(raw.issuerName || ""),
      category: String(raw.category || ""), maxSupply: parseBigInt(raw.maxSupply), issued: parseBigInt(raw.issued),
      description: String(raw.description || ""), active: parseBool(raw.active),
    };
  };

  const refreshTemplates = async () => {
    if (!chain.address.value) return;
    isRefreshing.value = true;
    try {
      const ids = await chain.readArray("GetIssuerTemplates", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "20" },
      ]);
      const validIds = (Array.isArray(ids) ? ids : []).map((v) => String(v || "")).filter(Boolean);
      const details = await Promise.all(validIds.map(async (id) => {
        const detail = await chain.read("GetTemplateDetails", [{ type: "Integer", value: id }]);
        if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
        return parseTemplate(detail as Record<string, unknown>, id);
      }));
      templates.value = details.filter(Boolean) as TemplateItem[];
    } catch (_e) {
      templates.value = [];
    } finally {
      isRefreshing.value = false;
    }
  };

  const refreshCertificates = async () => {
    if (!chain.address.value) return;
    isRefreshingCertificates.value = true;
    try {
      const tokenIds = await chain.readArray("TokensOf", [{ type: "Hash160", value: chain.address.value }]);
      const validIds = (Array.isArray(tokenIds) ? tokenIds : []).map((v) => String(v || "")).filter(Boolean);
      const details = await Promise.all(validIds.map(async (tokenId) => {
        const detail = await chain.read("GetCertificateDetails", [{ type: "ByteArray", value: tokenId }]);
        if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
        const raw = detail as Record<string, unknown>;
        return {
          tokenId, templateId: String(raw.templateId || ""), owner: String(raw.owner || ""),
          templateName: String(raw.templateName || ""), issuerName: String(raw.issuerName || ""),
          category: String(raw.category || ""), description: String(raw.description || ""),
          recipientName: String(raw.recipientName || ""), achievement: String(raw.achievement || ""),
          memo: String(raw.memo || ""), issuedTime: Number.parseInt(String(raw.issuedTime || "0"), 10) || 0,
          revoked: parseBool(raw.revoked), revokedTime: Number.parseInt(String(raw.revokedTime || "0"), 10) || 0,
        } as CertificateItem;
      }));
      certificates.value = details.filter(Boolean) as CertificateItem[];
    } catch (_e) {
      certificates.value = [];
    } finally {
      isRefreshingCertificates.value = false;
    }
  };

  const connectWallet = async () => {
    await chain.ensureWallet();
    if (chain.address.value) {
      await refreshTemplates();
      await refreshCertificates();
    }
  };

  const openIssueModal = (template: unknown) => {
    eventBus.emit("soulbound:openIssueModal", template);
  };

  const toggleTemplate = async (template: unknown) => {
    const tpl = template as TemplateItem;
    if (togglingId.value) return;
    togglingId.value = tpl.id;
    try {
      await chain.ensureWallet();
      await chain.invoke("SetTemplateActive", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: tpl.id },
        { type: "Boolean", value: !tpl.active },
      ]);
      await refreshTemplates();
    } finally {
      togglingId.value = null;
    }
  };

  const copyIssueLink = async (template: unknown) => {
    const tpl = template as { id: string };
    try {
      const url = buildMiniAppLaunchUrl("miniapp-soulbound-certificate", { issueTemplateId: tpl.id, autoIssueDraft: "1" });
      await navigator.clipboard.writeText(url);
      eventBus.emit("soulbound:linkCopied", { action: t("issueLinkCopied") });
    } catch (e) {
      console.warn("[useSoulbound] copy failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const shareIssueLink = async (template: unknown) => {
    const tpl = template as { id: string };
    try {
      const url = buildMiniAppLaunchUrl("miniapp-soulbound-certificate", { issueTemplateId: tpl.id, autoIssueDraft: "1" });
      if (navigator.share) {
        await navigator.share({ title: t("issueCertificate"), text: tpl.id, url });
        eventBus.emit("soulbound:linkShared", { action: t("issueLinkShared") });
        return;
      }
      await copyIssueLink(template);
    } catch (e) {
      if (e instanceof Error && /abort|cancel/i.test(e.message)) return;
      await copyIssueLink(template);
    }
  };

  const loadAll = async () => {
    isLoading.value = true;
    try { await connectWallet(); } finally { isLoading.value = false; }
  };

  return {
    templates, certificates, address, isRefreshing, isRefreshingCertificates, togglingId, isLoading,
    templatesCount, certificatesCount, activeTemplatesCount,
    refreshTemplates, refreshCertificates, connectWallet, openIssueModal, toggleTemplate,
    copyIssueLink, shareIssueLink, loadAll,
  };
}

export type UseSoulboundReturn = ReturnType<typeof useSoulbound>;
