/**
 * Neo Treasury — shell chrome bindings at first paint.
 *
 * The manifest's `stats` and `sidebar.items` bind by NAME straight out of the
 * app's state bag, and MiniAppRoot renders whatever those observables hand it
 * through a plain formatter with NO loading gate (see MiniAppRoot's
 * `sidebarItems`: `getFormatter(item.format)(obs.get())`). That makes every
 * manifest binding an ungated render path that bypasses whatever gating the
 * PlayArea does — and neo-treasury's PlayArea does gate: it paints
 * "Reading public chain data" while the watchlist sweep is in flight.
 *
 * Before this guard existed, the chrome bound the PlayArea's raw values and so
 * published, on a cold first paint:
 *
 *   Total USD  —      Total NEO  —      Total GAS  —      Founders  0
 *
 * Three voids and a fabricated zero asserting the watchlist tracks nobody.
 *
 * These tests run the app's REAL setup() and read the REAL manifest, so they
 * fail if a future binding is pointed back at an ungated value — the point is
 * to guard the binding contract, not the current strings.
 */
import { describe, expect, it, vi } from "vitest";

import type { Observable } from "../react/context";
import { manifest } from "../../neo-treasury/src/manifest";
import { messages } from "../../neo-treasury/src/locale/messages";
import type { TreasuryData } from "../../neo-treasury/src/utils/treasury";

const harness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => { state: Record<string, Observable<unknown>> };
  },
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("../react/defineMiniApp")>(
    "../react/defineMiniApp",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as typeof harness.definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

/** The app's real en copy, resolved exactly as ctx.t would resolve it. */
function t(key: string): string {
  const entry = (messages as Record<string, { en: string } | undefined>)[key];
  return entry?.en ?? key;
}

/**
 * Mirrors MiniAppRoot's own formatter table for the formats these bindings use.
 * The guard has to assert the string the visitor actually SEES, which is the
 * formatter's output, not the observable's raw value — `format: "number"` on an
 * unread value is exactly how `Founders 0` reached the tile.
 */
function formatAs(format: string | undefined, value: unknown): string {
  if (format === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value ?? "") : n.toLocaleString();
  }
  return String(value ?? "");
}

/**
 * Mirrors MiniAppRoot's FULL binding render path, which now has two steps.
 *
 * The shell grew a pending phase: a binding may declare `pendingKey`, and the
 * shell renders that copy — BEFORE reaching the formatter — whenever the bound
 * observable holds `undefined` (the unread state). See MiniAppRoot's
 * `sidebarItems`.
 *
 * This guard previously modelled the render path as the formatter alone, which
 * was the whole path at the time. That is why this app used to hand the chrome
 * four parallel display-only observables: with no pending phase in the shell,
 * an app could only speak honestly by pre-formatting the words itself. Those
 * four are now deleted and the phase is declared in the manifest instead, so
 * modelling the formatter alone would read `undefined` as "" and report a void
 * the visitor never sees.
 *
 * The guard's intent is UNCHANGED and its assertions below are untouched: the
 * chrome must publish honest words — never a void, never a fabricated count —
 * before the watchlist read lands. Only the model of how those words reach the
 * screen is updated to match the shell that now renders them.
 */
function renderBinding(
  binding: { format?: string; pendingKey?: string },
  value: unknown,
): string {
  if (value === undefined && binding.pendingKey) return t(binding.pendingKey);
  return formatAs(binding.format, value);
}

function buildState() {
  const storage = new Map<string, unknown>();
  const address: Observable<string | null> = {
    get: () => null,
    set: () => {},
    subscribe: () => () => {},
  };
  const ctx = {
    t,
    launchContext: { network: "mainnet" },
    framework: {
      chain: {
        address,
        readRaw: vi.fn(async () => ({ type: "Integer", value: "0" })),
        ensureWallet: vi.fn(async () => ""),
        detectNetwork: vi.fn(async () => "mainnet"),
        write: vi.fn(),
        waitForState: vi.fn(),
      },
      storage: {
        local: {
          get: <T,>(key: string) => storage.get(key) as T | undefined,
          set: (key: string, value: unknown) => void storage.set(key, value),
          delete: (key: string) => void storage.delete(key),
        },
      },
      actions: { register: vi.fn() },
    },
  };
  const result = harness.definition!.setup!(ctx as unknown as Record<string, unknown>);
  return result.state;
}

/**
 * Every valueKey the shell chrome renders, with the format it renders it at and
 * the pending phase it declares — the three inputs to MiniAppRoot's render path.
 */
function chromeBindings(): Array<{
  where: string;
  valueKey: string;
  format?: string;
  pendingKey?: string;
}> {
  return [
    ...(manifest.stats ?? []).map((stat) => ({
      where: "stats",
      valueKey: stat.valueKey,
      format: stat.format,
      pendingKey: stat.pendingKey,
    })),
    ...(manifest.sidebar?.items ?? []).map((item) => ({
      where: "sidebar",
      valueKey: item.valueKey,
      format: item.format,
      pendingKey: item.pendingKey,
    })),
  ];
}

describe("neo-treasury shell chrome bindings", () => {
  it("binds every stat and sidebar slot to a key the state bag actually publishes", async () => {
    await import("../../neo-treasury/src/main");
    const state = buildState();
    const bindings = chromeBindings();
    expect(bindings.length).toBeGreaterThan(0);
    for (const binding of bindings) {
      // An absent key renders as a blank tile, which is the same void wearing a
      // quieter costume — MiniAppRoot returns null and prints nothing.
      expect(state[binding.valueKey], `${binding.where}.${binding.valueKey}`).toBeDefined();
    }
  });

  it("publishes honest words, never a void or a fabricated count, before the watchlist read lands", async () => {
    await import("../../neo-treasury/src/main");
    const state = buildState();
    // No load has been triggered: `data` is null. This is the cold first paint
    // every visitor gets, and the state the chrome used to misreport.
    for (const binding of chromeBindings()) {
      const rendered = renderBinding(binding, state[binding.valueKey]!.get());
      const at = `${binding.where}.${binding.valueKey}`;

      expect(rendered, at).not.toBe("");
      expect(rendered, at).not.toContain("—");
      expect(rendered, at).not.toBe(t("notAvailable"));
      // The specific regression: `founderCount` reported 0 founders while the
      // read was still in flight. A count is a claim; absence is not zero.
      expect(rendered, at).not.toMatch(/^0$/);
      // Honest copy is words, not a bare number pretending to be a reading.
      expect(rendered, at).toBe(t("treasuryStatAwaitingRead"));
    }
  });

  it("hands the chrome real readings once the watchlist read settles", async () => {
    await import("../../neo-treasury/src/main");
    const state = buildState();
    const data = state.data as Observable<TreasuryData | null>;
    data.set({
      totalUsd: 1234.56,
      totalNeo: 10,
      totalGas: 20,
      totalNeoDisplay: "10",
      totalGasDisplay: "20",
      categories: [{ name: "Da Hongfei" }, { name: "Erik Zhang" }],
    } as unknown as TreasuryData);

    // Byte-for-byte the formatting the PlayArea's hero already used
    // (maximumFractionDigits: 2, no minimum) — the chrome read-out and the hero
    // now read the SAME observable, so they cannot drift apart or re-round.
    expect(state.totalUsdDisplay!.get()).toBe("$1,234.56");
    expect(state.totalNeoDisplay!.get()).toBe("10");
    expect(state.totalGasDisplay!.get()).toBe("20");
    expect(state.founderCount!.get()).toBe(2);
    // A settled count of zero is a real reading and must survive: the guard
    // above rejects `0` only while the read is unsettled. The pending phase
    // keys off `undefined` (unread), never off falsiness — so a settled zero
    // must render as "0" through the real path, not as the pending copy.
    data.set({
      totalUsd: 0,
      totalNeoDisplay: "0",
      totalGasDisplay: "0",
      categories: [],
    } as unknown as TreasuryData);
    expect(state.founderCount!.get()).toBe(0);
    const foundersBinding = chromeBindings().find((b) => b.valueKey === "founderCount")!;
    expect(renderBinding(foundersBinding, state.founderCount!.get())).toBe("0");
  });

  it("separates a settled price-feed failure from an unsettled read", async () => {
    await import("../../neo-treasury/src/main");
    const state = buildState();
    const data = state.data as Observable<TreasuryData | null>;
    // Balances read fine; only the independent USD quote came back empty. That
    // is a fact about the valuation — it must not borrow the "still reading"
    // copy, and must not fall back to a $0 that claims the treasury is empty.
    data.set({
      totalUsd: null,
      totalNeoDisplay: "10",
      totalGasDisplay: "20",
      categories: [{ name: "Da Hongfei" }],
    } as unknown as TreasuryData);

    expect(state.totalUsdDisplay!.get()).toBe(t("treasuryPriceUnavailableShort"));
    expect(state.totalUsdDisplay!.get()).not.toContain("$");
    expect(state.totalUsdDisplay!.get()).not.toBe(t("treasuryStatAwaitingRead"));
    // A settled price-feed failure is a real value, not the unread state — so
    // it must not be `undefined`, which would borrow the pending copy.
    expect(state.totalUsdDisplay!.get()).toBeDefined();
    // The balances beside it are real and keep rendering.
    expect(state.totalNeoDisplay!.get()).toBe("10");
  });
});
