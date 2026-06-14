import { describe, expect, it, vi } from "vitest";

import { runSingleFlight } from "@shared/react/context";

describe("runSingleFlight dispatch guard (C13)", () => {
  it("drops a concurrent same-key call instead of running the work twice", async () => {
    const inFlight = new Set<string>();
    const work = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)),
    );

    const first = runSingleFlight(inFlight, "buy", work);
    // Second call arrives while the first is still in flight.
    const second = runSingleFlight(inFlight, "buy", work);

    expect(await second).toBeUndefined();
    expect(await first).toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("allows the key again once the first run settles", async () => {
    const inFlight = new Set<string>();
    const work = vi.fn(async () => "ok");

    await runSingleFlight(inFlight, "claim", work);
    await runSingleFlight(inFlight, "claim", work);

    expect(work).toHaveBeenCalledTimes(2);
    expect(inFlight.size).toBe(0);
  });

  it("does not block different keys from running concurrently", async () => {
    const inFlight = new Set<string>();
    const order: string[] = [];
    const slow = (label: string, ms: number) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          order.push(label);
          resolve();
        }, ms),
      );

    await Promise.all([
      runSingleFlight(inFlight, "a", () => slow("a", 5)),
      runSingleFlight(inFlight, "b", () => slow("b", 1)),
    ]);

    expect(order).toContain("a");
    expect(order).toContain("b");
  });

  it("releases the key even when the work throws, then rethrows", async () => {
    const inFlight = new Set<string>();
    const boom = vi.fn(async () => {
      throw new Error("FAULT");
    });

    await expect(runSingleFlight(inFlight, "settle", boom)).rejects.toThrow(
      "FAULT",
    );
    expect(inFlight.size).toBe(0);

    // A retry after the failure is allowed (not wedged).
    await expect(runSingleFlight(inFlight, "settle", boom)).rejects.toThrow(
      "FAULT",
    );
    expect(boom).toHaveBeenCalledTimes(2);
  });
});
