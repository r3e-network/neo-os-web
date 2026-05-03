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
        targetContract: "0x2222222222222222222222222222222222222222",
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

  it("keeps digests deterministic for the same payload", () => {
    expect(stableDigest(["message", "n3-to-neox", "payload"])).toBe(
      stableDigest(["message", "n3-to-neox", "payload"]),
    );
  });
});
