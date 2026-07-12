import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../event-ticket-pass/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    ready: "Ready",
    eventPass: "Event Pass",
    passPreview: "Pass preview",
    verifiedTicket: "Verified on-chain pass",
    previewTokenLabel: "Preview",
    studioEyebrow: "Ticket operations",
    studioTitle: "Event Studio",
    studioSubtitle: "Design, issue, and check in passes.",
    gateDesk: "Gate Desk",
    gateDeskSubtitle: "Issue or verify without leaving the desk.",
    modeOperateTitle: "Run gate desk",
    modeOperateDisabled: "Create an event first.",
    studioModeLabel: "Studio mode",
    studioStepCreate: "Design pass",
    studioStepIssue: "Issue guest pass",
    studioStepCheckin: "Run gate check-in",
    modeCreateTitle: "Design pass",
    modeCreateHint: "Set event identity first.",
    eventBlueprintsLabel: "Ticket event blueprints",
    blueprintSummitName: "Builder summit",
    blueprintSummitVenue: "Main hall",
    blueprintSummitStart: "2026-08-20 09:00",
    blueprintSummitEnd: "2026-08-20 18:00",
    blueprintSummitNotes: "Main-stage access, badge pickup, and all-day check-in.",
    blueprintWorkshopName: "Hands-on workshop",
    blueprintWorkshopVenue: "Builder lab",
    blueprintWorkshopStart: "2026-08-21 13:00",
    blueprintWorkshopEnd: "2026-08-21 17:00",
    blueprintWorkshopNotes: "Limited-capacity workshop pass with reserved lab seating.",
    blueprintBackstageName: "Backstage access",
    blueprintBackstageVenue: "Crew entrance",
    blueprintBackstageStart: "2026-08-20 08:00",
    blueprintBackstageEnd: "2026-08-20 23:00",
    blueprintBackstageNotes: "Staff, speaker, and production access with gate verification.",
    eventsCountLabel: "{count} events",
    discoveredEventsCount: "{count} discoverable events",
    discoverEvents: "Discover events",
    invitationOnlyHint: "Organizer-issued only.",
    invitationOnlyTitle: "Organizer-issued passes",
    invitationOnlyShort: "Invitation only",
    runtimeReady: "Verified {network} ticket contract",
    runtimeConnectWallet: "Connect wallet to verify the ticket contract",
    runtimeUnavailable: "Ticket contract unavailable",
    runtimeChecking: "Checking ticket contract",
    refresh: "Refresh",
    refreshingDiscovery: "Refreshing events",
    pendingOperationTitle: "One action needs confirmation",
    pendingOperationHint: "Recover the saved transaction first.",
    transactionPending: "Transaction pending",
    recoverPending: "Recover status",
    recoveringPending: "Recovering status",
    sidebarEvents: "Events",
    ticketsCount: "Tickets",
    detailsLabel: "Details",
    active: "Active",
    walletNotConnected: "Wallet not connected",
    eventName: "Event name",
    eventNamePlaceholder: "Neo Builder Summit",
    eventVenue: "Venue",
    eventVenuePlaceholder: "Neo Community Hall",
    eventStart: "Start time",
    eventStartPlaceholder: "2026-08-20 09:00",
    eventEnd: "End time",
    eventEndPlaceholder: "2026-08-20 18:00",
    maxSupply: "Max tickets",
    maxSupplyPlaceholder: "120",
    notes: "Notes",
    notesPlaceholder: "Workshop pass",
    venueFallback: "Venue TBD",
    statusActive: "Active",
    statusInactive: "Inactive",
    createEvent: "Create Event",
    creatingEvent: "Creating...",
    issueTicket: "Issue Ticket",
    issuing: "Issuing...",
    issueTicketTitle: "Issue Ticket",
    guestLaneLabel: "Guest pass lane",
    recentGuests: "Recent guest wallets",
    issueRecipient: "Recipient address",
    issueRecipientPlaceholder: "Neo N3 address",
    issueSeat: "Seat / Zone",
    seatLaneLabel: "Seat lane",
    issueMemo: "Memo (optional)",
    issueSeatPlaceholder: "A-12",
    issueMemoPlaceholder: "Backstage pass",
    checkIn: "Check-in",
    checkingIn: "Checking in...",
    doorScanner: "Door scanner",
    scannerSlotLabel: "Token scanner slot",
    gateQueueLabel: "Ready passes",
    gateQueueVerified: "{count} issued passes verified",
    gateQueuePartial: "Showing {shown} of {total}",
    refreshingGateQueue: "Refreshing gate queue",
    gateQueueLoadingHint: "Reading issued token records.",
    gateQueueEmpty: "No issued passes in this gate queue",
    gateQueueEmptyHint: "Issue the first guest pass.",
    gateQueueSelectOwnedEvent: "Select one of your organizer events.",
    checkinHint: "Scan or paste a ticket token id.",
    checkinTokenId: "Ticket Token ID",
    checkinTokenIdPlaceholder: "Enter token ID",
    invalidTokenIdHint: "Use event-serial format.",
    lookupBeforeCheckin: "Look up the pass first.",
    lookup: "Lookup",
    lookingUp: "Looking up...",
    ticketsTab: "Tickets",
    eventIdentity: "Event identity",
    emptyTickets: "No tickets.",
    emptyTicketsHint: "Create a pass first, then transfer from the ticket wallet.",
    emptyEvents: "No events.",
    ticketQrLabel: "Ticket QR",
    sampleAdmitOne: "Admit one",
    seatFallback: "General",
    ticketSeat: "Seat",
    ticketOwner: "Owner",
    ticketUsed: "Used",
    ticketValid: "Valid",
    copyTokenId: "Copy Token ID",
    transferTicket: "Transfer",
    transferRecipient: "Transfer to",
    transferRecipientPlaceholder: "Recipient",
    ticketTokenId: "Token ID",
    lifecycleTransfer: "Transferring",
    evidence: "Evidence",
    evidenceShort: "Evidence",
    latestRequest: "Latest Request",
    latestResult: "Latest Result",
    requestEmpty: "No request.",
    resultEmpty: "No result.",
    viewOnExplorer: "View transaction on explorer",
    walletPassesVerified: "Wallet passes verified on-chain",
    walletPassesLoading: "Verifying wallet passes",
    walletPassesConnect: "Connect wallet to verify passes",
    walletPassesUnavailable: "Wallet pass verification unavailable",
    walletPassesUnavailableHint: "Retry after checking the network.",
    walletPassesPartialTitle: "Inventory verification is partial",
    walletPassesPartial: "{verified} of {total} passes are verified.",
    deactivate: "Deactivate",
    activate: "Activate",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [name, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(paramValue));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    eventsCount: 0,
    ticketsCount: 0,
    activeEventsCount: 0,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    runtimeStatus: "ready",
    runtimeMessage: "Verified testnet ticket contract",
    activeNetwork: "testnet",
    pendingOperation: null,
    selectedEventId: "",
    eventName: "Neo Builder Summit",
    eventVenue: "Neo Community Hall",
    eventStart: "2026-08-20 09:00",
    eventEnd: "2026-08-20 18:00",
    maxSupply: "120",
    notes: "Workshop pass",
    issueRecipient: "",
    issueSeat: "General",
    issueMemo: "",
    checkinTokenId: "",
    transferTokenId: "",
    transferRecipient: "",
    workflowStatus: "Ready",
    lastError: "",
    ticketsVerification: "wallet",
    ticketsExpectedCount: 0,
    gateTicketsVerification: "event",
    gateTicketsExpectedCount: 0,
    isLoading: false,
    isRefreshing: false,
    isRefreshingTickets: false,
    isRefreshingGateTickets: false,
    isRefreshingDiscovery: false,
    isRecovering: false,
    isCreating: false,
    isIssuing: false,
    isCheckingIn: false,
    isLookingUp: false,
    isTransferring: false,
    canIssueTicket: false,
    canCheckInTicket: false,
    canTransferTicket: false,
    events: [],
    discoveredEvents: [],
    tickets: [],
    gateTickets: [],
    selectedEvent: null,
    lookup: null,
    latestRequest: null,
    latestResult: null,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

const event = {
  id: "7",
  name: "Neo Builder Summit",
  venue: "Neo Community Hall",
  startTime: 1787216400,
  endTime: 1787248800,
  maxSupply: 120n,
  minted: 12n,
  active: true,
};

function optionByText(container: HTMLElement, selector: string, text: string) {
  return Array.from(container.querySelectorAll(selector)).find((option) => option.textContent?.includes(text)) as Element;
}

describe("Event Ticket Pass PlayArea (v2)", () => {
  it("renders the pass as a real resource-led entry scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".ticket-scene")).toBeTruthy();
    expect(container.querySelector(".ticket-scene__stage")).toBeNull();
    expect(container.querySelector(".ticket-scene__wash")).toBeNull();
    expect(container.querySelector(".ticket-pass__art")).toBeNull();
    expect(container.querySelector(".ticket-pass__shine")).toBeNull();
    expect((container.querySelector(".ticket-pass__texture") as HTMLImageElement)?.src).toContain("pass-artwork.webp");
    expect(container.querySelector(".ticket-design-preview")).toBeNull();
    expect(container.querySelector(".ticket-pass")).toBeTruthy();
    expect(container.querySelector(".ticket-gate")).toBeTruthy();
    expect(container.querySelector(".ticket-pass")?.getAttribute("data-provenance")).toBe("preview");
    expect(container.querySelector(".ticket-scene__phone")?.textContent).toContain("Preview");
    expect(container.textContent).not.toContain("1-001");
  });

  it("marks a chain-loaded pass as verified and keeps its real token in the hero", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          ticketsVerification: "verified",
          ticketsExpectedCount: 1,
          ticketsCount: 1,
          tickets: [{
            tokenId: "7-1",
            eventId: "7",
            eventName: "Neo Builder Summit",
            venue: "Neo Community Hall",
            startTime: 1787216400,
            seat: "VIP",
            owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
            used: false,
            active: true,
          }],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".ticket-pass")?.getAttribute("data-provenance")).toBe("verified-ticket");
    expect(container.querySelector(".ticket-pass__stub")?.textContent).toContain("7-1");
    expect(container.querySelector(".ticket-trust-chip--verified")?.textContent).toContain("verified on-chain");
  });

  it("turns an event blueprint card into the existing create event draft", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelectorAll(".ticket-blueprint-card").length).toBe(3);
    fireEvent.click(container.querySelectorAll(".ticket-blueprint-card")[1]);
    expect((container.querySelector(".ticket-blueprint-card--active") as HTMLElement).textContent).toContain("Hands-on workshop");
    expect(container.querySelector(".ticket-pass-dossier")?.textContent).toContain("Hands-on workshop");
    expect(container.querySelector(".ticket-quick-fields")).toBeNull();
    fireEvent.click(container.querySelector(".ticket-detail-toggle") as Element);
    const inputs = container.querySelectorAll<HTMLInputElement>(".ticket-field input");
    expect(inputs[0].value).toBe("Hands-on workshop");
    expect(inputs[1].value).toBe("Builder lab");

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createEvent", expect.objectContaining({
      eventName: "Hands-on workshop",
      eventVenue: "Builder lab",
      eventStart: "2026-08-21 13:00",
      eventEnd: "2026-08-21 17:00",
      maxSupply: "120",
      notes: "Limited-capacity workshop pass with reserved lab seating.",
    })));
  });

  it("makes a refresh-surviving pending action the only primary next step", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          pendingOperation: {
            phase: "ticket_issue",
            txid: "0xpending",
            eventName: "TicketIssued",
          },
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".ticket-pending-recovery")?.textContent).toContain("One action needs confirmation");
    expect(container.querySelector(".ticket-runtime-chip")?.textContent).toContain("Transaction pending");
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("Recover status");
    fireEvent.click(primary);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPending"));
    expect(dispatch).not.toHaveBeenCalledWith("createEvent", expect.anything());
  });

  it("shows public events without offering a fake purchase or self-claim", () => {
    const publicEvent = {
      ...event,
      id: "11",
      creator: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
      name: "Community Night",
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          discoveredEvents: [publicEvent],
          selectedEventId: "11",
          selectedEvent: null,
          events: [],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".ticket-discovery-strip")?.textContent).toContain("Community Night");
    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Issue guest pass"));
    expect(container.querySelector(".ticket-invitation-notice")).toBeTruthy();
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps disabled live modes visible before the first event exists", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Issue guest pass"));
    expect(container.querySelector(".ticket-mode-switch .semi-radio-checked")?.textContent).toContain("Issue guest pass");
    expect(container.querySelector(".ticket-empty-prompt")).toBeTruthy();
    expect(container.querySelector(".ticket-guest-lane")).toBeNull();
    expect(container.textContent).toContain("Create an event first.");

    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Run gate check-in"));
    expect(container.querySelector(".ticket-mode-switch .semi-radio-checked")?.textContent).toContain("Run gate check-in");
    expect(container.querySelector(".ticket-scanner-console")).toBeTruthy();
  });

  it("keeps event selection tucked in the drawer while issue stays on the main desk", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event, { ...event, id: "8", name: "Hack Night", minted: 2n }],
          eventsCount: 2,
          activeEventsCount: 2,
          selectedEvent: event,
          selectedEventId: "7",
          issueRecipient: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
          canIssueTicket: true,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".ticket-desk .ticket-event-card")).toBeTruthy();
    expect(container.querySelector(".ticket-guest-lane")).toBeTruthy();
    expect(container.querySelector(".ticket-address-strip")).toBeTruthy();
    expect(container.querySelector(".ticket-memo-chip")).toBeTruthy();
    expect(container.querySelector(".ticket-field--address")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Discover events"));
    fireEvent.click(container.querySelectorAll(".ticket-event-card")[1]);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("selectEvent", "8"));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("issueTicket", expect.objectContaining({
      eventId: "8",
      recipient: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
      seat: "General",
      memo: "",
    })));
  });

  it("runs lookup and check-in from the scanner desk", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          eventsCount: 1,
          activeEventsCount: 1,
          selectedEvent: event,
          selectedEventId: "7",
          checkinTokenId: "7-1",
          canCheckInTicket: true,
          tickets: [{ tokenId: "7-1", eventName: "Neo Builder Summit", seat: "VIP", owner: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", used: false }],
          gateTickets: [{ tokenId: "7-1", eventName: "Neo Builder Summit", seat: "VIP", owner: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", used: false }],
          gateTicketsVerification: "verified",
          gateTicketsExpectedCount: 1,
          ticketsCount: 1,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Run gate check-in"));
    expect(container.querySelector(".ticket-scanner-console")).toBeTruthy();
    expect(container.querySelector(".ticket-scan-slot")).toBeTruthy();
    expect(container.querySelector(".ticket-field--token")).toBeNull();
    expect(container.querySelector(".ticket-gate-queue")).toBeTruthy();
    expect(container.querySelector(".ticket-gate-pass")?.textContent).toContain("VIP");
    expect(container.querySelector(".ticket-verdict-card")?.textContent).toContain("Neo Builder Summit");
    fireEvent.click(container.querySelector(".ticket-scanner-console .ticket-secondary-action") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("lookupTicket", { tokenId: "7-1" }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("checkInTicket", { tokenId: "7-1" }));
  });

  it("blocks malformed gate tokens before lookup and explains the format inline", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          eventsCount: 1,
          selectedEvent: event,
          selectedEventId: "7",
          checkinTokenId: "not-a-token",
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Run gate check-in"));
    const input = container.querySelector(".ticket-scan-slot input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".ticket-scan-slot .mx2-open-field__hint")?.textContent).toContain("event-serial");
    expect((container.querySelector(".ticket-scanner-console .ticket-secondary-action") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets gate staff select an issued pass instead of typing a token id", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          eventsCount: 1,
          activeEventsCount: 1,
          selectedEvent: event,
          selectedEventId: "7",
          gateTickets: [
            { tokenId: "7-1", eventName: "Neo Builder Summit", seat: "VIP", owner: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", used: false },
            { tokenId: "7-2", eventName: "Neo Builder Summit", seat: "General", owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", used: true },
          ],
          gateTicketsVerification: "verified",
          gateTicketsExpectedCount: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(optionByText(container, ".ticket-mode-switch .semi-radio", "Run gate check-in"));
    expect(container.querySelectorAll(".ticket-gate-pass")).toHaveLength(2);
    fireEvent.click(container.querySelector(".ticket-gate-pass") as Element);
    expect((container.querySelector(".ticket-scan-slot input") as HTMLInputElement).value).toBe("7-1");
    expect(container.querySelector(".ticket-gate-pass--active")).toBeTruthy();
    expect(container.querySelector(".ticket-verdict-card")?.textContent).toContain("Owner");
  });

  it("renders tickets and events in the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          eventsCount: 1,
          activeEventsCount: 1,
          selectedEvent: event,
          selectedEventId: "7",
          tickets: [{ tokenId: "7-1", eventName: "Neo Builder Summit", seat: "VIP", used: false }],
          ticketsCount: 1,
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Tickets"));
    expect(container.textContent).toContain("Neo Builder Summit");
    expect(container.textContent).toContain("VIP");
    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Discover events"));
    expect(container.querySelector(".ticket-drawer-panel--events .ticket-event-card")).toBeTruthy();
  });

  it("routes a verified holder pass into the transfer drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const ticket = {
      tokenId: "7-1",
      eventName: "Neo Builder Summit",
      seat: "VIP",
      owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      used: false,
      active: true,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: ticket.owner,
          tickets: [ticket],
          ticketsCount: 1,
          ticketsExpectedCount: 1,
          ticketsVerification: "verified",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Tickets"));
    fireEvent.click(optionByText(container, ".ticket-list__actions .mx2-btn", "Transfer"));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("startTransfer", ticket));
    expect(container.querySelector(".ticket-drawer-shell")?.getAttribute("data-mode")).toBe("transfer");
  });

  it("presents the drawer as focused task modes instead of a flat panel wall", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          events: [event],
          eventsCount: 1,
          activeEventsCount: 1,
          selectedEvent: event,
          selectedEventId: "7",
          tickets: [{ tokenId: "7-1", eventName: "Neo Builder Summit", seat: "VIP", used: false }],
          ticketsCount: 1,
          latestRequest: { operation: "issueTicket" },
          latestResult: { txid: "0xabc" },
        })}
        dispatch={vi.fn()}
      />,
    );

    const toggle = container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLElement;
    expect(toggle.textContent).toContain("Details");
    fireEvent.click(toggle);

    const drawer = container.querySelector(".ticket-drawer-shell");
    expect(drawer).toBeTruthy();
    expect(drawer?.getAttribute("data-mode")).toBe("issue");
    expect(drawer?.querySelector(".ticket-drawer-tabs .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(drawer?.querySelectorAll(".ticket-drawer-tabs .semi-radio")).toHaveLength(6);
    expect(drawer?.querySelector(".ticket-drawer-tabs .semi-radio-checked")?.textContent).toContain("Issue Ticket");
    expect(drawer?.querySelectorAll(".ticket-drawer-panel").length).toBe(1);
    expect(drawer?.querySelectorAll(".ticket-drawer-panel.mx2-open-panel.semi-card").length).toBe(1);
    expect(drawer?.querySelector("h4")).toBeNull();
    expect(drawer?.querySelector(".mx2-open-panel__head")).toBeTruthy();
    expect(drawer?.querySelector(".ticket-drawer-panel--issue")).toBeTruthy();
    expect(drawer?.querySelector(".ticket-drawer-panel--event")).toBeNull();
    expect(drawer?.querySelector(".ticket-drawer-panel--tickets")).toBeNull();
    expect(drawer?.querySelectorAll(".ticket-drawer-field.mx2-open-field").length).toBe(3);
    expect(drawer?.querySelector(".ticket-drawer-input")).toBeNull();
    expect(drawer?.querySelector(".ticket-drawer-field input.semi-input")).toBeTruthy();

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Event identity"));
    expect(drawer?.getAttribute("data-mode")).toBe("event");
    expect(drawer?.querySelector(".ticket-drawer-panel--event")).toBeTruthy();
    expect(drawer?.querySelector(".ticket-drawer-panel--issue")).toBeNull();
    expect(drawer?.querySelector(".ticket-drawer-field textarea.semi-input-textarea")).toBeTruthy();

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Tickets"));
    expect(drawer?.querySelector(".ticket-drawer-panel--tickets")).toBeTruthy();
    expect(drawer?.querySelector(".ticket-drawer-panel--event")).toBeNull();

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Discover events"));
    expect(drawer?.querySelector(".ticket-drawer-panel--events .ticket-event-card")).toBeTruthy();
    expect(drawer?.querySelectorAll(".ticket-drawer-panel")).toHaveLength(1);

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Evidence"));
    expect(drawer?.querySelector(".ticket-evidence-grid")).toBeTruthy();
    expect(drawer?.querySelectorAll(".ticket-drawer-panel")).toHaveLength(1);
  });

  it("keeps unavailable drawer tasks as short mode-specific notices instead of inactive input walls", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const drawer = container.querySelector(".ticket-drawer-shell");

    expect(drawer?.getAttribute("data-mode")).toBe("event");
    expect(drawer?.querySelectorAll(".ticket-drawer-panel")).toHaveLength(1);
    expect(drawer?.querySelector(".ticket-drawer-panel--event")).toBeTruthy();

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Issue Ticket"));
    expect(drawer?.querySelectorAll(".ticket-drawer-panel")).toHaveLength(1);
    expect(drawer?.querySelectorAll(".ticket-drawer-notice")).toHaveLength(1);
    expect(drawer?.querySelectorAll(".ticket-drawer-notice.mx2-open-notice.semi-banner")).toHaveLength(1);
    expect(drawer?.querySelector(".ticket-drawer-panel--issue .ticket-drawer-field")).toBeNull();

    fireEvent.click(optionByText(container, ".ticket-drawer-tabs .semi-radio", "Transfer"));
    expect(drawer?.querySelectorAll(".ticket-drawer-panel")).toHaveLength(1);
    expect(drawer?.querySelectorAll(".ticket-drawer-notice")).toHaveLength(1);
    expect(drawer?.querySelector(".ticket-drawer-panel--transfer .ticket-drawer-field")).toBeNull();
    const transferPanelSubtitle = drawer?.querySelector(".ticket-drawer-panel--transfer .mx2-open-panel__copy span");
    expect(transferPanelSubtitle?.textContent).toBe("No tickets.");
    expect(drawer?.querySelector(".ticket-drawer-panel--transfer")?.textContent).not.toContain("Token ID");
    expect(drawer?.textContent).toContain("Create a pass first");
  });

  it("keeps motion and clean foreground hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "event-ticket-pass/src/PlayArea.scss"),
      "utf8",
    );
    const sharedStyles = fs.readFileSync(
      path.join(appsRoot, "shared/components-react/v2/v2.scss"),
      "utf8",
    );
    const motionStyles = fs.readFileSync(
      path.join(appsRoot, "shared/styles/v2/_motion.scss"),
      "utf8",
    );
    const playArea = fs.readFileSync(
      path.join(appsRoot, "event-ticket-pass/src/PlayArea.tsx"),
      "utf8",
    );
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("--mx2-stage-floor: #ffffff");
    expect(styles).toContain("--mx2-accent: #db2777");
    expect(styles).toMatch(/ticket-scene\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/ticket-scene\s*\{[\s\S]*background-image:\s*none/);
    expect(styles).not.toContain("ticket-scene__stage");
    expect(styles).not.toContain("ticket-scene__wash");
    expect(styles).not.toContain("ticket-pass__art");
    expect(styles).not.toContain("ticket-pass__shine");
    expect(styles).not.toContain("linear-gradient");
    expect(styles).not.toContain("radial-gradient");
    expect(styles).not.toContain("rgba(255, 250, 244, 0.64)");
    expect(styles).toMatch(/ticket-pass[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/ticket-pass__texture[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/ticket-pass__texture[\s\S]*opacity:\s*0\.82/);
    expect(styles).toMatch(/ticket-pass__main[\s\S]*background:\s*#fffef8/);
    expect(styles).toMatch(/ticket-pass__scanline[\s\S]*background:\s*var\(--mx2-accent\)/);
    expect(styles).toMatch(/ticket-gate__beam--active[\s\S]*background:\s*var\(--mx2-accent\)/);
    expect(styles).toMatch(/ticket-work-card--create[\s\S]*grid-template-columns:\s*auto minmax\(190px,\s*0\.42fr\) minmax\(0,\s*1fr\)/);
    expect(styles).not.toContain("ticket-design-preview");
    expect(styles).toMatch(/ticket-stage-stack[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/ticket-blueprint-row[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/ticket-blueprint-row[\s\S]*flex-wrap:\s*nowrap/);
    expect(styles).toMatch(/ticket-blueprint-row[\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/ticket-blueprint-card[\s\S]*flex:\s*0 0 clamp\(156px,\s*32%,\s*190px\)/);
    expect(styles).toMatch(/ticket-blueprint-card[\s\S]*min-height:\s*52px/);
    expect(styles).toMatch(/ticket-pass-dossier[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/ticket-work-card--issue,\s*[\s\S]*ticket-work-card--checkin\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(150px,\s*0\.56fr\) minmax\(0,\s*1\.44fr\)/);
    expect(styles).toMatch(/ticket-guest-lane[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(146px,\s*0\.48fr\)/);
    expect(styles).not.toContain("ticket-recipient-picks");
    expect(styles).not.toContain("ticket-recipient-chip");
    expect(styles).toMatch(/ticket-empty-prompt[\s\S]*grid-column:\s*3/);
    expect(styles).toMatch(/ticket-address-strip[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/ticket-address-strip \.mx2-open-field__control\.semi-input-wrapper[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/ticket-scan-slot \.mx2-open-field__control\.semi-input-wrapper[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/ticket-scanner-console[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/ticket-gate-queue,[\s\S]*ticket-verdict-card\s*\{[\s\S]*grid-column:\s*3/);
    expect(styles).toMatch(/ticket-gate-queue__list[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/ticket-gate-queue__head[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/ticket-gate-pass--active[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(styles).toMatch(/ticket-verdict-card[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*0\.7fr\) minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/ticket-drawer-shell[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/ticket-mode-switch \.ticket-mode-segmented\.mx2-open-segmented\.semi-radioGroup[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/ticket-drawer-tabs \.ticket-drawer-segmented\.mx2-open-segmented\.semi-radioGroup[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/ticket-drawer-tabs \.ticket-drawer-segmented\.mx2-open-segmented\.semi-radioGroup[\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/ticket-drawer-tabs \.ticket-drawer-segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio\s*\{[\s\S]*flex:\s*0 0 122px/);
    expect(styles).toMatch(/ticket-drawer-tabs \.ticket-drawer-segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio-checked[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/ticket-drawer-active-panel[\s\S]*grid-column:\s*1 \/ -1/);
    expect(styles).not.toContain("ticket-drawer-panel__head");
    expect(styles).not.toContain("ticket-drawer-notice__icon");
    expect(sharedStyles).toMatch(/mx2-open-panel\.semi-card[\s\S]*border-radius:\s*var\(--mx2-r-lg\)/);
    expect(sharedStyles).toMatch(/mx2-open-panel__head[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(sharedStyles).toMatch(/mx2-open-notice\.semi-banner[\s\S]*border-radius:\s*var\(--mx2-r-lg\)/);
    expect(motionStyles).toMatch(/@keyframes mx2-drawer-in[\s\S]*translateY\(12px\)/);
    expect(motionStyles).not.toContain("translateY(100%)");
    expect(playArea).not.toContain('dispatch("createEvent")');
    expect(playArea).not.toContain('dispatch("issueTicket")');
    expect(playArea).not.toContain('dispatch("lookupTicket")');
    expect(playArea).not.toContain('dispatch("checkInTicket")');
    expect(playArea).toContain('dispatch("createEvent", eventDraftPayload)');
    expect(playArea).toContain('dispatch("issueTicket", issuePayload)');
    expect(playArea).toContain('dispatch("lookupTicket", checkinPayload)');
    expect(playArea).toContain('dispatch("checkInTicket", checkinPayload)');
    expect(styles).toMatch(/ticket-drawer-field:not\(\.ticket-drawer-field--wide\)\.mx2-open-field[\s\S]*grid-template-columns:\s*minmax\(82px,\s*0\.42fr\) minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/ticket-drawer-field \.mx2-open-field__control[\s\S]*min-height:\s*38px/);
    expect(styles).toMatch(/ticket-drawer-panel--event \.ticket-drawer-fields[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(styles).toMatch(/ticket-drawer-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea[\s\S]*min-height:\s*66px/);
    expect(styles).not.toMatch(/ticket-drawer-input/);
    expect(styles).not.toContain("margin-bottom: 8px");
    expect(styles).toMatch(/ticket-evidence-grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*mx2-stage__head[\s\S]*flex-direction:\s*column/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-mode-switch \.ticket-mode-segmented\.mx2-open-segmented\.semi-radioGroup[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)[\s\S]*ticket-work-card--create \.ticket-pass-dossier[\s\S]*order:\s*2/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)[\s\S]*ticket-work-card--create \.ticket-blueprint-picker[\s\S]*order:\s*3/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*event-ticket-pass-play-area \.mx2-score[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*event-ticket-pass-play-area \.mx2-action-rail__row[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-scene[\s\S]*min-height:\s*286px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-pass[\s\S]*min-height:\s*176px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-empty-prompt[\s\S]*border-radius:\s*14px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-gate-queue__list,[\s\S]*ticket-verdict-card,[\s\S]*ticket-verdict-card dl[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-blueprint-card[\s\S]*flex:\s*0 0 136px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-blueprint-card[\s\S]*min-height:\s*44px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-blueprint-card__copy em[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-work-card__copy span[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-drawer-fields[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-drawer-tabs \.ticket-drawer-segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio[\s\S]*flex-basis:\s*116px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*ticket-drawer-panel--event \.ticket-drawer-grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*430px\)[\s\S]*ticket-scene[\s\S]*min-height:\s*274px/);
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
