/// <reference types="node" />
/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayAreaProps } from "@shared/react";
import PlayArea from "./PlayArea";
import { EMPTY_PROGRESS } from "./logic/progress";

const playAreaStyles = readFileSync(`${process.cwd()}/src/PlayArea.scss`, "utf8");

vi.mock("./scenes/ZhuaDaScene", () => ({
  ZhuaDaScene: class {
    mount(_host: HTMLElement, bridge: { notifyReady(): void }): void {
      bridge.notifyReady();
    }
    unmount(): void {}
    activatePrimary(): void {}
  },
}));

const t = (key: string): string => key;

class ResizeObserverStub {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

function props(
  state: Record<string, unknown> = {},
  dispatch = vi.fn(async () => undefined),
): PlayAreaProps {
  return {
    t,
    state: {
      gameStatus: "idle",
      score: 0,
      level: 1,
      tray: Array(7).fill(null),
      shelf: Array(3).fill(null),
      lastStatus: "statusReady",
      themeId: "fresh-market",
      ...state,
    },
    dispatch,
  } as unknown as PlayAreaProps;
}

describe("PlayArea accessibility contract", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => (
      window.setTimeout(() => callback(performance.now()), 0)
    ));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("focuses and traps the lobby dialog while exposing a useful live status", async () => {
    const view = render(<PlayArea {...props()} />);
    const dialog = view.getByRole("dialog", { name: "levelSelectTitle" });
    const liveStatus = view.container.querySelector<HTMLElement>(".goose-sr-status");

    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(liveStatus?.getAttribute("role")).toBe("status");
    expect(liveStatus?.textContent).toContain("statusReady. scoreLabel: 0. scoreTray: 0/7.");

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect((document.activeElement as HTMLElement | null)?.classList.contains("goose-theme-card")).toBe(true);
  }, 15_000);

  it("keeps the idle CTA after the level rail and before optional device settings", () => {
    const view = render(<PlayArea {...props()} />);
    const levelRail = view.container.querySelector(".goose-map");
    const primary = view.getByRole("button", { name: "startOpenRun" });
    const options = view.container.querySelector(".goose-lobby-options");
    const timedMode = view.getByRole("checkbox", { name: "timedModeLabel" });

    expect(levelRail?.compareDocumentPosition(primary) ?? 0)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(primary.compareDocumentPosition(options as Node))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(timedMode.getAttribute("aria-describedby")).toBe("goose-timed-mode-hint");
  });

  it("offers a keyboard-operable exit from a long active run", async () => {
    const dispatch = vi.fn(async () => undefined);
    const view = render(<PlayArea {...props({ gameStatus: "dealt" }, dispatch)} />);

    fireEvent.click(view.getByRole("button", { name: "moreActions" }));
    const exit = view.getByRole("button", { name: "collectionBack" });
    const retry = view.getByRole("button", { name: "statusRetry" });
    expect(retry).toBeTruthy();

    fireEvent.click(exit);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("enter", {}));
    expect(view.queryByRole("button", { name: "collectionBack" })).toBeNull();
  }, 15_000);

  it("offers continue and discard controls for a validated interrupted run", async () => {
    const dispatch = vi.fn(async () => undefined);
    const view = render(<PlayArea {...props({ resumeAvailable: true, resumeLevel: 3 }, dispatch)} />);
    const group = view.getByRole("region", { name: "resumeRunTitle" });
    expect(group).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "resumeRunAction" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("resumeRun", {}));
    fireEvent.click(view.getByRole("button", { name: "discardRunAction" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("discardRun", {}));
  }, 15_000);

  it("does not show a phantom shake cooldown when a restored run is already ready", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T04:00:00Z"));
    const view = render(<PlayArea {...props()} />);

    vi.setSystemTime(new Date("2026-07-11T04:02:00Z"));
    view.rerender(<PlayArea {...props({
      gameStatus: "dealt",
      // Restore stores remaining cooldown, so a ready run resolves to now.
      shakeReadyAt: Date.now(),
    })} />);

    expect((view.getByRole("button", { name: "puShake" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("labels relaxed play explicitly instead of showing an unexplained infinity symbol", () => {
    const view = render(<PlayArea {...props({ gameStatus: "dealt", timedMode: false })} />);
    const relaxed = view.getByRole("group", { name: "scoreTime: untimedHud" });

    expect(relaxed.getAttribute("data-kind")).toBe("untimed");
    expect(relaxed.textContent).toContain("untimedHud");
    expect(view.container.textContent).not.toContain("∞");
    expect(view.queryByRole("timer")).toBeNull();
  });

  it("reserves the prominent timer treatment for an active timed challenge", () => {
    const view = render(<PlayArea {...props({
      gameStatus: "dealt",
      timedMode: true,
      timeLeftMs: 42_000,
    })} />);
    const timer = view.getByRole("timer", { name: "scoreTime: 42s" });

    expect(timer.getAttribute("data-kind")).toBe("time");
    expect(timer.textContent).toContain("42s");
    expect(view.queryByText("untimedHud")).toBeNull();
  });

  it("teaches the first level in-place and dismisses each lesson from real play state", () => {
    const items = [{ id: 1, kind: 0, px: 0, py: 1, pz: 0 }];
    const view = render(<PlayArea {...props({
      gameStatus: "dealt",
      level: 1,
      items,
      score: 0,
      tray: Array(7).fill(null),
      shakeNonce: 0,
    })} />);

    const pickCoach = view.getByRole("note");
    expect(pickCoach.textContent).toContain("tutorialPick");
    expect(pickCoach.getAttribute("data-step")).toBe("pick");
    expect(view.getByText("levelScopeValue")).toBeTruthy();
    expect(view.queryByText("levelReserveValue")).toBeNull();

    view.rerender(<PlayArea {...props({
      gameStatus: "dealt",
      level: 1,
      items,
      score: 0,
      tray: [0, null, null, null, null, null, null],
      shakeNonce: 0,
    })} />);
    expect(view.getByRole("note").textContent).toContain("tutorialMatch");

    view.rerender(<PlayArea {...props({
      gameStatus: "dealt",
      level: 1,
      items,
      score: 10,
      tray: Array(7).fill(null),
      shakeNonce: 0,
      reserveCount: 3,
    })} />);
    expect(view.getByRole("note").textContent).toContain("tutorialShake");
    expect(view.getByText("levelReserveValue")).toBeTruthy();

    view.rerender(<PlayArea {...props({
      gameStatus: "dealt",
      level: 1,
      items,
      score: 10,
      shakeNonce: 1,
    })} />);
    expect(view.queryByRole("note")).toBeNull();

    view.rerender(<PlayArea {...props({
      gameStatus: "dealt",
      level: 2,
      items,
      score: 0,
      shakeNonce: 0,
    })} />);
    expect(view.queryByRole("note")).toBeNull();
  });

  it("turns a recoverable full tray into an assertive last-stand prompt", () => {
    const view = render(<PlayArea {...props({
      gameStatus: "dealt",
      tray: [0, 1, 2, 3, 4, 5, 6],
      powerups: { shuffle: 1, hint: 3, remove: 1, undo: 1, addTime: 0 },
      undoable: true,
    })} />);

    const alert = view.getByRole("alert");
    expect(alert.textContent).toContain("statusTrayJammedTitle");
    expect(alert.textContent).toContain("statusTrayJammedHint");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(view.container.querySelector(".goose-tray-row")?.getAttribute("data-jammed")).toBe("true");
    expect(view.getByRole("button", { name: "puRemove ×1" }).getAttribute("data-rescue")).toBe("true");
    expect(view.getByRole("button", { name: "puUndo ×1" }).getAttribute("data-rescue")).toBe("true");
  });

  it("names terminal tray failure directly and offers a concrete recovery action", () => {
    const view = render(<PlayArea {...props({
      gameStatus: "expired",
      failReason: "trayFull",
      continueAvailable: true,
    })} />);

    const dialog = view.getByRole("dialog", { name: "statusFailedTrayFullTitle" });
    expect(dialog.textContent).toContain("statusFailedTrayFull");
    expect(view.getByRole("button", { name: "continueTrayAction" })).toBeTruthy();
    expect(dialog.querySelector(".goose-overlay__card")?.getAttribute("data-tone")).toBe("fail");
  });

  it("keeps coarse-pointer targets at 44px and globally suppresses optional motion", () => {
    expect(playAreaStyles).toContain("@media (pointer: coarse), (max-width: 760px)");
    expect(playAreaStyles).toMatch(/goose-stage-hud__sound[\s\S]*?width:\s*44px/);
    expect(playAreaStyles).toMatch(/goose-motion-option button[\s\S]*?min-height:\s*44px/);
    expect(playAreaStyles).toMatch(/goose-resume-card__actions button[\s\S]*?min-height:\s*44px/);
    expect(playAreaStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(playAreaStyles).toContain("animation: none !important");
    expect(playAreaStyles).toContain("transition: none !important");
  });

  it("keeps the in-game lobby immersive instead of showing the generic wrapper header", () => {
    expect(playAreaStyles).toContain("[data-game-status=\"idle\"]");
    expect(playAreaStyles).toMatch(/data-game-status="idle"[\s\S]*?mx2-stage__head[\s\S]*?display:\s*none/);
    expect(playAreaStyles).toMatch(/data-game-status="idle"[\s\S]*?mx2-stage__scene[\s\S]*?padding-top:\s*0/);
  });

  it("keeps the active-run drawer visible in-stage on desktop and above mobile browser chrome", () => {
    expect(playAreaStyles).toMatch(
      /goose-playarea \.goose-ingame-drawer[\s\S]*?position:\s*absolute[\s\S]*?top:\s*56px/,
    );
    expect(playAreaStyles).toContain("max-height: calc(100% - 70px)");
    expect(playAreaStyles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?goose-ingame-drawer[\s\S]*?position:\s*absolute/,
    );
    expect(playAreaStyles).toContain("top: auto");
    expect(playAreaStyles).toContain("bottom: max(6px, env(safe-area-inset-bottom, 0px))");
    expect(playAreaStyles).toContain("max-height: min(");
    expect(playAreaStyles).toContain("overflow-y: auto");
    expect(playAreaStyles).toContain("overscroll-behavior: contain");
  });

  it("DEV simulator QA autostarts a level only behind ?simQa=1", async () => {
    const dispatch = vi.fn(async () => undefined);
    window.history.pushState({}, "", "/?simQa=1");

    render(<PlayArea {...props({ progress: { ...EMPTY_PROGRESS, lastPlayedLevel: 4 } }, dispatch)} />);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("startLevel", { level: 4 }));
  }, 15_000);

  it("DEV simulator QA selects a requested theme before autostarting", async () => {
    const dispatch = vi.fn(async () => undefined);
    window.history.pushState({}, "", "/?simQa=1&simTheme=night-market");

    const { rerender } = render(
      <PlayArea {...props({ themeId: "farm-kitchen" }, dispatch)} />,
    );

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      "setTheme",
      { id: "night-market" },
    ));
    expect(dispatch).not.toHaveBeenCalledWith("startLevel", expect.anything());

    dispatch.mockClear();
    rerender(<PlayArea {...props({ themeId: "night-market" }, dispatch)} />);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      "startLevel",
      { level: 1 },
    ));
  }, 15_000);

  it("ignores invalid simulator theme ids and still starts the saved theme", async () => {
    const dispatch = vi.fn(async () => undefined);
    window.history.pushState({}, "", "/?simQa=1&simTheme=not-a-theme");

    render(<PlayArea {...props({ themeId: "farm-kitchen" }, dispatch)} />);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      "startLevel",
      { level: 1 },
    ));
    expect(dispatch).not.toHaveBeenCalledWith("setTheme", expect.anything());
  }, 15_000);
});
