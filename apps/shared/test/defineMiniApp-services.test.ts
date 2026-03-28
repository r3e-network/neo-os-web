// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { defineMiniApp } from "../utils/defineMiniApp";
import { PlatformServices } from "../services";

vi.mock("@shared/composables/useI18n", () => ({
  createUseI18n: () => () => ({
    locale: { value: "en" },
    t: (key: string) => key,
    setLocale: () => {},
  }),
  useI18n: () => ({
    locale: { value: "en" },
    t: (key: string) => key,
    setLocale: () => {},
  }),
}));

vi.mock("../components/ErrorBoundary.vue", () => ({
  default: defineComponent({
    name: "MockErrorBoundary",
    setup(_props, { slots }) {
      return () => slots.default?.();
    },
  }),
}));

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

    const PlayArea = defineComponent({
      name: "TestPlayArea",
      props: {
        services: { type: Object, required: true },
      },
      setup(props) {
        playAreaServices = props.services;
        return () => h("div", "play-area");
      },
    });

    const app = defineMiniApp({
      appId: "miniapp-test-service-ownership",
      playArea: PlayArea,
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

    await nextTick();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(setupServices).toBe(fakeServices);
    expect(playAreaServices).toBe(fakeServices);
    expect(fakeServices.lifecycle.mount).toHaveBeenCalledTimes(1);

    app.unmount();

    expect(fakeServices.destroy).toHaveBeenCalledTimes(1);
  });
});
