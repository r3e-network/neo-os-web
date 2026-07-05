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
      app: ctx.framework,
      t: ctx.t,
    });

    ctx.framework.actions.register("refreshTemplates", async () => { await soulbound.refreshTemplates(); });
    ctx.framework.actions.register("connectWallet", async () => { await soulbound.connectWallet(); });
    ctx.framework.actions.register("createTemplate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.createTemplate(form as never)),
    );
    ctx.framework.actions.register("issueCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.issueCertificate(form as never)),
    );
    ctx.framework.actions.register("toggleTemplate", (template: unknown) =>
      ctx.services.notify.guard(() => soulbound.toggleTemplate(template)),
    );
    ctx.framework.actions.register("verifyCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.verifyCertificate(form as never)),
    );
    ctx.framework.actions.register("revokeCertificate", (form: unknown) =>
      ctx.services.notify.guard(() => soulbound.revokeCertificate(form as never)),
    );
    ctx.framework.actions.register("copyIssueLink", async (template: unknown) => { await soulbound.copyIssueLink(template); });
    ctx.framework.actions.register("copyVerifyLink", async (tokenId: unknown) => { await soulbound.copyVerifyLink(tokenId); });
    ctx.framework.actions.register("shareVerifyLink", async (tokenId: unknown) => { await soulbound.shareVerifyLink(tokenId); });
    ctx.framework.actions.register("consumeDeepLink", async () => { soulbound.consumeDeepLink(); });
    ctx.framework.actions.register("consumeVerifyDeepLink", async () => { soulbound.consumeVerifyDeepLink(); });

    return {
      state: refsToObservables({
        templates: soulbound.templates,
        certificates: soulbound.certificates,
        templatesCount: soulbound.templatesCount,
        certificatesCount: soulbound.certificatesCount,
        activeTemplatesCount: soulbound.activeTemplatesCount,
        verifiedCertificate: soulbound.verifiedCertificate,
        verifiedIsIssuer: soulbound.verifiedIsIssuer,
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
        deepLinkVerifyTokenId: soulbound.deepLinkVerifyTokenId,
      }),
      loadData: soulbound.loadAll,
    };
  },
});
