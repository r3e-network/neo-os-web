/**
 * Oracle HTTP Console — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useHttpConsole } from "./composables/useHttpConsole";

defineMiniApp({
  appId: "miniapp-oracle-http-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const httpConsole = useHttpConsole({
      oracle: ctx.services.oracle,
      t: ctx.t,
    });

    ctx.registerAction("runQuery", async () => {
      await ctx.services.notify.guard(() => httpConsole.runQuery(), "queryCompleted");
    });

    ctx.registerAction("updateField", async (field: unknown, value: unknown) => {
      const fieldMap: Record<string, { set: (v: string) => void }> = {
        url: httpConsole.url,
        method: httpConsole.method,
        secretName: httpConsole.secretName,
        secretAsKey: httpConsole.secretAsKey,
        body: httpConsole.body,
      };
      if (fieldMap[String(field)]) fieldMap[String(field)].set(String(value));
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
    };
  },
});
