import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformServices } from "@shared/services/PlatformServices";
import { CacheService } from "@shared/services/CacheService";
import { EventBus } from "@shared/services/EventBus";
import { NotificationService } from "@shared/services/NotificationService";
import { ClipboardService } from "@shared/services/ClipboardService";
import { FormattingService } from "@shared/services/FormattingService";

describe("PlatformServices", () => {
  let services: PlatformServices;

  beforeEach(() => {
    services = PlatformServices.create("miniapp-test");
  });

  afterEach(() => {
    services.destroy();
  });

  it("should create all services from appId", () => {
    expect(services.appId).toBe("miniapp-test");
    expect(services.cache).toBeInstanceOf(CacheService);
    expect(services.events).toBeInstanceOf(EventBus);
    expect(services.notify).toBeInstanceOf(NotificationService);
    expect(services.clipboard).toBeInstanceOf(ClipboardService);
    expect(services.fmt).toBeInstanceOf(FormattingService);
  });

  it("should throw on empty appId", () => {
    expect(() => PlatformServices.create("")).toThrow(
      "PlatformServices.create requires a non-empty appId",
    );
  });

  it("should throw on non-string appId", () => {
    expect(() => PlatformServices.create(null as unknown as string)).toThrow(
      "PlatformServices.create requires a non-empty appId",
    );
    expect(() => PlatformServices.create(undefined as unknown as string)).toThrow(
      "PlatformServices.create requires a non-empty appId",
    );
  });

  it("should expose os property with all proxies", () => {
    expect(services.os).toBeDefined();
    expect(services.os.storage).toBeDefined();
    expect(services.os.payment).toBeDefined();
    expect(services.os.game).toBeDefined();
    expect(services.os.vesting).toBeDefined();
    expect(services.os.escrow).toBeDefined();
    expect(services.os.badge).toBeDefined();
    expect(services.os.leaderboard).toBeDefined();
    expect(services.os.checkin).toBeDefined();
    expect(services.os.nft).toBeDefined();
    expect(services.os.script).toBeDefined();
  });

  it("should destroy all services on destroy()", () => {
    // Verify services are active
    services.cache.set("key", "value");
    expect(services.cache.get("key")).toBe("value");

    const handler = vi.fn();
    services.events.on("test", handler);

    services.destroy();

    // Cache should be cleared
    expect(services.cache.get("key")).toBeNull();
    expect(services.cache.size).toBe(0);

    // EventBus should be cleared (emitting should not fire old handlers)
    services.events.emit("test");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should use default identity translation function when none provided", () => {
    const svc = PlatformServices.create("miniapp-no-t");

    // The default t function returns the key itself, which means
    // calling notify.success("testKey") should emit "testKey" as the message
    const emitted: unknown[] = [];
    svc.events.on("platform:notification", (payload) => emitted.push(payload));

    svc.notify.success("testKey");

    expect(emitted).toHaveLength(1);
    expect((emitted[0] as { message: string }).message).toBe("testKey");

    svc.destroy();
  });

  it("should use provided translation function", () => {
    const t = vi.fn((key: string) => `i18n:${key}`);
    const svc = PlatformServices.create("miniapp-with-t", { t });

    const emitted: unknown[] = [];
    svc.events.on("platform:notification", (payload) => emitted.push(payload));

    svc.notify.success("stakeComplete");

    expect(t).toHaveBeenCalledWith("stakeComplete", undefined);
    expect((emitted[0] as { message: string }).message).toBe("i18n:stakeComplete");

    svc.destroy();
  });

  it("should expose chain, balance, transfer, oracle, aa, and lifecycle services", () => {
    expect(services.chain).toBeDefined();
    expect(services.balance).toBeDefined();
    expect(services.transfer).toBeDefined();
    expect(services.oracle).toBeDefined();
    expect(services.aa).toBeDefined();
    expect(services.lifecycle).toBeDefined();
  });

  it("should create independent instances per call", () => {
    const svc1 = PlatformServices.create("app-1");
    const svc2 = PlatformServices.create("app-2");

    expect(svc1.appId).toBe("app-1");
    expect(svc2.appId).toBe("app-2");
    expect(svc1.events).not.toBe(svc2.events);
    expect(svc1.cache).not.toBe(svc2.cache);

    svc1.destroy();
    svc2.destroy();
  });
});
