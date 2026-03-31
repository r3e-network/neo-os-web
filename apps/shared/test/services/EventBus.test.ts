import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@shared/services/EventBus";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.destroy();
  });

  it("should emit and receive events", () => {
    const handler = vi.fn();
    bus.on("test:event", handler);

    bus.emit("test:event", { value: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it("should support multiple listeners on the same event", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on("multi", handler1);
    bus.on("multi", handler2);
    bus.on("multi", handler3);

    bus.emit("multi", "payload");

    expect(handler1).toHaveBeenCalledWith("payload");
    expect(handler2).toHaveBeenCalledWith("payload");
    expect(handler3).toHaveBeenCalledWith("payload");
  });

  it("should remove listener with off()", () => {
    const handler = vi.fn();
    bus.on("removable", handler);

    bus.emit("removable");
    expect(handler).toHaveBeenCalledTimes(1);

    bus.off("removable", handler);

    bus.emit("removable");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should remove listener via unsubscribe function returned by on()", () => {
    const handler = vi.fn();
    const unsub = bus.on("unsub-test", handler);

    bus.emit("unsub-test");
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();

    bus.emit("unsub-test");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should not fire removed listeners", () => {
    const kept = vi.fn();
    const removed = vi.fn();

    bus.on("selective", kept);
    bus.on("selective", removed);

    bus.off("selective", removed);

    bus.emit("selective", "data");

    expect(kept).toHaveBeenCalledWith("data");
    expect(removed).not.toHaveBeenCalled();
  });

  it("should clear all listeners on destroy()", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on("event-a", handler1);
    bus.on("event-b", handler2);

    bus.destroy();

    bus.emit("event-a");
    bus.emit("event-b");

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it("should remove all handlers for an event when off() is called without handler", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("bulk-remove", h1);
    bus.on("bulk-remove", h2);

    bus.off("bulk-remove");

    bus.emit("bulk-remove");

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("should not throw when emitting events with no listeners", () => {
    expect(() => bus.emit("no-listeners", { data: true })).not.toThrow();
  });

  it("should isolate events by name", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    bus.on("event-a", handlerA);
    bus.on("event-b", handlerB);

    bus.emit("event-a", "a-payload");

    expect(handlerA).toHaveBeenCalledWith("a-payload");
    expect(handlerB).not.toHaveBeenCalled();
  });

  it("should support once() for single-fire listeners", () => {
    const handler = vi.fn();
    bus.once("one-shot", handler);

    bus.emit("one-shot", "first");
    bus.emit("one-shot", "second");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("first");
  });

  it("should allow once() unsubscribe before firing", () => {
    const handler = vi.fn();
    const unsub = bus.once("early-unsub", handler);

    unsub();

    bus.emit("early-unsub");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle handler errors without affecting other handlers", () => {
    const errorHandler = vi.fn(() => {
      throw new Error("handler failed");
    });
    const goodHandler = vi.fn();

    bus.on("error-test", errorHandler);
    bus.on("error-test", goodHandler);

    bus.emit("error-test", "payload");

    expect(errorHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalledWith("payload");
  });

  it("should expose well-known platform event constants", () => {
    expect(EventBus.WALLET_CONNECTED).toBe("platform:wallet:connected");
    expect(EventBus.TRANSACTION_SENT).toBe("platform:tx:sent");
    expect(EventBus.TRANSACTION_CONFIRMED).toBe("platform:tx:confirmed");
    expect(EventBus.BALANCE_CHANGED).toBe("platform:balance:changed");
    expect(EventBus.APP_MOUNTED).toBe("platform:app:mounted");
    expect(EventBus.APP_UNMOUNTED).toBe("platform:app:unmounted");
    expect(EventBus.ERROR).toBe("platform:error");
  });
});
