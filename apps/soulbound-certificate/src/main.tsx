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
    const app = ctx.framework;
    const soulbound = useSoulbound({
      storageService: app.storage.remote,
      badgeService: app.badge,
      clipboard: app.clipboard,
      app,
      t: ctx.t,
    });

    ctx.framework.actions.register("refreshTemplates", async () => { await soulbound.refreshTemplates(); });
    ctx.framework.actions.register("refreshCertificates", async () => { await soulbound.refreshCertificates(); });
    ctx.framework.actions.register("connectWallet", async () => { await soulbound.connectWallet(); });
    ctx.framework.actions.register("createTemplate", (form: unknown) =>
      app.notify.guard(() => soulbound.createTemplate(form as never)),
    );
    ctx.framework.actions.register("updateTemplate", (form: unknown) =>
      app.notify.guard(() => soulbound.updateTemplate(form as never)),
    );
    ctx.framework.actions.register("issueCertificate", (form: unknown) =>
      app.notify.guard(() => soulbound.issueCertificate(form as never)),
    );
    ctx.framework.actions.register("toggleTemplate", (template: unknown) =>
      app.notify.guard(() => soulbound.toggleTemplate(template)),
    );
    ctx.framework.actions.register("verifyCertificate", (form: unknown) =>
      app.notify.guard(() => soulbound.verifyCertificate(form as never)),
    );
    ctx.framework.actions.register("revokeCertificate", (form: unknown) =>
      app.notify.guard(() => soulbound.revokeCertificate(form as never)),
    );
    ctx.framework.actions.register("copyIssueLink", async (template: unknown) => { await soulbound.copyIssueLink(template); });
    ctx.framework.actions.register("copyVerifyLink", async (tokenId: unknown) => { await soulbound.copyVerifyLink(tokenId); });
    ctx.framework.actions.register("shareVerifyLink", async (tokenId: unknown) => { await soulbound.shareVerifyLink(tokenId); });
    ctx.framework.actions.register("consumeDeepLink", async () => { soulbound.consumeDeepLink(); });
    ctx.framework.actions.register("consumeVerifyDeepLink", async () => { soulbound.consumeVerifyDeepLink(); });
    ctx.framework.actions.register("recoverPendingOperation", async () => { await soulbound.recoverPendingOperation(); });
    ctx.framework.actions.register("refreshRecoveryStorage", async () => { soulbound.refreshRecoveryStorage(); });

    return {
      state: refsToObservables({
        templates: soulbound.templates,
        certificates: soulbound.certificates,
        templatesSource: soulbound.templatesSource,
        certificatesSource: soulbound.certificatesSource,
        templatesCount: soulbound.templatesCount,
        certificatesCount: soulbound.certificatesCount,
        activeTemplatesCount: soulbound.activeTemplatesCount,
        verifiedCertificate: soulbound.verifiedCertificate,
        verifiedIsIssuer: soulbound.verifiedIsIssuer,
        // Bind the live wallet observable so the connect prompt reacts.
        address: app.chain.address,
        isRefreshing: soulbound.isRefreshing,
        isRefreshingCertificates: soulbound.isRefreshingCertificates,
        isConnecting: soulbound.isConnecting,
        isCreatingTemplate: soulbound.isCreatingTemplate,
        isUpdatingTemplate: soulbound.isUpdatingTemplate,
        isIssuing: soulbound.isIssuing,
        isVerifying: soulbound.isVerifying,
        isRevoking: soulbound.isRevoking,
        isRecovering: soulbound.isRecovering,
        togglingId: soulbound.togglingId,
        isLoading: soulbound.isLoading,
        lastTxid: soulbound.lastTxid,
        lastError: soulbound.lastError,
        lastSuccess: soulbound.lastSuccess,
        lastNotice: soulbound.lastNotice,
        pendingOperation: soulbound.pendingOperation,
        recoveryStorageAvailable: soulbound.recoveryStorageAvailable,
        deepLinkTemplateId: soulbound.deepLinkTemplateId,
        deepLinkAutoIssue: soulbound.deepLinkAutoIssue,
        deepLinkVerifyTokenId: soulbound.deepLinkVerifyTokenId,
      }),
      loadData: soulbound.loadAll,
    };
  },
});
