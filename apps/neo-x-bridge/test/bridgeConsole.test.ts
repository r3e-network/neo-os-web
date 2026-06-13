import { describe, expect, it } from "vitest";
import {
  buildAssetBridgeIntent,
  buildMessageBridgeIntent,
  buildStatusTimeline,
  stableDigest,
} from "../src/bridgeConsole";

describe("neo-x bridge console intent builders", () => {
  it("builds a GAS asset bridge intent with a stable operation id", () => {
    const intent = buildAssetBridgeIntent(
      {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "12.50000000",
        recipient: "0x1111111111111111111111111111111111111111",
      },
      "2026-05-03T00:00:00.000Z",
    );

    expect(intent.operation.kind).toBe("asset");
    expect(intent.operation.route).toBe("Neo N3 -> Neo X");
    expect(intent.operation.id).toMatch(/^N3X-ASSET-[A-F0-9]{8}$/);
    expect(intent.payloadText).toContain("\"kind\": \"axlabs.assetBridge.intent\"");
    expect(intent.payloadText).toContain("\"action\": \"depositGas\"");
    expect(intent.timeline[0]?.state).toBe("done");
    expect(intent.timeline[1]?.state).toBe("active");
  });

  it("builds a MessageBridge payload with a payload digest and SDK metadata", () => {
    const intent = buildMessageBridgeIntent(
      {
        direction: "neox-to-n3",
        targetContract: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
        method: "onCrossChainMessage",
        payload: "{\"event\":\"settled\"}",
        gasLimit: 300000,
      },
      "2026-05-03T00:00:00.000Z",
    );

    expect(intent.operation.kind).toBe("message");
    expect(intent.operation.route).toBe("Neo X -> Neo N3");
    expect(intent.operation.id).toMatch(/^N3X-MSG-[A-F0-9]{8}$/);
    expect(intent.payloadText).toContain("\"sdkPackage\": \"@bane-labs/bridge-sdk-ts\"");
    expect(intent.payloadText).toContain("\"orderingModel\": \"per-direction nonce/root hash chain\"");
  });

  it("normalizes display route labels and legacy message params", () => {
    const assetIntent = buildAssetBridgeIntent({
      direction: "Neo X -> Neo N3",
      asset: "GAS",
      amount: "1",
      recipient: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
    });
    const messageIntent = buildMessageBridgeIntent({
      direction: "Neo X → Neo N3",
      targetContract: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      message: "legacy payload",
    } as Parameters<typeof buildMessageBridgeIntent>[0] & { message: string });

    expect(assetIntent.operation.route).toBe("Neo X -> Neo N3");
    expect(assetIntent.payloadText).toContain("\"action\": \"withdrawGas\"");
    expect(messageIntent.operation.route).toBe("Neo X -> Neo N3");
    expect(messageIntent.payloadText).toContain("\"body\": \"legacy payload\"");
  });

  it("advances status tracking once a source transaction is supplied", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "message",
      direction: "n3-to-neox",
      operationId: "N3X-MSG-12345678",
      sourceTx: "0xabcdef***REMOVED***0123456789",
    });

    expect(timeline.map((step) => step.state)).toEqual([
      "done",
      "done",
      "active",
      "waiting",
      "waiting",
    ]);
  });

  it("accepts txHash as a status tracking alias", () => {
    const timeline = buildStatusTimeline({
      bridgeKind: "asset",
      txHash: "0xabcdef***REMOVED***0123456789",
    } as Parameters<typeof buildStatusTimeline>[0] & { txHash: string });

    expect(timeline[1]?.state).toBe("done");
    expect(timeline[2]?.state).toBe("active");
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
      }),
    ).toThrow(/Neo N3/);
  });

  it("rejects a wrong-chain message target contract", () => {
    expect(() =>
      buildMessageBridgeIntent({
        direction: "n3-to-neox",
        targetContract: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
        payload: "{\"event\":\"settled\"}",
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
      sourceTx: "0xabcdef***REMOVED***0123456789",
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
    expect(timeline[1]?.detailKey).toBe("tlSourceCaptured");
    expect(timeline[1]?.detailParams.sourceTx).toMatch(/^0x[0-9a-f]+\.\.\.[0-9a-f]+$/i);
  });

  it("exposes a statusKey on built intents so the metrics strip can localize the status", () => {
    const asset = buildAssetBridgeIntent({
      direction: "n3-to-neox",
      asset: "GAS",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
    });
    const message = buildMessageBridgeIntent({
      direction: "n3-to-neox",
      targetContract: "0x1111111111111111111111111111111111111111",
      payload: "{}",
    });
    expect(asset.operation.statusKey).toBe("statusIntentPrepared");
    expect(message.operation.statusKey).toBe("statusMessageIntentPrepared");
  });
});
