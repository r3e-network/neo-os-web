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
        appId: "miniapp-red-envelope",
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

    root.unmount();
    container.remove();
  });
});
