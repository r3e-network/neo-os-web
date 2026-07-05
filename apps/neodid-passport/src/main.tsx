import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  attachWalletSignature,
  buildPassportPayload,
  canonicalize,
  normalizeNetwork,
  normalizePassportForm,
  resolveDidDocument,
  shortHash,
  validatePassportForm,
  type PassportPayload,
} from "./passport";

const KNOWN_ERROR_KEYS = [
  "passportInvalidDid",
  "passportMissingClaim",
  "resolverFailed",
  "resolverUnavailable",
  "walletSignFailed",
];

function translateKnownError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const key = raw || "resolverFailed";
  if (KNOWN_ERROR_KEYS.includes(key)) {
    return t(key);
  }
  if (/failed to fetch|networkerror|load failed|404|not found/i.test(key)) {
    return t("resolverUnavailable");
  }
  // Never surface raw upstream text (e.g. "worker signer drift: no usable
  // worker signer configured") in the alert/status tiles — log it for support
  // and show a stable, localized fallback instead.
  if (raw) {
    console.warn("[neodid-passport] resolver error:", raw);
  }
  return t("resolverFailed");
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const network = normalizeNetwork(ctx.launchContext.network);
    const state = {
      networkLabel: createObservable(network === "mainnet" ? "Morpheus Mainnet" : appMeta.networkLabel),
      endpointLabel: createObservable(appMeta.endpointLabel),
      lastStatus: createObservable(ctx.t("statusReady")),
      lastDigest: createObservable(ctx.t("digestPlaceholder")),
      requestCount: createObservable(0),
      proofStatus: createObservable(ctx.t("notSignedStatus")),
      resolverStatus: createObservable(ctx.t("statusReady")),
      documentId: createObservable(ctx.t("digestPlaceholder")),
      documentVersion: createObservable(ctx.t("digestPlaceholder")),
      serviceCount: createObservable(0),
      passportPayload: createObservable<PassportPayload | null>(null),
      lastError: createObservable(""),
      isResolving: createObservable(false),
      isSigning: createObservable(false),
    };

    function resetState() {
      state.lastStatus.set(ctx.t("statusReady"));
      state.lastDigest.set(ctx.t("digestPlaceholder"));
      state.proofStatus.set(ctx.t("notSignedStatus"));
      state.resolverStatus.set(ctx.t("statusReady"));
      state.documentId.set(ctx.t("digestPlaceholder"));
      state.documentVersion.set(ctx.t("digestPlaceholder"));
      state.serviceCount.set(0);
      state.passportPayload.set(null);
      state.lastError.set("");
    }

    ctx.framework.actions.register("resetPassport", async () => {
      resetState();
      ctx.setStatus(ctx.t("statusReady"), "info");
    });

    ctx.framework.actions.register("buildPassport", async (formData: unknown) => {
      const form = normalizePassportForm(formData, ctx.launchContext.params);
      const validationKey = validatePassportForm(form);
      if (validationKey) {
        const message = ctx.t(validationKey);
        state.lastError.set(message);
        state.lastStatus.set(message);
        ctx.setStatus(message, "error");
        return null;
      }

      state.isResolving.set(true);
      state.lastError.set("");
      state.proofStatus.set(ctx.t("preparedStatus"));
      state.resolverStatus.set(ctx.t("statusReady"));

      try {
        const resolution = await resolveDidDocument(form, network);
        const payload = await buildPassportPayload(form, resolution, network);
        state.passportPayload.set(payload);
        state.lastStatus.set(ctx.t("passportReady"));
        state.lastDigest.set(shortHash(payload.digest));
        state.resolverStatus.set(ctx.t("resolvedStatus"));
        state.documentId.set(resolution.id);
        state.documentVersion.set(resolution.versionId);
        state.serviceCount.set(resolution.serviceTypes.length);
        state.requestCount.set(Number(state.requestCount.get() ?? 0) + 1);
        ctx.setStatus(ctx.t("passportReady"), "success");
        return payload;
      } catch (error) {
        const message = translateKnownError(error, ctx.t);
        state.lastError.set(message);
        state.lastStatus.set(message);
        state.resolverStatus.set(message);
        state.passportPayload.set(null);
        ctx.setStatus(message, "error");
        return null;
      } finally {
        state.isResolving.set(false);
      }
    });

    ctx.framework.actions.register("signPassport", async () => {
      const payload = state.passportPayload.get();
      if (!payload) {
        const message = ctx.t("passportNoPayload");
        state.lastError.set(message);
        ctx.setStatus(message, "error");
        return null;
      }
      if (payload.provider !== "wallet") {
        const message = ctx.t("passportNoWalletProvider");
        state.lastError.set(message);
        ctx.setStatus(message, "warning");
        return null;
      }

      state.isSigning.set(true);
      state.lastError.set("");

      try {
        const signed = await ctx.services.chain.signMessage(canonicalize(payload));
        const signedPayload = await attachWalletSignature(
          payload,
          signed,
          String(ctx.services.chain.address.get() ?? ""),
        );
        state.passportPayload.set(signedPayload);
        state.proofStatus.set(ctx.t("signedStatus"));
        state.lastStatus.set(ctx.t("passportSigned"));
        state.lastDigest.set(shortHash(signedPayload.digest));
        ctx.setStatus(ctx.t("passportSigned"), "success");
        return signedPayload;
      } catch (error) {
        const message = translateKnownError(error, ctx.t);
        state.lastError.set(message);
        state.lastStatus.set(message);
        ctx.setStatus(message, "error");
        return null;
      } finally {
        state.isSigning.set(false);
      }
    });

    return {
      state: {
        ...state,
      },
      loadData: async () => {},
    };
  },
});
