// @vitest-environment jsdom

/**
 * ctx.setError wiring (RFC P0-4).
 *
 * defineMiniApp's setup ctx publishes `setError(error, fallbackKey?)` — sugar
 * for `setStatus(framework.errors.messageOf(error, t(fallbackKey)), "error")`.
 * These tests pin the two behavioral guarantees of the lane:
 *
 * 1. Copy convergence: setError routes through the SAME chain-error family
 *    mapping `app.notify.error` uses (app.errors.messageOf), so the status
 *    strip and toast lanes show identical copy for wallet/VM/RPC failures.
 * 2. Pre-init safety: a setError call that races framework construction
 *    (reachable only through the ctx handed to createMiniAppFramework while
 *    the factory is still running) degrades to raw-message extraction
 *    instead of crashing. The mounted path constructs the framework
 *    synchronously on first render, so this branch is covered directly via
 *    the exported resolveSetErrorMessage resolver.
 */

import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineMiniApp } from "../react/defineMiniApp";
import type { MiniAppSetupContext } from "../react/defineMiniApp";
import { resolveSetErrorMessage } from "../react/MiniAppRoot";
import { PlatformServices } from "../services";
import type { StatusMessage } from "../composables/statusMessageCore";

function createFakeServices(appId: string) {
  return {
    appId,
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
}

describe("defineMiniApp ctx.setError (RFC P0-4)", () => {
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

  /** Mount a minimal app and hand back the captured setup ctx + status probe. */
  async function mountApp() {
    const appId = "miniapp-test-set-error";
    const fakeServices = createFakeServices(appId);
    vi.spyOn(PlatformServices, "create").mockReturnValue(
      fakeServices as never,
    );

    let capturedCtx: MiniAppSetupContext | undefined;
    let lastStatus: StatusMessage | null = null;

    const PlayArea = (props: { status: StatusMessage | null }) => {
      lastStatus = props.status;
      return null;
    };

    const root = defineMiniApp({
      appId,
      playArea: PlayArea as never,
      manifest: {
        name: "SetError Test App",
        description: "ctx.setError wiring test",
        icon: "app-window",
        category: "tool",
        tabs: [
          { key: "main", labelKey: "title", icon: "app-window", default: true },
        ],
      },
      messages: {
        customFallback: { en: "Custom fallback copy", zh: "自定义回退文案" },
      },
      setup(ctx) {
        capturedCtx = ctx;
        return { state: {} };
      },
    });

    await vi.waitFor(() => {
      expect(capturedCtx).toBeDefined();
    });

    return {
      root,
      ctx: capturedCtx!,
      status: () => lastStatus,
    };
  }

  it("maps chain-error families to the same copy app.notify.error shows", async () => {
    const { root, ctx, status } = await mountApp();
    const rejection = new Error("User rejected the request");

    act(() => {
      ctx.setError(rejection);
    });

    // Literal base-messages copy for the `userRejected` family…
    expect(status()).toEqual({
      msg: "Request cancelled in wallet.",
      type: "error",
    });
    // …and identical to what app.errors.messageOf (the notify.error mapping
    // lane) resolves for the same error: the two feedback lanes converge.
    expect(status()?.msg).toBe(ctx.framework.errors.messageOf(rejection));

    root.unmount();
  });

  it("shows a plain Error's own message verbatim", async () => {
    const { root, ctx, status } = await mountApp();

    act(() => {
      ctx.setError(new Error("app-authored failure"));
    });

    expect(status()).toEqual({ msg: "app-authored failure", type: "error" });

    root.unmount();
  });

  it("shows string errors verbatim", async () => {
    const { root, ctx, status } = await mountApp();

    act(() => {
      ctx.setError("plain string failure");
    });

    expect(status()).toEqual({ msg: "plain string failure", type: "error" });

    root.unmount();
  });

  it("resolves fallbackKey through the app translator when the error carries no message", async () => {
    const { root, ctx, status } = await mountApp();

    act(() => {
      ctx.setError({ weird: true }, "customFallback");
    });

    expect(status()).toEqual({ msg: "Custom fallback copy", type: "error" });

    root.unmount();
  });

  it("falls back to the base 'error' copy when no fallbackKey is given for a message-less error", async () => {
    const { root, ctx, status } = await mountApp();

    act(() => {
      ctx.setError(null);
    });

    expect(status()).toEqual({ msg: "Error", type: "error" });

    root.unmount();
  });
});

describe("resolveSetErrorMessage pre-init safety (framework not yet constructed)", () => {
  const t = (key: string) => `t:${key}`;

  it("extracts the raw Error message without the framework", () => {
    expect(
      resolveSetErrorMessage(null, t, new Error("boom before init")),
    ).toBe("boom before init");
  });

  it("passes string errors through verbatim", () => {
    expect(resolveSetErrorMessage(null, t, "string failure")).toBe(
      "string failure",
    );
  });

  it("translates fallbackKey for message-less errors", () => {
    expect(resolveSetErrorMessage(null, t, { weird: true }, "myFallback")).toBe(
      "t:myFallback",
    );
  });

  it("defaults to t('error') when neither message nor fallbackKey exist", () => {
    expect(resolveSetErrorMessage(null, t, undefined)).toBe("t:error");
  });

  it("never throws for exotic error values", () => {
    for (const value of [null, undefined, 0, Symbol("x"), { a: 1 }, []]) {
      expect(() => resolveSetErrorMessage(null, t, value)).not.toThrow();
    }
  });
});
