/**
 * recovery-guardian — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { isAccountLocator, isRecoveryExpiryMinutes } from "./utils/validation";

defineMiniApp({
  appId: "miniapp-recovery-guardian",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const latestPayload = createObservable<Record<string, unknown> | null>(
      null,
    );
    const isLoading = createObservable(false);
    const isQuerying = createObservable(false);

    // Form fields
    const accountAddress = createObservable("");
    const verifierHashOverride = createObservable("");
    const recoveryNewOwner = createObservable("");
    const recoveryExpiryMinutes = createObservable("30");
    const recoveryTemplateId = createObservable("");

    const renderedPayload: Observable<string> = {
      get: () => {
        const p = latestPayload.get();
        return p ? JSON.stringify(p, null, 2) : ctx.t("notAvailable");
      },
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };

    const hasPayload: Observable<boolean> = {
      get: () => latestPayload.get() !== null,
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };

    const accountId: Observable<string> = {
      get: () =>
        String(latestPayload.get()?.account_id || ctx.t("notAvailable")),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const verifierHash: Observable<string> = {
      get: () =>
        String(latestPayload.get()?.verifier_hash || ctx.t("notAvailable")),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const threshold: Observable<string> = {
      get: () =>
        String(latestPayload.get()?.threshold || ctx.t("notAvailable")),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const timelock: Observable<string> = {
      get: () => String(latestPayload.get()?.timelock || ctx.t("notAvailable")),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };

    const previewUrl: Observable<string> = {
      get: () => {
        const account = accountAddress.get();
        const newOwner = recoveryNewOwner.get();
        const expiry = recoveryExpiryMinutes.get();
        if (
          !isAccountLocator(account) ||
          !isAccountLocator(newOwner) ||
          !isRecoveryExpiryMinutes(expiry)
        ) {
          return "";
        }
        const params = new URLSearchParams({
          account,
          newOwner,
          expiryMinutes: expiry,
        });
        if (verifierHashOverride.get()) {
          params.set("verifier", verifierHashOverride.get());
        }
        if (recoveryTemplateId.get()) {
          params.set("template", recoveryTemplateId.get());
        }
        return `https://neo-recovery.app/preview?${params.toString()}`;
      },
      set: () => {},
      subscribe: (listener) => {
        const unsubscribeAccount = accountAddress.subscribe(listener);
        const unsubscribeOwner = recoveryNewOwner.subscribe(listener);
        const unsubscribeExpiry = recoveryExpiryMinutes.subscribe(listener);
        const unsubscribeVerifier = verifierHashOverride.subscribe(listener);
        const unsubscribeTemplate = recoveryTemplateId.subscribe(listener);
        return () => {
          unsubscribeAccount();
          unsubscribeOwner();
          unsubscribeExpiry();
          unsubscribeVerifier();
          unsubscribeTemplate();
        };
      },
    };

    const credentialUrl: Observable<string> = {
      get: () => {
        const account = accountAddress.get();
        const newOwner = recoveryNewOwner.get();
        const expiry = recoveryExpiryMinutes.get();
        if (
          !isAccountLocator(account) ||
          !isAccountLocator(newOwner) ||
          !isRecoveryExpiryMinutes(expiry)
        ) {
          return "";
        }
        const params = new URLSearchParams({
          account,
          newOwner,
          expiryMinutes: expiry,
          format: "credential",
        });
        if (verifierHashOverride.get()) {
          params.set("verifier", verifierHashOverride.get());
        }
        if (recoveryTemplateId.get()) {
          params.set("template", recoveryTemplateId.get());
        }
        return `https://neo-recovery.app/credential?${params.toString()}`;
      },
      set: () => {},
      subscribe: (listener) => {
        const unsubscribeAccount = accountAddress.subscribe(listener);
        const unsubscribeOwner = recoveryNewOwner.subscribe(listener);
        const unsubscribeExpiry = recoveryExpiryMinutes.subscribe(listener);
        const unsubscribeVerifier = verifierHashOverride.subscribe(listener);
        const unsubscribeTemplate = recoveryTemplateId.subscribe(listener);
        return () => {
          unsubscribeAccount();
          unsubscribeOwner();
          unsubscribeExpiry();
          unsubscribeVerifier();
          unsubscribeTemplate();
        };
      },
    };

    // ── Actions ───────────────────────────────────────────────────────

    const fieldRefs: Record<string, Observable<string>> = {
      accountAddress,
      verifierHashOverride,
      recoveryNewOwner,
      recoveryExpiryMinutes,
      recoveryTemplateId,
    };

    ctx.registerAction("setField", (field: string, value: string) => {
      const r = fieldRefs[field];
      if (r) r.set(value);
    });

    ctx.registerAction("queryGuardianState", async () => {
      if (!accountAddress.get()) return;
      isQuerying.set(true);
      try {
        const result = await ctx.os.storage.get(
          `guardian:${accountAddress.get()}`,
        );
        latestPayload.set(
          result == null
            ? null
            : typeof result === "object"
              ? (result as Record<string, unknown>)
              : JSON.parse(String(result)),
        );
      } catch (e) {
        ctx.services.notify.error(e, ctx.t("queryFailed"));
      } finally {
        isQuerying.set(false);
      }
    });

    const openExternal = (url: string) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };
    const copyText = (text: string) => {
      navigator.clipboard?.writeText(text).catch((e: unknown) => {
        console.warn(
          "[recovery-guardian] clipboard write failed:",
          e instanceof Error ? e.message : String(e),
        );
      });
    };
    const registerLinkActions = (
      prefix: string,
      urlRef: Observable<string>,
    ) => {
      ctx.registerAction(`open${prefix}`, async () => {
        const u = urlRef.get();
        if (u) openExternal(u);
      });
      ctx.registerAction(`copy${prefix}`, async () => {
        const u = urlRef.get();
        if (u) copyText(u);
      });
      ctx.registerAction(`share${prefix}`, async () => {
        const u = urlRef.get();
        if (u) copyText(u);
      });
    };
    registerLinkActions("RecoveryPreviewLink", previewUrl);
    registerLinkActions("RecoveryCredentialLink", credentialUrl);

    ctx.registerAction("openIdentityWorkspace", async () => {
      openExternal("https://neo-identity.app/workspace");
    });
    ctx.registerAction("openAaWorkspace", async () => {
      openExternal("https://neo-aa.app/workspace");
    });
    ctx.registerAction("openRecoveryDocs", async () => {
      openExternal("https://docs.neo.org/recovery-guardian");
    });

    return {
      state: {
        renderedPayload,
        isLoading,
        isQuerying,
        latestPayload,
        hasPayload,
        accountId,
        verifierHash,
        threshold,
        timelock,
        previewUrl,
        credentialUrl,
        accountAddress,
        verifierHashOverride,
        recoveryNewOwner,
        recoveryExpiryMinutes,
        recoveryTemplateId,
        availableActions: createObservable<unknown[]>([]),
      },
      loadData: async () => {},
    };
  },
});
