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
    const ticket = useEventTicket({
      app: ctx.framework,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ticket.address.set(ctx.services.chain.address.get() ?? "");

    ctx.framework.actions.register("connectWallet", async () => {
      try {
        await ticket.connectWallet();
        ctx.setStatus(ctx.t("walletConnected"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("walletNotConnected"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("refreshEvents", async () => {
      try {
        await ticket.refreshEvents();
        ctx.setStatus(ctx.t("eventsLoaded"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("loadFailed"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("refreshTickets", async () => {
      try {
        await ticket.refreshTickets();
        ctx.setStatus(ctx.t("ticketsLoaded"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("loadFailed"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("createEvent", async () => {
      try {
        await ticket.createEvent();
        ctx.setStatus(ctx.t("eventCreated"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("contractMissing"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("selectEvent", async (eventId: unknown) => {
      ticket.selectEvent(String(eventId || ""));
    });
    ctx.framework.actions.register("openIssueModal", async (event: unknown) => {
      ticket.openIssueModal(event);
    });
    ctx.framework.actions.register("issueTicket", async () => {
      try {
        await ticket.issueTicket();
        ctx.setStatus(ctx.t("ticketIssued"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("contractMissing"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("toggleEvent", async (event: unknown) =>
      ctx.services.notify.guard(async () => {
        await ticket.toggleEvent(event);
      }),
    );
    ctx.framework.actions.register("lookupTicket", async () => {
      try {
        await ticket.lookupTicket();
        ctx.setStatus(ctx.t("ticketFound"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("ticketNotFound"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("checkInTicket", async () => {
      try {
        await ticket.checkInTicket();
        ctx.setStatus(ctx.t("checkinSuccess"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("contractMissing"),
          "error",
        );
      }
    });
    ctx.framework.actions.register("startTransfer", async (item: unknown) => {
      ticket.startTransfer(item);
    });
    ctx.framework.actions.register("copyTokenId", async (tokenId: unknown) => {
      const value = String(tokenId ?? "");
      if (!value) return;
      await ctx.services.clipboard.copy(value, "tokenIdCopied");
    });
    ctx.framework.actions.register("transferTicket", async (input: unknown) => {
      try {
        await ticket.transferTicket(
          input as { tokenId?: string; recipient?: string } | undefined,
        );
        ctx.setStatus(ctx.t("transferSuccess"), "success");
      } catch (error) {
        ctx.setStatus(
          error instanceof Error ? error.message : ctx.t("contractMissing"),
          "error",
        );
      }
    });

    return {
      state: refsToObservables({
        events: ticket.events,
        tickets: ticket.tickets,
        address: ticket.address,
        selectedEventId: ticket.selectedEventId,
        selectedEvent: ticket.selectedEvent,
        lookup: ticket.lookup,
        latestRequest: ticket.latestRequest,
        latestResult: ticket.latestResult,
        workflowStatus: ticket.workflowStatus,
        lastError: ticket.lastError,
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
        isRefreshing: ticket.isRefreshing,
        isRefreshingTickets: ticket.isRefreshingTickets,
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
