import { defineMiniApp } from "@shared/utils/defineMiniApp";
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
    const platformServices = ctx.services;

    const ticket = useEventTicket({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("refreshEvents", async () => {
      await ticket.refreshEvents();
    });
    ctx.registerAction("connectWallet", async () => {
      await ticket.connectWallet();
    });
    ctx.registerAction("openIssueModal", async (event: unknown) => {
      ticket.openIssueModal(event);
    });
    ctx.registerAction("toggleEvent", (event: unknown) =>
      platformServices.notify.guard(() => ticket.toggleEvent(event)),
    );

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
    };
  },
});
