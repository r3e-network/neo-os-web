// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineMiniApp } from "../react/defineMiniApp";
import { PlatformServices } from "../services";

describe("defineMiniApp service ownership", () => {
  let mountTarget: HTMLDivElement;

  beforeEach(() => {
    mountTarget = document.createElement("div");
    mountTarget.id = "app";
    document.body.appendChild(mountTarget);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mountTarget.remove();
  });

  it("creates platform services once, passes them through context and play area, and destroys them on unmount", async () => {
    const fakeServices = {
      appId: "miniapp-test-service-ownership",
      chain: { address: { value: null } },
      balance: {},
      transfer: {},
      oracle: {},
      aa: {},
      events: {
        on: vi.fn(() => vi.fn()),
      },
      cache: {},
      lifecycle: {
        mount: vi.fn().mockResolvedValue(undefined),
        reloadData: vi.fn().mockResolvedValue(undefined),
        registerCleanup: vi.fn(),
        onDataLoad: vi.fn(),
      },
      notify: {},
      clipboard: {},
      fmt: {},
      destroy: vi.fn(),
    };

    const createSpy = vi
      .spyOn(PlatformServices, "create")
      .mockReturnValue(fakeServices as never);

    let setupServices: unknown;
    let playAreaServices: unknown;

    const PlayArea = (props: Record<string, unknown>) => {
      playAreaServices = props.services;
      return null;
    };

    const root = defineMiniApp({
      appId: "miniapp-test-service-ownership",
      playArea: PlayArea as never,
      manifest: {
        name: "Test App",
        description: "Test app",
        icon: "app-window",
        category: "tools",
        tabs: [{ key: "main", labelKey: "title", icon: "app-window", default: true }],
      },
      setup(ctx) {
        setupServices = ctx.services;
        return {
          state: {},
        };
      },
    });

    // Flush React effects (useEffect runs asynchronously)
    await vi.waitFor(() => {
      expect(setupServices).toBeDefined();
    });

    // React StrictMode double-invokes the component body in development,
    // so PlatformServices.create may be called more than once.
    expect(createSpy).toHaveBeenCalled();
    expect(setupServices).toBe(fakeServices);
    expect(playAreaServices).toBe(fakeServices);
    expect(fakeServices.lifecycle.mount).toHaveBeenCalledTimes(1);

    root.unmount();

    expect(fakeServices.destroy).toHaveBeenCalledTimes(1);
  });
});
