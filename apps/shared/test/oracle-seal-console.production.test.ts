// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOracleExtensions } from "@framework/oracle-ext";
import {
  appendStoredOracleSeal,
  assertOracleSealStorageAvailable,
  clearPendingOracleSeal,
  inspectPendingOracleSeal,
  markPendingOracleSealStored,
  savePendingOracleSeal,
  type OracleSealStore,
  type PendingOracleSeal,
} from "../../oracle-seal-console/src/history";
import {
  readOracleSealContractEvidence,
  readOracleSealStoreCapability,
} from "../../oracle-seal-console/src/oracle-seal-chain";
import {
  createOracleSealOperationCoordinator,
  OracleSealOperationConflictError,
} from "../../oracle-seal-console/src/operation-coordinator";
import {
  ORACLE_SEAL_APP_ID,
  prepareOracleSeal,
  storePreparedOracleSeal,
  type PreparedOracleSeal,
} from "../../oracle-seal-console/src/seal";

const TESTNET_CONTRACT = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const RAW_X25519_KEY = "X+mfM9Lg+Tm9GBzniOC0vwDcZE857Za9AbdJCD7IsWM=";
const ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";

interface StorageControl {
  values: Map<string, unknown>;
  silentSet: boolean;
  silentDelete: boolean;
  store: OracleSealStore;
}

function controlledStore(): StorageControl {
  const control: StorageControl = {
    values: new Map(),
    silentSet: false,
    silentDelete: false,
    store: undefined as unknown as OracleSealStore,
  };
  control.store = {
    get<T>(key: string, fallback?: T | null) {
      return control.values.has(key) ? control.values.get(key) as T : (fallback ?? null);
    },
    set(key, value) {
      if (!control.silentSet) control.values.set(key, value);
    },
    delete(key) {
      if (!control.silentDelete) control.values.delete(key);
    },
  };
  return control;
}

async function makePrepared(): Promise<PreparedOracleSeal> {
  let prepared: PreparedOracleSeal | null = null;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith("/api/morpheus/oracle/public-key")) {
      return new Response(JSON.stringify({
        public_key: RAW_X25519_KEY,
        algorithm: ALGORITHM,
        contract: TESTNET_CONTRACT,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "store unavailable" }), { status: 503 });
  });
  const seal = createOracleExtensions({
    appId: ORACLE_SEAL_APP_ID,
    seal: { network: "testnet", fetcher: fetcher as unknown as typeof fetch },
  }).seal;
  await prepareOracleSeal({
    network: "testnet",
    purpose: "oracle-input",
    publicRoute: "oracle://production/test",
    payload: "{\"private\":true}",
    seal,
    onPrepared: (value) => { prepared = value; },
  }).catch(() => undefined);
  if (!prepared) throw new Error("fixture preparation failed");
  return prepared;
}

function rpcResponse(id: string, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function byteString(text: string) {
  return { type: "ByteString", value: btoa(text) };
}

describe("Oracle Seal Console production coordination", () => {
  it("joins duplicate readiness reads and rejects a conflicting product action", async () => {
    const busy: boolean[] = [];
    const coordinator = createOracleSealOperationCoordinator((value) => busy.push(value));
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const task = vi.fn(async () => waiting.then(() => "ready"));

    const first = coordinator.run("refresh", task, { joinSame: true });
    const duplicate = coordinator.run("refresh", task, { joinSame: true });
    await expect(coordinator.run("seal", async () => "sealed")).rejects.toBeInstanceOf(
      OracleSealOperationConflictError,
    );
    expect(task).toHaveBeenCalledTimes(1);
    expect(coordinator.activeKey()).toBe("refresh");
    release();
    await expect(Promise.all([first, duplicate])).resolves.toEqual(["ready", "ready"]);
    expect(busy).toEqual([true, false]);
  });

  it("reads independent key evidence from the selected Neo N3 RPC without a wallet", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      rpcResponse("contract", { manifest: { name: "MorpheusOracle" } }),
      rpcResponse("key", { state: "HALT", stack: [byteString(RAW_X25519_KEY)] }),
      rpcResponse("algorithm", { state: "HALT", stack: [byteString(ALGORITHM)] }),
    ]), { status: 200 }));
    const evidence = await readOracleSealContractEvidence("testnet", {
      fetcher,
      now: () => 1_725_000_000_000,
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://api.n3index.dev/testnet");
    expect(evidence).toMatchObject({
      network: "testnet",
      contract: TESTNET_CONTRACT,
      contractName: "MorpheusOracle",
      publicKey: RAW_X25519_KEY,
      algorithm: ALGORITHM,
      checkedAt: 1_725_000_000_000,
    });
  });

  it("rejects malformed or mislabeled contract evidence", async () => {
    const wrongContract = vi.fn(async () => new Response(JSON.stringify([
      rpcResponse("contract", { manifest: { name: "NotMorpheus" } }),
      rpcResponse("key", { state: "HALT", stack: [byteString(RAW_X25519_KEY)] }),
      rpcResponse("algorithm", { state: "HALT", stack: [byteString(ALGORITHM)] }),
    ]), { status: 200 }));
    await expect(readOracleSealContractEvidence("testnet", { fetcher: wrongContract }))
      .rejects.toThrow(/not MorpheusOracle/);

    const malformedKey = vi.fn(async () => new Response(JSON.stringify([
      rpcResponse("contract", { manifest: { name: "MorpheusOracle" } }),
      rpcResponse("key", { state: "HALT", stack: [{ type: "Integer", value: "7" }] }),
      rpcResponse("algorithm", { state: "HALT", stack: [byteString(ALGORITHM)] }),
    ]), { status: 200 }));
    await expect(readOracleSealContractEvidence("testnet", { fetcher: malformedKey }))
      .rejects.toThrow(/stack type/);
  });

  it("enables sealing only for an explicitly configured same-network store capability", async () => {
    const ready = vi.fn(async () => new Response(JSON.stringify({
      available: true,
      network: "testnet",
      target_chain: "neo_n3",
    }), { status: 200 }));
    await expect(readOracleSealStoreCapability("testnet", {
      fetcher: ready,
      now: () => 1_725_000_000_000,
    })).resolves.toEqual({
      network: "testnet",
      targetChain: "neo_n3",
      checkedAt: 1_725_000_000_000,
    });
    expect(String(ready.mock.calls[0]?.[0])).toBe(
      "/api/morpheus/confidential/store?network=testnet",
    );

    const unavailable = vi.fn(async () => new Response(JSON.stringify({
      available: false,
      network: "testnet",
      target_chain: "neo_n3",
    }), { status: 200 }));
    await expect(readOracleSealStoreCapability("testnet", { fetcher: unavailable }))
      .rejects.toThrow(/not configured/);
  });
});

describe("Oracle Seal Console durable recovery", () => {
  it("fails the storage probe when writes are silently dropped", () => {
    const control = controlledStore();
    control.silentSet = true;
    expect(() => assertOracleSealStorageAvailable(control.store)).toThrow(/did not retain/);
  });

  it("requires exact pending write and deletion readback", async () => {
    const prepared = await makePrepared();
    const pending: PendingOracleSeal = {
      version: 2,
      recoveryState: "prepared",
      ...prepared,
      createdAt: Date.now(),
      attempts: 1,
    };
    const control = controlledStore();
    savePendingOracleSeal(control.store, pending);
    expect(inspectPendingOracleSeal(control.store).pending?.fingerprint).toBe(prepared.fingerprint);

    control.silentDelete = true;
    expect(() => clearPendingOracleSeal(control.store)).toThrow(/did not clear/);
    expect(inspectPendingOracleSeal(control.store).pending).not.toBeNull();
  });

  it("does not call the external store when the prepared ciphertext cannot be persisted", async () => {
    const control = controlledStore();
    control.silentSet = true;
    let storeCalls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/morpheus/oracle/public-key")) {
        return new Response(JSON.stringify({
          public_key: RAW_X25519_KEY,
          algorithm: ALGORITHM,
          contract: TESTNET_CONTRACT,
        }), { status: 200 });
      }
      storeCalls += 1;
      return new Response(JSON.stringify({ secret_ref: "should-not-exist" }), { status: 200 });
    });
    const seal = createOracleExtensions({
      appId: ORACLE_SEAL_APP_ID,
      seal: { network: "testnet", fetcher: fetcher as unknown as typeof fetch },
    }).seal;

    await expect(prepareOracleSeal({
      network: "testnet",
      purpose: "private-compute",
      payload: "{\"workload\":7}",
      seal,
      onPrepared: (prepared) => savePendingOracleSeal(control.store, {
        version: 2,
        recoveryState: "prepared",
        ...prepared,
        createdAt: Date.now(),
        attempts: 1,
      }),
    })).rejects.toThrow(/did not retain/);
    expect(storeCalls).toBe(0);
  });

  it("marks a returned receipt before cleanup and finalizes history idempotently", async () => {
    const prepared = await makePrepared();
    const pending: PendingOracleSeal = {
      version: 2,
      recoveryState: "prepared",
      ...prepared,
      createdAt: Date.now(),
      attempts: 1,
    };
    const receipt = {
      secretRef: "stored-reference",
      fingerprint: prepared.fingerprint,
      purpose: prepared.purpose,
      publicRoute: prepared.publicRoute,
      network: prepared.network,
      contract: prepared.contract,
      algorithm: prepared.algorithm,
    };
    const control = controlledStore();
    const settled = markPendingOracleSealStored(pending, receipt, Date.now());
    savePendingOracleSeal(control.store, settled);
    expect(inspectPendingOracleSeal(control.store).pending?.recoveryState).toBe("stored");

    const storedAt = settled.storedAt as number;
    expect(appendStoredOracleSeal(control.store, { ...receipt, storedAt })).toHaveLength(1);
    expect(appendStoredOracleSeal(control.store, { ...receipt, storedAt })).toHaveLength(1);
  });

  it("recomputes the ciphertext fingerprint before an exact retry", async () => {
    const prepared = await makePrepared();
    const envelope = JSON.parse(atob(prepared.ciphertext)) as Record<string, string>;
    envelope.ct = `${envelope.ct.startsWith("A") ? "B" : "A"}${envelope.ct.slice(1)}`;
    const corrupted = { ...prepared, ciphertext: btoa(JSON.stringify(envelope)) };
    const store = vi.fn().mockResolvedValue({ secretRef: "must-not-run", raw: {} });

    await expect(storePreparedOracleSeal({
      prepared: corrupted,
      seal: { publicKey: vi.fn(), encrypt: vi.fn(), store },
    })).rejects.toThrow(/fingerprint does not match/);
    expect(store).not.toHaveBeenCalled();
  });
});
