/**
 * Oracle HTTP Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the HTTP oracle console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useHttpConsole } from "./composables/useHttpConsole";

defineMiniApp({
  appId: "miniapp-oracle-http-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-oracle-http-console", {
      t: ctx.t as (key: string) => string,
    });

    const { notify } = platformServices;

    const httpConsole = useHttpConsole({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("runQuery", async () => {
      await notify.guard(() => httpConsole.runQuery(), "queryCompleted");
    });

    ctx.registerAction("updateField", (field: string, value: string) => {
      const fieldMap: Record<string, { value: string }> = {
        url: httpConsole.url,
        method: httpConsole.method,
        secretName: httpConsole.secretName,
        secretAsKey: httpConsole.secretAsKey,
        body: httpConsole.body,
      };
      if (fieldMap[field]) fieldMap[field].value = value;
    });

    return {
      state: {
        url: httpConsole.url,
        method: httpConsole.method,
        secretName: httpConsole.secretName,
        secretAsKey: httpConsole.secretAsKey,
        body: httpConsole.body,
        response: httpConsole.response,
        responseHeaders: httpConsole.responseHeaders,
        responseBody: httpConsole.responseBody,
        isRequesting: httpConsole.isRequesting,
        methodDisplay: httpConsole.methodDisplay,
        statusCode: httpConsole.statusCode,
        oracleHash: httpConsole.oracleHash,
        networkDisplay: httpConsole.networkDisplay,
        publicApiUrl: httpConsole.publicApiUrl,
      },
      loadData: httpConsole.loadAll,
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
