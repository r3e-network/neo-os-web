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
      const ok = payload.status !== "input_required";

      lastStatus.set(result.status);
      if (ok) {
        lastDigest.set(String(payload.digest ?? ctx.t("digestPlaceholder")));
        requestCount.set(requestCount.get() + 1);
      } else {
        lastDigest.set(ctx.t("digestPlaceholder"));
      }
      ctx.setStatus(result.status, ok ? "success" : "warning");
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
