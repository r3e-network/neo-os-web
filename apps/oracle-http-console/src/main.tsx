import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createConsolePreviewKernel } from "@shared/components-react";
import PlayArea from "./PlayArea";
import { appId, appMeta, consoleConfig, manifest, messages } from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    // Shared console kernel (extraction plan §S14): the lastStatus/lastDigest/
    // requestCount trio, the buildRequest action, and the input_required
    // branch live in createConsolePreviewKernel — this console is the
    // reference wiring the kernel was snapshotted from.
    const kernel = createConsolePreviewKernel({
      t: ctx.t,
      setStatus: ctx.setStatus,
      networkLabel: appMeta.networkLabel,
      endpointLabel: appMeta.endpointLabel,
      buildResult: consoleConfig.buildResult,
    });

    ctx.framework.actions.register("buildRequest", kernel.buildRequest);

    return {
      state: kernel.state,
      loadData: async () => {},
    };
  },
});
