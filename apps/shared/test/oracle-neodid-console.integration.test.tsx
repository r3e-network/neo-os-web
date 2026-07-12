import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  buildPendingOperation,
  type NeoDidConsoleForm,
  type NeoDidEvidenceSnapshot,
} from "../../oracle-neodid-console/src/neodid-console";

const DID = "did:morpheus:neo_n3:service:neodid";
const MAINNET_REGISTRY = "0xb81f31ea81e279793b30411b82c2e82078b63105";
const FORM: NeoDidConsoleForm = {
  did: DID,
  provider: "web3auth",
  claim: "Web3Auth_PrimaryIdentity",
};

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

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("../react/defineMiniApp")>(
    "../react/defineMiniApp",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: typeof setupHarness.definition) => {
      setupHarness.definition = definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

interface FetchControl {
  failCatalog: boolean;
  failResolver: boolean;
  mismatchSubject: boolean;
}

function installNetworkFetch(network: "mainnet" | "testnet") {
  const control: FetchControl = {
    failCatalog: false,
    failResolver: false,
    mismatchSubject: false,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/morpheus/neodid/resolve?")) {
      if (control.failResolver) {
        return new Response(JSON.stringify({ error: "resolver unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      const id = control.mismatchSubject ? "did:morpheus:neo_n3:aa:other" : DID;
      return new Response(JSON.stringify({
        didDocument: {
          id,
          controller: [id],
          verificationMethod: [],
          service: [
            { id: "#resolver", type: "DIDResolutionService", serviceEndpoint: "/resolve" },
            { id: "#registry", type: "MorpheusNeoDIDRegistry", serviceEndpoint: { contract: MAINNET_REGISTRY } },
            { id: "#oracle", type: "MorpheusOracleGateway", serviceEndpoint: { request_types: ["neodid_bind"] } },
            { id: "#runtime", type: "MorpheusNeoDIDRuntime", serviceEndpoint: { runtime_url: "https://runtime.example" } },
          ],
        },
        didDocumentMetadata: {
          versionId: "unversioned",
          anchorContract: network === "mainnet" ? MAINNET_REGISTRY : "",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.startsWith("/api/morpheus/neodid/providers?")) {
      if (control.failCatalog) {
        return new Response(JSON.stringify({ error: "catalog unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        providers: [{
          id: "web3auth",
          category: "identity",
          aliases: ["w3a"],
          auth_modes: ["aggregate_oauth", "mfa"],
          claim_types: ["Web3Auth_PrimaryIdentity", "Web3Auth_LinkedSocials"],
          derives_provider_uid_in_tee: true,
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    const request = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    if (request.method === "getversion") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { protocol: { network: network === "mainnet" ? 860833102 : 894710606 } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (request.method === "getcontractstate") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { hash: MAINNET_REGISTRY, manifest: { name: "NeoDIDRegistry" } },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { control, fetchMock };
}

function setupMainApp(options: {
  network?: "mainnet" | "testnet";
  store?: Map<string, unknown>;
  storageSetFails?: boolean;
  storageNoop?: boolean;
  storageDeleteNoop?: boolean;
  clipboardReturnsFalse?: boolean;
} = {}) {
  const network = options.network ?? "mainnet";
  const store = options.store ?? new Map<string, unknown>();
  const actions = new Map<string, Action>();
  const copy = vi.fn(async () => !options.clipboardReturnsFalse);
  const setStatus = vi.fn();
  const framework = {
    storage: {
      local: {
        get: (key: string, fallback: unknown) => options.storageNoop
          ? fallback
          : store.has(key) ? store.get(key) : fallback,
        set: (key: string, value: unknown) => {
          if (options.storageSetFails) throw new Error("storage unavailable");
          if (options.storageNoop) return;
          store.set(key, value);
        },
        delete: (key: string) => {
          if (options.storageNoop || options.storageDeleteNoop) return;
          store.delete(key);
        },
      },
    },
    actions: {
      register: (name: string, action: Action) => actions.set(name, action),
    },
    clipboard: { copy },
  };
  const ctx = {
    launchContext: { network: `neo-n3-${network}`, params: {} },
    framework,
    t: (key: string) => key,
    setStatus,
  };
  const result = setupHarness.definition?.setup?.(ctx as never);
  expect(result).toBeTruthy();
  return { actions, copy, result: result!, setStatus, store };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeAll(async () => {
  await import("../../oracle-neodid-console/src/main");
}, 30_000);

describe("Oracle NeoDID Console main integration", () => {
  it("registers only the real read, recovery, copy, and reset product actions", () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp();
    expect(Array.from(app.actions.keys()).sort()).toEqual([
      "copyEvidence",
      "discardEvidence",
      "expireEvidence",
      "refreshProviderCatalog",
      "resetEvidence",
      "resolveEvidence",
    ]);
    expect(Array.from(app.actions.keys()).join(" ")).not.toMatch(/seal|sign|dispatch|buildOraclePackage/i);
  });

  it("resolves real evidence and persists explicit non-verification boundaries", async () => {
    const { fetchMock } = installNetworkFetch("mainnet");
    const app = setupMainApp();
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;

    expect(evidence.subject).toBe(DID);
    expect(evidence.registry).toMatchObject({
      status: "verified",
      contract: MAINNET_REGISTRY,
      contractName: "NeoDIDRegistry",
      networkMagic: 860833102,
    });
    expect(evidence.context.status).toBe("claim-listed");
    expect(evidence.boundaries.identityVerification).toBe("not-performed");
    expect(evidence.boundaries.claimAttestation).toBe("not-performed");
    expect(evidence.boundaries.signatureVerification).toBe("not-performed");
    expect(evidence.boundaries.oracleDispatch).toBe("not-performed");
    expect(app.result.state.evidence.get()).toEqual(evidence);
    expect(app.result.state.requestCount.get()).toBe(1);
    expect(app.store.get("oracle-neodid-console/evidence-v1")).toEqual(evidence);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/providers?network=mainnet")))
      .toBe(true);
  });

  it("keeps DID resolution usable when the optional provider catalog is unavailable", async () => {
    const { control } = installNetworkFetch("mainnet");
    control.failCatalog = true;
    const app = setupMainApp();
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;

    expect(evidence.resolver.status).toBe("document-returned");
    expect(evidence.catalog.status).toBe("unavailable");
    expect(evidence.context.status).toBe("catalog-unavailable");
    expect(app.setStatus).toHaveBeenLastCalledWith("evidenceReadyDegraded", "warning");
  });

  it("clears stale evidence and storage before surfacing a resolver mismatch", async () => {
    const { control } = installNetworkFetch("mainnet");
    const app = setupMainApp();
    await app.actions.get("resolveEvidence")?.(FORM);
    expect(app.result.state.evidence.get()).toBeTruthy();

    control.mismatchSubject = true;
    const result = await app.actions.get("resolveEvidence")?.(FORM);

    expect(result).toBeNull();
    expect(app.result.state.evidence.get()).toBeNull();
    expect(app.result.state.lastDigest.get()).toBe("digestPlaceholder");
    expect(app.store.has("oracle-neodid-console/evidence-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("resolverSubjectMismatch", "error");
  });

  it("clears prior evidence when a direct caller submits invalid lookup input", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp();
    await app.actions.get("resolveEvidence")?.(FORM);

    const result = await app.actions.get("resolveEvidence")?.({ ...FORM, did: "did:web:example.com" });

    expect(result).toBeNull();
    expect(app.result.state.evidence.get()).toBeNull();
    expect(app.store.has("oracle-neodid-console/evidence-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("consoleInvalidDid", "error");
  });

  it("does not restore mainnet evidence into a testnet launch", async () => {
    installNetworkFetch("mainnet");
    const store = new Map<string, unknown>();
    const mainnet = setupMainApp({ store });
    await mainnet.actions.get("resolveEvidence")?.(FORM);
    expect(store.has("oracle-neodid-console/evidence-v1")).toBe(true);
    mainnet.result.cleanup();

    installNetworkFetch("testnet");
    const testnet = setupMainApp({ network: "testnet", store });
    await testnet.result.loadData();

    expect(testnet.result.state.evidence.get()).toBeNull();
    expect(testnet.result.state.network.get()).toBe("testnet");
    expect(store.has("oracle-neodid-console/evidence-v1")).toBe(false);
  });

  it("resumes an interrupted same-network resolver GET exactly once", async () => {
    const { fetchMock } = installNetworkFetch("mainnet");
    const store = new Map<string, unknown>([[
      "oracle-neodid-console/pending-v1",
      buildPendingOperation("mainnet", FORM),
    ]]);
    const app = setupMainApp({ store });

    await app.result.loadData();
    const resolverCallsAfterFirstLoad = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("/api/morpheus/neodid/resolve?")
    ).length;
    await app.result.loadData();
    const resolverCallsAfterSecondLoad = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("/api/morpheus/neodid/resolve?")
    ).length;

    expect(app.result.state.evidence.get()).toBeTruthy();
    expect(resolverCallsAfterFirstLoad).toBe(1);
    expect(resolverCallsAfterSecondLoad).toBe(1);
    expect(store.has("oracle-neodid-console/pending-v1")).toBe(false);
  });

  it("copies the exact evidence JSON and stays useful when local storage fails", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ storageSetFails: true });
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;
    const copied = await app.actions.get("copyEvidence")?.();

    expect(evidence).toBeTruthy();
    expect(app.result.state.evidence.get()).toEqual(evidence);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.setStatus).toHaveBeenCalledWith("evidenceReadyNoStorage", "warning");
    expect(copied).toBe(true);
    expect(app.copy).toHaveBeenCalledWith(JSON.stringify(evidence, null, 2), {
      successKey: "copied",
      errorKey: "copyFailed",
    });
  });

  it("does not report success when the host clipboard declines the copy", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ clipboardReturnsFalse: true });
    await app.actions.get("resolveEvidence")?.(FORM);

    await expect(app.actions.get("copyEvidence")?.()).resolves.toBe(false);
    expect(app.result.state.lastStatus.get()).toBe("copyFailed");
  });

  it("rechecks the digest before copy and clears a mutated in-memory snapshot", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp();
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;
    evidence.digest = "0".repeat(64);

    await expect(app.actions.get("copyEvidence")?.()).resolves.toBe(false);
    expect(app.copy).not.toHaveBeenCalled();
    expect(app.result.state.evidence.get()).toBeNull();
    expect(app.store.has("oracle-neodid-console/evidence-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("evidenceInvalid", "error");
  });

  it("detects silent storage no-ops and never promises local recovery", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ storageNoop: true });

    expect(app.result.state.storageHealthy.get()).toBe(false);
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;

    expect(evidence).toBeTruthy();
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.store.has("oracle-neodid-console/evidence-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("evidenceReadyNoStorage", "warning");
  });

  it("requires pending-checkpoint deletion readback before promising recovery", async () => {
    installNetworkFetch("mainnet");
    const app = setupMainApp({ storageDeleteNoop: true });
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;

    expect(evidence).toBeTruthy();
    expect(app.store.has("oracle-neodid-console/pending-v1")).toBe(true);
    expect(app.result.state.storageHealthy.get()).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("evidenceReadyNoStorage", "warning");
  });

  it("clears expired evidence before allowing a stale JSON copy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-11T00:00:00.000Z");
    installNetworkFetch("mainnet");
    const app = setupMainApp();
    const evidence = await app.actions.get("resolveEvidence")?.(FORM) as NeoDidEvidenceSnapshot;
    expect(evidence).toBeTruthy();

    vi.setSystemTime("2026-07-11T00:16:00.000Z");
    await expect(app.actions.get("copyEvidence")?.()).resolves.toBe(false);

    expect(app.copy).not.toHaveBeenCalled();
    expect(app.result.state.evidence.get()).toBeNull();
    expect(app.store.has("oracle-neodid-console/evidence-v1")).toBe(false);
    expect(app.setStatus).toHaveBeenLastCalledWith("evidenceExpired", "warning");
  });
});
