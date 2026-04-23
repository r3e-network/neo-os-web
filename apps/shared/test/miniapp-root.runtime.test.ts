import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { mergeMessages } from "@shared/locale/base-messages";

import { MiniAppRoot } from "@shared/react/MiniAppRoot";
import { EventBus } from "@shared/services/EventBus";

const DummyPlayArea = () =>
  React.createElement("div", { "data-testid": "play-area" }, "play area");

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
});
