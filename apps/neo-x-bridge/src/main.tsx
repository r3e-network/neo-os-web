import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import { getNetwork } from "@shared/constants/rpc";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  bridgeAppUrl,
  buildAssetBridgeIntent,
  buildMessageBridgeIntent,
  buildStatusTimeline,
  bridgeRoute,
  normalizeDirection,
  stableDigest,
  stringifyPayload,
  type BridgeEnvironment,
  type BridgeOperation,
  type TimelineStep,
} from "./bridgeConsole";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    // Derive the bridge environment from the launched network so the prepared
    // intent / resource links / digest reflect mainnet vs testnet instead of a
    // hardcoded testnet literal.
    const bridgeEnvironment: BridgeEnvironment =
      getNetwork() === "testnet" ? "testnet" : "mainnet";
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
      // Translate the operation's status key so the metrics strip never shows a
      // bare English status to a zh user.
      lastStatus.set(ctx.t(intent.operation.statusKey));
      requestCount.set(requestCount.get() + 1);
    };

    const asForm = (formData: unknown): Record<string, unknown> =>
      formData && typeof formData === "object" && !Array.isArray(formData)
        ? formData as Record<string, unknown>
        : {};
    const hasText = (value: unknown): boolean => String(value ?? "").trim().length > 0;
    const showBridgeError = (err: unknown) => {
      ctx.setStatus(err instanceof Error ? err.message : ctx.t("errBridgeGeneric"), "error");
    };

    ctx.framework.actions.register("prepareAssetBridge", async (formData) => {
      const form = asForm(formData);
      if (!hasText(form.amount) || !hasText(form.recipient)) {
        ctx.setStatus(ctx.t("hintAssetGate"), "error");
        return;
      }
      try {
        const intent = buildAssetBridgeIntent(form, undefined, bridgeEnvironment);
        recordIntent(intent);
        ctx.setStatus(ctx.t("statusAssetReady"), "success");
      } catch (err) {
        showBridgeError(err);
      }
    });

    ctx.framework.actions.register("prepareMessageBridge", async (formData) => {
      const form = asForm(formData);
      if (!hasText(form.targetContract) || !hasText(form.message ?? form.payload)) {
        ctx.setStatus(ctx.t("hintMessageGate"), "error");
        return;
      }
      try {
        const intent = buildMessageBridgeIntent(form, undefined, bridgeEnvironment);
        recordIntent(intent);
        ctx.setStatus(ctx.t("statusMessageReady"), "success");
      } catch (err) {
        showBridgeError(err);
      }
    });

    ctx.framework.actions.register("trackBridgeOperation", async (formData) => {
      const form = asForm(formData);
      const bridgeKind = form.bridgeKind === "message" ? "message" : "asset";
      const direction = normalizeDirection(form.direction);
      const nextTimeline = buildStatusTimeline(form);
      const route = bridgeRoute(direction);
      const operationId = String(form.operationId ?? "").trim();
      const sourceTx = String(form.sourceTx ?? "").trim();
      const digest = stableDigest(["status", bridgeKind, direction, operationId, sourceTx]);
      const payload = {
        kind: "axlabs.bridge.statusProbe",
        bridgeKind,
        direction,
        operationId,
        sourceTx,
        route,
        digest,
      };
      const operation: BridgeOperation = {
        id: operationId || `N3X-TRACK-${digest.slice(2, 10).toUpperCase()}`,
        kind: bridgeKind,
        direction,
        route,
        title: `${bridgeKind === "message" ? ctx.t("messageBridge") : ctx.t("assetBridge")} ${route}`,
        digest,
        createdAt: new Date().toISOString(),
        status: ctx.t("statusTrackingReady"),
        statusKey: "statusTrackingReady",
        sourceTx: sourceTx || undefined,
        payload,
      };
      operationsLog.set([operation, ...operationsLog.get()].slice(0, 5));
      timeline.set(nextTimeline);
      lastRoute.set(route);
      lastKind.set(bridgeKind);
      lastDigest.set(digest);
      lastStatus.set(ctx.t("statusTrackingReady"));
      requestCount.set(requestCount.get() + 1);
      lastPayload.set(stringifyPayload(payload));
      ctx.setStatus(ctx.t("statusTrackingReady"), "success");
    });

    return {
      state: {
        networkLabel: createObservable(appMeta.networkLabel),
        endpointLabel: createObservable(appMeta.endpointLabel),
        // Surface the active bridge environment + official-bridge URL so the
        // PlayArea can render the required "Open official bridge to submit" next
        // step and a network-correct source-tx explorer link.
        bridgeEnvironment: createObservable<BridgeEnvironment>(bridgeEnvironment),
        bridgeAppUrl: createObservable(bridgeAppUrl(bridgeEnvironment)),
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
