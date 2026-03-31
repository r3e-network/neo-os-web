import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "@shared/services/CacheService";

describe("CacheService", () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService("test-app");
    vi.useFakeTimers();
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it("should store and retrieve values", () => {
    cache.set("key1", "value1");
    cache.set("key2", { nested: true });

    expect(cache.get<string>("key1")).toBe("value1");
    expect(cache.get<{ nested: boolean }>("key2")).toEqual({ nested: true });
  });

  it("should return null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should respect TTL expiry", () => {
    cache.set("short-lived", "data", 1000);

    expect(cache.get("short-lived")).toBe("data");

    vi.advanceTimersByTime(1001);

    expect(cache.get("short-lived")).toBeNull();
  });

  it("should keep entries alive within TTL", () => {
    cache.set("alive", "data", 5000);

    vi.advanceTimersByTime(3000);

    expect(cache.get("alive")).toBe("data");
  });

  it("should use default TTL of 30 seconds", () => {
    cache.set("default-ttl", "data");

    vi.advanceTimersByTime(29_999);
    expect(cache.get("default-ttl")).toBe("data");

    vi.advanceTimersByTime(2);
    expect(cache.get("default-ttl")).toBeNull();
  });

  it("should clear all entries on destroy()", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.size).toBe(3);

    cache.destroy();

    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  it("should namespace keys by appId", () => {
    const cacheA = new CacheService("app-a");
    const cacheB = new CacheService("app-b");

    cacheA.set("shared-key", "from-a");
    cacheB.set("shared-key", "from-b");

    expect(cacheA.get("shared-key")).toBe("from-a");
    expect(cacheB.get("shared-key")).toBe("from-b");

    cacheA.destroy();
    cacheB.destroy();
  });

  it("should report correct size", () => {
    expect(cache.size).toBe(0);

    cache.set("one", 1);
    expect(cache.size).toBe(1);

    cache.set("two", 2);
    expect(cache.size).toBe(2);
  });

  it("should invalidate a single key", () => {
    cache.set("keep", "yes");
    cache.set("remove", "no");

    cache.invalidate("remove");

    expect(cache.get("keep")).toBe("yes");
    expect(cache.get("remove")).toBeNull();
  });

  it("should invalidate all entries for the app", () => {
    cache.set("x", 1);
    cache.set("y", 2);

    cache.invalidateAll();

    expect(cache.get("x")).toBeNull();
    expect(cache.get("y")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("should overwrite existing keys", () => {
    cache.set("key", "original");
    cache.set("key", "updated");

    expect(cache.get("key")).toBe("updated");
  });

  describe("localStorage persistence", () => {
    it("should persist and restore values", () => {
      cache.persist("prefs", { theme: "dark" });

      const restored = cache.restore<{ theme: string }>("prefs");
      expect(restored).toEqual({ theme: "dark" });
    });

    it("should return null for missing persisted keys", () => {
      expect(cache.restore("missing")).toBeNull();
    });

    it("should remove persisted values on invalidate()", () => {
      cache.persist("temp", "data");
      expect(cache.restore("temp")).toBe("data");

      cache.invalidate("temp");

      expect(cache.restore("temp")).toBeNull();
    });
  });
});
