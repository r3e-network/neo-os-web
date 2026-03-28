/**
 * Oracle Seal Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the confidential sealing console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSealConsole } from "./composables/useSealConsole";

defineMiniApp({
  appId: "miniapp-oracle-seal-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-oracle-seal-console", {
      t: ctx.t as (key: string) => string,
    });

    const { notify } = platformServices;

    const seal = useSealConsole({
      oracle: platformServices.oracle,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    ctx.registerAction("loadKey", async () => {
      await notify.guard(() => seal.loadKey(), "loaded");
    });

    ctx.registerAction("sealPayload", async () => {
      await notify.guard(() => seal.sealPayload(), "sealed");
    });

    ctx.registerAction("storeCiphertextRef", async () => {
      await notify.guard(() => seal.storeCiphertextRef(), "stored");
    });

    ctx.registerAction("copyText", async (value: string, key: string) => {
      await seal.copyText(value, key as "cipher" | "wrapper" | "ref");
    });

    ctx.registerAction("setInputMode", (mode: string) => {
      seal.inputMode.value = mode as "json" | "text";
    });

    ctx.registerAction("setFieldName", (name: string) => {
      seal.fieldName.value = name as "encrypted_payload" | "encrypted_params" | "encrypted_token";
    });

    ctx.registerAction("updateConfidentialInput", (val: string) => {
      seal.confidentialInput.value = val;
    });

    ctx.registerAction("updateStorageName", (val: string) => {
      seal.storageName.value = val;
    });

    ctx.registerAction("updateProjectSlug", (val: string) => {
      seal.projectSlug.value = val;
    });

    ctx.registerAction("updateBoundRequester", (val: string) => {
      seal.boundRequester.value = val;
    });

    ctx.registerAction("updateBoundCallbackContract", (val: string) => {
      seal.boundCallbackContract.value = val;
    });

    return {
      state: {
        keyMeta: seal.keyMeta,
        inputMode: seal.inputMode,
        fieldName: seal.fieldName,
        confidentialInput: seal.confidentialInput,
        ciphertext: seal.ciphertext,
        isLoadingKey: seal.isLoadingKey,
        isSealing: seal.isSealing,
        isStoring: seal.isStoring,
        copiedKey: seal.copiedKey,
        storageName: seal.storageName,
        projectSlug: seal.projectSlug,
        boundRequester: seal.boundRequester,
        boundCallbackContract: seal.boundCallbackContract,
        storedRef: seal.storedRef,
        canSeal: seal.canSeal,
        canStoreRef: seal.canStoreRef,
        wrapperJson: seal.wrapperJson,
        refWrapperJson: seal.refWrapperJson,
        modeDisplay: seal.modeDisplay,
        fieldDisplay: seal.fieldDisplay,
        algorithmDisplay: seal.algorithmDisplay,
        networkDisplay: seal.networkDisplay,
        contractDisplay: seal.contractDisplay,
        sourceDisplay: seal.sourceDisplay,
        isRequesting: seal.isRequesting,
      },
      loadData: seal.loadAll,
      cleanup: () => {
        seal.cleanup();
        platformServices.destroy();
      },
    };
  },
});
