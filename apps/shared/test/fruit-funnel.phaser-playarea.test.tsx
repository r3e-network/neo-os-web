import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { FruitFunnelEngine } from "../../fruit-funnel/src/logic/fruit-engine";
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
    game: FruitFunnelEngine.fresh(42, 1, 1_000).snapshot(1_000),
    hintLanes: [1],
    hintMessageKey: "statusHintReady",
    storageHealthy: false,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Fruit Funnel Phaser playarea", () => {
  it("bridges the certified run and complete localized copy into a 390 by 844 Phaser scene", () => {
    render(<PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(screen.getByTestId("fruit-funnel-phaser-host")).toBeTruthy();
    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      config: { width: number; height: number };
      state: Record<string, unknown>;
      ariaLabel: string;
    };
    expect(props.config).toMatchObject({ width: 390, height: 844 });
    expect(props.ariaLabel).toBe("可交互的果园漏斗配对游戏");
    expect((props.state.game as { seed: number }).seed).toBe(42);
    expect(props.state.hintLanes).toEqual([1]);
    expect(props.state.hintMessageKey).toBe("statusHintReady");
    expect(props.state.storageHealthy).toBe(false);
    expect(props.state.sceneText).toMatchObject({
      appEyebrow: "阳光果园配对游戏",
      statusUnknownLane: "请选择六条果藤之一",
      statusCannotResume: "请开启新果园继续游玩",
      statusHintUndo: "当前没有可验证的安全放果——请撤回上一步",
    });
  });

  it("keeps touch-equivalent controls available to keyboard and assistive technology", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PhaserPlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "撤回" }));
    fireEvent.click(screen.getByRole("button", { name: "提示" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.click(screen.getByRole("button", { name: "新果园" }));
    expect(dispatch).toHaveBeenCalledWith("tapLane", 0);
    expect(dispatch).toHaveBeenCalledWith("undoMove");
    expect(dispatch).toHaveBeenCalledWith("requestHint");
    expect(dispatch).toHaveBeenCalledWith("togglePause");
    expect(dispatch).toHaveBeenCalledWith("restartGame");
    expect(screen.getByText(/此设备当前无法保存进度/)).toBeTruthy();
  });
});
