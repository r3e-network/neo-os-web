import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE_RESOURCES,
  bridgeAppUrl,
  buildBridgeVerificationRequest,
  buildAssetBridgeIntent,
  buildAssetBridgeHandoff,
  buildStatusTimeline,
  normalizeBridgeAmount,
  normalizeGasBridgeAmount,
  probeBridgeServiceBoundary,
  resolveBridgeEnvironment,
  restoreAssetBridgeHandoff,
  restoreBridgeVerificationRequest,
  sourceExplorerUrl,
  stableDigest,
  verifyBridgeSourceTransaction,
  readNeoXGasBalance,
} from "../src/bridgeConsole";

const N3_SOURCE = "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke";
const NEOX_SOURCE = "0x2222222222222222222222222222222222222222";

describe("neo-x bridge console intent builders", () => {
  it("builds a GAS asset bridge intent with a stable operation id", () => {
    const intent = buildAssetBridgeIntent(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "12.50000000",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      "2026-05-03T00:00:00.000Z",
    );

    expect(intent.operation.kind).toBe("asset");
    expect(intent.operation.route).toBe("Neo N3 -> Neo X");
    expect(intent.operation.id).toMatch(/^N3X-ASSET-[A-F0-9]{8}$/);
    expect(intent.payloadText).toContain("\"kind\": \"neo.nativeBridge.reviewIntent\"");
    expect(intent.payloadText).toContain("\"action\": \"depositAsset\"");
    expect(intent.timeline[0]?.state).toBe("done");
    expect(intent.timeline[1]?.state).toBe("active");
  });

  it("normalizes the reverse display route label", () => {
    const assetIntent = buildAssetBridgeIntent({
      direction: "Neo X -> Neo N3",
      asset: "GAS",
      amount: "1",
      recipient: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      sourceAccount: NEOX_SOURCE,
    });

    expect(assetIntent.operation.route).toBe("Neo X -> Neo N3");
    expect(assetIntent.payloadText).toContain("\"action\": \"withdrawAsset\"");
  });

  it("never advances source or destination evidence from a pasted tx hash alone", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "asset",
      direction: "n3-to-neox",
      operationId: "N3X-ASSET-12345678",
      sourceTx: "0xabcdef0123456789abcdef0123456789abcdef0123456789",
    });

    expect(timeline.map((step) => step.state)).toEqual([
      "done",
      "done",
      "active",
      "waiting",
      "waiting",
      "waiting",
    ]);
    expect(timeline[2]?.detailKey).toBe("tlSourceNeedsVerification");
  });

  it("accepts txHash as a status tracking alias", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "asset",
      txHash: "0xabcdef0123456789abcdef0123456789abcdef0123456789",
    } as Parameters<typeof buildStatusTimeline>[0] & { txHash: string });

    expect(timeline[1]?.state).toBe("done");
    expect(timeline[2]?.state).toBe("active");
    expect(timeline[3]?.state).toBe("waiting");
  });

  it("rejects a wrong-chain recipient for the selected direction", () => {
    // n3-to-neox settles on Neo X, so a Neo N3 (N...) recipient is wrong-chain.
    expect(() =>
      buildAssetBridgeIntent({
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      }),
    ).toThrow(/Neo X/);
    // neox-to-n3 settles on Neo N3, so an EVM (0x...) recipient is wrong-chain.
    expect(() =>
      buildAssetBridgeIntent({
        direction: "neox-to-n3",
        asset: "GAS",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      }),
    ).toThrow(/Neo N3/);
    // Shape-valid but unusable EVM zero addresses are never accepted.
    expect(() =>
      buildAssetBridgeIntent({
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: `0x${"0".repeat(40)}`,
      }),
    ).toThrow(/Neo X/);
  });

  it("keeps digests deterministic for the same payload", () => {
    expect(stableDigest(["message", "n3-to-neox", "payload"])).toBe(
      stableDigest(["message", "n3-to-neox", "payload"]),
    );
  });

  it("attaches locale keys + interpolation params to every timeline step (no hardcoded English at render)", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "asset",
      direction: "n3-to-neox",
      operationId: "N3X-ASSET-12345678",
      sourceTx: "0xabcdef0123456789abcdef0123456789abcdef0123456789",
    });

    // Every step carries a labelKey + detailKey the PlayArea translates.
    for (const step of timeline) {
      expect(step.labelKey).toBeTruthy();
      expect(step.detailKey).toBeTruthy();
      expect(step.detailParams).toBeTypeOf("object");
    }
    // The intent step interpolates the operation id + route.
    expect(timeline[0]?.detailKey).toBe("tlIntentReady");
    expect(timeline[0]?.detailParams).toMatchObject({ operation: "N3X-ASSET-12345678" });
    // The source step interpolates the compacted source tx.
    expect(timeline[2]?.detailKey).toBe("tlSourceNeedsVerification");
    expect(timeline[2]?.detailParams.sourceTx).toMatch(/^0x[0-9a-f]+\.\.\.[0-9a-f]+$/i);
  });

  it("derives environment + official bridge resources from the launched network (no testnet literal on mainnet)", () => {
    const mainnet = buildAssetBridgeIntent(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      "2026-05-03T00:00:00.000Z",
      "mainnet",
    );
    const testnet = buildAssetBridgeIntent(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      "2026-05-03T00:00:00.000Z",
      "testnet",
    );

    expect(mainnet.operation.payload.environment).toBe("mainnet");
    expect(mainnet.operation.payload.fundsMoved).toBe(false);
    expect(mainnet.operation.payload.digestKind).toBe("local-reference");
    expect((mainnet.operation.payload.resources as { bridgeApp: string }).bridgeApp).toBe(
      BRIDGE_RESOURCES.bridgeAppMainnet,
    );
    expect(testnet.operation.payload.environment).toBe("testnet");
    expect((testnet.operation.payload.resources as { bridgeApp: string }).bridgeApp).toBe(
      BRIDGE_RESOURCES.bridgeAppTestnet,
    );
    // The environment is bound into the digest, so the two differ.
    expect(mainnet.operation.digest).not.toBe(testnet.operation.digest);
  });

  it("defaults to testnet environment when none is supplied (back-compat)", () => {
    const intent = buildAssetBridgeIntent({
      direction: "n3-to-neox",
      asset: "GAS",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
      sourceAccount: N3_SOURCE,
    });
    expect(intent.operation.payload.environment).toBe("testnet");
    expect(bridgeAppUrl("testnet")).toBe(BRIDGE_RESOURCES.bridgeAppTestnet);
    expect(bridgeAppUrl("mainnet")).toBe(BRIDGE_RESOURCES.bridgeAppMainnet);
  });

  it("builds a source-chain explorer URL matching the direction's source chain + environment", () => {
    // n3-to-neox: source is Neo N3.
    expect(sourceExplorerUrl("n3-to-neox", "mainnet", "0xabc")).toContain("onegate.space");
    expect(sourceExplorerUrl("n3-to-neox", "testnet", "0xabc")).toContain("testnet.explorer.onegate.space");
    // neox-to-n3: source is Neo X.
    expect(sourceExplorerUrl("neox-to-n3", "mainnet", "0xabc")).toContain("xexplorer.neo.org");
    expect(sourceExplorerUrl("neox-to-n3", "testnet", "0xabc")).toContain("xt4scan.ngd.network");
    // The tx hash is appended.
    expect(sourceExplorerUrl("n3-to-neox", "mainnet", "0xdeadbeef")).toContain("0xdeadbeef");
  });

  it("exposes a statusKey on the built intent so the metrics strip can localize the status", () => {
    const asset = buildAssetBridgeIntent({
      direction: "n3-to-neox",
      asset: "GAS",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
      sourceAccount: N3_SOURCE,
    });
    expect(asset.operation.statusKey).toBe("statusIntentPrepared");
  });

  it("binds route, network, token, recipient, amount, quote boundary, expiry, and request id", () => {
    const createdAt = "2026-07-11T00:00:00.000Z";
    const handoff = buildAssetBridgeHandoff(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "12.50000000",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      createdAt,
      "testnet",
    );

    expect(handoff.version).toBe(2);
    expect(handoff.requestId).toMatch(/^N3X-ASSET-[A-F0-9]{8}$/);
    expect(handoff.idempotencyKey).toBe(handoff.digest);
    expect(handoff.environment).toBe("testnet");
    expect(handoff.source).toMatchObject({ key: "neo-n3", chainId: "magic:894710606" });
    expect(handoff.destination).toMatchObject({ key: "neo-x", chainId: "12227332" });
    expect(handoff.token).toEqual({ symbol: "GAS", sourceDecimals: 8, destinationDecimals: 18 });
    expect(handoff.amount).toBe("12.5");
    expect(handoff.sourceAccount).toBe(N3_SOURCE);
    expect(handoff.recipient).toBe("0x1111111111111111111111111111111111111111");
    expect(handoff.quote).toEqual({
      status: "official-bridge-required",
      amountOut: null,
      bridgeFee: null,
      networkFee: null,
      slippageBps: null,
      expiresAt: null,
      estimatedMinutes: { min: 1, max: 2 },
    });
    expect(handoff.createdAt).toBe(createdAt);
    expect(Date.parse(handoff.snapshotExpiresAt) - Date.parse(createdAt)).toBe(10 * 60 * 1000);
    expect(handoff.officialBridgeUrl).toBe(BRIDGE_RESOURCES.bridgeAppTestnet);
  });

  it("keeps handoff preparation idempotent while renewing only the local snapshot expiry", () => {
    const form = {
      direction: "n3-to-neox",
      asset: "GAS",
      amount: "1.25",
      recipient: "0x1111111111111111111111111111111111111111",
      sourceAccount: N3_SOURCE,
    };
    const first = buildAssetBridgeHandoff(form, "2026-07-11T00:00:00.000Z", "testnet");
    const retry = buildAssetBridgeHandoff(form, "2026-07-11T00:05:00.000Z", "testnet");
    const changedRecipient = buildAssetBridgeHandoff(
      { ...form, recipient: "0x2222222222222222222222222222222222222222" },
      "2026-07-11T00:00:00.000Z",
      "testnet",
    );
    const mainnet = buildAssetBridgeHandoff(form, "2026-07-11T00:00:00.000Z", "mainnet");

    expect(retry.digest).toBe(first.digest);
    expect(retry.requestId).toBe(first.requestId);
    expect(retry.snapshotExpiresAt).not.toBe(first.snapshotExpiresAt);
    expect(changedRecipient.digest).not.toBe(first.digest);
    expect(mainnet.digest).not.toBe(first.digest);
  });

  it("restores only a canonical same-network review ticket, including an expired ticket", () => {
    const handoff = buildAssetBridgeHandoff(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1.25",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      "2026-07-11T00:00:00.000Z",
      "testnet",
    );

    expect(restoreAssetBridgeHandoff(handoff, "testnet")).toEqual(handoff);
    expect(restoreAssetBridgeHandoff(handoff, "mainnet")).toBeNull();
    expect(restoreAssetBridgeHandoff({ ...handoff, recipient: "0x2222222222222222222222222222222222222222" }, "testnet")).toBeNull();
    expect(restoreAssetBridgeHandoff({ ...handoff, snapshotExpiresAt: "2099-01-01T00:00:00.000Z" }, "testnet")).toBeNull();
  });

  it("uses exact fixed8 amount parsing and rejects ambiguous financial inputs", () => {
    expect(normalizeGasBridgeAmount("1.23000000")).toBe("1.23");
    expect(normalizeGasBridgeAmount("0.00000001")).toBe("0.00000001");
    for (const invalid of ["0", "1e3", "+1", "-1", ".5", "1.000000001", "1,000", "NaN"]) {
      expect(() => normalizeGasBridgeAmount(invalid)).toThrow();
    }
  });

  it("supports current official NEO routes with whole-unit precision in both directions", () => {
    expect(normalizeBridgeAmount("NEO", "12")).toBe("12");
    for (const invalid of ["0", "1.0", "0.5", "1e2", "-1"]) {
      expect(() => normalizeBridgeAmount("NEO", invalid)).toThrow();
    }
    const deposit = buildAssetBridgeHandoff({
      direction: "n3-to-neox",
      asset: "NEO",
      amount: "12",
      sourceAccount: N3_SOURCE,
      recipient: "0x1111111111111111111111111111111111111111",
    }, "2026-07-12T00:00:00.000Z", "mainnet");
    const withdraw = buildAssetBridgeHandoff({
      direction: "neox-to-n3",
      asset: "NEO",
      amount: "12",
      sourceAccount: NEOX_SOURCE,
      recipient: N3_SOURCE,
    }, "2026-07-12T00:00:00.000Z", "mainnet");
    expect(deposit.token).toEqual({ symbol: "NEO", sourceDecimals: 0, destinationDecimals: 0 });
    expect(withdraw.token).toEqual({ symbol: "NEO", sourceDecimals: 0, destinationDecimals: 0 });
    expect(deposit.digest).not.toBe(withdraw.digest);
  });

  it("reads Neo X native GAS as an exact bigint behind pre/post chain identity checks", async () => {
    const rpc = vi.fn(async (_url: string, method: string) => {
      if (method === "eth_chainId") return "0xba9304";
      if (method === "eth_getBalance") return "0xde0b6b3a7640000";
      throw new Error(`Unexpected method ${method}`);
    });
    await expect(readNeoXGasBalance(NEOX_SOURCE, "testnet", rpc)).resolves.toEqual({
      units: 1_000_000_000_000_000_000n,
      display: "1",
      network: "neo-x-testnet",
    });
    expect(rpc.mock.calls.map((call) => call[1])).toEqual([
      "eth_chainId",
      "eth_getBalance",
      "eth_chainId",
    ]);
  });

  it("fails closed when the Neo X balance RPC is wrong-chain or non-integer", async () => {
    await expect(readNeoXGasBalance(
      NEOX_SOURCE,
      "testnet",
      vi.fn(async () => "0xba93"),
    )).rejects.toThrow(/network identity/i);
    await expect(readNeoXGasBalance(
      NEOX_SOURCE,
      "testnet",
      vi.fn(async (_url: string, method: string) => method === "eth_chainId" ? "0xba9304" : "1.2"),
    )).rejects.toThrow(/invalid integer/i);
  });

  it("keeps all destination stages waiting after a confirmed source receipt", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "asset",
      direction: "neox-to-n3",
      operationId: "N3X-ASSET-12345678",
      sourceTx: `0x${"ab".repeat(32)}`,
      sourceTransaction: "confirmed",
      sourceEvent: "unverified",
      destinationEvent: "unverified",
      destinationReadback: "unverified",
    });
    expect(timeline.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "unknown",
      "waiting",
      "waiting",
    ]);
  });

  it("does not call an unrelated log from the same Neo X bridge address exact event proof", async () => {
    const sourceTx = `0x${"ab".repeat(32)}`;
    const rpc = vi.fn(async (_url: string, method: string) => {
      if (method === "eth_chainId") return "0xba9304";
      if (method === "eth_getTransactionByHash") return { hash: sourceTx };
      if (method === "eth_getTransactionReceipt") {
        return {
          status: "0x1",
          blockNumber: "0x123",
          to: "0x1212000000000000000000000000000000000004",
          logs: [{
            address: "0x1212000000000000000000000000000000000004",
            topics: [`0x${"ff".repeat(32)}`],
            data: "0xdeadbeef",
          }],
        };
      }
      throw new Error(`Unexpected method ${method}`);
    });

    const evidence = await verifyBridgeSourceTransaction(
      {
        environment: "testnet",
        direction: "neox-to-n3",
        sourceTx,
        requestId: "N3X-ASSET-12345678",
        intentDigest: "0x1234567890abcdef",
      },
      rpc,
      "2026-07-11T00:00:00.000Z",
    );

    expect(evidence.sourceTransaction).toBe("confirmed");
    expect(evidence.sourceEvent).toBe("unverified");
    expect(evidence.destinationEvent).toBe("unverified");
    expect(evidence.destinationReadback).toBe("unverified");
    expect(evidence.reason).toBe("confirmed-source-only");
    expect(evidence.retryable).toBe(false);
  });

  it("binds verification fingerprints to direction, network, request, intent, and tx", async () => {
    const sourceTx = `0x${"11".repeat(32)}`;
    const rpc = vi.fn(async (_url: string, method: string) => {
      if (method === "eth_chainId") return "0xba9304";
      if (method === "eth_getTransactionByHash") return { hash: sourceTx };
      return null;
    });
    const base = await verifyBridgeSourceTransaction({
      environment: "testnet",
      direction: "neox-to-n3",
      sourceTx,
      requestId: "N3X-ASSET-AAAAAAAA",
      intentDigest: "0xaaaaaaaaaaaaaaaa",
    }, rpc, "2026-07-11T00:00:00.000Z");
    const changedIntent = await verifyBridgeSourceTransaction({
      environment: "testnet",
      direction: "neox-to-n3",
      sourceTx,
      requestId: "N3X-ASSET-AAAAAAAA",
      intentDigest: "0xbbbbbbbbbbbbbbbb",
    }, rpc, "2026-07-11T00:00:00.000Z");
    expect(base.fingerprint).not.toBe(changedIntent.fingerprint);
    expect(base.sourceTransaction).toBe("pending");
  });

  it("classifies Neo X fault/pending receipts without inventing destination evidence", async () => {
    const sourceTx = `0x${"22".repeat(32)}`;
    const fault = await verifyBridgeSourceTransaction(
      { environment: "mainnet", direction: "neox-to-n3", sourceTx },
      vi.fn(async (_url: string, method: string) => {
        if (method === "eth_chainId") return "0xba93";
        if (method === "eth_getTransactionReceipt") return { status: "0x0", blockNumber: "0x44" };
        return { hash: sourceTx };
      }),
    );
    const pending = await verifyBridgeSourceTransaction(
      { environment: "mainnet", direction: "neox-to-n3", sourceTx },
      vi.fn(async (_url: string, method: string) => {
        if (method === "eth_chainId") return "0xba93";
        if (method === "eth_getTransactionByHash") return { hash: sourceTx };
        return null;
      }),
    );
    expect(fault.sourceTransaction).toBe("faulted");
    expect(fault.retryable).toBe(false);
    expect(fault.destinationReadback).toBe("unverified");
    expect(pending.sourceTransaction).toBe("pending");
    expect(pending.retryable).toBe(true);
  });

  it("does not label a missing Neo X transaction as pending", async () => {
    const evidence = await verifyBridgeSourceTransaction(
      {
        environment: "testnet",
        direction: "neox-to-n3",
        sourceTx: `0x${"33".repeat(32)}`,
      },
      vi.fn(async (_url: string, method: string) => method === "eth_chainId" ? "0xba9304" : null),
    );
    expect(evidence.sourceTransaction).toBe("unknown");
    expect(evidence.reason).toBe("source-unavailable");
  });

  it("does not label a receipt RPC failure as a pending Neo X transaction", async () => {
    const sourceTx = `0x${"34".repeat(32)}`;
    const evidence = await verifyBridgeSourceTransaction(
      { environment: "testnet", direction: "neox-to-n3", sourceTx },
      vi.fn(async (_url: string, method: string) => {
        if (method === "eth_chainId") return "0xba9304";
        if (method === "eth_getTransactionReceipt") throw new Error("receipt service unavailable");
        return { hash: sourceTx };
      }),
    );
    expect(evidence.sourceTransaction).toBe("unknown");
  });

  it("resolves Neo X testnet launch spellings to the testnet bridge", () => {
    for (const network of ["neo-x-testnet", "neo-n3-testnet", "t4", "12227332", "894710606"]) {
      expect(resolveBridgeEnvironment(network)).toBe("testnet");
    }
    expect(resolveBridgeEnvironment("neo-x-mainnet")).toBe("mainnet");
    expect(resolveBridgeEnvironment(undefined)).toBe("testnet");
    expect(resolveBridgeEnvironment("malformed-host-network")).toBe("testnet");
  });

  it("recovers only a canonical verification request bound to its route and handoff", () => {
    const handoff = buildAssetBridgeHandoff(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        sourceAccount: N3_SOURCE,
      },
      "2026-07-11T00:00:00.000Z",
      "testnet",
    );
    const request = buildBridgeVerificationRequest({
      environment: "testnet",
      direction: handoff.direction,
      sourceTx: `0x${"44".repeat(32)}`,
      requestId: handoff.requestId,
      intentDigest: handoff.digest,
    }, "2026-07-11T00:01:00.000Z");

    expect(request.version).toBe(2);
    expect(restoreBridgeVerificationRequest(request, "testnet", handoff)).toEqual(request);
    expect(restoreBridgeVerificationRequest(request, "mainnet", handoff)).toBeNull();
    expect(restoreBridgeVerificationRequest({ ...request, direction: "neox-to-n3" }, "testnet", handoff)).toBeNull();
    expect(restoreBridgeVerificationRequest({ ...request, intentDigest: "0xbbbbbbbbbbbbbbbb" }, "testnet", handoff)).toBeNull();
  });

  it("gates source receipt reads on the selected Neo X chain id", async () => {
    const rpc = vi.fn(async (_url: string, method: string) => method === "eth_chainId" ? "0xba93" : null);
    await expect(verifyBridgeSourceTransaction({
      environment: "testnet",
      direction: "neox-to-n3",
      sourceTx: `0x${"55".repeat(32)}`,
    }, rpc)).rejects.toThrow(/network identity/i);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("gates Neo N3 reads on network magic and keeps HALT evidence source-only", async () => {
    const sourceTx = `0x${"66".repeat(32)}`;
    const rpc = vi.fn(async (_url: string, method: string) => {
      if (method === "getversion") return { protocol: { network: 894710606 } };
      if (method === "getrawtransaction") return { confirmations: 3, blockindex: 42 };
      if (method === "getapplicationlog") return { executions: [{ vmstate: "HALT" }] };
      throw new Error(`Unexpected method ${method}`);
    });
    const evidence = await verifyBridgeSourceTransaction({
      environment: "testnet",
      direction: "n3-to-neox",
      sourceTx,
    }, rpc);
    expect(evidence).toMatchObject({
      sourceTransaction: "confirmed",
      sourceBlock: "42",
      sourceEvent: "unverified",
      destinationEvent: "unverified",
      destinationReadback: "unverified",
    });

    const mismatchRpc = vi.fn(async () => ({ protocol: { network: 860833102 } }));
    await expect(verifyBridgeSourceTransaction({
      environment: "testnet",
      direction: "n3-to-neox",
      sourceTx,
    }, mismatchRpc)).rejects.toThrow(/network identity/i);
    expect(mismatchRpc).toHaveBeenCalledTimes(1);
  });

  it("probes both network identities and fails closed on a chain-id mismatch", async () => {
    const readyRpc = vi.fn(async (_url: string, method: string) => method === "getversion"
      ? { protocol: { network: 894710606 } }
      : "0xba9304");
    const mismatchRpc = vi.fn(async (_url: string, method: string) => method === "getversion"
      ? { protocol: { network: 860833102 } }
      : "0xba93");
    const ready = await probeBridgeServiceBoundary("testnet", readyRpc, "2026-07-11T00:00:00.000Z");
    const blocked = await probeBridgeServiceBoundary("testnet", mismatchRpc, "2026-07-11T00:00:00.000Z");
    expect(ready).toMatchObject({
      n3Rpc: "ready",
      neoXRpc: "ready",
      quoteService: "official-app-only",
      destinationStatusService: "unavailable",
    });
    expect(blocked.n3Rpc).toBe("blocked");
    expect(blocked.neoXRpc).toBe("blocked");
  });
});
