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

    // Render a payload field, treating only undefined/null as "missing" so a
    // legitimate 0 (e.g. timelock=0 / threshold=0) is shown as "0" instead of
    // being masked as "Not available" by a falsy `||` fallback.
    const payloadField = (key: string): string => {
      const v = latestPayload.get()?.[key];
      return v === undefined || v === null ? ctx.t("notAvailable") : String(v);
    };

    const accountId: Observable<string> = {
      get: () => payloadField("account_id"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const verifierHash: Observable<string> = {
      get: () => payloadField("verifier_hash"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const threshold: Observable<string> = {
      get: () => payloadField("threshold"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const timelock: Observable<string> = {
      get: () => payloadField("timelock"),
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

    ctx.registerAction("setField", async (field: unknown, value: unknown) => {
      const r = fieldRefs[String(field)];
      if (r) r.set(String(value ?? ""));
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
        ctx.services.notify.success("queryLoaded");
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
    const copyText = async (text: string): Promise<void> => {
      await navigator.clipboard?.writeText(text);
    };
    const registerLinkActions = (
      prefix: string,
      urlRef: Observable<string>,
      keys: { copied: string; shared: string },
    ) => {
      ctx.registerAction(`open${prefix}`, async () => {
        const u = urlRef.get();
        if (u) openExternal(u);
      });
      ctx.registerAction(`copy${prefix}`, async () => {
        const u = urlRef.get();
        if (!u) return;
        try {
          await copyText(u);
          ctx.services.notify.success(keys.copied);
        } catch (e) {
          ctx.services.notify.error(e, ctx.t("clipboardFailed"));
        }
      });
      ctx.registerAction(`share${prefix}`, async () => {
        const u = urlRef.get();
        if (!u) return;
        const nav = typeof navigator !== "undefined" ? navigator : undefined;
        try {
          if (nav?.share) {
            await nav.share({ url: u });
            ctx.services.notify.success(keys.shared);
          } else {
            // No Web Share API: fall back to clipboard but report it as a copy.
            await copyText(u);
            ctx.services.notify.success(keys.copied);
          }
        } catch (e) {
          // A user-cancelled share rejects with an AbortError — stay silent for
          // that, surface anything else (e.g. clipboard fallback failure).
          if (e instanceof Error && e.name === "AbortError") return;
          ctx.services.notify.error(e, ctx.t("clipboardFailed"));
        }
      });
    };
    registerLinkActions("RecoveryPreviewLink", previewUrl, {
      copied: "previewLinkCopied",
      shared: "previewLinkShared",
    });
    registerLinkActions("RecoveryCredentialLink", credentialUrl, {
      copied: "credentialLinkCopied",
      shared: "credentialLinkShared",
    });

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
