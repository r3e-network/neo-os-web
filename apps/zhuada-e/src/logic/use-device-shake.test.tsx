/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceShake } from "./use-device-shake";
import type { ShakeSignal } from "./device-motion";

const MOTION_ENABLED_KEY = "zhuada-e:motion-enabled";

function defineHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
}

function installMotionApi(requestPermission?: () => Promise<"granted" | "denied">): void {
  class DeviceMotionEventStub extends Event {
    static requestPermission = requestPermission;
  }
  Object.defineProperty(window, "DeviceMotionEvent", {
    configurable: true,
    value: DeviceMotionEventStub,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
}

function dispatchMotion(x: number, y = 0, z = 0): void {
  const event = new Event("devicemotion") as DeviceMotionEvent;
  Object.defineProperty(event, "acceleration", {
    configurable: true,
    value: { x, y, z },
  });
  Object.defineProperty(event, "accelerationIncludingGravity", {
    configurable: true,
    value: null,
  });
  window.dispatchEvent(event);
}

async function clickAndFlush(button: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

function Probe({
  active = true,
  onShake,
}: {
  active?: boolean;
  onShake: (signal: ShakeSignal) => void;
}) {
  const motion = useDeviceShake({ active, onShake });
  return (
    <section
      data-testid="probe"
      data-enabled={motion.enabled ? "true" : "false"}
      data-permission={motion.permission}
    >
      <button type="button" onClick={() => void motion.requestEnable()}>
        enable motion
      </button>
      <button type="button" onClick={motion.disable}>
        disable motion
      </button>
    </section>
  );
}

describe("useDeviceShake", () => {
  beforeEach(() => {
    localStorage.clear();
    defineHidden(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    defineHidden(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requires an explicit permission button before enabling phone motion", async () => {
    const onShake = vi.fn();
    const requestPermission = vi.fn(async () => "granted" as const);
    installMotionApi(requestPermission);

    const view = render(<Probe onShake={onShake} />);
    const probe = view.getByTestId("probe");
    expect(probe.getAttribute("data-permission")).toBe("prompt");
    expect(probe.getAttribute("data-enabled")).toBe("false");

    dispatchMotion(28);
    expect(onShake).not.toHaveBeenCalled();

    await clickAndFlush(view.getByRole("button", { name: "enable motion" }));
    expect(probe.getAttribute("data-enabled")).toBe("true");
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(MOTION_ENABLED_KEY)).toBe("1");

    dispatchMotion(28);
    expect(onShake).toHaveBeenCalledTimes(1);
    const signal = onShake.mock.calls[0]?.[0];
    expect(signal).toMatchObject({ strength: "strong", intensity: 1.2423076923076923 });
  });

  it("marks motion as blocked when Android Chrome exposes DeviceMotionEvent but never delivers events", async () => {
    installMotionApi();
    const onShake = vi.fn();

    const view = render(<Probe onShake={onShake} />);
    const probe = view.getByTestId("probe");
    await clickAndFlush(view.getByRole("button", { name: "enable motion" }));
    expect(probe.getAttribute("data-enabled")).toBe("true");
    expect(probe.getAttribute("data-permission")).toBe("granted");
    expect(localStorage.getItem(MOTION_ENABLED_KEY)).toBe("1");

    act(() => {
      vi.advanceTimersByTime(2_201);
    });

    expect(probe.getAttribute("data-enabled")).toBe("false");
    expect(probe.getAttribute("data-permission")).toBe("blocked");
    expect(localStorage.getItem(MOTION_ENABLED_KEY)).toBe("0");
    expect(onShake).not.toHaveBeenCalled();
  });

  it("ignores sensor events while inactive or hidden and removes the listener on cleanup", async () => {
    installMotionApi();
    const onShake = vi.fn();

    const view = render(<Probe active={false} onShake={onShake} />);
    const probe = view.getByTestId("probe");
    await clickAndFlush(view.getByRole("button", { name: "enable motion" }));
    expect(probe.getAttribute("data-enabled")).toBe("true");

    dispatchMotion(30);
    expect(onShake).not.toHaveBeenCalled();

    view.rerender(<Probe active onShake={onShake} />);
    defineHidden(true);
    dispatchMotion(30);
    expect(onShake).not.toHaveBeenCalled();

    defineHidden(false);
    dispatchMotion(30);
    expect(onShake).toHaveBeenCalledTimes(1);

    view.unmount();
    dispatchMotion(30);
    expect(onShake).toHaveBeenCalledTimes(1);
  });
});
