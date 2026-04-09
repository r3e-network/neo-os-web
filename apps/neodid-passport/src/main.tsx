/**
 * NeoDID Passport — Entry Point (React)
 *
 * Uses defineMiniApp() to wire the DID passport manager with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeodidPassport } from "./composables/useNeodidPassport";

defineMiniApp({
  appId: "miniapp-neodid-passport",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const passport = useNeodidPassport({
      oracle: platformServices.oracle,
      clipboard: platformServices.clipboard,
      t: ctx.t,
    });

    registerActions(ctx, {
      resolveDidDocument: {
        handler: () => passport.resolveDidDocument(),
        successKey: "resultLoaded",
        errorKey: "resolveFailed",
      },
      loadProviders: {
        handler: () => passport.loadProviders(),
        successKey: "providersLoaded",
        errorKey: "loadProvidersFailed",
      },
      fetchOracleKey: {
        handler: () => passport.fetchOracleKey(),
        successKey: "keyLoaded",
        errorKey: "keyFailed",
      },
      storeRef: {
        handler: () => passport.storeRef(),
        successKey: "refStored",
        errorKey: "storeFailed",
      },
      openIdentityCredentialDraft: {
        handler: async () => passport.openIdentityCredentialDraft(),
        successKey: "identityCredentialReady",
        errorKey: "resolveFailed",
      },
      copyIdentityCredentialLink: {
        handler: () => passport.copyIdentityCredentialLink(),
        successKey: "identityCredentialCopied",
        errorKey: "resolveFailed",
      },
      shareIdentityCredentialLink: {
        handler: () => passport.shareIdentityCredentialLink(),
        successKey: "identityCredentialShared",
        errorKey: "resolveFailed",
      },
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
    };
  },
});
