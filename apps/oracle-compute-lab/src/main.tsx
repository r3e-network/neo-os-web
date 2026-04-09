/**
 * Oracle Compute Lab — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useComputeLab } from "./composables/useComputeLab";

defineMiniApp({
  appId: "miniapp-oracle-compute-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const services = ctx.services;
    const computeLab = useComputeLab({
      oracle: services.oracle,
      eventBus: services.events,
      t: ctx.t,
    });

    ctx.registerAction("runJob", async () => {
      await services.notify.guard(
        () => computeLab.runJob(),
        "computeSubmitted",
        "executeFailed",
      );
    });

    ctx.registerAction("setScriptName", async (value: unknown) => {
      if (typeof value === "string") {
        computeLab.scriptName.set(value);
      }
    });

    ctx.registerAction("setInputJson", async (value: unknown) => {
      if (typeof value === "string") {
        computeLab.inputJson.set(value);
      }
    });

    const jobId: Observable<string> = {
      get: () => String(computeLab.latestJob.get()?.job_id ?? ctx.t("notAvailable")),
      set: () => {},
      subscribe: (fn) => computeLab.latestJob.subscribe(fn),
    };
    const attestation: Observable<string> = {
      get: () => String(computeLab.latestJob.get()?.attestation ?? ctx.t("notAvailable")),
      set: () => {},
      subscribe: (fn) => computeLab.latestJob.subscribe(fn),
    };
    const computeUrl: Observable<string> = {
      get: () => services.oracle.integration.morpheusPublicApiUrl ?? "",
      set: () => {},
      subscribe: () => () => {},
    };
    const oracleHash: Observable<string> = {
      get: () => services.oracle.integration.contracts.morpheusOracle ?? "",
      set: () => {},
      subscribe: () => () => {},
    };

    return {
      state: {
        scriptName: computeLab.scriptName,
        inputJson: computeLab.inputJson,
        latestOutput: computeLab.latestOutput,
        isRequesting: computeLab.isRequesting,
        jobStatus: computeLab.jobStatus,
        jobId,
        attestation,
        computeUrl,
        oracleHash,
        computeType: computeLab.computeType,
      },
      loadData: computeLab.loadAll,
    };
  },
});
