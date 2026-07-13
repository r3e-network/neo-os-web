/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeviceQaPanel from "./DeviceQaPanel";
import type { MotionPermissionState } from "./logic/device-motion";
import type { DeviceQaGameSnapshot } from "./logic/device-qa";

const game: DeviceQaGameSnapshot = {
  gameStatus: "dealt",
  level: 15,
  themeId: "fresh-market",
  activeCount: 48,
  reserveCount: 162,
  trayCount: 4,
  shakeNonce: 3,
  lastStatus: "statusReady",
};

function renderPanel() {
  const requestMotion = vi.fn<() => Promise<MotionPermissionState>>(async () => "granted");
  return render(
    <DeviceQaPanel
      motionPermission="granted"
      motionEnabled
      requestMotion={requestMotion}
      disableMotion={vi.fn()}
      game={game}
    />,
  );
}

describe("DeviceQaPanel", () => {
  beforeEach(() => {
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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exports structured stability evidence from the in-game QA panel", () => {
    const view = renderPanel();

    fireEvent.change(view.getByLabelText("真机型号 / OS / 浏览器"), {
      target: { value: "iPhone 15 Pro / iOS 20 / Safari" },
    });
    fireEvent.change(view.getByLabelText("启动/重试/退出/恢复循环次数"), {
      target: { value: "20" },
    });
    fireEvent.change(view.getByLabelText("Memory / GPU timeline 证据路径"), {
      target: { value: "evidence/stability/memory-timeline.json" },
    });
    fireEvent.click(view.getByLabelText("已完成至少一次 Level 15 长局"));
    fireEvent.change(view.getByLabelText("内存/GPU 趋势"), {
      target: { value: "flat" },
    });
    fireEvent.change(view.getByLabelText("重启/恢复是否逐渐变慢"), {
      target: { value: "none" },
    });
    fireEvent.change(view.getByLabelText("长局稳定性备注"), {
      target: { value: "连续颠锅、入槽、消除动作自然，无明显掉帧或漂移。" },
    });
    for (const frameTimeMs of [16, 17, 18, 28, 29, 16, 72]) {
      window.dispatchEvent(new CustomEvent("zhuada-e:device-qa-frame", {
        detail: { frameTimeMs },
      }));
    }

    fireEvent.click(view.getByRole("button", { name: "显示 JSON" }));

    const json = view.getByLabelText("完整 Device QA JSON") as HTMLTextAreaElement;
    const report = JSON.parse(json.value) as {
      runtime: { deviceLabel: string };
      stability: {
        restartResumeCycles: number;
        longLevel15Run: boolean;
        memoryTimelineEvidence: string;
        memoryTrend: string;
        restartSlowdown: string;
        contextLossLoop: boolean;
        notes: string;
      };
      frame: {
        maxFrameMs: number;
        longFramePercent: number;
        jankBurstCount: number;
        worstJankBurstFrames: number;
      };
    };
    expect(report.runtime.deviceLabel).toBe("iPhone 15 Pro / iOS 20 / Safari");
    expect(report.stability).toEqual({
      restartResumeCycles: 20,
      longLevel15Run: true,
      memoryTimelineEvidence: "evidence/stability/memory-timeline.json",
      memoryTrend: "flat",
      restartSlowdown: "none",
      contextLossLoop: false,
      notes: "连续颠锅、入槽、消除动作自然，无明显掉帧或漂移。",
    });
    expect(report.frame.maxFrameMs).toBe(72);
    expect(report.frame.longFramePercent).toBe(0);
    expect(report.frame.jankBurstCount).toBe(0);
    expect(report.frame.worstJankBurstFrames).toBe(2);
  }, 15_000);
});
