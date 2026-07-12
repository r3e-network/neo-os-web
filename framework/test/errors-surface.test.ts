/**
 * app.errors (RFC P0-4) — one-liner error→message extraction + typed code
 * checks, plus the translator-free utils/errors.errorMessage export.
 *
 * Locks the copy-convergence contract: for chain-error family failures,
 * app.errors.messageOf and the app.notify.error setStatus-fallback lane show
 * IDENTICAL copy.
 */
import { describe, expect, it, vi } from "vitest";
import { createErrorsSurface } from "../errors-surface";
import { RewardGameError } from "../gamefi";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";
import { errorMessage, MiniAppError } from "../utils/errors";

const t = (key: string) => `t:${key}`;

function makeApp() {
  const setStatus = vi.fn();
  const ctx = {
    services: {
      chain: {
        address: createObservable<string | null>(null),
        ensureWallet: vi.fn(async () => ""),
        read: vi.fn(async () => "0"),
        invoke: vi.fn(async () => ({ txid: "0x1" })),
        invokeWithPayment: vi.fn(async () => ({ txid: "0x2" })),
      },
    },
    t,
    setStatus,
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId: "errors-test" }), setStatus };
}

describe("createErrorsSurface().messageOf", () => {
  const errors = createErrorsSurface({ t });

  it("prefers the MiniAppError user message", () => {
    const err = new MiniAppError("technical detail", "SOME_CODE", "Friendly copy");
    expect(errors.messageOf(err)).toBe("Friendly copy");
  });

  it("maps chain-error families to the localized copy", () => {
    expect(errors.messageOf(new Error("User rejected the request"))).toBe("t:userRejected");
    expect(errors.messageOf(new Error("insufficient GAS for fees"))).toBe("t:insufficientGas");
  });

  it("falls back to Error.message, then string errors, then fallback, then t('error')", () => {
    expect(errors.messageOf(new Error("app-authored message"))).toBe("app-authored message");
    expect(errors.messageOf("plain string failure")).toBe("plain string failure");
    expect(errors.messageOf({ weird: true }, "already translated")).toBe("already translated");
    expect(errors.messageOf(null)).toBe("t:error");
  });

  it("kills the fleet ternary: messageOf(err, fallback) matches the hand-rolled pattern", () => {
    const err = new Error("boom");
    const handRolled = err instanceof Error ? err.message : "fallback";
    expect(errors.messageOf(err, "fallback")).toBe(handRolled);
    expect(errors.messageOf(undefined, "fallback")).toBe("fallback");
  });
});

describe("createErrorsSurface().is", () => {
  const errors = createErrorsSurface({ t });

  it("matches MiniAppError codes and code-carrying non-MiniAppError classes", () => {
    expect(errors.is(new MiniAppError("m", "GUEST_MODE_BLOCKED"), "GUEST_MODE_BLOCKED")).toBe(true);
    expect(errors.is(new MiniAppError("m", "GUEST_MODE_BLOCKED"), "OTHER")).toBe(false);
    expect(errors.is(new RewardGameError("POOL_LOW", "pool"), "POOL_LOW")).toBe(true);
    expect(errors.is(new Error("no code"), "ANY")).toBe(false);
    expect(errors.is("string", "ANY")).toBe(false);
    expect(errors.is(null, "ANY")).toBe(false);
  });
});

describe("utils/errors.errorMessage (translator-free one-liner)", () => {
  it("MiniAppError user message > Error.message > string > fallback", () => {
    expect(errorMessage(new MiniAppError("tech", "C", "Friendly"))).toBe("Friendly");
    expect(errorMessage(new MiniAppError("tech only", "C"))).toBe("tech only");
    expect(errorMessage(new Error("plain"))).toBe("plain");
    expect(errorMessage("string error")).toBe("string error");
    expect(errorMessage({}, "fallback")).toBe("fallback");
    expect(errorMessage(undefined)).toBe("error");
  });
});

describe("app.errors wiring + copy convergence with app.notify.error", () => {
  it("exposes the surface on ctx.framework", () => {
    const { app } = makeApp();
    expect(app.errors.messageOf(new Error("x"))).toBe("x");
    expect(app.errors.is(new MiniAppError("m", "C"), "C")).toBe(true);
  });

  it("shows the SAME chain-family copy as the notify.error setStatus fallback", () => {
    const { app, setStatus } = makeApp();
    const familyError = new Error("transaction was cancelled by user");
    app.notify.error(familyError);
    expect(setStatus).toHaveBeenCalledTimes(1);
    const [toastCopy] = setStatus.mock.calls[0]!;
    expect(app.errors.messageOf(familyError)).toBe(toastCopy);
    expect(toastCopy).toBe("t:userRejected");
  });
});
