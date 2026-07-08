/**
 * S1 app.notify spec (framework-extraction plan §2/S1).
 *
 * Covers the t-key + params interpolation hard requirement: the app.notify
 * surface itself (service delegation + ctx.setStatus fallback with chain-error
 * mapping), and the param-dropping bug fix at the three internal
 * `notify.success?.(successKey)` sites — success params must now thread
 * through actions.register, operations.run and chain.write / funds.payAndCall
 * success toasts, including `(result) => params` builders driven by the
 * post-write value.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return Object.entries(params).reduce(
    (out, [name, value]) => out.replace(`{${name}}`, String(value)),
    key,
  );
}

function makeChain() {
  return {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
  };
}

function makeNotify({ withGuardResult = true } = {}) {
  const success = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const guardResult = vi.fn(
    async (fn: () => Promise<unknown>, successKey?: string, errorKey?: string) => {
      try {
        const value = await fn();
        if (successKey) success(successKey);
        return { ok: true as const, value };
      } catch (caught) {
        error(caught, errorKey);
        return { ok: false as const, error: caught };
      }
    },
  );
  return {
    success,
    error,
    info,
    warn,
    guardResult: withGuardResult ? guardResult : undefined,
  };
}

function makeFramework(overrides: Record<string, unknown> = {}) {
  const chain = makeChain();
  const notify = "notify" in overrides ? overrides.notify : makeNotify();
  const setStatus = vi.fn();
  const ctx = {
    services: { chain, ...(notify ? { notify } : {}) },
    t,
    setStatus,
    registerAction: vi.fn(),
  } as unknown as MiniAppFrameworkContext;
  return {
    app: createMiniAppFramework(ctx, { appId: "notify-app" }),
    chain,
    notify: notify as ReturnType<typeof makeNotify> | undefined,
    setStatus,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("S1 app.notify surface", () => {
  it("delegates success/info/warn with params to the injected service", () => {
    const { app, notify } = makeFramework();
    app.notify.success("toastVaultCreated", { id: 7 });
    app.notify.info("pending", { round: 2 });
    app.notify.warn("lowBalance", { gas: "0.5" });
    expect(notify!.success).toHaveBeenCalledWith("toastVaultCreated", { id: 7 });
    expect(notify!.info).toHaveBeenCalledWith("pending", { round: 2 });
    expect(notify!.warn).toHaveBeenCalledWith("lowBalance", { gas: "0.5" });
  });

  it("delegates error with the fallback key to the injected service", () => {
    const { app, notify } = makeFramework();
    const boom = new Error("boom");
    app.notify.error(boom, "claimFailed");
    expect(notify!.error).toHaveBeenCalledWith(boom, "claimFailed");
  });

  it("falls back to ctx.setStatus with interpolated copy when no service", () => {
    const { app, setStatus } = makeFramework({ notify: undefined });
    app.notify.success("withdrew {amount} GAS", { amount: "1.5" });
    expect(setStatus).toHaveBeenCalledWith("withdrew 1.5 GAS", "success");
    app.notify.info("infoKey");
    expect(setStatus).toHaveBeenCalledWith("infoKey", "info");
    app.notify.warn("warnKey");
    expect(setStatus).toHaveBeenCalledWith("warnKey", "warning");
  });

  it("maps chain errors to localized family copy in the setStatus fallback", () => {
    const { app, setStatus } = makeFramework({ notify: undefined });
    // Known chain family → mapped i18n key (t echoes the key).
    app.notify.error(new Error("not enough gas"));
    expect(setStatus).toHaveBeenCalledWith("insufficientGas", "error");
    // App-authored copy passes through verbatim.
    app.notify.error(new Error("custom business assert"));
    expect(setStatus).toHaveBeenCalledWith("custom business assert", "error");
    // Non-error values fall back to the (translated) fallback key.
    app.notify.error(42, "somethingFailed");
    expect(setStatus).toHaveBeenCalledWith("somethingFailed", "error");
  });

  it("guardResult threads successParams builders from the result", async () => {
    const { app, notify } = makeFramework();
    const result = await app.notify.guardResult(
      async () => ({ vaultId: 12 }),
      {
        successKey: "toastVaultCreated",
        successParams: (value) => ({ id: value.vaultId }),
      },
    );
    expect(result).toEqual({ ok: true, value: { vaultId: 12 } });
    expect(notify!.success).toHaveBeenCalledWith("toastVaultCreated", { id: 12 });
  });

  it("guardResult returns {ok:false} and toasts the error without throwing", async () => {
    const { app, notify } = makeFramework();
    const boom = new Error("boom");
    const result = await app.notify.guardResult(async () => {
      throw boom;
    }, { errorKey: "claimFailed" });
    expect(result).toEqual({ ok: false, error: boom });
    expect(notify!.error).toHaveBeenCalledWith(boom, "claimFailed");
    expect(notify!.success).not.toHaveBeenCalled();
  });

  it("guard resolves the value, returns undefined on error, rethrows on demand", async () => {
    const { app } = makeFramework();
    await expect(app.notify.guard(async () => 5)).resolves.toBe(5);
    await expect(app.notify.guard(async () => {
      throw new Error("boom");
    })).resolves.toBeUndefined();
    await expect(
      app.notify.guard(async () => {
        throw new Error("boom");
      }, { rethrow: true }),
    ).rejects.toThrow("boom");
  });
});

describe("S1 params threading through internal success toasts", () => {
  it("chain.write threads literal successParams past the host guardResult", async () => {
    const { app, notify } = makeFramework();
    await app.chain.write({
      operation: "createVault",
      args: [],
      successKey: "toastVaultCreated",
      successParams: { id: 7 },
    });
    // The host guardResult cannot thread params — the framework must emit
    // the success toast itself, so guardResult gets NO successKey.
    expect(notify!.guardResult).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      undefined,
    );
    expect(notify!.success).toHaveBeenCalledWith("toastVaultCreated", { id: 7 });
  });

  it("chain.write feeds the tx result into (result) => params builders", async () => {
    const { app, notify } = makeFramework();
    await app.chain.write({
      operation: "claim",
      args: [],
      successKey: "claimedTx",
      successParams: (tx) => ({ txid: tx.txid }),
    });
    expect(notify!.success).toHaveBeenCalledWith("claimedTx", { txid: "0xinvoke" });
  });

  it("chain.write without params keeps the exact legacy delegation shape", async () => {
    const { app, notify } = makeFramework();
    await app.chain.write({ operation: "claim", args: [], successKey: "claimSuccess" });
    expect(notify!.guardResult).toHaveBeenCalledWith(
      expect.any(Function),
      "claimSuccess",
      undefined,
    );
    // The success toast came from the delegated guardResult, key-only.
    expect(notify!.success).toHaveBeenCalledWith("claimSuccess");
  });

  it("chain.write threads params on hosts without guardResult too", async () => {
    const notify = makeNotify({ withGuardResult: false });
    const { app } = makeFramework({ notify });
    await app.chain.write({
      operation: "withdraw",
      args: [],
      successKey: "withdrewAmount",
      successParams: { amount: "2.5" },
    });
    expect(notify.success).toHaveBeenCalledWith("withdrewAmount", { amount: "2.5" });
  });

  it("funds.payAndCall threads successParams", async () => {
    const { app, notify } = makeFramework();
    await app.funds.payAndCall({
      operation: "stake",
      args: [],
      amountGas: "1",
      memo: "stake",
      successKey: "stakedAmount",
      successParams: { amount: "1" },
    });
    expect(notify!.success).toHaveBeenCalledWith("stakedAmount", { amount: "1" });
  });

  it("actions.register threads successParams from the handler result", async () => {
    const { app, notify } = makeFramework();
    app.actions.register(
      "submitRequest",
      async (id: number) => ({ requestId: id * 10 }),
      {
        successKey: "requestSubmitted",
        successParams: (value) => ({ id: value.requestId }),
      },
    );
    await expect(app.actions.run("submitRequest", 4)).resolves.toEqual({ requestId: 40 });
    expect(notify!.success).toHaveBeenCalledWith("requestSubmitted", { id: 40 });
  });

  it("actions.register keeps error semantics: toast + undefined, rethrow opt-in", async () => {
    const { app, notify } = makeFramework();
    const boom = new Error("boom");
    app.actions.register("failing", async () => {
      throw boom;
    }, { errorKey: "failed" });
    await expect(app.actions.run("failing")).resolves.toBeUndefined();
    expect(notify!.error).toHaveBeenCalledWith(boom, "failed");

    app.actions.register("failingRethrow", async () => {
      throw boom;
    }, { rethrow: true });
    await expect(app.actions.run("failingRethrow")).rejects.toBe(boom);
  });

  it("operations.run threads successParams from the run value", async () => {
    const { app, notify } = makeFramework();
    const op = app.operations.create<{ txid: string; amount: string }>("withdraw");
    await op.run(async () => ({ txid: "0xdead", amount: "3.5" }), {
      successKey: "withdrewAmount",
      successParams: (value) => ({ amount: value.amount }),
    });
    expect(op.state.get().status).toBe("succeeded");
    expect(notify!.success).toHaveBeenCalledWith("withdrewAmount", { amount: "3.5" });
  });

  it("operations.run without params keeps the key-only call shape", async () => {
    const { app, notify } = makeFramework();
    const op = app.operations.create("claim");
    await op.run(async () => ({ txid: "0xdead" }), { successKey: "claimSuccess" });
    expect(notify!.success).toHaveBeenCalledWith("claimSuccess");
  });
});
