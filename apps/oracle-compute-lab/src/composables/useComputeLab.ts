/**
 * useComputeLab -- Domain logic for Oracle Compute Lab
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService, EventBus } from "@shared/services";

export interface UseComputeLabOptions {
  oracle: OracleService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useComputeLab({ oracle, eventBus, t }: UseComputeLabOptions) {
  const scriptName = createObservable("health_check");
  const inputJson = createObservable('{\n  "message": "hello from miniapp"\n}');
  const latestJob = createObservable<Record<string, unknown> | null>(null);
  const isRequesting = createObservable(false);

  const latestOutput: Observable<string> = {
    get: () => JSON.stringify(latestJob.get()?.output ?? latestJob.get()?.result ?? {}, null, 2),
    set: () => {},
    subscribe: (fn) => latestJob.subscribe(fn),
  };

  const jobStatus: Observable<string> = {
    get: () => (latestJob.get()?.status as string) || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => latestJob.subscribe(fn),
  };

  const computeType = createObservable(t("heroRegistered"));

  async function runJob() {
    try {
      isRequesting.set(true);
      const result = await oracle.executeRegisteredScript(
        scriptName.get(),
        JSON.parse(inputJson.get()),
      );
      latestJob.set({
        status: "completed",
        job_id: result.jobId || t("notAvailable"),
        attestation: result.attestation || t("notAvailable"),
        output: result.output,
        result: result.raw,
      });
      return { success: true };
    } catch (e) {
      throw e;
    } finally {
      isRequesting.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    scriptName,
    inputJson,
    latestJob,
    latestOutput,
    isRequesting,
    jobStatus,
    computeType,
    runJob,
    loadAll,
  };
}

export type UseComputeLabReturn = ReturnType<typeof useComputeLab>;
