/**
 * recovery-guardian — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import {
  getExternalIntegrationConfig,
  getNetwork,
  getAAIdentityWorkspaceUrl,
  getAAAppWorkspaceUrl,
  getAADocsUrl,
} from "@shared/constants/rpc";
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
        return p ? JSON.stringify(p, null, 2) : ctx.t("digestPlaceholder");
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
    // being masked as "Not available" by a falsy `||` fallback. Unpopulated
    // fields render the design-system em-dash, not an error-like "N/A".
    const payloadField = (key: string): string => {
      const v = latestPayload.get()?.[key];
      return v === undefined || v === null ? ctx.t("digestPlaceholder") : String(v);
    };

    const accountId: Observable<string> = {
      get: () => payloadField("account_id"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    // The verifier field shows the account's actual chain binding. When the
    // account has NO verifier bound, render an explicit "Not configured"
    // instead of a bare placeholder so an operator never reads an unset
    // verifier as a live one.
    const verifierHash: Observable<string> = {
      get: () => {
        const p = latestPayload.get();
        if (!p) return ctx.t("digestPlaceholder");
        const v = p.verifier_hash;
        return v === undefined || v === null
          ? ctx.t("verifierNotConfigured")
          : String(v);
      },
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    // The AA core does not expose a guardian threshold (that lives in the
    // verifier module). Repurpose this tile to the escape/recovery status the
    // core DOES track, so it carries real meaning instead of a permanent gap.
    const escapeStatus: Observable<string> = {
      get: () => payloadField("escape_status"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const timelock: Observable<string> = {
      get: () => {
        const p = latestPayload.get();
        const v = p?.timelock;
        if (v === undefined || v === null) return ctx.t("digestPlaceholder");
        const seconds = Number(v);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          return ctx.t("digestPlaceholder");
        }
        return ctx.t("timelockSeconds", { seconds });
      },
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
    const networkDefaultVerifier: Observable<string> = {
      get: () => payloadField("network_default_verifier"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };
    const escapeTriggeredAt: Observable<string> = {
      get: () => payloadField("escape_triggered_at"),
      set: () => {},
      subscribe: (listener) => latestPayload.subscribe(listener),
    };

    // The previous recovery host (neo-recovery.app) has no DNS record, so every
    // prepared link was a dead end. Build the recovery links on the live AA
    // identity workspace instead, carrying the recovery parameters as the view
    // query so guardians land on a real surface.
    const recoveryWorkspaceBase = getAAIdentityWorkspaceUrl(getNetwork());
    const buildRecoveryUrl = (
      view: "recovery-preview" | "recovery-credential",
    ): string => {
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
      const url = new URL(recoveryWorkspaceBase);
      url.searchParams.set("view", view);
      url.searchParams.set("account", account);
      url.searchParams.set("newOwner", newOwner);
      url.searchParams.set("expiryMinutes", expiry);
      if (verifierHashOverride.get()) {
        url.searchParams.set("verifier", verifierHashOverride.get());
      }
      if (template) {
        url.searchParams.set("template", template);
      }
      return url.toString();
    };

    const previewUrl: Observable<string> = {
      get: () => buildRecoveryUrl("recovery-preview"),
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
      get: () => buildRecoveryUrl("recovery-credential"),
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

    ctx.framework.actions.register("setField", async (field: unknown, value: unknown) => {
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

    ctx.framework.actions.register("queryGuardianState", async () => {
      const locator = accountAddress.get().trim();
      if (!isAccountLocator(locator)) return;
      isQuerying.set(true);
      try {
        // 1) Derive the AA account-id hash from the locator (accepts a Neo
        //    address, a bare/0x Hash160, or a seed) and read live chain state.
        const accountIdHash = deriveAAAccountIdHash(locator);
        const accountId = `0x${accountIdHash}`;

        // The AA core (UnifiedSmartWalletV3) exposes the recovery policy the
        // hero stats and state grid display: getEscapeTimelock is the recovery
        // timelock (seconds), and isEscapeActive / getEscapeTriggeredAt are the
        // live escape (recovery-ticket) lifecycle. Read them alongside the
        // verifier/backup-owner binding so timelock and escape status are
        // actually populated instead of staying "—".
        const [
          verifierResult,
          backupOwnerResult,
          escapeTimelockResult,
          escapeActiveResult,
          escapeTriggeredAtResult,
        ] = await Promise.all([
          ctx.framework.chain.read({
            operation: "getVerifier",
            args: [{ type: "Hash160", value: accountId }],
            scriptHash: aaCore,
          }),
          ctx.framework.chain.read({
            operation: "getBackupOwner",
            args: [{ type: "Hash160", value: accountId }],
            scriptHash: aaCore,
          }),
          ctx.framework.chain.read({
            operation: "getEscapeTimelock",
            args: [{ type: "Hash160", value: accountId }],
            scriptHash: aaCore,
          }),
          ctx.framework.chain.read({
            operation: "isEscapeActive",
            args: [{ type: "Hash160", value: accountId }],
            scriptHash: aaCore,
          }),
          ctx.framework.chain.read({
            operation: "getEscapeTriggeredAt",
            args: [{ type: "Hash160", value: accountId }],
            scriptHash: aaCore,
          }),
        ]);

        const verifier = normalizeReadHash(verifierResult);
        const backupOwner = normalizeReadHash(backupOwnerResult);
        const escapeTimelock = parseInvokeResult(escapeTimelockResult);
        const escapeActive = parseInvokeResult(escapeActiveResult);
        const escapeTriggeredAt = parseInvokeResult(escapeTriggeredAtResult);

        const escapeTimelockSeconds =
          escapeTimelock === null || escapeTimelock === undefined
            ? null
            : Number(escapeTimelock);
        const isEscapeOpen = Boolean(escapeActive);
        const triggeredAtSeconds = Number(escapeTriggeredAt ?? 0);

        const payload: Record<string, unknown> = {
          account_id: accountId,
          // Show the account's actual chain binding only — never the network's
          // default verifier — so an unset verifier reads as "Not configured"
          // in this security-critical console instead of masquerading as a
          // live binding.
          verifier_hash: verifier,
          backup_owner: backupOwner,
          timelock: escapeTimelockSeconds,
          escape_status: isEscapeOpen ? ctx.t("escapeActive") : ctx.t("escapeInactive"),
          escape_triggered_at:
            isEscapeOpen && triggeredAtSeconds > 0
              ? new Date(triggeredAtSeconds * 1000).toISOString()
              : null,
          // Surface the network's canonical verifier separately as an explicit
          // hint, never inside the Verifier state field.
          network_default_verifier: socialRecoveryVerifier || null,
          checked_at: new Date().toISOString(),
        };

        latestPayload.set(payload);

        // 3) Persist the fresh snapshot so the cache stays in sync with chain.
        try {
          await ctx.os.storage.set(`guardian:${accountIdHash}`, payload);
        } catch {
          // Storage is a best-effort cache layer; ignore write failures.
        }

        ctx.framework.notify.success("queryLoaded");
      } catch (e) {
        ctx.framework.notify.error(e, "queryFailed");
      } finally {
        isQuerying.set(false);
      }
    });

    const openExternal = (url: string) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };
    const registerLinkActions = (
      prefix: string,
      urlRef: Observable<string>,
      keys: { copied: string; shared: string },
    ) => {
      ctx.framework.actions.register(`open${prefix}`, async () => {
        const u = urlRef.get();
        if (u) openExternal(u);
      });
      ctx.framework.actions.register(`copy${prefix}`, async () => {
        const u = urlRef.get();
        if (!u) return;
        await ctx.framework.clipboard.copy(u, {
          successKey: keys.copied,
          errorKey: "clipboardFailed",
        });
      });
      // app.share prefers the native share sheet and falls back to a clipboard
      // copy (reported as a copy); a user-cancelled share rejects with an
      // AbortError and stays silent — the S9 semantics this app defined.
      ctx.framework.actions.register(`share${prefix}`, async () => {
        const u = urlRef.get();
        if (!u) return;
        await ctx.framework.share.url(u, {
          sharedKey: keys.shared,
          copiedKey: keys.copied,
          errorKey: "clipboardFailed",
        });
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

    // The neo-identity.app / neo-aa.app domains do not resolve and the generic
    // docs.neo.org/recovery-guardian path 301s to the docs index. Route to the
    // live AA frontend surfaces the README documents instead.
    ctx.framework.actions.register("openIdentityWorkspace", async () => {
      openExternal(getAAIdentityWorkspaceUrl(getNetwork()));
    });
    ctx.framework.actions.register("openAaWorkspace", async () => {
      openExternal(getAAAppWorkspaceUrl(getNetwork()));
    });
    ctx.framework.actions.register("openRecoveryDocs", async () => {
      openExternal(getAADocsUrl(getNetwork()));
    });

    return {
      state: {
        renderedPayload,
        isQuerying,
        latestPayload,
        hasPayload,
        accountId,
        verifierHash,
        escapeStatus,
        timelock,
        backupOwnerState,
        checkedAt,
        networkDefaultVerifier,
        escapeTriggeredAt,
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
