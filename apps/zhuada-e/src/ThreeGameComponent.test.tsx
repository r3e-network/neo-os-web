/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameBridge } from "@framework/phaser/GameBridge";
import {
  ThreeGameComponent,
  type ThreeSceneController,
} from "./ThreeGameComponent";
import { ThemeItemChip } from "./ThemeItemChip";

class ResizeObserverStub implements ResizeObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
  takeRecords(): ResizeObserverEntry[] { return []; }
}

function sceneController(options: { failMount?: boolean; markRendered?: boolean } = {}) {
  const activatePrimary = vi.fn();
  const unmount = vi.fn();
  const pause = vi.fn();
  const resume = vi.fn();
  const mount = vi.fn((host: HTMLElement, bridge: GameBridge) => {
    if (options.failMount) throw new Error("WebGL unavailable");
    const canvas = document.createElement("canvas");
    if (options.markRendered) canvas.dataset.gooseFrameReady = "true";
    host.append(canvas);
    bridge.notifyReady();
  });
  const scene: ThreeSceneController = {
    mount,
    activatePrimary,
    pause,
    resume,
    unmount,
  };
  return { activatePrimary, mount, pause, resume, scene, unmount };
}

describe("ThreeGameComponent accessibility", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => (
      window.setTimeout(() => callback(performance.now()), 0)
    ));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
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
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("focuses a ready board and maps Enter / Space to the primary scene action", async () => {
    const { activatePrimary, scene, unmount } = sceneController();
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{ gameStatus: "dealt" }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
      />,
    );
    const host = view.getByRole("application", { name: "Goose pen" });

    expect(host.tabIndex).toBe(0);
    expect(host.getAttribute("aria-keyshortcuts")).toBe("Enter Space");
    await waitFor(() => expect(host.getAttribute("data-ready")).toBe("true"));
    await waitFor(() => expect(document.activeElement).toBe(host));

    fireEvent.keyDown(host, { key: "Enter" });
    fireEvent.keyDown(host, { key: " " });
    fireEvent.keyDown(host, { key: "ArrowDown" });
    expect(activatePrimary).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it("announces boot failure without letting its child action trigger the board", async () => {
    const { activatePrimary, scene } = sceneController({ failMount: true });
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{ gameStatus: "dealt" }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
        errorLabel="3D board unavailable"
        retryLabel="Retry"
      />,
    );

    const alert = await view.findByRole("alert");
    const host = view.getByRole("application", { name: "Goose pen" });
    const retry = view.getByRole("button", { name: "Retry" });
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(host.tabIndex).toBe(-1);
    expect(host.getAttribute("aria-disabled")).toBe("true");
    expect(retry.style.minHeight).toBe("44px");

    fireEvent.keyDown(retry, { key: " " });
    expect(activatePrimary).not.toHaveBeenCalled();
  });

  it("turns a lost WebGL context into an assertive retry state", async () => {
    const { pause, scene } = sceneController();
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{ gameStatus: "dealt" }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
        errorLabel="3D board unavailable"
        contextLostLabel="Graphics interrupted"
        retryLabel="Retry"
      />,
    );
    const host = view.getByRole("application", { name: "Goose pen" });
    await waitFor(() => expect(host.getAttribute("data-ready")).toBe("true"));
    const canvas = host.querySelector("canvas");
    expect(canvas).not.toBeNull();

    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas!.dispatchEvent(lost);

    const alert = await view.findByRole("alert");
    expect(lost.defaultPrevented).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(alert.textContent).toContain("Graphics interrupted");
    expect(host.tabIndex).toBe(-1);
    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("sizes the mobile board from measured tray and tool footer height", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        width: 390,
        height: 844,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function rect(this: HTMLElement) {
      const element = this as HTMLElement;
      if (element.classList.contains("goose-level-progress")) {
        return { x: 0, y: 0, top: 0, left: 0, bottom: 33, right: 375, width: 375, height: 33, toJSON: () => ({}) };
      }
      if (element.classList.contains("goose-tray-row")) {
        return { x: 0, y: 0, top: 33, left: 0, bottom: 104, right: 375, width: 375, height: 71, toJSON: () => ({}) };
      }
      if (element.classList.contains("goose-powerbar")) {
        return { x: 0, y: 0, top: 104, left: 0, bottom: 167, right: 375, width: 375, height: 63, toJSON: () => ({}) };
      }
      return { x: 0, y: 0, top: 0, left: 0, bottom: 520, right: 375, width: 375, height: 520, toJSON: () => ({}) };
    });
    const { scene } = sceneController();

    const view = render(
      <div className="goose-stage-shell">
        <ThreeGameComponent
          scene={scene}
          state={{ gameStatus: "dealt" }}
          dispatch={vi.fn()}
          ariaLabel="Goose pen"
        />
        <div className="goose-level-progress" />
        <div className="goose-tray-row" />
        <div className="goose-powerbar" />
      </div>,
    );

    const host = view.getByRole("application", { name: "Goose pen" });
    await waitFor(() => expect(host.getAttribute("data-ready")).toBe("true"));
    await waitFor(() => expect(host.style.height).toBe(`${844 - 33 - 71 - 63 - 8}px`));
    expect(host.style.width).toBe("375px");

    rectSpy.mockRestore();
  });

  it("shows a real-asset Android fallback pile when Chrome renders a blank WebGL canvas", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    });
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
      if (contextId !== "2d") return null;
      return {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(20 * 20 * 4) })),
      } as unknown as CanvasRenderingContext2D;
    });
    const dispatch = vi.fn(async () => undefined);
    const { pause, scene } = sceneController();
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "fresh-market",
          shakeNonce: 1,
          items: [{ id: 41, kind: 2 }],
        }}
        dispatch={dispatch}
        ariaLabel="Goose pen"
      />,
    );

    const fallback = await view.findByTestId("android-canvas-fallback", undefined, { timeout: 5_000 });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(fallback.querySelector(".goose-android-fallback__pile")?.getAttribute("data-shaking")).toBe("true");
    expect(fallback.querySelector(".goose-android-fallback__basket")?.getAttribute("src"))
      .toBe("./art/container-fresh-market.webp");
    const item = view.getByRole("button", { name: "Pick item 3" });
    expect(item.querySelector("img")?.getAttribute("src")).toBe("./art/items/fresh-market/item-02.webp");
    expect(item.getAttribute("style")).toContain("scale(0.");

    fireEvent.click(item);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("extract", { itemId: 41 }));
    getContextSpy.mockRestore();
  });

  it("allows an explicit DEV-only simulator fallback when the emulator GPU process is unstable", async () => {
    window.history.replaceState(null, "", "/?simQa=1&androidFallback=1");
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36",
    });
    const { mount, scene, unmount } = sceneController({ markRendered: true });
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "farm-kitchen",
          items: [{ id: 7, kind: 6 }],
        }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
      />,
    );

    expect(await view.findByTestId("android-canvas-fallback")).toBeTruthy();
    expect(mount).not.toHaveBeenCalled();

    view.rerender(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "farm-kitchen",
          items: [{ id: 8, kind: 12 }, { id: 9, kind: 6 }],
        }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
      />,
    );
    expect(await view.findByRole("button", { name: "Pick item 13" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Pick item 7" })).toBeTruthy();
    expect(mount).not.toHaveBeenCalled();

    view.unmount();
    expect(unmount).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });

  it("keeps a healthy Android WebGL board through rapid item updates", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    });
    let samples = 0;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
      if (contextId !== "2d") return null;
      return {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => {
          samples += 1;
          return { data: new Uint8ClampedArray(20 * 20 * 4) };
        }),
      } as unknown as CanvasRenderingContext2D;
    });
    const { resume, scene } = sceneController({ markRendered: true });
    const dispatch = vi.fn(async () => undefined);
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "farm-kitchen",
          items: [{ id: 1, kind: 1 }, { id: 2, kind: 2 }],
        }}
        dispatch={dispatch}
        ariaLabel="Goose pen"
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_700);
    });
    expect(samples).toBe(0);
    expect(view.queryByTestId("android-canvas-fallback")).toBeNull();
    expect(resume).toHaveBeenCalled();

    view.rerender(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "farm-kitchen",
          items: [{ id: 2, kind: 2 }],
        }}
        dispatch={dispatch}
        ariaLabel="Goose pen"
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_700);
    });

    expect(samples).toBe(0);
    expect(view.queryByTestId("android-canvas-fallback")).toBeNull();
    getContextSpy.mockRestore();
  });

  it("uses the compatibility pile when Android reports a software renderer", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36",
    });
    const { mount, pause, scene } = sceneController({ markRendered: true });
    scene.mount = (host, bridge) => {
      mount(host, bridge);
      host.querySelector("canvas")!.dataset.gooseSoftwareRenderer = "true";
    };
    const view = render(
      <ThreeGameComponent
        scene={scene}
        state={{
          gameStatus: "dealt",
          themeId: "night-market",
          items: [{ id: 3, kind: 7 }],
        }}
        dispatch={vi.fn()}
        ariaLabel="Goose pen"
      />,
    );

    expect(await view.findByTestId("android-canvas-fallback", undefined, { timeout: 5_000 })).toBeTruthy();
    expect(view.getByRole("button", { name: "Pick item 8" })).toBeTruthy();
    expect(pause).toHaveBeenCalledTimes(1);
  });
});

describe("theme item color variants", () => {
  it("uses the logical full-body colorway asset without an extra marker filter", () => {
    const view = render(<ThemeItemChip themeId="fresh-market" kind={18} />);
    const chip = view.container.querySelector("img");
    expect(chip?.getAttribute("src")).toBe("./art/items/fresh-market/item-18.webp");
    expect(chip?.getAttribute("data-color-variant")).toBe("true");
    expect(chip?.getAttribute("data-variant-index")).toBe("1");
    expect(chip?.style.getPropertyValue("--goose-item-hue")).toBe("0deg");

    const secondTreatment = render(<ThemeItemChip themeId="fresh-market" kind={36} />);
    expect(secondTreatment.container.querySelector("img")?.getAttribute("data-variant-index")).toBe("2");
  });
});
