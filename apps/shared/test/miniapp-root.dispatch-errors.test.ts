/**
 * Kernel-level error convention for MiniAppRoot.dispatch (MP-W2-02).
 *
 * Every dispatch failure must surface as a status toast so apps that never
 * wrap their handlers (milestone-escrow, neo-convert, quadratic-funding, …)
 * are safe by default — AND the error must keep rethrowing so PlayAreas with
 * their own catch blocks (dice-game's formError, timestamp-proof's input
 * preservation) keep working and post-success steps stay gated on a
 * resolved dispatch.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeMessages } from "@shared/locale/base-messages";

import { MiniAppRoot } from "@shared/react/MiniAppRoot";

type Dispatch = (name: string, ...args: unknown[]) => Promise<void>;

const manifest = {
  name: "Dispatch Error Test App",
  description: "Exercise the kernel dispatch error convention",
  icon: "sparkles",
  category: "tool",
  tabs: [{ key: "play", labelKey: "play", icon: "play", default: true }],
  permissions: {
    payments: true,
    aa: true,
  },
} as const;

const messages = mergeMessages({
  title: { en: "Dispatch Error Test App", zh: "Dispatch Error Test App" },
  errorFallback: { en: "Something went wrong", zh: "Something went wrong" },
  overview: { en: "Overview", zh: "Overview" },
  play: { en: "Play", zh: "Play" },
});

let capturedDispatch: Dispatch | null = null;

const CapturingPlayArea = (props: { dispatch: Dispatch }) => {
  capturedDispatch = props.dispatch;
  return React.createElement("div", { "data-testid": "play-area" }, "play area");
};

async function mountWithHandlers(
  appId: string,
  handlers: Record<string, (...args: unknown[]) => Promise<unknown>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  root.render(
    React.createElement(MiniAppRoot, {
      appId,
      playArea: CapturingPlayArea as any,
      manifest,
      messages,
      setupFn: async (ctx: Record<string, any>) => {
        for (const [key, handler] of Object.entries(handlers)) {
          ctx.registerAction(key, handler);
        }
        return {};
      },
    }),
  );

  await vi.waitFor(() => {
    expect(capturedDispatch).not.toBeNull();
  });

  return {
    container,
    dispatch: capturedDispatch!,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("MiniAppRoot.dispatch error convention", () => {
  beforeEach(() => {
    capturedDispatch = null;
    // dispatch logs the failure before toasting; keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces a thrown handler error as a status toast and still rethrows", async () => {
    const { container, dispatch, unmount } = await mountWithHandlers(
      "miniapp-dispatch-error-test",
      {
        explode: async () => {
          throw new Error("handler exploded");
        },
      },
    );

    // The error keeps propagating so PlayArea catch blocks / post-success
    // gating (`await dispatch(...); resetForm()`) behave exactly as before.
    await expect(dispatch("explode")).rejects.toThrow("handler exploded");

    // Safe-by-default: the toast renders without any app-side wrapping.
    await vi.waitFor(() => {
      expect(container.innerHTML).toContain("handler exploded");
    });

    unmount();
  });

  it("falls back to a generic message when the handler throws a non-Error", async () => {
    const { container, dispatch, unmount } = await mountWithHandlers(
      "miniapp-dispatch-non-error-test",
      {
        explodeRaw: async () => {
          throw "string failure";
        },
      },
    );

    await expect(dispatch("explodeRaw")).rejects.toBe("string failure");

    await vi.waitFor(() => {
      expect(container.innerHTML).toContain("Action failed");
    });

    unmount();
  });

  it("leaves successful dispatches untouched: payload returned, no error toast", async () => {
    const { container, dispatch, unmount } = await mountWithHandlers(
      "miniapp-dispatch-success-test",
      {
        succeed: async () => 42,
      },
    );

    // dispatch keeps returning handler payloads at runtime for components
    // that need success/failure semantics.
    await expect(dispatch("succeed")).resolves.toBe(42);
    expect(container.innerHTML).not.toContain("Action failed");

    // Unregistered actions remain a silent no-op (resolve undefined).
    await expect(dispatch("missing")).resolves.toBeUndefined();

    unmount();
  });
});
