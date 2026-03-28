import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useEventTicket } from "./composables/useEventTicket";

defineMiniApp({
  appId: "miniapp-event-ticket-pass",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-event-ticket-pass", {
      t: ctx.t as (key: string) => string,
    });

    const ticket = useEventTicket({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("refreshEvents", async () => { await ticket.refreshEvents(); });
    ctx.registerAction("connectWallet", async () => { await ticket.connectWallet(); });
    ctx.registerAction("openIssueModal", async (event: unknown) => { ticket.openIssueModal(event); });
    ctx.registerAction("toggleEvent", async (event: unknown) => {
      try { await ticket.toggleEvent(event); }
      catch (e) { ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error"); }
    });

    return {
      state: {
        events: ticket.events,
        tickets: ticket.tickets,
        eventsCount: ticket.eventsCount,
        ticketsCount: ticket.ticketsCount,
        activeEventsCount: ticket.activeEventsCount,
        address: ticket.address,
        isRefreshing: ticket.isRefreshing,
        togglingId: ticket.togglingId,
        isLoading: ticket.isLoading,
      },
      loadData: ticket.loadAll,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
