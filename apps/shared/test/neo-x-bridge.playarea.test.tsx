import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-x-bridge/src/PlayArea";
import { buildAssetBridgeHandoff } from "../../neo-x-bridge/src/bridgeConsole";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const environment = String(o.bridgeEnvironment ?? "mainnet");
  const base = {
    n3Wallet: {
      environment,
      chain: "neo-n3",
      network: environment === "testnet" ? "neo-n3-testnet" : "neo-n3-mainnet",
      address: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      checkedAt: "2026-07-12T00:00:00.000Z",
      balances: {
        GAS: { units: "1250000000", display: "12.5", decimals: 8 },
        NEO: { units: "25", display: "25", decimals: 0 },
      },
    },
    timeline: [
      { labelKey: "timelineSource", detailKey: "timelineSourceDetail", state: "done" },
      { labelKey: "timelineBridge", detailKey: "timelineBridgeDetail", state: "active" },
      { labelKey: "timelineSettle", detailKey: "timelineSettleDetail", state: "waiting" },
    ],
  };
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neo-x-bridge PlayArea (v2)", () => {
  it("renders a bright route stage, GAS/NEO selector, verified balance, and honest quote boundary", () => {
    const { container } = render(<PlayArea t={t} state={state({
      bridgeEnvironment: "testnet",
      bridgeAppUrl: "https://testnet.bridge.banelabs.org/",
      serviceBoundary: {
        environment: "testnet",
        n3Rpc: "ready",
        neoXRpc: "ready",
        quoteService: "official-app-only",
        destinationStatusService: "unavailable",
      },
    })} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".nxb-route-stage__route")).toBeTruthy();
    expect(container.querySelector(".nxb-route-stage__art[src*='bridge-route']")).toBeTruthy();
    expect(container.querySelector(".nxb-route-rail__packet")).toBeTruthy();
    expect(container.querySelectorAll("img.nxb-x-mark")).toHaveLength(1);
    expect(container.querySelector(".nxb-mode-switch")).toBeTruthy();
    expect(container.querySelectorAll(".nxb-mode-switch [role='tab']")).toHaveLength(2);
    expect(container.querySelector(".nxb-composer")).toBeTruthy();
    expect(container.querySelectorAll(".nxb-asset-switch [role='radio']")).toHaveLength(2);
    expect(container.querySelector(".nxb-balance-read")?.textContent).toContain("12.5 GAS");
    expect(container.querySelector(".nxb-bound-summary")?.textContent).toContain("officialBridgeRequired");
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("prepareHandoffAction");
    expect(container.textContent).not.toMatch(/🌉|⚡/);
  });

  it("uses the primary action to connect the source wallet before enabling a handoff", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea
      t={t}
      state={state({ n3Wallet: null })}
      dispatch={dispatch}
    />);
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("connectSourceWallet");
    expect(primary.disabled).toBe(false);
    fireEvent.click(primary);
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connectBridgeWallet", { chain: "neo-n3" });
    });
  });

  it("surfaces a connected destination-wallet mismatch immediately", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          neoXWallet: {
            environment: "mainnet",
            chain: "neo-x",
            network: "neo-x-mainnet",
            address: "0x2222222222222222222222222222222222222222",
            checkedAt: "2026-07-12T00:00:00.000Z",
            balances: {
              GAS: { units: "1000000000000000000", display: "1", decimals: 18 },
              NEO: { units: null, display: null, decimals: 0 },
            },
          },
        })}
        dispatch={vi.fn()}
        launchContext={{ params: { amount: "1", recipient: "0x1111111111111111111111111111111111111111" } }}
      />,
    );

    expect(screen.getByText("errDestinationWalletMismatch")).toBeTruthy();
    expect(screen.getByText("recipientMatchBoundary")).toBeTruthy();
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
  });

  it("switches to whole-unit NEO without turning the bridge workspace into a generic form", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("radio", { name: /NEO/ }));
    fireEvent.change(screen.getByLabelText("amount"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/destinationAddress/), {
      target: { value: "0x1111111111111111111111111111111111111111" },
    });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge", {
        direction: "n3-to-neox",
        asset: "NEO",
        amount: "2",
        recipient: "0x1111111111111111111111111111111111111111",
      });
    });
  });

  it("hydrates the real workspace from host launch parameters instead of rebuilding a host-side form", () => {
    const sourceTx = `0x${"ab".repeat(32)}`;
    render(
      <PlayArea
        t={t}
        state={state({ recoverySourceTx: "" })}
        dispatch={vi.fn()}
        launchContext={{
          operation: "trackBridgeOperation",
          params: {
            direction: "neox-to-n3",
            sourceTx,
          },
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: /verifyTransfer/ }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByLabelText("sourceTx") as HTMLInputElement).value).toBe(sourceTx);
    expect(document.querySelector(".nxb-route-stage__heading strong")?.textContent).toBe("Neo X → Neo N3");
  });

  it("keeps an expired local review ticket visible and renews it instead of losing recovery context", () => {
    const recipient = "0x1111111111111111111111111111111111111111";
    const handoff = buildAssetBridgeHandoff(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient,
        sourceAccount: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      },
      "2000-01-01T00:00:00.000Z",
      "testnet",
    );
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ bridgeEnvironment: "testnet", activeHandoff: handoff })}
        dispatch={dispatch}
        launchContext={{ params: { direction: "n3-to-neox", amount: "1", recipient } }}
      />,
    );

    expect(screen.getByText("handoffExpiredTitle")).toBeTruthy();
    expect(container.querySelector(".nxb-expired-ticket")).toBeTruthy();
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("renewHandoffAction");
    expect(dispatch).not.toHaveBeenCalledWith("discardBridgeIntent");
  });

  it("keeps the survey-style generic operation panel and incomplete MessageBridge action retired", () => {
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(`${process.cwd()}/../neo-x-bridge/neo-manifest.json`, "utf8"));
    const config = fs.readFileSync(`${process.cwd()}/../neo-x-bridge/src/appConfig.ts`, "utf8");
    const main = fs.readFileSync(`${process.cwd()}/../neo-x-bridge/src/main.tsx`, "utf8");
    const bridgeConsole = fs.readFileSync(`${process.cwd()}/../neo-x-bridge/src/bridgeConsole.ts`, "utf8");

    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.stateSource).toBeUndefined();
    expect(manifest.tags).not.toContain("message-bridge");
    expect(config).toMatch(/operations:\s*\[\]/);
    expect(main).not.toContain('actions.register("prepareMessageBridge"');
    expect(bridgeConsole).not.toContain("buildMessageBridgeIntent");
  });

  it("hides stale receipt evidence as soon as the hash or route changes", async () => {
    const sourceTx = `0x${"ab".repeat(32)}`;
    const nextTx = `0x${"cd".repeat(32)}`;
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          bridgeEnvironment: "testnet",
          recoveryDirection: "neox-to-n3",
          recoverySourceTx: sourceTx,
          verification: {
            environment: "testnet",
            direction: "neox-to-n3",
            sourceTx,
            sourceTransaction: "confirmed",
            sourceEvent: "unverified",
          },
        })}
        dispatch={dispatch}
        launchContext={{ operation: "trackBridgeOperation", params: {} }}
      />,
    );

    expect(screen.getByText("sourceOnlyConfirmed")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("sourceTx"), { target: { value: nextTx } });
    expect(screen.queryByText("sourceOnlyConfirmed")).toBeNull();
    expect(dispatch).toHaveBeenCalledWith("resetBridgeVerification", { direction: "neox-to-n3" });

    fireEvent.click(container.querySelector(".nxb-swap-route") as Element);
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("resetBridgeVerification", { direction: "n3-to-neox" });
    });
    expect((screen.getByLabelText("sourceTx") as HTMLInputElement).value).toBe("");
  });

  it("locks the source hash while an RPC check is in flight", () => {
    const sourceTx = `0x${"ef".repeat(32)}`;
    render(
      <PlayArea
        t={t}
        state={state({
          recoveryDirection: "neox-to-n3",
          recoverySourceTx: sourceTx,
          verificationState: "checking",
          actionBusy: true,
        })}
        dispatch={vi.fn()}
        launchContext={{ operation: "trackBridgeOperation", params: {} }}
      />,
    );
    expect((screen.getByLabelText("sourceTx") as HTMLInputElement).disabled).toBe(true);
  });

  it("binds asset fields into preparation and keeps source verification separate", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ bridgeEnvironment: "testnet" })} dispatch={dispatch} />);
    const modeTabs = container.querySelectorAll(".nxb-mode-switch [role='tab']");
    const primary = () => container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText("amount"), { target: { value: "1.25" } });
    fireEvent.change(screen.getByLabelText(/destinationAddress/), {
      target: { value: "0x1111111111111111111111111111111111111111" },
    });
    fireEvent.click(primary());
    fireEvent.click(modeTabs[1]);
    expect(primary().textContent).toContain("verifySourceAction");
    fireEvent.change(screen.getByLabelText("sourceTx"), {
      target: { value: `0x${"ab".repeat(32)}` },
    });
    fireEvent.click(primary());

    expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge", {
      direction: "n3-to-neox",
      asset: "GAS",
      amount: "1.25",
      recipient: "0x1111111111111111111111111111111111111111",
    });
    expect(dispatch).toHaveBeenCalledWith("trackBridgeOperation", expect.objectContaining({
      bridgeKind: "asset",
      direction: "n3-to-neox",
      sourceTx: `0x${"ab".repeat(32)}`,
    }));
  });

  it("keeps bridge metadata behind drawer tabs", () => {
    const { container } = render(<PlayArea t={t} state={state({ bridgeAppUrl: "https://xbridge.neo.org/", requestCount: 2 })} dispatch={vi.fn()} />);

    expect(container.querySelector(".nxb-drawer")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".nxb-drawer")).toBeTruthy();
    expect(container.querySelectorAll(".nxb-drawer-tabs [role='tab']")).toHaveLength(3);
    expect(container.querySelector(".nxb-drawer-panel[data-mode='handoff']")).toBeTruthy();
    expect(container.querySelector(".nxb-evidence-timeline")).toBeNull();

    fireEvent.click(container.querySelectorAll(".nxb-drawer-tabs [role='tab']")[1]);
    expect(container.querySelector(".nxb-drawer-panel[data-mode='evidence']")).toBeTruthy();
    expect(container.querySelector(".nxb-evidence-timeline")).toBeTruthy();

    fireEvent.click(container.querySelectorAll(".nxb-drawer-tabs [role='tab']")[2]);
    expect(container.querySelector(".nxb-drawer-panel[data-mode='resources']")).toBeTruthy();
    expect(container.querySelector("a[href='https://xbridge.neo.org/']")).toBeTruthy();
  });

  it("keeps bridge styling foreground-led, animated, and motion guarded", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-x-bridge/src/PlayArea.scss`, "utf8");

    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.nxb-route-stage\s*\{[\s\S]*background:\s*#f7fbf9/);
    expect(s).toMatch(/\.nxb-route-stage__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.nxb-x-mark\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.nxb-mode-switch\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.nxb-route-rail__packet\s*\{[\s\S]*animation:\s*nxb-packet-breathe/);
    expect(s).toMatch(/@keyframes nxb-packet-travel/);
    expect(s).toMatch(/\.neo-x-bridge-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*max-width:\s*min\(100%,\s*248px\)/);
    expect(s).toMatch(/\.nxb-bound-summary\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.nxb-evidence-timeline li\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).not.toMatch(/background-image:\s*url|var\(--mx2-scene-wash/);
  });
});
