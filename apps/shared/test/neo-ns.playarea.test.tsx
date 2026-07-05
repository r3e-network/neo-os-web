import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-ns/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const m: Record<string, string> = {
    title: "Neo Name Service",
    domainSuffix: ".neo",
    available: "Available",
    domainTaken: "Taken",
    enterDomainName: "myname",
    eyebrow: "Neo NS",
    docSubtitle: "Domain names on Neo.",
    myDomains: "My Domains",
    registerDomain: "Register",
    searchDomain: "Search",
    manage: "Manage",
    expiringSoon: "Expiring soon",
    noDomains: "No domains",
    noDomainsHint: "Search for a name to claim one.",
    noExpiringDomains: "No expiring domains.",
    resultIdleTitle: "Choose a .neo name",
    resultIdleEyebrow: "Ready to inspect",
    resultIdleCopy: "Type a name to inspect it.",
    resultAvailableCopy: "This name is open.",
    resultTakenCopy: "This name is taken.",
    registrationCost: "Cost",
    registrationCostPending: "Check after search",
    routeLabel: "Name lifecycle",
    owner: "Owner",
    walletStatus: "Wallet",
    unknownOwner: "Unknown",
    searchHint: "Verify spelling before registering.",
    readyToSearch: "Ready to search",
    checkingName: "Checking name",
    readyToRegister: "Ready to register",
    nameUnavailable: "Name unavailable",
    nameInputLabel: "Find a name",
    suggestionsLabel: "Try",
    resultPanelLabel: "Registration status",
    drawerTitle: "Domains and lifecycle",
    drawerDomains: "Domains",
    drawerExpiring: "Expiring",
    drawerManage: "Manage",
    drawerGuide: "Guide",
    notSet: "Not set",
    currentExpiry: "Expiry Date",
    currentTarget: "Current Target",
    targetAddress: "Target Address",
    receiverAddress: "Receiver Address",
    cancelManage: "Back to List",
    setTarget: "Set Target Address",
    transferDomain: "Transfer Domain",
    renew: "Renew",
    howTitle: "How .neo names work",
    howSearchLabel: "1 Search",
    howSearchDesc: "Look up any name.",
    howPriceLabel: "2 Price",
    howPriceDesc: "Check GAS cost.",
    howOwnLabel: "3 Own",
    howOwnDesc: "Point it at an address.",
    howRenewLabel: "4 Renew",
    howRenewDesc: "Renew before expiry.",
    howNote: "Names map to wallet addresses.",
    heroAlt: "Neo NS registry desk",
  };
  return m[key] ?? key;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    address: "",
    domainCount: 0,
    walletStatus: "",
    expiringSoon: 0,
    myDomains: [],
    loading: false,
    error: "",
    managingDomain: null,
    searchQuery: "",
    searchResult: null,
    isSearching: false,
    registrationCost: 0,
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}

describe("Neo NS PlayArea (v2)", () => {
  it("renders a focused name desk instead of a score overview", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".ns-desk")).toBeTruthy();
    expect(container.querySelector(".ns-claim")).toBeTruthy();
    expect(container.querySelector(".ns-domain-card")).toBeTruthy();
    expect(container.querySelector(".ns-registry-card")).toBeTruthy();
    expect(container.querySelector(".ns-search-line")).toBeTruthy();
    expect(container.querySelector(".ns-input-field .semi-input")).toBeTruthy();
    expect(container.querySelectorAll(".ns-suggestions__group .semi-radio")).toHaveLength(3);
    expect(container.querySelector<HTMLImageElement>(".ns-registry-art__image")?.getAttribute("src")).toContain("neo-ns-registry-desk.webp");
    expect(container.querySelector(".mx2-score")).toBeFalsy();
    expect(container.textContent).toContain("Choose a .neo name");
    expect(container.textContent).toContain("Ready to search");
    expect(container.textContent).not.toContain("🌐");
  });

  it("dispatches searchDomain", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: "test" })} dispatch={d} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(d).toHaveBeenCalledWith("searchDomain"));
  });

  it("dispatches registerDomain when the visible result is available", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: "test", searchResult: { name: "test.neo", available: true }, registrationCost: 10 })} dispatch={d} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(d).toHaveBeenCalledWith("registerDomain"));
  });

  it("keeps domain management in a tabbed drawer", async () => {
    const domain = {
      name: "alice.neo",
      expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
      target: "NdhB6x7e3n7wXr4WDXQxG2yv8nT4h9tJ1H",
    };
    const d = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state({ domainCount: 1, myDomains: [domain], expiringSoon: 1 })} dispatch={d} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelectorAll(".ns-drawer-tabs__group .semi-radio")).toHaveLength(3);
    expect(container.textContent).toContain("alice.neo");

    fireEvent.click(getByText("Manage"));

    await waitFor(() => expect(d).toHaveBeenCalledWith("showManage", domain));
    expect(container.querySelector(".ns-drawer-panel--manage")).toBeTruthy();
    expect(container.querySelectorAll(".ns-drawer-tabs__group .semi-radio")).toHaveLength(4);
    expect(container.querySelector(".ns-drawer-tabs__group .semi-radio-checked .ns-drawer-tab")?.textContent).toContain("Manage");
    expect(container.querySelectorAll(".ns-manage-input .semi-input")).toHaveLength(2);
    expect(container.textContent).toContain("Target Address");
    expect(container.textContent).toContain("Transfer Domain");
  });

  it("keeps the name service resource-led and away from flat form walls", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-ns/src/PlayArea.scss`, "utf8");
    const tsx = fs.readFileSync(`${process.cwd()}/../neo-ns/src/PlayArea.tsx`, "utf8");

    expect(tsx).not.toMatch(/\bscore=\{/);
    expect(s).toContain("@media (prefers-reduced-motion: reduce)");
    expect(s).toMatch(/\.neo-ns-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*var\(--mx2-bg-2\)/);
    expect(s).toMatch(/\.ns-desk\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.12fr\) minmax\(280px,\s*0\.88fr\)/);
    expect(s).toMatch(/\.ns-desk\s*\{[\s\S]*background:\s*#fffaf2/);
    expect(s).toMatch(/\.ns-domain-card\s*\{/);
    expect(s).toMatch(/\.ns-search-line__control\s*\{/);
    expect(s).toMatch(/\.ns-input-field \.semi-input\s*\{[\s\S]*font-size:\s*28px/);
    expect(s).toMatch(/\.ns-suggestions__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*flex-wrap:\s*wrap/);
    expect(s).toMatch(/\.ns-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*flex-wrap:\s*wrap/);
    expect(s).toMatch(/\.ns-drawer-tabs__group \.semi-radio-checked \.ns-drawer-tab\s*\{[\s\S]*background:\s*var\(--ns-mint-soft\)/);
    expect(s).toMatch(/\.ns-manage-input\.mx2-open-field__control\s*\{[\s\S]*background:\s*#fbfffd/);
    expect(s).toMatch(/\.ns-guide-grid\s*\{/);
    expect(s).toMatch(/\.neo-ns-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
    expect(tsx).toContain("OpenUiProvider");
    expect(tsx).toContain("OpenUiSegmented");
    expect(tsx).toContain("OpenUiTextField");
    expect(tsx).not.toMatch(/<(input|textarea|select)\b/);
    expect(tsx).not.toContain('role="tab"');
    expect(tsx).not.toContain('role="tablist"');
    expect(tsx).not.toContain('role="radio"');
    expect(tsx).not.toContain('role="radiogroup"');
    expect(s).not.toMatch(/AI-generated scene backdrop|ns-scene__backdrop|🌐/);
    expect(s).not.toMatch(/font-size:\s*clamp\(/);
  });
});
