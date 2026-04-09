/**
 * useSoulbound — Domain logic for the Soulbound Certificate miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (NFTProxy, StorageProxy, BadgeProxy) via edge functions, so
 * this file contains zero contract hashes, parameter encoding, or event
 * parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.readArray("GetIssuerTemplates", [...])
 *     chain.read("GetTemplateDetails", [...])
 *     chain.readArray("TokensOf", [...])
 *     chain.read("GetCertificateDetails", [...])
 *     chain.invoke("SetTemplateActive", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     nftService.list(owner)
 *     storageService.list("templates:", 20)
 *     storageService.get("template:<id>")
 *     storageService.list("certificates:", 50)
 *     storageService.get("certificate:<tokenId>")
 *     nftService.validate(templateId) — toggle active
 *     badgeService.award("first-certificate", "")
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - UI state (togglingId, isRefreshing, etc.)
 *   - Link building + clipboard + share logic
 */

import { ref, computed } from "vue";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ClipboardService } from "@shared/services";
import { buildMiniAppLaunchUrl } from "@shared/utils/miniapp-routes";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import type { TemplateItem, CertificateItem } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseSoulboundOptions {
  /** OS NFTProxy instance from ctx.os.nft */
  nftService: NFTProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** ClipboardService from ctx.services.clipboard */
  clipboard: ClipboardService;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// Composable
// ============================================================================

export function useSoulbound({
  nftService,
  storageService,
  badgeService,
  clipboard,
  eventBus,
  t,
}: UseSoulboundOptions) {
  const templates = ref<TemplateItem[]>([]);
  const certificates = ref<CertificateItem[]>([]);
  const isRefreshing = ref(false);
  const isRefreshingCertificates = ref(false);
  const togglingId = ref<string | null>(null);
  const isLoading = ref(false);

  const address = ref("");
  const templatesCount = computed(() => templates.value.length);
  const certificatesCount = computed(() => certificates.value.length);
  const activeTemplatesCount = computed(() => templates.value.filter((tpl) => tpl.active).length);

  // ── Data Loading (via OS services) ─────────────────────────────────

  const refreshTemplates = async () => {
    isRefreshing.value = true;
    try {
      const templateMap = await storageService.list("templates:", 20);
      const items: TemplateItem[] = [];
      if (templateMap && typeof templateMap === "object") {
        for (const [, value] of Object.entries(templateMap)) {
          const stored = value as StoredTemplate;
          if (stored && stored.id) {
            items.push({
              id: String(stored.id),
              issuer: String(stored.issuer || ""),
              name: String(stored.name || ""),
              issuerName: String(stored.issuerName || ""),
              category: String(stored.category || ""),
              maxSupply: parseBigInt(stored.maxSupply),
              issued: parseBigInt(stored.issued),
              description: String(stored.description || ""),
              active: parseBool(stored.active),
            });
          }
        }
      }
      templates.value = items;
    } catch (_e) {
      templates.value = [];
    } finally {
      isRefreshing.value = false;
    }
  };

  const refreshCertificates = async () => {
    isRefreshingCertificates.value = true;
    try {
      const certMap = await storageService.list("certificates:", 50);
      const items: CertificateItem[] = [];
      if (certMap && typeof certMap === "object") {
        for (const [, value] of Object.entries(certMap)) {
          const stored = value as StoredCertificate;
          if (stored && stored.tokenId) {
            items.push({
              tokenId: String(stored.tokenId),
              templateId: String(stored.templateId || ""),
              owner: String(stored.owner || ""),
              templateName: String(stored.templateName || ""),
              issuerName: String(stored.issuerName || ""),
              category: String(stored.category || ""),
              description: String(stored.description || ""),
              recipientName: String(stored.recipientName || ""),
              achievement: String(stored.achievement || ""),
              memo: String(stored.memo || ""),
              issuedTime: Number(stored.issuedTime || 0),
              revoked: parseBool(stored.revoked),
              revokedTime: Number(stored.revokedTime || 0),
            });
          }
        }
      }
      certificates.value = items;
    } catch (_e) {
      certificates.value = [];
    } finally {
      isRefreshingCertificates.value = false;
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Connect wallet — a no-op in the OS services pattern.
   * OS services handle auth transparently through edge functions.
   */
  const connectWallet = async () => {
    // OS services handle wallet/auth transparently
    await refreshTemplates();
    await refreshCertificates();
  };

  const openIssueModal = (template: unknown) => {
    eventBus.emit("soulbound:openIssueModal", template);
  };

  /**
   * Toggle a template's active state via NFTProxy.validate().
   * The edge function handles the SetTemplateActive contract call.
   */
  const toggleTemplate = async (template: unknown) => {
    const tpl = template as TemplateItem;
    if (togglingId.value) return;
    togglingId.value = tpl.id;
    try {
      await nftService.validate(tpl.id);
      await refreshTemplates();
    } finally {
      togglingId.value = null;
    }
  };

  const copyIssueLink = async (template: unknown) => {
    const tpl = template as { id: string };
    const url = buildMiniAppLaunchUrl("miniapp-soulbound-certificate", { issueTemplateId: tpl.id, autoIssueDraft: "1" });
    const ok = await clipboard.copy(url, "issueLinkCopied");
    if (ok) {
      eventBus.emit("soulbound:linkCopied", { action: t("issueLinkCopied") });
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

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    isLoading.value = true;
    try {
      await connectWallet();
      // Hint badge for certificate issuer (fire-and-forget)
      if (templates.value.length > 0) {
        badgeService.award("certificate-issuer", "").catch(() => {});
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    templates, certificates, address, isRefreshing, isRefreshingCertificates, togglingId, isLoading,
    templatesCount, certificatesCount, activeTemplatesCount,
    refreshTemplates, refreshCertificates, connectWallet, openIssueModal, toggleTemplate,
    copyIssueLink, shareIssueLink, loadAll,
  };
}

export type UseSoulboundReturn = ReturnType<typeof useSoulbound>;
