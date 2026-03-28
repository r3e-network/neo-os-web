/**
 * oracle-compute-lab — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire manifest, PlayArea, and domain logic
 * through the root-owned platform service registry.
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
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
        computeLab.scriptName.value = value;
      }
    });

    ctx.registerAction("setInputJson", async (value: unknown) => {
      if (typeof value === "string") {
        computeLab.inputJson.value = value;
      }
    });

    const jobId = computed(() =>
      String(computeLab.latestJob.value?.job_id ?? ctx.t("notAvailable")),
    );
    const attestation = computed(() =>
      String(computeLab.latestJob.value?.attestation ?? ctx.t("notAvailable")),
    );
    const computeUrl = computed(
      () => services.oracle.integration.morpheusPublicApiUrl ?? "",
    );
    const oracleHash = computed(
      () => services.oracle.integration.contracts.morpheusOracle ?? "",
    );

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
