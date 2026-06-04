/**
 * recovery-guardian — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import { getExternalIntegrationConfig, getNetwork } from "@shared/constants/rpc";
import { deriveAAAccountIdHash } from "@shared/utils/aa-account";
import { parseInvokeResult } from "@shared/utils/neo";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  isAccountLocator,
  isOptionalTemplateId,
  isRecoveryExpiryMinutes,
} from "./utils/validation";

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
    const backupOwnerState: Observable<string> = {
      get: () => payloadField("backup_owner"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const checkedAt: Observable<string> = {
      get: () => payloadField("checked_at"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };

    const previewUrl: Observable<string> = {
      get: () => {
        const account = accountAddress.get();
        const newOwner = recoveryNewOwner.get();
        const expiry = recoveryExpiryMinutes.get();
        const template = recoveryTemplateId.get().trim();
        if (
          !isAccountLocator(account) ||
          !isAccountLocator(newOwner) ||
          !isRecoveryExpiryMinutes(expiry) ||
          !isOptionalTemplateId(template)
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
        if (template) {
          params.set("template", template);
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
        const template = recoveryTemplateId.get().trim();
        if (
          !isAccountLocator(account) ||
          !isAccountLocator(newOwner) ||
          !isRecoveryExpiryMinutes(expiry) ||
          !isOptionalTemplateId(template)
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
        if (template) {
          params.set("template", template);
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

    // Resolve the live AA core contract for the selected network once. The
    // recovery "guardian state" is the AA core verifier/backup-owner binding
    // for an account, queried with the same getters AA Account Lab uses.
    const integration = getExternalIntegrationConfig(getNetwork());
    const aaCore = integration.contracts.aaCore;
    const socialRecoveryVerifier =
      integration.contracts.aaSocialRecoveryVerifier || "";

    // Normalise a verifier/owner stack value: contract returns "" or the zero
    // script hash for "unset" — treat both as missing so the UI shows a clean
    // placeholder rather than 0x000…0.
    const ZERO_HASH = "0x0000000000000000000000000000000000000000";
    const normalizeReadHash = (value: unknown): string | null => {
      const parsed = parseInvokeResult(value);
      if (parsed === null || parsed === undefined) return null;
      const text = String(parsed).trim();
      if (!text || text.toLowerCase() === ZERO_HASH) return null;
      return text;
    };

    ctx.registerAction("queryGuardianState", async () => {
      const locator = accountAddress.get().trim();
      if (!isAccountLocator(locator)) return;
      isQuerying.set(true);
      try {
        // 1) Derive the AA account-id hash from the locator (accepts a Neo
        //    address, a bare/0x Hash160, or a seed) and read live chain state.
        const accountIdHash = deriveAAAccountIdHash(locator);
        const accountId = `0x${accountIdHash}`;

        const [verifierResult, backupOwnerResult] = await Promise.all([
          ctx.services.chain.read(
            "getVerifier",
            [{ type: "Hash160", value: accountId }],
            { scriptHash: aaCore },
          ),
          ctx.services.chain.read(
            "getBackupOwner",
            [{ type: "Hash160", value: accountId }],
            { scriptHash: aaCore },
          ),
        ]);

        const verifier = normalizeReadHash(verifierResult);
        const backupOwner = normalizeReadHash(backupOwnerResult);

        // 2) Merge any locally-cached snapshot (e.g. threshold/timelock written
        //    by a prior recovery flow) underneath the freshly-read chain values,
        //    so live data always wins but cached extras still surface.
        let cached: Record<string, unknown> = {};
        try {
          const stored = await ctx.os.storage.get(`guardian:${accountIdHash}`);
          if (stored != null) {
            const parsedStore =
              typeof stored === "object"
                ? (stored as Record<string, unknown>)
                : JSON.parse(String(stored));
            if (parsedStore && typeof parsedStore === "object") {
              cached = parsedStore as Record<string, unknown>;
            }
          }
        } catch {
          // A malformed/absent cache must not block the live read.
        }

        const payload: Record<string, unknown> = {
          ...cached,
          account_id: accountId,
          verifier_hash: verifier ?? (socialRecoveryVerifier || null),
          backup_owner: backupOwner,
          checked_at: new Date().toISOString(),
        };

        latestPayload.set(payload);

        // 3) Persist the fresh snapshot so the cache stays in sync with chain.
        try {
          await ctx.os.storage.set(`guardian:${accountIdHash}`, payload);
        } catch {
          // Storage is a best-effort cache layer; ignore write failures.
        }

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
        backupOwnerState,
        checkedAt,
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
