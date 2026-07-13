/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedTray } from "./AnimatedTray";
import type { ExtractReceipt } from "./logic/engine-zhuada";
import { TRAY_MOTION_TIMINGS } from "./logic/tray-motion";

vi.mock("./ThemeItemChip", () => ({
  ThemeItemChip: ({ kind }: { kind: number }) => <span>{kind}</span>,
}));

describe("AnimatedTray", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows a grouped triple, highlights it, clears it, then closes the gap", async () => {
    const initial = [9, 2, 2, 4, null, null, null];
    const receipt: ExtractReceipt = {
      nonce: 1,
      itemId: 42,
      kind: 2,
      accepted: true,
      placedIndex: 3,
      matched: true,
      landingTray: [9, 2, 2, 2, 4, null, null],
      settledTray: [9, 4, null, null, null, null, null],
      clearedTray: [1, 2, 3],
    };
    const common = {
      themeId: "fresh-market" as const,
      label: "Tray",
      emptyLabel: "Empty",
      itemName: (kind: number) => `Kind ${kind}`,
    };
    const view = render(<AnimatedTray {...common} tray={initial} receipt={null} />);
    view.rerender(<AnimatedTray {...common} tray={receipt.settledTray} receipt={receipt} />);

    const tray = view.getByRole("list", { name: "Tray" });
    await act(async () => undefined);
    expect(tray.dataset.motionPhase).toBe("approach");
    expect(view.container.querySelectorAll('[data-kind="2"]')).toHaveLength(3);

    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.approachMs));
    expect(tray.dataset.motionPhase).toBe("grouping");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.groupingMs));
    expect(tray.dataset.motionPhase).toBe("highlight");
    expect(view.container.querySelectorAll('[data-matched="true"]')).toHaveLength(3);

    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.highlightMs));
    expect(tray.dataset.motionPhase).toBe("clearing");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.clearMs));
    expect(tray.dataset.motionPhase).toBe("compacting");
    expect(view.container.querySelectorAll(".goose-tray__item")).toHaveLength(2);
    expect(view.container.querySelector('[data-kind="4"]')?.getAttribute("style"))
      .toContain("100%");

    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.compactMs));
    expect(tray.dataset.motionPhase).toBe("idle");
  }, 20_000);

  it("queues a second receipt until the first tray choreography settles", async () => {
    const initial = [9, 2, 2, 4, null, null, null];
    const first: ExtractReceipt = {
      nonce: 1,
      itemId: 42,
      kind: 2,
      accepted: true,
      placedIndex: 3,
      matched: true,
      landingTray: [9, 2, 2, 2, 4, null, null],
      settledTray: [9, 4, null, null, null, null, null],
      clearedTray: [1, 2, 3],
    };
    const second: ExtractReceipt = {
      nonce: 2,
      itemId: 43,
      kind: 9,
      accepted: true,
      placedIndex: 1,
      matched: false,
      landingTray: [9, 9, 4, null, null, null, null],
      settledTray: [9, 9, 4, null, null, null, null],
      clearedTray: [],
    };
    const common = {
      themeId: "fresh-market" as const,
      label: "Tray",
      emptyLabel: "Empty",
      itemName: (kind: number) => `Kind ${kind}`,
    };
    const view = render(<AnimatedTray {...common} tray={initial} receipt={null} />);
    view.rerender(<AnimatedTray {...common} tray={first.settledTray} receipt={first} />);

    const tray = view.getByRole("list", { name: "Tray" });
    await act(async () => undefined);
    expect(tray.dataset.motionPhase).toBe("approach");

    view.rerender(<AnimatedTray {...common} tray={second.settledTray} receipt={second} />);
    await act(async () => undefined);
    expect(tray.dataset.motionPhase).toBe("approach");
    expect(view.container.querySelectorAll('[data-kind="2"]')).toHaveLength(3);

    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.approachMs));
    expect(tray.dataset.motionPhase).toBe("grouping");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.groupingMs));
    expect(tray.dataset.motionPhase).toBe("highlight");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.highlightMs));
    expect(tray.dataset.motionPhase).toBe("clearing");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.clearMs));
    expect(tray.dataset.motionPhase).toBe("compacting");
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.compactMs));
    await act(async () => undefined);

    expect(tray.dataset.motionPhase).toBe("approach");
    expect(view.container.querySelectorAll('[data-kind="9"]')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(TRAY_MOTION_TIMINGS.approachMs));
    expect(tray.dataset.motionPhase).toBe("grouping");
  }, 20_000);

  it("lets a newer ordinary pick take over without waiting for the prior entry timer", async () => {
    const common = {
      themeId: "fresh-market" as const,
      label: "Tray",
      emptyLabel: "Empty",
      itemName: (kind: number) => `Kind ${kind}`,
    };
    const first: ExtractReceipt = {
      nonce: 1,
      itemId: 11,
      kind: 1,
      accepted: true,
      placedIndex: 0,
      matched: false,
      landingTray: [1, null, null, null, null, null, null],
      settledTray: [1, null, null, null, null, null, null],
      clearedTray: [],
    };
    const second: ExtractReceipt = {
      nonce: 2,
      itemId: 12,
      kind: 2,
      accepted: true,
      placedIndex: 1,
      matched: false,
      landingTray: [1, 2, null, null, null, null, null],
      settledTray: [1, 2, null, null, null, null, null],
      clearedTray: [],
    };
    const view = render(<AnimatedTray {...common} tray={[]} receipt={null} />);
    const tray = view.getByRole("list", { name: "Tray" });

    view.rerender(<AnimatedTray {...common} tray={first.settledTray} receipt={first} />);
    await act(async () => undefined);
    expect(tray.dataset.motionPhase).toBe("approach");

    view.rerender(<AnimatedTray {...common} tray={second.settledTray} receipt={second} />);
    await act(async () => undefined);

    expect(tray.dataset.motionPhase).toBe("approach");
    expect(view.container.querySelectorAll(".goose-tray__item")).toHaveLength(2);
    expect(view.container.querySelector('[data-kind="1"]')?.getAttribute("data-incoming")).toBeNull();
    expect(view.container.querySelector('[data-kind="2"]')?.getAttribute("data-incoming")).toBe("true");
  });
});
