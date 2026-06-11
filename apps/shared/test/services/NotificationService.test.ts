import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@shared/services/EventBus";
import { NotificationService, NOTIFICATION_EVENT } from "@shared/services/NotificationService";
import type { Notification } from "@shared/services/NotificationService";

describe("NotificationService", () => {
  let bus: EventBus;
  let notify: NotificationService;
  let t: ReturnType<typeof vi.fn>;
  let emitted: Notification[];

  beforeEach(() => {
    bus = new EventBus();
    t = vi.fn((key: string) => `translated:${key}`);
    notify = new NotificationService(bus, t);
    emitted = [];

    bus.on(NOTIFICATION_EVENT, (payload) => {
      emitted.push(payload as Notification);
    });
  });

  afterEach(() => {
    bus.destroy();
  });

  it("should emit toast events via EventBus on success()", () => {
    notify.success("stakeComplete");

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "translated:stakeComplete",
      type: "success",
    });
    expect(t).toHaveBeenCalledWith("stakeComplete", undefined);
  });

  it("should emit error notification from Error object", () => {
    notify.error(new Error("Transaction reverted"));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "Transaction reverted",
      type: "error",
    });
  });

  it("should emit error notification from string", () => {
    notify.error("Something went wrong");

    expect(emitted).toHaveLength(1);
    expect(emitted[0].message).toBe("Something went wrong");
    expect(emitted[0].type).toBe("error");
  });

  it("should emit error notification with fallback key for unknown types", () => {
    notify.error(42, "unknownError");

    expect(emitted).toHaveLength(1);
    expect(emitted[0].message).toBe("translated:unknownError");
    expect(t).toHaveBeenCalledWith("unknownError");
  });

  it("should emit warning notification", () => {
    notify.warn("lowBalance");

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "translated:lowBalance",
      type: "warning",
    });
  });

  it("should emit info notification", () => {
    notify.info("syncInProgress");

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      message: "translated:syncInProgress",
      type: "info",
    });
  });

  it("should pass params to the translation function", () => {
    notify.success("transferred", { amount: 10, asset: "GAS" });

    expect(t).toHaveBeenCalledWith("transferred", { amount: 10, asset: "GAS" });
  });

  describe("guard()", () => {
    it("should call function and show success on resolve", async () => {
      const fn = vi.fn().mockResolvedValue("result-data");

      const result = await notify.guard(fn, "operationSuccess");

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe("result-data");
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        message: "translated:operationSuccess",
        type: "success",
      });
    });

    it("should not emit success when no successKey provided", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const result = await notify.guard(fn);

      expect(result).toBe("ok");
      expect(emitted).toHaveLength(0);
    });

    it("should show error on reject and return undefined", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Network timeout"));

      const result = await notify.guard(fn, "success", "fallbackErr");

      expect(result).toBeUndefined();
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        message: "Network timeout",
        type: "error",
      });
    });

    it("should use fallback error key when rejection is not an Error", async () => {
      const fn = vi.fn().mockRejectedValue("string-error");

      await notify.guard(fn, "success", "networkError");

      expect(emitted).toHaveLength(1);
      expect(emitted[0].message).toBe("string-error");
      expect(emitted[0].type).toBe("error");
    });

    it("should return the resolved value from the wrapped function", async () => {
      const fn = vi.fn().mockResolvedValue({ txid: "0xabc" });

      const result = await notify.guard(fn, "txSent");

      expect(result).toEqual({ txid: "0xabc" });
    });
  });

  describe("guardResult()", () => {
    it("should return {ok: true, value} and emit success on resolve", async () => {
      const fn = vi.fn().mockResolvedValue("result-data");

      const result = await notify.guardResult(fn, "operationSuccess");

      expect(result).toEqual({ ok: true, value: "result-data" });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        message: "translated:operationSuccess",
        type: "success",
      });
    });

    it("should return {ok: false, error} and emit error toast on reject without throwing", async () => {
      const failure = new Error("Network timeout");
      const fn = vi.fn().mockRejectedValue(failure);

      const result = await notify.guardResult(fn, "success", "fallbackErr");

      expect(result).toEqual({ ok: false, error: failure });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        message: "Network timeout",
        type: "error",
      });
    });

    it("should let callers distinguish a void success from a swallowed failure", async () => {
      // guard()'s legacy contract cannot tell these two apart — both yield
      // undefined. guardResult's discriminator is what PlayAreas gate
      // post-success steps (form resets, modal closes) on.
      const voidSuccess = await notify.guardResult(async () => undefined);
      const swallowedFailure = await notify.guardResult(async () => {
        throw new Error("boom");
      });

      expect(voidSuccess.ok).toBe(true);
      expect(swallowedFailure.ok).toBe(false);
    });
  });
});
