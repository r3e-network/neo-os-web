/**
 * useAAAccountLab -- Domain logic for AA Account Lab (OS Services)
 *
 * Uses createObservable instead of Vue ref/computed/reactive.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseInvokeResult,
} from "@shared/utils/neo";
import {
  deriveRegistrationAccountIdHash,
  AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS,
} from "@shared/utils/aa-account";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";

export interface UseAAAccountLabOptions {
  app: MiniAppFramework;
  storageService: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAAAccountLab({ app, storageService, t }: UseAAAccountLabOptions) {
  const network = getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const aaCore = integration.contracts.aaCore;
  const defaultVerifier = integration.contracts.aaWeb3AuthVerifier;

  // Form state (plain objects, not reactive -- mutations happen through actions)
  const inspectForm = { accountIdInput: "" };
  const registerForm = {
    accountIdInput: "",
    verifierHash: defaultVerifier,
    verifierParamsHex: "",
    hookHash: "",
    backupOwner: "",
    escapeTimelock: "2592000",
  };

  // Inspected state
  const currentVerifier = createObservable(t("notAvailable"));
  const currentHook = createObservable(t("notAvailable"));
  const currentBackupOwner = createObservable(t("notAvailable"));
  // Escape recovery posture (configured at registration). Read alongside the
  // bindings so the recovery window this app is about can actually be verified.
  const currentEscapeTimelock = createObservable(t("notAvailable"));
  const currentEscapeActive = createObservable(t("notAvailable"));
  // Explicit flag: true once a read has completed successfully, regardless of
  // whether the account has a verifier set. Distinguishes "not inspected yet"
  // from "inspected, verifier is empty".
  const hasInspected = createObservable(false);

  // Loading states
  const isInspecting = createObservable(false);
  const isSubmitting = createObservable(false);

  // Display values
  const aaCoreDisplay: Observable<string> = {
    get: () => aaCore,
    set: () => {},
    subscribe: () => () => {},
  };

  const defaultVerifierDisplay: Observable<string> = {
    get: () => defaultVerifier,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  // Connected wallet as a 0x script hash so the PlayArea can prefill the backup
  // owner and flag a mismatch (the backup owner must witness registerAccount).
  const connectedWalletDisplay: Observable<string> = {
    get: () => {
      const hash = connectedWalletHash();
      return hash ? `0x${hash}` : "";
    },
    set: () => {},
    subscribe: (fn) => app.chain.address.subscribe(fn),
  };

  // Helpers
  // Inspect accepts a literal 20-byte accountId (the value the contract stores).
  // V3 ids are registration-parameter hashes, so a free seed can never map to a
  // registered account — only a canonical 0x/40-hex hash is meaningful here.
  function normalizeAccountIdHash(input: string): string {
    const normalized = normalizeScriptHash(String(input || "").trim()).replace(/^0x/, "");
    if (!/^[0-9a-f]{40}$/i.test(normalized)) {
      throw new Error(t("invalidAccountId"));
    }
    return normalized.toLowerCase();
  }

  function normalizeHashOrZero(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "0x0000000000000000000000000000000000000000";
    const normalized = trimmed.startsWith("N") ? addressToScriptHash(trimmed) : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidHash"));
    return normalized;
  }

  function normalizeBackupOwner(value: string): string {
    const normalized = value.trim().startsWith("N") ? addressToScriptHash(value.trim()) : normalizeScriptHash(value.trim());
    if (!/^0x[0-9a-f]{40}$/i.test(normalized)) throw new Error(t("invalidBackupOwner"));
    return normalized;
  }

  // The connected wallet as a bare (no 0x) lowercase script hash, or "" when no
  // wallet/derivation. registerAccount aborts "Backup owner witness required"
  // unless the backup owner signs, so the backup owner must equal the connected
  // wallet.
  function connectedWalletHash(): string {
    const addr = app.chain.address.get();
    if (!addr) return "";
    // framework-exempt: false-not-throw comparison key — an unparsable wallet
    // address must compare as "" (skip the pre-flight check), not throw the
    // way app.chain.arg.hash160 / app.wallet.scriptHash() would.
    try {
      const hash = addressToScriptHash(addr).replace(/^0x/, "").toLowerCase();
      return /^[0-9a-f]{40}$/.test(hash) ? hash : "";
    } catch {
      return "";
    }
  }

  // Parse + validate the escape timelock before any chain round-trip. Rejects
  // non-integers, 0, negatives, and out-of-range values (uint32 / 7-90 day
  // bounds enforced by the contract) with a clear, immediate, localized error
  // instead of a confusing low-level wallet failure.
  function parseEscapeTimelock(value: string): number {
    const trimmed = String(value || "").trim();
    if (!/^[0-9]+$/.test(trimmed)) throw new Error(t("invalidTimelock"));
    const seconds = Number.parseInt(trimmed, 10);
    if (
      !Number.isInteger(seconds) ||
      seconds < AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS ||
      seconds > AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS
    ) {
      throw new Error(t("invalidTimelock"));
    }
    return seconds;
  }

  // Strip an optional 0x prefix and validate that the verifier params are valid
  // even-length hex before sending as a ByteArray arg, so odd-length or non-hex
  // input surfaces a localized error instead of an opaque serialization failure.
  function sanitizeVerifierParams(value: string): string {
    const normalized = String(value || "").trim().replace(/^0x/i, "");
    if (normalized && (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized))) {
      throw new Error(t("invalidVerifierParams"));
    }
    return normalized;
  }

  // Hash160 reads come back as little-endian ByteStrings; parseHash160 reverses
  // them to the canonical 0x display form so they match the hashes the user
  // typed (parseInvokeResult would otherwise show the byte-reversed value or, if
  // every byte is printable, garbage text). Empty/zero reads fall back to "—".
  function formatHash160Read(result: unknown): string {
    const display = parseHash160(result);
    if (!display || /^0x0{40}$/i.test(display)) return t("notAvailable");
    return display;
  }

  function humanizeEscapeTimelock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return t("notAvailable");
    const days = seconds / 86400;
    const rounded = Number.isInteger(days) ? String(days) : days.toFixed(1);
    return t("timelockDays", { days: rounded });
  }

  const inspectAccount = async () => {
    try {
      isInspecting.set(true);
      const accountIdHash = normalizeAccountIdHash(inspectForm.accountIdInput);
      const accountId = `0x${accountIdHash}`;
      const accountIdArg = app.chain.arg.hash160(accountId);

      const [verifierResult, hookResult, backupResult, timelockResult, escapeActiveResult] =
        await Promise.all([
          app.chain.readRaw("getVerifier", [accountIdArg], { scriptHash: aaCore }),
          app.chain.readRaw("getHook", [accountIdArg], { scriptHash: aaCore }),
          app.chain.readRaw("getBackupOwner", [accountIdArg], { scriptHash: aaCore }),
          app.chain.readRaw("getEscapeTimelock", [accountIdArg], { scriptHash: aaCore }),
          app.chain.readRaw("isEscapeActive", [accountIdArg], { scriptHash: aaCore }),
        ]);

      currentVerifier.set(formatHash160Read(verifierResult));
      currentHook.set(formatHash160Read(hookResult));
      currentBackupOwner.set(formatHash160Read(backupResult));

      const timelockSeconds = Number(parseInvokeResult(timelockResult) ?? 0);
      currentEscapeTimelock.set(humanizeEscapeTimelock(timelockSeconds));
      currentEscapeActive.set(
        parseInvokeResult(escapeActiveResult) ? t("escapeActive") : t("escapeInactive"),
      );
      // The read succeeded: surface the detail grid even when verifier/hook are
      // empty, rather than masking it behind the "not inspected" placeholder.
      hasInspected.set(true);

      storageService.set(`account:${accountIdHash}`, {
        verifier: currentVerifier.get(),
        hook: currentHook.get(),
        backupOwner: currentBackupOwner.get(),
        inspectedAt: Date.now(),
      }).catch(() => {});
    } catch (error: unknown) {
      throw error;
    } finally {
      isInspecting.set(false);
    }
  };

  const submitRegister = async () => {
    try {
      isSubmitting.set(true);
      const verifierHash = normalizeHashOrZero(registerForm.verifierHash);
      const hookHash = normalizeHashOrZero(registerForm.hookHash);
      const backupOwner = normalizeBackupOwner(registerForm.backupOwner);
      const escapeTimelock = parseEscapeTimelock(registerForm.escapeTimelock);
      const verifierParams = sanitizeVerifierParams(registerForm.verifierParamsHex);

      // The backup owner must witness registerAccount (contract aborts "Backup
      // owner witness required" otherwise). Only the connected wallet can sign,
      // so block any backup owner that is not the connected wallet before the
      // user pays a doomed transaction.
      const walletHash = connectedWalletHash();
      if (walletHash && backupOwner.replace(/^0x/, "").toLowerCase() !== walletHash) {
        throw new Error(t("backupOwnerMustSign"));
      }

      // Derive the only accountId the contract will accept (the seed text is
      // carried into verifierParams, matching computeRegistrationAccountId).
      const accountIdHash = deriveRegistrationAccountIdHash({
        verifierContractHash: verifierHash,
        verifierParamsHex: verifierParams,
        hookContractHash: hookHash,
        backupOwnerAddress: backupOwner,
        escapeTimelock,
      });

      await app.chain.invoke(
        "registerAccount",
        [
          app.chain.arg.hash160(`0x${accountIdHash}`),
          app.chain.arg.hash160(verifierHash),
          app.chain.arg.byteArray(verifierParams),
          app.chain.arg.hash160(hookHash),
          app.chain.arg.hash160(backupOwner),
          app.chain.arg.integer(escapeTimelock),
        ],
        { scriptHash: aaCore },
      );

      storageService.set(`registered:${accountIdHash}`, {
        verifier: verifierHash,
        hook: hookHash,
        backupOwner,
        escapeTimelock,
        registeredAt: Date.now(),
      }).catch(() => {});

      // Pin the registered id back into the inspect form and confirm on-chain:
      // poll getVerifier a few times so the inspector flips to the fresh state
      // (or surfaces "pending confirmation") instead of holding stale/empty data.
      inspectForm.accountIdInput = `0x${accountIdHash}`;
      await confirmRegistration(accountIdHash);
    } catch (error: unknown) {
      throw error;
    } finally {
      isSubmitting.set(false);
    }
  };

  // Poll getVerifier after a register broadcast so the inspector reflects the
  // freshly registered account. RPC nodes lag behind the tx, so retry a few
  // times; a non-empty read means the registration executed.
  async function confirmRegistration(accountIdHash: string): Promise<void> {
    const accountId = `0x${accountIdHash}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 4000 : 5000));
      try {
        const verifier = await app.chain.readRaw(
          "getVerifier",
          [app.chain.arg.hash160(accountId)],
          { scriptHash: aaCore },
        );
        const display = parseHash160(verifier);
        if (display && !/^0x0{40}$/i.test(display)) {
          await inspectAccount();
          return;
        }
      } catch {
        // RPC hiccup or node lag — keep retrying within the attempt budget.
      }
    }
  }

  const loadAll = async () => {};

  return {
    inspectForm,
    registerForm,
    currentVerifier,
    currentHook,
    currentBackupOwner,
    currentEscapeTimelock,
    currentEscapeActive,
    hasInspected,
    isInspecting,
    isSubmitting,
    aaCoreDisplay,
    defaultVerifierDisplay,
    networkDisplay,
    connectedWalletDisplay,
    aaCore,
    inspectAccount,
    submitRegister,
    loadAll,
  };
}

export type UseAAAccountLabReturn = ReturnType<typeof useAAAccountLab>;
