import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSoulbound } from "./composables/useSoulbound";

defineMiniApp({
  appId: "miniapp-soulbound-certificate",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-soulbound-certificate", {
      t: ctx.t as (key: string) => string,
    });

    const soulbound = useSoulbound({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("refreshTemplates", async () => { await soulbound.refreshTemplates(); });
    ctx.registerAction("connectWallet", async () => { await soulbound.connectWallet(); });
    ctx.registerAction("openIssueModal", async (template: unknown) => { soulbound.openIssueModal(template); });
    ctx.registerAction("toggleTemplate", async (template: unknown) => {
      try { await soulbound.toggleTemplate(template); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });
    ctx.registerAction("copyIssueLink", async (template: unknown) => { await soulbound.copyIssueLink(template); });
    ctx.registerAction("shareIssueLink", async (template: unknown) => { await soulbound.shareIssueLink(template); });

    return {
      state: {
        templates: soulbound.templates,
        certificates: soulbound.certificates,
        templatesCount: soulbound.templatesCount,
        certificatesCount: soulbound.certificatesCount,
        activeTemplatesCount: soulbound.activeTemplatesCount,
        address: soulbound.address,
        isRefreshing: soulbound.isRefreshing,
        togglingId: soulbound.togglingId,
        isLoading: soulbound.isLoading,
      },
      loadData: soulbound.loadAll,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
