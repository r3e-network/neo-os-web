import { createObservable } from "@shared/react/context";
import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  useAAPermissionsLab,
  type PermissionWriteOutcome,
} from "./composables/useAAPermissionsLab";
import { getPermissionsLaunchDefaults } from "./launch";
import { normalizePermissionNetwork } from "./permissions";

function writeSuccessKey(outcome: PermissionWriteOutcome) {
  if (outcome.operation === "install-verifier") return "verifierInstalled";
  if (outcome.operation === "install-hook") return "hookInstalled";
  if (outcome.operation === "propose-verifier") return "verifierProposed";
  if (outcome.operation === "propose-hook") return "hookProposed";
  if (outcome.operation === "confirm-verifier") return "verifierConfirmed";
  if (outcome.operation === "confirm-hook") return "hookConfirmed";
  if (outcome.operation === "cancel-verifier") return "verifierCancelled";
  return "hookCancelled";
}

defineMiniApp({
  appId: "miniapp-aa-permissions-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const network = normalizePermissionNetwork(ctx.launchContext.network);
    const launchForm = getPermissionsLaunchDefaults(ctx.launchContext);
    const lab = useAAPermissionsLab({
      app: ctx.framework,
      network,
      t: ctx.t,
    });

    lab.form.accountIdHash = launchForm.accountIdHash;
    lab.form.verifierHash = launchForm.verifierHash;
    lab.form.verifierParamsHex = launchForm.verifierParamsHex;
    lab.form.hookHash = launchForm.hookHash;

    const setAccount = (value: unknown) => {
      lab.form.accountIdHash = String(value ?? "").trim();
    };

    const localizePermissionError = (error: unknown) => {
      const raw = error instanceof Error ? error.message : String(error ?? "");
      const key = raw.startsWith("permissionReadInvalid:")
        ? "permissionReadInvalid"
        : /^[a-z][a-zA-Z]+$/.test(raw)
          ? raw
          : "";
      if (!key) return error;
      const translated = ctx.t(key);
      return new Error(translated === key ? ctx.t("permissionOperationFailed") : translated);
    };

    const guardAction = async <T,>(work: () => Promise<T>, errorKey: string) => {
      try {
        return { ok: true as const, value: await work() };
      } catch (error) {
        ctx.framework.notify.error(localizePermissionError(error), errorKey);
        return { ok: false as const, error };
      }
    };

    const runWrite = async (work: () => Promise<PermissionWriteOutcome>) => {
      const result = await guardAction(work, "permissionOperationFailed");
      if (!result.ok) return null;
      if (result.value.confirmed) {
        ctx.framework.notify.success(writeSuccessKey(result.value));
      } else {
        ctx.framework.notify.info("transactionAwaitingConfirmation");
      }
      return result.value;
    };

    ctx.framework.actions.register("inspectBinding", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      const result = await guardAction(
        () => lab.refreshState(),
        "inspectFailed",
      );
      if (result.ok && result.value) ctx.framework.notify.success("inspectComplete");
      return result.ok ? result.value : null;
    });

    ctx.framework.actions.register(
      "submitVerifier",
      async (accountIdHash: unknown, verifierHash: unknown, verifierParamsHex: unknown) => {
        setAccount(accountIdHash);
        lab.form.verifierHash = String(verifierHash ?? "").trim();
        lab.form.verifierParamsHex = String(verifierParamsHex ?? "").trim();
        return runWrite(() => lab.submitVerifier());
      },
    );

    ctx.framework.actions.register(
      "submitHook",
      async (accountIdHash: unknown, hookHash: unknown) => {
        setAccount(accountIdHash);
        lab.form.hookHash = String(hookHash ?? "").trim();
        return runWrite(() => lab.submitHook());
      },
    );

    ctx.framework.actions.register("confirmVerifier", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      return runWrite(() => lab.confirmVerifier());
    });
    ctx.framework.actions.register("cancelVerifier", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      return runWrite(() => lab.cancelVerifier());
    });
    ctx.framework.actions.register("confirmHook", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      return runWrite(() => lab.confirmHook());
    });
    ctx.framework.actions.register("cancelHook", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      return runWrite(() => lab.cancelHook());
    });

    ctx.framework.actions.register("reconcileTransaction", async () => {
      const result = await guardAction(
        () => lab.reconcilePendingTransaction(),
        "transactionRecoveryFailed",
      );
      if (!result.ok) return null;
      if (result.value) ctx.framework.notify.success("transactionRecovered");
      else if (!lab.pendingTransaction.get()) {
        ctx.framework.notify.error(new Error(ctx.t("transactionFaulted")));
      } else {
        ctx.framework.notify.info("transactionAwaitingConfirmation");
      }
      return result.value;
    });

    ctx.framework.actions.register("checkWalletAuthority", async (accountIdHash: unknown) => {
      setAccount(accountIdHash);
      const result = await guardAction(
        () => lab.checkWalletAuthority(),
        "walletAuthorityFailed",
      );
      if (result.ok && result.value) ctx.framework.notify.success("walletAuthorityConfirmed");
      return result.ok ? result.value : false;
    });

    ctx.framework.actions.register("invalidateBinding", async () => {
      lab.invalidateBinding();
      return true;
    });

    ctx.framework.actions.register("connect", async () => {
      return ctx.framework.notify.guard(
        () => ctx.framework.wallet.ensure(),
        { successKey: "walletConnected", errorKey: "connectFailed" },
      );
    });

    return {
      state: {
        network: createObservable(network),
        aaCore: createObservable(lab.aaCore),
        launchForm: createObservable(launchForm),
        currentVerifier: lab.currentVerifier,
        currentHook: lab.currentHook,
        currentBackupOwner: lab.currentBackupOwner,
        // Chrome read-outs: the same bindings, able to say "not inspected" and
        // "none bound" apart instead of rendering a blank tile for both.
        currentVerifierDisplay: lab.currentVerifierDisplay,
        currentHookDisplay: lab.currentHookDisplay,
        currentBackupOwnerDisplay: lab.currentBackupOwnerDisplay,
        inspectedAccountId: lab.inspectedAccountId,
        permissionSnapshot: lab.permissionSnapshot,
        hasInspected: lab.hasInspected,
        hasPendingVerifier: lab.hasPendingVerifier,
        hasPendingHook: lab.hasPendingHook,
        pendingVerifierUnlockAt: lab.pendingVerifierUnlockAt,
        pendingHookUnlockAt: lab.pendingHookUnlockAt,
        proposalVerifier: lab.proposalVerifier,
        proposalHook: lab.proposalHook,
        connectedWalletDisplay: lab.connectedWalletDisplay,
        walletNetwork: lab.walletNetwork,
        walletNetworkMatches: lab.walletNetworkMatches,
        isRefreshing: lab.isRefreshing,
        isVerifierBusy: lab.isVerifierBusy,
        isHookBusy: lab.isHookBusy,
        isRecovering: lab.isRecovering,
        isCheckingWallet: lab.isCheckingWallet,
        readError: lab.readError,
        lastWriteStatus: lab.lastWriteStatus,
        pendingTransaction: lab.pendingTransaction,
        pendingTxid: lab.pendingTxid,
        storageHealthy: lab.storageHealthy,
      },
      loadData: lab.loadAll,
      cleanup: lab.dispose,
    };
  },
});
