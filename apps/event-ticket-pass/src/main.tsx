/**
 * Event Ticket Pass — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useEventTicket } from "./composables/useEventTicket";

defineMiniApp({
  appId: "miniapp-event-ticket-pass",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const ticket = useEventTicket({
      nftService: ctx.os.nft,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("refreshEvents", async () => { await ticket.refreshEvents(); });
    ctx.registerAction("connectWallet", async () => { await ticket.connectWallet(); });
    ctx.registerAction("openIssueModal", async (event: unknown) => { ticket.openIssueModal(event); });
    ctx.registerAction("toggleEvent", (event: unknown) =>
      ctx.services.notify.guard(() => ticket.toggleEvent(event)),
    );

    return {
      state: refsToObservables({
        events: ticket.events,
        tickets: ticket.tickets,
        eventsCount: ticket.eventsCount,
        ticketsCount: ticket.ticketsCount,
        activeEventsCount: ticket.activeEventsCount,
        address: ticket.address,
        isRefreshing: ticket.isRefreshing,
        togglingId: ticket.togglingId,
        isLoading: ticket.isLoading,
      }),
      loadData: ticket.loadAll,
    };
  },
});
