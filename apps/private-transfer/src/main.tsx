import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, manifest, messages } from "./appConfig";
import { appendSealedIntent, readSealedIntents } from "./history";
import {
  normalizePrivateTransferErrorKey,
  preparePrivateTransfer,
} from "./seal";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy storage namespace: the pre-framework sealed-intents log lived at
  // "miniapp-private-transfer:sealed-intents:v1", so pin app.storage.local to
  // the same "miniapp-private-transfer:" prefix (no orphaned history).
  storagePrefix: "miniapp-private-transfer:",
  setup(ctx) {
    const privacyMode = createObservable(ctx.t("privacyModeLabel"));
    const networkLabel = createObservable(ctx.t("networkTestnet"));
    const lastStatus = createObservable(ctx.t("statusInitial"));
    const lastDigest = createObservable(ctx.t("digestPlaceholder"));
    const lastSecretRef = createObservable("");
    const lastNullifier = createObservable("");
    const isSealing = createObservable(false);
    const requestCount = createObservable(0);

    ctx.framework.actions.register("prepareTransfer", async (payload: unknown) => {
      const form = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const recipient = String(form.recipient || "").trim();
      const amount = String(form.amount || "").trim();
      const assetInput = String(form.asset || "GAS").trim().toUpperCase();
      const asset = assetInput === "NEO" ? "NEO" : "GAS";
      const memo = String(form.memo || "").trim();
      isSealing.set(true);
      lastStatus.set(ctx.t("statusSealingShort"));
      try {
        const sealed = await preparePrivateTransfer({
          appId,
          network: "testnet",
          recipient,
          amount,
          asset,
          memo,
          seal: ctx.framework.oracle.seal,
        });
        const next = appendSealedIntent(ctx.framework.storage.local, {
          secretRef: sealed.secretRef,
          commitment: sealed.commitment,
          nullifier: sealed.nullifier,
          network: sealed.network,
          asset: sealed.asset,
          ts: Date.now(),
        });
        requestCount.set(next.length);
        lastDigest.set(sealed.commitment);
        lastSecretRef.set(sealed.secretRef);
        lastNullifier.set(sealed.nullifier);
        lastStatus.set(ctx.t("statusSealed"));
        ctx.setStatus(ctx.t("statusSealedToast"), "success");
        return sealed;
      } catch (error) {
        const key = normalizePrivateTransferErrorKey(error);
        const message = key === "errorMissingInputs" ? ctx.t("errorMissingInputs") : ctx.t(key);
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw new Error(message);
      } finally {
        isSealing.set(false);
      }
    });

    return {
      state: {
        privacyMode,
        networkLabel,
        lastStatus,
        lastDigest,
        lastSecretRef,
        lastNullifier,
        isSealing,
        requestCount,
      },
      // Rehydrate the header stat tiles from the device-local sealed-intents log
      // so requestCount and the commitment digest survive a remount instead of
      // resetting to 0 / "—" every time the miniapp re-opens.
      loadData: async () => {
        const intents = readSealedIntents(ctx.framework.storage.local);
        const latest = intents[0];
        if (!latest) {
          return;
        }
        requestCount.set(intents.length);
        lastStatus.set(ctx.t("statusSealed"));
        lastDigest.set(latest.commitment);
        lastSecretRef.set(latest.secretRef);
        lastNullifier.set(latest.nullifier);
      },
    };
  },
});
