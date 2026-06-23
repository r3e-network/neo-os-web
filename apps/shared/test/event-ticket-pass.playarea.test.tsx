import fs from "node:fs";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../event-ticket-pass/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    activate: "Activate",
    checkIn: "Check-in",
    checkinHint: "Scan or paste a ticket token id.",
    checkinTab: "Check-in",
    checkinTokenId: "Ticket Token ID",
    checkinTokenIdPlaceholder: "Enter token ID from QR",
    connectWallet: "Connect Wallet",
    createEvent: "Create Event",
    createTab: "Create",
    dateUnknown: "Schedule TBD",
    deactivate: "Deactivate",
    docSubtitle: "On-chain tickets with organizer check-in",
    emptyEvents: "No events yet",
    emptyEventsHint: "Create an event to open the organizer workflow.",
    emptyTickets: "No tickets yet",
    emptyTicketsHint: "Issued attendee tickets appear here.",
    eventEnd: "End time",
    eventEndPlaceholder: "2026-06-20 18:00",
    eventDetails: "Schedule and capacity",
    eventIdentity: "Event identity",
    eventName: "Event name",
    eventNamePlaceholder: "Neo Builder Summit",
    eventPass: "EVENT PASS",
    eventSelected: "Event selected",
    eventStart: "Start time",
    eventStartPlaceholder: "2026-06-20 09:00",
    eventVenue: "Venue",
    eventVenuePlaceholder: "Neo Community Hall",
    evidence: "Request and result evidence",
    flowCheckin: "Lookup and check in",
    flowCreate: "Create event",
    flowIssue: "Issue attendee ticket",
    issue: "Issue",
    issuePreview: "Pass being issued",
    issueMemo: "Memo",
    issueMemoPlaceholder: "Standard admission",
    issueRecipient: "Recipient address",
    issueRecipientPlaceholder: "Neo N3 address",
    issueSeat: "Seat / Zone",
    issueSeatPlaceholder: "General",
    issueTicket: "Issue Ticket",
    issueTicketTitle: "Issue Ticket",
    latestRequest: "Latest Request",
    latestResult: "Latest Result",
    lookup: "Lookup",
    lifecycleChecking: "Marking pass as used",
    lifecycleComplete: "Guest passes are live",
    lifecycleCopy:
      "The primary workflow stays visible: design the event pass, send it to a guest wallet, then scan the token at the gate.",
    lifecycleCreating: "Publishing event on-chain",
    lifecycleDraft: "Design the event pass first",
    lifecycleEvent: "Event pass",
    lifecycleEyebrow: "Live pass route",
    lifecycleGate: "Door gate",
    lifecycleIssuing: "Minting guest pass",
    lifecycleLookup: "Reading token at the gate",
    lifecycleReady: "Event is ready for guest passes",
    lifecycleTitle: "From pass design to the door",
    lifecycleTransfer: "Sending pass to a new wallet",
    lifecycleWallet: "Guest wallet",
    maxSupply: "Max tickets",
    maxSupplyPlaceholder: "120",
    minted: "Minted",
    notes: "Notes",
    notesPlaceholder: "Workshop pass",
    payloadEmpty: "No action submitted yet",
    ready: "Ready",
    refresh: "Refresh",
    requestEmpty: "Create an event to inspect the request.",
    resultEmpty: "Response appears here.",
    seatFallback: "General",
    selectEventFirst: "Select an event first",
    serviceStatus: "Service Status",
    sidebarActive: "Active",
    sidebarEvents: "Events",
    sidebarTickets: "Tickets",
    statusActive: "Active",
    statusInactive: "Inactive",
    ticketOwner: "Owner",
    ticketsLoaded: "Tickets loaded",
    ticketsTab: "My Tickets",
    ticketSeat: "Seat",
    ticketTokenId: "Token ID",
    ticketUsed: "Used",
    ticketValid: "Valid",
    title: "Event Ticket Pass",
    venueFallback: "Venue TBD",
    wallet: "Wallet",
    walletNotConnected: "Wallet not connected",
    workflow: "Ticket workflow",
    yourEvents: "Your Events",
    copyTokenId: "Copy Token ID",
    ticketQrLabel: "Ticket token ID QR code",
    transferTicket: "Transfer",
    transferRecipient: "Transfer to",
    transferRecipientPlaceholder: "Neo N3 address",
    cancel: "Cancel",
  };
  return messages[key] ?? key;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    events: [],
    tickets: [],
    address: "",
    selectedEventId: "",
    selectedEvent: null,
    lookup: null,
    latestRequest: null,
    latestResult: null,
    workflowStatus: "Ready",
    lastError: "",
    eventName: "Neo Builder Summit",
    eventVenue: "Neo Community Hall",
    eventStart: "2026-06-20 09:00",
    eventEnd: "2026-06-20 18:00",
    maxSupply: "120",
    notes: "Workshop pass",
    issueRecipient: "",
    issueSeat: "General",
    issueMemo: "Standard admission",
    checkinTokenId: "",
    transferTokenId: "",
    transferRecipient: "",
    eventsCount: 0,
    ticketsCount: 0,
    activeEventsCount: 0,
    canIssueTicket: false,
    canCheckInTicket: false,
    canTransferTicket: false,
    isLoading: false,
    isRefreshing: false,
    isRefreshingTickets: false,
    isCreating: false,
    isIssuing: false,
    isCheckingIn: false,
    isLookingUp: false,
    isTransferring: false,
    transferringTokenId: "",
    togglingId: null,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Event Ticket Pass PlayArea", () => {
  it("renders the complete organizer and check-in workflow", () => {
    const event = {
      id: "evt-1",
      creator: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      name: "Neo Summit",
      venue: "Neo Hall",
      startTime: 1781955600,
      endTime: 1781988000,
      maxSupply: 120n,
      minted: 1n,
      notes: "",
      active: true,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          selectedEventId: "evt-1",
          selectedEvent: event,
          issueRecipient: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          canIssueTicket: true,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByText("Create Event").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Event name").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "From pass design to the door" })).toBeTruthy();
    expect(container.querySelector(".ticket-lifecycle--ready")).toBeTruthy();
    expect(container.querySelector('.ticket-lifecycle__art[src="./pass-artwork.jpg"]')).toBeTruthy();
    expect(container.querySelector(".ticket-lifecycle__moving-pass")).toBeTruthy();
    expect(container.querySelectorAll(".ticket-lifecycle__node")).toHaveLength(3);
    expect(container.querySelector(".ticket-issue-runway.is-ready")).toBeTruthy();
    expect(container.querySelector(".ticket-issue-runway__ticket")).toBeTruthy();
    expect(container.querySelectorAll(".ticket-issue-runway__node")).toHaveLength(3);

    // The organizer desk defaults to the "Issue Ticket" tab.
    expect(screen.getByLabelText("Recipient address")).toBeTruthy();

    // Check-in controls live behind the "Check-in" tab in the desk.
    fireEvent.click(screen.getByRole("tab", { name: /Check-in/i }));
    expect(screen.getByLabelText("Ticket Token ID")).toBeTruthy();

    expect(screen.getByText("Latest Request")).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Request and result evidence" }),
    ).toBeTruthy();
  });

  it("dispatches business actions from visible controls", () => {
    const dispatch = vi.fn(async () => undefined);
    const event = {
      id: "evt-1",
      creator: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      name: "Neo Summit",
      venue: "Neo Hall",
      startTime: 1781955600,
      endTime: 1781988000,
      maxSupply: 120n,
      minted: 1n,
      notes: "",
      active: true,
    };
    const appState = state({
      events: [event],
      selectedEventId: "evt-1",
      selectedEvent: event,
      eventsCount: 1,
      activeEventsCount: 1,
      issueRecipient: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      canIssueTicket: true,
      canCheckInTicket: true,
      checkinTokenId: "ticket-evt-1",
      latestRequest: { kind: "ticket_issue" },
      latestResult: { kind: "ticket_issued" },
    });
    render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Create Event$/i }));
    expect(dispatch).toHaveBeenCalledWith("createEvent");

    fireEvent.click(screen.getByRole("button", { name: /^Issue$/i }));
    expect(dispatch).toHaveBeenCalledWith("issueTicket");

    // Lookup lives on the "Check-in" tab of the organizer desk.
    fireEvent.click(screen.getByRole("tab", { name: /Check-in/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Lookup$/i }));
    expect(dispatch).toHaveBeenCalledWith("lookupTicket");
  });

  it("turns issuing into an animated ticket lifecycle state", () => {
    const event = {
      id: "evt-1",
      creator: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      name: "Neo Summit",
      venue: "Neo Hall",
      startTime: 1781955600,
      endTime: 1781988000,
      maxSupply: 120n,
      minted: 1n,
      notes: "",
      active: true,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          selectedEventId: "evt-1",
          selectedEvent: event,
          issueRecipient: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          canIssueTicket: true,
          isIssuing: true,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    const lifecycle = screen.getByRole("region", {
      name: "From pass design to the door",
    });
    expect(lifecycle.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".ticket-lifecycle--issuing")).toBeTruthy();
    expect(screen.getAllByText("Minting guest pass").length).toBeGreaterThan(0);
  });

  it("surfaces copy-token-id and transfer affordances on a held ticket", () => {
    const dispatch = vi.fn(async () => undefined);
    const heldTicket = {
      tokenId: "1-1",
      eventId: "1",
      owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      eventName: "Neo Summit",
      venue: "Neo Hall",
      startTime: 1781955600,
      endTime: 1781988000,
      seat: "A-12",
      memo: "",
      issuedTime: 1781500000,
      used: false,
      usedTime: 0,
    };
    const appState = state({
      tickets: [heldTicket],
      ticketsCount: 1,
      address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    });
    render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    // The token id is copyable (door QR + copy affordance) instead of read-only.
    fireEvent.click(screen.getByRole("button", { name: "Copy Token ID" }));
    expect(dispatch).toHaveBeenCalledWith("copyTokenId", "1-1");

    // Starting a transfer opens the recipient form for THIS token.
    fireEvent.click(screen.getByRole("button", { name: /^Transfer$/i }));
    expect(dispatch).toHaveBeenCalledWith("startTransfer", heldTicket);
  });

  it("submits a NEP-11 transfer once a recipient is entered", () => {
    const dispatch = vi.fn(async () => undefined);
    const heldTicket = {
      tokenId: "1-1",
      eventId: "1",
      owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      eventName: "Neo Summit",
      venue: "Neo Hall",
      startTime: 1781955600,
      endTime: 1781988000,
      seat: "A-12",
      memo: "",
      issuedTime: 1781500000,
      used: false,
      usedTime: 0,
    };
    const appState = state({
      tickets: [heldTicket],
      ticketsCount: 1,
      address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      transferTokenId: "1-1",
      transferRecipient: "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY",
      canTransferTicket: true,
    });
    render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Transfer$/i }));
    expect(dispatch).toHaveBeenCalledWith("transferTicket", {
      tokenId: "1-1",
      recipient: "NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY",
    });
  });

  it("keeps loading and disabled primary CTAs visually distinct", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../event-ticket-pass/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toMatch(
      /\.ticket-play-area \.neo-btn--primary,\s*\.ticket-play-area \.neo-btn--primary\.neo-btn--loading\s*\{[\s\S]*color:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.ticket-play-area \.neo-btn--primary:disabled:not\(\.neo-btn--loading\)/,
    );
    expect(styles).toMatch(/background:\s*var\(--ns-surface-subtle/);
    expect(styles).toMatch(/color:\s*var\(--ns-text-2/);
  });

  it("keeps pass and gate motion backed by reduced-motion fallbacks", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../event-ticket-pass/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes ticket-hero-drift");
    expect(styles).toContain("@keyframes ticket-lifecycle-sheen");
    expect(styles).toContain("@keyframes ticket-lifecycle-rail");
    expect(styles).toContain("@keyframes ticket-lifecycle-pass-route");
    expect(styles).toContain("@keyframes ticket-lifecycle-pass-route-mobile");
    expect(styles).toContain("@keyframes ticket-lifecycle-node-active");
    expect(styles).toContain("@keyframes ticket-stage-sheen");
    expect(styles).toContain("@keyframes ticket-issue-stage-sweep");
    expect(styles).toContain("@keyframes ticket-issue-rail-flow");
    expect(styles).toContain("@keyframes ticket-issue-pass-route");
    expect(styles).toContain("@keyframes ticket-issue-pass-route-mobile");
    expect(styles).toContain("@keyframes ticket-scan-grid");
    expect(styles).toContain("@keyframes ticket-pass-art-drift");
    expect(styles).toContain(".ticket-lifecycle__moving-pass");
    expect(styles).toContain(".ticket-issue-runway__ticket");
    expect(styles).toContain(".ticket-create-preview--stage::after");
    expect(styles).toContain(".ticket-scan-frame::after");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.ticket-create-preview--stage::after[\s\S]*animation:\s*ticket-stage-sheen/,
    );
    expect(styles).toMatch(
      /\.ticket-scan-frame\s*\{[\s\S]*animation:\s*ticket-scan-grid/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ticket-pass__stub[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ticket-lifecycle__moving-pass[\s\S]*animation:\s*none/,
    );
  });
});
