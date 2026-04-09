/**
 * Oracle Seal Console — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useSealConsole } from "./composables/useSealConsole";

defineMiniApp({
  appId: "miniapp-oracle-seal-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const seal = useSealConsole({
      oracle: ctx.services.oracle,
      clipboard: ctx.services.clipboard,
      t: ctx.t,
    });

    ctx.registerAction("loadKey", async () => {
      await ctx.services.notify.guard(() => seal.loadKey(), "loaded");
    });

    ctx.registerAction("sealPayload", async () => {
      await ctx.services.notify.guard(() => seal.sealPayload(), "sealed");
    });

    ctx.registerAction("storeCiphertextRef", async () => {
      await ctx.services.notify.guard(() => seal.storeCiphertextRef(), "stored");
    });

    ctx.registerAction("copyText", async (value: unknown, key: unknown) => {
      await seal.copyText(String(value), String(key) as "cipher" | "wrapper" | "ref");
    });

    ctx.registerAction("setInputMode", async (mode: unknown) => {
      seal.inputMode.set(String(mode) as "json" | "text");
    });

    ctx.registerAction("setFieldName", async (name: unknown) => {
      seal.fieldName.set(String(name) as "encrypted_payload" | "encrypted_params" | "encrypted_token");
    });

    ctx.registerAction("updateConfidentialInput", async (val: unknown) => {
      seal.confidentialInput.set(String(val));
    });

    ctx.registerAction("updateStorageName", async (val: unknown) => {
      seal.storageName.set(String(val));
    });

    ctx.registerAction("updateProjectSlug", async (val: unknown) => {
      seal.projectSlug.set(String(val));
    });

    ctx.registerAction("updateBoundRequester", async (val: unknown) => {
      seal.boundRequester.set(String(val));
    });

    ctx.registerAction("updateBoundCallbackContract", async (val: unknown) => {
      seal.boundCallbackContract.set(String(val));
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
      },
    };
  },
});
