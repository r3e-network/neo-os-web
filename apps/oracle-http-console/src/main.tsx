import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createConsolePreviewKernel } from "@shared/components-react";
import PlayArea from "./PlayArea";
import {
  appId,
  consoleConfig,
  manifest,
  messages,
  resolveOracleHttpEnvironment,
} from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const environment = resolveOracleHttpEnvironment(ctx.launchContext.network);
    // Shared console kernel (extraction plan §S14): the lastStatus/lastDigest/
    // requestCount trio, the buildRequest action, and the input_required
    // branch live in createConsolePreviewKernel — this console is the
    // reference wiring the kernel was snapshotted from.
    const kernel = createConsolePreviewKernel({
      t: ctx.t,
      setStatus: ctx.setStatus,
      networkLabel: environment.networkLabel,
      endpointLabel: ctx.t("localBuilderMode"),
      buildResult: consoleConfig.buildResult,
    });

    ctx.framework.actions.register("buildRequest", kernel.buildRequest);
    ctx.framework.actions.register("invalidateRequest", async () => {
      const currentDigest = String(kernel.state.lastDigest.get());
      if (!/^0x[0-9a-f]{64}$/i.test(currentDigest)) return false;
      kernel.state.lastStatus.set(ctx.t("httpDraftChanged"));
      kernel.state.lastDigest.set(ctx.t("digestPlaceholder"));
      return true;
    });
    ctx.framework.actions.register("resetRequest", async () => {
      kernel.reset();
    });
    ctx.framework.actions.register("copyPayload", async (value: unknown) => {
      const payload = typeof value === "string" ? value : "";
      if (!payload) return false;
      return ctx.framework.clipboard.copy(payload, { successKey: "payloadCopied" });
    });

    return {
      state: kernel.state,
      loadData: async () => {},
    };
  },
});
