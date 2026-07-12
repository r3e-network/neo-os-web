import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { createRun, generateLevel, type ArrowRunSnapshot } from "../../arrow-escape/src/logic/arrow-engine";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({ phaserGame: vi.fn() }));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => ({
  LazyPhaserGameComponent: (props: unknown) => {
    mocks.phaserGame(props);
    return <div data-testid="arrow-phaser-host" />;
  },
}));

import PhaserPlayArea from "../../arrow-escape/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>): string {
  const values: Record<string, string> = {
    statusReady: "Find a clear escape ray",
    gameAriaLabel: "Garden Arrowworks arrow escape puzzle",
    loadingGame: "Opening the garden…",
    gameLoadError: "The garden could not be opened",
    retry: "Retry",
    continue: "Continue",
    enableSound: "Enable sound",
    muteSound: "Mute sound",
    hudAriaLabel: "Lives, remaining arrows, timer, and pause controls",
    livesLabel: "{count} shields remaining",
    remainingLabel: "Remaining",
    scoreLabel: "Score {score}",
    scoreShort: "Score",
    bestShort: "Best",
    pause: "Pause game",
    resume: "Resume",
    replay: "Replay seed",
    newGarden: "New garden",
    seedLabel: "Local seed",
    replaySeedLabel: "Replay seed {seed}",
    zoomLabel: "Board zoom",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    pauseTitle: "Garden paused",
    pauseCopy: "The timer is safely stopped.",
    winTitle: "Every path is clear",
    winCopy: "Garden restored with {score} points.",
    lostTitle: "The mechanism jammed",
    lostCopy: "Three blocked moves ended this run.",
    localOnlyNotice: "Local play only · no wallet, token, reward, VRF, or TEE call",
  };
  let value = values[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function makeState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const level = generateLevel("playarea-seed");
  const run = createRun(level.seed, Date.now());
  const values: Record<string, unknown> = {
    level,
    run,
    remainingMs: 120_000,
    remainingCount: level.arrows.length,
    bestScore: 4200,
    zoom: 1,
    moveEvent: null,
    lastStatus: "Find a clear escape ray",
    restoredNotice: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("arrow-escape Phaser playarea", () => {
  it("mounts the 390×844 game-first Phaser surface with deterministic bridge state", () => {
    const state = makeState();
    const { container } = render(<PhaserPlayArea t={t} state={state} dispatch={vi.fn()} />);
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      config: { width: number; height: number };
      state: Record<string, unknown>;
      preserveLogicalSize?: boolean;
    };

    expect(container.querySelector(".arrow-escape-shell")).toBeTruthy();
    expect(container.querySelector(".arrow-hud")).toBeTruthy();
    expect(props.config).toMatchObject({ width: 390, height: 844 });
    expect(props.preserveLogicalSize).toBe(true);
    expect(props.state.level).toBe((state.level as ReturnType<typeof createObservable>).get());
    expect(props.state.run).toBe((state.run as ReturnType<typeof createObservable>).get());
    expect(screen.getByText("02:00")).toBeTruthy();
    expect(screen.getByText("4,200")).toBeTruthy();
  });

  it("keeps pause, restart, zoom, and keyboard recovery controls functional", () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(<PhaserPlayArea t={t} state={makeState()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
    expect(dispatch).toHaveBeenCalledWith("togglePause");
    fireEvent.click(screen.getByRole("button", { name: /replay seed/i }));
    expect(dispatch).toHaveBeenCalledWith("restartGame");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(dispatch).toHaveBeenCalledWith("setZoom", 1.1);

    const shell = container.querySelector(".arrow-escape-shell")!;
    fireEvent.keyDown(shell, { key: "r" });
    fireEvent.keyDown(shell, { key: " " });
    expect(dispatch).toHaveBeenCalledWith("restartGame");
    expect(dispatch).toHaveBeenCalledWith("togglePause");
  });

  it("shows a focused pause modal without surfacing fake GameFi actions", () => {
    const level = generateLevel("paused-ui");
    const pausedRun: ArrowRunSnapshot = { ...createRun(level.seed), status: "paused" };
    render(
      <PhaserPlayArea
        t={t}
        state={makeState({ level, run: pausedRun })}
        dispatch={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Garden paused")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.getByText(/no wallet, token, reward, VRF, or TEE call/i)).toBeTruthy();
    expect(screen.queryByText(/GAS/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /connect wallet/i })).toBeNull();
  });

  it("announces validated refresh recovery as a secondary hint", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={makeState({ restoredNotice: "Recovered your verified local run" })}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText("Recovered your verified local run")).toBeTruthy();
  });
});
