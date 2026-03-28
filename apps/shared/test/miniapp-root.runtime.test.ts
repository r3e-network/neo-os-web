import { createApp, defineComponent, h, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { mergeMessages } from "@shared/locale/base-messages";

vi.mock("@shared/components/ErrorBoundary.vue", () => ({
  default: defineComponent({
    name: "StubErrorBoundary",
    template: `<div><slot /></div>`,
  }),
}));

import MiniAppRoot from "@shared/components/MiniAppRoot.vue";
import { EventBus } from "@shared/services/EventBus";

const DummyPlayArea = defineComponent({
  name: "DummyPlayArea",
  template: `<div data-testid="play-area">play area</div>`,
});

const manifest = {
  name: "Runtime Test App",
  description: "Exercise runtime-owned platform services",
  icon: "sparkles",
  category: "tool",
  tabs: [
    { key: "play", labelKey: "play", icon: "play", default: true },
  ],
  sidebar: {
    items: [
      { labelKey: "counter", valueKey: "counter", format: "number" },
    ],
  },
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

    createApp({
      render() {
        return h(MiniAppRoot as any, {
          appId: "miniapp-runtime-test",
          playArea: DummyPlayArea,
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
        });
      },
    }).mount(container);

    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(capturedCtx).not.toBeNull();

    await capturedCtx!.services.notify.guard(async () => "ok", "actionComplete");
    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toContain("Action complete");
  });

  it("surfaces platform error events through the universal status toast", async () => {
    let capturedCtx: Record<string, any> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);

    createApp({
      render() {
        return h(MiniAppRoot as any, {
          appId: "miniapp-runtime-error-test",
          playArea: DummyPlayArea,
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
        });
      },
    }).mount(container);

    await nextTick();
    await Promise.resolve();
    await nextTick();

    capturedCtx!.services.events.emit(EventBus.ERROR, {
      error: new Error("boom"),
      context: "test",
    });
    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(container.innerHTML).toContain("boom");
  });
});
