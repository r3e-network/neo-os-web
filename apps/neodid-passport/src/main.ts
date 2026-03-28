/**
 * NeoDID Passport — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the DID passport manager with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeodidPassport } from "./composables/useNeodidPassport";

defineMiniApp({
  appId: "miniapp-neodid-passport",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neodid-passport", {
      t: ctx.t as (key: string) => string,
    });

    const passport = useNeodidPassport({
      oracle: platformServices.oracle,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    ctx.registerAction("resolveDidDocument", async () => {
      try {
        await passport.resolveDidDocument();
        ctx.setStatus(ctx.t("resultLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("resolveFailed"), "error");
      }
    });

    ctx.registerAction("loadProviders", async () => {
      try {
        await passport.loadProviders();
        ctx.setStatus(ctx.t("providersLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("loadProvidersFailed"), "error");
      }
    });

    ctx.registerAction("fetchOracleKey", async () => {
      try {
        await passport.fetchOracleKey();
        ctx.setStatus(ctx.t("keyLoaded"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("keyFailed"), "error");
      }
    });

    ctx.registerAction("storeRef", async () => {
      try {
        await passport.storeRef();
        ctx.setStatus(ctx.t("refStored"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("storeFailed"), "error");
      }
    });

    ctx.registerAction("openIdentityCredentialDraft", async () => {
      try {
        passport.openIdentityCredentialDraft();
        ctx.setStatus(ctx.t("identityCredentialReady"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("resolveFailed"), "error");
      }
    });

    ctx.registerAction("copyIdentityCredentialLink", async () => {
      try {
        await passport.copyIdentityCredentialLink();
        ctx.setStatus(ctx.t("identityCredentialCopied"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("resolveFailed"), "error");
      }
    });

    ctx.registerAction("shareIdentityCredentialLink", async () => {
      try {
        await passport.shareIdentityCredentialLink();
        ctx.setStatus(ctx.t("identityCredentialShared"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("resolveFailed"), "error");
      }
    });

    return {
      state: {
        did: passport.did,
        format: passport.normalizedFormat,
        secretName: passport.secretName,
        credentialRecipient: passport.credentialRecipient,
        credentialTemplateId: passport.credentialTemplateId,
        ciphertext: passport.ciphertext,
        providerCount: passport.providerCount,
        renderedPayload: passport.renderedPayload,
        isRequesting: passport.isRequesting,
        oracleHash: passport.oracleHash,
        networkDisplay: passport.networkDisplay,
        publicApiUrl: passport.publicApiUrl,
        neodidDomain: passport.neodidDomain,
        neodidContract: passport.neodidContract,
      },
      loadData: passport.loadAll,
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
