import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { SuikaEngine } from "../../fruit-funnel/src/logic/suika-engine";
import { messages } from "../../fruit-funnel/src/locale/messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({ phaserGame: vi.fn() }));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => ({
  LazyPhaserGameComponent: (props: unknown) => {
    mocks.phaserGame(props);
    return <div data-testid="fruit-funnel-phaser-host" />;
  },
}));

import PhaserPlayArea from "../../fruit-funnel/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string): string {
  const value = (messages as Record<string, { zh?: string }>)[key];
  return value?.zh ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    game: SuikaEngine.fresh(42, 0, 1_000).snapshot(1_000),
    aimX: 195,
    storageHealthy: false,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Fruit Funnel Phaser playarea", () => {
  it("bridges the run snapshot and localized scene copy into a 390 by 844 Phaser scene", () => {
    render(<PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(screen.getByTestId("fruit-funnel-phaser-host")).toBeTruthy();
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      config: { width: number; height: number };
      state: Record<string, unknown>;
      ariaLabel: string;
    };
    expect(props.config).toMatchObject({ width: 390, height: 844 });
    expect(props.ariaLabel).toBe("可交互的水果合成小游戏");
    expect((props.state.game as { seed: number }).seed).toBe(42);
    expect(props.state.aimX).toBe(195);
    expect(props.state.sceneText).toMatchObject({
      appTitle: "果园漏斗",
      statusReady: "放下水果开始",
      newRecordCopy: "创造新纪录！",
    });
  });

  it("keeps touch-equivalent controls available to keyboard and assistive technology", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PhaserPlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "◀" }));
    fireEvent.click(screen.getByRole("button", { name: "放下水果" }));
    fireEvent.click(screen.getByRole("button", { name: "▶" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.click(screen.getByRole("button", { name: "新游戏" }));
    expect(dispatch).toHaveBeenCalledWith("nudgeAim", -1);
    expect(dispatch).toHaveBeenCalledWith("dropCurrent");
    expect(dispatch).toHaveBeenCalledWith("nudgeAim", 1);
    expect(dispatch).toHaveBeenCalledWith("togglePause");
    expect(dispatch).toHaveBeenCalledWith("restartGame");
    expect(screen.getByText(/此设备当前无法保存进度/)).toBeTruthy();
  });
});
