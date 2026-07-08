import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../red-envelope/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    availableEnvelopes: "Active envelopes",
    claimTab: "Claim",
    createTab: "Create",
    claimablePool: "Claimable pool",
    claimContractRoute: "game.placeBet -> claimResult",
    contractRoute: "Contract route",
    enterPoolId: "Enter pool ID",
    envelopeId: "Envelope ID",
    expiryHours: "Expiry hours",
    hoursSuffix: "h",
    invalidAmount: "Enter at least 0.1 GAS",
    invalidExpiry: "Enter a valid expiry in hours",
    invalidPackets: "Enter 1-100 packets",
    invalidPerPacket: "Each packet must be at least 0.01 GAS",
    countExceeded: "Max 100 packets",
    myEnvelopes: "My envelopes",
    noActivity: "No recent claims",
    noActivityCopy: "Successful claims appear here.",
    noEnvelopes: "No active envelopes",
    packetCount: "Packet count",
    packetPreset: "{count} packets",
    perPacketLabel: "Average packet",
    recentClaimsTitle: "Recent claims",
    reclaimableTitle: "Reclaimable",
    reclaimEnvelope: "Reclaim",
    readyToClaim: "Claim request prepared",
    title: "Red Envelope",
    subtitle: "Claim or send Neo N3 GAS envelopes.",
    tokenGas: "GAS",
    claimRedEnvelope: "Claim Red Envelope",
    sendRedEnvelope: "Send Red Envelope",
    sendingRedEnvelope: "Sending packets...",
    opening: "Opening...",
    claimNow: "Claim now",
    claimTicketTitle: "Claim ticket",
    claimTicketReady: "Envelope matched",
    claimTicketPrepared: "Envelope ID prepared",
    claimTicketEmpty: "Waiting for envelope",
    claimTicketReadyDesc: "This ticket is linked to an active pool. Open once and review the wallet request.",
    claimTicketPreparedDesc: "The ID is filled. Claiming will ask the contract to verify whether it can be opened.",
    claimTicketEmptyDesc: "Scan a QR, paste a link ID, or pick an open envelope below.",
    scanOrPasteEnvelope: "Scan or paste ID",
    giftMachineTitle: "Lucky packet machine",
    createReadyDesc: "Ready to send. Each recipient draws a random share of the pool.",
    adjustEnvelopeSetup: "Adjust setup",
    packetUnit: "packets",
    readyToSendEnvelope: "Ready to send",
    congratulations: "Congratulations!",
    fromLabel: "From",
    luckyReceivedClose: "Collect",
    totalGas: "Total GAS",
    hourPreset: "{hours}h",
    withdrawCredit: "Withdraw",
    copyShareLink: "Copy share link",
    shareHint: "Share",
    prepaidCreditLabel: "Prepaid credit",
    safetyPanelTitle: "Transaction safety",
    safetyPanelCopy: "Claims and creates go through guarded OS services.",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function launch(url = "https://neomini.app/miniapps/red-envelope/index.html?network=testnet") {
  return parseMiniAppLaunchContext(url, "miniapp-redenvelope");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    claimCount: 1,
    claims: [{ id: "claim-1", envelopeId: "pool-alpha", amount: 0.42 }],
    envelopes: [
      { id: "pool-alpha", totalAmount: 8, packetCount: 8, openedCount: 5, remainingAmount: 3.2, remainingPackets: 3, active: true, canOpen: true, status: "active" },
      { id: "pool-closed", totalAmount: 2, packetCount: 4, openedCount: 4, remainingAmount: 0, remainingPackets: 0, active: false, canOpen: false, status: "closed" },
    ],
    isLoading: false,
    luckyMessage: null,
    openingId: null,
    poolCount: 1,
    totalClaimed: 0.42,
    totalCreated: 8,
    prepaidCredit: 0,
    lastCreatedEnvelopeId: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Red Envelope PlayArea (v2 scene-driven)", () => {
  it("renders the envelope scene with the claim mode active", () => {
    const { container } = render(
      <PlayArea t={t} state={baseState()} dispatch={vi.fn()} launchContext={launch()} />,
    );

    // The dominant scene uses real art assets, not CSS-drawn placeholders.
    expect(container.querySelector(".redenv-scene")).toBeTruthy();
    expect(container.querySelector(".redenv-scene__packet")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".redenv-scene__packet-art")?.getAttribute("src")).toContain("red-envelope-claim-card.webp");
    expect(container.querySelector(".redenv-scene__stage-art")).toBeNull();
    expect(container.querySelector(".redenv-scene__backdrop")).toBeNull();
    expect(container.querySelectorAll(".redenv-tab").length).toBe(2);
    // The primary action is the claim button.
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
    expect(container.querySelector(".mx2-btn--primary svg")).toBeTruthy();
    expect((screen.getByPlaceholderText("Enter pool ID") as HTMLInputElement).value).toBe("pool-alpha");
  });

  it("dispatches a claim from the envelope resource and shows opening motion", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={baseState()} dispatch={dispatch} launchContext={launch()} />,
    );

    // Fire the dominant envelope resource itself, not a secondary form button.
    fireEvent.click(container.querySelector(".redenv-scene__packet") as Element);

    // The scene flips to "opening" and the packet gains the tumble animation.
    await waitFor(() => {
      expect(container.querySelector('.redenv-scene[data-state="opening"]')).toBeTruthy();
      expect(container.querySelector(".redenv-scene__packet--opening")).toBeTruthy();
    });
    expect(dispatch).toHaveBeenCalledWith("claimEnvelope", { envelopeId: "pool-alpha" });
  });

  it("prefills the claim id from launch params", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({ envelopes: [], claims: [], claimCount: 0 })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/red-envelope/index.html?network=testnet&envelopeId=qr-pool-42",
        )}
      />,
    );

    expect((screen.getByPlaceholderText("Enter pool ID") as HTMLInputElement).value).toBe("qr-pool-42");
  });

  it("lets the user clear the claim ticket instead of immediately refilling the default", async () => {
    const { container } = render(
      <PlayArea t={t} state={baseState()} dispatch={vi.fn()} launchContext={launch()} />,
    );
    const input = screen.getByPlaceholderText("Enter pool ID") as HTMLInputElement;
    expect(input.value).toBe("pool-alpha");

    fireEvent.change(input, { target: { value: "" } });

    await waitFor(() => expect(input.value).toBe(""));
    expect(container.querySelector<HTMLButtonElement>(".mx2-action-rail .mx2-btn--primary")?.disabled).toBe(true);
  });

  it("switches to create mode and validates against contract limits", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ envelopes: [], claims: [], claimCount: 0 })}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/red-envelope/index.html?network=testnet&amount=0.1&count=100&expiryHours=12",
        )}
      />,
    );

    // Switch to create mode.
    fireEvent.click(screen.getByRole("tab", { name: "Create" }));
    expect(container.querySelector(".redenv-scene__gift")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".redenv-scene__gift-art")?.getAttribute("src")).toContain("red-envelope-claim-card.webp");
    // Create presets (3 groups) are present.
    expect(container.querySelectorAll(".redenv-presets__group").length).toBe(3);

    // With count=100 and amount=0.1, per-packet = 0.001 < 0.01 minimum → invalid.
    expect(container.querySelector(".redenv-create-error")).toBeTruthy();

    // Lower the packet count to make per-packet valid.
    fireEvent.click(screen.getByRole("button", { name: "8 packets" }));
    await waitFor(() => expect(container.querySelector(".redenv-create-error")).toBeNull());

    // Send dispatches createEnvelope with the form values.
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createEnvelope", expect.objectContaining({ amount: "0.1" })),
    );
  });

  it("shows the lucky modal when a claim wins", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ luckyMessage: { amount: 0.5, from: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" } })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    const modal = container.querySelector(".redenv-lucky-modal");
    expect(modal).toBeTruthy();
    expect(container.textContent).toContain("Congratulations");
    expect(container.textContent).toContain("0.5 GAS");
  });

  it("dismisses the lucky modal on collect", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ luckyMessage: { amount: 0.5, from: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" } })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    fireEvent.click(container.querySelector(".redenv-lucky-modal__card .mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("dismissOverlay");
  });

  it("tucks envelopes, claims, reclaim, and safety into a drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          envelopes: [
            { id: "pool-alpha", totalAmount: 8, packetCount: 8, openedCount: 5, remainingAmount: 3.2, remainingPackets: 3, active: true, canOpen: true, status: "active" },
            { id: "pool-expired", totalAmount: 2, packetCount: 4, remainingAmount: 0.6, remainingPackets: 1, active: false, reclaimable: true, status: "expired" },
          ],
        })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(".redenv-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".redenv-drawer h4")).toBeNull();
    expect(container.querySelector(".redenv-drawer p")).toBeNull();
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("active");
    expect(container.textContent).toContain("pool-alpha");
    expect(container.textContent).not.toContain("claim-1");

    fireEvent.click(screen.getByRole("tab", { name: /Recent claims/ }));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("claims");
    expect(container.querySelector('.redenv-drawer-list__item[data-outcome="won"]')).toBeTruthy();
    expect(container.textContent).toContain("0.42 GAS");

    fireEvent.click(screen.getByRole("tab", { name: /Reclaim/ }));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("reclaim");
    expect(container.textContent).toContain("pool-expir");

    fireEvent.click(screen.getByRole("tab", { name: /Transaction safety/ }));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("safety");
    expect(container.textContent).toContain("game.placeBet -> claimResult");
  });

  it("keeps motion and low-noise scene hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "red-envelope/src/PlayArea.scss"),
      "utf8",
    );
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toMatch(/\.redenv-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.redenv-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.redenv-scene::before\s*\{[\s\S]*content:\s*none/);
    expect(styles).not.toContain("redenv-scene__stage-art");
    expect(styles).not.toContain("redenv-scene__backdrop");
    expect(styles).toMatch(/\.redenv-scene__packet\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.redenv-scene__gift\s*\{[\s\S]*filter:\s*none/);
    expect(styles).not.toMatch(/\.redenv-scene__packet\s*\{[^}]*drop-shadow/);
    expect(styles).toMatch(/\.redenv-scene__packet-art\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.redenv-scene__gift-art\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.redenv-scene__packet-scrim\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.redenv-scene__packet-label\s*\{[\s\S]*text-shadow:\s*none/);
    expect(styles).toMatch(/\.redenv-scene__gift-copy\s*\{[\s\S]*text-shadow:\s*none/);
    expect(styles).toMatch(/\.redenv-scene__tabs\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.redenv-scene__tabs\s*\{[\s\S]*right:\s*16px/);
    expect(styles).not.toMatch(/\.redenv-scene__packet-art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.redenv-scene__gift-art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/filter:\s*saturate\(0\.72\) brightness\(1\.12\)/);
    expect(styles).toMatch(/\.redenv-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 178px/);
    expect(styles).not.toMatch(/\.redenv-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(styles).toMatch(/\.redenv-drawer-tabs\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.redenv-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.redenv-drawer-tabs button\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/\.redenv-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*18px/);
    expect(styles).toMatch(/\.redenv-drawer__panel-body\s*\{[\s\S]*display:\s*grid/);
    expect(styles).not.toContain(".redenv-drawer h4");
    expect(styles).not.toContain(".redenv-drawer p");
    const mobileBlock = styles.match(/@media \(max-width:\s*680px\)\s*\{[\s\S]*$/)?.[0] ?? "";
    expect(mobileBlock).toMatch(/\.redenv-scene\s*\{[\s\S]*min-height:\s*414px/);
    expect(mobileBlock).toMatch(/\.redenv-presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(96px,\s*1fr\)\)/);
    expect(mobileBlock).not.toMatch(/\.redenv-presets\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(mobileBlock).toMatch(/\.redenv-ticket-dock\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(mobileBlock).toMatch(/\.redenv-play-area \.mx2-score\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileBlock).not.toMatch(/\.redenv-play-area \.mx2-score\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(mobileBlock).toMatch(/\.redenv-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileBlock).toMatch(/\.redenv-drawer-tabs strong\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
  });
});
