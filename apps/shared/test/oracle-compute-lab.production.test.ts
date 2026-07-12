import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  buildLocalComputeRequest,
  type LocalComputeRequestPackage,
} from "../../oracle-compute-lab/src/compute-workbench";

type Action = (...args: unknown[]) => Promise<unknown>;
type SetupResult = {
  state: Record<string, { get: () => unknown }>;
  loadData: () => Promise<void>;
};

const setupHarness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => SetupResult;
  },
}));

const workbenchHarness = vi.hoisted(() => ({
  build: null as null | ((...args: unknown[]) => Promise<LocalComputeRequestPackage>),
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<
    typeof import("../react/defineMiniApp")
  >("@shared/react/defineMiniApp");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: typeof setupHarness.definition) => {
      setupHarness.definition = definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("../../oracle-compute-lab/src/compute-workbench", async () => {
  const actual = await vi.importActual<
    typeof import("../../oracle-compute-lab/src/compute-workbench")
  >("../../oracle-compute-lab/src/compute-workbench");
  return {
    ...actual,
    buildLocalComputeRequest: vi.fn(async (...args: Parameters<typeof actual.buildLocalComputeRequest>) => {
      if (workbenchHarness.build) return workbenchHarness.build(...args);
      return actual.buildLocalComputeRequest(...args);
    }),
  };
});

function setupMainApp() {
  const actions = new Map<string, Action>();
  const copy = vi.fn(async () => true);
  const setStatus = vi.fn();
  const result = setupHarness.definition?.setup?.({
    framework: {
      actions: {
        register: (name: string, action: Action) => actions.set(name, action),
      },
    },
    services: { clipboard: { copy } },
    setStatus,
    t: (key: string) => key,
  } as never);
  expect(result).toBeTruthy();
  return { actions, copy, result: result!, setStatus };
}

afterEach(() => {
  workbenchHarness.build = null;
});

beforeAll(async () => {
  await import("../../oracle-compute-lab/src/main");
}, 30_000);

describe("Oracle Compute Lab production state", () => {
  it("exposes one internally consistent mainnet registry target", () => {
    const app = setupMainApp();

    expect(app.result.state.networkLabel.get()).toBe("Neo N3 Mainnet");
    expect(app.result.state.workflow.get()).toBe("compute.execute");
    expect(app.result.state.route.get()).toBe("/compute/execute");
    expect(app.result.state.runtimeBaseUrl.get()).toBe("https://oracle.meshmini.app/mainnet");
    expect(app.result.state.policiesLabel.get()).toBe("tenant · risk");
    expect(app.result.state.teeRequired.get()).toBe(true);
    expect(app.result.state.deliveryMode.get()).toBe("api_response");
  });

  it("prepares and copies the exact target-bound local package", async () => {
    const app = setupMainApp();
    await app.actions.get("prepareRequest")?.({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"asset":"GAS"}',
    });

    const serialized = app.result.state.requestPackage.get() as string;
    const prepared = JSON.parse(serialized) as LocalComputeRequestPackage;
    expect(prepared.routeSnapshot.network).toBe("mainnet");
    expect(prepared.requestDigestScope).toBe("oracle-compute-lab/payload+route-snapshot-v1");
    expect(app.result.state.packageState.get()).toBe("ready");
    expect(app.result.state.requestCount.get()).toBe(1);
    expect(app.result.state.isPreparing.get()).toBe(false);

    await app.actions.get("copyRequestPackage")?.();
    expect(app.copy).toHaveBeenCalledWith(serialized, "packageCopied");
  });

  it("turns malformed input into a recoverable invalid state without a fake package", async () => {
    const app = setupMainApp();

    await expect(app.actions.get("prepareRequest")?.({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: "{not json",
    })).rejects.toThrow("sourceInvalidJson");

    expect(app.result.state.packageState.get()).toBe("invalid");
    expect(app.result.state.requestPackage.get()).toBe("");
    expect(app.result.state.requestCount.get()).toBe(0);
    expect(app.result.state.lastStatus.get()).toBe("statusInvalid");
    expect(app.setStatus).toHaveBeenLastCalledWith("sourceInvalidJson", "error");
  });

  it("discards a hashing result that arrives after the user invalidates the draft", async () => {
    const prepared = await buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"round":1}',
    }, "mainnet");
    let release!: (value: LocalComputeRequestPackage) => void;
    workbenchHarness.build = () => new Promise((resolve) => { release = resolve; });
    const app = setupMainApp();

    const pending = app.actions.get("prepareRequest")?.({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"round":1}',
    });
    expect(app.result.state.isPreparing.get()).toBe(true);
    await app.actions.get("invalidateRequest")?.();
    release(prepared);
    await pending;

    expect(app.result.state.packageState.get()).toBe("draft");
    expect(app.result.state.requestPackage.get()).toBe("");
    expect(app.result.state.requestCount.get()).toBe(0);
    expect(app.result.state.isPreparing.get()).toBe(false);
  });

  it("keeps the newest package when overlapping work resolves out of order", async () => {
    const firstPackage = await buildLocalComputeRequest({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"round":1}',
    }, "mainnet");
    const secondPackage = await buildLocalComputeRequest({
      profile: "proof-review",
      disclosure: "digest-only",
      source: '{"round":2}',
    }, "mainnet");
    const releases: Array<(value: LocalComputeRequestPackage) => void> = [];
    workbenchHarness.build = () => new Promise((resolve) => { releases.push(resolve); });
    const app = setupMainApp();

    const first = app.actions.get("prepareRequest")?.({
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"round":1}',
    });
    const second = app.actions.get("prepareRequest")?.({
      profile: "proof-review",
      disclosure: "digest-only",
      source: '{"round":2}',
    });
    expect(releases).toHaveLength(2);

    releases[1]?.(secondPackage);
    await second;
    releases[0]?.(firstPackage);
    await first;

    expect(app.result.state.requestDigest.get()).toBe(secondPackage.requestDigest);
    expect(app.result.state.inputDigest.get()).toBe(secondPackage.payload.inputDigest);
    expect(app.result.state.requestCount.get()).toBe(1);
    expect(app.result.state.packageState.get()).toBe("ready");
  });
});
