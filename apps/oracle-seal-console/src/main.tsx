import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, appMeta, consoleConfig, manifest, messages } from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const networkLabel = createObservable(appMeta.networkLabel);
    const endpointLabel = createObservable(appMeta.endpointLabel);
    const lastStatus = createObservable(ctx.t("statusReady"));
    const lastDigest = createObservable(ctx.t("digestPlaceholder"));
    const requestCount = createObservable(0);

    ctx.framework.actions.register("buildRequest", async (...args: unknown[]) => {
      const values = (args[0] ?? {}) as Record<string, string>;
      const result = consoleConfig.buildResult(values, ctx.t);
      const payload = result.payload as { status?: string; digest?: string };
      lastStatus.set(result.status);
      if (payload.status === "input_required") {
        lastDigest.set(ctx.t("digestPlaceholder"));
        return result;
      }
      lastDigest.set(String(payload.digest ?? ctx.t("digestPlaceholder")));
      requestCount.set(requestCount.get() + 1);
      return result;
    });

    return {
      state: {
        networkLabel,
        endpointLabel,
        lastStatus,
        lastDigest,
        requestCount,
      },
      loadData: async () => {},
    };
  },
});
