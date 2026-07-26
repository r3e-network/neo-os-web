import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  buildVrfRequestDraft,
  getVrfEnvironment,
  type VrfServiceSnapshot,
  type VrfVerificationResult,
} from "../../oracle-vrf-console/src/vrf-workbench";

type Action = (...args: unknown[]) => Promise<unknown>;
type SetupResult = {
  state: Record<string, { get: () => unknown }>;
  loadData: () => Promise<void>;
  cleanup: () => void;
};

const setupHarness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => SetupResult;
  },
}));

const workbenchHarness = vi.hoisted(() => ({
  probe: null as null | (() => Promise<unknown>),
  verify: null as null | (() => Promise<unknown>),
}));

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("../react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: typeof setupHarness.definition) => {
      setupHarness.definition = definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("../../oracle-vrf-console/src/vrf-workbench", async () => {
  const actual = await vi.importActual<
    typeof import("../../oracle-vrf-console/src/vrf-workbench")
  >("../../oracle-vrf-console/src/vrf-workbench");
  return {
    ...actual,
    probeVrfService: vi.fn(async (...args: Parameters<typeof actual.probeVrfService>) => {
      if (workbenchHarness.probe) return workbenchHarness.probe();
      return actual.probeVrfService(...args);
    }),
    verifyVrfResponse: vi.fn(async (...args: Parameters<typeof actual.verifyVrfResponse>) => {
      if (workbenchHarness.verify) return workbenchHarness.verify();
      return actual.verifyVrfResponse(...args);
    }),
  };
});

interface StorageControl {
  setNoop: boolean;
  deleteNoop: boolean;
  getThrows: boolean;
}

function serviceSnapshot(): VrfServiceSnapshot {
  const environment = getVrfEnvironment("mainnet");
  return {
    network: "mainnet",
    freshness: "live",
    availability: "protected",
    checkedAt: "2026-07-12T00:00:00.000Z",
    apiBaseUrl: environment.apiBaseUrl,
    requestEndpoint: environment.requestEndpoint,
    rpcUrl: environment.rpcUrl,
    reportedNetwork: "mainnet",
    healthReady: true,
    runtimeOperational: true,
    workflowAdvertised: false,
    dispatchMode: "authenticated-consumer-integration",
    apiVerifierKey: `03${"11".repeat(32)}`,
    healthVerifierKey: `03${"11".repeat(32)}`,
    contractVerifierKey: `03${"11".repeat(32)}`,
    responseSignerKey: environment.responseSignerKey,
    responseSignerPinned: true,
    registryFulfillmentKey: environment.fulfillmentVerifierKey,
    keysMatch: true,
    runtimeKeyMatches: true,
    oracleContract: environment.oracleContract,
    oracleContractName: "MorpheusOracle",
    oracleChecksum: 1,
    callbackConsumer: environment.callbackConsumer,
    callbackContractName: "OracleCallbackConsumer",
    callbackChecksum: 1,
    callbackBound: true,
    totalRequests: 7,
    totalFulfilled: 6,
    pendingRequests: 1,
    requestFeeGas: 0.01,
    errors: [],
  };
}

function invalidVerification(): VrfVerificationResult {
  return {
    status: "invalid",
    reason: "invalid-json",
    requestId: "",
    randomness: "",
    outputHash: "",
    signerKey: "",
    verifiedAt: "2026-07-12T00:00:00.000Z",
    requestCorrelationSigned: false,
    attestation: "not-provided",
    checks: [{ key: "schema", status: "fail" }],
  };
}

function setupMainApp(options: {
  store?: Map<string, unknown>;
  storage?: Partial<StorageControl>;
} = {}) {
  const store = options.store ?? new Map<string, unknown>();
  const control: StorageControl = {
    setNoop: false,
    deleteNoop: false,
    getThrows: false,
    ...options.storage,
  };
  const actions = new Map<string, Action>();
  const setStatus = vi.fn();
  const framework = {
    storage: {
      local: {
        get: (key: string, fallback: unknown) => {
          if (control.getThrows) throw new Error("storage unavailable");
          return store.has(key) ? store.get(key) : fallback;
        },
        set: (key: string, value: unknown) => {
          if (!control.setNoop) store.set(key, structuredClone(value));
        },
        delete: (key: string) => {
          if (!control.deleteNoop) store.delete(key);
        },
      },
    },
    actions: {
      register: (name: string, action: Action) => actions.set(name, action),
    },
  };
  const result = setupHarness.definition?.setup?.({
    framework,
    t: (key: string) => key,
    setStatus,
  } as never);
  expect(result).toBeTruthy();
  return { actions, control, result: result!, setStatus, store };
}

afterEach(() => {
  workbenchHarness.probe = null;
  workbenchHarness.verify = null;
});

beforeAll(async () => {
  await import("../../oracle-vrf-console/src/main");
}, 90_000);

describe("Oracle VRF Workbench production state", () => {
  it("persists a draft only after exact write and response-delete readback", async () => {
    const app = setupMainApp();
    await app.actions.get("buildDraft")?.({
      consumer: "game-engine",
      reference: "final-round",
      purpose: "game",
    });

    const draft = app.result.state.draft.get() as { request: { request_id: string } };
    expect(draft.request.request_id).toMatch(/^vrf:mainnet:game-engine:/);
    expect(app.result.state.draftPersisted.get()).toBe(true);
    expect(app.result.state.storageHealthy.get()).toBe(true);
    expect(app.result.state.lastStatus.get()).toBe("statusDraftReady");
    expect(app.store.get("vrf/request-draft-v1")).toEqual(draft);
    expect(app.store.has("vrf/response-v1")).toBe(false);
  });

  it("keeps a usable in-session draft without claiming recovery when storage is a no-op", async () => {
    const app = setupMainApp({ storage: { setNoop: true } });
    await app.actions.get("buildDraft")?.({ purpose: "raffle" });

    expect(app.result.state.draft.get()).toBeTruthy();
    expect(app.result.state.draftPersisted.get()).toBe(false);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("statusDraftReadyLocalOnly");
    expect(app.store.has("vrf/request-draft-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("statusDraftReadyLocalOnly", "warning");
  });

  it("labels session clearing as unconfirmed when durable deletion cannot be read back", async () => {
    const recovered = buildVrfRequestDraft(
      { consumer: "raffle", reference: "week-7", purpose: "raffle" },
      "mainnet",
      { nonce: () => "saved-request" },
    );
    const store = new Map<string, unknown>([["vrf/request-draft-v1", recovered]]);
    const app = setupMainApp({ store, storage: { deleteNoop: true } });

    await app.actions.get("clearDraft")?.();

    expect(app.result.state.draft.get()).toBeNull();
    expect(app.result.state.draftPersisted.get()).toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("statusDraftClearUnconfirmed");
    expect(app.store.get("vrf/request-draft-v1")).toEqual(recovered);
    expect(app.setStatus).toHaveBeenLastCalledWith("statusDraftClearUnconfirmed", "warning");
  });

  it("blocks a draft replacement while response verification is still running", async () => {
    let release!: (value: VrfVerificationResult) => void;
    workbenchHarness.verify = () => new Promise((resolve) => { release = resolve; });
    const recovered = buildVrfRequestDraft(
      { consumer: "active", reference: "round", purpose: "game" },
      "mainnet",
      { nonce: () => "active-request" },
    );
    const app = setupMainApp({
      store: new Map<string, unknown>([["vrf/request-draft-v1", recovered]]),
    });

    const verification = app.actions.get("verifyResponse")?.({ responseText: "{}" });
    expect(app.result.state.actionBusy.get()).toBe(true);
    await app.actions.get("buildDraft")?.({ consumer: "replacement", purpose: "allocation" });

    expect(app.result.state.draft.get()).toEqual(recovered);
    expect(app.result.state.lastStatus.get()).toBe("statusOperationBusy");
    release(invalidVerification());
    await verification;
    expect(app.result.state.actionBusy.get()).toBe(false);
    expect(app.result.state.verification.get()).toMatchObject({ status: "invalid" });
  });

  it("boots without probing the oracle service and shows a neutral unchecked state", async () => {
    // Startup is network-quiet by contract: cross-origin health/key/chain
    // probes only run from the user-triggered refreshService action, never on
    // first paint (which used to spam CORS errors and "Degraded" chips).
    const probe = vi.fn(async () => serviceSnapshot());
    workbenchHarness.probe = probe;
    const app = setupMainApp();

    await app.result.loadData();

    expect(probe).not.toHaveBeenCalled();
    expect(app.result.state.serviceSnapshot.get()).toBeNull();
    expect(app.result.state.serviceLabel.get()).toBe("serviceNotChecked");
    expect(app.result.state.lastStatus.get()).toBe("statusReady");
  });

  it("does not let a late on-demand refresh overwrite a draft created by the user", async () => {
    let release!: (value: VrfServiceSnapshot) => void;
    workbenchHarness.probe = () => new Promise((resolve) => { release = resolve; });
    const app = setupMainApp();
    await app.result.loadData();
    const refresh = app.actions.get("refreshService")?.();

    await app.actions.get("buildDraft")?.({
      consumer: "live-user",
      reference: "new-session",
      purpose: "allocation",
    });
    release(serviceSnapshot());
    await refresh;

    expect(app.result.state.draft.get()).toMatchObject({
      context: { consumer: "live-user", reference: "new-session", purpose: "allocation" },
    });
    // The user asked for this refresh, so its completion announcement is the
    // honest final status; the draft itself must survive untouched.
    expect(app.result.state.lastStatus.get()).toBe("statusServiceRefreshed");
    expect(app.result.state.serviceLabel.get()).toBe("serviceProtected");
  });
});
