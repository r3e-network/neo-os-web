import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { MiniAppRoot } from "@shared/react/MiniAppRoot";

const messages = {
  title: { en: "Launch App" },
  play: { en: "Play" },
  navigationSidebar: { en: "Navigation" },
  operationsPanel: { en: "Operations" },
  errorFallback: { en: "Something went wrong" },
};

describe("MiniAppRoot launch params", () => {
  it("passes URL launch params to setup and play area for standalone OneGate dapps", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/red-envelope/index.html?source=onegate&operation=createEnvelope&amount=7&count=3",
    );

    let setupLaunchContext: unknown;
    let playAreaLaunchContext: unknown;
    const container = document.createElement("div");
    document.body.appendChild(container);

    const PlayArea = (props: Record<string, unknown>) => {
      playAreaLaunchContext = props.launchContext;
      return React.createElement("div", { "data-testid": "play-area" });
    };

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-redenvelope",
        playArea: PlayArea as never,
        manifest: {
          name: "Launch App",
          description: "Launch app",
          icon: "gift",
          category: "gaming",
          tabs: [{ key: "play", labelKey: "play", icon: "gift", default: true }],
        },
        messages,
        setupFn: (ctx: Record<string, unknown>) => {
          setupLaunchContext = ctx.launchContext;
          return { state: {} };
        },
      }),
    );

    await vi.waitFor(() => {
      expect(setupLaunchContext).toBeDefined();
      expect(playAreaLaunchContext).toBeDefined();
    });

    expect(setupLaunchContext).toMatchObject({
      source: "onegate",
      operation: "createEnvelope",
      params: { amount: "7", count: "3" },
    });
    expect(playAreaLaunchContext).toMatchObject({
      source: "onegate",
      operation: "createEnvelope",
      params: { amount: "7", count: "3" },
    });
    expect(container.querySelector("[data-testid='standalone-dapp-root']")).not.toBeNull();
    expect(container.querySelector(".app-root")).toBeNull();
    expect(container.querySelector(".miniapp-page")).toBeNull();

    root.unmount();
    container.remove();
  });

  it("renders direct miniapp URLs as pure standalone dapps by default", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/red-envelope/index.html?operation=createEnvelope&amount=7&count=3",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const PlayArea = (props: Record<string, unknown>) =>
      React.createElement(
        "div",
        { "data-testid": "play-area" },
        (props.launchContext as { params?: Record<string, string> })?.params?.amount,
      );

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-redenvelope",
        playArea: PlayArea as never,
        manifest: {
          name: "Launch App",
          description: "Launch app",
          icon: "gift",
          category: "gaming",
          tabs: [{ key: "play", labelKey: "play", icon: "gift", default: true }],
        },
        messages,
        setupFn: () => ({ state: {} }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='play-area']")).not.toBeNull();
    });

    expect(container.querySelector("[data-testid='standalone-dapp-root']")).not.toBeNull();
    expect(container.querySelector(".app-root")).toBeNull();
    expect(container.querySelector(".miniapp-page")).toBeNull();
    expect(container.textContent).toContain("7");

    root.unmount();
    container.remove();
  });

  it("keeps the platform shell when the miniapp platform opens the app", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/red-envelope/index.html?source=platform&operation=createEnvelope&amount=7",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const PlayArea = () => React.createElement("div", { "data-testid": "play-area" });

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-redenvelope",
        playArea: PlayArea as never,
        manifest: {
          name: "Launch App",
          description: "Launch app",
          icon: "gift",
          category: "gaming",
          tabs: [{ key: "play", labelKey: "play", icon: "gift", default: true }],
        },
        messages,
        setupFn: () => ({ state: {} }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector("[data-testid='play-area']")).not.toBeNull();
    });

    expect(container.querySelector("[data-testid='standalone-dapp-root']")).toBeNull();
    expect(container.querySelector(".app-root")).not.toBeNull();
    expect(container.querySelector(".miniapp-page")).not.toBeNull();

    root.unmount();
    container.remove();
  });
});
