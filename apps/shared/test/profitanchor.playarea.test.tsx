import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../profitanchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
const t = (key: string) => key;

function state(overrides: Record<string, unknown> = {}): ObservableState {
  const values = {
    network: "mainnet",
    contract: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
    readStatus: "ready",
    stats: { mode: "2", totalStaked: "0", totalStakers: "0", rewardPerNeo: "0", rewardReserve: "0", agentCount: "21", selectedAgentId: "0", paused: false },
    user: null,
    pendingTransaction: null,
    history: [],
    actionStatus: "transactionIdle",
    actionError: "",
    readError: "",
    diagnosticError: "",
    storageHealthy: true,
    submitting: false,
    confirmationChecking: false,
    walletAddress: "",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("profitanchor PlayArea production surface", () => {
  it("uses the real DeFi artwork and no inline gauge SVG", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector<HTMLImageElement>(".profit-visual__image")?.getAttribute("src")).toContain("profitanchor-stage.webp");
    expect(container.querySelector(".profit-product-scene svg")).toBeNull();
    expect(container.querySelector(".anchor-scene__gauge, .anchor-scene__backdrop")).toBeNull();
    expect(container.querySelector(".profit-command")).toBeTruthy();
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
  });

  // The guard here is that an absent live read must never be rendered as a real
  // "0" — a fabricated zero stake/reserve is worse than any placeholder. That
  // intent is unchanged and still asserted below. What changed is the shape of
  // the placeholder: this used to demand a literal em-dash, which was itself the
  // defect (one dead character standing in for "still loading", "needs a wallet"
  // and "settled empty" alike). The values now route through the shared
  // PhaseValue, so the assertion pins the honest zero-state copy instead.
  it("uses unavailable placeholders instead of zero when live reads are absent", () => {
    const { container } = render(<PlayArea t={t} state={state({ readStatus: "read-unavailable", stats: null, user: null })} dispatch={vi.fn()} />);
    const score = container.querySelector(".mx2-score");
    // The original intent: no invented zero, and no bare em-dash void either.
    expect(score?.textContent).not.toContain("—");
    expect(score?.textContent).not.toMatch(/\b0\s*(NEO|GAS)\b/);
    // Wallet-scoped values ask for a wallet; pool-scoped values name the network.
    expect(score?.textContent).toContain("valueConnectWallet");
    expect(score?.textContent).toContain("valueAwaitingNetwork");
    expect(score?.querySelectorAll('[data-phase="unavailable"]').length).toBe(3);
    // The primary must not be a dead grey "Stake 1 NEO". Staking is impossible
    // without a wallet, but connecting is not — so the rail offers the step the
    // visitor can actually take rather than a disabled promise of one they
    // cannot. A disabled primary on a first, fault-free paint reads as a broken
    // app; this is the same connect-first framing SelfLoan landed in 3389a4a1d.
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.textContent).toContain("connectWallet");
    expect(primary?.disabled).toBe(false);
    expect(container.querySelector(".profit-binding")?.textContent).toBe("bindingReadUnavailable");
  });

  // A cold first paint: the host has not named a network yet, so readStatus sits
  // at "loading" before the first loadAll round settles. Asserting anything
  // about the pool at that moment would be a guess dressed as data, so every
  // value must shimmer rather than resolve to a placeholder or a fake zero.
  it("shows loading skeletons, not voids, before the first read settles", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ readStatus: "loading", stats: null, user: null })} dispatch={vi.fn()} />,
    );
    const score = container.querySelector(".mx2-score");
    expect(score?.querySelectorAll(".mx2-skeleton").length).toBe(3);
    expect(score?.textContent).not.toContain("—");
    expect(score?.textContent).not.toContain("valueAwaitingNetwork");
  });

  // The "Network unknown" chip is the pre-wallet state, not a fault. It used to
  // share the amber warning styling with genuinely broken bindings (paused,
  // mode-mismatch, read-unavailable), so a first-time visitor was warned about
  // a problem they had not caused. Only real problems keep the amber list.
  it("keeps the unknown-network chip out of the amber warning styling", () => {
    const styles = readFileSync(
      resolve(__dirname, "../../profitanchor/src/PlayArea.scss"),
      "utf8",
    );
    const amberRule = styles.slice(0, styles.indexOf("border-color: #eccd98"));
    expect(amberRule).not.toContain(".profit-binding--unknown-network");
    expect(amberRule).toContain(".profit-binding--paused");
    expect(amberRule).toContain(".profit-binding--read-unavailable");
  });

  // .mx2-stage__head is a flex row and .mx2-stage__badges never shrinks, so at
  // 390px the two chips held the right column and wrapped "Profit-policy NEO
  // staking" one word per line. Stacking the head at the mobile band is the same
  // fix oracle-vrf-console landed in acec39136.
  it("stacks the stage head on mobile so the title cannot be squeezed by chips", () => {
    const styles = readFileSync(
      resolve(__dirname, "../../profitanchor/src/PlayArea.scss"),
      "utf8",
    );
    const mobileBand = styles.slice(styles.indexOf("@media (max-width: 600px)"));
    expect(mobileBand).toMatch(
      /\.profitanchor-play-area \.mx2-stage__head\s*\{[^}]*display:\s*grid/,
    );
    expect(mobileBand).toMatch(
      /\.profitanchor-play-area \.mx2-stage__badges\s*\{[^}]*flex-wrap:\s*wrap/,
    );
  });

  // The connect-first primary must not leak into the states where staking is the
  // real next step, and it must dispatch a connect rather than a doomed stake.
  it("dispatches connectWallet from the pre-wallet primary and hands the rail back once connected", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <PlayArea t={t} state={state({ walletAddress: "" })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
    expect(dispatch).not.toHaveBeenCalledWith("stakeNeo", expect.anything());

    // Once a wallet is attached the pool is stakeable again, so the rail must go
    // back to naming the amount instead of asking for a wallet it already has.
    const connected = state({
      walletAddress: `0x${"22".repeat(20)}`,
      user: { stake: "0", pendingRewards: "0", credit: "0" },
    });
    rerender(<PlayArea t={t} state={connected} dispatch={dispatch} />);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.textContent).toContain("stakeAmount");
    expect(primary?.textContent).not.toContain("connectWallet");
  });

  it("shows a durable pending state and recovers without exposing another stake action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pending = {
      version: 2, network: "mainnet", contract: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
      appId: "miniapp-profitanchor", expectedMode: 2, walletHash: `0x${"22".repeat(20)}`,
      action: "stake", amount: "1", beforeStake: "0", beforeRewards: "0", beforeCredit: "0",
      expectedStake: "1", txid: `0x${"cd".repeat(32)}`, createdAt: Date.now(),
    };
    const { container } = render(<PlayArea t={t} state={state({ pendingTransaction: pending })} dispatch={dispatch} />);
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".profit-drawer__nav button")[2]);
    fireEvent.click(container.querySelector(".mx2-open-notice button") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("recoverPendingAnchor");
  });

  it("keeps a clean, bright, responsive foreground and reduced motion", () => {
    const styles = readFileSync(
      resolve(
        process.cwd().endsWith("/apps/shared") ? process.cwd() : resolve(process.cwd(), "apps/shared"),
        "../profitanchor/src/PlayArea.scss",
      ),
      "utf8",
    );
    expect(styles).toMatch(/\.profit-product-scene\s*\{[\s\S]*grid-template-columns:/);
    expect(styles).toMatch(/\.profit-visual__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/background:\s*#fffdf8/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)/);
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).not.toMatch(/radial-gradient|linear-gradient|backdrop-filter/);
  });
});
