/**
 * S2 notify-policy spec (framework-extraction plan §2/S2).
 *
 * The always-notify behavior of chain.write / funds.payAndCall is the single
 * biggest migration blocker for the deposit-then-act cohort — the
 * `notify: 'all' | 'errors' | 'silent'` policy must suppress EXACTLY the
 * right toasts:
 * - 'all' (default): success + error toasts — byte-identical legacy behavior
 * - 'errors': error toasts only
 * - 'silent': no toasts at all; errors still throw for app-side handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string) {
  return key;
}

function makeFramework({ invokeFails = false } = {}) {
  const boom = new Error("FAULT: assert failed");
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => {
      if (invokeFails) throw boom;
      return { txid: "0xinvoke", success: true };
    }),
    invokeWithPayment: vi.fn(async () => {
      if (invokeFails) throw boom;
      return { txid: "0xpay", success: true };
    }),
    invokeMultiple: vi.fn(async () => {
      if (invokeFails) throw boom;
      return { txid: "0xmulti", success: true };
    }),
    listEvents: vi.fn(async () => []),
  };
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    guardResult: vi.fn(
      async (fn: () => Promise<unknown>, successKey?: string, errorKey?: string) => {
        try {
          const value = await fn();
          if (successKey) notify.success(successKey);
          return { ok: true as const, value };
        } catch (error) {
          notify.error(error, errorKey);
          return { ok: false as const, error };
        }
      },
    ),
  };
  const ctx = {
    services: { chain, notify },
    t,
    setStatus: vi.fn(),
  } as unknown as MiniAppFrameworkContext;
  return { app: createMiniAppFramework(ctx, { appId: "policy-app" }), chain, notify, boom };
}

beforeEach(() => {
  localStorage.clear();
});

describe("S2 notify policy on chain.write", () => {
  it("default ('all') keeps the exact legacy behavior: success toast + reload", async () => {
    const { app, notify } = makeFramework();
    const reload = vi.fn(async () => {});
    await app.chain.write({ operation: "claim", args: [], successKey: "claimSuccess", reload });
    expect(notify.success).toHaveBeenCalledWith("claimSuccess");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("'silent' suppresses every toast and bypasses the host guardResult", async () => {
    const { app, notify } = makeFramework();
    await expect(
      app.chain.write({ operation: "claim", args: [], successKey: "claimSuccess", notify: "silent" }),
    ).resolves.toMatchObject({ txid: "0xinvoke" });
    expect(notify.guardResult).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("'silent' still throws the raw error and still reloads on success", async () => {
    const failing = makeFramework({ invokeFails: true });
    const reload = vi.fn(async () => {});
    await expect(
      failing.app.chain.write({ operation: "claim", args: [], notify: "silent", reload }),
    ).rejects.toBe(failing.boom);
    expect(failing.notify.error).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    const ok = makeFramework();
    const reloadOk = vi.fn(async () => {});
    await ok.app.chain.write({ operation: "claim", args: [], notify: "silent", reload: reloadOk });
    expect(reloadOk).toHaveBeenCalledTimes(1);
  });

  it("'errors' suppresses the success toast but keeps the error toast", async () => {
    const ok = makeFramework();
    await ok.app.chain.write({
      operation: "claim",
      args: [],
      successKey: "claimSuccess",
      successParams: { id: 1 },
      notify: "errors",
    });
    expect(ok.notify.success).not.toHaveBeenCalled();

    const failing = makeFramework({ invokeFails: true });
    await expect(
      failing.app.chain.write({
        operation: "claim",
        args: [],
        successKey: "claimSuccess",
        errorKey: "claimFailed",
        notify: "errors",
      }),
    ).rejects.toBe(failing.boom);
    expect(failing.notify.error).toHaveBeenCalledWith(failing.boom, "claimFailed");
    expect(failing.notify.success).not.toHaveBeenCalled();
  });
});

describe("S2 notify policy on funds + invokeMultiple", () => {
  it("funds.payAndCall honors 'silent'", async () => {
    const { app, notify } = makeFramework();
    await app.funds.payAndCall({
      operation: "stake",
      args: [],
      amountGas: "1",
      memo: "stake",
      successKey: "staked",
      notify: "silent",
    });
    expect(notify.guardResult).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("funds.payAndCall 'errors' keeps only the error toast", async () => {
    const failing = makeFramework({ invokeFails: true });
    await expect(
      failing.app.funds.payAndCall({
        operation: "stake",
        args: [],
        amountGas: "1",
        memo: "stake",
        successKey: "staked",
        notify: "errors",
      }),
    ).rejects.toBe(failing.boom);
    expect(failing.notify.error).toHaveBeenCalledWith(failing.boom, undefined);
    expect(failing.notify.success).not.toHaveBeenCalled();
  });

  it("funds.prepayAndCall and funds.receiptPay honor 'silent'", async () => {
    const { app, notify } = makeFramework();
    await app.funds.prepayAndCall({
      operation: "bury",
      args: [],
      amountGas: "1",
      memo: "bury",
      successKey: "buried",
      notify: "silent",
    });
    await app.funds.receiptPay({
      operation: "deposit",
      args: [],
      receiptId: "3",
      successKey: "deposited",
      notify: "silent",
    });
    expect(notify.guardResult).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("chain.invokeMultiple 'silent' suppresses the error toast but rethrows", async () => {
    const failing = makeFramework({ invokeFails: true });
    await expect(
      failing.app.chain.invokeMultiple(
        [{ operation: "transfer", args: [] }],
        { notify: "silent" },
      ),
    ).rejects.toBe(failing.boom);
    expect(failing.notify.error).not.toHaveBeenCalled();

    const failingDefault = makeFramework({ invokeFails: true });
    await expect(
      failingDefault.app.chain.invokeMultiple([{ operation: "transfer", args: [] }]),
    ).rejects.toBe(failingDefault.boom);
    expect(failingDefault.notify.error).toHaveBeenCalledWith(failingDefault.boom, undefined);
  });
});
