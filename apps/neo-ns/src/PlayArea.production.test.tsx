// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "@shared/react/context";
import { scriptHashToAddress } from "./hooks/nnsRpc";
import PlayArea from "./PlayArea";
import publicManifest from "../neo-manifest.json";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const OWNER = "Nj39M97Rk2e23JiULBBMQmvpcnKaRHqxFf";
const RECEIVER = scriptHashToAddress("0x11223344556677889900aabbccddeeff00112233");

afterEach(() => cleanup());

function t(key: string, params: Record<string, string | number> = {}) {
  const messages: Record<string, string> = {
    title: "Neo Name Service",
    domainSuffix: ".neo",
    available: "Available",
    domainTaken: "Taken",
    nameRestricted: "Reserved",
    notForPublicRegistration: "Not publicly priced",
    resultRestrictedCopy: "This name is reserved.",
    resultIdleTitle: "Choose a .neo name",
    resultIdleEyebrow: "Ready to inspect",
    resultIdleCopy: "Type a name.",
    resultAvailableCopy: "This name is open.",
    resultTakenCopy: "This name is taken.",
    readyToSearch: "Ready to search",
    checkingName: "Checking name",
    readyToRegister: "Ready to register",
    nameUnavailable: "Name unavailable",
    confirmationPending: "Confirmation pending",
    pendingActionName: "Pending · {name}",
    pendingActionCopy: "Verify this transaction before another action.",
    recoverConfirmation: "Recover confirmation",
    checkingConfirmation: "Checking confirmation",
    searchDomain: "Search",
    registerDomain: "Register",
    nameInputLabel: "Find a name",
    enterDomainName: "myname",
    suggestionsLabel: "Try",
    registrationCost: "Cost",
    registrationCostPending: "Check after search",
    owner: "Owner",
    walletStatus: "Wallet",
    unknownOwner: "Unknown",
    disconnected: "Disconnected",
    domainsUnavailable: "Names unavailable",
    domainsLoading: "Loading names",
    noDomainsShort: "No names yet",
    noDomainsConnectHint: "Connect to see your names.",
    domainCountLabel: "{count} verified names",
    resultPanelLabel: "Registration status",
    routeLabel: "Name lifecycle",
    searchHint: "Verify spelling.",
    currentExpiry: "Expiry",
    contractChecking: "Contract pending",
    mainnet: "Neo N3 Mainnet",
    testnet: "Neo N3 Testnet",
    networkChecking: "Checking network",
    drawerDomains: "Domains",
    drawerTitle: "Domains and lifecycle",
    drawerExpiring: "Expiring",
    drawerManage: "Manage",
    drawerGuide: "Guide",
    myDomains: "My Domains",
    noDomainsHint: "No names.",
    noExpiringDomains: "No expiring names.",
    expiringSoon: "Expiring",
    manage: "Manage",
    statusUnknown: "Unknown",
    domainsStaleCopy: "The last verified snapshot is preserved.",
    notSet: "Not set",
    currentTarget: "Current target",
    targetAddress: "Target address",
    receiverAddress: "Receiver address",
    invalidAddressHint: "Enter a valid Neo N3 address.",
    invalidTransferAddress: "Enter a different valid receiver.",
    invalidDomainName: "Use a valid first-level name.",
    targetAlreadySet: "This name already resolves to that address.",
    setTarget: "Set target",
    transferDomain: "Transfer domain",
    reviewTransfer: "Review transfer",
    confirmTransfer: "Confirm transfer",
    transferReviewCopy: "Move this name to {address}.",
    cancelManage: "Back",
    reviewRenewal: "Review renewal price",
    renewQuoteCopy: "Renew {name} for {cost} GAS.",
    expiredRenewQuoteCopy: "{name} is expired; quote {cost} GAS.",
    confirmRenew: "Confirm renew",
    cancel: "Cancel",
    howTitle: "How names work",
    howSearchLabel: "Search",
    howSearchDesc: "Find a name.",
    howPriceLabel: "Price",
    howPriceDesc: "Read price.",
    howOwnLabel: "Own",
    howOwnDesc: "Own the NFT.",
    howRenewLabel: "Renew",
    howRenewDesc: "Renew it.",
    howNote: "Names resolve to addresses.",
    heroAlt: "Registry desk",
    eyebrow: "Name Service",
    docSubtitle: "Human-readable Neo names",
    expired: "Expired",
    copyTxid: "Copy txid",
    recoveryStorageUnavailableInline: "Wallet actions are paused.",
  };
  return Object.entries(params).reduce(
    (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
    messages[key] ?? key,
  );
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: OWNER,
    walletStatus: "Connected",
    domainCount: 0,
    domainsStatus: "chain",
    expiringSoon: 0,
    myDomains: [],
    loading: false,
    error: "",
    managingDomain: null,
    searchQuery: "",
    searchResult: null,
    isSearching: false,
    registrationCost: "",
    renewQuote: null,
    pendingOperation: null,
    isRecovering: false,
    transactionNotice: "",
    activeNetwork: "mainnet",
    activeContract: "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
    recoveryStorageStatus: "ready",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)]));
}

describe("Neo NS production PlayArea states", () => {
  it("uses the real registry scene for catalog identity and handles rejected dispatches", async () => {
    expect(publicManifest.urls.banner).toBe("/miniapps/neo-ns/neo-ns-registry-desk.webp");
    const dispatch = vi.fn().mockRejectedValue(new Error("handled action failure"));
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: "alice" })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("searchDomain"));
  });

  it("makes receipt recovery the only primary action while a tx is pending", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(<PlayArea t={t} state={state({
      pendingOperation: {
        kind: "register",
        name: "alice.neo",
        network: "mainnet",
        txid: `0x${"ab".repeat(32)}`,
      },
    })} dispatch={dispatch} />);

    fireEvent.click(getByText("Recover confirmation"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPending"));
    fireEvent.click(getByText("Copy txid"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("copyPendingTxid"));
    expect(dispatch).not.toHaveBeenCalledWith("registerDomain");
  });

  it("keeps malformed names out of the primary action instead of submitting a form-like error", () => {
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: "-bad" })} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("Use a valid first-level name.");
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".ns-search-field input")?.getAttribute("aria-invalid")).toBe("true");
  });

  it("supports arrow-key navigation across name suggestions", () => {
    const appState = state();
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);
    const suggestions = container.querySelectorAll<HTMLButtonElement>(".ns-suggestions__group [role=radio]");
    suggestions[0]?.focus();
    fireEvent.keyDown(suggestions[0] as Element, { key: "ArrowRight" });

    expect(appState.searchQuery!.get()).toBe("agent");
    expect(document.activeElement).toBe(suggestions[1]);
  });

  it("shows a reserved name without fabricating an owner or zero price", () => {
    const { container } = render(<PlayArea t={t} state={state({
      searchQuery: "a",
      searchResult: { name: "a.neo", available: false, restricted: true, price: "", priceBase: "-1" },
    })} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("Reserved");
    expect(container.textContent).toContain("Not publicly priced");
    expect(container.textContent).not.toContain("0 GAS");
  });

  it("preserves and labels the last verified domain list when refresh fails", () => {
    const domain = { name: "alice.neo", owner: OWNER, expiry: Date.now() + 86_400_000 };
    const { container, getByText } = render(<PlayArea t={t} state={state({
      domainCount: 1,
      domainsStatus: "failed",
      myDomains: [domain],
    })} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(getByText("alice.neo")).toBeTruthy();
    expect(container.textContent).toContain("The last verified snapshot is preserved.");
  });

  it("requires a second, receiver-specific confirmation before transfer", async () => {
    const domain = { name: "alice.neo", owner: OWNER, expiry: Date.now() + 86_400_000 };
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state({ managingDomain: domain })} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const receiverInput = container.querySelectorAll<HTMLInputElement>(".ns-manage-input .semi-input")[1]!;
    fireEvent.change(receiverInput, { target: { value: RECEIVER } });
    fireEvent.click(getByText("Review transfer"));
    expect(dispatch).not.toHaveBeenCalledWith("handleTransfer", RECEIVER);
    fireEvent.click(getByText("Confirm transfer"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("handleTransfer", RECEIVER));
  });

  it("shows the exact GAS renewal quote before confirmation", async () => {
    const domain = { name: "alice.neo", owner: OWNER, expiry: Date.now() + 86_400_000 };
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state({
      managingDomain: domain,
      renewQuote: { name: "alice.neo", price: "2", priceBase: "200000000", expiry: domain.expiry },
    })} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.textContent).toContain("Renew alice.neo for 2 GAS.");
    fireEvent.click(getByText("Confirm renew"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("handleRenew", domain));
  });

  it("shows every owned name in the secondary drawer and labels expired assets", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      name: `name${index}.neo`,
      owner: OWNER,
      expiry: index === 0 ? Date.now() - 1_000 : Date.now() + 86_400_000,
    }));
    const { container } = render(<PlayArea t={t} state={state({
      domainCount: rows.length,
      myDomains: rows,
    })} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelectorAll(".ns-domain-row")).toHaveLength(12);
    expect(container.textContent).toContain("Expired");
  });

  it("does not offer a target write when the address is already current", () => {
    const domain = { name: "alice.neo", owner: OWNER, expiry: Date.now() + 86_400_000, target: RECEIVER };
    const { container } = render(<PlayArea t={t} state={state({ managingDomain: domain })} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.textContent).toContain("This name already resolves to that address.");
    const targetButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".ns-manage-field button"))
      .find((button) => button.textContent?.includes("Set target"));
    expect(targetButton?.disabled).toBe(true);
  });
});
