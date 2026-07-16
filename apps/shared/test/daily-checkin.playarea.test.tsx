import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../daily-checkin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const CONTRACT = "0x25db219a701a2b23130788723fcf9a2e76857235";

afterEach(() => cleanup());

function t(key: string) {
  return key;
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    network: "mainnet",
    contractHash: CONTRACT,
    dataSource: "chain",
    walletAddress: WALLET,
    currentStreak: "6 days",
    highestStreak: "8 days",
    currentStreakRaw: 6,
    totalUserCheckins: 12,
    unclaimedRewards: "0 GAS",
    totalClaimed: "0.03 GAS",
    checkInFee: "0.001 GAS",
    rewardPoolBalance: "1.002 GAS",
    weekRewardLabel: "0.01 GAS",
    twoWeekRewardLabel: "0.02 GAS",
    utcTimeDisplay: "12:30:00",
    nextUtcMidnight: Date.now() + 3_600_000,
    canCheckIn: true,
    hasLoadedStatus: true,
    hasLoadedPlatform: true,
    checkinHistory: [],
    pendingOperation: null,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...values }).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("Daily Check-in ritual-first product surface", () => {
  it("uses the real sunlit streak plaza and a focused seven-day ritual console", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".dci-ritual")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".dci-plaza > img")?.src).toContain("streak-plaza.webp");
    expect(container.querySelector(".dci-console")).toBeTruthy();
    expect(container.querySelector(".dci-streak-focus")?.textContent).toContain("6 days");
    expect(container.querySelectorAll(".dci-path .dci-day")).toHaveLength(7);
    expect(container.querySelectorAll(".dci-path .dci-day.is-complete")).toHaveLength(6);
    expect(container.querySelectorAll(".dci-path .dci-day.is-ready")).toHaveLength(1);
    expect(container.querySelector(".dci-plaza__reward")?.textContent).toContain("0.01 GAS");
    expect(container.querySelectorAll('[aria-label="GAS token"]').length).toBeGreaterThan(0);
  });

  it("moves the visible chapter from days 1–7 to days 8–14 without inventing later rewards", () => {
    const { container, rerender } = render(
      <PlayArea
        t={t}
        state={state({ currentStreak: "8 days", currentStreakRaw: 8, canCheckIn: false })}
        dispatch={vi.fn()}
      />,
    );

    const chapter = container.querySelector(".dci-chapter");
    expect(chapter?.textContent).toContain("8");
    expect(chapter?.textContent).toContain("14");
    expect(container.querySelector(".dci-plaza__reward")?.textContent).toContain("0.02 GAS");

    rerender(
      <PlayArea
        t={t}
        state={state({ currentStreak: "14 days", currentStreakRaw: 14, canCheckIn: false })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".dci-plaza__caption")?.textContent).toContain("journeyCompleteTitle");
    expect(container.querySelector(".dci-plaza__reward")?.textContent).toContain("milestonesComplete");
    expect(container.querySelectorAll(".dci-path .dci-day.is-complete")).toHaveLength(7);
  });

  it("warns clearly when today's verified check-in will restart the streak", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ streakWillReset: true, canCheckIn: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".dci-reset-note")?.textContent).toContain("streakRestartTitle");
    expect(container.querySelector(".dci-reset-note")?.textContent).toContain("streakRestartCopy");
  });

  it("keeps activity, reward ledger, and technical trust in three secondary drawer panels", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          hasClaimableRewards: true,
          unclaimedRewards: "0.01 GAS",
          checkinHistory: [{
            action: "checkin",
            streak: 7,
            rewardRaw: "1000000",
            time: "2026-07-11T00:00:00.000Z",
            txid: `0x${"11".repeat(32)}`,
          }],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle")!);
    const drawer = container.querySelector(".dci-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer?.querySelectorAll(".dci-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(drawer?.querySelector(".dci-history")?.textContent).toContain("historyCheckin");
    expect(drawer?.querySelector(".dci-reward-ledger")?.textContent).toContain("0.01 GAS");
    expect(drawer?.querySelector(".dci-trust-list")?.textContent).toContain("eventAndReadback");
    expect(drawer?.querySelectorAll("input, textarea, select")).toHaveLength(0);

    fireEvent.click(drawer!.querySelector<HTMLButtonElement>(".dci-claim")!);
    expect(dispatch).toHaveBeenCalledWith("claimRewards");
  });

  it("shows pending and failed states without replacing them with zero-value success", () => {
    const txid = `0x${"ab".repeat(32)}`;
    const { container, rerender } = render(
      <PlayArea
        t={t}
        state={state({
          pendingOperation: { kind: "checkin", txid },
          transactionNotice: "transactionPending",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".dci-feedback.is-pending")?.textContent).toContain("transactionPending");

    rerender(
      <PlayArea
        t={t}
        state={state({
          dataSource: "failed",
          walletAddress: "",
          // Unresolved values arrive EMPTY from useCheckin now, not as "—": the
          // composable no longer decides how an unseen value looks, so the view
          // can tell "read in flight" from "settled, needs a wallet" and render
          // a skeleton or zero-state copy instead of an em-dash grid. Fixture
          // kept in step with that contract.
          currentStreak: "",
          highestStreak: "",
          unclaimedRewards: "",
          hasLoadedStatus: false,
          lastError: "Platform state read is unavailable.",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".dci-feedback.is-error")?.textContent).toContain("unavailable");
    expect(container.querySelector(".dci-streak-focus")?.textContent).not.toContain("0 days");
  });
});

describe("Daily Check-in visual production locks", () => {
  it("keeps a bright high-contrast responsive ritual with restrained actions", () => {
    const styles = readFileSync(`${process.cwd()}/../daily-checkin/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../daily-checkin/src/PlayArea.tsx`, "utf8");

    expect(styles).toMatch(/\.dci-ritual\s*\{[\s\S]*?background:\s*transparent/);
    expect(styles).toMatch(/\.dci-ritual__layout\s*\{[\s\S]*?grid-template-columns:/);
    expect(styles).toMatch(/\.dci-plaza,[\s\S]*?\.dci-console\s*\{[\s\S]*?background:\s*#fff/);
    expect(styles).toMatch(/\.dci-plaza > img\s*\{[\s\S]*?object-fit:\s*cover/);
    // The plaza caption is white, so it REQUIRES an opaque-enough scrim over the
    // artwork. That intent is unchanged and re-pinned below.
    //
    // This assertion used to name the layer `.dci-plaza__shade`, and that is the
    // bug it hid: the shared clarity guard zeroes
    // `.mx2-stage__scene [class$="__shade"]` (plus __wash/__backdrop/
    // __stage-light/__background) with `opacity: 0 !important`, and this figure
    // renders inside the PlayStage scene. So the scrim was present in the
    // stylesheet — which is all this test checked — while being switched off in
    // the browser, leaving the white caption unreadable on the pale artwork. The
    // guard passed green against a broken surface.
    //
    // Re-pinned to the functional name, and tightened: assert the scrim is dark
    // enough AND that it is not re-introduced under a reserved name.
    expect(styles).toMatch(/\.dci-plaza__legibility\s*\{[\s\S]*?rgba\(10,\s*55,\s*42,\s*0\.88\)/);
    expect(styles).not.toMatch(/\.dci-plaza__(shade|wash|backdrop|stage-light|background)\s*\{/);
    expect(styles).toMatch(/\.dci-plaza__caption\s*\{[\s\S]*?color:\s*#fff/);
    expect(styles).toMatch(/\.dci-drawer\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
    expect(styles).toMatch(/\.daily-checkin-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*?flex:\s*0 0 188px/);
    expect(styles).toMatch(/@media \(max-width:\s*620px\)[\s\S]*?\.dci-path\s*\{[\s\S]*?overflow-x:\s*auto/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);

    expect(source).toMatch(/const STREAK_IMAGE = "\.\/streak-plaza\.webp"/);
    expect(source).toMatch(/<CoinArt[^>]*variant="gas"/);
    expect(source).toContain("@shared/components-react/v2/OpenUiLite");
    expect(source).not.toMatch(/checkin-scene-art|emoji|marketHashPlaceholder|OpenUiTextField/);
  });
});

/**
 * The network and the canonical contract both resolve out of the one canonical-
 * context read (`requireCanonicalDailyCheckinContext`), which is async: both are
 * "" until it settles. They were the two values left on `|| "—"` after the rest
 * of this surface moved to the DataPhase vocabulary — so the header opened as a
 * literal "Neo N3 —" while the file's own comment claimed first-run values were
 * routed through DataPhase.
 *
 * `hasLoadedContext` is what tells "still resolving" from "resolved to nothing".
 * It cannot be `hasLoadedPlatform`: that flag never flips when the context read
 * is the thing that failed, which is exactly the case that must settle to honest
 * copy rather than shimmer forever.
 */
describe("Daily Check-in context-scoped first paint", () => {
  const cold = {
    network: "",
    contractHash: "",
    hasLoadedContext: false,
    hasLoadedPlatform: false,
    hasLoadedStatus: false,
    isLoading: true,
    walletAddress: "",
  };

  it("shimmers the network tail while the context read is in flight, never a dash", () => {
    const { container } = render(<PlayArea t={t} state={state(cold)} dispatch={vi.fn()} />);
    const chip = container.querySelector(".dci-network");

    expect(chip?.textContent).not.toContain("—");
    // "Neo N3" is true before any read — only the specific network is unknown,
    // so the chip keeps its identity rather than blanking entirely.
    expect(chip?.textContent).toContain("Neo N3");
    expect(chip?.querySelector(".mx2-skeleton")).toBeTruthy();
    // A shimmer is not copy: the settled zero-state must not appear mid-read.
    expect(chip?.textContent).not.toContain("valueAwaitingNetwork");
  });

  it("settles the network to honest copy when the context read resolves empty", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ ...cold, hasLoadedContext: true, isLoading: false, dataSource: "failed" })}
        dispatch={vi.fn()}
      />,
    );
    const chip = container.querySelector(".dci-network");

    expect(chip?.textContent).not.toContain("—");
    expect(chip?.textContent).toContain("valueAwaitingNetwork");
    // Settled means settled: the shimmer must not outlive the read.
    expect(chip?.querySelector(".mx2-skeleton")).toBeFalsy();
  });

  it("renders the real network once the context read lands", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ hasLoadedContext: true })} dispatch={vi.fn()} />,
    );
    const chip = container.querySelector(".dci-network");

    expect(chip?.textContent).toContain("Neo N3");
    expect(chip?.textContent).toContain("mainnet");
    expect(chip?.querySelector(".mx2-skeleton")).toBeFalsy();
  });

  // The trust drawer lives behind PlayStage's own toggle, so it is not in the
  // tree until opened — which is exactly why a screenshot of the resting entry
  // surface never caught the dashed contract underneath it.
  function openDrawer(container: HTMLElement) {
    const toggle = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("ritualDetails"),
    );
    expect(toggle, "drawer toggle").toBeTruthy();
    fireEvent.click(toggle!);
    expect(container.querySelector(".dci-trust-list"), "drawer content").toBeTruthy();
  }

  it("phases the canonical contract on the same read instead of dashing it", () => {
    const { container } = render(<PlayArea t={t} state={state(cold)} dispatch={vi.fn()} />);
    openDrawer(container);

    const trust = container.querySelector(".dci-trust-list");
    expect(trust?.textContent).toContain("canonicalContract");
    expect(trust?.textContent).not.toContain("—");
    expect(trust?.querySelector(".mx2-skeleton")).toBeTruthy();
    expect(container.querySelector(".dci-drawer")?.textContent).not.toContain("—");
  });

  it("settles the canonical contract to honest copy rather than shimmering forever", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ ...cold, hasLoadedContext: true, isLoading: false, dataSource: "failed" })}
        dispatch={vi.fn()}
      />,
    );
    openDrawer(container);

    const trust = container.querySelector(".dci-trust-list");
    expect(trust?.textContent).toContain("valueAwaitingNetwork");
    expect(trust?.textContent).not.toContain("—");
    expect(trust?.querySelector(".mx2-skeleton")).toBeFalsy();
  });

  it("opens the whole cold surface — drawer included — with no em-dash void anywhere", () => {
    const { container } = render(<PlayArea t={t} state={state(cold)} dispatch={vi.fn()} />);
    // The regression this whole lane exists for: a first-time visitor must not
    // be met by dashes before touching anything.
    expect(container.textContent).not.toContain("—");
    openDrawer(container);
    expect(container.textContent).not.toContain("—");
  });
});
