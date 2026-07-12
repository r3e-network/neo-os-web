/**
 * Event Ticket Pass - React entry point.
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
    const app = ctx.framework;
    const ticket = useEventTicket({
      app,
      bus: app.bus,
      t: ctx.t,
      launchNetwork: ctx.launchContext.network,
    });

    ticket.address.set(app.chain.address.get() ?? "");

    app.actions.register("connectWallet", () => ticket.connectWallet(), {
      successKey: "walletConnected",
    });
    app.actions.register("refreshEvents", () => ticket.refreshEvents(), {
      successKey: "eventsLoaded",
    });
    app.actions.register("refreshTickets", () => ticket.refreshTickets(), {
      successKey: "ticketsLoaded",
    });
    app.actions.register("refreshDiscovery", () => ticket.refreshDiscovery(), {
      successKey: "eventsLoaded",
    });
    app.actions.register("refreshGateTickets", (eventId: unknown) =>
      ticket.refreshGateTickets(String(eventId || ticket.selectedEventId.get())), {
      successKey: "gateQueueLoaded",
    });
    app.actions.register("recoverPending", () => ticket.recoverPending(), {
      successKey: "pendingRecovered",
    });
    app.actions.register(
      "createEvent",
      (input: unknown) => ticket.createEvent(input),
      { successKey: "eventCreated" },
    );
    app.actions.register("selectEvent", async (eventId: unknown) => {
      ticket.selectEvent(String(eventId || ""));
    });
    app.actions.register("openIssueModal", async (event: unknown) => {
      ticket.openIssueModal(event);
    });
    app.actions.register(
      "issueTicket",
      (input: unknown) => ticket.issueTicket(input),
      { successKey: "ticketIssued" },
    );
    app.actions.register("toggleEvent", async (event: unknown) =>
      app.notify.guard(async () => {
        await ticket.toggleEvent(event);
      }),
    );
    app.actions.register(
      "lookupTicket",
      (input: unknown) => ticket.lookupTicket(input),
      { successKey: "ticketFound" },
    );
    app.actions.register(
      "checkInTicket",
      (input: unknown) => ticket.checkInTicket(input),
      { successKey: "checkinSuccess" },
    );
    app.actions.register("startTransfer", async (item: unknown) => {
      ticket.startTransfer(item);
    });
    app.actions.register("copyTokenId", async (tokenId: unknown) => {
      const value = String(tokenId ?? "");
      if (!value) return;
      await app.clipboard.copy(value, { successKey: "tokenIdCopied" });
    });
    app.actions.register(
      "transferTicket",
      (input: unknown) =>
        ticket.transferTicket(
          input as { tokenId?: string; recipient?: string } | undefined,
        ),
      { successKey: "transferSuccess" },
    );

    return {
      state: refsToObservables({
        events: ticket.events,
        discoveredEvents: ticket.discoveredEvents,
        tickets: ticket.tickets,
        gateTickets: ticket.gateTickets,
        address: ticket.address,
        selectedEventId: ticket.selectedEventId,
        selectedEvent: ticket.selectedEvent,
        lookup: ticket.lookup,
        latestRequest: ticket.latestRequest,
        latestResult: ticket.latestResult,
        workflowStatus: ticket.workflowStatus,
        lastError: ticket.lastError,
        ticketsVerification: ticket.ticketsVerification,
        ticketsExpectedCount: ticket.ticketsExpectedCount,
        gateTicketsVerification: ticket.gateTicketsVerification,
        gateTicketsExpectedCount: ticket.gateTicketsExpectedCount,
        runtimeStatus: ticket.runtimeStatus,
        runtimeMessage: ticket.runtimeMessage,
        activeNetwork: ticket.activeNetwork,
        pendingOperation: ticket.pendingOperation,
        eventName: ticket.eventName,
        eventVenue: ticket.eventVenue,
        eventStart: ticket.eventStart,
        eventEnd: ticket.eventEnd,
        maxSupply: ticket.maxSupply,
        notes: ticket.notes,
        issueRecipient: ticket.issueRecipient,
        issueSeat: ticket.issueSeat,
        issueMemo: ticket.issueMemo,
        checkinTokenId: ticket.checkinTokenId,
        transferTokenId: ticket.transferTokenId,
        transferRecipient: ticket.transferRecipient,
        eventsCount: ticket.eventsCount,
        ticketsCount: ticket.ticketsCount,
        activeEventsCount: ticket.activeEventsCount,
        canIssueTicket: ticket.canIssueTicket,
        canCheckInTicket: ticket.canCheckInTicket,
        canTransferTicket: ticket.canTransferTicket,
        isLoading: ticket.isLoading,
        isConnecting: ticket.isConnecting,
        isRefreshing: ticket.isRefreshing,
        isRefreshingTickets: ticket.isRefreshingTickets,
        isRefreshingGateTickets: ticket.isRefreshingGateTickets,
        isRefreshingDiscovery: ticket.isRefreshingDiscovery,
        isRecovering: ticket.isRecovering,
        isCreating: ticket.isCreating,
        isIssuing: ticket.isIssuing,
        isCheckingIn: ticket.isCheckingIn,
        isLookingUp: ticket.isLookingUp,
        isTransferring: ticket.isTransferring,
        transferringTokenId: ticket.transferringTokenId,
        togglingId: ticket.togglingId,
      }),
      loadData: ticket.loadAll,
    };
  },
});
