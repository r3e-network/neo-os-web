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
    // Shared console kernel (extraction plan §S14). notify: "silent" keeps
    // this console's original toast-free wiring — buildRequest updates the
    // stats trio but never toasts from the action itself.
    const kernel = createConsolePreviewKernel({
      t: ctx.t,
      networkLabel: appMeta.networkLabel,
      endpointLabel: appMeta.endpointLabel,
      buildResult: consoleConfig.buildResult,
      notify: "silent",
    });

    ctx.framework.actions.register("buildRequest", kernel.buildRequest);

    return {
      state: kernel.state,
      loadData: async () => {},
    };
  },
});
