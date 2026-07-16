import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../dev-tipping/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(k: string, params?: Record<string, string | number>) {
  if (!params) return k;
  return Object.entries(params).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), k);
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

describe("dev-tipping PlayArea (v2)", () => {
  it("renders a foreground support desk instead of the old single-icon tool scene", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NQ9exampleWalletAddress1111111111111",
          developers: [{ id: 7, name: "Core Builder", role: "Protocol", totalTips: 12.5 }],
          totalDonatedDisplay: "12.50 GAS",
          runtimeCompatible: true,
          registryStatus: "ready",
          walletReadStatus: "ready",
          gasBalanceDisplay: "5 GAS",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".tip-scene")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".tip-scene__stage-image")?.getAttribute("src")).toContain("support-board-stage.webp");
    expect(container.querySelector(".tip-scene__stage-card")).toBeTruthy();
    expect(container.querySelector(".tip-scene__desk")).toBeTruthy();
    expect(container.querySelector(".tip-scene__builder-rack")).toBeTruthy();
    expect(container.querySelector(".mx2-cat-social")).toBeTruthy();
    expect(container.querySelector(".tip-scene__direct-id")).toBeNull();
    expect(container.querySelector(".tip-scene__amount-board")).toBeTruthy();
    expect(container.querySelector(".tip-scene__custom-amount")).toBeTruthy();
    expect(container.querySelector(".tip-scene__custom-control")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".tool-scene__icon")).toBeFalsy();
  });

  it("keeps secondary support workflows tucked behind drawer tabs", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NQ9exampleWalletAddress1111111111111",
          developers: [{ id: 7, name: "Core Builder", role: "Protocol", totalTips: 12.5 }],
          totalDonatedDisplay: "12.50 GAS",
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const drawer = container.querySelector(".tip-drawer");
    expect(drawer).toBeTruthy();
    const tabs = Array.from(container.querySelectorAll(".tip-drawer__tabs [role='tab']"));
    expect(tabs).toHaveLength(4);
    expect(container.querySelectorAll(".tip-drawer__panel.mx2-open-panel")).toHaveLength(1);
    expect(container.querySelector(".tip-drawer__panel--developers")).toBeTruthy();
    expect(container.querySelector(".tip-drawer__panel--direct")).toBeNull();
    expect(drawer?.querySelector("h4")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /supportTabDirect/ }));
    expect(container.querySelector(".tip-drawer__panel--direct")).toBeTruthy();
    expect(container.querySelectorAll(".tip-drawer__panel.mx2-open-panel")).toHaveLength(1);
    expect(drawer?.textContent).toContain("directSupportTitle");
    expect(drawer?.querySelector(".tip-drawer__field")).toBeNull();
    expect(drawer?.querySelectorAll(".tip-drawer-field.mx2-open-field")).toHaveLength(1);
    expect(drawer?.querySelector<HTMLInputElement>(".tip-drawer-input--developer-id input")?.value).toBe("7");

    fireEvent.click(screen.getByRole("tab", { name: /supportTabCreator/ }));
    expect(container.querySelector(".tip-drawer__panel--developer")).toBeTruthy();
    expect(drawer?.textContent).toContain("developerZone");

    fireEvent.click(screen.getByRole("tab", { name: /supportTabHistory/ }));
    expect(container.querySelector(".tip-drawer__panel--history")).toBeTruthy();
  });

  it("sends the selected developer id, amount, and anonymous flag", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          address: "NQ9exampleWalletAddress1111111111111",
          developers: [{ id: 7, name: "Core Builder", role: "Protocol", totalTips: 12.5 }],
          totalDonatedDisplay: "12.50 GAS",
          runtimeCompatible: true,
          registryStatus: "ready",
          walletReadStatus: "ready",
          gasBalanceDisplay: "5 GAS",
        })}
        dispatch={dispatch}
      />,
    );

    let sendButton: HTMLButtonElement | null = null;
    await waitFor(() => {
      sendButton = screen.getByRole("button", { name: /sendTipBtn/ }) as HTMLButtonElement;
      expect(sendButton.disabled).toBe(false);
    });
    fireEvent.click(sendButton!);

    expect(dispatch).toHaveBeenCalledWith("sendTip", 7, "0.10", true);
  });

  it("registers a developer from the creator drawer with Open UI fields", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NQ9exampleWalletAddress1111111111111",
          developers: [],
          runtimeCompatible: true,
          registryStatus: "ready",
          walletReadStatus: "ready",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /supportTabCreator/ }));

    expect(container.querySelectorAll(".tip-drawer-field.mx2-open-field")).toHaveLength(2);
    fireEvent.change(container.querySelector(".tip-drawer-input--dev-name input") as HTMLInputElement, {
      target: { value: "Neo Core" },
    });
    fireEvent.change(container.querySelector(".tip-drawer-input--dev-role input") as HTMLInputElement, {
      target: { value: "Protocol Maintainer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registerBtn/ }));

    expect(dispatch).toHaveBeenCalledWith("registerDeveloper", "Neo Core", "Protocol Maintainer");
  });

  it("locks duplicate payment behind the exact pending receipt check", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          address: "NQ9exampleWalletAddress1111111111111",
          developers: [{ id: 7, name: "Core Builder", role: "Protocol", wallet: "0x1234567890abcdef1234567890abcdef12345678" }],
          runtimeCompatible: true,
          registryStatus: "ready",
          walletReadStatus: "ready",
          pendingTip: {
            txid: `0x${"a".repeat(64)}`,
            devId: 7,
            recipientName: "Core Builder",
            recipientWallet: "0x1234567890abcdef1234567890abcdef12345678",
            amountBase: "10000000",
            network: "testnet",
            status: "pending",
          },
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.queryByRole("button", { name: /sendTipBtn/ })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /checkReceipt/ })[0]!);
    expect(dispatch).toHaveBeenCalledWith("recoverTip");
    expect(screen.getByText(/Core Builder · 0.1 GAS · testnet/)).toBeTruthy();
  });

  it("retires the generic operation form and documents stateful recovery", () => {
    const fs = require("node:fs");
    const manifest = JSON.parse(
      fs.readFileSync(`${process.cwd()}/../dev-tipping/neo-manifest.json`, "utf8"),
    );
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.version).toBe("1.1.0");
    expect(manifest.urls.banner).toBe("/miniapps/dev-tipping/support-board-stage.webp");
  });

  it("has reduced-motion and keeps the support scene foreground-led", () => {
    const fs = require("node:fs");
    const styles = fs.readFileSync(`${process.cwd()}/../dev-tipping/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${process.cwd()}/../dev-tipping/src/PlayArea.tsx`, "utf8");
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".tip-scene__backdrop")).toBeNull();
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).toMatch(/0\.001ms/);
    expect(styles).toMatch(/\.dev-tip-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff;/);
    expect(styles).toMatch(/\.tip-scene\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.tip-scene__stage-card,[\s\S]*\.tip-scene__desk\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.tip-scene__stage-image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).not.toContain(".tip-scene__direct-id");
    expect(styles).not.toContain(".tip-scene__builder-face");
    expect(styles).not.toContain(".tip-builder-list__face");
    expect(styles).toMatch(/\.tip-receipt\s*\{/);
    expect(styles).toMatch(/\.tip-scene__wallet-balance\s*\{/);
    expect(styles).not.toContain(".tip-drawer__field");
    expect(styles).toMatch(/\.tip-scene__custom-control\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    expect(styles).toMatch(/\.tip-drawer-field\.mx2-open-field\s*\{/);
    expect(styles).toMatch(/\.tip-scene__amounts\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.dev-tip-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.dev-tip-play-area \.mx2-action-rail,[\s\S]*\.dev-tip-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*920px\)/);
    expect(styles).toMatch(/\.dev-tip-play-area \.mx2-stage__title\s*\{[\s\S]*font-weight:\s*620/);
    expect(styles).toMatch(/\.dev-tip-play-area \.mx2-stage__subtitle\s*\{[\s\S]*font-weight:\s*420/);
    expect(styles).toMatch(/\.tip-drawer__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.tip-drawer__tabs button\s*\{[\s\S]*grid-template-areas:/);
    expect(styles).toMatch(/\.tip-drawer__tabs button\.is-active\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).not.toMatch(/\.tip-drawer__panel h4/);
    expect(styles).not.toMatch(/gradient|background-image:\s*url/);
    expect(styles).toMatch(/\.tip-scene__status\s*\{[\s\S]*white-space:\s*nowrap/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.tip-scene\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.dev-tip-play-area \.mx2-action-rail__row\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.dev-tip-play-area \.mx2-stage__title\s*\{[\s\S]*font-size:\s*20px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.tip-scene__stage-caption small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.tip-scene__amounts\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.tip-drawer__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).not.toMatch(/tip-scene__backdrop/);
    expect(source).toContain("@shared/components-react/v2/OpenUiLite");
    expect(source).not.toMatch(/function OpenUi(?:Provider|Panel|Notice|TextField)/);
    expect(source).not.toMatch(/<form\b|<svg\b|[😀-🙏🌀-🫿]/u);
  });
  // The board's lifetime total is the History tab's meta. It is a public read,
  // but `refresh` bails before it whenever the runtime cannot name a network —
  // i.e. for every wallet-less visitor — so the observable's initial value was
  // the FINAL value: a permanent em-dash, not a passing one. These pin the
  // three phases apart, and pin the total to absence rather than a fabricated
  // zero that would claim nobody has ever tipped.
  const historyMeta = (container: HTMLElement) =>
    container.querySelector("#tip-tab-history small");

  it("says why the board total is unread once the wallet question is settled", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ totalDonatedDisplay: "", statsSettled: true })} dispatch={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /supportOptions/i }));
    const meta = historyMeta(container);
    expect(meta?.textContent ?? "").not.toContain("—");
    // Never a fake zero for a total the app never read.
    expect(meta?.textContent ?? "").not.toContain("0 GAS");
    expect(meta?.querySelector("[data-phase='unavailable']")).toBeTruthy();
  });

  it("shimmers the board total while the read is still in flight", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ totalDonatedDisplay: "", statsSettled: false })} dispatch={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /supportOptions/i }));
    const meta = historyMeta(container);
    expect(meta?.querySelector(".mx2-skeleton")).toBeTruthy();
    expect(meta?.textContent ?? "").not.toContain("—");
    expect(meta?.textContent ?? "").not.toContain("0 GAS");
  });

  it("renders a resolved board total as itself", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ totalDonatedDisplay: "12.50 GAS", statsSettled: true })} dispatch={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /supportOptions/i }));
    const meta = historyMeta(container);
    expect(meta?.textContent).toContain("12.50 GAS");
    expect(meta?.querySelector(".mx2-skeleton")).toBeNull();
  });
});
