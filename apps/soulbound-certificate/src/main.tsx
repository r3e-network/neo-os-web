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
      t: ctx.t,
    });

    ctx.registerAction("refreshTemplates", async () => { await soulbound.refreshTemplates(); });
    ctx.registerAction("connectWallet", async () => { await soulbound.connectWallet(); });
    ctx.registerAction("openIssueModal", async (template: unknown) => { soulbound.openIssueModal(template); });
    ctx.registerAction("toggleTemplate", (template: unknown) =>
      ctx.services.notify.guard(() => soulbound.toggleTemplate(template)),
    );
    ctx.registerAction("copyIssueLink", async (template: unknown) => { await soulbound.copyIssueLink(template); });
    ctx.registerAction("shareIssueLink", async (template: unknown) => { await soulbound.shareIssueLink(template); });

    return {
      state: refsToObservables({
        templates: soulbound.templates,
        certificates: soulbound.certificates,
        templatesCount: soulbound.templatesCount,
        certificatesCount: soulbound.certificatesCount,
        activeTemplatesCount: soulbound.activeTemplatesCount,
        address: soulbound.address,
        isRefreshing: soulbound.isRefreshing,
        togglingId: soulbound.togglingId,
        isLoading: soulbound.isLoading,
      }),
      loadData: soulbound.loadAll,
    };
  },
});
