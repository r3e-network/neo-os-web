/**
 * useComputeLab -- Domain logic for Oracle Compute Lab
 *
 * Receives OracleService + EventBus from PlatformServices instead of
 * using Vue composables directly. No onMounted/onUnmounted -- lifecycle
 * is managed by defineMiniApp.
 */

import { ref, computed } from "vue";
import type { OracleService, EventBus } from "@shared/services";

export interface UseComputeLabOptions {
  oracle: OracleService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useComputeLab({ oracle, eventBus, t }: UseComputeLabOptions) {
  const scriptName = ref("health_check");
  const inputJson = ref('{\n  "message": "hello from miniapp"\n}');
  const latestJob = ref<Record<string, unknown> | null>(null);
  const isRequesting = ref(false);

  const latestOutput = computed(() =>
    JSON.stringify(latestJob.value?.output ?? latestJob.value?.result ?? {}, null, 2),
  );

  const jobStatus = computed(() => latestJob.value?.status as string || t("notAvailable"));
  const computeUrl = ref("");
  const oracleHash = ref("");
  const computeType = ref(t("heroRegistered"));

  async function runJob() {
    try {
      isRequesting.value = true;
      const result = await oracle.executeRegisteredScript(
        scriptName.value,
        JSON.parse(inputJson.value),
      );
      latestJob.value = {
        status: "completed",
        job_id: result.jobId || t("notAvailable"),
        attestation: result.attestation || t("notAvailable"),
        output: result.output,
        result: result.raw,
      };
      return { success: true };
    } catch (e: unknown) {
      throw e;
    } finally {
      isRequesting.value = false;
    }
  }

  const loadAll = async () => {
    // No initial data to load for compute lab
  };

  return {
    // State
    scriptName,
    inputJson,
    latestJob,
    latestOutput,
    isRequesting,
    jobStatus,
    computeUrl,
    oracleHash,
    computeType,

    // Actions
    runJob,
    loadAll,
  };
}

export type UseComputeLabReturn = ReturnType<typeof useComputeLab>;
