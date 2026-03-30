/**
 * Event Ticket Pass — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.nft, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useEventTicket({ nftService, storageService, ... })
 */

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
    const ticket = useEventTicket({
      nftService: ctx.os.nft,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
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
      ctx.services.notify.guard(() => ticket.toggleEvent(event)),
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
