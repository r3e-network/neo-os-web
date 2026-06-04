/**
 * Soulbound Certificate — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSoulbound } from "./composables/useSoulbound";

defineMiniApp({
  appId: "miniapp-soulbound-certificate",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const soulbound = useSoulbound({
      nftService: ctx.os.nft,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      clipboard: ctx.services.clipboard,
      eventBus: ctx.services.events,
      chain: ctx.services.chain,
      t: ctx.t,
    });

    ctx.registerAction("refreshTemplates", async () => { await soulbound.refreshTemplates(); });
    ctx.registerAction("connectWallet", async () => { await soulbound.connectWallet(); });
    ctx.registerAction("createTemplate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.createTemplate(form as never)),
    );
    ctx.registerAction("issueCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.issueCertificate(form as never)),
    );
    ctx.registerAction("toggleTemplate", (template: unknown) =>
      ctx.services.notify.guard(() => soulbound.toggleTemplate(template)),
    );
    ctx.registerAction("verifyCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.verifyCertificate(form as never)),
    );
    ctx.registerAction("revokeCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.revokeCertificate(form as never)),
    );
    ctx.registerAction("copyIssueLink", async (template: unknown) => { await soulbound.copyIssueLink(template); });
    ctx.registerAction("shareIssueLink", async (template: unknown) => { await soulbound.shareIssueLink(template); });
    ctx.registerAction("consumeDeepLink", async () => { soulbound.consumeDeepLink(); });

    return {
      state: refsToObservables({
        templates: soulbound.templates,
        certificates: soulbound.certificates,
        templatesCount: soulbound.templatesCount,
        certificatesCount: soulbound.certificatesCount,
        activeTemplatesCount: soulbound.activeTemplatesCount,
        verifiedCertificate: soulbound.verifiedCertificate,
        // Bind the live wallet observable so the connect prompt reacts.
        address: ctx.services.chain.address,
        isRefreshing: soulbound.isRefreshing,
        isConnecting: soulbound.isConnecting,
        isCreatingTemplate: soulbound.isCreatingTemplate,
        isIssuing: soulbound.isIssuing,
        isVerifying: soulbound.isVerifying,
        isRevoking: soulbound.isRevoking,
        togglingId: soulbound.togglingId,
        isLoading: soulbound.isLoading,
        lastTxid: soulbound.lastTxid,
        lastError: soulbound.lastError,
        lastSuccess: soulbound.lastSuccess,
        deepLinkTemplateId: soulbound.deepLinkTemplateId,
        deepLinkAutoIssue: soulbound.deepLinkAutoIssue,
      }),
      loadData: soulbound.loadAll,
    };
  },
});
