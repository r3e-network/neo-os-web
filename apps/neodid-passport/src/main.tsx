import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, appMeta, buildPassportResult, manifest, messages } from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const state = {
      networkLabel: createObservable(appMeta.networkLabel),
      endpointLabel: createObservable(appMeta.endpointLabel),
      lastStatus: createObservable(ctx.t("statusReady")),
      lastDigest: createObservable(ctx.t("notAvailable")),
      requestCount: createObservable(0),
    };

    ctx.registerAction("buildPassport", async (formData: unknown) => {
      const values = formData && typeof formData === "object"
        ? Object.fromEntries(
            Object.entries(formData as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value ?? ""),
            ]),
          )
        : {};
      const result = buildPassportResult(values, ctx.t);
      state.lastStatus.set(result.status);
      state.lastDigest.set(String(result.payload.digest ?? ""));
      state.requestCount.set(Number(state.requestCount.get() ?? 0) + 1);
      ctx.setStatus(result.status, "success");
    });

    return {
      state: {
        ...state,
      },
      loadData: async () => {},
    };
  },
});
