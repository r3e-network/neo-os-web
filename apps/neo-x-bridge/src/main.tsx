import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  buildAssetBridgeIntent,
  buildMessageBridgeIntent,
  buildStatusTimeline,
  bridgeRoute,
  stringifyPayload,
  type BridgeOperation,
  type TimelineStep,
} from "./bridgeConsole";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const lastStatus = createObservable(ctx.t("statusReady"));
    const lastDigest = createObservable(ctx.t("notAvailable"));
    const requestCount = createObservable(0);
    const lastRoute = createObservable("Neo N3 -> Neo X");
    const lastKind = createObservable("asset");
    const lastPayload = createObservable(ctx.t("emptyPayload"));
    const operationsLog = createObservable<BridgeOperation[]>([]);
    const timeline = createObservable<TimelineStep[]>(
      buildStatusTimeline({ bridgeKind: "asset", direction: "n3-to-neox" }),
    );

    const recordIntent = (intent: {
      operation: BridgeOperation;
      payloadText: string;
      timeline: TimelineStep[];
    }) => {
      const nextLog = [intent.operation, ...operationsLog.get()].slice(0, 5);
      operationsLog.set(nextLog);
      timeline.set(intent.timeline);
      lastPayload.set(intent.payloadText);
      lastDigest.set(intent.operation.digest);
      lastRoute.set(intent.operation.route);
      lastKind.set(intent.operation.kind);
      lastStatus.set(intent.operation.status);
      requestCount.set(requestCount.get() + 1);
    };

    ctx.registerAction("prepareAssetBridge", async (formData) => {
      const intent = buildAssetBridgeIntent(formData as Record<string, unknown>);
      recordIntent(intent);
      ctx.setStatus(ctx.t("statusAssetReady"), "success");
    });

    ctx.registerAction("prepareMessageBridge", async (formData) => {
      const intent = buildMessageBridgeIntent(formData as Record<string, unknown>);
      recordIntent(intent);
      ctx.setStatus(ctx.t("statusMessageReady"), "success");
    });

    ctx.registerAction("trackBridgeOperation", async (formData) => {
      const form = formData as Record<string, unknown>;
      const nextTimeline = buildStatusTimeline(form);
      const route = bridgeRoute(form.direction === "neox-to-n3" ? "neox-to-n3" : "n3-to-neox");
      timeline.set(nextTimeline);
      lastRoute.set(route);
      lastKind.set(form.bridgeKind === "message" ? "message" : "asset");
      lastStatus.set(ctx.t("statusTrackingReady"));
      requestCount.set(requestCount.get() + 1);
      lastPayload.set(
        stringifyPayload({
          kind: "axlabs.bridge.statusProbe",
          bridgeKind: form.bridgeKind ?? "asset",
          direction: form.direction ?? "n3-to-neox",
          operationId: form.operationId ?? "",
          sourceTx: form.sourceTx ?? "",
          route,
        }),
      );
      ctx.setStatus(ctx.t("statusTrackingReady"), "success");
    });

    return {
      state: {
        networkLabel: createObservable(appMeta.networkLabel),
        endpointLabel: createObservable(appMeta.endpointLabel),
        lastStatus,
        lastDigest,
        requestCount,
        lastRoute,
        lastKind,
        lastPayload,
        operationsLog,
        timeline,
      },
      loadData: async () => {},
    };
  },
});
