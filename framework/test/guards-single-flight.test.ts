/**
 * RFC P0-2 — write-lane guard middleware + the canonical singleFlight.
 *
 * Locks: guardedWrite's guest→permission→run ordering (true by construction),
 * the named exemption policies, singleFlight join/drop semantics, the
 * actions.run drop/unknown-key dev warnings (behavior unchanged), and the
 * "aa" DEFAULT-ALLOW permission introduced for the app.aa write lanes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardedWrite } from "../internal/guards";
import { createMiniAppFramework } from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createPermissionsSurface } from "../permissions";
import { createObservable } from "../reactive";
import { singleFlight } from "../utils/async-utils";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function makeApp(
  appId = "guards-test",
  launch: Record<string, unknown> = {},
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xinvoke", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    listEvents: vi.fn(async () => []),
  };
  const aa = {
    checkSponsorship: vi.fn(async () => ({ eligible: true })),
    requestSponsorship: vi.fn(async () => ({ approved: true })),
    submitRelay: vi.fn(async () => ({ txid: "0xrelay" })),
    createSessionKey: vi.fn(async () => ({ created: true })),
  };
  const ctx = {
    services: { chain, aa },
    t: (key: string) => key,
    launchContext: { appId, ...launch },
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, { appId, ...options });
  return { app, chain, aa };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guardedWrite", () => {
  it("composes guest guard → permission gate → run, in that order", async () => {
    const order: string[] = [];
    const lane = guardedWrite(
      {
        assertNotGuest: () => order.push("guest"),
        requirePermission: (name) => order.push(`permission:${name}`),
      },
      { permission: "invoke:primary" },
      async (value: number) => {
        order.push("run");
        return value * 2;
      },
    );
    await expect(lane(21)).resolves.toBe(42);
    expect(order).toEqual(["guest", "permission:invoke:primary", "run"]);
  });

  it("a guest denial REJECTS before the permission gate and the body", async () => {
    const requirePermission = vi.fn();
    const run = vi.fn(async () => "never");
    const lane = guardedWrite(
      {
        assertNotGuest: () => {
          throw new Error("guest-mode: blocked");
        },
        requirePermission,
      },
      { permission: "invoke:primary" },
      run,
    );
    await expect(lane()).rejects.toThrow(/guest-mode/);
    expect(requirePermission).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("named exemptions: permission null skips the gate; guestGuard false skips the guard", async () => {
    const assertNotGuest = vi.fn();
    const requirePermission = vi.fn();
    const deps = { assertNotGuest, requirePermission };

    await guardedWrite(deps, { permission: null }, async () => "ok")();
    expect(assertNotGuest).toHaveBeenCalledTimes(1);
    expect(requirePermission).not.toHaveBeenCalled();

    await guardedWrite(deps, { permission: "x", guestGuard: false }, async () => "ok")();
    expect(assertNotGuest).toHaveBeenCalledTimes(1); // unchanged
    expect(requirePermission).toHaveBeenCalledWith("x");
  });
});

describe("singleFlight", () => {
  it("join: concurrent same-key calls share ONE run and its result", async () => {
    let releases: Array<() => void> = [];
    const fn = vi.fn(
      (key: string) =>
        new Promise<string>((resolve) => {
          releases.push(() => resolve(`ran:${key}`));
        }),
    );
    const flight = singleFlight((key: string) => key, fn, { mode: "join" });
    const [first, second] = [flight("a"), flight("a")];
    const other = flight("b"); // different key runs concurrently
    expect(fn).toHaveBeenCalledTimes(2);
    releases.forEach((release) => release());
    await expect(first).resolves.toBe("ran:a");
    await expect(second).resolves.toBe("ran:a");
    await expect(other).resolves.toBe("ran:b");
    // Key released after settle — a new call runs again.
    releases = [];
    const third = flight("a");
    expect(fn).toHaveBeenCalledTimes(3);
    releases.forEach((release) => release());
    await third;
  });

  it("drop: re-entry resolves undefined, reports onDrop, and releases on rejection too", async () => {
    const onDrop = vi.fn();
    let reject!: (error: Error) => void;
    const fn = vi.fn(
      () =>
        new Promise<string>((_, rej) => {
          reject = rej;
        }),
    );
    const flight = singleFlight(() => "key", fn, { mode: "drop", onDrop });
    const first = flight();
    await expect(flight()).resolves.toBeUndefined();
    expect(onDrop).toHaveBeenCalledWith("key");
    expect(fn).toHaveBeenCalledTimes(1);
    reject(new Error("boom"));
    await expect(first).rejects.toThrow("boom");
    // Released after the rejection — next call runs.
    const second = flight();
    expect(fn).toHaveBeenCalledTimes(2);
    reject(new Error("boom2"));
    await expect(second).rejects.toThrow("boom2");
  });
});

describe("actions.run drop-mode warnings (behavior unchanged)", () => {
  it("still returns undefined on re-entry and unknown keys, now with a dev warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { app } = makeApp("actions-flight-test");
    let release!: () => void;
    app.actions.register("slow", () => new Promise<string>((resolve) => {
      release = () => resolve("done");
    }));

    const first = app.actions.run("slow");
    await expect(app.actions.run("slow")).resolves.toBeUndefined(); // dropped
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('actions.run("slow") dropped'));

    await expect(app.actions.run("no-such-action")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('actions.run("no-such-action")'),
    );

    release();
    await expect(first).resolves.toBe("done");
    // Released — the action runs again.
    const again = app.actions.run("slow");
    release();
    await expect(again).resolves.toBe("done");
  });
});

describe('"aa" default-allow permission (S11 gate for app.aa writes)', () => {
  it("keeps aa writes working under declarations that predate the permission", async () => {
    // A pinned list declaration without "aa" — the historical case.
    const { app, aa } = makeApp("aa-default-allow", {
      permissions: ["invoke:primary"],
    });
    await expect(app.aa.relay({ rawTransaction: "00" })).resolves.toMatchObject({
      txid: "0xrelay",
    });
    await expect(app.aa.sponsorship.request("0.5")).resolves.toMatchObject({ approved: true });
    await expect(app.aa.sessionKey.create({}, 1)).resolves.toEqual({ created: true });
    expect(aa.submitRelay).toHaveBeenCalledTimes(1);
    expect(app.permissions.has("aa")).toBe(true);
  });

  it("lets a manifest opt out explicitly with { aa: false }", async () => {
    const { app, aa } = makeApp("aa-denied", {
      permissions: { "invoke:primary": true, aa: false },
    });
    await expect(app.aa.relay({ rawTransaction: "00" })).rejects.toThrow(
      /Missing required permission: aa/,
    );
    await expect(app.aa.sponsorship.request("0.5")).rejects.toThrow(/aa/);
    await expect(app.aa.sessionKey.create({}, 1)).rejects.toThrow(/aa/);
    expect(aa.submitRelay).not.toHaveBeenCalled();
    expect(app.permissions.has("aa")).toBe(false);
    // aa reads stay ungated.
    await expect(app.aa.sponsorship.check()).resolves.toMatchObject({ eligible: true });
  });

  it("guest guard still fires FIRST on aa writes (ordering preserved)", async () => {
    const { app, aa } = makeApp("aa-guest-order", { permissions: { aa: false } });
    app.mode.set("guest");
    // Guest guard beats the (denied) permission gate — same error as before P0-2.
    await expect(app.aa.relay({ rawTransaction: "00" })).rejects.toThrow(/guest-mode/);
    expect(aa.submitRelay).not.toHaveBeenCalled();
  });

  it("createPermissionsSurface: defaultAllow is opt-in and list()/deny semantics are unchanged", () => {
    const plain = createPermissionsSurface({ permissions: ["x"] });
    expect(plain.has("aa")).toBe(false); // no defaultAllow → verbatim enforcement
    expect(plain.list()).toEqual(["x"]);

    const withDefault = createPermissionsSurface({
      permissions: { x: true, aa: false },
      defaultAllow: ["aa"],
    });
    expect(withDefault.has("x")).toBe(true);
    expect(withDefault.has("aa")).toBe(false); // explicit denial wins
    expect(withDefault.list()).toEqual(["x"]); // denials never appear as grants

    const undeclared = createPermissionsSurface({ defaultAllow: ["aa"] });
    expect(undeclared.has("anything")).toBe(true); // no declaration → unrestricted
  });
});
