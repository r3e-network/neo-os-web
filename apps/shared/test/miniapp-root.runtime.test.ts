import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { mergeMessages } from "@shared/locale/base-messages";

import { MiniAppRoot } from "@shared/react/MiniAppRoot";
import { EventBus } from "@shared/services/EventBus";

const DummyPlayArea = () =>
  React.createElement("div", { "data-testid": "play-area" }, "play area");

const ModePlayArea = ({ state }: { state: Record<string, { get?: () => unknown }> }) =>
  React.createElement("div", { "data-testid": "play-area-mode" }, String(state.mode?.get?.() ?? "missing"));

const manifest = {
  name: "Runtime Test App",
  description: "Exercise runtime-owned platform services",
  icon: "sparkles",
  category: "tool",
  tabs: [
    { key: "play", labelKey: "play", icon: "play", default: true },
  ],
  permissions: {
    payments: true,
    aa: true,
  },
} as const;

const gameManifest = {
  ...manifest,
  name: "Runtime Game",
  description: "A standalone runtime game should still start from its launch page.",
  category: "game",
  shell: "game",
  docs: [
    { titleKey: "rulesTitle", contentKey: "rulesCopy", type: "steps" },
    { titleKey: "fairnessTitle", contentKey: "fairnessCopy", type: "text" },
  ],
  stats: [
    { labelKey: "scoreWon", valueKey: "wins", format: "text" },
  ],
} as const;

const configuredGameManifest = {
  ...gameManifest,
  gamePage: {
    categoryColor: "#10B981",
    heroBadgeKey: "playTab",
    heroTitleKey: "playTab",
    heroTitleAccent: "playTab",
    heroDescKey: "rulesCopy",
    primaryLabelKey: "startAction",
    ghostLabelKey: "rulesTitle",
    featuresEyebrowKey: "playTab",
    featuresTitleKey: "fairnessTitle",
    features: [
      {
        titleKey: "fairnessTitle",
        descKey: "fairnessCopy",
        large: true,
        gradient: "linear-gradient(135deg, #F0FDF4 0%, #86EFAC 100%)",
      },
      {
        titleKey: "rulesTitle",
        descKey: "rulesCopy",
      },
    ],
    ctaTitleKey: "rulesTitle",
    ctaDescKey: "rulesCopy",
    ctaLabelKey: "startAction",
    trustBadgeKeys: ["neoN3", "fairnessTitle"],
  },
} as const;

const messages = mergeMessages({
  title: { en: "Runtime Test App", zh: "Runtime Test App" },
  neoN3: { en: "Neo N3", zh: "Neo N3" },
  navigationSidebar: { en: "Navigation", zh: "Navigation" },
  operationsPanel: { en: "Operations", zh: "Operations" },
  commentsTitle: { en: "Comments", zh: "Comments" },
  commentPlaceholder: { en: "Write a comment", zh: "Write a comment" },
  postComment: { en: "Post comment", zh: "Post comment" },
  post: { en: "Post", zh: "Post" },
  noComments: { en: "No comments", zh: "No comments" },
  docSubtitle: { en: "Docs", zh: "Docs" },
  subtitle: { en: "Subtitle", zh: "Subtitle" },
  notAvailable: { en: "N/A", zh: "N/A" },
  errorFallback: { en: "Something went wrong", zh: "Something went wrong" },
  overview: { en: "Overview", zh: "Overview" },
  stats: { en: "Stats", zh: "Stats" },
  play: { en: "Play", zh: "Play" },
  actionComplete: { en: "Action complete", zh: "Action complete" },
  playTab: { en: "Game", zh: "Game" },
  startAction: { en: "Start game", zh: "Start game" },
  rulesTitle: { en: "How to play", zh: "How to play" },
  rulesCopy: { en: "Start, play, and submit the verified result.", zh: "Start, play, and submit the verified result." },
  fairnessTitle: { en: "Verified settlement", zh: "Verified settlement" },
  fairnessCopy: { en: "The result is checked before rewards settle.", zh: "The result is checked before rewards settle." },
  ranksTab: { en: "Leaderboard", zh: "Leaderboard" },
  scoreWon: { en: "Total won", zh: "Total won" },
});

describe("MiniAppRoot runtime-owned services", () => {
  it("auto-provisions real platform services and surfaces notification events", async () => {
    let capturedCtx: Record<string, any> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-test",
        playArea: DummyPlayArea as any,
        manifest,
        messages,
        setupFn: async (ctx: Record<string, any>) => {
          capturedCtx = ctx;
          return {
            state: {
              counter: { value: 1 },
            },
          };
        },
      }),
    );

    // Flush React effects
    await vi.waitFor(() => {
      expect(capturedCtx).not.toBeNull();
    });

    await capturedCtx!.services.notify.guard(async () => "ok", "actionComplete");
    await vi.waitFor(() => {
      expect(container.innerHTML).toContain("Action complete");
    });

    root.unmount();
    container.remove();
  });

  it("surfaces platform error events through the universal status toast", async () => {
    let capturedCtx: Record<string, any> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-error-test",
        playArea: DummyPlayArea as any,
        manifest,
        messages,
        setupFn: async (ctx: Record<string, any>) => {
          capturedCtx = ctx;
          return {
            state: {
              counter: { value: 1 },
            },
          };
        },
      }),
    );

    // Flush React effects
    await vi.waitFor(() => {
      expect(capturedCtx).not.toBeNull();
    });

    capturedCtx!.services.events.emit(EventBus.ERROR, {
      error: new Error("boom"),
      context: "test",
    });

    await vi.waitFor(() => {
      expect(container.innerHTML).toContain("boom");
    });

    root.unmount();
    container.remove();
  });

  it("does not reserve an empty operation sidebar when no operations are configured", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-test/index.html?source=platform",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-no-ops",
        playArea: DummyPlayArea as any,
        manifest,
        messages,
        setupFn: async () => ({
          state: {
            counter: { value: 1 },
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".page-grid--no-operation")).not.toBeNull();
      expect(container.querySelector(".sidebar-right")).toBeNull();
    });

    root.unmount();
    container.remove();
  });

  it("opens OneGate game dapps directly into the play area", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: DummyPlayArea as any,
        manifest: gameManifest,
        messages,
        setupFn: async () => ({
          state: {
            wins: { value: "0 GAS" },
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area"]')).not.toBeNull();
      expect(container.innerHTML).not.toContain("Start game");
    });

    root.unmount();
    container.remove();
  });

  it("keeps configured game launch details secondary for direct browser opens", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: DummyPlayArea as any,
        manifest: configuredGameManifest,
        messages,
        setupFn: async () => ({
          state: {
            wins: { value: "0 GAS" },
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".n3h-shell")).not.toBeNull();
      expect(container.querySelector(".n3h-features")).toBeNull();
      expect(container.querySelector(".n3h-cta")).toBeNull();
      expect(container.querySelector(".n3gh-feature-grid")).toBeNull();
      expect(container.querySelector(".n3gh-note")).toBeNull();
      expect(container.querySelector(".n3gh-rules-body")).toBeNull();
      expect(container.querySelector('[data-testid="play-area"]')).toBeNull();
    });

    const detailsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("How to play"),
    );
    expect(detailsButton).toBeTruthy();
    detailsButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(container.querySelector(".n3gh-details--open")).not.toBeNull();
      expect(container.innerHTML).toContain("Verified settlement");
      expect(container.innerHTML).toContain("Start, play, and submit the verified result.");
      expect(container.querySelectorAll(".n3gh-note-action")).toHaveLength(0);
    });

    root.unmount();
    container.remove();
  });

  it("enters guest mode from the two-choice game launcher before mounting the play area", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const loadData = vi.fn(async () => undefined);
    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
          loadData,
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".n3h-shell")).not.toBeNull();
      expect(container.innerHTML).toContain("Earn GAS");
      expect(container.innerHTML).toContain("Play free");
      expect(container.querySelector('[data-testid="play-area-mode"]')).toBeNull();
    });

    const guestButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Play free"),
    );
    expect(guestButton).toBeTruthy();
    guestButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("guest");
      expect(document.documentElement.dataset.appMode).toBe("guest");
      expect(loadData).toHaveBeenCalled();
    });

    root.unmount();
    container.remove();
  });

  it("offers free play only and defaults to guest when GameFi is temporarily disabled", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?mode=gamefi",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    let modeDuringSetup = "";

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: {
          ...configuredGameManifest,
          supportsGuest: true,
          supportsGameFi: false,
        },
        messages,
        setupFn: async (ctx: any) => {
          modeDuringSetup = ctx.framework.mode.get();
          return {
            state: {
              mode: ctx.framework.mode.current,
            },
          };
        },
      }),
    );

    await vi.waitFor(() => {
      expect(modeDuringSetup).toBe("guest");
      expect(container.innerHTML).toContain("Play free");
      expect(container.innerHTML).not.toContain("Earn GAS</button>");
      expect(container.innerHTML).toContain("Earn GAS temporarily unavailable");
      expect(container.querySelector('[data-testid="play-area-mode"]')).toBeNull();
    });

    const playButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Play free"),
    );
    expect(playButton).toBeTruthy();
    playButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("guest");
      expect(document.documentElement.dataset.appMode).toBe("guest");
    });

    root.unmount();
    container.remove();
  });

  it("keeps the two-choice launcher visible in OneGate when a game supports guest play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).not.toBeNull();
      expect(container.innerHTML).toContain("Earn GAS");
      expect(container.innerHTML).toContain("Play free");
      expect(container.querySelector('[data-testid="play-area-mode"]')).toBeNull();
    });

    root.unmount();
    container.remove();
  });

  it("keeps passive OneGate verification links on the two-choice launcher", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&verify=mobile",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).not.toBeNull();
      expect(container.innerHTML).toContain("Earn GAS");
      expect(container.innerHTML).toContain("Play free");
      expect(container.querySelector('[data-testid="play-area-mode"]')).toBeNull();
    });

    root.unmount();
    container.remove();
  });

  it("opens OneGate operation deep links directly into GameFi play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&operation=claimPool&poolId=42",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });

  it("opens OneGate resource deep links directly into GameFi play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&envelopeId=red-42",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });

  it("keeps OneGate operation deep links in GameFi even when guest mode is requested", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&mode=guest&operation=claimPool&poolId=42",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });

  it("keeps OneGate resource deep links in GameFi even when guest mode is requested", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&mode=guest&envelopeId=red-42",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });

  it("opens explicit OneGate guest-mode links directly into guest play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&mode=guest",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("guest");
      expect(document.documentElement.dataset.appMode).toBe("guest");
    });

    root.unmount();
    container.remove();
  });

  it("opens normalized OneGate app_mode guest links directly into guest play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&app_mode=guest",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("guest");
      expect(document.documentElement.dataset.appMode).toBe("guest");
    });

    root.unmount();
    container.remove();
  });

  it("keeps normalized OneGate play-mode resource links in GameFi", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&play-mode=guest&pool_id=42",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });

  it("opens explicit OneGate gamefi-mode links directly into GameFi play", async () => {
    window.history.pushState(
      {},
      "",
      "/miniapps/runtime-game/index.html?source=onegate&mode=gamefi",
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      React.createElement(MiniAppRoot, {
        appId: "miniapp-runtime-game",
        playArea: ModePlayArea as any,
        manifest: { ...configuredGameManifest, supportsGuest: true },
        messages,
        setupFn: async (ctx: any) => ({
          state: {
            mode: ctx.framework.mode.current,
          },
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(container.querySelector(".standalone-dapp-root")).not.toBeNull();
      expect(container.querySelector(".n3h-shell")).toBeNull();
      expect(container.querySelector('[data-testid="play-area-mode"]')?.textContent).toBe("gamefi");
      expect(document.documentElement.dataset.appMode).toBe("gamefi");
    });

    root.unmount();
    container.remove();
  });
});
