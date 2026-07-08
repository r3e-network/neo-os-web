/**
 * S8 app.lifecycle spec (framework-extraction plan §2/S8).
 *
 * Verifies the standalone lifecycle implementation (mount order, LIFO
 * unmount, data loaders + reload, cleanup registration), the poll() loop
 * (immediate + pauseWhenHidden defaults, visibilitychange pause/resume,
 * auto-cleanup on unmount, disposer idempotence) and the delegation lane
 * when a host LifecycleService is injected.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLifecycleSurface } from "../lifecycle";
import type { LifecycleSurfaceService } from "../lifecycle";

let documentHidden = false;

function setDocumentHidden(value: boolean): void {
  documentHidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  documentHidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => documentHidden,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("app.lifecycle standalone mount/unmount", () => {
  it("runs mount callbacks in order, then data loaders", async () => {
    const lifecycle = createLifecycleSurface();
    const order: string[] = [];

    lifecycle.onMount(() => {
      order.push("mount-1");
    });
    lifecycle.onMount(async () => {
      order.push("mount-2");
    });
    lifecycle.onData(async () => {
      order.push("data");
    });

    await lifecycle.mount();
    expect(order).toEqual(["mount-1", "mount-2", "data"]);
  });

  it("onData loaders re-run via reload()", async () => {
    const lifecycle = createLifecycleSurface();
    const loads: number[] = [];
    let value = 1;

    lifecycle.onData(() => {
      loads.push(value);
    });

    await lifecycle.mount();
    value = 2;
    await lifecycle.reload();
    expect(loads).toEqual([1, 2]);
  });

  it("a rejected loader never breaks the others on reload()", async () => {
    const lifecycle = createLifecycleSurface();
    const loaded = vi.fn();

    lifecycle.onData(async () => {
      throw new Error("loader down");
    });
    lifecycle.onData(loaded);

    await expect(lifecycle.reload()).resolves.toBeUndefined();
    expect(loaded).toHaveBeenCalledTimes(1);
  });

  it("runs unmount callbacks LIFO, then cleanups, and clears registrations", async () => {
    const lifecycle = createLifecycleSurface();
    const order: string[] = [];

    lifecycle.onUnmount(() => order.push("unmount-1"));
    lifecycle.onUnmount(() => order.push("unmount-2"));
    lifecycle.cleanup(() => order.push("cleanup"));

    await lifecycle.mount();
    lifecycle.unmount();
    expect(order).toEqual(["unmount-2", "unmount-1", "cleanup"]);

    // Registrations were cleared: a second unmount cycle re-runs nothing.
    await lifecycle.mount();
    lifecycle.unmount();
    expect(order).toEqual(["unmount-2", "unmount-1", "cleanup"]);
  });

  it("unmount before mount is a no-op and mount is idempotent", async () => {
    const lifecycle = createLifecycleSurface();
    const mountFn = vi.fn();
    const cleanupFn = vi.fn();

    lifecycle.onMount(mountFn);
    lifecycle.cleanup(cleanupFn);

    lifecycle.unmount();
    expect(cleanupFn).not.toHaveBeenCalled();

    await lifecycle.mount();
    await lifecycle.mount();
    expect(mountFn).toHaveBeenCalledTimes(1);
  });
});

describe("app.lifecycle.poll", () => {
  it("runs immediately by default and then on every interval", () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    lifecycle.poll(tick, 1000);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it("immediate: false waits for the first interval", () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    lifecycle.poll(tick, 1000, { immediate: false });
    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("pauses while the document is hidden and resumes with a catch-up run", () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    lifecycle.poll(tick, 1000);
    expect(tick).toHaveBeenCalledTimes(1);

    setDocumentHidden(true);
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(1);

    setDocumentHidden(false);
    expect(tick).toHaveBeenCalledTimes(2); // catch-up run on resume
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("defers the start until visible when created on a hidden tab", () => {
    documentHidden = true;
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    lifecycle.poll(tick, 1000);
    vi.advanceTimersByTime(3000);
    expect(tick).not.toHaveBeenCalled();

    setDocumentHidden(false);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("pauseWhenHidden: false keeps polling while hidden", () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    lifecycle.poll(tick, 1000, { pauseWhenHidden: false });
    setDocumentHidden(true);
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("auto-cleans up on unmount (timer stopped, visibility listener removed)", async () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    await lifecycle.mount();
    lifecycle.poll(tick, 1000);
    expect(tick).toHaveBeenCalledTimes(1);

    lifecycle.unmount();
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(1);

    // The visibility listener must be gone too — no resume restart.
    setDocumentHidden(true);
    setDocumentHidden(false);
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("the returned disposer stops the poller and is idempotent", () => {
    const lifecycle = createLifecycleSurface();
    const tick = vi.fn();

    const stop = lifecycle.poll(tick, 1000);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(2);

    stop();
    stop();
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(2);

    // A resume event after disposal must not restart the loop.
    setDocumentHidden(true);
    setDocumentHidden(false);
    vi.advanceTimersByTime(2000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("keeps polling after sync throws and async rejections", async () => {
    const lifecycle = createLifecycleSurface();
    let calls = 0;

    lifecycle.poll(() => {
      calls += 1;
      if (calls === 1) throw new Error("sync tick failure");
      return Promise.reject(new Error("async tick failure"));
    }, 1000);
    expect(calls).toBe(1);

    vi.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(calls).toBe(3);
  });
});

describe("app.lifecycle bound to ctx.services.lifecycle", () => {
  function makeService() {
    const cleanups: Array<() => void> = [];
    const dataLoaders: Array<() => Promise<void>> = [];
    const service = {
      onMount: vi.fn(),
      onUnmount: vi.fn(),
      onDataLoad: vi.fn((loader: () => Promise<void>) => {
        dataLoaders.push(loader);
      }),
      reloadData: vi.fn(async () => {
        await Promise.allSettled(dataLoaders.map((loader) => loader()));
      }),
      registerCleanup: vi.fn((fn: () => void) => {
        cleanups.push(fn);
      }),
      mount: vi.fn(async () => {}),
      unmount: vi.fn(() => {
        for (const fn of cleanups) fn();
        cleanups.length = 0;
      }),
    } satisfies LifecycleSurfaceService;
    return { service, cleanups };
  }

  it("delegates onMount/onUnmount/onData/reload/cleanup to the service", async () => {
    const { service } = makeService();
    const lifecycle = createLifecycleSurface({ lifecycle: service });

    const mountFn = vi.fn();
    const unmountFn = vi.fn();
    const loader = vi.fn();
    const cleanupFn = vi.fn();

    lifecycle.onMount(mountFn);
    lifecycle.onUnmount(unmountFn);
    lifecycle.onData(loader);
    lifecycle.cleanup(cleanupFn);

    expect(service.onMount).toHaveBeenCalledWith(mountFn);
    expect(service.onUnmount).toHaveBeenCalledWith(unmountFn);
    expect(service.onDataLoad).toHaveBeenCalledTimes(1);
    expect(service.registerCleanup).toHaveBeenCalledWith(cleanupFn);

    await lifecycle.reload();
    expect(service.reloadData).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("mount()/unmount() drive the service lifecycle", async () => {
    const { service } = makeService();
    const lifecycle = createLifecycleSurface({ lifecycle: service });

    await lifecycle.mount();
    expect(service.mount).toHaveBeenCalledTimes(1);

    lifecycle.unmount();
    expect(service.unmount).toHaveBeenCalledTimes(1);
  });

  it("poll registers its disposer with the service for auto-cleanup", () => {
    const { service, cleanups } = makeService();
    const lifecycle = createLifecycleSurface({ lifecycle: service });
    const tick = vi.fn();

    lifecycle.poll(tick, 1000);
    expect(service.registerCleanup).toHaveBeenCalledTimes(1);
    expect(cleanups).toHaveLength(1);
    expect(tick).toHaveBeenCalledTimes(1);

    // Service-driven unmount runs the registered cleanup and stops the loop.
    lifecycle.unmount();
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
