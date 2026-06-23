import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-ns/src/PlayArea";
import type { Domain } from "../../neo-ns/src/hooks/useNeoNS";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const OWNER = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const TARGET = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Neo Name Service",
    docSubtitle: "Human-readable .neo domain names for Neo addresses",
    tabDomains: "Domains",
    expiringSoon: "Expiring",
    walletStatus: "Wallet",
    searchDomain: "Search Domain",
    enterDomainName: "myname.neo",
    search: "Search",
    connectedAddress: "Address",
    domainAvailable: "Available",
    domainTaken: "Taken",
    registrationCost: "Cost",
    register: "Register",
    owner: "Owner",
    noDomains: "You don't own any domains yet",
    noDomainsHint: "Search for a name above to claim your first .neo domain.",
    manageTitle: "Manage Domain",
    cancelManage: "Back to List",
    currentOwner: "Current Owner",
    currentExpiry: "Expiry Date",
    currentTarget: "Current Target",
    notSet: "Not Set",
    setTarget: "Set Target Address",
    targetAddress: "Target Address",
    transferDomain: "Transfer Domain",
    receiverAddress: "Receiver Address",
    invalidAddressHint:
      "Enter a valid Neo N3 address (starts with N, 34 characters).",
  };
  return messages[key] ?? key;
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    address: "",
    domainCount: 0,
    walletStatus: "Disconnected",
    expiringSoon: 0,
    myDomains: [],
    loading: false,
    error: "",
    managingDomain: null,
    searchQuery: "",
    searchResult: null,
    isSearching: false,
    registrationCost: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function domain(overrides: Partial<Domain> = {}): Domain {
  return {
    name: "alice.neo",
    owner: OWNER,
    expiry: Date.UTC(2030, 0, 1),
    ...overrides,
  };
}

describe("Neo NS PlayArea", () => {
  it("renders the registration row with cost when a name is available", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          searchResult: { name: "free.neo", available: true, price: 5 },
          registrationCost: 5,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".neo-ns-play-area--available")).toBeTruthy();
    expect(document.querySelector(".nns-result-card--available")).toBeTruthy();
    const resultAction = document.querySelector(".nns-result-action");
    expect(resultAction?.textContent).toContain("Cost");
    expect(resultAction?.textContent).toContain("5 GAS");
    expect(screen.getByRole("button", { name: "Register" })).toBeTruthy();
    // No owner row for an available name.
    expect(document.querySelector(".nns-owner-line")).toBeNull();
  });

  it("shows the resolved owner (not just a Taken pill) for a taken name", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          searchResult: { name: "taken.neo", available: false, owner: OWNER },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".neo-ns-play-area--taken")).toBeTruthy();
    expect(document.querySelector(".nns-result-card--taken")).toBeTruthy();
    // The owner address is surfaced to the user.
    const ownerRow = document.querySelector(".nns-owner-line");
    expect(ownerRow).toBeTruthy();
    expect(ownerRow?.textContent).toContain("Owner");
    expect(ownerRow?.textContent).toContain(OWNER);
    // The available register row is not shown for a taken name.
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("dispatches searchDomain on Search click", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={baseState({ searchQuery: "alice" })} dispatch={dispatch} />,
    );

    expect(container.querySelector(".neo-ns-play-area--query-ready")).toBeTruthy();
    expect(container.querySelector(".nns-search-button--ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("searchDomain"));
  });

  it("keeps the registry search motion and reduced-motion fallback covered", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../neo-ns/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes nns-hero-drift");
    expect(styles).toContain("@keyframes nns-registry-scan");
    expect(styles).toContain("@keyframes nns-registry-badge-ready");
    expect(styles).toContain("@keyframes nns-primary-ready");
    expect(styles).toContain("@keyframes nns-result-reveal");
    expect(styles).toContain("@keyframes nns-route-pulse");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.nns-hero__stage img[\s\S]*animation:\s*none/,
    );
  });

  it("shows the current target record in the manage panel when set", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({ managingDomain: domain({ target: TARGET }) })}
        dispatch={vi.fn()}
      />,
    );

    const info = document.querySelector(".manage-info");
    expect(info?.textContent).toContain("Current Target");
    expect(info?.textContent).toContain(TARGET);
  });

  it("falls back to 'Not Set' when a domain has no target record", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({ managingDomain: domain({ target: undefined }) })}
        dispatch={vi.fn()}
      />,
    );

    const info = document.querySelector(".manage-info");
    expect(info?.textContent).toContain("Current Target");
    expect(info?.textContent).toContain("Not Set");
  });

  it("disables the action buttons until a valid address is entered, and shows an inline hint for invalid input", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({ managingDomain: domain() })}
        dispatch={vi.fn()}
      />,
    );

    const setTargetBtn = screen.getByRole("button", {
      name: "Set Target Address",
    }) as HTMLButtonElement;
    const transferBtn = screen.getByRole("button", {
      name: "Transfer Domain",
    }) as HTMLButtonElement;

    // Empty inputs => both actions disabled, no error yet.
    expect(setTargetBtn.disabled).toBe(true);
    expect(transferBtn.disabled).toBe(true);
    expect(document.querySelector(".field-error")).toBeNull();

    // Invalid address => inline hint appears + button stays disabled.
    const targetInput = screen.getByLabelText(
      "Set Target Address",
    ) as HTMLInputElement;
    const transferInput = screen.getByLabelText(
      "Transfer Domain",
    ) as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: "not-an-address" } });
    expect(
      screen.getByText(
        "Enter a valid Neo N3 address (starts with N, 34 characters).",
      ),
    ).toBeTruthy();
    expect(setTargetBtn.disabled).toBe(true);

    // Valid address => hint clears + button enables.
    fireEvent.change(targetInput, { target: { value: TARGET } });
    expect(document.querySelector(".field-error")).toBeNull();
    expect(setTargetBtn.disabled).toBe(false);
    // Transfer is independent and still disabled while empty.
    expect(transferBtn.disabled).toBe(true);

    fireEvent.change(transferInput, { target: { value: OWNER } });
    expect(transferBtn.disabled).toBe(false);
  });
});
